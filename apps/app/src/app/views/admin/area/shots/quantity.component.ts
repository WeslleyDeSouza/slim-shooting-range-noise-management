import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@app-galaxy/translate-ui';

/** Quantities per unit: Stück (Schuss) and Kilogramm (Sprengstoff) are never added to each other. */
export interface Quantities {
  shots: number;
  kg: number;
}

/** Adds quantities per unit; rounded to the three decimals a quantity can have. */
export function sumQuantities(items: readonly Quantities[]): Quantities {
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return {
    shots: round(items.reduce((sum, item) => sum + item.shots, 0)),
    kg: round(items.reduce((sum, item) => sum + item.kg, 0)),
  };
}

/**
 * A quantity of usages with its unit: «1'000 Schuss», «2.5 kg» or both next
 * to each other. A unit without quantity is left out; nothing at all reads
 * «0 Schuss».
 */
@Component({
  selector: 'app-quantity',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, TranslatePipe],
  template: `
    @if (shots() || !kg()) {
      <span data-unit="shots"
        ><b>{{ shots() | number: '1.0-3' }}</b> {{ 'shots.unit_shots' | translate }}</span
      >
    }
    @if (shots() && kg()) {
      <span aria-hidden="true"> · </span>
    }
    @if (kg()) {
      <span data-unit="kg"
        ><b>{{ kg() | number: '1.0-3' }}</b> {{ 'shots.unit_kg' | translate }}</span
      >
    }
  `,
})
export class QuantityComponent {
  readonly shots = input(0);
  readonly kg = input(0);
}
