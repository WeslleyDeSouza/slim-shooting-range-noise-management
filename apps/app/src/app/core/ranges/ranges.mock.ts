import { ShootingRange } from './ranges.model';

/** Sample data from `_mocks/home/index.html` — replaced by the API later. */
export const RANGES_MOCK: ShootingRange[] = [
  { id: 'verolliez', name: 'Vérolliez', ka: '1202.230', sp: null, quota: 'warn', noise: 'ok' },
  { id: 'gehren', name: 'Gehren', ka: '2111.030', sp: null, quota: 'ok', noise: 'ok' },
  { id: 'biere', name: 'Bière', ka: '2201.010', sp: null, quota: 'over', noise: 'warn' },
  { id: 'thun', name: 'Thun', ka: '3101.020', sp: null, quota: 'ok', noise: 'over' },
  { id: 'walenstadt', name: 'Walenstadt', ka: '4102.010', sp: null, quota: 'ok', noise: 'ok' },
  { id: 'isone', name: 'Isone', ka: '5101.040', sp: null, quota: 'warn', noise: 'ok' },
  { id: 'bure', name: 'Bure', ka: '6101.020', sp: null, quota: 'ok', noise: 'ok' },
  { id: 'hinterrhein', name: 'Hinterrhein', ka: '7102.010', sp: null, quota: 'none', noise: 'none' },
];

export const MASTER_DATA_MOCK = { ranges: 12, weapons: 48, users: 21 };

export const USER_MOCK = { name: 'Hans Muster', initials: 'HM' };
