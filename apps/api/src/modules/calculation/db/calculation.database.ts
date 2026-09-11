import {
  AreaCalculationEntity,
  AreaReceiverEntity,
  AreaWlrEntity,
  ImmissionCalculationEntity,
} from '../entities';

/** Entities of this module; spread into the TypeORM list in app.module.ts. */
const DBOptions = {
  entities: [ImmissionCalculationEntity, AreaCalculationEntity, AreaReceiverEntity, AreaWlrEntity],
};

export default DBOptions;
