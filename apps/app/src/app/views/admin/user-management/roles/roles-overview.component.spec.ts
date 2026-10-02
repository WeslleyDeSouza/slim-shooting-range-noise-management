import { Pipe, PipeTransform, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DataEmitter } from '@app-galaxy/sdk-ui';
import { TranslatePipe, TranslateService } from '@app-galaxy/translate-ui';
import type { RoleEntity } from '@ui-slim/apiClient';
import { TableExportComponent } from '../../../../common/table-export.component';
import { TableExportData } from '../../../../core/table/table-export';
import { TableExportFacade } from '../../../../core/table/table-export.facade';
import { RolesFacade } from './_data/roles.facade';
import { EloRolesOverviewComponent } from './roles-overview.component';

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

/** A role as the list endpoint delivers it: with the rights per app and the assigned users. */
const role = (input: Partial<RoleEntity> & { users?: unknown[] }): RoleEntity =>
  ({
    tenantId: 'tenant-1',
    type: 'business',
    apps: [],
    state: true,
    hasAdminRights: false,
    hasOnBoardingRights: false,
    hasPaymentRights: false,
    isDefault: false,
    sensitiveDataDisplay: false,
    ...input,
  }) as RoleEntity;

const right = (appId: number) => ({ appId }) as unknown as RoleEntity['apps'][number];

const ROLES: RoleEntity[] = [
  role({ roleId: 1, title: 'Superadmin', hasAdminRights: true, sensitiveDataDisplay: true, apps: [right(1), right(2), right(4)], users: [{ userId: 'u1' }] }),
  role({ roleId: 2, title: 'Standard', isDefault: true, apps: [right(1)], users: [{ userId: 'u1' }, { userId: 'u2' }] }),
  // A seeded SLIM role (B1 8.1.1); SQLite hands the settings back as a string.
  role({ roleId: 11, title: 'Fachspezialist', settings: JSON.stringify({ key: 'specialist', slim: true }) as never, apps: [right(1), right(2)], users: [] }),
  role({ roleId: 12, title: 'Gast', state: false }),
];

describe('EloRolesOverviewComponent', () => {
  let fixture: ComponentFixture<EloRolesOverviewComponent>;
  /** What the export button hands to the API. */
  let exportFacade: { download: jest.Mock };

  const el = () => fixture.nativeElement as HTMLElement;
  /** Let pending promises settle without waiting for the 6 s toast timer. */
  const settle = async () => {
    for (let i = 0; i < 3; i++) await Promise.resolve();
    fixture.detectChanges();
  };
  /** The titles in the table, top to bottom. */
  const titles = () => Array.from(el().querySelectorAll('.um-roles__title b')).map((b) => b.textContent?.trim());
  const search = (text: string) => {
    const input = el().querySelector<HTMLInputElement>('.slim-search__input') as HTMLInputElement;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    exportFacade = { download: jest.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [EloRolesOverviewComponent],
      providers: [
        provideRouter([]),
        DataEmitter,
        {
          provide: RolesFacade,
          useValue: {
            roles: signal<RoleEntity[]>(ROLES),
            loading: signal(false),
            error: signal<string | null>(null),
            load: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: TableExportFacade, useValue: exportFacade },
        // Keys pass through, as in the pipe stub.
        { provide: TranslateService, useValue: { translate: (key: string) => key, lang: 'de' } },
      ],
    })
      .overrideComponent(EloRolesOverviewComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [TranslateStubPipe] },
      })
      .overrideComponent(TableExportComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [TranslateStubPipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(EloRolesOverviewComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  describe('export of the table (B1 5.5.5, slm 3)', () => {
    const exportButton = () => el().querySelector('[data-testid="roles-export"]') as HTMLButtonElement;
    const exportAs = async (format: 'xlsx' | 'csv'): Promise<TableExportData> => {
      exportButton().click();
      fixture.detectChanges();
      (el().querySelector(`[data-testid="roles-export-${format}"]`) as HTMLButtonElement).click();
      await settle();
      expect(exportFacade.download).toHaveBeenLastCalledWith(expect.anything(), format);
      return exportFacade.download.mock.calls.at(-1)[0] as TableExportData;
    };
    const column = (data: TableExportData, header: string) => data.rows.map((row) => row[data.header.indexOf(header)]);

    it('holds every role shown, in the order of the table, with the texts of the cells', async () => {
      const data = await exportAs('xlsx');
      expect(data.table).toBe('rollen');
      expect(data.title).toBe('menu.roles');
      expect(data.selection).toBe(false);
      expect(data.filters).toEqual([]);
      expect(data.header).toEqual([
        'admin.roles.col_title', 'admin.roles.key', 'admin.roles.col_flags', 'admin.roles.col_apps', 'admin.roles.col_users', 'admin.roles.col_state',
      ]);
      expect(titles()).toEqual(['Superadmin', 'Standard', 'Fachspezialist', 'Gast']);
      expect(column(data, 'admin.roles.col_title')).toEqual(titles());
      // Badges as their labels, the two counts as numbers, the switch as yes/no.
      expect(data.rows).toEqual([
        ['Superadmin', null, 'admin.roles.flag_admin, admin.roles.flag_sensitive', 3, 1, 'common.yes'],
        ['Standard', null, 'admin.roles.flag_default', 1, 2, 'common.yes'],
        ['Fachspezialist', 'specialist', 'admin.roles.flag_system', 2, 0, 'common.yes'],
        ['Gast', null, null, 0, 0, 'common.no'],
      ]);
      // Only what the table displays: neither the tenant nor the assigned users.
      expect(JSON.stringify(data)).not.toMatch(/tenant-1|u1|u2/);
    });

    it('follows the search and names it', async () => {
      search(' sta');
      expect(titles()).toEqual(['Standard']);

      const data = await exportAs('csv');
      expect(column(data, 'admin.roles.col_title')).toEqual(['Standard']);
      expect(data.filters).toEqual([{ label: 'admin.roles.search', value: 'sta' }]);
    });

    it('cannot be started when the table shows no role', () => {
      expect(exportButton().disabled).toBe(false);
      search('gibt es nicht');
      expect(titles()).toEqual([]);
      expect(exportButton().disabled).toBe(true);
    });
  });
});
