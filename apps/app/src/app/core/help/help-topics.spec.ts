import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GENERAL_HELP_TOPIC, HELP_TOPICS, helpStepKeys, helpTopicFor } from './help-topics';

const LOCALES = join(__dirname, '../../../../public/assets/locales');
const LANGUAGES = ['de', 'en', 'fr', 'it'] as const;
type Topics = Record<string, Record<string, string>>;
const topicsOf = (lang: string): Topics => JSON.parse(readFileSync(join(LOCALES, lang, 'help.locale.json'), 'utf8')).help.topics;

describe('help topics (B1 12.4, slm 53)', () => {
  it('explains every page of the application: the address decides the topic', () => {
    const id = '3728e3a9-4e6b-416d-a13f-e844a3a9fe2c';
    const cases: [string, string][] = [
      ['/admin', 'home'],
      ['/admin/area', 'areas'],
      ['/admin/area?status=attention', 'areas'],
      [`/admin/area/${id}/overview`, 'area_overview'],
      [`/admin/area/${id}/shots`, 'shots'],
      [`/admin/area/${id}/details`, 'details'],
      [`/admin/area/${id}/simulation`, 'simulation'],
      [`/admin/area/${id}/map?state=abc`, 'map'],
      ['/admin/data-management/area/overview', 'dm_areas'],
      [`/admin/data-management/area/${id}/general/overview`, 'dm_general'],
      [`/admin/data-management/area/${id}/general/master-data`, 'dm_general'],
      [`/admin/data-management/area/${id}/weapon-assignment`, 'dm_area_weapons'],
      ['/admin/data-management/area/weapon-assignment', 'dm_area_weapons'],
      [`/admin/data-management/area/${id}/calculations/overview`, 'dm_calculations'],
      [`/admin/data-management/area/${id}/calculations/import`, 'dm_calculations'],
      [`/admin/data-management/area/${id}/calculations/details?state=x`, 'dm_calculations'],
      ['/admin/data-management/weapons/combination', 'dm_weapons'],
      ['/admin/data-management/weapons/weapon-category', 'dm_weapons'],
      ['/admin/data-management/users', 'users'],
      ['/admin/data-management/users/edit/42', 'users'],
      ['/admin/data-management/roles', 'users'],
      ['/admin/data-management/apps', 'users'],
      ['/admin/data-management/logs', 'logs'],
      ['/admin/data-management/system', 'system'],
    ];
    for (const [url, topic] of cases) expect([url, helpTopicFor(url).id]).toEqual([url, topic]);
  });

  it('falls back to the general topic where no page-specific help exists', () => {
    expect(helpTopicFor('/admin/help').id).toBe(GENERAL_HELP_TOPIC.id);
    expect(helpTopicFor('/admin/data-management/mgdm-export').id).toBe('general');
    expect(helpTopicFor('/admin/does-not-exist').id).toBe('general');
  });

  it('has a title, an introduction and every step of every topic in all four languages', () => {
    for (const lang of LANGUAGES) {
      const texts = topicsOf(lang);
      // No topic without texts and no texts without a topic.
      expect([lang, Object.keys(texts).sort()]).toEqual([lang, HELP_TOPICS.map((t) => t.id).sort()]);
      for (const topic of HELP_TOPICS) {
        const expected = ['title', 'intro', ...helpStepKeys(topic).map((key) => key.split('.').pop() as string)];
        expect([lang, topic.id, Object.keys(texts[topic.id])]).toEqual([lang, topic.id, expected]);
        for (const key of expected) expect(texts[topic.id][key].trim().length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('keeps the Swiss spelling in German (no sharp s)', () => {
    expect(readFileSync(join(LOCALES, 'de', 'help.locale.json'), 'utf8')).not.toContain('ß');
  });
});
