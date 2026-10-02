import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AdminDataAreaWeaponsService, AreaWeaponAssignmentDto } from '@ui-slim/apiClient';
import { apiErrorMessage } from '../store/api-error';
import { SignalStore } from '../store/signal-store';

interface WeaponAssignmentState {
  /** Schiessplatz the read model belongs to ('' before the first load). */
  areaId: string;
  model: AreaWeaponAssignmentDto | null;
  loading: boolean;
  error: string | null;
}

/**
 * Datenverwaltung › Schiessplatz › Zuordnung Waffen (B1 5.17) of one
 * Schiessplatz: the Stellungsräume with their zulässigen Kombinationen
 * Waffe/Kaliber over the generated `AdminDataAreaWeaponsService`. Read only —
 * the assignments are maintained by the import and the DB administration
 * (FAQ 52), so there is no mutation here.
 */
@Injectable({ providedIn: 'root' })
export class WeaponAssignmentFacade extends SignalStore<WeaponAssignmentState> {
  private readonly api = inject(AdminDataAreaWeaponsService);

  readonly areaId = this.select((s) => s.areaId);
  readonly area = this.select((s) => s.model?.area ?? null);
  readonly rooms = this.select((s) => s.model?.rooms ?? []);
  readonly assignments = this.select((s) => s.model?.assignments ?? []);
  readonly loading = this.select((s) => s.loading);
  readonly error = this.select((s) => s.error);

  constructor() {
    super({ areaId: '', model: null, loading: false, error: null });
  }

  /** Always fetches (ComponentBase `getData()` on init and every DATA_RELOAD); a switch of the area clears the old model first. */
  async load(areaId: string): Promise<void> {
    if (!areaId) return;
    if (this.snapshot().areaId !== areaId) this.patch({ areaId, model: null });
    this.patch({ loading: true, error: null });
    try {
      const model = await firstValueFrom(this.api.adminDataAreaWeaponsAssignment({ areaId }));
      this.patch({ model, loading: false });
    } catch (error) {
      this.patch({ loading: false, error: apiErrorMessage(error) });
    }
  }

  clearError(): void {
    this.patch({ error: null });
  }
}
