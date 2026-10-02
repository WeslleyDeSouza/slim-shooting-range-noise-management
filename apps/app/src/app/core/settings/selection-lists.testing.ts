import { signal } from '@angular/core';
import type { SelectionListDto, SelectionListValueDto } from '@ui-slim/apiClient';
import { labelOf, SelectionListKey } from './selection-lists.facade';

/** Codes the application ships with, per list (labels: «<Code> (DE)», «<Code> (FR)», no IT / EN). */
const CODES: Record<SelectionListKey, string[]> = {
  classification: ['unproblematic', 'problematic', 'remediation_needed'],
  recalculation_state: ['not_required', 'in_progress', 'completed'],
  remediation_project_state: ['not_started', 'concept', 'design', 'implementation', 'completed'],
  spm_state: ['open', 'in_progress', 'completed'],
  noise_remediation_state: ['reassessment_needed', 'assessed', 'remediated'],
  project_state: ['not_started', 'ongoing', 'completed'],
  civil_usage_kind: ['obligatory', 'field_shooting', 'other'],
};

export function testListValue(code: string, overrides: Partial<SelectionListValueDto> = {}): SelectionListValueDto {
  return { code, labelDe: `${code} (DE)`, labelFr: `${code} (FR)`, labelIt: null, labelEn: null, enabled: true, sortOrder: 1, builtIn: true, ...overrides };
}

export function testLists(): SelectionListDto[] {
  return (Object.keys(CODES) as SelectionListKey[]).map((key) => ({ key, values: CODES[key].map((code, i) => testListValue(code, { sortOrder: i + 1 })) }));
}

/** What a mutation of the fake was called with. */
export interface FakeListCall {
  kind: 'create' | 'update';
  key: string;
  code?: string;
  body: Record<string, unknown>;
}

/**
 * Stand-in for `SelectionListsFacade` in unit specs: the lists as a signal,
 * the same read helpers as the facade, and mutations that are recorded and
 * applied to the signal (so a component sees its own change).
 */
export function fakeSelectionLists(initial: SelectionListDto[] = testLists(), lang = 'de') {
  const lists = signal(initial);
  const calls: FakeListCall[] = [];
  const values = (key: string) => lists().find((l) => l.key === key)?.values ?? [];
  const patch = (key: string, next: SelectionListValueDto[]) =>
    lists.update((all) => all.map((l) => (l.key === key ? { ...l, values: [...next].sort((a, b) => a.sortOrder - b.sortOrder) } : l)));
  return {
    lists,
    calls,
    lang,
    loaded: signal(true),
    saving: signal(false),
    error: signal<string | null>(null),
    load: async () => undefined,
    values,
    options: (key: string, current?: string | null) => values(key).filter((v) => v.enabled || v.code === current),
    label(key: string, code: string | null | undefined): string {
      if (!code) return '';
      const value = values(key).find((v) => v.code === code);
      return value ? labelOf(value, this.lang) : code;
    },
    async create(key: string, body: Record<string, unknown>): Promise<boolean> {
      calls.push({ kind: 'create', key, body });
      const current = values(key);
      patch(key, [...current, testListValue('new_value', { ...body, builtIn: false, sortOrder: current.length + 1 })]);
      return true;
    },
    async updateValue(key: string, code: string, body: Record<string, unknown>): Promise<boolean> {
      calls.push({ kind: 'update', key, code, body });
      patch(key, values(key).map((v) => (v.code === code ? { ...v, ...body } : v)));
      return true;
    },
  };
}
