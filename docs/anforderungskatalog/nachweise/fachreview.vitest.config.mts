import base from '../../../apps/api/vitest.config.mts';

// Compatibility command for the review evidence. The wrapper imports the
// regressions that are now also included in the regular API suite.
export default {
  ...base,
  test: {
    ...base.test,
    include: ['../../docs/anforderungskatalog/nachweise/fachreview.spec.ts'],
  },
};
