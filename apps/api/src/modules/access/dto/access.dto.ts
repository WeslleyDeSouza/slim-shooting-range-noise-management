import { ApiProperty } from '@nestjs/swagger';

/** Access levels of the galaxy `app_role_right.access` (see roles.mock-data.ts). */
export const APP_ACCESS = ['read', 'write', 'delete', 'root'] as const;
export type AppAccess = (typeof APP_ACCESS)[number];

/** Right of the signed-in user on one app (sitemap area) of the current tenant. */
export class AppAccessDto {
  @ApiProperty({ description: 'galaxy app id (`app_app.appId`, `SLIM_APP_ID` / `GALAXY_APP_ID` in @slim/shared), z. B. 41 = Datenverwaltung › Schiessplatz' })
  appId: number;

  @ApiProperty({ enum: APP_ACCESS, description: 'Bestes Recht über alle aktiven Rollen des Benutzers: read (nur lesen), write (alles ausser DELETE), delete, root (alles). Apps ohne Recht («X») fehlen in der Liste' })
  access: AppAccess;
}
