import { SystemSettingsEntity, UserManualEntity } from '../entities';

/** Entities of this module: the Erweiterte Konfiguration (B1 5.28) and the Benutzerhandbuch. */
const DBOptions = {
  entities: [SystemSettingsEntity, UserManualEntity],
};

export default DBOptions;
