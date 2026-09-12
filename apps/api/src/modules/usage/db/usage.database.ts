import { AreaUsageEntity, UsagePositionEntity } from '../entities';

/** Entities of this module (Nutzungen, B1 Kap. 10.3); spread into the TypeORM list in app.module.ts. */
const DBOptions = {
  entities: [AreaUsageEntity, UsagePositionEntity],
};

export default DBOptions;
