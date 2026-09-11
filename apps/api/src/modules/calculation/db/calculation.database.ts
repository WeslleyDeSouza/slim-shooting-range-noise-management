import {
  AreaCalculationEntity,
  AreaReceiverEntity,
  AreaWlrEntity,
} from '../entities';

/** Entities of this module; spread into the TypeORM list in app.module.ts. */
const DBOptions = {
  entities: [AreaCalculationEntity, AreaReceiverEntity, AreaWlrEntity],
};

export default DBOptions;
