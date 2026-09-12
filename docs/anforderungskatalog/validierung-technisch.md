# Technische Validierung des Prototyps gegen Beilage B1, Kapitel 12.5–12.7

**Stand:** 12.09.2026 · **Geprüft gegen:** B1 12.5 Effizienz (slm 54), 12.6 Änderbarkeit und Wartbarkeit (slm 55),
12.7 Authentifizierung und Autorisierung (slm 56) · **Grundlage:** Code, `.env`/`.env.example`,
`@app-galaxy/auth-api` 0.1.218 (node_modules), `docs/architecture/*`, frische Testläufe und eine Messung der
Service-Antwortzeiten (temporäre Vitest-Spec, danach gelöscht).

## 0. Testbilanz vom 12.09.2026

| Lauf | Ergebnis |
|---|---|
| `npx nx test api` (Vitest, API + `@slim/lsv`) | 21 Dateien, **197 / 197** grün, 44 s |
| `npx nx test app` (Jest) | grün (63 Fälle laut Doku) |
| `npx nx lint api app` | grün; `lsv` und `design-system` haben kein Lint-Target |
| `npx nx e2e app-e2e` (Playwright) | **nicht ausgeführt**; 32 `test(`-Fälle in `src/*.spec.ts`; `criterias/` = 46 Fälle, alle `test.fixme` (Skelett) |

## 1. Effizienz, Performance und Last (12.5, slm 54)

### 1.1 Messung

Service-Ebene (ohne HTTP, ohne Browser), SQLite in-memory, Demo-Datensatz Geissalp (14 Stellungsräume, 16 Quellen,
6 Empfangspunkte, 2 Zustände), Entwicklungsrechner, 10 Wiederholungen, 12.09.2026:

| Vorgang (Maske) | Datenmenge | Ø | Median | Max |
|---|---|---:|---:|---:|
| Übersicht Schiessplätze (5.9) | 9 Schiessplätze | 0.7 ms | 0.7 ms | 1.2 ms |
| Schusszahlen-Übersicht (5.11) | 72 Nutzungen | 4.2 ms | 3.9 ms | 6.1 ms |
| Beurteilung (5.12) | 72 Nutzungen, 1 Jahr | 12.2 ms | 12.8 ms | 18.4 ms |
| Simulation ausführen (5.13) | 72 Nutzungen | 12.5 ms | 10.9 ms | 19.2 ms |
| Schusszahlen-Übersicht (5.11) | 1 572 Nutzungen | 65 ms | 62 ms | 103 ms |
| Beurteilung (5.12) | 1 572 Nutzungen, 1 Jahr | 59 ms | 61 ms | 68 ms |
| Beurteilung (5.12) | 4 572 Nutzungen, 3 Jahre | 146 ms | 137 ms | 219 ms |
| Simulation ausführen (5.13) | 1 572 Nutzungen | 57 ms | 58 ms | 68 ms |
| Kernel `annex9Level`, 1 000 Quellen × 100 Empfangspunkte | – | 19 ms gesamt | – | – |

Zielmengengerüst nach B1 Kap. 4 (100–1 500 Nutzungen je Schiessplatz und Jahr) ist damit abgedeckt; gegen die
Vorgaben aus 12.5 (Suche Ø 2 s / max 5 s, Filter 0.5 / 1 s, Details 2 / 5 s, Berechnung 5 / 10 s) liegt jeder
gemessene Wert um mehr als Faktor 20 unter dem Zielwert. Die Nutzungsabfrage nutzt den Index
`(tenantId, areaId, date)` auf `nutzung`; WLR-Werte werden je Zustand in einer Abfrage gelesen.

**Was die Messung nicht abdeckt:** HTTP-Overhead, Guards (JWT, Mandant, Rolle, Objektregel, Replay), Browser-Rendering,
MariaDB/PostgreSQL statt SQLite, gleichzeitige Nutzer. Eine Messung mit 10 gleichzeitigen Nutzern (k6) fehlt; die
Kriterien-Spec `c11-performance.spec.ts` ist ein Skelett.

### 1.2 Bewertung gegen die einzelnen Anforderungen

| Anforderung 12.5 | Befund | Status |
|---|---|---|
| Antwortzeiten der Tabelle | Service-Ebene weit unter Zielwert (oben) | ✅ (Einzelnutzer, ohne Last) |
| Laststabilität bis 10 Nutzer | nicht gemessen | ☐ |
| Ressourcen-Isolation rechenintensiver Prozesse | Berechnung läuft **synchron im API-Prozess** (`AssessmentService.assess`, `SimulationService.run`); kein Worker, keine Warteschlange, kein Zeitlimit | ❌ (bei heutigen Rechenzeiten ohne Wirkung, aber die NFA verlangt die Isolation) |
| Tagesaktuelle asynchrone Berechnung (Kann) | nicht vorhanden; alles live | – |
| Feedback < 10 s («Sanduhr») | `loading`-Signale in Facades, Ladezustände in allen Fachmasken | ✅ |
| Fortschritt und Abbruch > 10 s | nicht vorhanden (kein Vorgang dauert so lange) | ☐ |
| Skalierung | pm2 `API_CLUSTER_INSTANCES` vorhanden; Replay-Nonce-Store in-memory → bei > 1 Instanz nötig: Redis (`REDIS_URL` ungenutzt) | ⚠️ |

## 2. Änderbarkeit und Wartbarkeit (12.6, slm 55)

### 2.1 Architekturmuster

| Anforderung | Befund | Status |
|---|---|---|
| Erprobtes Muster, Trennung Logik/Darstellung | Frontend: Facade + `SignalStore` je Feature (4 Facades), Seiten `extends ComponentBase` (14) ohne HTTP-Aufrufe, `OnPush`, Signals. API: Controller → Service → Entity je Modul (`area`, `usage`, `calculation`, `auth-audit`), DTOs mit `class-validator`. Berechnungskern `@slim/lsv` abhängigkeitsfrei | ✅ |
| Vertrag Frontend ↔ API | OpenAPI aus den DTOs, Client generiert (`@ui-slim/apiClient`), keine handgeschriebenen Modelle im Frontend | ✅ |
| Modulgrenzen | Nx-Workspace mit `apps/`, `libs/api`, `libs/shared`, `libs/app`; Lint-Regel `@nx/enforce-module-boundaries` aktiv, aber mit `sourceTag: '*' → onlyDependOnLibsWithTags: ['*']` ohne Einschränkung | ⚠️ (Regel vorhanden, keine echten Tags) |
| Dokumentation im Code | Kommentarzeilen: API 642 / 5 928 Zeilen, Kernel 265 / 1 033, App 736 / 8 323; jede Fachregel im Kernel mit B1-Referenz im JSDoc | ✅ |
| Dokumentation im Repo | `docs/architecture` (Gesamtarchitektur, Datenstruktur, Lärmberechnung, Berechtigungen, Deployment, i18n, Sitemap, UI), ERD `uml.mmd` und Swagger automatisch erzeugt, `docs/README.md` als Index | ✅ |
| Tests | 48 Spec-Dateien; Kontrollwerte B1.4, Service-Tests mit In-Memory-DB, Facade- und Seitentests, e2e | ✅ |
| Erweiterung ohne Seiteneffekte | neue Fachmodule nach demselben Muster (`DBOptions`, Registrierung in `app.module.ts`); Demo-Datensatz aus JSON generiert | ✅ |

### 2.2 Konfigurierbarkeit ohne Rekompilierung («Muss»)

| Fachparameter | Wo heute | ohne Rekompilierung änderbar? |
|---|---|---|
| Grenzwerte PW/IGW/AW je ES (7.7, 5.28) | Konstanten `ANNEX9_LIMITS`, `ANNEX7_LIMITS` in `limits.ts` | ❌ |
| Ampel-Schwellen und Farben (5.10, 5.28) | `NOISE_WARN_BAND_DB = 5`, `QUOTA_WARN_FACTOR = 1.25` als Konstante; Farben im SCSS | ❌ |
| Rundungsmodus (B1.2 10.4) | Funktionsparameter mit Default `whole`, nirgends konfiguriert | ❌ |
| Werktagsfenster Anhang 9, Halbtagsgrenze Anhang 7 | Konstanten in `operating-data.ts` | ❌ (fachlich fix, aber Halbtagsgrenze steht falsch auf 13:00) |
| Feiertage je Standort | nicht vorhanden | ❌ |
| Sperrdatum Schusszahlenerfassung (5.28) | nicht vorhanden | ❌ |
| Auswahllisten (slm 1: Waffen, Kaliber, Kategorien) | nur Seed | ❌ |
| Kartenlayer, Zoomstufen (5.4.2) | keine Karte | ❌ |
| Rollen und Rechte (8.1) | galaxy-Tabellen, Masken Benutzer/Rollen/Apps | ✅ |
| Übersetzungen | JSON unter `public/assets/locales/<lang>/` zur Laufzeit geladen | ✅ |
| Technische Parameter (Port, DB, Mail, Rate-Limits, Passwortregeln, Seed) | `.env` | ✅ |

Fazit 12.6: Architektur und Wartbarkeit erfüllt; die **fachliche Konfigurierbarkeit ist nicht erfüllt** – alle
Berechnungs- und Ampelparameter sind Konstanten. Die Anforderungsmatrix im C2 führt slm 55 als «P (im Prototyp
nachgewiesen)»; zutreffend ist «Z» mit «Architektur P».

## 3. Authentifizierung und Autorisierung (12.7, slm 56)

| Anforderung | Befund | Status |
|---|---|---|
| MFA als Mindestanforderung | galaxy liefert 2FA per E-Mail-Code (`/api/auth/verify-2fa-login`). Aktiv nur mit `API_AUTH_2FA_ENABLED` bzw. `APP_AUTH_2FA_ENABLED` (`token.util.js`, `isTwoFactorLoginEnabled`); **keine der beiden Variablen steht in `.env` oder `.env.example`** → im Prototyp ist 2FA ausgeschaltet, der Login läuft nur mit Passwort. Die e2e-Suite umgeht den Schritt per Deep Link. Erzwingung je Konto, TOTP, AGOV: nicht vorhanden | ❌ im Betriebszustand des Prototyps (Funktion vorhanden, nicht aktiv) |
| Rollenbasierte Autorisierung | Guard-Kette je Admin-Route: `AuthGuard('jwt')` → `TenantGuard` → `AppsRolesGuard(app)` → `ReplayGuard` → `RulesGuard` (`area-scope`); vier Rollen mit Matrix 8.1.2 im Seed; W/R-O über `schiessplatz_benutzer`; Listen serverseitig gefiltert; 6 Tests | ✅ serverseitig |
| Frontend | Menü und Schaltflächen statisch; `adminGuard` prüft nur die Session | ⚠️ (B1 12.1 «nicht autorisierte Funktionen ausblenden») |
| Logging aller Anmeldeversuche | `auth-lifecycle.hooks.ts`: `AUTH_LOGIN` (Methode), `AUTH_LOGIN_FAILED` (Grund), `AUTH_LOGOUT`, `AUTH_TOKEN_REUSE`, `AUTH_PASSWORD_RESET_REQUESTED`, `AUTH_PASSWORD_CHANGED`, `AUTH_EMAIL_VERIFIED`; IP und User-Agent; Tabelle `logbuch`; Maske «Logbuch» mit Filtern und XLSX-Export; Tests | ✅ |
| Überwachung / Alarmierung von Angriffen | nur Logbuch, keine Auswertung oder Alarmierung; Login-Sperre vorhanden, aber `API_AUTH_LOGIN_LOCKOUT_ENABLED=0` | ⚠️ |
| Break-Glass-Admin | nicht vorhanden; nur als Prozess in der ELO-Dokumentation referenziert | ❌ |
| Passwortregeln | `API_AUTH_PASSWORD_MIN_LENGTH=4`, History aus (Prototypwerte, dokumentiert) | ⚠️ |
| Härtung | Security-Header (HSTS, CSP), CORS (`*` im Prototyp), Rate-Limit `/auth` 20/min, Replay-Schutz, `ValidationPipe` (ohne `whitelist`), `ParseUUIDPipe`, Soft-Delete | ✅ mit Produktionsvorbehalt |
| Mandantentrennung | `tenantId` auf jeder Tabelle, jede Abfrage gefiltert, Tests | ✅ |

## 4. Zusammenfassung und Massnahmen

| # | Massnahme | Anforderung |
|---|---|---|
| 1 | `APP_AUTH_2FA_ENABLED=1` in `.env.example` und Setup-Wizard setzen, e2e mit aktivem 2FA-Schritt; Erzwingung je Rolle | slm 56, slm 35 |
| 2 | Fachparameter (Grenzwerte, Schwellen, Rundung, Feiertage, Sperrdatum) als Konfigurations-Entity mit Maske 5.28 und Lesepfad in `@slim/lsv`-Aufrufer | slm 55, slm 27 |
| 3 | Berechnung in Worker (Worker-Threads oder eigener Container) mit Warteschlange und Zeitlimit; k6-Lasttest mit 10 Nutzern auf MariaDB/PostgreSQL | slm 54 |
| 4 | Redis-Store für Replay-Nonces und Sessions, sobald `API_CLUSTER_INSTANCES > 1` | slm 54 |
| 5 | Break-Glass-Konto und Prozess in SLIM dokumentieren, Verwendung im Logbuch nachweisbar | slm 56 |
| 6 | Nx-Tags je Lib (`scope:api`, `scope:app`, `scope:shared`) und echte Abhängigkeitsregeln | slm 55 |
| 7 | Frontend-Rechte (CASL) aus den App-Rechten der Session | 12.1, slm 50 |

Siehe auch [validierung-fachlich.md](validierung-fachlich.md) und [checkliste.md](checkliste.md).
