import { inject, Injectable, signal } from '@angular/core';
import { catchError, finalize, firstValueFrom, of, tap } from 'rxjs';
import { AdminLogsService } from '@ui-slim/apiClient';
import type { LogFacetsDto, LogItemDto } from '@ui-slim/apiClient';

export const LOGS_PAGE_SIZE = 50;

/** Sentinel of the user filter for entries without a user (system). */
export const SYSTEM_USER = '__system__';

export interface LogFilters {
  q?: string;
  section?: string;
  /** User id, or `SYSTEM_USER` for system-only entries. */
  user?: string;
  actions?: string[];
  /** ISO date lower bound (range select). */
  from?: string;
}

/**
 * Logbook (`/admin/data-management/logs`, ELO pattern) on top of the
 * generated `AdminLogsService`. `load(filters)` replaces the accumulated
 * list, `loadMore()` appends the next page with the same filters. Provided
 * per route (see admin.routes.ts), so the page starts empty every visit.
 */
@Injectable()
export class LogsFacade {
  private readonly api = inject(AdminLogsService);

  readonly loading = signal(false);
  readonly items = signal<LogItemDto[]>([]);
  readonly total = signal(0);
  readonly facets = signal<LogFacetsDto | null>(null);
  readonly error = signal<string | null>(null);

  private page = 1;
  private filters: LogFilters = {};

  loadFacets(from?: string): void {
    this.api
      .adminLogFacets({ from })
      .pipe(
        tap((facets) => this.facets.set(facets)),
        catchError(() => {
          this.facets.set(null);
          return of(null);
        }),
      )
      .subscribe();
  }

  load(filters: LogFilters): void {
    this.filters = filters;
    this.page = 1;
    this.fetch(false);
  }

  loadMore(): void {
    this.page += 1;
    this.fetch(true);
  }

  /** Server-built XLSX with the active filters; the API logs the export. */
  exportXlsx(lang: string): Promise<Blob> {
    return firstValueFrom(this.api.adminLogExport({ ...this.params(), lang }));
  }

  get hasMore(): boolean {
    return this.items().length < this.total();
  }

  private params() {
    const { q, section, user, actions, from } = this.filters;
    return {
      q: q || undefined,
      section: section || undefined,
      userId: user && user !== SYSTEM_USER ? user : undefined,
      system: user === SYSTEM_USER ? true : undefined,
      action: actions?.length ? actions : undefined,
      from,
    };
  }

  private fetch(append: boolean): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .adminLogList({ ...this.params(), page: this.page, limit: LOGS_PAGE_SIZE })
      .pipe(
        tap((response) => {
          this.total.set(response.total);
          this.items.set(append ? [...this.items(), ...response.items] : response.items);
        }),
        catchError((error: { status?: number }) => {
          this.error.set(error?.status === 0 ? 'error.network' : 'error.generic');
          if (!append) {
            this.items.set([]);
            this.total.set(0);
          }
          return of(null);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }
}
