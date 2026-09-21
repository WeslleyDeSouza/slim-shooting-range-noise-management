import { CalculationFilesService, StateExportModel } from './calculation-files.service';

/**
 * File rules of Berechnungen Import / Export (B1 5.19, 5.20) — pure functions,
 * every branch with a case: delimiter detection, column aliases, number
 * formats, required fields, duplicates, CSV escaping and the round trip of
 * the state bundle through `StateImportDto`.
 */
describe('CalculationFilesService', () => {
  const files = new CalculationFilesService();

  describe('parseDelimited', () => {
    it('detects tab, semicolon and comma on the header and trims cells', () => {
      expect(files.parseDelimited('a\tb\n1\t2').delimiter).toBe('\t');
      expect(files.parseDelimited('a;b\n1;2').delimiter).toBe(';');
      expect(files.parseDelimited('a,b\n1,2').delimiter).toBe(',');
      const t = files.parseDelimited(' a ; b \n 1 ; 2 ');
      expect(t.header).toEqual(['a', 'b']);
      expect(t.rows).toEqual([{ line: 2, cells: ['1', '2'] }]);
    });

    it('skips empty and comment lines, strips a BOM and keeps quoted delimiters', () => {
      const t = files.parseDelimited('﻿name;value\n\n# comment\n"a;b";"say ""hi"""\n');
      expect(t.header).toEqual(['name', 'value']);
      expect(t.rows).toEqual([{ line: 2, cells: ['a;b', 'say "hi"'] }]);
    });

    it('returns an empty table for an empty file', () => {
      expect(files.parseDelimited('')).toEqual({ header: [], rows: [], delimiter: ';' });
    });
  });

  describe('parseWlr (sonARMS day.wlr / eve.wlr, Abbildung 32/33)', () => {
    const HEADER = 'Empfänger\tGebäude\tQuelle\tWaffe\tElevation\tLAE(MK)\tLAE(GK)\tLAE(Det)\tLAE\tLAFmax';

    it('maps the sonARMS columns to ImportWlrDto with the time group of the file', () => {
      const text = `${HEADER}\nE1\t696190\tSH300-Links_Stgw90\tSTGW90(5.6MMGWPAT90)\t0.1\t79.9\t70.6\t0\t80.4\t89.2\nE2\t696367\tSH300-Links_Stgw90\tSTGW90\t0\t74.8\t65.5\t0\t75.3\t83.9`;
      const parsed = files.parseWlr(text, 'eve');
      expect(parsed.errors).toEqual([]);
      expect(parsed.skipped).toBe(0);
      expect(parsed.rows).toEqual([
        { point: 'E1', source: 'SH300-Links_Stgw90', timeGroup: 'eve', lae: 80.4, lafmax: 89.2, laeMk: 79.9, laeGk: 70.6, laeDet: 0, elevation: 0.1 },
        { point: 'E2', source: 'SH300-Links_Stgw90', timeGroup: 'eve', lae: 75.3, lafmax: 83.9, laeMk: 74.8, laeGk: 65.5, laeDet: 0, elevation: 0 },
      ]);
    });

    it('accepts English headers, semicolons and decimal commas; optional levels stay null', () => {
      const parsed = files.parseWlr('Receiver;Source;LAE;LAFmax\nE1;Q1;60,5;70,25\n', 'day');
      expect(parsed.rows).toEqual([{ point: 'E1', source: 'Q1', timeGroup: 'day', lae: 60.5, lafmax: 70.25, laeMk: null, laeGk: null, laeDet: null, elevation: null }]);
    });

    it('reports a missing required column and parses nothing', () => {
      const parsed = files.parseWlr('Empfänger;Quelle;LAE\nE1;Q1;60', 'day');
      expect(parsed.rows).toEqual([]);
      expect(parsed.errors).toEqual(['Spalte «LAFmax» fehlt in der Kopfzeile']);
      expect(parsed.skipped).toBe(1);
    });

    it('reports and skips lines with missing or non-numeric values, keeps the good ones', () => {
      const parsed = files.parseWlr('Empfänger;Quelle;LAE;LAFmax\nE1;Q1;60;70\n;Q1;60;70\nE2;Q1;abc;70\nE3;;60;', 'day');
      expect(parsed.rows.map((r) => r.point)).toEqual(['E1']);
      expect(parsed.skipped).toBe(3);
      expect(parsed.errors).toEqual([
        'Zeile 3: Empfänger fehlt',
        'Zeile 4: LAE fehlt oder ist keine Zahl',
        'Zeile 5: Quelle fehlt, LAFmax fehlt oder ist keine Zahl',
      ]);
    });

    it('flags the same Empfänger × Quelle twice in one file', () => {
      const parsed = files.parseWlr('Empfänger;Quelle;LAE;LAFmax\nE1;Q1;60;70\nE1;Q1;61;71', 'day');
      expect(parsed.errors).toEqual(['E1 × Q1 ist doppelt in der Datei']);
    });
  });

  describe('parseOperatingA9 (BetriebA9, C5–C8)', () => {
    it('reads QuellenID, A9_M1, A9_M2, Schätzung, Jahr, Bemerkung', () => {
      const parsed = files.parseOperatingA9('QuellenID;A9_M1;A9_M2;Schätzung;Jahr;Bemerkung\nQ1;6879;1321;ja;2019;gezählt\nQ2;100;0;;;');
      expect(parsed.errors).toEqual([]);
      expect(parsed.rows).toEqual([
        { sourceId: 'Q1', data: { shotsInside: 6879, shotsOutside: 1321, estimated: true, year: 2019, remark: 'gezählt' } },
        { sourceId: 'Q2', data: { shotsInside: 100, shotsOutside: 0, estimated: false, year: null, remark: null } },
      ]);
    });

    it('understands the boolean spellings of the catalogue (1/x/ja/yes/true) and rejects fractions and negatives', () => {
      for (const yes of ['1', 'x', 'JA', 'Yes', 'true']) {
        expect(files.parseOperatingA9(`QuellenID;A9_M1;A9_M2;Schaetzung\nQ1;1;1;${yes}`).rows[0].data.estimated).toBe(true);
      }
      for (const no of ['0', '', 'nein', 'false']) {
        expect(files.parseOperatingA9(`QuellenID;A9_M1;A9_M2;Schaetzung\nQ1;1;1;${no}`).rows[0].data.estimated).toBe(false);
      }
      const bad = files.parseOperatingA9('QuellenID;A9_M1;A9_M2\nQ1;1.5;1\nQ2;-1;1\nQ3;1;1');
      expect(bad.rows.map((r) => r.sourceId)).toEqual(['Q3']);
      expect(bad.errors).toEqual([
        'Zeile 2: A9_M1 fehlt oder ist keine ganze Zahl ≥ 0',
        'Zeile 3: A9_M1 fehlt oder ist keine ganze Zahl ≥ 0',
      ]);
    });

    it('flags a QuellenID listed twice', () => {
      const parsed = files.parseOperatingA9('QuellenID;A9_M1;A9_M2\nQ1;1;1\nQ1;2;2');
      expect(parsed.errors).toEqual(['QuellenID Q1 ist doppelt in der Datei']);
    });
  });

  describe('parseOperatingA7 (D5–D10)', () => {
    it('reads the half days, shots, category and flags', () => {
      const parsed = files.parseOperatingA7('QuellenID;Kategorie;Halbtag_Wo;Halbtag_So;Zahl_Wo;Zahl_So;Schätzung;Jahr\nQ1;a;12.5;3;5000;800;nein;2024');
      expect(parsed.errors).toEqual([]);
      expect(parsed.rows).toEqual([
        { sourceId: 'Q1', data: { category: 'a', halfDaysWork: 12.5, halfDaysSunday: 3, shotsWork: 5000, shotsSunday: 800, estimated: false, year: 2024, remark: null } },
      ]);
    });

    it('rejects an unknown Anhang-7 category and missing half days', () => {
      const parsed = files.parseOperatingA7('QuellenID;Kategorie;Halbtag_Wo;Halbtag_So;Zahl_Wo\nQ1;z;1;1;1\nQ2;;;1;1');
      expect(parsed.rows).toEqual([]);
      expect(parsed.errors).toEqual([
        'Zeile 2: Kategorie «z» ist keine Waffenkategorie a–f nach Anhang 7',
        'Zeile 3: Halbtag_Wo fehlt oder ist keine Zahl ≥ 0',
      ]);
    });

    it('leaves the category open when the column is missing (the state keeps the mapping of the weapon)', () => {
      const parsed = files.parseOperatingA7('QuellenID;Halbtag_Wo;Halbtag_So;Zahl_Wo\nQ1;1;0;10');
      expect(parsed.errors).toEqual([]);
      expect(parsed.rows[0].data.category).toBeUndefined();
    });
  });

  describe('shotsCsv (5.20 Export Schusszahlen)', () => {
    it('writes a BOM, a German header, semicolons and CRLF, quoting cells that need it', () => {
      const csv = files.shotsCsv([
        {
          date: '2026-04-14', timeFrom: '08:00', timeTo: '11:30', roomName: 'Stellungsrm B 2', roomNo: '1104.020.06', unit: 'Inf Bat 5; Kp 2',
          usageType: 'military', civilUsageKind: null, combinationName: 'Stgw 90 · 5.6 mm', quantity: 2400, quantityUnit: 'shots', personCount: 80, recordedBy: 'Hptm "Beat" Roth', source: 'manual',
        },
        {
          date: '2026-05-01', timeFrom: '13:30', timeTo: '17:00', roomName: 'Stellungsraum A 3', roomNo: null, unit: 'Schützenverein',
          usageType: 'civil', civilUsageKind: 'field_shooting', combinationName: 'Sprengladung · kg', quantity: 12.3456, quantityUnit: 'kg', personCount: null, recordedBy: 'X', source: 'elo',
        },
      ]);
      const lines = csv.split('\r\n');
      expect(lines[0].startsWith('﻿Datum;Von;Bis;Stellungsraum;Koordinationsabschnitts-Nr.;Einheit;')).toBe(true);
      expect(lines[1]).toBe('2026-04-14;08:00;11:30;Stellungsrm B 2;1104.020.06;"Inf Bat 5; Kp 2";military;;Stgw 90 · 5.6 mm;2400;shots;80;"Hptm ""Beat"" Roth";manual');
      expect(lines[2]).toBe('2026-05-01;13:30;17:00;Stellungsraum A 3;;Schützenverein;civil;field_shooting;Sprengladung · kg;12.346;kg;;X;elo');
      expect(lines[3]).toBe('');
    });
  });

  describe('stateBundle / toImportDto (5.20 Export GeoDB, round trip)', () => {
    const model: StateExportModel = {
      calculation: { name: 'Lärmsanierung Geissalp', supplier: 'Empa', deliveredAt: '2025-03-25', description: 'Test', fileName: 'geissalp.gdb' },
      state: { externalId: '02218_1', name: 'Initial', referenceYear: 2019, isCurrent: true, isMgdm: false },
      plantParts: [{ id: 'p1', coordinationSectionNo: '1104.020.01', name: 'A1', type: 'Schiessanlage (300m)', builtAfter1985: false, roomName: 'Raum A1' }],
      sources: [
        {
          id: 's1', sourceId: 'Q1', plantPartId: 'p1', weaponSystem: 'Stgw90',
          a9: { shotsInside: 100, shotsOutside: 10, estimated: false, year: 2019, remark: null, planCategory: 'Stgw' },
          a7: null,
        },
        { id: 's2', sourceId: 'Q2', plantPartId: 'missing-part', weaponSystem: 'Mg51', a9: null, a7: { category: 'a', halfDaysWork: 1, halfDaysSunday: 0, shotsWork: 5, shotsSunday: null, estimated: true, year: null, remark: 'x', planCategory: 'Mg' } },
      ],
      points: [
        { id: 'e1', sonarmsId: 'E1', code: 'E1', egid: '1', address: 'Weg 1', municipality: 'Sigriswil', type: 'facade', sensitivityLevel: 'II', east: 1, north: 2, height: 3, mapX: 10, mapY: 20, sortOrder: 0 },
      ],
      wlr: [
        { immissionPointId: 'e1', sourceLineId: 's1', timeGroup: 'day', lae: 60, lafmax: 70, laeMk: null, laeGk: null, laeDet: null, elevation: null },
        { immissionPointId: 'e1', sourceLineId: 'orphan', timeGroup: 'day', lae: 1, lafmax: 2, laeMk: null, laeGk: null, laeDet: null, elevation: null },
      ],
    };

    it('builds one StateImportDto per state with ids replaced by the catalogue keys', () => {
      const bundle = files.stateBundle({ exportedAt: new Date('2026-09-19T10:00:00Z'), area: { coordinationSectionNo: '1104.020', name: 'Geissalp' }, states: [model] });
      expect(bundle.format).toBe('slim-state-export');
      expect(bundle.exportedAt).toBe('2026-09-19T10:00:00.000Z');
      expect(bundle.states).toHaveLength(1);
      const dto = bundle.states[0];
      expect(dto.calculation).toEqual({ name: 'Lärmsanierung Geissalp', supplier: 'Empa', deliveredAt: '2025-03-25', description: 'Test', fileName: 'geissalp.gdb' });
      expect(dto.state).toEqual({ externalId: '02218_1', name: 'Initial', referenceYear: 2019, isCurrent: true, isMgdm: false });
      expect(dto.plantParts[0]).toMatchObject({ coordinationSectionNo: '1104.020.01', builtAfter1985: false, roomName: 'Raum A1' });
      expect(dto.sources[0]).toMatchObject({ sourceId: 'Q1', plantPartNo: '1104.020.01', a9: { shotsInside: 100, shotsOutside: 10 }, a7: null });
      // A source whose plant part is unknown keeps an empty plantPartNo (the import will report it).
      expect(dto.sources[1].plantPartNo).toBe('');
      expect(dto.immissionPoints[0]).toMatchObject({ sonarmsId: 'E1', sensitivityLevel: 'II', mapX: 10 });
      // WLR rows are keyed by sonARMS id and QuellenID; orphans are dropped.
      expect(dto.wlr).toEqual([{ point: 'E1', source: 'Q1', timeGroup: 'day', lae: 60, lafmax: 70, laeMk: null, laeGk: null, laeDet: null, elevation: null }]);
    });
  });
});
