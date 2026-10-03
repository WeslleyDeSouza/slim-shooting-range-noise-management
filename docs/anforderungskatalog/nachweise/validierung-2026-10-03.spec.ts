import { describe, expect, it } from 'vitest';
import { CalculationService } from '../../../apps/api/src/modules/calculation/calculation.service';
import { AreaCalculationEntity } from '../../../apps/api/src/modules/calculation/entities';
import { CalculationFilesService } from '../../../apps/api/src/modules/data-calculations/calculation-files.service';

// Review evidence: green means the documented gap was reproduced, not that B1 is fulfilled.
describe('Anforderungsvalidierung 03.10.2026 — reproduzierte Ist-Abweichungen', () => {
  it('F01: resolve declares an unmarked draft to be current when no current pointer exists', async () => {
    const draft = { id: 'draft', isCurrent: false } as AreaCalculationEntity;
    const context = { list: async () => [draft] } as unknown as CalculationService;
    const result = await CalculationService.prototype.resolve.call(context, 'tenant', 'area');
    expect(result.current).toBe(draft);
    expect(result.selected?.isCurrent).toBe(false);
  });

  it('F02: JSON state export drops additional state objects even when offered to the serializer', () => {
    const model = {
      calculation: { name: 'Test', supplier: 'Test', deliveredAt: '2026-10-03' },
      state: { externalId: 'S1', name: 'Test', referenceYear: 2026, isCurrent: false, isMgdm: false },
      plantParts: [], sources: [], points: [], wlr: [],
      perimeter: { name: 'Perimeter', geometry: 'POLYGON((0 0,1 0,1 1,0 0))' },
      buildings: [{ egid: '123', geometry: 'POLYGON((0 0,1 0,1 1,0 0))' }],
      obstacles: [{ name: 'Wand' }],
      measuresOperational: [{ name: 'Betriebliche Massnahme' }],
    };
    const result = new CalculationFilesService().toImportDto(model);
    expect(result.perimeter).toBeUndefined();
    expect(result.buildings).toBeUndefined();
    expect(result.obstacles).toBeUndefined();
    expect(result.measuresOperational).toBeUndefined();
  });
});
