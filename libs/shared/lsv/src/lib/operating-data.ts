import {
  ANNEX7_CATEGORIES,
  Annex7Category,
  Annex7HalfDays,
  CalendarOptions,
  HalfDays,
  HolidayEntry,
  UsageSlot,
  WorkdaySplit,
} from './types';

/** Anhang 9 workday window: Mo–Fr 07:00–19:00 (B1 7.4). */
export const ANNEX9_WORKDAY = { fromMinute: 7 * 60, toMinute: 19 * 60 };

/** Boundary between the morning and the afternoon half-day (B1 7.4.3: «vor 12:00» / «nach 12:00»). */
export const ANNEX7_NOON_MINUTE = 12 * 60;

/** A half-day counts fully once the shooting time exceeds this (B1 7.4). */
export const ANNEX7_FULL_HALF_DAY_MINUTES = 2 * 60;

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^(\d{2}):(\d{2})$/;

/** Minutes since midnight of an `HH:mm` string; throws on bad input. */
export function parseMinutes(time: string): number {
  const m = TIME.exec(time);
  if (!m) throw new Error(`invalid time "${time}", expected HH:mm`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59 || (h === 24 && min > 0)) {
    throw new Error(`invalid time "${time}"`);
  }
  return h * 60 + min;
}

/** 0 = Sunday … 6 = Saturday, for an ISO calendar day; throws on bad input. */
export function weekday(date: string): number {
  const m = DATE.exec(date);
  if (!m) throw new Error(`invalid date "${date}", expected YYYY-MM-DD`);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (
    Number.isNaN(d.getTime()) ||
    d.getUTCMonth() !== Number(m[2]) - 1 ||
    d.getUTCDate() !== Number(m[3])
  ) {
    throw new Error(`invalid date "${date}"`);
  }
  return d.getUTCDay();
}

/**
 * Holiday minutes `[from, to)` of a calendar day at the site: `[0, 1440)` for
 * a whole holiday, the bounded part for a half holiday, `null` for a workday.
 * Several entries of the same date are merged into their outer bounds.
 */
function holidayWindow(
  date: string,
  options?: CalendarOptions,
): [number, number] | null {
  let window: [number, number] | null = null;
  for (const entry of options?.holidays ?? []) {
    const h: HolidayEntry = typeof entry === 'string' ? { date: entry } : entry;
    if (h.date !== date) continue;
    const from = h.from ? parseMinutes(h.from) : 0;
    const to = h.to ? parseMinutes(h.to) : 24 * 60;
    window = window
      ? [Math.min(window[0], from), Math.max(window[1], to)]
      : [from, to];
  }
  return window;
}

function isFullHoliday(window: [number, number] | null): boolean {
  return !!window && window[0] <= 0 && window[1] >= 24 * 60;
}

/** Validated `[from, to]` minutes of a usage; `to` must be after `from`. */
function slotMinutes(usage: UsageSlot): [number, number] {
  const from = parseMinutes(usage.from);
  const to = parseMinutes(usage.to);
  if (to <= from) {
    throw new Error(
      `usage on ${usage.date}: "to" (${usage.to}) must be after "from" (${usage.from})`,
    );
  }
  if (!(usage.shots >= 0)) {
    throw new Error(`usage on ${usage.date}: invalid shots ${usage.shots}`);
  }
  return [from, to];
}

/** Minutes of `[from, to)` that fall into `[winFrom, winTo)`. */
function overlap(
  from: number,
  to: number,
  winFrom: number,
  winTo: number,
): number {
  return Math.max(0, Math.min(to, winTo) - Math.max(from, winFrom));
}

/**
 * Anhang 9 (B1 7.4.5): split the shots of one usage into "innerhalb" and
 * "ausserhalb Werktag". The workday is Mo–Fr 07:00–19:00; Saturday, Sunday
 * and the site's public holidays count entirely as outside; on a half
 * holiday the free hours are outside as well. Inside a workday the shots are
 * split proportionally to the minutes inside / outside the window without
 * quantisation; the outside share is the remainder, so
 * `inside + outside === shots` always holds.
 */
export function splitAnnex9(
  usage: UsageSlot,
  options?: CalendarOptions,
): WorkdaySplit {
  const [from, to] = slotMinutes(usage);
  const day = weekday(usage.date);
  const shots = usage.shots;

  const holiday = holidayWindow(usage.date, options);
  if (day === 0 || day === 6 || isFullHoliday(holiday)) {
    return { inside: 0, outside: shots };
  }

  let insideMinutes = overlap(
    from,
    to,
    ANNEX9_WORKDAY.fromMinute,
    ANNEX9_WORKDAY.toMinute,
  );
  if (holiday) {
    // Half holiday: the free part of the workday window is outside.
    const hFrom = Math.max(holiday[0], ANNEX9_WORKDAY.fromMinute);
    const hTo = Math.min(holiday[1], ANNEX9_WORKDAY.toMinute);
    insideMinutes -= overlap(from, to, hFrom, hTo);
  }
  const total = to - from;
  const insideShare = insideMinutes / total;

  if (insideShare >= 1) return { inside: shots, outside: 0 };
  if (insideShare <= 0) return { inside: 0, outside: shots };

  // Derived quantities keep full precision, independent of input notation/unit.
  const inside = shots * insideShare;
  return { inside, outside: shots - inside };
}

/** Sum of several splits. */
export function sumShots(splits: readonly WorkdaySplit[]): WorkdaySplit {
  return splits.reduce(
    (acc, s) => ({
      inside: acc.inside + s.inside,
      outside: acc.outside + s.outside,
    }),
    { inside: 0, outside: 0 },
  );
}

/** A half-day's value from its shooting minutes (B1 7.4: > 2 h → 1, else ½). */
function halfDayValue(minutes: number): number {
  if (minutes <= 0) return 0;
  return minutes > ANNEX7_FULL_HALF_DAY_MINUTES ? 1 : 0.5;
}

/** "sunday" or "work" for the morning and the afternoon half of a date. */
function halfDayKinds(
  date: string,
  options?: CalendarOptions,
): [keyof HalfDays, keyof HalfDays] {
  if (weekday(date) === 0) return ['sunday', 'sunday'];
  const holiday = holidayWindow(date, options);
  if (!holiday) return ['work', 'work'];
  const covers = (minute: number) => holiday[0] <= minute && minute < holiday[1];
  return [
    covers(ANNEX7_NOON_MINUTE / 2) ? 'sunday' : 'work',
    covers((ANNEX7_NOON_MINUTE + 24 * 60) / 2) ? 'sunday' : 'work',
  ];
}

function emptyHalfDays(): Annex7HalfDays {
  const out = {} as Annex7HalfDays;
  for (const k of ANNEX7_CATEGORIES) out[k] = { work: 0, sunday: 0 };
  return out;
}

/**
 * Anhang 7 (B1 7.4): Schiesshalbtage per Waffenkategorie. The workday is
 * Mo–Sa except the site's holidays; Sunday and holidays are "sunday"
 * half-days, and on a half holiday only the free half (the one whose middle
 * lies in the holiday window) is. Per calendar day and category, the morning
 * (before 12:00) and the afternoon (from 12:00) each count 1 when the
 * category's shooting time in that half exceeds 2 h, ½ when it is shorter
 * but not zero, and 0 when nobody shot. Several usages of the same category
 * in the same half add up; a usage spanning 12:00 contributes to both halves.
 */
export function annex7HalfDays(
  usages: readonly (UsageSlot & { category: Annex7Category })[],
  options?: CalendarOptions,
): Annex7HalfDays {
  // date|category → [morning minutes, afternoon minutes]
  const minutes = new Map<string, [number, number]>();
  // date|category → [morning kind, afternoon kind]
  const kind = new Map<string, [keyof HalfDays, keyof HalfDays]>();

  for (const usage of usages) {
    const [from, to] = slotMinutes(usage);
    const key = `${usage.date}|${usage.category}`;
    const acc = minutes.get(key) ?? [0, 0];
    acc[0] += overlap(from, to, 0, ANNEX7_NOON_MINUTE);
    acc[1] += overlap(from, to, ANNEX7_NOON_MINUTE, 24 * 60);
    minutes.set(key, acc);
    kind.set(key, halfDayKinds(usage.date, options));
  }

  const out = emptyHalfDays();
  for (const [key, [morning, afternoon]] of minutes) {
    const category = key.slice(key.indexOf('|') + 1) as Annex7Category;
    const [morningKind, afternoonKind] = kind.get(key) ?? ['work', 'work'];
    out[category][morningKind] += halfDayValue(morning);
    out[category][afternoonKind] += halfDayValue(afternoon);
  }
  return out;
}
