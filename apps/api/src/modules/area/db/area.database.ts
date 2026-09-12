import {
  AreaEntity,
  AreaQuotaEntity,
  AreaRoomEntity,
  AreaUserEntity,
  CaliberEntity,
  HolidayEntity,
  RoomCombinationEntity,
  WeaponCategoryEntity,
  WeaponCombinationEntity,
  WeaponEntity,
} from '../entities';

/** Entities of this module (übergeordnete Stammdaten, B1 Kap. 10.1); spread into the TypeORM list in app.module.ts. */
const DBOptions = {
  entities: [
    AreaEntity,
    AreaRoomEntity,
    AreaUserEntity,
    WeaponCategoryEntity,
    WeaponEntity,
    CaliberEntity,
    WeaponCombinationEntity,
    RoomCombinationEntity,
    AreaQuotaEntity,
    HolidayEntity,
  ],
};

export default DBOptions;
