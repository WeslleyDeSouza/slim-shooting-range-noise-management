# Kriterien-Tests (Anforderungskatalog → Playwright)

**Zweck:** Sammlung der Nachweise für die kritischen Kriterien der Ausschreibung
(Beilage B1 `slm 1`–`slm 57`, Abnahmekriterien K1–K7 aus
`docs/projects/prototyp-roadmap.md`, Abschnitt 1). Jeder Fall trägt die Ids als
Playwright-Annotation (`support/criteria.ts` → `slm()`, `acceptance()`), damit der
HTML-Report nach Kriterium gefiltert werden kann.

**Abnahme:** Beilage A1.2 (Abnahmevorschrift) verlangt je Sprint Testfälle aus den Akzeptanzkriterien,
vorgängig geliefert, plus Testprotokolle auf dem Akzeptanzsystem; die Schlussabnahme ein vollständiges
Abnahmetestprotokoll. Diese Sammlung ist dafür gedacht: ein Fall je Kriterium, der Playwright-HTML-Report
ist das Protokoll (abgenommen / bedingt / nicht = passed / flaky / failed).

**Stand:** Skelett. Jeder Fall ist `test.fixme` mit den Schritten als Kommentar;
nichts davon läuft produktiv. Der Ordner ist temporär – sobald ein Fall echt ist,
wandert er in die Seiten-Specs (`src/*.spec.ts`) oder bleibt hier, bis das Kriterium
belegt ist; danach wird `criterias/` gelöscht.

## Ausführen

```bash
npx playwright test --config=apps/app-e2e/playwright.config.ts --project=criterias
npx playwright show-report
```

Die Fälle laufen mit der Session des `setup`-Projekts (`slim@demo.ch`); Rollen-Fälle
melden sich mit den Demo-Konten aus `support/criteria.ts` (`ACCOUNTS`) neu an.

## Dateien und was sie belegen

| Datei | Kriterien | Was zu tun ist |
| --- | --- | --- |
| `c01-noise-calculation.spec.ts` | `slm 31`–`34`, K2 | Kontrollwerte B1.4 über die API (Vitest deckt sie in `libs/shared/lsv`); im UI: Details Geissalp E1 = 60.8 / Sanierter Zustand 56.4, Delta, Baujahr-Regel, Reservepunkt ohne Berechnung |
| `c02-traffic-lights.spec.ts` | `slm 4`, `slm 8`, `slm 9`, 5.10 | Ampel-Regeln Lärm (> GW rot, > GW−5 orange), Kontingent (> 125 % rot), Aggregation auf den Schiessplatz, `none` ohne Grundlage |
| `c03-usages.spec.ts` | `slm 10`, `slm 37`, `slm 45`, 5.11 | Erfassen/Bearbeiten/Löschen/Rückgängig, nur zulässige Kombinationen, Filter Default laufendes Jahr, Sperrdatum, Excel-Import mit Fehlerbericht |
| `c04-simulation.spec.ts` | `slm 12`, 5.13 | Ist aus 7.4.5, Überschreiben, ×10 = +10 dB, Abend +5 dB, Zurücksetzen, keine Persistenz |
| `c05-roles.spec.ts` | `slm 35`, `slm 56`, 8.1.2, K5 | Je Demo-Konto: Menü/Seiten/403 gemäss Matrix; Verantwortlicher sieht nur Geissalp/Thun; 2FA-Pfad |
| `c06-ui-i18n-theme.spec.ts` | `slm 50`–`52`, K6 | DE/FR/IT/EN persistent, Light/Dark persistent, 375 px ohne horizontales Scrollen, Tastaturbedienung, axe |
| `c07-elo-interface.spec.ts` | `slm 28`–`30`, K3 | `GET` Anlageninformationen, `POST` genau eine Nutzung mit Validierung, Nutzung erscheint mit ELO-Badge und verändert die Ampel |
| `c08-sitemap.spec.ts` | `slm 5`, `slm 6`, `slm 7`, K4 | Alle Routen aus `APP_ROUTES` erreichbar, Deep Link ohne Session → Login mit `returnUrl`, Platzhalter markiert |
| `c09-logging-security.spec.ts` | `slm 56`, `slm 57` | Logbuch: Login, fehlgeschlagener Login mit Grund, Sperre nach Fehlversuchen, Passwort-Reset, Logout; Export XLSX; Break-Glass-Prozess (nur Doku) |
| `c10-data-management.spec.ts` | `slm 1`, `slm 13`–`27`, `slm 36` | Datenverwaltung Schiessplatz/Stellungsräume/Zuordnung Waffen/Waffen/Berechnungen/Konfiguration (heute Platzhalter) |
| `c11-performance.spec.ts` | `slm 54`, 12.5 | Suche Ø 2 s / max 5 s, Filter 0.5/1 s, Details 2/5 s, Berechnung 5/10 s – Messung mit `performance.now()` bzw. k6 aus ELO |

## Konventionen

- Selektoren aus `../support/selectors.ts` und die `data-testid`s der Seiten
  (`shots-*`, `details-*`, `sim-*`, `area-action-*`, `area-tab-*`, `logs-*`).
- Kein Seed im Test: die Daten kommen aus `apps/api/src/mocks/tenant/tenant.mock.json`
  (Geissalp: 14 Stellungsräume, 16 Quellen, 6 Empfangspunkte, 2 Zustände).
- Ein Fall = ein Kriterium; Schritte als Kommentar, bis der Fall echt ist.
