/**
 * No tables of its own: `waffenkategorie`, `waffe`, `kaliber` and
 * `waffe_kaliber_kombination` are declared by the area module (übergeordnete
 * Stammdaten, B1 Kap. 10.1). Kept for the module convention (`static DBOptions`).
 */
const DBOptions = {
  entities: [] as never[],
};

export default DBOptions;
