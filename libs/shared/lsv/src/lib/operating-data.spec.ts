import {
  annex7HalfDays,
  parseMinutes,
  splitAnnex9,
  sumShots,
  weekday,
} from './operating-data';
import { Annex7Category, UsageSlot } from './types';

// 2026-09-07 is a Monday, 2026-09-12 a Saturday, 2026-09-13 a Sunday.
const MON = '2026-09-07';
const WED = '2026-09-09';
const SAT = '2026-09-12';
const SUN = '2026-09-13';

const slot = (
  date: string,
  from: string,
  to: string,
  shots = 100,
): UsageSlot => ({
  date,
  from,
  to,
  shots,
});

describe('weekday / parseMinutes', () => {
  it('knows the weekday of an ISO date', () => {
    expect(weekday(MON)).toBe(1);
    expect(weekday(SAT)).toBe(6);
    expect(weekday(SUN)).toBe(0);
  });

  it('rejects bad dates and times', () => {
    expect(() => weekday('2026-13-01')).toThrow(/invalid date/);
    expect(() => weekday('2026-02-30')).toThrow(/invalid date/);
    expect(() => weekday('07.09.2026')).toThrow(/invalid date/);
    expect(() => parseMinutes('8:00')).toThrow(/invalid time/);
    expect(() => parseMinutes('25:00')).toThrow(/invalid time/);
    expect(() => parseMinutes('12:60')).toThrow(/invalid time/);
    expect(parseMinutes('24:00')).toBe(1440);
  });
});

describe('splitAnnex9 — innerhalb / ausserhalb Werktag (B1 7.4.5)', () => {
  it('counts a weekday morning entirely inside', () => {
    expect(splitAnnex9(slot(MON, '08:00', '11:30'))).toEqual({
      inside: 100,
      outside: 0,
    });
  });

  it('counts Saturday, Sunday and holidays entirely outside', () => {
    expect(splitAnnex9(slot(SAT, '08:00', '11:30'))).toEqual({
      inside: 0,
      outside: 100,
    });
    expect(splitAnnex9(slot(SUN, '08:00', '11:30'))).toEqual({
      inside: 0,
      outside: 100,
    });
    expect(
      splitAnnex9(slot(WED, '08:00', '11:30'), { holidays: [WED] }),
    ).toEqual({
      inside: 0,
      outside: 100,
    });
    // Half holiday (free from 12:00): the afternoon shots are outside.
    expect(
      splitAnnex9(slot(WED, '10:00', '14:00', 100), {
        holidays: [{ date: WED, from: '12:00' }],
      }),
    ).toEqual({ inside: 50, outside: 50 });
    expect(
      splitAnnex9(slot(WED, '14:00', '17:00'), {
        holidays: [{ date: WED, from: '12:00' }],
      }),
    ).toEqual({ inside: 0, outside: 100 });
    expect(
      splitAnnex9(slot(WED, '08:00', '11:00'), {
        holidays: [{ date: WED, from: '12:00' }],
      }),
    ).toEqual({ inside: 100, outside: 0 });
    // The same Wednesday without the holiday list is a workday.
    expect(splitAnnex9(slot(WED, '08:00', '11:30'))).toEqual({
      inside: 100,
      outside: 0,
    });
  });

  it('splits proportionally around 07:00 and 19:00', () => {
    expect(splitAnnex9(slot(MON, '06:00', '08:00'))).toEqual({
      inside: 50,
      outside: 50,
    });
    expect(splitAnnex9(slot(MON, '18:00', '20:00'))).toEqual({
      inside: 50,
      outside: 50,
    });
    expect(splitAnnex9(slot(MON, '08:00', '20:00', 120))).toEqual({
      inside: 110,
      outside: 10,
    });
    expect(splitAnnex9(slot(MON, '05:00', '07:00'))).toEqual({
      inside: 0,
      outside: 100,
    });
  });

  it('counts an evening shoot entirely outside', () => {
    expect(splitAnnex9(slot(MON, '19:00', '22:00'))).toEqual({
      inside: 0,
      outside: 100,
    });
  });

  it('keeps decimal quantities (kg) at their precision instead of rounding to whole units', () => {
    // 1.2 kg from 06:00 to 08:00: half inside, half outside → 0.6 / 0.6
    expect(splitAnnex9(slot(MON, '06:00', '08:00', 1.2))).toEqual({ inside: 0.6, outside: 0.6 });
    // 0.125 with 3 decimals over 06:00–07:30 (1/3 inside): 41.67 → 41 units inside, remainder to the larger share
    const s = splitAnnex9(slot(MON, '06:00', '07:30', 0.125));
    expect(s.inside + s.outside).toBeCloseTo(0.125, 12);
    expect(s).toEqual({ inside: 0.041, outside: 0.084 });
  });

  it('keeps the total when rounding, remainder to the larger share', () => {
    // 07:30–19:30: 11.5 h inside of 12 h → inside 2.875 of 3 → 3 / 0
    expect(splitAnnex9(slot(MON, '07:30', '19:30', 3))).toEqual({
      inside: 3,
      outside: 0,
    });
    // 06:00–08:00 with 3 shots: 1.5 / 1.5 → tie goes inside → 2 / 1
    expect(splitAnnex9(slot(MON, '06:00', '08:00', 3))).toEqual({
      inside: 2,
      outside: 1,
    });
    // 06:00–07:30 with 3 shots: inside 1 of 3 → 1 / 2
    expect(splitAnnex9(slot(MON, '06:00', '07:30', 3))).toEqual({
      inside: 1,
      outside: 2,
    });
    for (const shots of [1, 2, 7, 99, 1001]) {
      const s = splitAnnex9(slot(MON, '06:20', '19:50', shots));
      expect(s.inside + s.outside).toBe(shots);
    }
  });

  it('handles zero shots', () => {
    expect(splitAnnex9(slot(MON, '06:00', '08:00', 0))).toEqual({
      inside: 0,
      outside: 0,
    });
  });

  it('rejects invalid slots', () => {
    expect(() => splitAnnex9(slot(MON, '11:00', '11:00'))).toThrow(/after/);
    expect(() => splitAnnex9(slot(MON, '11:00', '09:00'))).toThrow(/after/);
    expect(() => splitAnnex9(slot(MON, '9:00', '11:00'))).toThrow(
      /invalid time/,
    );
    expect(() => splitAnnex9(slot('2026-9-7', '09:00', '11:00'))).toThrow(
      /invalid date/,
    );
    expect(() => splitAnnex9(slot(MON, '09:00', '11:00', -5))).toThrow(/shots/);
  });
});

describe('sumShots', () => {
  it('adds splits', () => {
    expect(
      sumShots([
        { inside: 1, outside: 2 },
        { inside: 10, outside: 20 },
      ]),
    ).toEqual({ inside: 11, outside: 22 });
    expect(sumShots([])).toEqual({ inside: 0, outside: 0 });
  });
});

describe('annex7HalfDays — Schiesshalbtage (B1 7.4)', () => {
  const a = (
    date: string,
    from: string,
    to: string,
    category: Annex7Category = 'a',
  ) => ({
    ...slot(date, from, to),
    category,
  });

  it('counts a morning longer than 2 h as one workday half-day', () => {
    const hd = annex7HalfDays([a(MON, '08:00', '11:30')]);
    expect(hd.a).toEqual({ work: 1, sunday: 0 });
    expect(hd.b).toEqual({ work: 0, sunday: 0 });
  });

  it('counts a short morning as half', () => {
    expect(annex7HalfDays([a(MON, '09:00', '10:30')]).a).toEqual({
      work: 0.5,
      sunday: 0,
    });
  });

  it('counts an afternoon separately', () => {
    expect(annex7HalfDays([a(MON, '13:30', '17:00')]).a).toEqual({
      work: 1,
      sunday: 0,
    });
  });

  it('splits a usage spanning 13:00 into both halves', () => {
    // 11:00–13:00 = exactly 2 h (not more) → ½; 13:00–15:00 = 2 h → ½
    expect(annex7HalfDays([a(MON, '11:00', '15:00')]).a).toEqual({
      work: 1,
      sunday: 0,
    });
    // 10:00–16:00 = 3 h + 3 h → 2
    expect(annex7HalfDays([a(MON, '10:00', '16:00')]).a).toEqual({
      work: 2,
      sunday: 0,
    });
  });

  it('counts only the free half of a half holiday as Sunday (B1 7.4)', () => {
    // Free afternoon (e.g. 24 December from 12:00): morning stays a workday half.
    const hd = annex7HalfDays(
      [a(WED, '08:00', '11:30'), a(WED, '14:00', '17:00')],
      { holidays: [{ date: WED, from: '12:00' }] },
    ).a;
    expect(hd).toEqual({ work: 1, sunday: 1 });
    // Free morning: the afternoon is the workday half.
    expect(
      annex7HalfDays([a(WED, '08:00', '11:30'), a(WED, '14:00', '17:00')], {
        holidays: [{ date: WED, to: '12:00' }],
      }).a,
    ).toEqual({ work: 1, sunday: 1 });
    expect(
      annex7HalfDays([a(WED, '14:00', '17:00')], {
        holidays: [{ date: WED, to: '12:00' }],
      }).a,
    ).toEqual({ work: 1, sunday: 0 });
  });

  it('adds several usages of the same category in the same half', () => {
    expect(
      annex7HalfDays([a(MON, '08:00', '09:00'), a(MON, '09:30', '11:30')]).a,
    ).toEqual({ work: 1, sunday: 0 });
  });

  it('treats Saturday as a workday, Sunday and holidays as Sunday', () => {
    expect(annex7HalfDays([a(SAT, '08:00', '11:30')]).a).toEqual({
      work: 1,
      sunday: 0,
    });
    expect(annex7HalfDays([a(SUN, '08:00', '11:30')]).a).toEqual({
      work: 0,
      sunday: 1,
    });
    expect(
      annex7HalfDays([a(WED, '08:00', '11:30')], { holidays: [WED] }).a,
    ).toEqual({
      work: 0,
      sunday: 1,
    });
  });

  it('keeps categories independent', () => {
    const hd = annex7HalfDays([
      a(MON, '08:00', '11:30', 'a'),
      a(MON, '08:00', '09:00', 'c'),
    ]);
    expect(hd.a).toEqual({ work: 1, sunday: 0 });
    expect(hd.c).toEqual({ work: 0.5, sunday: 0 });
    expect(hd.b).toEqual({ work: 0, sunday: 0 });
  });

  it('returns zeros for everything without usages', () => {
    const hd = annex7HalfDays([]);
    for (const k of ['a', 'b', 'c', 'd', 'e', 'f'] as const) {
      expect(hd[k]).toEqual({ work: 0, sunday: 0 });
    }
  });

  it('reproduces the B1.4 operating data (27 work + 1 Sunday half-days) from a season', () => {
    // 13 Saturdays with morning + afternoon shooting (26), one extra Wednesday
    // morning (27) and one Sunday morning (1). September–December 2026.
    const saturdays = [
      '2026-09-05',
      '2026-09-12',
      '2026-09-19',
      '2026-09-26',
      '2026-10-03',
      '2026-10-10',
      '2026-10-17',
      '2026-10-24',
      '2026-10-31',
      '2026-11-07',
      '2026-11-14',
      '2026-11-21',
      '2026-11-28',
    ];
    const usages = saturdays.flatMap((d) => [
      a(d, '08:00', '12:00'),
      a(d, '13:30', '17:00'),
    ]);
    usages.push(a('2026-09-09', '08:00', '11:00'));
    usages.push(a('2026-09-13', '09:00', '11:30'));
    expect(annex7HalfDays(usages).a).toEqual({ work: 27, sunday: 1 });
  });

  it('rejects invalid slots', () => {
    expect(() => annex7HalfDays([a(MON, '11:00', '10:00')])).toThrow(/after/);
  });
});
