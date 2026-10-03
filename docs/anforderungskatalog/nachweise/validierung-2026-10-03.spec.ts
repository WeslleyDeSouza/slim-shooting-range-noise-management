import { describe, expect, it } from 'vitest';
import { CalculationService } from '../../../apps/api/src/modules/calculation/calculation.service';
import { AreaCalculationEntity } from '../../../apps/api/src/modules/calculation/entities';
import { CalculationFilesService } from '../../../apps/api/src/modules/data-calculations/calculation-files.service';

// Regression checks after correction; full HTTP roundtrip and snapshot tests are in the API suite.
describe('Anforderungsvalidierung 03.10.2026 — korrigiertes Sollverhalten', () => {
  it('F01: resolve never declares an unmarked draft to be current', async () => {
    const draft = { id: 'draft', isCurrent: false } as AreaCalculationEntity;
    const context = { list: async () => [draft] } as unknown as CalculationService;
    const result = await CalculationService.prototype.resolve.call(context, 'tenant', 'area');
    expect(result.current).toBeNull();
    expect(result.selected).toBeNull();
    const explicit = await CalculationService.prototype.resolve.call(context, 'tenant', 'area', 'draft');
    expect(explicit.selected).toBe(draft);
    expect(explicit.current).toBeNull();
  });

  it('F02: JSON state export preserves additional state objects', () => {
    const model = {
      calculation: { name: 'Test', supplier: 'Test', deliveredAt: '2026-10-03' },
      state: { externalId: 'S1', name: 'Test', referenceYear: 2026, isCurrent: false, isMgdm: false },
      plantParts: [], sources: [], points: [], wlr: [],
      objects: {
        perimeter: { name: 'Perimeter', geometry: 'POLYGON((0 0,1 0,1 1,0 0))' },
        buildings: [{ egid: '123', geometry: 'POLYGON((0 0,1 0,1 1,0 0))' }],
        obstacles: [{ measureType: 'Wand' }],
        measuresOperational: [{ measureType: 'Betriebliche Massnahme' }],
      },
    };
    const result = new CalculationFilesService().toImportDto(model);
    expect(result).toMatchObject(model.objects);
  });
});
