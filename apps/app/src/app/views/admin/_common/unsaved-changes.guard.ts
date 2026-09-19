import { CanDeactivateFn } from '@angular/router';

/** A page that may hold unsaved edits decides itself whether it may be left (it can ask the user first). */
export interface HasUnsavedChanges {
  canDeactivate(): boolean | Promise<boolean>;
}

/**
 * Keeps a half-edited form from being lost by a tab or menu click: the page
 * answers synchronously when it is clean and otherwise opens its own
 * «Änderungen verwerfen?» dialog and resolves with the user's choice.
 * Attach with `canDeactivate: [unsavedChangesGuard]` on the route.
 */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) =>
  component?.canDeactivate ? component.canDeactivate() : true;
