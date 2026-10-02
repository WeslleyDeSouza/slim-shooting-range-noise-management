import { Pipe, PipeTransform } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslatePipe } from '@app-galaxy/translate-ui';
import { HelpDrawerComponent } from './help-drawer.component';

@Pipe({ name: 'translate' })
class TranslateStubPipe implements PipeTransform {
  transform(key: string): string {
    return key;
  }
}

describe('HelpDrawerComponent — kontextsensitive Hilfe (slm 53)', () => {
  let fixture: ComponentFixture<HelpDrawerComponent>;
  let closed: number;
  let manual: number;

  async function setup(url: string, hasManual = false): Promise<void> {
    await TestBed.configureTestingModule({ imports: [HelpDrawerComponent], providers: [provideRouter([])] })
      .overrideComponent(HelpDrawerComponent, { remove: { imports: [TranslatePipe] }, add: { imports: [TranslateStubPipe] } })
      .compileComponents();
    fixture = TestBed.createComponent(HelpDrawerComponent);
    fixture.componentRef.setInput('url', url);
    fixture.componentRef.setInput('hasManual', hasManual);
    closed = 0;
    manual = 0;
    fixture.componentInstance.closed.subscribe(() => closed++);
    fixture.componentInstance.manual.subscribe(() => manual++);
    fixture.detectChanges();
  }

  const el = <T extends Element = HTMLElement>(testId: string): T => fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as T;

  it('shows the help of the page that is open, with all its steps', async () => {
    await setup('/admin/area/abc/shots');
    const topic = el('help-topic');
    expect(topic.getAttribute('data-topic')).toBe('shots');
    expect(topic.textContent).toContain('help.topics.shots.title');
    expect(topic.textContent).toContain('help.topics.shots.intro');
    expect(topic.querySelectorAll('li')).toHaveLength(5);
    // The general operation follows the page-specific help.
    expect(el('help-general').textContent).toContain('help.topics.general.title');
  });

  it('follows the page when the address changes', async () => {
    await setup('/admin/area/abc/shots');
    fixture.componentRef.setInput('url', '/admin/data-management/system');
    fixture.detectChanges();
    expect(el('help-topic').getAttribute('data-topic')).toBe('system');
  });

  it('shows the general help once on a page without a topic of its own', async () => {
    await setup('/admin/data-management/mgdm-export');
    expect(el('help-topic').getAttribute('data-topic')).toBe('general');
    expect(el('help-general')).toBeNull();
  });

  it('links to the topic in the online help and offers the PDF only when one is stored', async () => {
    await setup('/admin/area/abc/details');
    expect(el<HTMLAnchorElement>('help-online').getAttribute('href')).toBe('/admin/help#details');
    expect(el('help-pdf')).toBeNull();

    fixture.componentRef.setInput('hasManual', true);
    fixture.detectChanges();
    el<HTMLButtonElement>('help-pdf').click();
    expect(manual).toBe(1);
  });

  it('closes with the button, the backdrop and Escape', async () => {
    await setup('/admin');
    el<HTMLButtonElement>('help-close').click();
    (fixture.nativeElement.querySelector('.slim-sheet__backdrop') as HTMLButtonElement).click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(closed).toBe(3);
  });
});
