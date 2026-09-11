import { defineConfig } from 'vitest/config';

/**
 * Vitest — the test runner NestJS 12 ships by default for its ESM packages
 * (a CommonJS Jest setup cannot load them; Jest has no `require(esm)` on
 * Node < 24.9). Mirrors the official `nest new` template and alco-map:
 * tsconfig path aliases, globals on. OXC compiles the TypeScript, so the
 * legacy decorators + metadata that Nest and TypeORM rely on are switched
 * on here.
 */
export default defineConfig({
  root: import.meta.dirname,
  resolve: {
    tsconfigPaths: true,
  },
  oxc: {
    decorators: { legacy: true, emitDecoratorMetadata: true },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts', '../../libs/api/**/*.spec.ts'],
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: '../../coverage/apps/api',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/main.ts'],
    },
  },
});
