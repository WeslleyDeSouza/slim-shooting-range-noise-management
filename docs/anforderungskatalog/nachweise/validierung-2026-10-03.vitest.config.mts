import base from '../../../apps/api/vitest.config.mts';

export default {
  ...base,
  test: {
    ...base.test,
    include: ['../../docs/anforderungskatalog/nachweise/validierung-2026-10-03.spec.ts'],
  },
};
