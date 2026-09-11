import { INestApplication, INestApplicationContext } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Where the diagram lands in the repo (dev only). */
export const UML_FILE = 'docs/architecture/uml.mmd';

/**
 * Entity-relationship diagram of the live TypeORM metadata as Mermaid
 * (ELO pattern): served at `/erd` (viewer) and `/erd/mermaid.mmd` (raw)
 * outside production, and written to `docs/architecture/uml.mmd` so the
 * docs always show the schema that is actually running. Every entity
 * change (galaxy or ours) reaches the diagram on the next API start.
 */
export async function setupMermaidUml(
  app: INestApplication | INestApplicationContext,
): Promise<void> {
  if (process.env['APP_ENV'] === 'production') return;

  // Dynamic import: typeorm-erd is a devDependency and never loads in prod.
  const { ERDBuilder } = await import('typeorm-erd');
  const dataSource = app.get(DataSource);
  const erd = new ERDBuilder('mermaid', dataSource);
  await erd.initialize();
  const mermaid = await erd.render();

  if ('getHttpAdapter' in app) {
    const router = (app as INestApplication).getHttpAdapter().getInstance();
    router.get('/erd/mermaid.mmd', (_req: unknown, res: { type: (t: string) => { send: (b: string) => void } }) => {
      res.type('text/plain').send(mermaid);
    });
    router.get('/erd', (_req: unknown, res: { type: (t: string) => { send: (b: string) => void } }) => {
      res.type('text/html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>SLIM · ERD (Mermaid)</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:24px;font-family:system-ui,'Segoe UI',Roboto,sans-serif">
  <h1 style="margin-top:0">Entity Relationship Diagram</h1>
  <p>Generated from the running TypeORM metadata. Raw: <a href="/erd/mermaid.mmd">/erd/mermaid.mmd</a></p>
  <div class="mermaid">
${mermaid}
  </div>
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
  <script>mermaid.initialize({ startOnLoad: true, theme: 'default' });</script>
</body>
</html>`);
    });
  }

  const outFile = path.resolve(UML_FILE);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, mermaid, 'utf8');
}
