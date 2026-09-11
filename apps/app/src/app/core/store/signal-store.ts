import { computed, Signal, signal, WritableSignal } from '@angular/core';

/**
 * Minimal signal-based store (no NgRx): one immutable state object, typed
 * selectors and patch updates. Feature facades extend it and expose only
 * what their pages need (ELO facade pattern, see `core/area/area.facade.ts`).
 *
 *   class AreaStore extends SignalStore<AreaState> {
 *     readonly areas = this.select((s) => s.areas);
 *     setAreas(areas: Area[]) { this.patch({ areas }); }
 *   }
 */
export abstract class SignalStore<TState extends object> {
  private readonly _state: WritableSignal<TState>;

  /** Read-only view of the whole state. */
  readonly state: Signal<TState>;

  protected constructor(initial: TState) {
    this._state = signal<TState>(initial);
    this.state = this._state.asReadonly();
  }

  /** Derived, memoised selector. */
  protected select<T>(selector: (state: TState) => T): Signal<T> {
    return computed(() => selector(this._state()));
  }

  /** Shallow-merge a partial state. */
  protected patch(partial: Partial<TState>): void {
    this._state.update((state) => ({ ...state, ...partial }));
  }

  /** Replace the state with a reducer result. */
  protected update(reducer: (state: TState) => TState): void {
    this._state.update(reducer);
  }

  protected snapshot(): TState {
    return this._state();
  }
}
