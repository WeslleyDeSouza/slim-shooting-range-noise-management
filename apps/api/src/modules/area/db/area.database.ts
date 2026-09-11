import { AreaEntity } from '../entities';

/** Entities of this module; spread into the TypeORM list in app.module.ts. */
const DBOptions = {
  entities: [AreaEntity],
};

export default DBOptions;
