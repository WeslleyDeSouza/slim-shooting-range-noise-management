import { browserLanguage } from './browser-language';

describe('Browser language (B1 12.2)', () => {
  it('chooses a supported language in preference order, including regional variants', () => {
    expect(browserLanguage(['fr-CH', 'de'])).toBe('fr');
    expect(browserLanguage(['es', 'it-CH', 'en'])).toBe('it');
    expect(browserLanguage(['en-US'])).toBe('en');
  });
  it('falls back to German only when no supported preference exists', () => {
    expect(browserLanguage(['es', 'pt'])).toBe('de');
    expect(browserLanguage([])).toBe('de');
  });
});
