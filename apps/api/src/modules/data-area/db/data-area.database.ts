/**
 * The module owns no tables: it works on `schiessplatz`, `stellungsraum`,
 * `kontingent` and `waffe_kaliber_kombination` of the area module and reads
 * `zustand` of the calculation module. Kept for the module convention
 * (`static DBOptions`, spread into app.module.ts).
 */
const DBOptions = {
  entities: [] as never[],
};

export default DBOptions;
