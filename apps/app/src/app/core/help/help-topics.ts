/**
 * Topics of the online help (B1 12.4, slm 53). The texts live in the locale
 * section `help` (`assets/locales/<lang>/help.locale.json`, loaded at start
 * so the help answers at once): `help.topics.<id>.title`, `.intro` and the
 * steps `.s1` … `.s<steps>`. A spec checks that every topic has all its
 * texts in all four languages.
 */
export interface HelpTopic {
  id: string;
  /** Number of steps (`s1` … `sN`) of the topic. */
  steps: number;
  /** Addresses (path without query) the topic explains; none for the general topic. */
  match: RegExp | null;
}

const AREA = String.raw`^/admin/area/[^/]+`;
const DM = String.raw`^/admin/data-management`;

/** In the order of the online help (sitemap order). The first match wins. */
export const HELP_TOPICS: readonly HelpTopic[] = [
  { id: 'general', steps: 5, match: null },
  { id: 'home', steps: 3, match: /^\/admin\/?$/ },
  { id: 'areas', steps: 5, match: /^\/admin\/area\/?$/ },
  { id: 'area_overview', steps: 2, match: new RegExp(`${AREA}/overview$`) },
  { id: 'shots', steps: 5, match: new RegExp(`${AREA}/shots$`) },
  { id: 'details', steps: 5, match: new RegExp(`${AREA}/details$`) },
  { id: 'simulation', steps: 4, match: new RegExp(`${AREA}/simulation$`) },
  { id: 'map', steps: 5, match: new RegExp(`${AREA}/map$`) },
  { id: 'dm_areas', steps: 3, match: new RegExp(`${DM}/area/overview$`) },
  { id: 'dm_general', steps: 3, match: new RegExp(`${DM}/area/[^/]+/general(/|$)`) },
  { id: 'dm_area_weapons', steps: 3, match: new RegExp(`${DM}/area/(?:[^/]+/)?weapon-assignment$`) },
  { id: 'dm_calculations', steps: 5, match: new RegExp(`${DM}/area/[^/]+/calculations(/|$)`) },
  { id: 'dm_weapons', steps: 4, match: new RegExp(`${DM}/weapons(/|$)`) },
  { id: 'users', steps: 3, match: new RegExp(`${DM}/(users|roles|apps)(/|$)`) },
  { id: 'logs', steps: 2, match: new RegExp(`${DM}/logs$`) },
  { id: 'system', steps: 5, match: new RegExp(`${DM}/system$`) },
];

export const GENERAL_HELP_TOPIC = HELP_TOPICS[0];

/** The topic of an address; the general topic when no page-specific one exists. */
export function helpTopicFor(url: string): HelpTopic {
  const path = url.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  return HELP_TOPICS.find((topic) => topic.match?.test(path)) ?? GENERAL_HELP_TOPIC;
}

/** Locale keys of the steps of a topic. */
export function helpStepKeys(topic: HelpTopic): string[] {
  return Array.from({ length: topic.steps }, (_, i) => `help.topics.${topic.id}.s${i + 1}`);
}
