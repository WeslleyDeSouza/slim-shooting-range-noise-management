# Codebase-Abgleich mit dem Anforderungskatalog SLIM

Prüfdatum: **13.09.2026** · Commit: `1c94687d6942c0aef890d515a9bf72edbbe39a35`

**Vertiefung und Korrektur:** Die anschliessende [Prüfung der Fachimplementierung und Tests](fachimplementation-testanalyse-2026-09-13.md) reproduzierte sechs zusätzliche Fachbefunde mit sieben zunächst fehlschlagenden Prüftests. F01–F06 wurden inzwischen korrigiert und als reguläre Regressionen abgesichert. Der Fachbericht enthält den aktuellen Korrekturstand; die folgende Matrix dokumentiert den ursprünglichen Reviewstand.

Der Code enthält einen substanziellen, automatisiert getesteten Fachkern für Nutzungserfassung, Betriebsdaten, Lärmberechnung, Simulation und Zustandsisolation. **Die vollständige Umsetzung des Anforderungskatalogs ist noch nicht erreicht.** Besonders fehlen produktiv bedienbare Stammdaten- und Berechnungsverwaltung, echte GIS-Funktionen, ELO-Anbindung, Dateiimporte, Fachexporte und belastbare Betriebsnachweise. Eine vollständige Produktabnahme lässt sich aus dem aktuellen Repository nicht ableiten.

## 1. Prüfgrundlage und Aussagegrenzen

Geprüft wurden die aktuelle Implementierung in `apps/api`, `apps/app`, `libs/shared/lsv`, relevante Datenmodelle, Controller, Tests und Deployment-Dateien. Die Analyse verändert keinen Anwendungscode. Bereits vorhandene unversionierte Dateien wurden unverändert belassen.

Quellen:

- **Beilage B1 Lösungsanforderungen SLIM**, 97 Seiten: Anforderungen `slm 1–57`, einschliesslich der zugehörigen fachlichen und nichtfunktionalen Festlegungen. Der Original-PDF-Text wurde lokal extrahiert und für den Abgleich verwendet.
- **Beilage A1.1**, Mitwirkungspflichten; **A1.2**, Abnahmevorschrift; **A2**, Vorgaben Lösungskonzept: Originaltexte gelesen.
- [Index](index.md), [Checkliste](checkliste.md), [Umsetzungsstand](umsetzungsstand.md), vorhandene fachliche/technische Validierungen: ergänzende interne Einordnung, **kein eigenständiger Implementierungsnachweis**.
- B1.4-Referenzwerte über die eingecheckten Fixtures und ausgeführten Rechentests. Die Excel-Dateien, VBA-Makros, Word-Dokumente und sämtliche Geodatenstrukturen wurden in diesem Review **nicht unabhängig vollständig neu validiert**. Keine neue rechtliche Prüfung von B1.1/B1.2; kein Abgleich mit neueren externen Vergabeunterlagen oder FAQ-Antworten.

Dies ist ein Code- und Testreview mit vollständiger Zuordnung der 57 IDs, keine erschöpfende Prüfung jedes Fliesstextdetails und keine formelle Abnahme. Produktivhosting, Verträge, tatsächliche MFA-Konfiguration, externe Infrastruktur und Fachfreigaben sind daraus nicht nachgewiesen. Ein fehlender Nachweis im Repository bedeutet bei Betriebsleistungen nicht zwangsläufig, dass die Leistung ausserhalb des Repositorys fehlt.

Status in der Matrix:

| Status | Bedeutung |
|---|---|
| K | Kernfunktion im untersuchten Umfang implementiert und durch ausgeführte Unit-/Service-Tests gestützt; keine vollständige Abnahme. |
| T | Teilweise implementiert; relevante Pflichtbestandteile oder Nachweise fehlen. |
| F | Geforderte Funktion im untersuchten SLIM-Code nicht implementiert bzw. nur als Platzhalter vorhanden. |
| O | Optionale Funktion aus Kapitel 11, in SLIM nicht implementiert. Nicht als offene Grundpflicht gezählt. |
| N | Erfüllung mit dieser Prüfung nicht nachgewiesen, insbesondere für Betriebs-/Qualitätsanforderungen. |

Bewusst keine Prozentzahl zur Gesamterfüllung: Eine umfangreiche GIS-Anforderung, eine Navigationsfunktion und ein Betriebsnachweis haben sehr unterschiedliche Tragweite.

## 2. Aktuell ausgeführte Prüfungen

| Prüfung | Ergebnis am 13.09.2026 | Aussage |
|---|---|---|
| `npx --no-install vitest run --config apps/api/vitest.config.mts` | **24 Dateien, 246 Tests bestanden**, 61,68 s | API-, Service-, Datenmodell- und gemeinsame Rechentests laut Include-Konfiguration. |
| `npx --no-install jest --config apps/app/jest.config.ts --runInBand` | **11 Suiten, 73 Tests bestanden**, 31,525 s | Angular-Komponenten und Facades; Hinweis von ts-jest zu `esModuleInterop`, kein Testfehler. |
| Kleine Node-Prüfung mit installiertem `class-validator` | Fehlende und explizit `null` gesetzte Zahlenfelder ergeben mit den global verwendeten Skip-Optionen jeweils **0 Validierungsfehler**. | Bestätigt Befund B01 auf Validator-Ebene; kein vollständiger HTTP-Test. |
| Node-Datumsprüfung | `Date.parse('2026-02-30')` ergibt einen gültigen Zeitstempel. | Bestätigt, dass die im Service verwendete Prüfung ungültige Kalendertage nicht zuverlässig zurückweist. |
| Statische Testinventur | **57 `test.fixme`-Vorkommen** in `criterias`, **80** in `actors` | Testgerüste sind vorhanden, aber keine bestandenen Akzeptanztests. |

**Nicht ausgeführt:** Playwright, Produktionsbuild, Lint, PostgreSQL-Boot-/Migrationstest, GDAL-/FGDB-Roundtrip, Lasttest mit zehn Benutzern, Restore-Test, manuelle Browser-/Barrierefreiheitsprüfung. Die beiden erfolgreichen Testläufe sind kein Nachweis für diese Bereiche. Frühere Testergebnisse werden nicht als neu ausgeführte Prüfungen ausgegeben.

## 3. Wesentliche Befunde und konkrete Risiken

### B01 – Pflichtfeld- und Fachvalidierung hat Lücken

**Priorität: hoch · slm 10, 29, 30, 47/48 bei Umsetzung der Option**

[main.ts](../../apps/api/src/main.ts) aktiviert global `skipUndefinedProperties: true` und `skipNullProperties: true`. Dadurch erzwingen viele Validatoren in [usage.dto.ts](../../apps/api/src/modules/usage/dto/usage.dto.ts) Pflichtfelder nicht zuverlässig. Beispiel: Eine Position ohne `quantity` bzw. mit `quantity: null` besteht die isoliert nachgestellte Kombination aus `IsNumber` und `IsPositive` mit diesen Optionen. Eine spätere Datenbankablehnung ersetzt keine definierte 400-Validierungsantwort.

Weitere direkt sichtbare Lücken in [UsageService.validate](../../apps/api/src/modules/usage/usage.service.ts):

- Datumsregex und `Date.parse` akzeptieren normalisierte, ungültige Kalendertage wie `2026-02-30`.
- `quantityUnit` kann vom Client vorgegeben werden und wird nicht gegen die Einheit des Kalibers geprüft. Damit lässt sich beispielsweise eine Sprengstoffmenge als Stück kennzeichnen.
- Die Freigabe des Schiessplatzes selbst wird beim Erfassen nicht geprüft; geprüft wird die Aktivität des Stellungsraums und seiner Zuordnung. Die Prüfung der globalen Erfassungssperre fehlt ebenfalls.
- `personCount` ist optional. Das Feld ist inzwischen vorhanden, erfüllt damit aber noch keinen verpflichtenden ELO-Eingabevertrag.

**Nächster Nachweis:** HTTP-Negativtests für fehlende/null Pflichtfelder, unmögliche Daten, falsche Mengeneinheit, inaktiven Platz und Sperrdatum. Create-Validierung strikt machen; optionale PATCH-Felder separat behandeln.

### B02 – Speichern von Nutzungen und Positionen ist nicht atomar

**Priorität: hoch · slm 10; Voraussetzung für zuverlässige ELO-Übernahme**

[UsageService.create/update](../../apps/api/src/modules/usage/usage.service.ts) schreibt den Nutzungskopf und die Positionen in getrennten Repository-Aufrufen ohne gemeinsame Transaktion. Beim Positionswechsel wird erst gelöscht und danach neu gespeichert. Scheitert das zweite Schreiben, kann ein Nutzungskopf ohne Positionen bzw. eine teilweise Änderung verbleiben. Ein anschliessender Fehler bei der Ampelaktualisierung kann eine Fehlerantwort auslösen, obwohl die Nutzungsänderung bereits gespeichert ist.

Die `externalId`-Prüfung besteht aus Lesen und anschliessendem Schreiben. [AreaUsageEntity](../../apps/api/src/modules/usage/entities/area-usage.entity.ts) besitzt keinen Unique-Constraint auf die externe Identität. Parallele Wiederholungen können somit doppelte Nutzungen erzeugen. Das ist ein Integritätsrisiko der vorgesehenen Idempotenz, keine zusätzliche wörtliche B1-Pflicht.

**Nächster Nachweis:** Fehler zwischen Kopf-/Positionsschreiben injizieren; parallele Requests mit derselben externen ID prüfen. Kopf und Positionen transaktional schreiben, Idempotenz auf Datenbankebene absichern und Fehler-/Wiederholungssemantik festlegen.

### B03 – Ampeln sind berechnet, können aber beim Jahreswechsel veralten

**Priorität: hoch · slm 8, 34, 54**

[AreaStatusService](../../apps/api/src/modules/calculation/area-status.service.ts) berechnet beide Ampeln aus Nutzungen, Kontingenten und Beurteilung und speichert sie als Cache. Der ältere Befund «nur Seed-Ampeln» trifft damit nicht mehr zu.

Allerdings überspringt [CalculationModule.onApplicationBootstrap](../../apps/api/src/modules/calculation/calculation.module.ts) die Aktualisierung bei `APP_ENV === 'production'`. Eine periodische Aktualisierung oder eine Prüfung auf veraltetes `statusYear` beim Lesen wurde nicht gefunden. Ohne Mutation können die Ampeln nach dem Jahreswechsel weiterhin die Vorjahresbasis zeigen; auch ein Produktionsneustart erzwingt hier keine Korrektur.

**Nächster Nachweis:** Uhrwechsel 31.12. → 01.01. ohne Datenänderung, inklusive Produktionskonfiguration. Cache bei veraltetem Berechnungsjahr invalidieren bzw. terminierte Neuberechnung einführen.

### B04 – «Genau ein Zustand» ist nur teilweise abgesichert

**Priorität: hoch · slm 18; Auswirkung auf slm 12**

[AreaCalculationEntity](../../apps/api/src/modules/calculation/entities/area-calculation.entity.ts) hat eindeutige Marker-Indizes; [CalculationService.setPointer](../../apps/api/src/modules/calculation/calculation.service.ts) wechselt Zeiger transaktional. Damit wird über diesen Pfad **höchstens ein** aktueller/MGDM-Zustand abgesichert.

[ImportService](../../apps/api/src/modules/calculation/import.service.ts) erlaubt aber den Import ohne beide Flags. Bei einem ersten Import können daher null aktuelle bzw. null MGDM-Zustände entstehen. `CalculationService.resolve` verwendet dann den letzten Zustand als `current`, obwohl dieser nicht als aktuell markiert ist. Die Übersichtsampel prüft das Flag zusätzlich, andere Aufrufer verwenden den aufgelösten Zustand. Das erzeugt unterschiedliche Bedeutungen von «aktuell».

**Nächster Nachweis:** Erster Import ohne Flags; anschliessend Übersicht, Details und Simulation vergleichen. Erstimportregel festlegen und einen nicht freigegebenen Fallback in der API klar vom aktuellen Zustand unterscheiden.

### B05 – Zentrale Fachmasken und GIS fehlen

**Priorität: hoch · slm 1–3, 9, 14–25, 27**

[admin.routes.ts](../../apps/app/src/app/views/admin/admin.routes.ts) bindet die Schiessplatz-Detailübersicht, Stammdaten, Waffenzuordnung, Berechnungsverwaltung, Waffen/Kaliber/Kategorien und Systemkonfiguration an `PlaceholderComponent`. Die vorhandenen Entities und API-Teilfunktionen machen diese Masken noch nicht bedienbar.

Details und Simulation enthalten schematische SVG-Karten: [Details](../../apps/app/src/app/views/admin/area/details/area-details.component.html), [Simulation](../../apps/app/src/app/views/admin/area/simulation/area-simulation.component.html). Es fehlen ein realer GIS-Viewer, swisstopo-Hintergrundkarten, georeferenzierte Navigation, Massstab und Karten-PDF. Der Exportknopf der [Schusszahlenmaske](../../apps/app/src/app/views/admin/area/shots/area-shots.component.html) ist deaktiviert.

**Nächster Nachweis:** Vollständige Benutzerabläufe pro Maske einschliesslich Lesen/Schreiben nach Rolle; echte LV95-Daten und Kartenexport prüfen.

### B06 – Importservice ist noch keine Datei- oder ELO-Schnittstelle

**Priorität: hoch · slm 19, 20, 28–30, 36–41**

Der [Berechnungscontroller](../../apps/api/src/modules/calculation/controllers/admin-calculation.controller.ts) nimmt strukturierte JSON-Daten für einen Zustand entgegen. [ImportService](../../apps/api/src/modules/calculation/import.service.ts) validiert Referenzen und schreibt transaktional. FGDB-, WLR- und Betriebsdaten-Dateiparser sowie Uploadmasken wurden nicht gefunden. Ebenso fehlen der B1.6-Excel-Nutzungsimport und die geforderten Fachexporte.

Die vorhandenen [Admin-Nutzungsendpunkte](../../apps/api/src/modules/usage/controllers/admin-usage.controller.ts) verwenden interne UUIDs und Sitzungs-/Mandanten-/Replay-Guards. Ein dokumentierter, implementierter ELO-Vertrag für Anlageninformationen und Nutzungsübernahme ist damit noch nicht vorhanden. `source = 'elo'`, `externalId` und ein ähnliches Datenmodell belegen keine Integration. Funktionen eines benachbarten ELO-Repositories wurden nicht als SLIM-Implementierung angerechnet.

**Nächster Nachweis:** Reale Eingabedateien importieren und wieder exportieren; Summen, Identitäten, Geometrien und Fehlerprotokolle vergleichen. ELO-Vertrag mit Maschinenzugriff, Mapping und definierten synchronen Antworten implementieren und Ende-zu-Ende prüfen.

### B07 – Rechteprüfung im Backend vorhanden, UI und MFA-Nachweis unvollständig

**Priorität: hoch · slm 6, 26, 35, 50, 56**

Controller verwenden Auth-, Mandanten-, App-Rechte- und Bereichsprüfungen. [AreaScopeService](../../apps/api/src/modules/area/scope/area-scope.service.ts) begrenzt eigene Schiessplätze; zugehörige Service-Tests bestehen. Das Menü berücksichtigt [AccessFacade](../../apps/app/src/app/core/access/access.facade.ts).

In [AreaShotsComponent](../../apps/app/src/app/views/admin/area/shots/area-shots.component.ts) steht der Lesemodus hingegen fest auf `signal(false)`. Lesende Benutzer erhalten dadurch schreibende Bedienelemente, auch wenn die API die Mutation verweigert. Der oberste [Router-Guard](../../apps/app/src/app/app.routes.ts) prüft lediglich die Sitzung; die vollständige fachliche Sichtbarkeit bei direkten URLs ist damit nicht belegt. Das ist kein nachgewiesener Backend-Berechtigungsdurchbruch.

Die installierte Auth-Bibliothek aktiviert 2FA abhängig von `API_AUTH_2FA_ENABLED` bzw. `APP_AUTH_2FA_ENABLED`; `.env.example` setzt diese nicht. Eine 2FA-Seite allein belegt keine erzwungene MFA. Die tatsächliche Laufzeitkonfiguration wurde nicht als Produktionsnachweis geprüft. Ein getesteter Break-Glass-Ablauf sowie eine bedienbare Platzzuordnung im Benutzerformular fehlen als Nachweis.

**Nächster Nachweis:** Rollenmatrix als HTTP- und Browsertests, direkte URLs, verbotene Mutationen, verbindlicher MFA-Anmeldepfad und geprüfter Notfallzugang.

### B08 – Geodatenbank, Produktion und Betrieb sind nicht fertig nachgewiesen

**Priorität: hoch · slm 38, 54, 57**

[StateObjectEntity](../../apps/api/src/modules/calculation/entities/state-object.entity.ts) speichert Geometrien als Text. Das ist kein Nachweis einer räumlichen Datenbank mit SRID-/Geometrievalidierung. Externe MGDM-/ImmoGIS-Views wurden nicht gefunden. Der früher dokumentierte PostgreSQL-Bootblocker wurde hier nicht erneut ausgeführt; er darf weder als behoben noch als neu reproduziert gelten. [AppModule](../../apps/api/src/app.module.ts) setzt zudem `ssl: false`; eine verschlüsselte externe Datenbankanbindung ist damit nicht belegt.

[dockerfile](../../dockerfile) kopiert Frontend-Dateien, [ecosystem.config.js](../../ecosystem.config.js) startet jedoch nur die API. In `main.ts` und `AppModule` ist kein Frontend-Static-Serving registriert. Ein externer Webserver kann dies lösen, ist im untersuchten Auslieferungspfad aber nicht nachgewiesen.

Die Fachberechnung läuft synchron im API-Prozess. Worker-Isolation, Fortschritt/Abbruch und Antwortzeiten unter zehn parallelen Benutzern sind nicht belegt. Ein installierter Datenbankclient im Image ersetzt keinen überwachten Backupablauf. Automatisierte Backup-Alarme, Integritätsprüfungen, zwölf Monate Wiederherstellbarkeit und jährliche Restore-Protokolle wurden nicht als ausführbare Betriebsnachweise gefunden.

**Nächster Nachweis:** Produktionsimage mit UI/API ausliefern, räumliche Zieldatenbank samt Migrationen testen, vollständigen Lasttest sowie Backup-/Fehleralarm-/Restore-Übung protokollieren.

## 4. Anforderungsmatrix slm 1–57

Die Nachweiskürzel verweisen auf die unten verlinkten Codepfade. Status K gilt für den genannten Kernumfang; Querschnittslücken bleiben zusätzlich massgebend.

| ID | Anforderung, verkürzt | Status | Codebeleg und verbleibende Arbeit |
|---|---|---|---|
| slm 1 | Auswahllisten administrativ pflegen | F | R/M: Datenmodelle vorhanden, fachliche Pflegeoberflächen fehlen. |
| slm 2 | GIS-Viewer, LV95, Hintergründe, PDF | F | UI: SVG-Schema statt GIS; B05. |
| slm 3 | Einheitliche Tabellenfunktionen und Export | T | UI: Suche, Sortierung, Selektion in Fachseiten; Export und vollständige Filterparität fehlen. |
| slm 4 | Nutzbar ohne Berechnungsgrundlage | K | U/A/S: Nutzungen unabhängig vom Zustand; fehlende Grundlage als eigener Status. Fehlende Masken bleiben davon unberührt. |
| slm 5 | Direkte URL für jede fachliche Entität | T | R: Platz-/Benutzer-Routen vorhanden; nicht jede fachliche Entität hat eine eigene Detail-URL. |
| slm 6 | Berechtigungen bei URL-Aufruf | T | G: Serverprüfungen vorhanden und teilweise getestet; vollständiger Browser-/Deep-Link-Nachweis offen. |
| slm 7 | Startseite mit Einstiegspunkten | K | H/R: Startseite und Navigation vorhanden; Jest-Suite erfolgreich. |
| slm 8 | Berechtigte Plätze mit zwei Ampeln | T | S/G/UI: berechnete Ampeln und Bereichsfilter; Cache-Aktualität B03 offen. |
| slm 9 | Detailübersicht mit Kontingenten/Karte | F | R: Übersicht des einzelnen Platzes ist Platzhalter. |
| slm 10 | Nutzungen anzeigen, filtern, CRUD | T | U/UI: wesentliche Funktionen vorhanden; Validierung/Atomarität und Lesemodus B01/B02/B07. |
| slm 11 | Empfangspunktdetails gegen Grenzwerte | T | A/UI: A7/A9-Auswertung und Detailanzeige; GIS und vollständige Bedienung der Periodenwahl fehlen. |
| slm 12 | Hypothetische Schusszahlen simulieren | T | SIM/UI: A9-Simulation getestet; GIS, Berechtigungs-UX und eindeutige aktuelle Grundlage B04 offen. |
| slm 13 | Datenverwaltungsübersicht mit Navigation | T | R/UI: Übersicht vorhanden, Zielmasken überwiegend Platzhalter. |
| slm 14 | Allgemeine Platzdetails lesen | F | R/M: Daten vorhanden, geforderte Maske fehlt. |
| slm 15 | Stellungsräume mit Suche anzeigen | T | U/UI: Räume in Erfassung sichtbar; dedizierte Tabelle in Allgemein fehlt. |
| slm 16 | Platzstammdaten und Kontingente pflegen | T | M: Entity-/API-Grundlagen; vollständige Pflege inklusive Kontingenten fehlt. |
| slm 17 | Waffen/Kaliber je Raum zuordnen | T | M/U: Zuordnung modelliert und bei Erfassung geprüft; Pflegeworkflow fehlt. |
| slm 18 | Berechnungen/Zustände und zwei Zeiger | T | C/I: API und Constraints vorhanden; Verwaltungsmaske sowie Existenzregel B04 offen. |
| slm 19 | GDB/WLR/Betriebsdaten importieren | T | I: JSON-Staging und Strukturvalidierung; geforderte Dateiverarbeitung und UI fehlen. |
| slm 20 | Zustände als GeoDB, Nutzungen als CSV | F | R: Exportplatzhalter, keine entsprechende Fachpipeline. |
| slm 21 | WLR-/Betriebsdetails je Raum lesen | T | C/A: Daten und abgeleitete Betriebsdaten vorhanden; geforderte WLR-DAY/NIGHT-Maske fehlt. |
| slm 22 | Kombinationen mit sonARMS-Zuordnung | T | M/I: Modell und Importzuordnung vorhanden; Verwaltung fehlt. |
| slm 23 | Kaliber mit Übersetzungen, ALN/SAP | T | M/R: Entity vorhanden, Maske Platzhalter. |
| slm 24 | Waffen mit A7-Kategorie verwalten | T | M/R: Entity und Berechnungsbezug vorhanden, Maske fehlt. |
| slm 25 | Waffenkategorien verwalten | T | M/R: Entity vorhanden, Maske fehlt. |
| slm 26 | Benutzer-/Rollen-/Platzrechte pflegen | T | G/R: Benutzer und Rollen vorhanden; Platzzuordnung und vollständiger Rollenworkflow offen. |
| slm 27 | Sperrdatum, Handbuch, Ampelkonfiguration | F | R: Systemkonfiguration ist Platzhalter; keine durchgängige fachliche Konfiguration. |
| slm 28 | ELO-Anlageninformationen bereitstellen | F | U/M sind Bausteine; kein implementierter ELO-Vertrag, B06. |
| slm 29 | ELO-Nutzungen entgegennehmen | T | U: Erfassung, Felder und externe ID vorbereitet; ELO-Endpunkt/Mapping fehlen. |
| slm 30 | Technischer ELO-Vertrag und Validierung | T | U: JSON-API und Viertelstundenvalidator; TLS-/Maschinenintegration und strikte Validierung offen. |
| slm 31 | LSV-Betriebsdaten aus Nutzungen | K | L/A: Werktag-/Feiertagssplit, A7-Halbtage, Dezimalmengen, repräsentative Jahre im Backend getestet. |
| slm 32 | Mengen auf Schusslinien verteilen | K | L/A: `distributeShots` tatsächlich angebunden; Zustandsgewichte und Unvollständigkeitsregeln getestet. |
| slm 33 | A7/A9-Pegel dynamisch berechnen | K | L/A: Referenz- und Service-Tests bestehen; E8-Fachfreigabe und reale Importkette bleiben offen. |
| slm 34 | Grenzwertvergleich/Farbkennzeichnung | T | L/A/S: Rundung, Baujahre und Farben getestet; GIS und dauerhaft aktuelle Übersicht offen. |
| slm 35 | Vier Rollen und MFA/AGOV | T | G: Rollen/Scope vorhanden; obligatorischer MFA-Betrieb nicht nachgewiesen. |
| slm 36 | Vollständiger initialer Stammdatenimport | T | M/Seed: Demo- und Waffenstammdaten vorhanden; vollständiger Importprozess aus CSV/DB nicht belegt. |
| slm 37 | Excel-Schusszahlenimport B1.6 | F | Kein fachlicher Excel-Import gefunden. ExcelJS-Abhängigkeit allein genügt nicht. |
| slm 38 | Geodatenbank und externe Views | T | M/C: relationale Struktur; Geometrien als Text, Views und produktiver räumlicher Betrieb fehlen als Nachweis. |
| slm 39 | Weiterverarbeitbare Exporte, mindestens CSV | T | Logbuch-XLSX vorhanden; geforderte Fach-/CSV-Exporte fehlen. |
| slm 40 | Vollständiger Nutzungsexport | F | U/UI: Daten vorhanden, vollständiger Export im vorgegebenen Format fehlt. |
| slm 41 | Gesamtstatistik mit Status/Überschreitungen | F | Kein entsprechender Export gefunden. |
| slm 42 | Zeitunabhängiger Platz mit Räumen/Zuständen | K | M/C: Referenzstruktur und 1:n-Beziehungen vorhanden; Isolations-/Service-Tests bestehen. |
| slm 43 | Berechnungsdaten vollständig zustandsbezogen | K | C: Zustandsentities und Composite-FKs, Isolationstests erfolgreich; reale FGDB-Vollständigkeit separat prüfen. |
| slm 44 | Nutzungen unabhängig von Berechnungen | K | U/A/C: kein Zustands-FK an Nutzung, Kombination mit verschiedenen Zuständen getestet. |
| slm 45 | Unbekannte Räume führen zu Importabbruch | K | I: Staging-Befunde und transaktionaler Abbruch im JSON-Import getestet; Dateiparser bleibt slm 19. |
| slm 46 | Optionaler QR-Einstieg | O | Keine öffentliche SLIM-Erfassungsroute vorhanden. |
| slm 47 | Optionale mobile Erfassungsmaske | O | Admin-Erfassung ist kein öffentlicher QR-Workflow. |
| slm 48 | Optionale Offline-Erfassung/Bestätigung | O | Keine durchgängige Offline-Nutzungswarteschlange gefunden; PWA-Cache genügt nicht. |
| slm 49 | Optionale kryptografische QR-Signatur | O | Kein entsprechender SLIM-Pfad gefunden. |
| slm 50 | Einheitliche rollenabhängige UI, Persistenz | T | UI/G: Designsystem, Menürechte und lokale Speicherung; Lesemodus, Benutzerpersistenz und Tabellenstandard offen. |
| slm 51 | DE/FR/IT, Formate, Erweiterbarkeit | T | Locale-Dateien und Sprachumschaltung vorhanden; vollständige Sprach-/Formatprüfung und lokalisierte Berichte fehlen. Deutsche DB-Spalten noch nicht durchgängig. |
| slm 52 | Ergonomie/Selbstbeschreibung | N | Designsystem vorhanden; keine systematische Usability-/Barrierefreiheitsabnahme in diesem Review. |
| slm 53 | Online-/PDF-Handbuch, kontextsensitive Hilfe | F | Entwicklerdokumentation vorhanden; vollständiges integriertes Benutzerhandbuch und ≤2-s-Hilfe fehlen als Produktfunktion. |
| slm 54 | Antwortzeiten, zehn Benutzer, Isolation | T | Tests und Cache vorhanden; isolierte Worker und repräsentativer Last-/Antwortzeitnachweis fehlen. |
| slm 55 | Modularität und Fachkonfiguration | T | Services/Facades/LSV-Bibliothek klar getrennt; administrative Fachparameter nicht durchgängig ohne Rebuild änderbar. |
| slm 56 | MFA, Rollen, Login-Logging, Break-Glass | T | G: Auth-Audit und Rollen vorhanden; MFA-Erzwingung und Notfallzugang nicht vollständig belegt. |
| slm 57 | Überwachte Backups mit Alarmierung | N | Keine ausführbare vollständige Überwachungs-/Restorekette gefunden; externe Betriebsnachweise anfordern. |

### Codebelege zur Matrix

| Kürzel | Pfade |
|---|---|
| R | [Admin-Routen und Platzhalter](../../apps/app/src/app/views/admin/admin.routes.ts), [oberste Routen](../../apps/app/src/app/app.routes.ts) |
| H | [Startseite](../../apps/app/src/app/views/admin/home/home.component.ts) |
| UI | [Platzübersicht](../../apps/app/src/app/views/admin/area/area-overview.component.ts), [Schusszahlen](../../apps/app/src/app/views/admin/area/shots/area-shots.component.ts), [Details](../../apps/app/src/app/views/admin/area/details/area-details.component.ts), [Simulation](../../apps/app/src/app/views/admin/area/simulation/area-simulation.component.ts), [Datenverwaltungsübersicht](../../apps/app/src/app/views/admin/data-management/area/dm-area-overview.component.ts) |
| U | [Nutzungsservice](../../apps/api/src/modules/usage/usage.service.ts), [DTOs](../../apps/api/src/modules/usage/dto/usage.dto.ts), [Tests](../../apps/api/src/modules/usage/usage.service.spec.ts) |
| M | [Referenzentities](../../apps/api/src/modules/area/entities), [Platzservice](../../apps/api/src/modules/area/area.service.ts), [Seed](../../apps/api/src/mocks/tenant/demo-dataset.seed.ts) |
| A | [Assessment](../../apps/api/src/modules/calculation/assessment.service.ts), [Betriebsdaten/Verteilung](../../apps/api/src/modules/calculation/operating-data.ts), [Rechenfälle](../../apps/api/src/modules/calculation/rechenfaelle.spec.ts) |
| SIM | [Simulationsservice](../../apps/api/src/modules/calculation/simulation.service.ts), [Simulationstests](../../apps/api/src/modules/calculation/simulation.service.spec.ts) |
| S | [Ampelservice](../../apps/api/src/modules/calculation/area-status.service.ts), [Tests](../../apps/api/src/modules/calculation/area-status.service.spec.ts) |
| C | [Zustandsservice](../../apps/api/src/modules/calculation/calculation.service.ts), [Entities](../../apps/api/src/modules/calculation/entities), [Berechnungsläufe](../../apps/api/src/modules/calculation/calculation-run.service.ts), [Isolationstests](../../apps/api/src/modules/calculation/state-isolation.spec.ts) |
| I | [Importservice](../../apps/api/src/modules/calculation/import.service.ts), [Import-DTOs](../../apps/api/src/modules/calculation/dto/import.dto.ts), [Controller](../../apps/api/src/modules/calculation/controllers/admin-calculation.controller.ts) |
| L | [LSV-Kern und Tests](../../libs/shared/lsv/src/lib), [B1.4-Fixture](../../libs/shared/lsv/src/lib/fixtures/b14-demo.fixture.ts) |
| G | [Platzrechte](../../apps/api/src/modules/area/scope/area-scope.service.ts), [Scope-Tests](../../apps/api/src/modules/area/scope/area-scope.spec.ts), [Rollen-Seed](../../apps/api/src/mocks/roles.mock-data.ts), [Auth-Audit](../../apps/api/src/modules/auth-audit), [Frontend-Rechte](../../apps/app/src/app/core/access/access.facade.ts) |

## 5. Was sich gegenüber älteren internen Bewertungen geändert hat

Die [Checkliste](checkliste.md) enthält noch Befunde aus unterschiedlichen Entwicklungsständen. Folgende frühere Pauschalaussagen sind am geprüften Commit überholt:

| Älterer Befund | Aktueller Codebefund |
|---|---|
| A7-Halbtagsgrenze 13:00 | `ANNEX7_NOON_MINUTE = 12 * 60`; korrigiert und getestet. |
| Feiertage nur im Kernel | `AssessmentService.reference` lädt lokale/globale Feiertage; `calendarOf` reicht sie in die Betriebsdatenberechnung weiter. |
| Gemischte Baujahre verwenden alle A7-Halbtage | `assessModel` bildet `newRooms` und `annex7HalfDaysOf(newRooms)` für die Teilbetrachtung. |
| Quellenverteilung nicht angebunden | `operating-data.ts` ruft `distributeShots` auf; fehlende Quellen/Gewichte/Pegel werden weitergegeben. |
| Viertelstunden, Personen und zivile Nutzungsart fehlen | Felder und Viertelstundenvalidator sind vorhanden. Die verbleibenden Validierungslücken stehen in B01. |
| Ampeln nur aus Seed; fehlendes Kontingent ergibt immer keine Daten | `AreaStatusService` berechnet Ampeln; beschossene Kombination ohne Kontingent wird mit Soll 0 beurteilt. Aktualitätslücke B03 bleibt. |
| Zustandsbezogenes Modell fehlt | Zustandsstruktur, Composite-FKs und gespeicherte Berechnungsläufe sind implementiert und getestet. |
| Repräsentative Jahre fehlen generell | Backend unterstützt `years`; die [AssessmentFacade](../../apps/app/src/app/core/calculation/assessment.facade.ts) bietet weiterhin nur Zustand und `from/to`. UI-Auswahl fehlt. |
| Menü vollständig statisch | Menü filtert nach Rechten; Schreibaktionen in der Schusszahlenmaske sind noch nicht korrekt rollenabhängig. |

Auch [umsetzungsstand.md](umsetzungsstand.md) ist intern nicht vollständig konsistent: Es beschreibt berechnete Ampeln und nennt später noch Ampeln «aus Seed». Seine pauschale Formulierung «genau ein» ist auf den tatsächlichen Zeigerpfad zu begrenzen, siehe B04. Ein Dokumentationsabgleich sollte diese Widersprüche beseitigen, ohne offene Funktionen als fertig zu deklarieren.

## 6. Abnahme und ergänzende Beilagen

**A1.1:** Die Bestellerin wirkt bei Testdaten, Fachkonzept, Migration, Handbuch und Abnahmen mit. Für reale Geo-/Betriebsdaten und fachliche Sonderfälle müssen geeignete Referenzdaten und bestätigte Soll-Ergebnisse vereinbart werden. Die synthetischen Tests sind eine gute Grundlage, ersetzen diese Mitwirkung aber nicht.

**A1.2:** Gefordert sind nachvollziehbare Iterationsabnahmen auf dem Akzeptanzsystem und ein vollständiges Schlussabnahmeprotokoll. Die [Kriteriengerüste](../../apps/app-e2e/src/criterias) und [Akteurtests](../../apps/app-e2e/src/actors) beschreiben viele Abläufe, bestehen aber überwiegend aus `test.fixme`. Sie sind weder ausgeführte Nachweise noch Abnahmeentscheidungen. Die vorhandene [Protokollvorlage](../../apps/app-e2e/src/actors/fachablaeufe/protokoll-vorlage.md) muss mit echten Ergebnissen und Belegen gefüllt werden.

**A2:** Architektur, Sicherheit, Deployment, Schnittstellen, Berechnung und UX sind im Code und in der Konzeptdokumentation unterschiedlich weit. Aussagen im Lösungskonzept sollten konsequent zwischen Ist-Stand, geplanter Umsetzung und externer Fach-/Betriebsfreigabe unterscheiden. Das Seitenlimit und die gerenderte Word-/PDF-Fassung wurden in dieser Codeanalyse nicht erneut geprüft.

**Rechenreferenz E8:** Die ausgeführten A7-Tests legen bewusst 28,0 dB für E8 fest und lassen leere Kategorien aus der energetischen Summe. Das belegt die implementierte Variante, keine Bestätigung sämtlicher Excel-/sonARMS-Varianten durch die Fachstelle. Diese Entscheidung weiterhin explizit dokumentieren.

## 7. Empfohlene Reihenfolge der Umsetzung

| Reihenfolge | Arbeitspaket | Fertigkriterium |
|---|---|---|
| 1 | Datenintegrität und eindeutige Zustände | B01/B02/B04 behoben; HTTP-Negativ-, Transaktions- und Parallelitätstests grün. |
| 2 | Rollen, MFA und Ampelaktualität | Lesemodus aus Rechten, verbindlicher MFA-Pfad, geprüfte direkte URLs, Jahreswechseltest und aktueller Cache auch in Produktion. |
| 3 | Stammdaten und erweiterte Konfiguration | slm 1, 14–17, 22–27 vollständig bedienbar, einschliesslich Sperrdatum und Platzzuordnung. |
| 4 | Reale Ein-/Ausgabekette | ELO-Vertrag, B1.6-Import, FGDB/WLR/Betriebsdatenimport und Fach-/CSV-/GeoDB-Exporte mit realen Referenzdaten geprüft. |
| 5 | GIS und vollständige Fachseiten | slm 2/9/11/12 inklusive realer Karte, Kontingenttabelle, Perioden-/Jahresauswahl und Kartenexport. |
| 6 | Produktivbetrieb und Abnahme | Frontend-Auslieferung, räumliche DB/Migrationen/Views, Lasttest, Backupalarm/Restore, Benutzerhandbuch und protokollierte Akzeptanztests. |
| Separat | Option slm 46–49 | Nur im vereinbarten Optionsumfang: öffentlicher QR-Workflow, Offlineübertragung und Signatur. |

Der nächste belastbare Meilenstein ist eine geprüfte Kette aus realem Import, Nutzungserfassung, Zustandswahl, Berechnung, GIS-Anzeige und vollständigem Export mit klaren Rollen. Der bereits erfolgreiche Fachkern kann dafür weiterverwendet werden; die bestehenden Testzahlen allein decken diese Kette noch nicht ab.
