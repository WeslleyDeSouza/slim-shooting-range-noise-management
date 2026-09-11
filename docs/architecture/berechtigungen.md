# Berechtigungen und Benutzerverwaltung (B1 Kapitel 8.1, `slm 35`)

**Stand:** 11.09.2026 · Prüfung, ob die aus ELO übernommene Benutzerverwaltung
(`apps/app/src/app/views/admin/user-management`) und das galaxy-Rollenmodell die Anforderungen
decken. Kurz: **R / W / X pro Bereich ja (Rollen + App-Rechte), «W/R-O» ja (galaxy Rules +
`area_user`), MFA ja (2FA – die Anforderung lautet «MFA oder AGOV», AGOV ist damit optional).**
Was noch fehlt, steht in Abschnitt 5.

## 1. Was das Backend schon kann (galaxy `@app-galaxy/auth-api`)

Das Backend der Benutzerverwaltung muss **nicht** aus ELO kopiert werden: ELO nutzt dieselben
galaxy-Module, die in `apps/api/src/app.module.ts` bereits eingebunden sind
(`AuthUserAdminWithRoutingModule`, `AuthRoleAdminWithRoutingModule`, `AuthAppAdminWithRoutingModule`).
Daraus entstehen im generierten Client `AdminUsersService` (`userAdmin*`), `AdminService`
(`roleAdmin*`) und `AdminAppsTenantService` (`adminApps*`) – genau die Endpunkte, die die
kopierten Facades aufrufen.

| Tabelle (galaxy) | Inhalt | Für 8.1 |
|---|---|---|
| `app_role` | Rolle pro Mandant: `title`, `state`, `isDefault`, `permissionMode`, `settings` (JSON: `key`, `ownAreasOnly`, `slim` — Typ `SlimRoleSettings` in `@slim/shared`) | die vier Rollen; der **Schlüssel** (`slim_specialist`, `slim_range_owner`, `slim_interested`, `slim_admin`) identifiziert die Rolle im Code und später in CASL, unabhängig vom Titel |
| `app_role_right` | Rolle × App: `access` = `read` \| `write` \| `delete` \| `root` | R / W / X pro Bereich |
| `app_user_right` | Benutzer ↔ Rolle | Zuweisung |
| `app_app` | App-Katalog = «Bereiche» (`API_APPS_MAPPING`) | Zeilen der Matrix |

Der `AppsRolesGuard(appIds)` auf jedem Admin-Controller prüft pro Request:
`read` → nur GET · `write` → alles ausser DELETE · `delete`/`root` → alles · keine Zeile → 403.
Deshalb ist das Löschen von Nutzungen ein `POST …/usage/delete` (ein «W»-Recht schliesst das
Löschen einer Nutzung ein, B1 8.1.2).

MFA: galaxy liefert 2FA per E-Mail-Code (`/auth/two-fa-login`), Login-Sperre nach Fehlversuchen,
Passwortregeln (`API_AUTH_PASSWORD_*`), Login-Logging. Das deckt «MFA oder AGOV» ab; AGOV bleibt
eine Option für später (Abschnitt 5).

**Objektrechte über galaxy Rules** (`@app-galaxy/core-api`, `RulesModule`): ein `IRuleValidator`
(`BaseRuleValidator`) wird beim Start im `RuleEngineService` registriert; der `RulesGuard` liest die
Metadaten von `@Rules([...])` (Handler oder Klasse) und ruft die Regel mit `user`, `tenant`,
`action`, `params`, `body` auf. So werden in SLIM die «nur eigene Schiessplätze» geprüft (Abschnitt 4).

## 2. Zuordnung Bereiche → Apps → Rollen (umgesetzt im Seed)

`apps/api/src/mocks/roles.mock-data.ts` legt beim Start die vier Rollen (Ids 10–13) mit der
Matrix an; `main.mock-data.ts` erweitert den App-Katalog um drei **reine Rechte-Apps**
(ohne Menüeintrag), damit eine Sitemap-Seite in die Zeilen der Matrix zerfällt:

| Bereich (B1 8.1.2) | App (`API_APPS_MAPPING`) | Fachspezialist | SP-Verantw. | Interessent | App-Admin |
|---|---|---|---|---|---|
| Startseite 5.8 | – (immer) | R | R | R | R |
| Schiessplatz-Nutzungen 5.9–5.12 | `ADMIN_AREA` 40 | root (R/W) | root (W/R-O)¹ | read | read |
| Immissionsberechnung durchführen/speichern 5.10 | `ADMIN_AREA_CALCULATION_RUN` 47 ² | write | – | – | – |
| Simulation 5.13 | `ADMIN_AREA_SIMULATION` 46 (zusätzlich zu 40) | write | write (W/R-O)¹ | – | – |
| DV Schiessplatz Übersicht / Areal / Stammdaten 5.14–5.16 | `ADMIN_DATA_AREA` 41 | write | read | read | read |
| DV Zuordnung Waffen 5.17 | `ADMIN_DATA_AREA_WEAPONS` 48 | root | write (W/R-O)¹ | – | read |
| DV Berechnungen 5.18–5.21 | `ADMIN_DATA_CALCULATIONS` 42 | root | – | – | read |
| DV Waffen 5.22–5.25 | `ADMIN_DATA_WEAPONS` 43 | root | read | read | read |
| DV Benutzer 5.26 | galaxy `APP_ADMIN_USER_LIST` 1 | root | write (W/R-O)¹ | – | read |
| Administration (Rollen, Apps, System) | galaxy `APP_ADMIN_ROLE_LIST` 2, `APP_ADMIN_APPS_LIST` 4, `ADMIN_DATA_SYSTEM` 45 | read (Rollen) | – | – | root |
| MGDM Export | `ADMIN_DATA_MGDM_EXPORT` 44 | write | – | – | read |

¹ «W/R-O» = `settings.ownAreasOnly = true` an der Rolle, erzwungen durch die Regel `area-scope`
(Abschnitt 4). ² Noch kein Endpunkt – reserviert für «Berechnung speichern» (5.18–5.21).

**Demo-Konten** (Passwort `1234`, `tenant.mock.json`): `slim@demo.ch` (galaxy-Admin, alles),
`fachspezialist@demo.ch`, `schiessplatz@demo.ch` (Schiessplatz-Verantwortlicher, zugeordnet:
Geissalp, Thun), `interessent@demo.ch`, `appadmin@demo.ch`. Damit lässt sich jede Spalte der
Matrix am laufenden System prüfen (Menü bleibt vorerst statisch; die API antwortet 403, die
Seiten zeigen den Fehler).

## 3. Übernommene Oberfläche (ELO → SLIM)

| ELO | SLIM | Zustand |
|---|---|---|
| `views/admin/user-management/{users,roles,apps}` | gleich, Routen `/admin/data-management/{users,roles,apps}` (+ `create`, `edit/:id`) | Facades auf `@ui-slim/apiClient` umgestellt, Konstanten aus `APP_ROUTES` |
| `views/admin/_ui/*` | `views/admin/_common/*` (Direktive, Style-Strings, Zahlformat), `views/admin/_components/*` (Form-Loading, Platzhalter) | Konvention `_common` / `_components` |
| `admin.locale.json` (`admin.users`, `admin.roles`, `admin.apps`, `admin.common`) | `apps/app/public/assets/locales/<lang>/admin.locale.json`, Route `data.path: 'admin'` | DE/FR/IT/EN übernommen |

Offen an der Oberfläche: die Masken nutzen noch ELO-Style-Strings (`AD_TABLE_STYLES`,
`ELO_FORM_STYLES`, Bootstrap-Klassen) statt der `slim-*`-Blöcke – funktional, aber optisch
noch nicht im Design System; Umbau ist ein reiner Template-Job.

## 4. «W/R-O» – umgesetzt mit galaxy Rules

| Baustein | Datei | Was er tut |
|---|---|---|
| `area_user` | `modules/area/entities/area-user.entity.ts` | Zuordnung Benutzer ↔ Schiessplatz (Seed: `users[].areas` in `tenant.mock.json`) |
| `AreaScopeService` | `modules/area/scope/area-scope.service.ts` | `allowedAreaIds(tenantId, userId)`: `null` = alles, sobald eine aktive Rolle des Benutzers **nicht** `ownAreasOnly` ist (offenes System); sonst die zugeordneten Ids. `assign()` für Benutzerverwaltung und Seed |
| `AreaScopeRule` (`area-scope`) | `modules/area/scope/area-scope.rule.ts` | `BaseRuleValidator` der galaxy Rule-Engine: liest `:areaId` / `:id` aus der Route, 403 `AREA_SCOPE` ausserhalb der Zuordnung; Routen ohne Area-Id passieren |
| `@AreaScoped()` + `RulesGuard` | Controller `admin/area`, `…/usage`, `…/calculation` | Klassen-Variante von `@Rules([...])`; `TenantIdOnRequestGuard` reicht die Mandanten-Id des `TenantGuard` an den `RulesGuard` weiter |
| Listenfilter | `AreaService.list/summary(tenantId, userId)` | Übersicht und Startseite zeigen nur zugeordnete Plätze – das Schloss «Nur berechtigte Schiessplätze» ist echt |
| Tests | `modules/area/scope/area-scope.spec.ts` | Rollen-Seed, unbeschränkt vs. beschränkt, Regel-Ergebnisse, Aufhebung durch zusätzliche Rolle |

## 5. Was noch fehlt

| Thema | Anforderung | Stand | Nächster Schritt |
|---|---|---|---|
| Rechte im Frontend (CASL) | 8.1.2, `slm 50` (Rollen-GUI) | Menü und Schaltflächen sind statisch; die API antwortet 403. Rollen tragen bereits einen Schlüssel (`settings.key`, Formular «Rollen bearbeiten»), System-Rollen sind nicht löschbar | `@casl/ability` + `@casl/angular` wie in ELO (`app.casl.ts`: `AbilityFactory.defineFor(roles)`, `CaslService`; Menü in `admin-menu.service.ts`): Abilities aus den App-Rechten der Session bauen, `@if (can('write', 'usage'))` für Schaltflächen, Menü aus den Rechten, Lese-Modus der Masken (`readonly`-Signal in Schusszahlen ist vorbereitet) |
| Zuordnung Schiessplätze pflegen | 5.26, 8.1.2 W/R-O | nur per Seed (`area_user`) | Benutzerformular: Mehrfachauswahl Schiessplätze (`AreaScopeService.assign`), Endpunkt `admin/user/:id/areas` |
| Session-Claim `areaIds` | Komfort | – | in `me/session` liefern, damit der Wechsler nur eigene Plätze zeigt |
| «Berechnung speichern» (App 47) | 5.10, 5.18–5.21 | Recht vorhanden, kein Endpunkt | mit dem Berechnungs-Import (5.19) |
| AGOV | 8.1 «MFA **oder** AGOV» | 2FA erfüllt die Anforderung; AGOV nicht vorhanden | optional: OIDC-Strategie (passport), Provisionierung per E-Mail, Rolle aus SLIM |
| Login-Logging-Auswertung | `slm 56` | **umgesetzt**: Logbuch `core_log_user` (`core/logger`, Maske «Logbuch»), Audit-Hooks Benutzer/Rollen/Apps (`modules/auth-audit/auth-audit.hooks.ts`) und – mit `@app-galaxy/auth-api` ≥ 0.1.218 – die Auth-Lifecycle-Hooks (`auth-lifecycle.hooks.ts`): `AUTH_LOGIN` (Methode Passwort/PIN/2FA), `AUTH_LOGIN_FAILED` (Grund: invalid-credentials, account-locked, invalid-pin, invalid-code, too-many-attempts, auth-id-mismatch), `AUTH_LOGOUT`, `AUTH_TOKEN_REUSE`, `AUTH_PASSWORD_RESET_REQUESTED`, `AUTH_PASSWORD_CHANGED` (Operation reset/update, Akteur), `AUTH_EMAIL_VERIFIED`; IP und User-Agent aus dem Hook-Kontext, Reset-Token und Hash werden nie geschrieben | Rollen-e2e in `apps/app-e2e/src/criterias/c09-logging-security.spec.ts` (Skelett) |
| Break-Glass-Konto | `slm 56` | organisatorisch; in ELO als Prozess dokumentiert (`docs/compliance/prozess-zugriffsrechte-und-anmeldemittel.md`, Si001) | Prozess übernehmen: versiegeltes Notfallkonto mit galaxy-Admin-Rolle, Verwendung im Logbuch nachweisbar |
| Rollen-e2e | Nachweis | nur API-Tests | Playwright-Fall je Rolle (Interessent → 403 auf Simulation/Erfassen, Verantwortlicher sieht nur Geissalp/Thun) |
| Masken im Design System | UX | ELO-Style-Strings | Templates auf `slim-*` umstellen |

## 6. Referenzen

- B1 Kapitel 4.2 (Akteure), 8.1 (Rollen, Matrix), `slm 35`, `slm 56`
- `apps/api/src/mocks/apps.mapping.ts` (`API_APPS_MAPPING`), `main.mock-data.ts` (App-Katalog), `roles.mock-data.ts` (Rollen-Seed)
- `node_modules/@app-galaxy/core-api/src/common/rules/*` (Rule-Engine, `RulesGuard`, `@Rules`)
- `node_modules/@app-galaxy/auth-api/src/roles/guards/apps-roles.guard.js` (Prüflogik)
- [deployment-sicherheit.md](deployment-sicherheit.md) (Sicherheitsmassnahmen im Code)
