import { Pipe, PipeTransform } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslatePipe } from '@app-galaxy/translate-ui';
import { BUILD_INFO, BuildInfo } from '../../../../environments/build-info';
import { BuildStampComponent } from './build-stamp.component';

/** Keys pass through; interpolation like the real pipe (`{{date}}`). */
@Pipe({ name: 'translate' })
class TranslateStubPipe implements PipeTransform {
  transform(key: string, params?: Record<string, unknown>): string {
    const text = key === 'shell.build' ? 'Stand {{date}} · {{commit}}' : key === 'shell.org' ? 'armasuisse' : key;
    return Object.entries(params ?? {}).reduce((t, [k, v]) => t.replace(`{{${k}}}`, String(v)), text);
  }
}

describe('BuildStampComponent', () => {
  let fixture: ComponentFixture<BuildStampComponent>;

  async function setup(info?: BuildInfo): Promise<HTMLElement> {
    await TestBed.configureTestingModule({ imports: [BuildStampComponent] })
      .overrideComponent(BuildStampComponent, { remove: { imports: [TranslatePipe] }, add: { imports: [TranslateStubPipe] } })
      .compileComponents();
    fixture = TestBed.createComponent(BuildStampComponent);
    if (info) fixture.componentRef.setInput('info', info);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const text = (el: HTMLElement) => el.textContent?.replace(/\s+/g, ' ').trim();

  it('shows organisation and version only when the build is not stamped (local development)', async () => {
    const el = await setup();
    // The committed default must stay unstamped — a stamped copy belongs to the CI build only.
    expect(BUILD_INFO.commit).toBeNull();
    expect(text(el)).toBe(`armasuisse · SLIM ${BUILD_INFO.version}`);
    expect(el.querySelector('[data-testid="shell-build"]')).toBeNull();
  });

  it('adds the Stand of a stamped build: commit date and short hash', async () => {
    const el = await setup({ version: '0.0.1', commit: 'bd88206', committedAt: '2026-10-02T12:41:50+02:00' });
    const stamp = el.querySelector('[data-testid="shell-build"]');
    expect(stamp?.textContent).toMatch(/^Stand \d{2}\.10\.2026 \d{2}:41 · bd88206$/);
    expect(text(el)).toContain('armasuisse · SLIM 0.0.1 Stand');
  });
});
