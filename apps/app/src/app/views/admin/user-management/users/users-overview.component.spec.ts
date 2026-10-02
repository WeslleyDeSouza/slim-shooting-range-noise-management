import { Pipe, PipeTransform, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AUTH_STORE } from '@app-galaxy/auth-ui';
import { DataEmitter } from '@app-galaxy/sdk-ui';
import { TranslatePipe, TranslateService } from '@app-galaxy/translate-ui';
import { TableExportComponent } from '../../../../common/table-export.component';
import { TableExportData } from '../../../../core/table/table-export';
import { TableExportFacade } from '../../../../core/table/table-export.facade';
import { UsersFacade } from './_data/users.facade';
import { AdminUser } from './_data/user.model';
import { EloUsersOverviewComponent } from './users-overview.component';

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

const user = (input: Partial<AdminUser> & Pick<AdminUser, 'userId'>): AdminUser => ({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  avatar: '',
  roles: [],
  loginLast: '',
  createdAt: '',
  deleted: false,
  resetPasswordRequired: false,
  locked: false,
  loginAttempt: 0,
  ...input,
});

// Times without a zone are local times, so the expected texts hold in every time zone.
const USERS: AdminUser[] = [
  user({ userId: 'u1', firstName: 'Anna', lastName: 'Muster', email: 'anna.muster@example.ch', roles: ['Fachspezialist', 'Administrator'], loginLast: '2025-03-04T14:05:00', createdAt: '2024-01-15T09:00:00' }),
  user({ userId: 'u2', firstName: 'Beat', lastName: 'Zeller', email: 'beat.zeller@example.ch', roles: ['Interessierter'], loginLast: '2025-05-20T08:30:00', createdAt: '2024-02-01T10:00:00', locked: true, loginAttempt: 5 }),
  user({ userId: 'u3', firstName: 'Carla', lastName: 'Arnold', email: 'carla.arnold@example.ch', createdAt: '2025-06-30T16:45:00' }),
];

describe('EloUsersOverviewComponent', () => {
  let fixture: ComponentFixture<EloUsersOverviewComponent>;
  /** What the export button hands to the API. */
  let exportFacade: { download: jest.Mock };

  const el = () => fixture.nativeElement as HTMLElement;
  /** Let pending promises settle without waiting for the 6 s toast timer. */
  const settle = async () => {
    for (let i = 0; i < 3; i++) await Promise.resolve();
    fixture.detectChanges();
  };
  /** The names in the table, top to bottom. */
  const names = () => Array.from(el().querySelectorAll('.um-users__name b')).map((b) => b.textContent?.trim());
  const search = (text: string) => {
    const input = el().querySelector<HTMLInputElement>('.slim-search__input') as HTMLInputElement;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    exportFacade = { download: jest.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [EloUsersOverviewComponent],
      providers: [
        provideRouter([]),
        DataEmitter,
        {
          provide: UsersFacade,
          useValue: {
            users: signal<AdminUser[]>(USERS),
            loading: signal(false),
            error: signal<string | null>(null),
            canUnlock: signal(false),
            load: jest.fn().mockResolvedValue(undefined),
            loadRoles: jest.fn().mockResolvedValue(undefined),
            loadMyRoles: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: AUTH_STORE.SessionStore, useValue: { changed: signal(null) } },
        { provide: TableExportFacade, useValue: exportFacade },
        // Keys pass through, as in the pipe stub.
        { provide: TranslateService, useValue: { translate: (key: string) => key, lang: 'de' } },
      ],
    })
      .overrideComponent(EloUsersOverviewComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [TranslateStubPipe] },
      })
      .overrideComponent(TableExportComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [TranslateStubPipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(EloUsersOverviewComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  describe('export of the table (B1 5.5.5, slm 3)', () => {
    const exportButton = () => el().querySelector('[data-testid="users-export"]') as HTMLButtonElement;
    const exportAs = async (format: 'xlsx' | 'csv'): Promise<TableExportData> => {
      exportButton().click();
      fixture.detectChanges();
      (el().querySelector(`[data-testid="users-export-${format}"]`) as HTMLButtonElement).click();
      await settle();
      expect(exportFacade.download).toHaveBeenLastCalledWith(expect.anything(), format);
      return exportFacade.download.mock.calls.at(-1)[0] as TableExportData;
    };
    const column = (data: TableExportData, header: string) => data.rows.map((row) => row[data.header.indexOf(header)]);

    it('holds every user shown, in the order of the table, with the texts of the cells', async () => {
      const data = await exportAs('xlsx');
      expect(data.table).toBe('benutzer');
      expect(data.title).toBe('menu.users');
      expect(data.selection).toBe(false);
      expect(data.filters).toEqual([]);
      expect(data.header).toEqual([
        'admin.users.col_name', 'admin.users.locked_badge', 'admin.users.col_email', 'admin.users.col_roles', 'admin.users.col_login_last', 'admin.users.col_created',
      ]);
      // Newest login first, the user without a login last — as the table is sorted.
      expect(names()).toEqual(['Beat Zeller', 'Anna Muster', 'Carla Arnold']);
      expect(column(data, 'admin.users.col_name')).toEqual(names());
      expect(data.rows).toEqual([
        ['Beat Zeller', 'common.yes', 'beat.zeller@example.ch', 'Interessierter', '20.05.2025 08:30', '01.02.2024'],
        ['Anna Muster', 'common.no', 'anna.muster@example.ch', 'Fachspezialist, Administrator', '04.03.2025 14:05', '15.01.2024'],
        ['Carla Arnold', 'common.no', 'carla.arnold@example.ch', null, null, '30.06.2025'],
      ]);
      // Only what the table displays: no ids, no counters of the account.
      expect(JSON.stringify(data)).not.toMatch(/u1|u2|u3|loginAttempt/);
    });

    it('follows the search and names it', async () => {
      search('  administrator ');
      expect(names()).toEqual(['Anna Muster']);

      const data = await exportAs('csv');
      expect(column(data, 'admin.users.col_name')).toEqual(['Anna Muster']);
      expect(data.filters).toEqual([{ label: 'admin.users.search', value: 'administrator' }]);
    });

    it('follows the sorting of the table', async () => {
      const name = el().querySelectorAll<HTMLElement>('.um-users__sort')[0];
      name.click(); // last name, ascending
      fixture.detectChanges();
      expect(names()).toEqual(['Carla Arnold', 'Anna Muster', 'Beat Zeller']);
      expect(column(await exportAs('xlsx'), 'admin.users.col_name')).toEqual(names());

      name.click(); // descending
      fixture.detectChanges();
      expect(column(await exportAs('xlsx'), 'admin.users.col_name')).toEqual(['Beat Zeller', 'Anna Muster', 'Carla Arnold']);
    });

    it('follows the grouping by last login and leaves out the collapsed groups', async () => {
      el().querySelector<HTMLButtonElement>('[data-action="users.groupByLogin"]')?.click();
      fixture.detectChanges();
      // One group per month of the last login, «never» last.
      const groups = el().querySelectorAll<HTMLButtonElement>('.um-users__group-btn');
      expect(groups.length).toBe(3);

      let data = await exportAs('xlsx');
      expect(column(data, 'admin.users.col_name')).toEqual(['Beat Zeller', 'Anna Muster', 'Carla Arnold']);
      expect(data.filters).toEqual([{ label: 'admin.users.group_by_login', value: 'common.yes' }]);

      groups[1].click(); // collapse March 2025
      fixture.detectChanges();
      expect(names()).toEqual(['Beat Zeller', 'Carla Arnold']);
      data = await exportAs('xlsx');
      expect(column(data, 'admin.users.col_name')).toEqual(names());
    });

    it('cannot be started when the table shows no user', () => {
      expect(exportButton().disabled).toBe(false);
      search('gibt es nicht');
      expect(names()).toEqual([]);
      expect(exportButton().disabled).toBe(true);
    });
  });
});
