import { DataSource } from 'typeorm';
import { AreaEntity, AreaStatus } from './entities';

interface AreaSeed {
  name: string;
  coordinationSectionNo: string;
  sectoralPlanNo: string | null;
  quotaStatus: AreaStatus;
  noiseStatus: AreaStatus;
}

/** Demo areas (from `_mocks/home/index.html`), seeded per tenant in non-production. */
export const AREA_DEMO: AreaSeed[] = [
  {
    name: 'Vérolliez',
    coordinationSectionNo: '1202.230',
    sectoralPlanNo: null,
    quotaStatus: 'warn',
    noiseStatus: 'ok',
  },
  {
    name: 'Gehren',
    coordinationSectionNo: '2111.030',
    sectoralPlanNo: null,
    quotaStatus: 'ok',
    noiseStatus: 'ok',
  },
  {
    name: 'Bière',
    coordinationSectionNo: '2201.010',
    sectoralPlanNo: null,
    quotaStatus: 'over',
    noiseStatus: 'warn',
  },
  {
    name: 'Thun',
    coordinationSectionNo: '3101.020',
    sectoralPlanNo: null,
    quotaStatus: 'ok',
    noiseStatus: 'over',
  },
  {
    name: 'Walenstadt',
    coordinationSectionNo: '4102.010',
    sectoralPlanNo: null,
    quotaStatus: 'ok',
    noiseStatus: 'ok',
  },
  {
    name: 'Isone',
    coordinationSectionNo: '5101.040',
    sectoralPlanNo: null,
    quotaStatus: 'warn',
    noiseStatus: 'ok',
  },
  {
    name: 'Bure',
    coordinationSectionNo: '6101.020',
    sectoralPlanNo: null,
    quotaStatus: 'ok',
    noiseStatus: 'ok',
  },
  {
    name: 'Hinterrhein',
    coordinationSectionNo: '7102.010',
    sectoralPlanNo: null,
    quotaStatus: 'none',
    noiseStatus: 'none',
  },
];

export namespace AREA_MOCK_DATA {
  /** Idempotent: only seeds a tenant that has no areas yet. */
  export const fill = async (
    dataSource: DataSource,
    tenantId: string,
  ): Promise<void> => {
    const repo = dataSource.getRepository(AreaEntity);
    if ((await repo.count({ where: { tenantId } })) > 0) return;
    await repo.save(
      AREA_DEMO.map((seed) =>
        repo.create({ ...seed, tenantId, enabled: true }),
      ),
    );
  };
}
