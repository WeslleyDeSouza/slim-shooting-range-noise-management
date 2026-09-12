# SLIM – Akteure und Testidentitäten für E2E

Stand: 12.09.2026. Vorbereitung für den Coding-Agenten; noch keine implementierten Tests.

Grundlage: bereitgestellte Systemkontextgrafik und Abbildung 7 sowie die im Projekt ausgewerteten Rollen aus B1 Kapitel 8.1.2. Die Grafiken zeigen Anwendungsfälle, keine vollständige Berechtigungsmatrix. Für jede erlaubte und verbotene Aktion die Originalmatrix prüfen und als Quelle am Test vermerken.

## 1. Fachliche Akteure

| ID | Akteur | Zugang / Aufgabe | E2E-Schwerpunkte |
|---|---|---|---|
| A01 | Fachspezialist KOMZ Lärm | Direkter SLIM-Zugang; fachliche Bearbeitung von Grundlagen, Nutzungen und Lärmbeurteilungen | Grundlagen importieren und prüfen; Zustand auswählen; Nutzungsperiode wählen; Berechnung und Ergebnis prüfen; fehlende Grundlagen und unvollständige Ergebnisse; berechtigte Verwaltungsaktionen |
| A02 | Schiessplatz-Verantwortlicher | Direkter SLIM-Zugang; Nutzungen der zugeordneten Plätze überprüfen | Zugeordnete Plätze sichtbar; fachlich erlaubte Bearbeitung; fremde Plätze über Liste, Deep Link und API gesperrt; Objektzuordnung nach Rechteänderung beachten |
| A03 | Interessent Schiessplatznutzung und Lärmentwicklung | Direkter SLIM-Zugang; Informationen im erlaubten Umfang einsehen | Erlaubte Übersichten und Details lesen; unzulässige Änderungen verweigern; Simulation und Exporte ausdrücklich anhand Rollenmatrix prüfen, nicht aus Leserechten ableiten |
| A04 | Schiessplatz-Nutzer | Externer Akteur; erfasst im Grundablauf über ELO | Nutzung mit mehreren Waffen-/Kaliberpositionen erfassen und ihre Übernahme in SLIM prüfen; direkter SLIM-Zugang ist daraus nicht abzuleiten |
| A05 | Applikationsadministrator | Zusätzliche Rolle aus B1 Kapitel 8; nicht in den beiden Kontextgrafiken dargestellt | Benutzer, Rollen und Platzzuordnungen gemäss Matrix verwalten; Konten sperren; Rechteentzug prüfen; keine automatischen vollständigen Fachrechte unterstellen |

### Option: direkte Schusszahlenerfassung in SLIM

A04 erhält einen eigenen Testsatz für die angebotene Option nach B1 Kapitel 11: QR-Einstieg, Platz-/Raumvorbelegung, zulässige Kombinationen, Personen, zivile Nutzungsart, dezimale Mengen, Validierung, Verbindungsabbruch und duplikatfreie Wiederholung. Den dafür vorgesehenen Authentifizierungsweg prüfen. Das ist kein Beleg für die Umsetzung der bestehenden ELO-Anbindung.

## 2. Externe Systeme und technische Akteure

| ID | Akteur | Rolle im Test |
|---|---|---|
| S01 | ELO / Schusszahlenerfassung | Maschinenidentität ruft SLIM-Stammdaten ab und übermittelt Nutzungen gemäss B1 Kapitel 6. Erfolg, ungültige Nutzdaten, fehlende Berechtigung und Wiederholung testen. |
| S02 | Berechtigte bundesinterne Datenempfänger, z. B. ImmoGIS/MGDM-Verarbeitung | Vorgesehenen DB-View-/Exportzugang prüfen; nur freigegebene Daten, keine Schreibrechte, unberechtigter Zugang abgelehnt. Konkreten Empfänger und Vertrag aus den Unterlagen übernehmen. |
| S03 | Swisstopo-Kartendienste | Kartenanbindung sowie Verhalten bei Fehler, Zeitüberschreitung oder Ausfall testen. Kein menschliches SLIM-Konto. |

Die zweite Grafik bezeichnet die Erfassung als «TerDiv», die erste als «ELO». Daraus keine zwei verschiedenen Integrationen erfinden: Zuordnung anhand B1 Kapitel 6 bestätigen; im Testvertrag die tatsächliche Schnittstelle benennen.

Ingenieurbüros liefern fachliche Grundlagen/FGDB-Dateien. Ohne ausdrücklich vorgesehenen Direktzugang kein zusätzliches SLIM-Login für sie erfinden. Ihre Dateien als Import-Fixtures verwenden; der Import wird durch die berechtigte Fachrolle ausgeführt.

## 3. Zusätzliche Testidentitäten – keine neuen Fachrollen

| ID | Identität / Zustand | Zweck |
|---|---|---|
| T01 | Nicht angemeldet | Geschützte Seiten, API und Downloads ohne Sitzung nicht zugänglich |
| T02 | Angemeldet, ohne SLIM-Fachberechtigung | Authentifizierung allein gewährt keinen Fachzugriff |
| T03 | Gesperrtes Konto / abgelaufene Sitzung | Zugriff wird entsprechend dem festgelegten Sitzungs- und Sperrkonzept verweigert |
| T04 | Benutzer mit MFA noch nicht abgeschlossen | Keine Fach-API oder geschützte Seite vor Abschluss der erforderlichen Authentifizierung |
| T05 | Verantwortlicher für Platz A, nicht B | Objektbezogene Rechte separat von Rollenrechten testen |
| T06 | Notfalladministrator / Break-Glass | Gesonderter freigegebener Prozess, begrenzter Zugang und nachvollziehbare Protokollierung; nicht als gewöhnliches Admin-Testkonto verwenden |
| T07 | Identität eines anderen Mandanten, sofern Mandantenbetrieb vorgesehen | Mandantenübergreifenden Zugriff verweigern; ersetzt keine getrennten Demo-/Akzeptanz-/Produktionsumgebungen |

## 4. Vorgeschlagene Fixtures

- Synthetische Identitäten: `komz`, `verantwortlich_a`, `verantwortlich_b`, `interessent`, `admin`, `ohne_fachrolle`, `gesperrt` und separate Maschinenidentität `elo_client`.
- Platz A mit zwei unabhängigen Berechnungsständen; unterschiedliche Quellen und Immissionspunkte.
- Platz B für Negativtests zu fremden Objekten.
- Platz C ohne Berechnungsgrundlage: keine erfundene Lärmampel.
- Nutzungen mit mehreren Positionen, Dezimalmengen, lokalen Feiertagen und gemischten Baujahren.
- Unvollständige Zuordnung und Nullgewichte für O8; Erwartung bis Gesamtanzeige und vorhandenem Export prüfen.
- Anmeldedaten über den Test-Secret-Mechanismus bereitstellen; keine produktiven Zugangsdaten oder personenbezogenen Echtdaten in Fixtures.

## 5. Ablage im Code-Repository

Eingeordnet in die bestehende Playwright-/Nx-Suite (`apps/app-e2e`), eigenes Projekt `actors` in
`playwright.config.ts` (kein gemeinsamer `storageState`: jeder Fall meldet sich als sein Akteur an, T01 bleibt abgemeldet):

```text
apps/app-e2e/src/actors/
  readme.md                         dieses Dokument
  support/
    actors.ts                       Registry A01–A05, S01–S03, T01–T07 (Rolle, Demo-Konto, Platzzuordnung),
                                    credentialsOf(), FIXTURE_AREAS (A = Geissalp, B = Bière, C = Hinterrhein), tags()
    test.ts                         `test` mit Fixtures signInAs(id) und apiAs.<verb>() (Bearer der Sitzung)
  a01-fachspezialist/               ein Ordner je Akteur (Präfix = Akteur-ID), eine Datei je Anwendungsfall B1 4.x
    uc-4.4-grundlagen-schiessplatznutzung.spec.ts
    uc-4.7-…, uc-4.8-…, uc-4.9-…    (folgen: Grenzwerte prüfen, Grundlagen bereitstellen, Berechnung importieren)
  a02-platzverantwortlicher/
    uc-4.10-schiessplatznutzungen-ueberpruefen.spec.ts   Nutzungen prüfen/korrigieren, Simulation, W/R-O, fremder Platz (T05)
  a03-interessent/
    uc-4.6-nutzungen-und-laermimmissionen-bekannt-geben.spec.ts   lesen, statischer/dynamischer Vergleich, alles andere 403
  a04-schiessplatz-nutzer/
    uc-4.5-schiessplatznutzung-entgegennehmen.spec.ts    Grundablauf über ELO (S01) und Excel-Import (9.3); Wirkung in SLIM
    option-11-direkte-erfassung.spec.ts                  Option B1 Kap. 11 (slm 46–49), getrennt vom ELO-Nachweis
  a05-applikationsadministrator/
    uc-8.1-administration-und-konfiguration.spec.ts      5.28, Rollen/Apps, Rechteentzug, Auswahllisten; sonst nur R
  s01-elo/ s02-datenbereitstellung/ s03-karten/          (folgen: Schnittstellenvertrag, DB-Views, Kartenausfall)
  t-identitaeten/                   (folgt) T01–T07 (Sitzungs-, Sperr-, Mandantenfälle)
  fachablaeufe/                     rollenübergreifende Fachabläufe mit festgelegtem Soll (Abschnitt 7)
    protokoll-vorlage.md            Ausgangslage → Aktion → Soll → Ist → Beleg
    prio1-kernablaeufe.spec.ts      8 Fälle · prio2-datenfluss.spec.ts 6 Fälle · prio3-betrieb.spec.ts 2 Fälle
  fixtures/
    platz-s.md                      Testplatz S: synthetischer Platz mit Handrechnung (Soll-Tabelle); Dataset + Referenzwerte
                                    in libs/api/tests (TESTPLATZ_S_DATASET, TESTPLATZ_S_REFERENCE), Seed über `dataset`
    (folgen) Import-Dateien: Stammdaten-CSV, FGDB/WLR/Betriebsdaten aus B1.4, Excel-Schusszahlen B1.6
```

Ausführen: `npx playwright test --config=apps/app-e2e/playwright.config.ts --project=actors`
(nicht Teil von `nx e2e`; der HTML-Report ist nach `actor`, `use-case`, `slm` und `matrix` filterbar).

Konten: `E2E_<ID>_USER` / `E2E_<ID>_PASSWORD` (Test-Secret-Mechanismus), sonst die Demo-Konten aus
`tenant.mock.json`. Identitäten ohne Demo-Konto (A04, S01–S03, T02–T04, T06, T07) lassen `credentialsOf()`
fehlschlagen – der Fall bleibt `fixme`, bis Seed oder Secret existiert.

Kriterien-Sammlung `src/criterias/` (ein Fall je `slm`) bleibt daneben bestehen; ein Nachweis wird nicht doppelt geführt,
sondern aus der Akteur-Datei referenziert.

## 6. Aufbau jedes Tests

1. Akteur, Rolle und Platzzuordnung benennen.
2. B1-Anforderung sowie erlaubte/unerlaubte Aktion aus der Rollenmatrix referenzieren.
3. Bekannten Datenzustand herstellen.
4. Aktion über den jeweiligen echten Anwendungspfad ausführen.
5. Sichtbare Wirkung und persistierte fachliche Wirkung prüfen.
6. Zugehörigen Negativfall prüfen, insbesondere fremdes Objekt und fehlendes Recht.

Frontend-Ausblenden ist kein Ersatz für serverseitige Autorisierung. Für verbotene Aktionen auch direkte API-Aufrufe prüfen. Ein mit Stub ausgeführter Schnittstellentest ist als solcher auszuweisen; er ist noch kein nachgewiesener systemübergreifender ELO-End-to-End-Test. Testgerüste und übersprungene Tests nicht als bestanden zählen.

## 7. Fachabläufe mit festgelegtem Soll-Ergebnis

Vollständige Abläufe zuerst – sie zeigen, ob Oberfläche, Datenmodell und Berechnung zusammen funktionieren.
Vorbereitet in `fachablaeufe/` (alle `fixme`), Protokoll je Lauf nach `fachablaeufe/protokoll-vorlage.md`.
Soll-Werte kommen aus der Empa-Referenz (B1.4, `criterias/support/criteria.ts` `B14_CONTROL`), aus der
Handrechnung `fixtures/platz-s.md` oder aus einer fachlich bestätigten Regel – **nie** aus dem aktuellen Ergebnis der Anwendung.

| Prio | Fall | Akteur | Soll (Kurzform, Herleitung im Spec) |
|---|---|---|---|
| 1 | 1.1 Empa-Demodaten importieren, A7/A9 berechnen | A01 | B1.4-Kontrollwerte (E1 60.7 / 73.8 …); E8 = 14.5 / 28.0 mit dokumentierter Kernel-Abweichung (14.3 / 28.1), Fachbestätigung nötig |
| 1 | 1.2 Dieselben Nutzungen mit zwei Ständen | A01 | Testplatz S: Z1 57.1 / 38.1 → Z2 51.1 / 32.1, E2 nur in Z2; Nutzungen identisch |
| 1 | 1.3 Neuer Stand mit verschobenen Punkten | A01 | Z1 samt Ergebnis unverändert, Z2 mit eigenen Punkten/Quellen |
| 1 | 1.4 Kombination ohne passende Quelle | A01 | Zeitraum 2025: E1 «nicht beurteilbar», nie grün, bis Übersicht/Startseite/Export |
| 1 | 1.5 Σ Gewichte null / einzelne null | A01 | Z3 verweigert (Default), Z2 Verhältnis → 51.1 / 57.1 |
| 1 | 1.6 Platz ohne Berechnungsgrundlage | A03 | Hinterrhein: Nutzungen sichtbar, Ampel «Keine Daten» (nicht aus dem Seed) |
| 1 | 1.7 Verantwortlicher A öffnet Platz B (URL + API) | A02 | 403 `AREA_SCOPE`, keine Datenfragmente |
| 1 | 1.8 Fachseite/API ohne abgeschlossene MFA | T04 | Login/2FA-Seite, API 401, erst nach Code 200 |
| 2 | 2.1 FGDB mit unbekanntem Stellungsraum | A01 | Warnung mit Ko-Nr., Abbruch, Zähler unverändert |
| 2 | 2.2 ELO sendet dieselbe Nutzung erneut | S01 | genau eine Nutzung; Antwort gemäss Vertrag; danach E1 57.4 |
| 2 | 2.3 Mehrere Positionen, Dezimalmengen | A01 / S01 | 333 / 12 / 0.125 kg exakt, Kontingent-Ist 666 |
| 2 | 2.4 Drei nicht aufeinanderfolgende Jahre | A01 | Mittel 503.333 / 66.667, 0.833 kg; Störjahre aussen vor; Teilpegel 53.0 (incomplete) |
| 2 | 2.5 Gemischte Baujahre + Simulation | A01 | IGW-Zeile 58.0 / PW-Zeile 50.3; A7 39.5 / 30.8; ×10 nur S2 → PW 60.3 rot |
| 2 | 2.6 Ergebnis exportieren | A01 (A03 negativ) | Werte, Zustand, Zeitraum, «incomplete» wie Anzeige; 5.20 für A03 403 |
| 3 | 3.1 Zehn Benutzer während einer Berechnung | mehrere | B1 12.5 Antwortzeiten, keine Blockade; Umgebung im Protokoll |
| 3 | 3.2 Kartendienst fällt aus | S03 | klarer Fehlerzustand, Rest bedienbar; Stub ausgewiesen |

Mathematische Randfälle laufen **nicht** durch den Browser: Kernel-Tests in `libs/shared/lsv` (grün) plus die
ausführbaren Service-Fälle `apps/api/src/modules/calculation/rechenfaelle.spec.ts` (25 grün, Soll aus `platz-s.md`;
Nachweis mit Commit und Befunden: `docs/anforderungskatalog/nachweis-rechenfaelle.md`):
11:00–13:00-Trennung, 2 h / 2 h 01, Werktag vs. Feiertag, ×10 (+10 dB A9 / +3 dB A7), 60.4 / 60.5 gegen 60
(Beurteilungswert = ungerundeter Pegel auf ganze dB, Anzeige separat), Mittelung kleiner kg-Mengen, mehrere Nutzungen im selben Halbtag.

Für das persönliche Durchspielen: Testplatz S seeden (`TESTPLATZ_S_DATASET` aus `@api-slim/tests`), Protokoll-Vorlage
vorher ausfüllen, mit 1.2 und 1.4 beginnen.
