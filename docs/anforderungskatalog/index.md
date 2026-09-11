# Anforderungskatalog SLIM – Index und Lesehilfe

Ablage der Ausschreibungsunterlagen von armasuisse (simap-ID 41345, 25.08.2026) für das
**Schiesslärmimmissions-Management (SLIM)**. Dieses Dokument fasst zusammen, worum es geht,
wie die Beilagen zu lesen sind und was für den **Prototyp** (Zuschlagskriterium Z2,
Lösungskonzept) relevant ist. Verbindlich bleibt immer der Originaltext der Beilagen.

| Datei | Was | Relevanz für den Prototyp |
|---|---|---|
| `Beilage A1.1 Annex I.3 Mitwirkungspflichten der Bestellerin.pdf` | Was die Auftraggeberin beisteuert: SPOC, Berichtswesen, QM/Risiko, Mitarbeit Handbuch/Schulung, Backlog-Priorisierung, Sprint Planning/Review, Migrationskonzept, Systemkonzept, Testkonzept, **Testdaten**, Usability-/FAT-/SAT-Abnahmen | Grundlage für die Annahmen im Lösungskonzept (Testdaten, Referenzfälle, Fachbestätigung E8, Übersetzungsprüfung) und für C3 |
| `Beilage A1.2 Annex I.4 Abnahmevorschrift.pdf` | Werkvertrag + Sprints (2–3 Wochen): je Sprint formelle **Iterationsabnahme** auf dem Akzeptanzsystem (Testfälle aus den Akzeptanzkriterien vorgängig liefern, Testprotokolle, produktionsnahe Daten), Protokoll je Testobjekt: abgenommen / bedingt / nicht; **Schlussabnahme** mit vollständigem Abnahmetestprotokoll; verbindlicher **Change-Request-Prozess** (Auswirkungsanalyse Aufwand/Kosten/Zeit/Risiken, Entscheid Genehmigung/Ablehnung/Zurückstellung); Q-Ansprechpartner beider Seiten | Muster für `apps/app-e2e/src/criterias` (Testfall je Anforderung = Abnahmenachweis) und für Kapitel 6.4 des Lösungskonzepts |
| `Beilage A2 Vorgaben Lösungskonzept.pdf` | Was das Lösungskonzept (max. 15 A4-Seiten) enthalten muss | **Gliederung unseres Angebots** – siehe [Abschnitt 8](#8-was-das-lösungskonzept-beilage-a2-abdecken-muss) |
| `Beilage B1 Lösungsanforderungen SLIM.pdf` | Das eigentliche Anforderungsdokument, 97 Seiten, Version 15 vom 06.07.2026, 57 Anforderungen `slm 1`–`slm 57` | **Hauptquelle** für Sitemap, Masken, Datenmodell, Berechnung, Schnittstelle, NFA |
| `Beilage B1.4 Berechnung Beurteilungspegel sonARMS Demo.xlsm` | Excel der Empa mit WLR-Dateien, Betriebsdaten und der Berechnung der Beurteilungspegel (inkl. VBA `GEMW`, `ESM`) | **Referenzimplementierung der Lärmberechnung** – die Formeln sind 1:1 nachzubauen, siehe [Abschnitt 6](#6-lärmberechnung-kapitel-7-b1-und-beilage-b14) |
| `Beilage B1.5 Dokumentation … sonARMS.txt` | Nur ein Link: <https://www.bafu.admin.ch/de/ermittlung-und-beurteilung-von-schiesslaerm> | Hintergrund zum Rechenmodell sonARMS (Empa), für uns nicht direkt umzusetzen |
| `Beilage B1.6 Schusszahlenerfassung.xlsx` | Heutiges Excel-Formular der Schusszahlenerfassung (Blätter Erfassung, Areal_Grundlagen, Nutzung, Waffen mil/ziv) | **Importformat** (`slm 37`) und **Exportformat** (`slm 40`); enthält alle 126 Schiessplätze mit 766 Stellungsräumen als Stammdatenquelle |
| `Beilage B1.7 Waffenliste.xlsx` | sonARMS-Waffenliste: 195 Einträge mit ID und Bezeichnung DE/FR/IT | **Stammdaten** für die Zuordnung Waffe/Kaliber → sonARMS (`slm 22`, `slm 36`) |

Ergänzend im Repo: die Sitemap (Abbildung 18 aus B1) ist in
[`../architecture/sitemap.md`](../architecture/sitemap.md) auf Routen und Module abgebildet.

## 0. Unser Vorteil: ELO ist unser eigenes Projekt

Die «Schusszahlenerfassung (ELO)», die B1 als Fremdsystem und Akteur beschreibt (4.2.5, Kapitel 6),
ist unsere Applikation **`C:\Users\User\Projects\alco\pwa-elo-shot-counting`** (ELO
Schusszahlmeldung, gleicher Stack: Nx, Angular 22, NestJS 12, `@app-galaxy/*`). Das heisst
für den Prototyp und das Lösungskonzept:

- **Beide Seiten der ELO-Schnittstelle** (`slm 28`–`slm 30`) liegen bei uns. SLIM stellt
  `GET` Anlageninformationen und `POST` Schiessplatznutzung bereit, ELO wird als Client
  angepasst. Wir können die Schnittstelle sofort end-to-end zeigen, ohne auf einen Dritten zu
  warten.
- **Bestehende Daten und Fachlogik** in ELO decken bereits einen Teil von SLIM ab und dienen
  als Referenz oder Übernahmequelle:

| ELO (API-Modul / Controller) | SLIM-Bezug |
|---|---|
| `admin-areal` (`admin/areal`, `admin/areal-category`, `admin/areal-weapon`) | Schiessplatz / Stellungsraum (in ELO: Areal-Kategorie = Schiessplatz mit Code, Areal = Stellungsraum) und Zuordnung Waffen (5.15–5.17) |
| `admin-weapon` (`admin/weapon`, `admin/weapon-category`, `admin/weapon-amo-contingent`) | Waffe / Kaliber / Waffenkategorie (5.22–5.25), Munitionskontingent ≈ Kontingente Plangenehmigung (5.16) |
| `admin-collection` (`admin/collection`, `admin/export/collection`, `admin/controlling/collection`) und `public/collection` (Wizard) | Schiessplatznutzungen (5.11): Datum, Zeitraum, Nutzungseinheit, Nutzungskategorie (userType M/B/S/Z/O), Waffen mit Anzahl; Excel-Export und Controlling |
| `admin-contingent-usage`, `admin-dashboard` | Kontingent-Auswertung mit Ampel (Vorbild für 5.9/5.10) |
| `admin-coordination-office`, `admin-unit` | Koordinationsstellen, Einheiten → «Benutzende Einheit» |
| Auth, Tenant, Rollen, Helpdesk, Docs-Platform, E-Mail-Vorlagen, Logbuch (`auth-audit`) | Benutzerverwaltung (5.26), Handbuch/Hilfe (`slm 53`), Logging der Anmeldungen (`slm 56`) – bereits über `@app-galaxy/*` in SLIM eingebunden |

- **Begriffsabgleich** (B1 vs. ELO): Schiessplatz ≙ ELO `AreaCategoryEntity` (Code =
  Koordinationsabschnitts-Nr.), Stellungsraum ≙ ELO `AreaEntity`, Schiessplatznutzung ≙ ELO
  `collection` (eine Zeile pro Areal, `groupId` bündelt eine Meldung, `collectionIdentifier`
  wie `ELO-2026-1100-00001`), Nutzungskategorie ≙ ELO `userType` (M = Militär, B = Blaulicht,
  S = SAT, Z = reine Zivile, O = Oblig-/Feldschiessen). Die B1-Kategorie «Zivil» mit ziviler
  Nutzungsart (Obligatorisch | Feldschiessen | Anderes) entspricht damit ELO O + Z. Lücke gegenüber
  B1 6.1.3: **Anzahl Personen** wird in ELO heute nicht erfasst, Zeiten sind noch nicht auf Viertelstunden
  validiert – das sind die Anpassungen auf ELO-Seite.
- **Muster und Code**, die wir wiederverwenden: Auth-Seiten, Admin-Shell, Facade/ComponentBase,
  generierter API-Client, Excel-Export (ExcelJS), E2E-Suite, Docs-Struktur, Grundschutz-Unterlagen
  (Si001) für den Sicherheitsteil des Lösungskonzepts. Der Nachweis, dass derselbe Stack in
  einem produktiven VBS-Umfeld läuft, ist ein Argument für Z2 (Architektur, Sicherheit, Wartbarkeit).
- **Option Kapitel 11** (Ablösung ELO durch eine QR-Code-Erfassungsmaske in SLIM, `slm 46`–
  `slm 49`): entspricht dem ELO-Wizard `/w` (QR-Einstieg, Schiessplatz/Stellungsraum vorbelegt,
  responsive, ohne Login). Wir können das als bereits gelöst offerieren.

---

## 1. Worum es geht (B1, Kapitel 2 und 4)

- **Auftraggeber**: armasuisse Immobilien, Fachbereich Umwelt, Normen, Sicherheit & Nachhaltigkeit
  (UNSN), «Kompetenzzentrum Lärm» (KOMZ Lärm). Es vollzieht die **Lärmschutz-Verordnung (LSV)**
  für rund **120 militärische Schiessplätze**.
- **Rechtsgrundlage**: LSV **Anhang 9** (militärischer Schiesslärm) und **Anhang 7** (ziviler
  Schiesslärm). Werden Belastungsgrenzwerte überschritten, sind Sanierungen fällig (Art. 17);
  die Emissionen sind im Lärmbelastungskataster festzuhalten (Art. 37).
- **Heute**: Schusszahlen werden per Excel gemeldet, von Hand konsolidiert und von der Firma
  Triform in ein lokal installiertes SLMS/sonARMS übernommen. Viel manueller Aufwand, keine
  direkte Auswertbarkeit für den Fachbereich.
- **Ziel von SLIM**: eine zentrale Webapplikation, die
  1. Schiessplatznutzungen (Schusszahlen) aus der bestehenden App **ELO** per REST-Schnittstelle
     entgegennimmt (Übergangsphase: zusätzlich Excel-Import),
  2. daraus die LSV-Betriebsdaten ableitet,
  3. mit den von Ingenieurbüros gelieferten **Berechnungsgrundlagen** (sonARMS-Resultate,
     File-GeoDB) den **Beurteilungspegel pro Empfangspunkt dynamisch berechnet**,
  4. die Einhaltung der **Grenzwerte** (Lärm) und der **Kontingente** (Plangenehmigung) als Ampel
     zeigt,
  5. Stammdaten (Schiessplätze, Stellungsräume, Waffen/Kaliber) verwaltet und Daten für MGDM /
     ImmoGIS exportiert.
- **Zentraler Anwendungsfall** (4.7): «Einhaltung Belastungsgrenzwerte überprüfen» – die
  Auskunftsbereitschaft zur Lärmbelastung im laufenden und in vergangenen Kalenderjahren.

### Akteure (4.2) → Rollen (8.1)

| Akteur | Rolle in SLIM | Was er tut |
|---|---|---|
| Fachspezialist KOMZ Lärm | **Fachspezialist KOMZ Lärm** (R/W überall ausser Admin) | Hauptnutzer: Nutzungen prüfen/korrigieren, Berechnungen importieren, Simulationen, Exporte |
| Schiessplatz-Verantwortlicher | **Schiessplatz-Verantwortlicher** (W/R nur eigene Plätze) | Belegungsplanung, Kontrolle der Erfassung, Simulation eigener Plätze |
| Interessent (GS VBS, Armeestab, …) | **Interessent Schiessplatznutzung** (nur R) | Lärmentwicklung einsehen |
| – | **Applikationsadministrator*in** | Erweiterte Konfiguration (Sperrdatum, Handbuch, Ampel-Schwellen), sonst nur R |
| Schiessplatz-Nutzer | kein SLIM-Login | erfasst über **ELO** (Übungsleiter, Polizei, SAT- und zivile Vereine) |
| Schusszahlenerfassung ELO | Fremdsystem | liefert Nutzungen per REST (Kapitel 6) |

Berechtigungen sind **pro Schiessplatz** (W/R-O = nur zugeordnete Plätze) und pro
Applikationsbereich. Grundsatz: offenes System, jeder sieht alles, was nicht eingeschränkt ist.
Authentifizierung: **MFA oder AGOV** (`slm 35`, `slm 56`), Break-Glass-Admin, Logging aller Logins.

### Mengengerüst (für Datenmodell und Performance)

| Grösse | Wert |
|---|---|
| Schiessplätze | ca. 120 (Excel B1.6: 126 Areale, 766 Stellungsräume) |
| Schiessplatznutzungen | 100–1'500 pro Platz und Jahr (Aufbauphase +20–50 %) |
| Stammdatenänderungen | 50–100 pro Jahr |
| Neue Berechnungen (FGDB) | 5–10 pro Jahr |
| Gleichzeitige Benutzer | max. 10 (`slm 54`) |

---

## 2. Verbindlichkeit und Lesart (B1, Kapitel 1)

- Verbindlich sind **alle Anforderungen mit ID `slm n`** und alle Festlegungen im selben Kapitel.
- Schlüsselwörter: **MUSS** (zwingend), **SOLL** (Abweichung nur mit Zustimmung), **KANN**
  (optional). Ohne Schlüsselwort gilt MUSS. Nur «Hinweis», «Beispiel», «Begründung»,
  «Erläuterung» sind unverbindlich.
- Datenstrukturen sind in **EBNF** notiert (`=` besteht aus, `+` und, `|` oder, `{…}` 1..n,
  `[…]` optional).
- Die GUI-Prototypen in B1 sind **rein fachlich** (kein Styleguide, kein Layout); Icons, Menüs,
  Interaktion sind frei – unser Design System und der Mock `_mocks/home/index.html` gelten.
- Fokus der Oberflächen: **Fachspezialist KOMZ Lärm** – Effizienz, kompakte Darstellung,
  erweiterte Funktionen (5.1.3). Mobile-Fähigkeit ist NFA (responsive), aber kein Smartphone-first
  Erfassungs-UI – ausser bei der optionalen ELO-Ablösung (Kapitel 11).

---

## 3. Benutzeroberfläche (B1, Kapitel 5) – was jede Maske braucht

### Querschnitt (gilt implizit für alle Masken)

| Thema | Anforderung | Umsetzung im Prototyp |
|---|---|---|
| Auswahllisten (`slm 1`) | Werte durch Admin pflegbar (hinzufügen, ändern, inaktivieren) | Lookup-Entities mit `enabled`, Admin-CRUD |
| GIS-Viewer (`slm 2`) | Massstab, Zoom (10–12 Stufen, konfigurierbar), Koordinaten **CH1903+/LV95**, Hintergrundkarten swisstopo (Light Base Map, Imagery Base Map), PDF-Export mit Titel/Copyright/Datum/Massstab, Konfiguration per JSON | Karten-Plugin auswählen (geo.admin.ch iframe, MapLibre/OpenLayers …); Konfiguration als JSON; Layer: Anlagenteile + Immissionspunkte **zwingend**, Gebäude/Isophonen/Perimeter optional |
| Tabellen (`slm 3`) | Textsuche über alle Spalten, Sortierung, Mehrfachselektion (Shift/Ctrl), Filter (Text/Zahl/Datum/Diskret inkl. `null`), Excel-/CSV-Export mit aktiven Filtern | Eine wiederverwendbare Tabellenkomponente im Design System; Zahlen rechtsbündig, Einheiten hinter Werten |
| Ohne Berechnungsgrundlage (`slm 4`) | Alle Ansichten müssen auch ohne importierte Berechnung funktionieren (Schusszahlen aufsummieren) | Null-States für Lärm-Ampel; Kontingent-Ampel funktioniert immer |
| Deep Links (`slm 5`, `slm 6`) | Jede Entität per URL, Berechtigung wird geprüft | `APP_ROUTES` + `adminGuard`; API prüft pro Schiessplatz |
| Persistente Einstellungen (`slm 50`) | Sortierung, Filter, Spalten sitzungsübergreifend; Favoriten-Schnellzugriff; nicht autorisierte Funktionen ausblenden | User-Settings pro Benutzer speichern (Backend) |

### Sitemap (5.7, Abbildung 18) und Masken

Route-Mapping in [`../architecture/sitemap.md`](../architecture/sitemap.md). Fachlich:

| Kapitel | Maske | Kerninhalt | slm |
|---|---|---|---|
| 5.8 | Startseite | Home, Menü (Kontakte Fachverantwortlicher/Sysadmin, Version, Handbuch-PDF), Benutzerkonto; Kacheln «Schiessplatz-Nutzungen» und «Daten-Verwaltung» | 7 |
| 5.9 | Übersicht Schiessplätze | Suche (Bezeichnung, Koordinationsabschnitts-Nr.), Tabelle: Koord.-Nr., Sachplan-Nr., Bezeichnung, **Ampel «Einhaltung Kontingent Plangenehmigung»**, **Ampel «Aktuelle Lärmbelastung»**; nur berechtigte Plätze; Absprung Übersicht / Schusszahlen | 8 |
| 5.10 | Schiessplatz – Übersicht | (1) Beurteilung Lärmbelastung (Ampeln, Regelwerk s. u.), (2) Stand SPM/MPV/Projekt, (3) Kontingente gemäss Plangenehmigung pro Waffe/Kaliber: Soll, Ist laufendes Jahr, Ist Ø 3 Jahre, (4) GIS-Karte mit Empfangspunkten (Popup: Grenzwert + Lr nach Anh. 9, ggf. Anh. 7), Vollansicht in neuem Tab | 9 |
| 5.11 | Schiessplatz – Schusszahlen | Liste Stellungsräume links; Tabelle Nutzungen (Stellungsraum, Nutzungseinheit, Zeitraum, Art, Kategorie, Waffe/Kaliber, Anzahl, Erfasser); Filter Datum/Freitext (Default laufendes Jahr); Neu/Bearbeiten/Löschen | 10 |
| 5.12 | Schiessplatz – Details | Karte mit Empfangspunkten, Detailbereich pro Empfangspunkt: Beurteilungspegel vs. Grenzwert je Anhang und Baujahr (alternativ Liste oder Popup) | 11 |
| 5.13 | Schiessplatz – Simulation | Tabelle je Stellungsraum × zulässige Waffe/Kaliber mit «Schuss innerhalb Werktag» / «ausserhalb Werktag» (Initial: laufendes Jahr nach 7.4.5); Werte überschreiben, zurücksetzen, **Simulation ausführen** → Berechnung Anh. 9 → Karte | 12 |
| 5.14 | Datenverwaltung – Schiessplatz – Übersicht | Suche (auch Sachplan-Nr.), Tabelle, Absprung Areal / Zuordnung Waffen / Berechnungen. **Kein «Neuer Schiessplatz»** – wird per Import/DB-Admin angelegt | 13 |
| 5.15 | … Allgemein Übersicht | Formular Schiessplatz + Tabelle Stellungsräume (Koord.-Nr. **optional**, Bezeichnung, Aktiv) mit Freitextsuche | 14, 15 |
| 5.16 | … Allgemein Stammdaten | Koord.-Nr. (kann eigener Schlüssel sein), Sachplan-Nr., Aktiv (Freigabe für Erfassung), **«Gesamtbeurteilung nach Anhang 7»**-Flag, generelle Eigenschaften, Stand SPM/MPV/Projekt; **Kontingente gemäss Plangenehmigung** pro Waffe/Kaliber (auch ohne Plangenehmigung aus Sanierungsberichten) | 16 |
| 5.17 | … Zuordnung Waffen | Stellungsräume ↔ zulässige Kombinationen Waffe/Kaliber (Waffenname für Erfassung, Waffe, Kaliber, Kategorie); primär per Import gepflegt | 17 |
| 5.18 | … Berechnungen Übersicht | Berechnungen (Bezeichnung, Lieferantin, Anzahl Zustände, Lieferdatum); Zustände (ZustandsID, Bezeichnung, RefJahr, **Baujahr der Anlagenteile**: vor 1985 / nach 1985 / gemischt); genau **ein** Zustand «aktueller Zustand» und genau einer «Stand MGDM» | 18 |
| 5.19 | … Berechnungen Import | FGDB (oder GeoJSON etc.) importieren – Validierung extern (FME); **Abbruch mit Warnung bei unbekannten Stellungsräumen**; WLR-Dateien (Day/Eve) und Betriebsdaten (A7/A9) hochladen und strukturell validieren | 19, 45 |
| 5.20 | … Berechnungen Export | Berechnungszustände als GeoDB (inkl. neuen Zustand anlegen = neue ZustandsID) und **alle** Schusszahlen als CSV | 20 |
| 5.21 | … Berechnungen Details | Pro Stellungsraum: WLR-DAY, WLR-NIGHT, Betriebsdaten Anh. 9, Betriebsdaten Anh. 7 | 21 |
| 5.22 | Waffen – Waffe/Kaliber | Kombinationen mit Bezeichnung DE/FR/IT, Waffe, Kaliber, Waffenkategorie, Aktiv, Verwendung auf Schiessplätzen, **Zuordnung zur sonARMS-Waffenliste** (B1.7) | 22 |
| 5.23 | Waffen – Kaliber | Bezeichnung DE/FR/IT, ALN-Nr., SAP-Nr., Aktiv | 23 |
| 5.24 | Waffen – Waffe | Bezeichnung DE/FR/IT, Waffenkategorie, **Waffenkategorie nach Anh. 7 LSV** (a–f, optional), Aktiv | 24 |
| 5.25 | Waffen – Waffenkategorie | Bezeichnung DE/FR/IT, Aktiv | 25 |
| 5.26 | Benutzer | Rollen pro Schiessplatz und Applikationsbereich (Tabelle 8.1.2) | 26 |
| 5.27 | MGDM Export | **Platzhalter** – MGDM entsteht extern über DB-Views | – |
| 5.28 | Erweiterte Konfiguration | Sperrdatum Schusszahlenerfassung (global), Upload Benutzerhandbuch-PDF, **Ampel-Schwellenwerte und -Farben** (Plangenehmigung und Empfangspunkte) | 27 |

### Ampel-Regelwerk (5.10) – so sind die Farben zu interpretieren

**Kontingent Plangenehmigung** (pro Waffe/Kaliber, laufendes Jahr und Ø 3 Jahre; Soll =
Kontingent, Ist = summierte Schüsse; Waffen ohne Kontingent zählen mit Soll 0):

| Farbe | Bedingung (Default, in 5.28 konfigurierbar) |
|---|---|
| Grün | Ist ≤ Soll |
| Orange | Ist ≤ 125 % Soll |
| Rot | Ist > 125 % Soll |

**Lärmbelastung** (pro Empfangspunkt, Anh. 9, gegen Planungswert/Immissionsgrenzwert je
Empfindlichkeitsstufe und Baujahr, 7.7):

| Farbe | Bedingung |
|---|---|
| Rot | Lr > Grenzwert |
| Orange | Lr > Grenzwert − 5 dB |
| Grün | Lr ≤ Grenzwert − 5 dB |

Aggregation auf den Schiessplatz: Rot, sobald **ein** Element rot ist; sonst Orange, sobald eines
orange ist; sonst Grün. Beide Ampeln erscheinen in der Übersicht 5.9 (unser
`quotaStatus` / `noiseStatus`, plus `none` = keine Daten/Berechnungsgrundlage, `slm 4`).

---

## 4. Schnittstelle ELO (B1, Kapitel 6) – `slm 28`–`slm 30`

REST, JSON UTF-8, HTTPS (TLS 1.2+), Standard-Statuscodes (200/201, 400 Validierung, 404
unbekannte ID, 500).

**A. `GET` Anlageninformationen** (zustandslos, für das Mapping in ELO):

```
Schiessplätze  = {Schiessplatz}
Schiessplatz   = Identifikation (Koord.-Nr., ≤20 Zeichen) + Bezeichnung (≤256) + {Stellungsraum}
Stellungsraum  = Identifikation (≤20) + Bezeichnung + {Zulässige Waffenkategorie + {Zulässige Kombination Waffe/Kaliber}}
Kombination    = Id Kaliber + Id Waffensystem + Bezeichnung Waffenkategorie + Bezeichnungen Kaliber/Waffe DE/FR/IT
```

**B. `POST` Schiessplatznutzung** (genau **eine** Nutzung pro Request, synchrone Antwort):

```
Schiessplatznutzung = Nutzungszeitraum + Benutzende Einheit (≤256) + Anzahl Personen (int)
                    + Nutzungskategorie (Militärisch | Zivil | Blaulicht | SAT)
                    + Stellungsraum-Identifikation + [Zivile Nutzungsart (Obligatorisches Schiessen | Feldschiessen | Anderes)]
                    + {Id Kaliber + Id Waffensystem + Anzahl Schuss (decimal – bei Sprengstoff kg)}
Nutzungszeitraum    = Nutzungsdatum (ISO YYYY-MM-DD) + Start (hh:mm) + Ende (hh:mm)
```

Validierung: Zeiten nur auf **Viertelstunden** (00/15/30/45), Nutzung bezieht sich auf genau
**einen Tag** (Schiessen über Mitternacht = zwei Erfassungen), Feldlängen wie oben, Kombination
muss für den Stellungsraum zulässig sein. Unser ELO-Projekt (`pwa-elo-shot-counting`) ist der
Client dieser Schnittstelle.

---

## 5. Datenmodell (B1, Kapitel 7.4.1 und 10) – `slm 42`–`slm 45`

Drei entkoppelte Ebenen:

1. **Übergeordnete Struktur** (zeitlich unabhängig, in SLIM gepflegt): **Schiessplatz** →
   **Stellungsräume** (alle, auch historische) und **Kombinationen Waffe/Kaliber**.
2. **Berechnungsspezifische Struktur** (je Berechnung/Zustand, aus FGDB importiert): Anlagenteile,
   Quellen (Schusslinien), Immissionspunkte mit Empfindlichkeitsstufe, Gebäude, Isophonen,
   Perimeter, WLR- und Betriebsdaten. Vollständig einem **Berechnungsstand (ZustandsID)** zugeordnet.
3. **Schiessplatznutzungen** (hängen am Schiessplatz, nicht an einer Berechnung): genau ein
   Stellungsraum, Datum + Start/Ende, Nutzungskategorie, n × (Waffe/Kaliber, Anzahl Schuss);
   berechnete Hilfsattribute: Schuss innerhalb/ausserhalb Werktag (Anh. 9), Schiesshalbtage pro
   Waffenkategorie (Anh. 7).

Beim Import einer Berechnung muss **jeder Stellungsraum** der übergeordneten Struktur zugeordnet
werden, sonst Abbruch mit Warnung (`slm 45`). Beliebige Nutzungsperiode × beliebiger
Berechnungsstand muss kombinierbar sein (`slm 44`).

Entitäten für den Prototyp (deutsche DB-Objekte, `slm 51`): Schiessplatz, Stellungsraum, Waffe,
Kaliber, Waffenkategorie, KombinationWaffeKaliber (+ sonARMS-Id), StellungsraumKombination,
Kontingent (Plangenehmigung), Schiessplatznutzung + NutzungPosition, Berechnung, Zustand,
Quelle, Immissionspunkt, WlrEintrag, Betriebsdaten, Benutzer/Rolle/Berechtigung, Konfiguration.
Stammdaten-Quellen: B1.6 «Areal_Grundlagen» (126 Areale / 766 Stellungsräume), B1.6 «Waffen
mil/ziv», B1.7 Waffenliste (195 sonARMS-IDs).

---

## 6. Lärmberechnung (Kapitel 7 B1 und Beilage B1.4)

Das ist der fachliche Kern und im Lösungskonzept explizit gefordert («Umsetzung der
Lärmberechnung»). Ablauf:

**Schritt 1 – Nutzungen → LSV-Betriebsdaten (7.4, `slm 31`)**

| Anhang 9 (militärisch; alle Kategorien) | Anhang 7 (zivil; nur Zivil + SAT, oder alle bei Flag «Gesamtbeurteilung Anh. 7») |
|---|---|
| Werktag = **Mo–Fr 07:00–19:00** | Werktag = **Mo–Sa**, ausser Feiertage (lokal am Standort) |
| Pro Nutzung: Anzahl Schuss **anteilig** nach Zeit in «innerhalb» / «ausserhalb Werktag» splitten (Sa/So/Feiertag = ganz ausserhalb; Zeit vor 07:00, nach 19:00, halbe Feiertage anteilig) | Pro Kalendertag und **Waffenkategorie a–f**: Schiesshalbtage zählen: Vormittag/Nachmittag je 1 Halbtag (>2 h) bzw. ½ (<2 h), getrennt Werktag / Sonn-Feiertag |
| Betrachtungszeitraum: 3 wählbare repräsentative Jahre (Ausreisser vermeiden) oder beliebig; Ergebnis = Ø pro Jahr pro **Stellungsraum × Waffe/Kaliber** | Ergebnis = Ø Halbtage pro Waffenkategorie und Ø Schuss pro **Stellungsraum × Waffenkategorie** |

Sonderfall Baujahr: bei «vor/nach 1985 gemischt» zusätzlich alle Quelldaten nur für Stellungsräume
nach 1985 ermitteln (7.4.5).

**Schritt 2 – Verteilung auf Quellen (7.5, `slm 32`)**: Quelle sonARMS = Stellungsraum +
Schusslinie + Waffe (z. B. `SH300-Links_Stgw90`) = QuellenID der FGDB. Die Schusszahlen aus
Schritt 1 werden im **Verhältnis der Betriebsdaten der Berechnungsgrundlage** auf die Quellen
verteilt (Anh. 9: Tag/Abend; Anh. 7: pro Waffenkategorie).

**Schritt 3 – Beurteilungspegel (7.6, `slm 33`)** – Formeln aus B1.4, Blätter
`sonARMS_Demo_A9X` / `_A7X`, VBA-Funktionen:

```
GEMW(gewichte g_i, pegel L_i) = 10·log10( Σ g_i·10^(0.1·L_i) / Σ g_i )      // gewichtetes energetisches Mittel, −99 wenn leer
ESM(pegel L_i)               = 10·log10( Σ 10^(0.1·L_i) )                    // energetische Summe, −99 wenn leer
```

*Anhang 9* (pro Empfangspunkt; Pegel LAE aus WLR_Day bzw. WLR_Eve, Gewichte = Schuss
innerhalb/ausserhalb Werktag, Listen alphabetisch nach Quelle):

```
LAE1 = GEMW(schuss_tag,   LAE_day) + 10·log10(Σ schuss_tag)
LAE2 = GEMW(schuss_abend, LAE_eve) + 10·log10(Σ schuss_abend) + 5
Lr   = ESM(LAE1, LAE2) − 10·log10(52·5·12·3600) + 15
```

*Anhang 7* (pro Empfangspunkt und Waffenkategorie k; Pegel LAFmax aus WLR_Day; Wh/Sh =
Schiesshalbtage Werktag / Sonn-Feiertag der Kategorie):

```
Li_k  = GEMW(schuss_k, LAFmax_day)
Lri_k = Li_k + 10·log10(Wh_k + 3·Sh_k) + 3·log10(Σ schuss_k) − 44        // 0 wenn Li_k = −99
Lr    = ESM(Lri_a … Lri_f)
```

Kontrollwerte aus B1.4 (Demo-Projekt): Anh. 9 → E1 = 60.7, E2 = 51.8, E3 = 46.6, E4a = 41.8;
Anh. 7 → E1 = 73.8, E2 = 66.3, E3 = 60.5, E4a = 53.1. Diese Zahlen sind unsere
**Unit-Test-Erwartungen** für die Berechnungsengine.

**Schritt 4 – Grenzwertvergleich (7.7, `slm 34`)**: pro Empfangspunkt Planungswert (PW) oder
Immissionsgrenzwert (IGW) je **Empfindlichkeitsstufe** (Art. 43 LSV) und Baujahr: vor 1985 →
IGW, nach 1985 → PW, gemischt → beides (IGW alle Stellungsräume, PW nur die nach 1985).
Einfärbung wie in Abschnitt 3.

Dateiformate der Berechnungsgrundlage (B1.4): **WLR** (`.wlr`, Textdatei sonARMS-Kernel: Kopf +
Tabelle `Empfänger | Gebäude | Quelle | Waffe | Elevation | LAE(MK) | LAE(GK) | LAE(Det) | LAE |
LAFmax`, je für Zeitgruppe Tag und Abend), **Betriebsdaten A9** (`Quelle | Tag | Abend`),
**Betriebsdaten A7** (`Quelle | WKa…WKf`, davor Zeilen `WerkHalbtage`, `SonnHalbtage`), jeweils
mit `//`-Kommentaren und `END`. Resultatdateien A9p/A7p enthalten pro Empfangspunkt x, y, h,
Gebäude, LAE1/LAE2 bzw. Li/Lri, Lr, Über-PW/IGW/AW, Gemeinde, ES, Adresse.

NFA dazu (`slm 54`): Berechnung Lärmimmissionen Ø 5 s, max. 10 s; rechenintensive Prozesse
ressourcenisoliert (z. B. Worker/Queue); asynchrone tagesaktuelle Berechnung auf Basis des
Vortags ist **zulässig (KANN)**.

---

## 7. Import / Export (B1, Kapitel 9) – `slm 36`–`slm 41`

| Vorgang | Format | Hinweis |
|---|---|---|
| Initialer Stammdatenimport (`slm 36`) | CSV oder DB-Datei vom Auftraggeber | Schiessplätze, Stellungsräume, Waffen/Kaliber/Kategorien, sonARMS-Liste, Kombinationen und Zuordnungen. Historische Nutzungen/Berechnungen **nicht** Teil der Applikation, Strukturen aber vorsehen |
| Schusszahlen-Import (`slm 37`) | Excel gemäss B1.6 | Blatt «Erfassung»: `Areal | Stellungsraum | Nutzungseinheit | Datum | Zeitraum | Tage | Zeitraum (ziv) | Sämtliche Waffen | 134 Waffenspalten (Gruppen Infanterie, Panzer, Minenwerfer, Artillerie, Flab, Flugzeugkanonen, zivile Schiessen a–f, Neue Waffen 1–12)`. Nutzungseinheiten: MILITÄR, BLAULICHT, OBLIG S / FELD S, SAT, ZIVIL. Zeitfenster «Mo–Fr 7–19 Uhr» / «ausserhalb» + eigene |
| Laufender Berechnungsimport (9.1, `slm 19`) | FGDB (ESRI), evtl. GeoPackage/INTERLIS/GeoJSON | Validierung **extern** mit FME-Workbench; Ablauf: Export Grundlage → Ingenieurbüro rechnet in sonARMS → FGDB zurück → Validierung → Import |
| Export Nutzungen (`slm 40`) | Format gemäss B1.6 (CSV/Excel) | vollständig, alle Attribute |
| Export Gesamtstatistik MPV (`slm 41`) | CSV | eine Zeile pro Schiessplatz, inkl. Grenzwertüberschreitungen und Stand SPM/MPV/Projekt |
| Export Berechnungszustände (`slm 20`) | GeoDB nach Projekthandbuch [2] | neuen Zustand anlegen möglich |
| DB-Views (`slm 38`) | relationale DB **mit Geometrie** (PostGIS o. ä.), Struktur nahe am Fachmodell | für MGDM und ImmoGIS |
| Alle Exporte (`slm 39`) | mindestens CSV | |

---

## 8. Was das Lösungskonzept (Beilage A2) abdecken muss

Max. 15 A4-Seiten, Zuschlagskriterium Z2. Pflichtinhalte und wo unsere Antwort herkommt:

| Inhalt | Unsere Grundlage |
|---|---|
| Management Summary (½ Seite) | Kernmerkmale: Nx-Monorepo, Angular 22 + NestJS 12, galaxy Auth (MFA), PostGIS, ELO-Anbindung, Berechnungsengine nach B1.4 |
| Applikations-Gesamtarchitektur: Schichten, Stack, Sicherheit (Auth/Autorisierung/Datenschutz), Deployment (Container, Cloud/On-Prem) | `docs/architecture/datenstruktur.md`, `dockerfile`, `ecosystem.config.js`, `@app-galaxy/auth-api` (MFA, Rollen, Session-Logging), Backup-Konzept (`slm 57`: RPO 1 Tag, RTO 2 Tage, 12 Monate Generationen, on-premise) |
| Schnittstellen: ELO, Import/Export | Abschnitt 4 und 7 |
| Umsetzung der Lärmberechnung: Ablauf, Geschwindigkeit, Skalierbarkeit, grosse Datenmengen | Abschnitt 6; Worker/Queue, Caching pro Zustand, Vortagsberechnung |
| Usability/UX: Navigation, GIS, Tabellen, Mobile, I18n, Barrierefreiheit | Design System + Styleguide, Sitemap, `slm 50`–`slm 53`; I18n DE/FR/IT (Browser-Default, Wahl persistent, FR vom Auftraggeber geliefert, Datumsformate CH); Barrierefreiheit: eCH-0059 / WCAG 2.0 AA vorgeschlagen, ISO 9241 |
| Weitere NFA mit Referenz: Änderbarkeit, Wartbarkeit (MVC/MVVM, Admin-Konfiguration ohne Rekompilierung), Ergonomie, Skalierbarkeit, Performance & Last, Dokumentation/Hilfe/Schulung | `slm 52`–`slm 56`; Performance-Tabelle 12.5 (Suche Ø 2 s / max 5 s, Filter 0.5/1 s, Details 2/5 s, Berechnung 5/10 s), kontextsensitive Hilfe ≤ 2 s, Handbuch online + PDF |

---

## 9. Prioritäten für den Prototyp

**Bereits vorhanden** (Stand 2026-09-11): Login/MFA-Flow (galaxy), Startseite, Übersicht
Schiessplätze mit beiden Ampeln, Design System, i18n DE/FR/IT/EN, Area-Modul mit Seed.

**Muss der Prototyp zeigen** (deckt Z2-Kriterien und die meisten `slm` ab):

1. **Datenmodell** nach Abschnitt 5 inkl. Stammdaten-Seed aus B1.6/B1.7 (echte 126 Areale,
   Waffenliste) – `slm 36`, `slm 42`–`slm 44`.
2. **Schusszahlen** (5.11): Nutzungen anzeigen/erfassen/bearbeiten, Excel-Import B1.6 – `slm 10`,
   `slm 37`; **ELO-Schnittstelle** GET/POST mit Validierung – `slm 28`–`slm 30`.
3. **Berechnungsengine**: WLR/Betriebsdaten-Parser, Schritte 1–4 aus Abschnitt 6, Unit-Tests
   gegen die Kontrollwerte aus B1.4 – `slm 31`–`slm 34`.
4. **Schiessplatz-Übersicht** (5.10) mit Kontingent-Tabelle, Lärm-Ampel und **GIS-Karte**
   (swisstopo-Hintergrund, Empfangspunkte farbig, Popup) – `slm 2`, `slm 9`.
5. **Simulation** (5.13) – `slm 12`.
6. **Berechnungen verwalten** (5.18–5.21): Zustände, aktueller Zustand / Stand MGDM, Upload
   WLR/Betriebsdaten – `slm 18`, `slm 19`, `slm 21`.
7. **Waffen-Stammdaten** (5.22–5.25) und **Erweiterte Konfiguration** (5.28) – `slm 22`–`slm 25`,
   `slm 27`.
8. **Tabellenkomponente** mit Suche/Sortierung/Filter/Export – `slm 3`.

**Kann später / ausserhalb**: FGDB-Import und -Export (Format noch offen, Validierung extern),
MGDM-Export (Platzhalter), ELO-Ablösung per QR-Code (Kapitel 11, KANN), Barrierefreiheit-Grad
(offen beim Auftraggeber).

## 10. Offene Punkte aus den Beilagen (beim Auftraggeber klären)

- Abgrenzung mehrerer Anlagen auf einem Schiessplatz (7.3, Betriebszeiten nicht zusammenzählen).
- FGDB vs. offenes Format (GeoPackage/INTERLIS) für Berechnungen (4.8, 9.1).
- Barrierefreiheit-Standard (12.3).
- Zivile Nutzungsart und Anzahl Personen werden in ELO heute nicht erfasst (6.1.3).
- Übereinstimmung QuellenID FGDB ↔ Quelle sonARMS (7.5.1).
- Sachplan-Nr. und Koordinationsabschnitts-Nr. sind nicht überall vorhanden (5.15, 5.16).
