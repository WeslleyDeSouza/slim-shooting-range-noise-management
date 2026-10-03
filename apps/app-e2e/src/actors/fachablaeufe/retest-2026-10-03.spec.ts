import { readFile } from 'node:fs/promises';
import { tags } from '../support/actors';
import { expect, test, type ActorFixtures } from '../support/test';
import { mockMapTiles } from '../../support/map';
import { skipWelcome } from '../../support/login';

// Real local API and actor login; only external map backgrounds are stubbed.
// No persistent fachliche data is changed. This is not a GDB or sonARMS reference test.
async function areaId(api: ActorFixtures['apiAs'], name: string) {
  const response = await api.get('/api/admin/area');
  expect(response.status()).toBe(200);
  const areas: { id: string; name: string }[] = await response.json();
  const area = areas.find(a => a.name === name);
  expect(area, `Demo fixture ${name} required`).toBeDefined();
  if (!area) throw new Error(`Missing fixture: ${name}`);
  return area.id;
}
const number = (text: string) => Number(text.replace(/[’'\s]/g, '').replace(',', '.'));

test.describe('Fachlicher Retest 03.10.2026', () => {
  test.beforeEach(async ({ page, signInAs }) => {
    await skipWelcome(page);
    await mockMapTiles(page);
    await signInAs('A01');
  });

  test('R01 Simulation trennt kg und Schuss, skaliert und lässt Nutzungen unverändert',
    { annotation: tags({ actor: 'A01', slm: [12, 50], prio: 1 }) },
    async ({ page, apiAs }, info) => {
      const id = await areaId(apiAs, 'Geissalp');
      const before = await apiAs.get(`/api/admin/area/${id}/usage/overview`);
      expect(before.status()).toBe(200);
      const usages = (await before.json()).usages;
      await page.goto(`/admin/area/${id}/simulation`);
      const rows = page.getByTestId('sim-row');
      const explosive = rows.filter({ hasText: 'Sprengladung' });
      await expect(explosive).toHaveCount(1);
      await expect(explosive).toContainText('kg');
      const original = await explosive.getByTestId('sim-inside').inputValue();
      await page.getByTestId('sim-edit').click();
      // Explicit mixed-unit oracle: 12.5 kg and at least one positive shot quantity.
      await explosive.getByTestId('sim-inside').fill('12.5');
      await explosive.getByTestId('sim-inside').press('Tab');
      await explosive.getByTestId('sim-outside').fill('0');
      await explosive.getByTestId('sim-outside').press('Tab');
      const state = page.getByTestId('sim-state');
      await expect(page.locator('tfoot [data-unit="kg"] b')).toHaveText('12.5');
      const shotsBefore = (await page.locator('tfoot [data-unit="shots"] b').allTextContents()).reduce((sum, value) => sum + number(value), 0);
      expect(shotsBefore).toBeGreaterThan(0);
      await page.locator('[data-testid="sim-scale"][data-factor="1.5"]').click();
      await expect(state.locator('[data-unit="kg"] b')).toHaveText('18.75');
      const shotsAfter = number(await state.locator('[data-unit="shots"] b').innerText());
      expect(shotsAfter).toBeCloseTo(shotsBefore * 1.5, 1);
      const resultPromise = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/calculation/simulation'));
      await page.getByTestId('sim-run').click();
      const response = await resultPromise;
      expect(response.status()).toBeLessThan(300);
      const result = await response.json();
      expect(result.totals.insideKg + result.totals.outsideKg).toBe(18.75);
      expect(result.totals.inside + result.totals.outside).toBeCloseTo(shotsAfter, 2);
      await expect(page.getByTestId('sim-result-row').first()).toBeVisible();
      await info.attach('simulation-result.json', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
      await page.getByTestId('sim-reset').click();
      await expect(explosive.getByTestId('sim-inside')).toHaveValue(original);
      await expect(page.getByTestId('sim-run')).toBeDisabled();
      const after = await apiAs.get(`/api/admin/area/${id}/usage/overview`);
      expect(after.status()).toBe(200);
      expect((await after.json()).usages).toEqual(usages);
    });

  test('R02 fehlende Grundlage zeigt keine erfundene Karte',
    { annotation: tags({ actor: 'A01', slm: [2, 4, 50], prio: 1 }) },
    async ({ page, apiAs }) => {
      const id = await areaId(apiAs, 'Hinterrhein');
      const response = await apiAs.get(`/api/admin/area/${id}/calculation/simulation`);
      expect(response.status()).toBe(200);
      expect((await response.json()).calculation).toBeNull();
      await page.goto(`/admin/area/${id}/simulation`);
      await expect(page.getByTestId('sim-edit')).toBeVisible();
      await expect(page.locator('[data-kind="schematic"]')).toHaveCount(0);
      await expect(page.getByTestId('sim-pin')).toHaveCount(0);
      await expect(page.locator('body')).not.toContainText('Lattigen');
      await expect(page.locator('body')).not.toContainText('Laberhus');
      await page.getByTestId('sim-edit').click();
      const input = page.getByTestId('sim-inside').first();
      await input.fill('10');
      await input.press('Tab');
      await page.locator('[data-testid="sim-scale"][data-factor="1.5"]').click();
      await expect(page.getByTestId('sim-run')).toBeDisabled();
      await expect(page.getByTestId('sim-pdf')).toBeDisabled();
      await expect(page.getByTestId('sim-no-basis')).toBeVisible();
      await expect(page.getByTestId('sim-state')).not.toContainText('Simulation aktuell');
      await expect(page.locator('.sim__head-meta')).not.toContainText('0 überschritten');
      // UI guard alone is insufficient: a direct request must also be rejected.
      const base = await response.json();
      const rejected = await apiAs.post(`/api/admin/area/${id}/calculation/simulation`, { data: {
        year: base.year, rows: base.rows.map((r: { roomId: string; combinationId: string }) => ({
          roomId: r.roomId, combinationId: r.combinationId, inside: 15, outside: 0,
        })),
      } });
      expect(rejected.status()).toBe(400);
      expect(await rejected.text()).toContain('No calculation basis with receivers available');
    });

  test('R03 drei repräsentative Jahre, Duplikate und ungültige Eingaben',
    { annotation: tags({ actor: 'A01', slm: [11, 44], prio: 2 }) },
    async ({ page, apiAs }, info) => {
      const id = await areaId(apiAs, 'Geissalp');
      await page.goto(`/admin/area/${id}/details`);
      const years = page.getByTestId('details-years');
      await expect(years).toBeVisible();
      const assessment = page.waitForResponse(r => r.url().includes('/calculation/assessment') && new URL(r.url()).searchParams.get('years') === '2020,2023,2026');
      await years.fill('2026, 2020, 2023');
      await years.press('Tab');
      const response = await assessment;
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.period.selectedYears).toEqual([2020, 2023, 2026]);
      await expect(page.locator('body')).toContainText('2020, 2023, 2026');
      await info.attach('representative-years.json', { body: JSON.stringify(body, null, 2), contentType: 'application/json' });
      for (const invalid of ['2025, 2025, 2026', '2020, xyz, 2025', '1899, 2023, 2025', '2201, 2023, 2025']) {
        await years.fill(invalid);
        await years.press('Tab');
        await expect(years).toHaveAttribute('aria-invalid', 'true');
        await expect(page.locator('#details-years-help')).toHaveClass(/slim-text--danger/);
      }
      await years.fill('2020, 2023, 2026');
      await years.press('Tab');
      await expect(years).toHaveAttribute('aria-invalid', 'false');
      await page.getByTestId('details-export').click();
      const downloading = page.waitForEvent('download');
      await page.getByTestId('details-export-csv').click();
      const download = await downloading;
      const path = await download.path();
      if (!path) throw new Error('Details CSV download did not produce a file');
      const csv = await readFile(path, 'utf8');
      expect(csv).toContain('2020, 2023, 2026');
      await info.attach(download.suggestedFilename(), { body: csv, contentType: 'text/csv' });
    });

  test('R04 JSON-Download hat das angekündigte Format und Zustandsobjekte',
    { annotation: tags({ actor: 'A01', slm: [20], prio: 2 }) },
    async ({ page, apiAs }, info) => {
      const id = await areaId(apiAs, 'Geissalp');
      await page.goto(`/admin/data-management/area/${id}/calculations/export`);
      const button = page.getByTestId('dce-export-states');
      await expect(button).toHaveText(/JSON/);
      await page.getByTestId('dce-state-check').nth(0).check();
      await page.getByTestId('dce-state-check').nth(1).check();
      const downloading = page.waitForEvent('download');
      await button.click();
      const download = await downloading;
      expect(download.suggestedFilename()).toMatch(/\.json$/);
      const path = await download.path();
      expect(path).toBeTruthy();
      if (!path) throw new Error('Download did not produce a local file');
      const contents = await readFile(path, 'utf8');
      const bundle = JSON.parse(contents);
      expect(bundle.format).toBe('slim-state-export');
      expect(bundle.states).toHaveLength(2);
      expect(bundle.states.map((s: { state: { externalId: string } }) => s.state.externalId).sort()).toEqual(['02218_1', '02218_2']);
      for (const state of bundle.states) {
        for (const key of ['plantParts', 'sources', 'immissionPoints', 'wlr', 'buildings', 'isophones', 'obstacles', 'highScreens', 'shootingHouses', 'measuresPoint', 'measuresArea', 'measuresOperational', 'measuresSsf']) {
          expect(Array.isArray(state[key]), key).toBe(true);
        }
        const sources = new Set(state.sources.map((s: { sourceId: string }) => s.sourceId));
        const points = new Set(state.immissionPoints.map((p: { sonarmsId: string }) => p.sonarmsId));
        for (const level of state.wlr) {
          expect(sources.has(level.source)).toBe(true);
          expect(points.has(level.point)).toBe(true);
        }
      }
      await info.attach(download.suggestedFilename(), { body: contents, contentType: 'application/json' });
    });

  test('R05 Schusszahlen über Tastatur sortierbar',
    { annotation: tags({ actor: 'A01', slm: [3, 52], prio: 2 }) },
    async ({ page, apiAs }) => {
      const id = await areaId(apiAs, 'Geissalp');
      await page.goto(`/admin/area/${id}/shots`);
      const header = page.locator('.shots__th').first();
      await header.getByRole('button').focus();
      await page.keyboard.press('Enter');
      await expect(header).toHaveAttribute('aria-sort', 'ascending');
      await page.keyboard.press('Enter');
      await expect(header).toHaveAttribute('aria-sort', 'descending');
      await expect(page.locator('.shots__group').first()).toBeVisible();
      const quantityHeader = page.locator('.shots__th.slim-table__cell--num');
      await quantityHeader.getByRole('button').click();
      await expect(quantityHeader).toHaveAttribute('aria-sort', 'ascending');
      const quantities = page.locator('[data-testid="shots-row"] [data-testid="shots-quantity"] b');
      const ascending = (await quantities.allTextContents()).map(number);
      expect(ascending.length).toBeGreaterThan(1);
      expect(ascending).toEqual([...ascending].sort((a, b) => a - b));
      await quantityHeader.getByRole('button').press('Enter');
      await expect(quantityHeader).toHaveAttribute('aria-sort', 'descending');
      expect((await quantities.allTextContents()).map(number)).toEqual([...ascending].reverse());
    });

  test('R06 Waffen-Stammdatensatz ist nach Neuladen direkt adressierbar',
    { annotation: tags({ actor: 'A01', slm: [5, 22], prio: 2 }) },
    async ({ page }) => {
      await page.goto('/admin/data-management/weapons/combination');
      const row = page.getByTestId('dmw-row').first();
      await expect(row).toBeVisible();
      const name = await row.getAttribute('data-name');
      await row.click();
      await expect(page).toHaveURL(/record=[0-9a-f-]+/);
      const address = page.url();
      await page.reload();
      await expect(page.getByTestId('dmw-detail')).toBeVisible();
      await expect(page.getByTestId('dmw-name-de')).toHaveValue(name ?? '');
      const unknown = new URL(address);
      unknown.searchParams.set('record', '00000000-0000-4000-8000-000000000000');
      await page.goto(unknown.toString());
      await expect(page.getByTestId('dmw-link-missing')).toBeVisible();
      await expect(page.getByTestId('dmw-form')).toHaveCount(0);
      await expect(page.locator('[data-testid="dmw-row"][aria-selected="true"]')).toHaveCount(0);
    });

  test('R07 Warnlegende hat eine strikt offene 5-dB-Grenze',
    { annotation: tags({ actor: 'A01', slm: [34, 50], prio: 2 }) },
    async ({ page, apiAs }) => {
      const id = await areaId(apiAs, 'Geissalp');
      await page.goto(`/admin/area/${id}/simulation`);
      await expect(page.locator('.slim-legend__item').filter({ hasText: '5 dB' })).toContainText('< 5 dB');
      await expect(page.locator('body')).not.toContainText('≤ 5 dB');
      // Exact numerical boundary is covered by the kernel tests, not by this label assertion.
    });

  test('R08 Detailauswahl bleibt beim Tabwechsel erhalten und ist je Platz getrennt',
    { annotation: tags({ actor: 'A01', slm: [11, 44], prio: 2 }) },
    async ({ page, apiAs }) => {
      const id = await areaId(apiAs, 'Geissalp');
      await page.goto(`/admin/area/${id}/details`);
      const years = page.getByTestId('details-years');
      await years.fill('2020, 2023, 2025');
      await years.press('Tab');
      const calculation = page.getByTestId('details-calc-select');
      await calculation.selectOption({ index: 1 });
      const selected = await calculation.inputValue();
      await page.getByTestId('area-tab-simulation').click();
      await expect(page.getByTestId('sim-edit')).toBeVisible();
      const assessment = page.waitForResponse(r => r.url().includes('/calculation/assessment') &&
        new URL(r.url()).searchParams.get('years') === '2020,2023,2025' &&
        new URL(r.url()).searchParams.get('calculationId') === selected);
      await page.getByTestId('area-tab-details').click();
      expect((await assessment).status()).toBe(200);
      await expect(years).toHaveValue('2020, 2023, 2025');
      await expect(calculation).toHaveValue(selected);
      await page.locator('.area-ctx__switch').click();
      await page.locator('.area-ctx__area a').filter({ hasText: 'Thun' }).click();
      await expect(years).toHaveValue('');
      await years.fill('2021, 2022, 2024');
      await years.press('Tab');
      await page.locator('.area-ctx__switch').click();
      await page.locator('.area-ctx__area a').filter({ hasText: 'Geissalp' }).click();
      await expect(years).toHaveValue('2020, 2023, 2025');
      await expect(calculation).toHaveValue(selected);
    });

  test('R09 nur Entwurf ohne Aktuell-Zeiger wird nicht automatisch beurteilt',
    { annotation: tags({ actor: 'A01', slm: [4, 12, 18], prio: 1 }) },
    async ({ page, apiAs }, info) => {
      // This fixture writes and cleans up data: fail before mutation on remote hosts.
      expect(new URL(String(info.project.use.baseURL)).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
      const id = await areaId(apiAs, 'Hinterrhein');
      const dm = `/api/admin/data/area/${id}/calculations`;
      const created = await apiAs.post(`${dm}/delivery`, { data: {
        name: `E2E draft ${Date.now()}`, deliveredAt: '2026-10-03', supplier: 'E2E',
      } });
      expect(created.status()).toBe(201);
      const delivery = await created.json();
      try {
        const state = await apiAs.post(`${dm}/state`, { data: {
          calculationId: delivery.id, name: `Draft ${delivery.id}`, referenceYear: 2026,
        } });
        expect(state.status()).toBe(201);
        expect((await state.json()).isCurrent).toBe(false);
        const basis = await apiAs.get(`/api/admin/area/${id}/calculation/simulation`);
        expect(basis.status()).toBe(200);
        expect((await basis.json()).calculation).toBeNull();
        await page.goto(`/admin/area/${id}/details`);
        await expect(page.getByTestId('details-calc-select').locator('option')).toHaveCount(2);
        await expect(page.getByTestId('details-calc-select')).toHaveValue('');
        await page.getByTestId('area-tab-simulation').click();
        await expect(page.getByTestId('sim-no-basis')).toBeVisible();
        await expect(page.getByTestId('sim-run')).toBeDisabled();
        await expect(page.getByTestId('sim-pdf')).toBeDisabled();
        await expect(page.locator('[data-kind="schematic"]')).toHaveCount(0);
      } finally {
        const removed = await apiAs.delete(`${dm}/delivery/${delivery.id}`);
        expect(removed.status()).toBe(204);
      }
    });
});
