import { SelectionListValueEntity, SystemSettingsEntity, UserManualEntity } from '../entities';

/** Entities of this module: the Erweiterte Konfiguration (B1 5.28), the Benutzerhandbuch and the Auswahllisten (slm 1). */
const DBOptions = {
  entities: [SystemSettingsEntity, UserManualEntity, SelectionListValueEntity],
};

export default DBOptions;
