# Fachliche Validierung des Prototyps gegen Beilage B1

**Stand:** 12.09.2026 · **Geprüft gegen:** Beilage B1 (Kap. 5–10), B1.1 LSV (Anhang 7 und 9), B1.2 Projekthandbuch
(Kap. 10.4), B1.4 Excel (Blätter A9X/A7X, OpData) · **Geprüfter Code:** `libs/shared/lsv`,
`apps/api/src/modules/{area,usage,calculation}`, `apps/app/src/app/views/admin/area/*`, Seed `tenant.mock.json`.
**Methode:** Originaltext der Beilagen gelesen (PDF-Extraktion, Excel-Formeln mit openpyxl), Code entlang der Kette
Kernel → Service → DTO → Oberfläche verfolgt, Testsuite frisch ausgeführt (Vitest 197/197 grün, Jest grün, Lint grün;
Playwright nicht ausgeführt). Grüne Tests belegen nur, was die Tests prüfen – Abschnitt 3 zeigt, wo die Kette trotz
grüner Tests von der B1 abweicht.

## 1. Gesamturteil

Der fachliche Kernablauf «Nutzungen → Betriebsdaten (7.4) → Beurteilungspegel (7.6) → Grenzwertvergleich (7.7) →
Ampel → Simulation» ist umgesetzt und reproduziert die Kontrollwerte aus B1.4. Gegen die Originaltexte gibt es
**sieben fachliche Abweichungen** (Abschnitt 4), davon zwei mit Einfluss auf berechnete Pegel (Halbtagsgrenze,
gemischte Baujahre bei Anhang 7), und eine Inkonsistenz im Demo-Datensatz (Ampeln ohne Berechnungsgrundlage).
Die in `umsetzungsstand.md` ausgewiesenen Lücken (ELO-Schnittstelle, Datenverwaltung, Import/Export, GIS) sind
korrekt ausgewiesen.

## 2. Verifiziert korrekt

| Thema | B1 / LSV | Befund im Code |
|---|---|---|
| Formeln Anhang 9 | B1 7.6.2, B1.4 A9X, LSV Anh. 9 Ziff. 31 (K1 = 5, K2 = 15, T = 52·5·12·3600) | `annex9.ts` identisch; 12 Empfangspunkte als Tests |
| Formeln Anhang 7 | B1 7.6.1, B1.4 A7X: `Lri = Li + 10·log(Wh + 3·Sh) + 3·log ΣM − 44`, `Lr = ESM(Lri)` | `annex7.ts` identisch (Excel-Formel in Zelle L2 nachgelesen); leere Kategorien ausgelassen, E8-Sonderfall dokumentiert |
| Grenzwerte Anhang 7 | LSV Anh. 7 Ziff. 2 | `ANNEX7_LIMITS` stimmt (PW/IGW/AW je ES) |
| Baujahr-Regel | B1 7.7: vor 1985 IGW, nach 1985 PW, gemischt beides | `applicableLimits`, `toAssessment` |
| Rundung vor Grenzwertvergleich | B1.2 Kap. 10.4: «mathematisch auf ganze Zahlen» | `noiseState` mit `whole` (60.4 → 60, 60.5 → 61), Anzeige eine Dezimale |
| Ampel Lärm | B1 5.10/7.7: rot > GW, orange > GW − 5, sonst grün; Aggregation rot vor orange vor grün | `noiseState`, `worstState` |
| Ampel Kontingent | B1 5.10: grün ≤ Soll, orange ≤ 125 %, rot > 125 % | `quotaState` (Ausnahme Soll 0, siehe 4.7) |
| Werktag Anhang 9 | B1 7.4.4: Mo–Fr 07–19, Sa/So/ganzer Feiertag ganz ausserhalb, anteilige Aufteilung | `splitAnnex9`, Beispiel 05–15 Uhr → 20 % ausserhalb reproduzierbar |
| Halbtagsregel | LSV Anh. 7 Ziff. 322: > 2 h = 1, ≤ 2 h = ½ | `halfDayValue` (die B1 lässt genau 2 h offen, die LSV ist massgeblich) |
| Nutzungskategorien | B1 Tabelle 2, 7.4.3/7.4.5: Anhang 9 alle, Anhang 7 Zivil + SAT, Flag «Gesamtbeurteilung» | `countsForAnnex7`, `AreaEntity.annex7Overall`; Waffen ohne Anhang-7-Kategorie fallen weg |
| Rollenmatrix 8.1.2 | vier Rollen, R/W/X je Bereich, W/R-O | `roles.mock-data.ts` Zelle für Zelle korrekt; `area-scope` Rule; Listen gefiltert |
| Übersicht 5.9 | Suche Bezeichnung + Koord.-Nr., Spalten, beide Ampeln, nur berechtigte Plätze | `area-overview.component.ts`, `AreaService.list(userId)` |
| slm 4 ohne Berechnungsgrundlage | Ansichten bleiben nutzbar, Schusszahlen summieren | Schusszahlen unabhängig von Zuständen; Details/Simulation mit Leerzustand (`none`) |
| slm 5/6 Deep Links | jede Entität per URL, Berechtigung geprüft | `/admin/area/:areaId/...`; API prüft JWT, Mandant, App-Recht, Objektregel (403). Der Router-Guard prüft nur die Session, nicht die Rolle |
| Datenmodell | slm 18/42/43/44 | Nutzungen am Schiessplatz, Zustände mit `isCurrent`/`isMgdm`, Immissionsberechnung 1:n Zustände |

## 3. Die vier Abläufe entlang der ganzen Kette

Legende: ✅ umgesetzt und mit B1 konsistent · ⚠️ umgesetzt, weicht ab · ❌ fehlt · – nicht anwendbar.

### 3.1 Schiesshalbtage Anhang 7 (B1 7.4.3)

| Stufe | Befund | Status |
|---|---|---|
| Kernel `annex7HalfDays` | pro Kalendertag × Waffenkategorie, Vormittag/Nachmittag getrennt, > 2 h = 1, sonst ½, Mehrfachnutzungen summiert, Werktag Mo–Sa, Sonntag = Sonn-/Feiertag | ✅ |
| Kernel Halbtagsgrenze | **13:00** (`ANNEX7_NOON_MINUTE`), B1 7.4.3 prüft «vor 12:00» / «nach 12:00» | ⚠️ |
| Service `buildContext` | Zivil + SAT bzw. alle bei Flag; nur Waffen mit `annex7Category`; Halbtage über den ganzen Schiessplatz | ✅ |
| Service Jahresmittel | Halbtage / Jahre (ungerundet), Schüsse `Math.round(shots / years)` | ⚠️ (Dezimalmengen in kg werden bei > 1 Jahr auf ganze Einheiten gerundet) |
| DTO | Halbtage sind **nicht** im `AssessmentDto` (nur Anhang-9-Betriebsdaten in `operatingData`) | ❌ (5.21 «Betriebsdaten Anhang 7» nicht einsehbar) |
| Oberfläche | keine Anzeige der Halbtage | ❌ |

Auswirkung der Grenze: eine Nutzung 11:00–13:00 zählt im Code als ein Vormittags-Halbtag (2 h → ½), nach B1 als
1 h Vormittag (½) plus 1 h Nachmittag (½). Das ändert `Lri` über den Term `10·log(Wh + 3·Sh)`.

### 3.2 Gemischte Baujahre (B1 7.4.5, 7.7)

| Stufe | Befund | Status |
|---|---|---|
| Datenmodell | `AreaRoomEntity.builtAfter1985` je Stellungsraum, `buildYearClass` je Zustand | ✅ |
| Kernel | `applicableLimits('mixed')` → IGW und PW | ✅ |
| Service Anhang 9 | `annex9New` = nur Quellen der Stellungsräume nach 1985 | ✅ |
| Service Anhang 7 | `annex7New` filtert die Quellen, nimmt aber `context.annex7HalfDays` **aller** Stellungsräume; B1 7.4.5 verlangt die Quelldaten nach 7.4.3 **und** 7.4.4 nur für die neuen Stellungsräume | ⚠️ |
| DTO | vier Zeilen je Empfangspunkt (Anh. 9/7 × IGW/PW) mit `applicable` | ✅ |
| Oberfläche Details | vier Zeilen sichtbar | ✅ |
| Simulation | `limitKind = igw`, wenn IGW anwendbar: bei «gemischt» wird nur die IGW-Sicht simuliert, die PW-Sicht der neuen Stellungsräume nicht | ⚠️ |

### 3.3 Feiertage (B1 7.4.3/7.4.4: «lokal am Standort», ganze und halbe)

| Stufe | Befund | Status |
|---|---|---|
| Kernel | `CalendarOptions.holidays` ganz (`'YYYY-MM-DD'`) oder halb (`{ date, from/to }`), in `splitAnnex9` und `annex7HalfDays` berücksichtigt, getestet | ✅ |
| Datenmodell | kein Feiertagskalender je Schiessplatz/Kanton | ❌ |
| Service | `splitAnnex9(slot(usage))` und `annex7HalfDays(categorised)` werden **ohne** Optionen aufgerufen (`assessment.service.ts`, `simulation.service.ts`) | ❌ |
| DTO / Oberfläche / Konfiguration 5.28 | nichts vorhanden | ❌ |

Folge: Feiertage zählen in jeder Berechnung als Werktage. Die Aussage «halbe Feiertage im Kern umgesetzt und
getestet» (C2 4.3) stimmt für den Kern, nicht für die Anwendung.

### 3.4 Kennzeichnung unvollständiger Berechnungen (Fachregel O8)

| Stufe | Befund | Status |
|---|---|---|
| Kernel `distributeShots` | `refuse` bei Σ Gewichte = 0, `no-source`, Ersatzregel nur mit `release`, 7 Tests | ✅, aber **nicht angebunden** (kein Aufrufer ausserhalb der Tests) |
| Kernel `noiseState` / `worstState` | `incomplete` ohne Farbe, Rang über allen Farben | ✅ |
| Service Assessment | `missingSources` je Empfangspunkt (Kombination mit Schüssen ohne WLR-Zeile im Zustand), Zeilen `incomplete`, Zähler | ✅ (nur der Fall «keine Quelle»; Σ Gewichte = 0 kann ohne Gewichte nicht auftreten) |
| Service Simulation | `incomplete` je Empfangspunkt, Ist- und Simulationszustand | ✅ |
| DTO | `state: 'incomplete'`, `missingSources[]`, `counts.incomplete` | ✅ |
| Oberfläche Details | Zähler, Legende, Pin-Schraffur (`slim-map__pin--incomplete`), Prüfhinweis mit Liste und Zustand | ✅ |
| Oberfläche Simulation | Badge «nicht beurteilbar», Ist-Schatten | ✅ |
| Übersicht 5.9 / Kontextleiste / Startseite | `AreaStatus` kennt `incomplete`, die Werte kommen aber aus dem **Seed** (`quotaStatus`, `noiseStatus` in `tenant.mock.json`); kein Empfangspunkt-Status erreicht die Aggregation | ❌ |
| Export | kein Export vorhanden; C2 4.2 «bis in … Export umgesetzt» trifft nicht zu | ❌ |

## 4. Abweichungen zur B1 (nummeriert)

1. **Halbtagsgrenze 13:00 statt 12:00** – `libs/shared/lsv/src/lib/operating-data.ts` (`ANNEX7_NOON_MINUTE`); B1 7.4.3.
   Wirkung auf Lri/Lr Anhang 7. Korrektur: Konstante auf `12 * 60`, Tests `operating-data.spec.ts` anpassen.
2. **Gemischtes Baujahr, Anhang 7** – Halbtage für die PW-Sicht müssen nur aus den Nutzungen der Stellungsräume nach
   1985 gebildet werden (B1 7.4.5). Korrektur in `buildContext`/`computeLevels`: zweiten Halbtage-Satz für `isNew`.
3. **Feiertage wirken nicht** – Kernel-Parameter vorhanden, Aufrufer übergeben keinen Kalender; kein Kalender im
   Datenmodell. Korrektur: Feiertage je Schiessplatz (5.28) und Übergabe in Assessment/Simulation.
4. **Betrachtungszeitraum** – drei frei wählbare Jahre (z. B. 2020, 2023, 2025) nicht möglich, nur ein
   zusammenhängender Zeitraum (`resolvePeriod`); Jahresmittel rundet Dezimalmengen auf ganze Einheiten.
5. **Alarmwerte Anhang 9** – LSV Anh. 9 Ziff. 2: ES III AW 70, ES IV AW 75; `limits.ts` hat 75 und 80. Der Alarmwert
   fliesst heute in keine Ampel ein. Korrektur: Konstante.
6. **Nutzungs-Datenmodell** – B1 6.1.3/7.4.2: Nutzung = Zeitraum + Einheit (≤ 256) + Anzahl Personen + Kategorie +
   [zivile Nutzungsart] + n × (Waffe/Kaliber, Anzahl). `AreaUsageEntity` ist flach (eine Waffe je Zeile), «Anzahl
   Personen» und «Zivile Nutzungsart» fehlen, Einheit ≤ 120, keine Viertelstunden-Validierung (B1 7.4.1 «soll»,
   6.2.3 «muss» für ELO). Roadmap 1.5 (Nutzung + NutzungPosition) ist nur für die Maske erledigt.
7. **Kontingent ohne Soll** – B1 5.10: Waffe ohne Kontingent hat Soll 0 → rot bei jedem Schuss; `quotaState(actual,
   null)` liefert `none`. Relevant, sobald die Kontingent-Ampel berechnet wird.

**Demo-Datensatz widerspricht slm 4 und 5.10:** acht von neun Schiessplätzen haben `calculations: []`, tragen aber
eine Lärm-Ampel (Thun `over`, Bière `warn`). Beide Ampeln der Übersicht und der Kontextleiste stammen ausschliesslich
aus dem Seed, auch die Kontingent-Ampel. Die Übersicht zeigt für Thun rot, die Detailseite «keine Berechnung».

## 5. Weitere Feststellungen

- `distributeShots` (7.5, slm 32) ist gebaut und getestet, aber nicht angebunden; 1 Quelle = 1 Kombination.
- Keine generische Tabellenkomponente (5.5); nur die Nutzungstabelle hat Filter/Sortierung/Mehrfachauswahl; Exporte
  deaktiviert.
- Rollen wirken im Frontend nicht (Menü/Schaltflächen statisch, API antwortet 403).
- Keine GIS-Komponente (5.4, slm 2): keine Kartenbibliothek installiert, `slim-map` ist nur ein CSS-Block, Details
  und Simulation zeichnen je eine eigene schematische Inline-SVG (Prozentkoordinaten). Massstab, Zoomstufen,
  LV95-Mausposition, swisstopo-Hintergründe, JSON-Konfiguration und PDF-Export fehlen.
- Nicht vorhanden: ELO-Schnittstelle (kein Controller), Excel-Import/-Export, Seite 5.10, Masken 5.15–5.28 ausser
  5.14, Sperrdatum, Handbuch, konfigurierbare Schwellen und Grenzwerte, Auswahllisten-Pflege (slm 1), persistente
  Benutzereinstellungen, kontextsensitive Hilfe, DB-Views, PostGIS (blockiert durch `@app-galaxy`-Typzuordnung).

## 6. Empfohlene Reihenfolge

1. Kernel-Korrekturen 1, 2, 5 (je wenige Zeilen plus Tests), Feiertagsübergabe 3 mit minimalem Kalender.
2. Ampeln der Übersicht/Kontextleiste aus der Berechnung ableiten (inkl. `incomplete`, `none` ohne Zustand),
   Seed-Status entfernen; Kontingent-Ampel mit Soll 0 nach 5.10.
3. Nutzungs-Datenmodell nach B1 6.1.3 (Positionen, Personen, zivile Nutzungsart, 256 Zeichen, Viertelstunden).
4. Halbtage und Betriebsdaten Anhang 7 in DTO und Maske 5.21 sichtbar machen.

## 7. Fachliches Datenmodell (B1 Kapitel 10, Abbildung 43) gegen unser Modell

Grundlage: `ANforderung_10_Fachliches_Datenmodell.png` (Abbildung 43), Entities in `apps/api/src/modules/*/entities`,
ERD `docs/architecture/uml.mmd`. Farben der Abbildung: dunkelblau = übergeordnet, mittelblau = Nutzungen,
hellblau = je Berechnungsstand (aus der FGDB).

### 7.1 Abgleich Klasse für Klasse

| Klasse in Abb. 43 | Ebene | Unser Modell | Befund |
|---|---|---|---|
| Schiessplatz | dunkelblau | `schiessplatz` (`AreaEntity`) | ✅ |
| Stellungsraum (übergeordnet, 1..*) | dunkelblau | `stellungsraum` (`AreaRoomEntity`) | ✅; `builtAfter1985` liegt hier statt am Anlageteil des Zustands (siehe 7.2) |
| Kombination Waffe/Munitionstyp | dunkelblau | – | ❌ als eigene Entität; Waffe, Kaliber, Waffenkategorie, Anhang-7-Kategorie und sonARMS-Id stecken als Textspalten in `stellungsraum_waffe` |
| Zulässige Kombination Waffe/Munitionstyp (je Stellungsraum, 0..*) | dunkelblau | `stellungsraum_waffe` (`AreaWeaponEntity`) inkl. Kontingent | ⚠️ eine Tabelle vereint drei Begriffe: übergeordnete Kombination, zulässige Zuordnung je Stellungsraum **und** Quelle des Lärmmodells (`sourceId`) |
| Schiessplatznutzung (0..* je Stellungsraum) | mittelblau | `nutzung` (`AreaUsageEntity`) | ⚠️ flach: eine Waffe je Zeile statt Nutzung + n Positionen; Anzahl Personen, zivile Nutzungsart fehlen (siehe 4.6) |
| Schiesshalbtage (berechnet, je Waffenkategorie Anhang 7) | mittelblau | zur Laufzeit in `@slim/lsv` | ✅ als «berechnet» (B1 7.4.1 verlangt keine Persistenz); nicht im DTO sichtbar |
| Waffenkategorie Anhang 7 LSV | mittelblau | Spalte `annex7Category` (`a`–`f`) | ✅ fachlich, ❌ als pflegbare Auswahlliste (slm 1, 5.24) |
| Stand Anlage/Berechnung (Version/Revision, 0..* je Schiessplatz) | hellblau | `immissionsberechnung` → `zustand` | ✅ (Hierarchie 5.18 sogar zweistufig) |
| Metadaten (1 je Stand) | hellblau | Spalten `name`, `supplier`, `deliveredAt`, `referenceYear`, `buildYearClass` | ⚠️ nur Teilmenge; B1.2 Kap. 11 (FGDB) definiert mehr |
| Untersuchungsperimeter (1 je Stand) | hellblau | – | ❌ |
| Stellungsraum (Anlageteil, 1..* je Perimeter; 0..* → 1 übergeordneter Stellungsraum) | hellblau | – (Zustand referenziert direkt den übergeordneten Stellungsraum) | ❌ kein Anlageteil je Zustand, damit keine Zuordnung beim Import (slm 45) und kein Baujahr je Zustand |
| Schützenhaus, Hindernis, Hochblende (0..* je Anlageteil) | hellblau | – | ❌ (Geometrie/FGDB; B1 5.10: nur Anlagenteile und Immissionspunkte zwingend anzuzeigen) |
| Massnahme mit Flächen-, Punkt-, Betrieblicher Massnahme | hellblau | – | ❌ |
| Schusslinie (Fireline, 0..* je Anlageteil) | hellblau | `sourceId` an `stellungsraum_waffe` | ⚠️ die Quelle ist übergeordnet statt je Zustand; genau eine Quelle je Kombination (7.5 Verteilung nicht abbildbar) |
| Quelldaten mit Militärische / Zivile Quelldaten (je Schusslinie) | hellblau | – | ❌ keine Betriebsdaten A9 (Tag/Abend) und A7 (WKa–WKf, Halbtage) je Quelle; damit fehlen die Gewichte für 7.5 und die Anzeige 5.21 |
| Ausbreitungsberechnung (dispersion_calculation) | hellblau | `wlr_pegel` (`AreaWlrEntity`: Zustand × Empfangspunkt × Kombination, LAE Tag/Abend, LAFmax) | ⚠️ Werte vorhanden, hängen aber an `stellungsraum_waffe` statt an einer Quelle des Zustands |
| Gebäude (1..*) | hellblau | Spalte `egid` am Empfangspunkt | ❌ keine Gebäude-Entität, keine Geometrie |
| Immissionspunkt (point_of_determination, 0..* je Gebäude) | hellblau | `empfangspunkt` (`AreaReceiverEntity`) **am Schiessplatz** | ⚠️ übergeordnet statt je Zustand; ES, LV95 vorhanden; mehrere Zustände teilen dieselben Punkte |
| Isophonen (1..*), Betroffenen-Analyse (0..1), SSF Massnahmen (0..*) | hellblau | – | ❌ (Gebäude/Isophonen/Perimeter laut FAQ 13 LP5) |

Bewertung gegen die vier Anforderungen:

- **slm 42** (Schiessplatz zeitlich unabhängig, beliebig viele Stellungsräume und Stände): ✅ erfüllt.
- **slm 43** (berechnungsspezifische Strukturen vollständig einem Stand zugeordnet, unabhängig von anderen
  Berechnungen): ⚠️ nur die WLR-Werte hängen am Zustand. Quellen, Empfangspunkte und Anlageteile sind übergeordnet
  und werden von allen Zuständen geteilt. Ein neuer Stand mit anderen Schusslinien oder verschobenen
  Empfangspunkten lässt sich heute nicht ablegen, ohne die alten Stände zu verändern.
- **slm 44** (Nutzungen unabhängig, mit beliebigem Stand kombinierbar): ✅ erfüllt (Nutzung → Stellungsraum ×
  Kombination, Zustand frei wählbar in 5.12).
- **slm 45** (Zuordnung der Stellungsräume beim Import, Abbruch bei unbekannten): ❌ kein Import, keine
  Zuordnungstabelle; die Zuordnung ist implizit, weil der Zustand die übergeordneten Ids direkt verwendet.

### 7.2 Notwendige Anpassungen (Muss-Anforderung, B1 Kapitel 10)

Kapitel 10 ist verbindlich: Die übergeordnet gespeicherten Quellen, Empfangspunkte und Anlageteile sind zu korrigieren,
das ist keine optionale Verbesserung. Gestaltungsspielraum besteht bei Tabellen und Beziehungen, nicht bei den
geforderten fachlichen Strukturen und ihrer Trennung. Im C2 müssen Text (2.3), ERD-Diagramm und Matrix dasselbe
Zielbild zeigen; heute hängt im ERD `AREA_RECEIVER` am Schiessplatz und die Matrix führt slm 43 als «P».

1. **Kombination trennen** – neue übergeordnete Entitäten `waffe`, `kaliber`, `waffenkategorie` (5.22–5.25, slm 1)
   und `kombination_waffe_kaliber` (Bezeichnung DE/FR/IT, Waffenkategorie, Anhang-7-Kategorie, sonARMS-Id aus
   B1.7). `stellungsraum_waffe` wird zur reinen Zuordnung `stellungsraum_kombination` (zulässig, Waffenname für die
   Erfassung, Kontingent Plangenehmigung); `sourceId` wandert in die Zustandsebene.
2. **Anlageteil je Zustand** – `zustand_anlageteil` (Koordinationsabschnitt-Nr., Bezeichnung, Baujahr vor/nach
   1985, Geometrie) mit Pflicht-Fremdschlüssel auf den übergeordneten `stellungsraum`. Der Import (5.19) füllt
   diese Tabelle und bricht ab, wenn ein Anlageteil keinen übergeordneten Stellungsraum findet (slm 45).
   `builtAfter1985` zieht vom übergeordneten Stellungsraum hierher; `zustand.buildYearClass` bleibt als
   Klassierung über den ganzen Platz (5.18) und wird aus den Anlageteilen abgeleitet.
3. **Quelle und Quelldaten je Zustand** – `schusslinie` (= Quelle sonARMS: Anlageteil + Schusslinie + Waffe, QuellenID
   FGDB, Geometrie) mit Fremdschlüssel auf `zustand_anlageteil` und `kombination_waffe_kaliber`; dazu
   `quelldaten_a9` (Tag, Abend) und `quelldaten_a7` (WKa–WKf) je Quelle sowie Werk-/Sonnhalbtage je Zustand und
   Kategorie. Daraus entstehen die Gewichte für `distributeShots` (7.5) und die Anzeige 5.21. `wlr_pegel`
   referenziert dann `schusslinie` statt `stellungsraum_waffe`.
4. **Immissionspunkt und Gebäude je Zustand** – `gebaeude` (EGID, Adresse, Gemeinde, Geometrie) und
   `immissionspunkt` (Nr., ES, Höhe, LV95, Nutzung) hängen am Zustand. Damit Zeitreihen über Zustände vergleichbar
   bleiben (Abweichung zum gültigen Zustand in 5.12), erhält der Immissionspunkt eine optionale Referenz auf einen
   übergeordneten `empfangspunkt` (Abgleich über sonARMS_ID/EGID beim Import, analog zu den Stellungsräumen).
5. **Perimeter und Metadaten** – `untersuchungsperimeter` (Geometrie) und die FGDB-Metadaten (B1.2 Kap. 11) als
   Spalten oder Tabelle je Zustand.
6. **Optionale Geometrieklassen** – Schützenhaus, Hindernis, Hochblende, Massnahmen (drei Subtypen), Isophonen,
   Betroffenen-Analyse, SSF-Massnahmen: eine generische Tabelle `zustand_objekt` (Typ, Attribute JSON, Geometrie)
   reicht für Speicherung und Round-Trip; eigene Tabellen erst, wenn die Masken sie fachlich auswerten (LP5).
7. **Nutzung mit Positionen** – `nutzung` (Kopf: Stellungsraum, Datum, Beginn, Ende, Einheit ≤ 256, Anzahl
   Personen, Kategorie, zivile Nutzungsart, Herkunft) + `nutzung_position` (Kombination, Menge, Einheit Stück/kg).
8. **Geometrie** – LV95-Punkte, Linien und Flächen als PostGIS-Spalten (slm 38); im SQLite/MariaDB-Prototyp als
   WKT-Text mit derselben Spaltenbezeichnung, damit die Migration nur den Typ wechselt.

### 7.3 Umsetzung im Prototyp (12.09.2026)

Die Punkte 1–8 sind umgesetzt (Details: [umsetzungsstand.md](umsetzungsstand.md), Abschnitt 2, und
[../architecture/datenstruktur.md](../architecture/datenstruktur.md)); die Tabelle 7.1 beschreibt den Stand **vor**
dem Umbau und bleibt als Begründung stehen. Abweichungen gegenüber dem Vorschlag 7.2:

| Punkt 7.2 | Umsetzung | Abweichung |
|---|---|---|
| 1 Kombination trennen | `waffe`, `kaliber`, `waffenkategorie`, `waffe_kaliber_kombination`, `stellungsraum_kombination`, `kontingent` | Kontingent eigene Tabelle je Schiessplatz × Kombination (statt Spalte der Zuordnung); Einheit der Menge am Kaliber |
| 2 Anlageteil je Zustand | `zustand_anlageteil` mit Pflicht-FK `(tenantId, schiessplatz_id, stellungsraum_id)`; Import bricht ab (`ImportAbortedException`, nichts geschrieben) | – |
| 3 Quelle und Quelldaten | `schusslinie` → Anlageteil + Kombination (sonARMS-ID), `quelldaten_anhang9` (M1/M2, Zahl/Halbtage Wo/So), `quelldaten_anhang7` (Kategorie, Zahl/Halbtage); beide optional je Quelle (Abb. 43); `wlr_pegel` je Schusslinie × Immissionspunkt × Zeitgruppe | Halbtage stehen an den Quelldaten der Quelle, nicht separat je Zustand und Kategorie |
| 4 Immissionspunkt/Gebäude | `gebaeude`, `immissionspunkt` je Zustand | kein übergeordneter `empfangspunkt`: der Vergleich über Zustände (5.12) läuft über die sonARMS-ID des Immissionspunkts |
| 5 Perimeter/Metadaten | `untersuchungsperimeter`, `ausbreitungsberechnung` je Zustand; Metadaten der Lieferung an `immissionsberechnung`, Klassierung/Ref-Jahr am `zustand` | – |
| 6 Geometrieklassen | eigene Tabellen `hindernis`, `hochblende`, `schuetzenhaus`, `isophonen`, `betroffene_analyse`, `massnahmen_punkt/flaeche/betrieb/ssf` | statt generischer `zustand_objekt`-Tabelle (Round-Trip mit typisierten Spalten) |
| 7 Nutzung mit Positionen | `nutzung` + `nutzung_position` (Menge DECIMAL(12,3), Einheit) | – |
| 8 Geometrie | Textspalten in SQLite | PostGIS erst nach der Typ-Map in `@app-galaxy/*` (validierung-technisch.md) |

Zusätzlich aus dem Review: Composite-FKs `(tenantId, zustand_id, …)` auf allen Zustandsobjekten, Unique-Indizes für
«ein aktueller / ein MGDM-Zustand je Schiessplatz», `noiseStatus`/`quotaStatus` nur als Cache (`AreaStatusService`),
`berechnungslauf` mit Kopie der Nutzungen und Referenz-Snapshot (Feiertage, Zuordnungen, Kontingente, Fachentscheide),
deutsche Spaltennamen in der Zustandsebene (Referenzstruktur und Nutzungen noch englisch). Nachweis: `apps/api/src/modules/calculation/state-isolation.spec.ts` (zwei Zustände mit
gleichen externen IDs, unterschiedlicher Geometrie/Pegel; Änderung am neuen lässt alten Zustand und gespeicherten
Lauf unverändert). Bewertung slm 42–45 damit: ✅ / ✅ / ✅ / ✅ (Import heute über JSON-Staging, kein FGDB-Parser).


Reihenfolge mit dem geringsten Umbau: 1 und 7 (Stammdaten und Nutzung, betreffen Maske 5.11 und Seed), dann 2–3
(Zustandsebene, Voraussetzung für Import 5.19, Verteilung 7.5 und Details 5.21), dann 4–6 mit der Karte.

Siehe auch [validierung-technisch.md](validierung-technisch.md) (NFA 12.5–12.7) und [checkliste.md](checkliste.md)
(Prüfstand des Lösungskonzepts).
