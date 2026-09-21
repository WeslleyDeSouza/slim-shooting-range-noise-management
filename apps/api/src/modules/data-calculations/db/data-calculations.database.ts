/**
 * No tables of its own: `immissionsberechnung`, `zustand` and the hellblau
 * objects belong to the calculation module, `nutzung` to the usage module.
 * Kept for the module convention (`static DBOptions`).
 */
const DBOptions = {
  entities: [] as never[],
};

export default DBOptions;
