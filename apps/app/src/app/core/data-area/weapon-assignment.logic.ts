import type { RoomWeaponAssignmentDto, WeaponAssignmentRoomDto } from '@ui-slim/apiClient';

export type RoomSortKey = 'coordinationSectionNo' | 'name' | 'enabled';
export type AssignmentSortKey = 'entryName' | 'weapon' | 'caliber' | 'categoryName';

const compare = (a: string, b: string): number => a.localeCompare(b, 'de-CH', { numeric: true });

/** Free-text search over Koordinationsabschnitts-Nr. and Bezeichnung (B1 5.17, Bedienelement 2). */
export function filterRooms(rooms: WeaponAssignmentRoomDto[], query: string): WeaponAssignmentRoomDto[] {
  const q = query.trim().toLowerCase();
  return rooms.filter((r) => !q || r.name.toLowerCase().includes(q) || (r.coordinationSectionNo ?? '').toLowerCase().includes(q));
}

/** Sorted copy; rooms without a Koordinationsabschnitts-Nr. always last, ties keep the order of the Schiessplatz. */
export function sortRooms(rooms: WeaponAssignmentRoomDto[], key: RoomSortKey, ascending: boolean): WeaponAssignmentRoomDto[] {
  const dir = ascending ? 1 : -1;
  return [...rooms].sort((a, b) => {
    if (key === 'enabled') return (Number(b.enabled) - Number(a.enabled)) * dir;
    const x = a[key] ?? '';
    const y = b[key] ?? '';
    if (x === '' && y !== '') return 1;
    if (y === '' && x !== '') return -1;
    return compare(x, y) * dir;
  });
}

/** The room the mask opens with: the first one that has assignments, else the first room. */
export function initialRoom(rooms: WeaponAssignmentRoomDto[]): WeaponAssignmentRoomDto | null {
  return rooms.find((r) => r.assignmentCount > 0) ?? rooms[0] ?? null;
}

/** «Zugeordnete Waffen» of one Stellungsraum, sorted by the chosen column. */
export function assignmentsOfRoom(
  assignments: RoomWeaponAssignmentDto[],
  roomId: string | null,
  key: AssignmentSortKey = 'entryName',
  ascending = true,
): RoomWeaponAssignmentDto[] {
  const dir = ascending ? 1 : -1;
  return assignments.filter((a) => a.roomId === roomId).sort((a, b) => compare(a[key], b[key]) * dir || compare(a.entryName, b.entryName));
}

/** «1104.020.06, Stellungsrm B 2» — the number is missing in exceptional cases (B1 5.15 hint). */
export function roomLabel(room: Pick<WeaponAssignmentRoomDto, 'coordinationSectionNo' | 'name'> | null): string {
  if (!room) return '';
  return room.coordinationSectionNo ? `${room.coordinationSectionNo} ${room.name}` : room.name;
}
