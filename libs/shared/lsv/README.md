# @slim/lsv

Dependency-free LSV noise-calculation engine (Beilage B1 chapter 7, Beilage B1.4):
levels (GEMW / ESM), Anhang 9 (military) and Anhang 7 (civil) assessment levels,
usages → operating data (workday split, half-days), limits per Empfindlichkeitsstufe
and the traffic-light rules. Used by the API (assessment, simulation) and the app.

Specs run with the api project: `npx nx test api`. Docs: `docs/architecture/laermberechnung.md`.
