import { demoSeedEnabled } from './demo-dataset.seed';
describe('demoSeedEnabled', () => {
  const set = (v: string | undefined) => { if (v === undefined) delete process.env['DEMO_SEED']; else process.env['DEMO_SEED'] = v; };
  it('outside production: on unless DEMO_SEED=0', () => {
    set(undefined); expect(demoSeedEnabled(false)).toBe(true);
    set('1'); expect(demoSeedEnabled(false)).toBe(true);
    set('0'); expect(demoSeedEnabled(false)).toBe(false);
  });
  it('production: off unless DEMO_SEED=1', () => {
    set(undefined); expect(demoSeedEnabled(true)).toBe(false);
    set('0'); expect(demoSeedEnabled(true)).toBe(false);
    set('1'); expect(demoSeedEnabled(true)).toBe(true);
  });
});
