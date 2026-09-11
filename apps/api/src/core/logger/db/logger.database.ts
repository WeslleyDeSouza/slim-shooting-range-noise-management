import { CoreLogEntity } from '../entities/core-log.entity';

/** Entities of the logbook; spread into the TypeORM list in app.module.ts. */
const DBOptions = {
  entities: [CoreLogEntity],
};

export default DBOptions;
