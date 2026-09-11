import {
  AreaEntity,
  AreaRoomEntity,
  AreaUserEntity,
  AreaWeaponEntity,
} from '../entities';

/** Entities of this module; spread into the TypeORM list in app.module.ts. */
const DBOptions = {
  entities: [AreaEntity, AreaRoomEntity, AreaWeaponEntity, AreaUserEntity],
};

export default DBOptions;
