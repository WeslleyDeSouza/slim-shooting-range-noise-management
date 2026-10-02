import * as ExcelJS from 'exceljs';
import { authHeaders, createTestApp, insertTestUser, mockTenantId, mockUserId, TestApp, testDbSeedBeforeEach } from '@api-slim/tests';
import { CoreLogEntity, CoreLoggerModule, LogAction } from '../../logger';
import { TABLE_EXPORT_MAX_CELL, TABLE_EXPORT_MAX_COLUMNS } from '../dto/table-export.dto';
import { CoreExportModule } from '../export.module';

const URL = '/api/admin/export/table';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const body = (patch: Record<string, unknown> = {}) => ({
  format: 'xlsx',
  table: 'schiessplaetze',
  title: 'Übersicht Schiessplätze',
  filters: [{ label: 'Kontingent', value: 'Überschritten' }],
  header: ['Bezeichnung', 'Koordinationsabschnitt-Nr.', 'Jahr'],
  rows: [
    ['Thun', '1101.010', 2026],
    ['Bière', '1203.005', 2026],
  ],
  ...patch,
});

/** supertest hands a binary body over only with a parser of its own. */
const binary = (res: NodeJS.ReadableStream, done: (error: Error | null, data: Buffer) => void): void => {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => done(null, Buffer.concat(chunks)));
};

/**
 * Export of a table as Excel / CSV over HTTP (B1 5.5.5, slm 3): the file
 * holds what the mask sent, every signed-in user may export what they see,
 * and every export is written to the logbook.
 */
describe('AdminExportController (HTTP)', () => {
  let api: TestApp;

  const post = (payload: Record<string, unknown>, headers = authHeaders()) => api.http().post(URL).set(headers).send(payload);
  const logs = () => api.dataSource.getRepository(CoreLogEntity).find({ where: { tenantId: mockTenantId, section: 'TABLE' }, order: { createdAt: 'ASC' } });

  beforeAll(async () => {
    api = await createTestApp({ modules: [CoreLoggerModule, CoreExportModule], entities: [...CoreLoggerModule.DBOptions.entities] });
    await testDbSeedBeforeEach(api.dataSource);
  });

  afterAll(async () => {
    await api.close();
  });

  beforeEach(async () => {
    await api.dataSource.getRepository(CoreLogEntity).clear();
  });

  it('returns an Excel file with the block, the column titles in row 10 and the rows as sent', async () => {
    const res = await post(body()).buffer(true).parse(binary).expect(200);
    expect(res.headers['content-type']).toContain(XLSX_MIME);
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="schiessplaetze_\d{4}-\d{2}-\d{2}\.xlsx"$/);
    expect(res.headers['cache-control']).toBe('no-store');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(res.body);
    const ws = workbook.worksheets[0];
    expect(ws.name).toBe('Übersicht Schiessplätze');
    expect(ws.getCell('B2').value).toBe('2 angezeigte Zeilen');
    expect([ws.getCell('A4').value, ws.getCell('B4').value]).toEqual(['Kontingent:', 'Überschritten']);
    // «Exportiert von» is the signed-in user, not something the app sends.
    expect(ws.getCell('B8').value).toBe('Test User');
    expect((ws.getRow(10).values as unknown[]).slice(1)).toEqual(['Bezeichnung', 'Koordinationsabschnitt-Nr.', 'Jahr']);
    expect((ws.getRow(11).values as unknown[]).slice(1)).toEqual(['Thun', '1101.010', 2026]);
    expect((ws.getRow(12).values as unknown[]).slice(1)).toEqual(['Bière', '1203.005', 2026]);
    expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: 10 });
    expect(ws.autoFilter).toBe('A10:C12');
  });

  it('returns a CSV file with the column titles and the rows', async () => {
    const res = await post(body({ format: 'csv' })).buffer(true).parse(binary).expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toMatch(/schiessplaetze_\d{4}-\d{2}-\d{2}\.csv"$/);
    expect((res.body as Buffer).toString('utf8')).toBe('﻿Bezeichnung;Koordinationsabschnitt-Nr.;Jahr\r\nThun;1101.010;2026\r\nBière;1203.005;2026\r\n');
  });

  it('writes every export to the logbook: who, which table, how many rows, which filters', async () => {
    const otherId = await insertTestUser(api.dataSource);
    await post(body()).expect(200);
    await post(body({ format: 'csv', selection: true, rows: [['Thun', '1101.010', 2026]] }), authHeaders(otherId)).expect(200);

    const entries = await logs();
    expect(entries.map((e) => [e.userId, e.action, e.refType])).toEqual([
      [mockUserId, LogAction.EXPORT, 'XLSX_DOWNLOAD'],
      [otherId, LogAction.EXPORT, 'CSV_DOWNLOAD'],
    ]);
    expect(JSON.parse(entries[0].data as string)).toEqual({
      table: 'schiessplaetze',
      rows: 2,
      selection: false,
      filters: [{ label: 'Kontingent', value: 'Überschritten' }],
    });
    expect(JSON.parse(entries[1].data as string)).toMatchObject({ rows: 1, selection: true });
  });

  it('marks an export of selected rows in the block', async () => {
    const res = await post(body({ selection: true, lang: 'it' })).buffer(true).parse(binary).expect(200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(res.body);
    expect(workbook.worksheets[0].getCell('B2').value).toBe('2 righe selezionate');
  });

  it('exports a table without rows', async () => {
    await post(body({ rows: [] })).expect(200);
    expect(JSON.parse((await logs())[0].data as string).rows).toBe(0);
  });

  describe('rejects what is not a table', () => {
    const cases: [string, Record<string, unknown>][] = [
      ['an unknown format', { format: 'pdf' }],
      ['a table id that could leave the file name', { table: '../etc/passwd' }],
      ['a table id with upper case or blanks', { table: 'Schiess Plätze' }],
      ['no title', { title: '' }],
      ['no column', { header: [] }],
      ['too many columns', { header: Array.from({ length: TABLE_EXPORT_MAX_COLUMNS + 1 }, (_, i) => `c${i}`) }],
      ['a column title that is not text', { header: ['a', 2, 'c'] }],
      ['rows that are not arrays', { rows: ['Thun'] }],
      ['a cell that is an object', { rows: [['Thun', { formula: '1+1' }, 2026]] }],
      ['a cell that is a boolean', { rows: [['Thun', true, 2026]] }],
      ['a cell longer than the limit', { rows: [['x'.repeat(TABLE_EXPORT_MAX_CELL + 1), '', 1]] }],
      ['a row with more cells than columns', { rows: [['Thun', '1101.010', 2026, 'zu viel']] }],
      ['more filters than the block holds', { filters: Array.from({ length: 7 }, (_, i) => ({ label: `f${i}`, value: 'x' })) }],
      ['a filter without label', { filters: [{ label: '', value: 'x' }] }],
      ['an unknown language', { lang: 'es' }],
    ];
    it.each(cases)('%s', async (_name, patch) => {
      await post(body(patch)).expect(400);
      expect(await logs()).toHaveLength(0);
    });
  });
});
