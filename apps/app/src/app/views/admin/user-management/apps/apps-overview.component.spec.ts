import { Pipe, PipeTransform, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DataEmitter } from '@app-galaxy/sdk-ui';
import { TranslatePipe, TranslateService } from '@app-galaxy/translate-ui';
import type { AppEntity } from '@ui-slim/apiClient';
import { TableExportComponent } from '../../../../common/table-export.component';
import { TableExportData } from '../../../../core/table/table-export';
import { TableExportFacade } from '../../../../core/table/table-export.facade';
import { AppsFacade } from './_data/apps.facade';
import { EloAppsOverviewComponent } from './apps-overview.component';

/** Keys pass through; interpolation like the real pipe (`{{n}}`). */
@Pipe({ name: 'translate' })
class TranslateStubPipe implements PipeTransform {
  transform(key: string, params?: Record<string, unknown>): string {
    if (!params) return key;
    return Object.entries(params).reduce(
      (text, [k, v]) => text.replace(`{{${k}}}`, String(v)),
      key,
    );
  }
}

/** The `menu.*` titles of the catalogue; every other key passes through. */
const TEXTS: Record<string, string> = {
  'menu.areas': 'Schiessplätze',
  'menu.users': 'Benutzer',
  'menu.logs': 'Logbuch',
};

const CATEGORIES: Record<number, string> = { 1: 'Fachanwendung', 2: 'Administration' };

const app = (input: Partial<AppEntity> & Pick<AppEntity, 'appId' | 'title'>): AppEntity => ({
  categoryId: 1,
  hiddenInMenu: false,
  orderIdx: 0,
  roleKey: '',
  supportsGranularPermissions: false,
  tenantId: 'tenant-1',
  ...input,
});

// Sorted by category and order, as the facade delivers them.
const APPS: AppEntity[] = [
  app({ appId: 40, title: 'menu.areas', path: '/admin/area', roleKey: 'AREA', categoryId: 1, orderIdx: 10 }),
  app({ appId: 1, title: 'menu.users', path: '/admin/data-management/users', roleKey: 'ADMIN_USER_LIST', categoryId: 2, orderIdx: 10 }),
  app({ appId: 5, title: 'menu.logs', roleKey: 'ADMIN_LOGS', categoryId: 2, orderIdx: 20, hiddenInMenu: true }),
];

describe('EloAppsOverviewComponent', () => {
  let fixture: ComponentFixture<EloAppsOverviewComponent>;
  /** What the export button hands to the API. */
  let exportFacade: { download: jest.Mock };

  const el = () => fixture.nativeElement as HTMLElement;
  /** Let pending promises settle without waiting for the 6 s toast timer. */
  const settle = async () => {
    for (let i = 0; i < 3; i++) await Promise.resolve();
    fixture.detectChanges();
  };
  /** The titles in the table, top to bottom. */
  const titles = () => Array.from(el().querySelectorAll('.um-apps__title b')).map((b) => b.textContent?.trim());
  const search = (text: string) => {
    const input = el().querySelector<HTMLInputElement>('.slim-search__input') as HTMLInputElement;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    exportFacade = { download: jest.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [EloAppsOverviewComponent],
      providers: [
        provideRouter([]),
        DataEmitter,
        {
          provide: AppsFacade,
          useValue: {
            apps: signal<AppEntity[]>(APPS),
            loading: signal(false),
            error: signal<string | null>(null),
            load: jest.fn().mockResolvedValue(undefined),
            categoryTitle: (categoryId: number) => CATEGORIES[categoryId] ?? `${categoryId}`,
          },
        },
        { provide: TableExportFacade, useValue: exportFacade },
        { provide: TranslateService, useValue: { translate: (key: string) => TEXTS[key] ?? key, lang: 'de' } },
      ],
    })
      .overrideComponent(EloAppsOverviewComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [TranslateStubPipe] },
      })
      .overrideComponent(TableExportComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [TranslateStubPipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(EloAppsOverviewComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  describe('export of the table (B1 5.5.5, slm 3)', () => {
    const exportButton = () => el().querySelector('[data-testid="apps-export"]') as HTMLButtonElement;
    const exportAs = async (format: 'xlsx' | 'csv'): Promise<TableExportData> => {
      exportButton().click();
      fixture.detectChanges();
      (el().querySelector(`[data-testid="apps-export-${format}"]`) as HTMLButtonElement).click();
      await settle();
      expect(exportFacade.download).toHaveBeenLastCalledWith(expect.anything(), format);
      return exportFacade.download.mock.calls.at(-1)[0] as TableExportData;
    };
    const column = (data: TableExportData, header: string) => data.rows.map((row) => row[data.header.indexOf(header)]);

    it('holds every app shown, in the order of the table, with the texts of the cells', async () => {
      const data = await exportAs('xlsx');
      expect(data.table).toBe('apps');
      expect(data.title).toBe('menu.apps');
      expect(data.selection).toBe(false);
      expect(data.filters).toEqual([]);
      expect(data.header).toEqual([
        'admin.apps.col_title', 'admin.apps.field_title', 'admin.apps.col_path', 'admin.apps.col_role_key', 'admin.apps.col_category', 'admin.apps.col_order', 'admin.apps.col_visible',
      ]);
      expect(titles()).toEqual(['Schiessplätze', 'Benutzer', 'Logbuch']);
      expect(column(data, 'admin.apps.col_title')).toEqual(titles());
      // The translated title and its key, the order as a number, the switch as yes/no.
      expect(data.rows).toEqual([
        ['Schiessplätze', 'menu.areas', '/admin/area', 'AREA', 'Fachanwendung', 10, 'common.yes'],
        ['Benutzer', 'menu.users', '/admin/data-management/users', 'ADMIN_USER_LIST', 'Administration', 10, 'common.yes'],
        ['Logbuch', 'menu.logs', null, 'ADMIN_LOGS', 'Administration', 20, 'common.no'],
      ]);
      // Only what the table displays: no tenant.
      expect(JSON.stringify(data)).not.toContain('tenant-1');
    });

    it('follows the search and names it', async () => {
      // The search also finds the translated title.
      search(' logbuch');
      expect(titles()).toEqual(['Logbuch']);

      const data = await exportAs('csv');
      expect(column(data, 'admin.apps.col_title')).toEqual(['Logbuch']);
      expect(data.filters).toEqual([{ label: 'admin.apps.search', value: 'logbuch' }]);
    });

    it('cannot be started when the table shows no app', () => {
      expect(exportButton().disabled).toBe(false);
      search('gibt es nicht');
      expect(titles()).toEqual([]);
      expect(exportButton().disabled).toBe(true);
    });
  });
});
