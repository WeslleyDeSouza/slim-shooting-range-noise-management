import { signal } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { DataEmitter } from '@app-galaxy/sdk-ui';
import { TranslateService } from '@app-galaxy/translate-ui';
import type { LogFacetsDto, LogItemDto } from '@ui-slim/apiClient';
import { LogsFacade } from './_data/logs.facade';
import { AppLogsComponent } from './logs.component';

const asItem = (item: Partial<LogItemDto>) => item as LogItemDto;

describe('AppLogsComponent', () => {
  let component: AppLogsComponent;
  let fixture: ComponentFixture<AppLogsComponent>;
  let facade: {
    loading: ReturnType<typeof signal<boolean>>;
    items: ReturnType<typeof signal<LogItemDto[]>>;
    total: ReturnType<typeof signal<number>>;
    facets: ReturnType<typeof signal<LogFacetsDto | null>>;
    error: ReturnType<typeof signal<string | null>>;
    hasMore: boolean;
    load: jest.Mock;
    loadMore: jest.Mock;
    loadFacets: jest.Mock;
    exportXlsx: jest.Mock;
  };

  const today = new Date();
  const iso = (daysAgo: number, time: string) => {
    const date = new Date(today);
    date.setDate(date.getDate() - daysAgo);
    return `${date.toISOString().slice(0, 10)}T${time}:00.000Z`;
  };

  const items = () => [
    asItem({
      logId: 'l1',
      createdAt: iso(0, '10:00'),
      section: 'AUTH_ROLE',
      action: 'UPDATE' as LogItemDto['action'],
      refType: 'AUTH_ROLE',
      refId: '11',
      data: JSON.stringify({ changes: { title: { old: 'Alt', new: 'Neu' } } }),
      user: { firstName: 'Hans', lastName: 'Muster' },
    }),
    asItem({
      logId: 'l2',
      createdAt: iso(0, '08:00'),
      section: 'AREA',
      action: 'DELETE' as LogItemDto['action'],
      refType: 'AREA',
      refId: 'a1',
      data: JSON.stringify({ areaId: 'a1', affected: 14 }),
      user: { firstName: 'Hans', lastName: 'Muster' },
    }),
    asItem({
      logId: 'l3',
      createdAt: iso(1, '09:00'),
      section: 'AUTH_USER',
      action: 'CREATE' as LogItemDto['action'],
      isSystem: true,
      user: null,
    }),
  ];

  const facets = (): LogFacetsDto => ({
    total: 3,
    sections: ['AREA', 'AUTH_ROLE', 'AUTH_USER'],
    actionCounts: { CREATE: 1, UPDATE: 1, DELETE: 1 },
    users: [
      { userId: 'u1', name: 'Hans Muster', isSystem: false },
      { userId: null, name: 'System', isSystem: true },
    ],
  });

  beforeEach(async () => {
    facade = {
      loading: signal(false),
      items: signal(items()),
      total: signal(3),
      facets: signal<LogFacetsDto | null>(facets()),
      error: signal<string | null>(null),
      hasMore: false,
      load: jest.fn(),
      loadMore: jest.fn(),
      loadFacets: jest.fn(),
      exportXlsx: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [AppLogsComponent],
      providers: [
        provideRouter([]),
        DataEmitter,
        { provide: LogsFacade, useValue: facade },
        {
          provide: TranslateService,
          useValue: {
            translate: (key: string) => key,
            lang: 'de',
            sectionChanged$: of(null),
            languageChanged$: of(null),
          },
        },
      ],
    }).compileComponents();
  });

  // ComponentBase defers getData() with a 10ms setTimeout — tick past it.
  beforeEach(fakeAsync(() => {
    fixture = TestBed.createComponent(AppLogsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    tick(20);
  }));

  it('loads facets and the first page on init', () => {
    expect(facade.loadFacets).toHaveBeenCalled();
    expect(facade.load).toHaveBeenCalled();
  });

  it('renders the rows grouped by day with the design-system badges', () => {
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="logs-row"]');
    expect(rows.length).toBe(3);
    expect(fixture.nativeElement.querySelectorAll('.logs__day').length).toBe(2);
    expect(rows[1].querySelector('.slim-badge--danger')).toBeTruthy();
  });

  it('derives the view model with user, initials and reference', () => {
    const first = component.entries()[0];
    expect(first.userName).toBe('Hans Muster');
    expect(first.initials).toBe('HM');
    expect(first.ref).toBe('AUTH_ROLE/11');
    expect(first.isSystem).toBe(false);

    const sys = component.entries()[2];
    expect(sys.isSystem).toBe(true);
    expect(sys.initials).toBe('SYS');
  });

  it('derives severity: deletions are critical', () => {
    expect(component.entries()[0].severity).toBeNull();
    expect(component.entries()[1].severity).toBe('crit');
  });

  it('parses data.changes into the diff table and scalars into details', () => {
    expect(component.entries()[0].diff).toEqual([['title', 'Alt', 'Neu']]);
    expect(component.entries()[1].diff).toEqual([]);
    expect(component.entries()[1].details).toEqual([
      ['areaId', 'a1'],
      ['affected', '14'],
    ]);
  });

  it('computes the stat counters from the loaded entries', () => {
    expect(component.writeCount()).toBe(3);
    expect(component.userCount()).toBe(2);
    expect(component.severityCount()).toBe(1);
  });

  it('builds action chips only for present actions, in order', () => {
    expect(component.actionChips().map((chip) => chip.action)).toEqual(['CREATE', 'UPDATE', 'DELETE']);
  });

  it('toggling an action chip reloads with the actions filter', () => {
    facade.load.mockClear();
    component.toggleAction('DELETE');
    expect(component.actionFilter().has('DELETE')).toBe(true);
    expect(facade.load).toHaveBeenCalledWith(expect.objectContaining({ actions: ['DELETE'] }));
  });

  it('clearFilters resets everything and reloads', () => {
    component.toggleAction('DELETE');
    component.section.set('AREA');
    facade.load.mockClear();
    component.clearFilters();
    expect(component.actionFilter().size).toBe(0);
    expect(component.section()).toBe('');
    expect(component.range()).toBe('all');
    expect(facade.load).toHaveBeenCalled();
  });

  it('opens the drawer and related-entries filters by reference', () => {
    const entry = component.entries()[0];
    component.openDrawer(entry);
    fixture.detectChanges();
    expect(component.selected()?.item.logId).toBe('l1');
    expect(fixture.nativeElement.querySelector('[data-testid="logs-drawer"]')).toBeTruthy();

    component.showRelated(entry);
    expect(component.selected()).toBeNull();
    expect(component.query()).toBe('11');
  });
});
