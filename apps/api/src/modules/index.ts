// Feature modules, one folder per feature (see CLAUDE.md and
// docs/architecture/sitemap.md). Each exports a module with a static
// `DBOptions = { entities: [...] }` that app.module.ts spreads into TypeORM.
export * from './area';
