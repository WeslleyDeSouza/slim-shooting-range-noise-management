import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@app-galaxy/translate-ui';
import { BUILD_INFO, BuildInfo } from '../../../../environments/build-info';

/**
 * Sidebar footer: «armasuisse · SLIM 0.0.1» and, on a stamped build, a
 * second line with the Stand of the code — date of the commit and its short
 * hash («Stand 02.10.2026 12:41 · bd88206»), so everybody sees which version
 * is running. Local development has no stamp and shows the first line only
 * (`tools/build-info.js` writes the stamp in the CI build).
 */
@Component({
  selector: 'app-build-stamp',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, DatePipe],
  styleUrl: './build-stamp.component.scss',
  template: `
    {{ 'shell.org' | translate }} · SLIM {{ info().version }}
    @if (info().commit; as commit) {
      <span class="build-stamp__build" data-testid="shell-build">{{
        'shell.build' | translate: { date: (info().committedAt | date: 'dd.MM.yyyy HH:mm'), commit }
      }}</span>
    }
  `,
})
export class BuildStampComponent {
  readonly info = input<BuildInfo>(BUILD_INFO);
}
