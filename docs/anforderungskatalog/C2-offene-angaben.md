# C2 und Z3 – offene Angaben vor Abgabe

Arbeitsliste zum Lösungskonzept (`C2-Loesungskonzept-SLIM.md`, Version 1.0) und zum Projektplan
(`../projects/hermes-projektplan-z3.md`, Version 1.0), Stand 02.10.2026. Kein Bestandteil des Angebots und kein
Erfüllungsnachweis. Dies ist die einzige Liste der Angaben, die noch fehlen oder vor der Freigabe zu bestätigen sind.

## 1. Platzhalter in den Angebotsdokumenten

Jeder Platzhalter steht für genau eine fehlende Angabe und ist in den Dokumenten wörtlich so geschrieben. Nach dem
Einsetzen beide Word-Dateien neu erzeugen (Abschnitt 6).

| Platzhalter | Dokument / Stelle | Einzusetzen |
| --- | --- | --- |
| `[OFFEN: Firmenname Technologiepartnerin]` | C2 Kapitel 1; Z3 Kopf | Vollständige Firmenbezeichnung der Subunternehmerin für die Entwicklung (Rechtsform, Sitz). Danach steht überall nur «Technologiepartnerin». |
| `[OFFEN: Hosting-Anbieter]` | C2 Kapitel 2.5 | Name des Schweizer Hosting-Anbieters und Rechenzentrumsstandorte. Der Anbieter ist im Angebot zu benennen (FAQ 132, 140, 180); E1 ist bei ihm nachzuweisen. |
| `[OFFEN: Aufwandsschätzung LP5 zusätzliche Kartenlayer]` | C2 Kapitel 5.2 | Nachvollziehbare Aufwandsschätzung für Gebäude, Isophonen und Untersuchungsperimeter (FAQ 13: «erwünscht»). |
| `[OFFEN: Standort 2nd-/3rd-Level-Support]` | C2 Kapitel 6.3 | Standort der Supportorganisation von [PLATZHALTER FIRMA] (Teil B 2.6.2, E8) und des 3rd Level bei der Technologiepartnerin. |
| `[OFFEN: Demo-URL]` | C2 Kapitel 6.5 | Adresse der Demo-Instanz. |
| `[OFFEN: Freeze-Datum und Version der Demo]` | C2 Kapitel 6.5 | Datum und Softwarestand, auf dem die Demo während der Evaluation eingefroren ist. |
| `[OFFEN: Projektleiter/in]` | Z3 Kopf, Abschnitte 3 und 6.1 | Name (E3). Im Plan [PLATZHALTER FIRMA] zugeordnet – siehe Abschnitt 2 dieser Liste. |
| `[OFFEN: Lead-Business-Analyst/in]` | Z3 Abschnitte 3 und 6.1 | Name (E3). Im Plan [PLATZHALTER FIRMA] zugeordnet – siehe Abschnitt 2 dieser Liste. |
| `[OFFEN: Applikationsentwickler/in]` | Z3 Abschnitte 3 und 6.1 | Name der zweiten Entwicklungsperson der Technologiepartnerin. |
| `[OFFEN: Qualitätssicherung]` | Z3 Abschnitte 3 und 6.1 | Name, Mitarbeiter/in von [PLATZHALTER FIRMA]. |
| `[OFFEN: Betrieb / Sicherheit]` | Z3 Abschnitte 3 und 6.1 | Name, Mitarbeiter/in von [PLATZHALTER FIRMA]. |
| `[OFFEN: Stellvertretung Projektleitung]`, `[… Lead-Business-Analyst/in]`, `[… Lead-Applikationsentwickler]`, `[… Applikationsentwicklung]`, `[… Qualitätssicherung]`, `[… Betrieb / Sicherheit]` | Z3 Abschnitt 6.1 | Je Rolle eine namentliche Stellvertretung (E3, E4). |
| `[OFFEN: Aufteilung LP1b bestätigen]` | Z3 Abschnitt 1 | Bestätigung beider Firmen für 500 h Technologiepartnerin (Realisierung) und 250 h [PLATZHALTER FIRMA] (Analyse und Abstimmung, unabhängige Qualitätssicherung und Abnahmetests, Einführungsunterstützung); danach den Platzhalter entfernen. |

Ohne Platzhalter, aber ebenfalls einzusetzen:

- **Pensen (Z3 Abschnitt 6.1, FAQ 133):** Die Stunden je Rolle und Zeitraum (Planungsphase, PI 1–4, Abschluss) stehen
  in Z3. Offen sind die Personen je Rolle (Platzhalter oben) und die bestätigte Verfügbarkeit je Person – etwa 210
  Stunden des Lead-Applikationsentwicklers in PI 1, rund 44 % bei 160 Stunden je Monat. Einen Platzhalter
  `[OFFEN: Pensen je Person und PI]` gibt es in Z3 nicht mehr.
- **Deckblatt C2:** Die Angaben stehen nur im Markdown-Kommentar und erscheinen nicht in der Word-Datei: verantwortliche
  Person und Funktion, vollständige Firmenbezeichnung von [PLATZHALTER FIRMA] (Rechtsform, Sitz).
- **Weslley De Souza als Lead-Applikationsentwickler** (Z3 Abschnitte 3 und 6.1): aus Version 0.2 übernommen, dort
  «geplant; Zusage/Rolle bestätigen». Zusage und Pensum bestätigen.

## 2. Ableitungen und Annahmen – vor Freigabe zu bestätigen

| Thema | Was in den Dokumenten steht | Zu bestätigen |
| --- | --- | --- |
| Stundentabelle LP1a (Z3 Abschnitt 6) | Arbeitspakete, Stand 02.10.2026 (Technologiepartnerin / [PLATZHALTER FIRMA] / Summe): Projektleitung – / 280 / 280; Business Analyse 75 / 245 / 320; Architektur, PostGIS und GDAL 260 / – / 260; Entwicklung des Restumfangs 990 / – / 990; Qualitätssicherung und Tests – / 380 / 380; Migration, Handbuch und Einführung – / 320 / 320; Reserve 125 / 125 / 250; Summe 1'450 / 1'350 / 2'800. Z3 nennt als Grundlage den verbleibenden Umfang je Anforderung in der Matrix. | Die Zahlen sind eine Angabe der Firma und zu bestätigen. Es fehlen Unterpositionen der grössten Restaufwände: PostgreSQL/PostGIS (slm 38), FGDB über GDAL (slm 19–21), Excel-Import (slm 37), ELO-Endpunkte (slm 28–30), Exporte und Views (slm 38, 40, 41), verbleibende Masken (slm 3, 26). Eine Aussage «MVP zu x % fertig» steht in C2 und Z3 nicht und soll ohne Nachweis auch nicht hinein. **Historie:** Bis zum 02.10.2026 war die Tabelle der Version 0.2 (4'000 h) pauschal mit dem Faktor 0.7 skaliert (Reserve 245 h); diese Herleitung ist ersetzt. |
| Rollen je Firma (Z3 Abschnitt 3) | Projektleitung und Lead-Business-Analyse bei [PLATZHALTER FIRMA] (folgt aus der Stundenaufteilung), Lead-Applikationsentwickler bei der Technologiepartnerin. Nach FAQ 133 müssen die drei Lead-Personen ihre Rolle mit dem höchsten Pensum ausüben und an der Präsentation (Z6) auftreten; eine Person darf zwei der drei Rollen bündeln. | Firma und Person je Lead-Rolle. |
| Stunden je Rolle (Z3 Abschnitt 6.1) | Stunden je Rolle und Zeitraum (Planungsphase, PI 1–4, Abschluss), Total 2'800 h; Durchschnittspensum = Stunden / (16 Monate × 160 h), zwischen 10 % und 30 %. In einzelnen Zeiträumen liegt das Pensum höher (Lead-Applikationsentwickler in PI 1: 210 h, rund 44 %). | **Entschieden 02.10.2026:** Pensen in dieser Höhe sind für die Schlüsselrollen vertretbar, weil das Projektvolumen reduziert wurde; die Begründung steht in Z3 6.1. Offen bleiben die Personen je Rolle und ihre bestätigte Verfügbarkeit; Stellvertretungen allein belegen sie nicht. **Rechnung geprüft 02.10.2026:** Basis sind 16 Monate (Planungsphase von drei Monaten, vier PI zu drei Monaten und Abschlussmonat) × 160 h = 2'560 h je Vollzeitstelle; Rollenstunden nach Z3 6.1 (Stand 02.10.2026) 280 + 250 + 765 + 560 + 385 + 190 + 120 = 2'550 h, plus Reserve 250 h = 2'800 h. Wer nur mit den 15 Monaten bis Ende PI 4 rechnet, kommt auf weniger Stunden; die Basis steht jetzt ausdrücklich in Z3 6.1. Die tatsächliche Verfügbarkeit der Personen ist separat zu bestätigen. |
| Maximalaufwand 2'800 h statt 4'000 h (C2 Kapitel 1 und 6.5, Z3 Abschnitte 1, 6, 15) | Als verbindlicher Maximalaufwand der Anbieterin formuliert. | **Geklärt 02.10.2026:** FAQ 59 (geändert), 61–63, 126, 151 und 169 lassen für LP1a eine verbindlich geringere Stundenzahl zu. Sie wird im Preisblatt eingetragen; Z1 bewertet die angebotenen Stunden mal Stundenansatz; verrechnet werden höchstens die angebotenen Stunden, der ganze Muss-Umfang ist darin zu erbringen, Mehraufwand wird nicht vergütet und das Risiko trägt die Entwicklerin (FAQ 126). Z3 Abschnitte 1, 6 und 15 sind nachgeführt. Offen bleibt: die 2'800 Stunden im Preisblatt C3 V2 eintragen (liegt nicht im Repository), und ob eine Stundenangabe im Lösungskonzept (Z2) zulässig ist oder als Preisangabe gilt (Teil A liegt nicht im Repository). |
| Stundensatz | In Version 0.2 des Plans stand «CHF 115/h = CHF 460'000». Der Satz ist aus dem Plan entfernt; Preise gehören ins Preisblatt. | Stundensatz im Preisblatt C3. |
| ELO (C2 Kapitel 1, 3.1, 6.5; Z3 Abschnitt 1) | «Die Technologiepartnerin hat ELO entwickelt»; beide Seiten der Schnittstelle sind ihr bekannt. Die Schnittstelle selbst (slm 28–30) ist **nicht umgesetzt** und so ausgewiesen (Matrix Status Z). | Aussage zur ELO-Urheberschaft mit Referenz belegen. FAQ 17 und 177: Die ELO-seitige Spezifikation verantwortet die Auftraggeberin «unter Zuzug der ELO-Entwicklerfirma» – die Doppelrolle im Angebot offenlegen. **Entschieden 02.10.2026:** Der Status Z für slm 28–30 bleibt in der Matrix; Datenmodell und Validierungsregeln sind vorhanden, die Endpunkte werden in LP1 gebaut. |
| Begriff «Entwicklerin» | **Entschieden 02.10.2026:** In C2 und Z3 heisst die Subunternehmerin durchgehend «Technologiepartnerin». «Entwicklerin» ist nach dem Rahmenvertrag (Art. 1.1) die Vertragspartnerin der Bestellerin, also [PLATZHALTER FIRMA]; das Wort steht in C2 nur noch in diesem Sinn (Kapitel 1). | Art. 1.1 am Vertragstext prüfen – der Rahmenvertrag liegt nicht im Repository. |
| Vorbestehende Rechte (C2 Kapitel 2.2) | Bibliotheken `@app-galaxy/*` und der Prototyp (MVP) im Stand vor Inkrafttreten des Rahmenvertrags sind vorbestehende Rechte der Technologiepartnerin; die Auftraggeberin erhält das unentgeltliche Nutzungsrecht nach Art. 6.2.4. Der Satz zur Open-Source-Freigabe ist gestrichen. | Rechtekette vertraglich regeln: Technologiepartnerin → [PLATZHALTER FIRMA] (Generalunternehmerin) → armasuisse; so steht es jetzt in C2 2.2. Art. 6.2.4 am Vertragstext prüfen. |
| Weitere Artikelnummern im Plan | Art. 2.3.4 (PI-Angebote), 2.11.1 (Termin 30.06.2028), 2.15 (Change Requests), 3.1 (Vergütung) | Nur über FAQ 50, 51, 59 und 69 belegt; im Rahmenvertrag gegenprüfen. |
| Hosting (C2 Kapitel 2.5) | «100 % der Daten in der Schweiz, einschliesslich Sicherungen, Quellcode und Entwicklungsdaten»; Anforderungen ISO 27001 und Si001; zweiter Schweizer Standort für die Sicherung. | Mit dem gewählten Anbieter belegen (Standortbestätigung, Zertifikat, Vertrag). Der Prototyp-Quellcode liegt heute auf GitHub.com; der Umzug auf das selbst betriebene GitLab steht aus (E1 Kapitel 6.1, 10). |
| KI- und Entwicklungswerkzeuge (C2 Kapitel 6.3) | **Entschieden 02.10.2026:** ab der Eingabefrist ausschliesslich KI-Dienste mit Verarbeitung in der Schweiz; C2 6.3 und das E1-Konzept der Technologiepartnerin (Kapitel 7) nennen dieselbe Regel. | Umstellung vor der Eingabefrist vollziehen (siehe Abschnitt E1). |
| Datenhaltungskonzept E1 | C2 sagt: [PLATZHALTER FIRMA] und die Technologiepartnerin legen je ein eigenes Konzept vor (FAQ 132). | **Erledigt 02.10.2026:** zwei Konzepte (`E1-Datenhaltungskonzept-Generalunternehmerin.md`, `E1-Datenhaltungskonzept-Technologiepartnerin.md`); offene Angaben im Abschnitt «E1 – Datenhaltungskonzepte» unten. C2 6.3 an die KI-Regel der Konzepte angleichen. |
| Barrierefreiheit (C2 Kapitel 5.4) | SLIM **orientiert sich** an eCH-0059 / WCAG 2.1 AA (Tastaturbedienung, Kontraste), in Anlehnung an die Richtlinien der armasuisse. | **Entschieden 02.10.2026:** keine verbindliche Konformitätszusage und kein Audit, weil die Auftraggeberin nach FAQ 9 und 128 keine speziellen Anforderungen stellt. Die Zusagen zu Tagged PDF, Screenreader-Prüfung und automatisierter Prüfung im Build sind gestrichen. |
| FGDB über GDAL (C2 Kapitel 2.2, 3.2, 6.5; Z3 M2) | Verbindliche Zusage: Lesen und Schreiben über GDAL, Validierung zu Projektbeginn mit den Testdaten von KOMZ Lärm. | Im Prototyp nicht erprobt (JSON statt FGDB, GDAL nicht installiert, keine Beispiel-FGDB). Schema wird erst im Projekt festgelegt (FAQ 99, 176). Konvertierungsweg bei Lücken (Werkzeug, Lizenzen, Aufwand) ist nicht konkretisiert. |
| PostgreSQL/PostGIS | Als erste Aufgabe in LP1 zugesagt (C2 2.2, 6.5; Z3 M2). In Version 0.3 stand «wird vor Abgabe nachgezogen». | Der Start gegen PostgreSQL ist weiterhin durch die Typzuordnung in `@app-galaxy/*` blockiert. |
| Programm-Inkremente (Z3 Abschnitt 2) | Planungsphase von drei Monaten und vier PI zu drei Monaten als Planung. | FAQ 69 nennt vier bis sechs PI; Zuschnitt bestätigen. |
| Termine (Z3 Abschnitt 4) | Schlussabnahme Januar/Februar 2028, Einführung März 2028, drei Monate Reserve bis 30.06.2028 (FAQ 50). | Terminplan mit beiden Firmen bestätigen. |
| Meilenstein M1 (Z3 Abschnitt 4) | **Abstimmungsvorschlag 02.10.2026:** M1 verlangt die formelle Abnahme der Machbarkeitsanalyse, die Prüfung und fachliche Bewertung der vorhandenen Funktionen sowie die abgestimmte Zielarchitektur mit Überführungsplan; die technische Überführung auf PostgreSQL/PostGIS wird erst bis M2 nachgewiesen. Vorher stand «in die vereinbarte Architektur überführt». | Formulierung mit beiden Firmen bestätigen; die Abnahme der Machbarkeitsanalyse am Rahmenvertrag prüfen (Art. 2.2.1 ist nur aus der Rückmeldung belegt, der Vertrag liegt nicht im Repository). |
| Aufteilung LP1b (Z3 Abschnitt 1) | 750 h: 500 h Technologiepartnerin, 250 h [PLATZHALTER FIRMA]; die Aufgaben der 250 h sind ein Vorschlag aus der Preisplanung und keine bestätigte Zusage der Firma. | Aufteilung und Aufgaben bestätigen, mit dem Preisblatt C3 abgleichen. |
| Schulung (C2 Kapitel 6.4, Z3 Abschnitt 9) | 100 % durch Trainer von [PLATZHALTER FIRMA]; bei Bedarf Französisch oder Italienisch; eine zusätzliche Trainerschulung je Erweiterungsrelease. | Sprachkompetenz der Trainer; Annahme mit Preisblatt LP3 abgleichen. |
| Italienische Fachübersetzung (C2 Kapitel 5.4) | «Im Angebot enthalten», ohne Büro. | Büro beauftragen. |
| Demo (C2 Kapitel 6.5) | «Läuft auf Schweizer Infrastruktur», eingefroren, tägliche Rücksetzung. | Standort der Demo-Instanz belegen (E1 Kapitel 5.2 führt ihn als offen); Demo auf den Stand vom 02.10.2026 bringen. |
| Support (C2 Kapitel 6.3, Z3 Abschnitt 13) | 2nd und 3rd Level bei [PLATZHALTER FIRMA]; Codeänderungen durch die Technologiepartnerin über die CI/CD-Pipeline. | Besetzung, Stellvertretung, Bereitschaft und Eskalation; Vertrag zwischen [PLATZHALTER FIRMA] und der Technologiepartnerin über die Reaktionszeiten im 3rd Level. |
| Testzahlen (C2 Kapitel 6.1) | 434 API-Tests, 296 Oberflächen-Tests, 27 Tests der Kartenbibliothek, alle bestanden am 02.10.2026 (Lauf auf Commit `d790156`). Für End-to-End- und Kriterien-Fälle steht keine Zahl. | Zahlen bei Abgabe mit dem letzten Lauf abgleichen. |

## 3. Stand der Matrix

Die Matrix in C2 ist am 02.10.2026 mit `umsetzungsstand.md`, `fachliche-abweichungen.md` und der Analyse des
Abnahmeprotokolls abgeglichen. P bezeichnet den beschriebenen Umsetzungsstand, keine Abnahme.

- Neu P: slm 17 (Anzeige gemäss FAQ 52), slm 33 (A7X als Standard, Kernversion 1.5.0). Bereits P und bestätigt:
  slm 1, 5, 27.
- Auf T: slm 2 (Kartenviewer umgesetzt; massstabstreuer Server-Druck steht aus) und slm 53 (Hilfe umgesetzt; Inhalt des
  Handbuchs steht aus).
- Von T auf Z zurückgestuft, weil die Funktion selbst fehlt: slm 28 und 29 (ELO-Endpunkte); slm 9 (Seite 5.10) ist seit dem 02.10.2026 umgesetzt und wieder P.
- Von P auf T zurückgestuft: slm 21 (Grundlage JSON statt FGDB).
- Unverändert offen: slm 3 (Export und Mehrfachselektion seit dem 02.10.2026 in den Fachtabellen; Spaltenfilter,
  Spaltenauswahl und persistente Filter fehlen), 19, 20, 26, 36–41, 57.
- Die bewussten Abweichungen (ein Farbsatz für beide Ampeln, feste Vergleichsoperatoren, fest bleibende Auswahllisten,
  «nicht beurteilbar») stehen in `fachliche-abweichungen.md` und brauchen die Zustimmung der Auftraggeberin; im Konzept
  sind die festen Listen und «nicht beurteilbar» erwähnt, die beiden Punkte zur Abbildung 40 nicht.

## 4. Stand der FAQ-Grundlage

`FAQ-Export.md` entspricht dem PDF-Export des Forums vom 02.10.2026
(`docs/FAQ_Schiesslärmimmissionsmanagement_01_10_2026.pdf`): 182 Fragen, 182 beantwortet, keine offen. Am 02.10.2026, 12:29, beantwortet:
53, 61–63, 126, 145–152, 154, 169. Abgleich am 02.10.2026 Frage für Frage (Status, Antworttext, Datum):
keine fehlende Frage, keine abweichende Antwort. Drei Antworten tragen im PDF den Status «Antwort geändert» (30, 37, 59);
der Export führt sie als beantwortet mit Änderungsdatum. FAQ 59 nennt die 4'000 Stunden für LP1a seit dem 02.10.2026
ein Maximum. Das Forum führt zudem «Beilage A1 Software-Entwicklungsvertrag (agil) V2» und «Beilage C3 Preisblatt V2»
als ergänzende Unterlagen; beide liegen nicht im Repository.

In Version 1.0 eingearbeitet: FAQ 13, 17, 19, 28, 32, 36–38, 49, 50, 51, 52, 59, 66, 69, 70, 93, 97, 98, 99, 115, 116,
117, 120, 121, 128, 132, 133, 136–138, 140, 142, 157, 158, 160, 164–166, 170–174, 176, 177, 180.

Am 02.10.2026 beantwortet: FAQ 53 (KI-Einsatz; in den E1-Konzepten, Kapitel 7, eingearbeitet, Geltung ab der
Eingabefrist 19.10.2026). Am 02.10.2026 beantwortet und in Z3 (Abschnitte 1, 6
und 15) eingearbeitet: FAQ 59 (geändert), 61–63, 126, 151, 169 (geringere Stundenmenge LP1a ist zulässig).

## 5. Vor der Freigabe prüfen

- [ ] Alle Platzhalter aus Abschnitt 1 eingesetzt; in beiden Dokumenten kommt `[OFFEN` nicht mehr vor.
- [ ] Ableitungen aus Abschnitt 2 bestätigt oder korrigiert; Stundentabelle und Rollen stimmen mit dem Preisblatt überein.
- [ ] Vertragsstellen (Rahmenvertrag A1, A1.2, Teil A und B) je Aussage im Original geprüft.
- [ ] E1-Konzept je Partei vorhanden und mit C2 Kapitel 2.5 und 6.3 konsistent.
- [ ] Termine und Ergebnisse in Z3, C2, E1 und Preisblatt konsistent.
- [ ] Projektleitung hat den Plan geprüft.

## 6. Abschliessende Dokumentprüfung

Word-Dateien erzeugen:

```
npm run docs:docx -- docs/anforderungskatalog/C2-Loesungskonzept-SLIM.md --pages
npm run docs:docx -- docs/projects/hermes-projektplan-z3.md --pages
```

Seitenbudget: Lösungskonzept höchstens 15 A4-Seiten, Anforderungsmatrix höchstens zwei A4-Seiten (FAQ 8), Management
Summary höchstens eine halbe Seite (A2). Vorschau vom 02.10.2026: Konzept 15 Seiten (die letzte zu rund 40 % gefüllt),
Matrix 2 Seiten, Summary 22 Textzeilen. Die Vorschau ersetzt Bilder durch Flächen gleicher Grösse und ist kein Nachweis
der Word-Paginierung und der Lesbarkeit der Diagramme; auf diesem Rechner ist kein Word installiert. Die Word-Datei vor
der Abgabe in Word öffnen, Inhaltsverzeichnis aktualisieren und die Seitenzahl nachzählen. Eine Seitenvorgabe für den
Projektplan (Z3) ist im Repository nicht belegt; die Vorschau zählt 11 Seiten.

## E1 – Datenhaltungskonzepte (Stand 02.10.2026)

Zwei Dokumente statt eines: `E1-Datenhaltungskonzept-Generalunternehmerin.md` und
`E1-Datenhaltungskonzept-Technologiepartnerin.md`. Dieser Abschnitt sammelt, was intern zu prüfen und vor der Abgabe
einzutragen ist; in den Konzepten selbst stehen keine internen Prüfvermerke.

**Dringend, weil E1 ab der Eingabefrist gilt**

| Punkt | Stand | Zu tun |
| --- | --- | --- |
| Quellcode auf GitHub.com | nicht in der Schweiz | vor der Eingabefrist auf das eigene GitLab in der Schweiz umziehen, GitHub-Repository löschen, Datum und Beleg ins Konzept der Technologiepartnerin (Kapitel 10, Nr. 1) |
| Pipeline auf GitHub Actions | nicht in der Schweiz | vor der Eingabefrist verlegen (Nr. 2) |
| Datum der Eingabefrist | 19.10.2026, in beiden Konzepten eingetragen | erledigt |
| KI-Werkzeuge | deklariert sind ab der Eingabefrist ausschliesslich Infomaniak AI Services (Schweiz) | Programmierassistent und Vorübersetzung vor der Eingabefrist umstellen; Vertrag und Standortbestätigung beilegen |

**Quellen, die im Repository fehlen**

| Punkt | Bemerkung |
| --- | --- |
| Wortlaut von E1 (Teil A) | Der Geltungsbeginn «ab Eingabefrist» ist aus der Rückmeldung zum Entwurf übernommen; Teil A liegt nicht im Repository. Am Originaltext prüfen. |
| Antwort auf FAQ 53 vom 02.10.2026 | Erledigt: `FAQ-Export.md` führt die Antwort im Wortlaut. Die Konzepte geben sie zutreffend wieder (Deklaration von Art, Umfang und Verwendung; Vorgaben GS-VBS; vertragliche Regelung). Die Antwort selbst nennt keinen Geltungsbeginn; «ab der Eingabefrist 19.10.2026» folgt aus dem Geltungsbeginn von E1 (Zeile oben). |
| Formvorgaben für das Konzept (Teil C) | nicht geprüft |

**Einzutragen (Platzhalter in den Konzepten)**

- Beide: verantwortliche Person und Funktion.
- Generalunternehmerin: Hosting-Anbieter und Rechenzentren; zweiter Backup-Standort; SMTP-Anbieter;
  Monitoring-Produkt; Werkzeuge für Backlog, Tickets, Dokumentation und Dateiaustausch; Ablage der Importdateien;
  Standort der Demo-Instanz; Standort des Supports und Fernzugriff aus dem Ausland ja/nein; Schlüsselverwaltung beim
  Hosting-Anbieter und dessen Verfahren für administrative Zugriffe; KI-Werkzeuge der Generalunternehmerin oder
  «keine»; Frist für Offline-Entwürfe (Vorschlag 7 Tage); Aufbewahrungsfristen für Logs und Support-Daten.
- Technologiepartnerin: Firmenname; Standort der GitLab- und Nexus-Instanz mit Beleg; gehostete Entwicklungsumgebung
  ja/nein; Verträge zu den KI-Werkzeugen; Sicherung der Entwicklungssysteme (Ort, Aufbewahrung); Frist für
  Build-Artefakte und Pipeline-Logs.

**Abgleich mit C2**

C2 Kapitel 6.3 muss dieselbe KI-Regel und dieselbe Aufteilung der Parteien nennen wie die beiden Konzepte.

## Rückmeldung vom 02.10.2026 (Ausarbeitung zu E1, C2 und Z3) – was übernommen ist und was nicht

| Punkt | Umsetzung | Zu prüfen |
| --- | --- | --- |
| E1: Umzug bis zur Eingabefrist | Zusage im Konzept der Technologiepartnerin, Kapitel 10 | Am 02.10.2026 liegt der Code noch auf GitHub; der Umzug muss vor der Eingabefrist erfolgt und belegt sein. |
| KI-Deklaration | **Entschieden 02.10.2026:** Ab der Eingabefrist werden ausschliesslich KI-Dienste mit Verarbeitung in der Schweiz eingesetzt (Infomaniak AI Services); so steht es im Konzept der Technologiepartnerin, Kapitel 7. | Vor der Eingabefrist umstellen, damit die Deklaration zutrifft: den Programmierassistenten und die Vorübersetzung (`npm run translate`) auf Infomaniak AI Services; Vertrag und Standortbestätigung beilegen. |
| Excel-Import B1.6 (C2 3.2) | Text übernommen (Import-ID). Seit dem 02.10.2026: Ein Nachimport ersetzt nur die ausdrücklich ausgewählten Importdatensätze, manuelle Nutzungen, ELO-Meldungen und andere Importbestände bleiben unverändert, Wiederholungen erzeugen keine zusätzlichen Datensätze; der Ersatz «nach Zeitraum» ist gestrichen. Die Detailregeln (aggregierte Excel-Daten, Wiederholungsimporte, unvollständige Erfassung) werden mit KOMZ Lärm festgelegt und als Abnahmekriterien dokumentiert. | Die Aussage zu Schiessblöcken, Zeitkategorien und Tagesanteilen der Vorlage B1.6 ist aus der Rückmeldung übernommen und nicht gegen die Datei geprüft. Der Import ist nicht umgesetzt (Matrix Z). |
| Teiljahre (C2 4.2) | Text übernommen; seit dem 02.10.2026 mit Verweis auf die Detailregeln nach 3.2 und mit dem Prototyp-Stand im Text | Keine Hochrechnung und Mittelungsbasis im Berechnungsstand entsprechen dem Prototyp. Die Unterscheidung «erfasste Nullnutzung / fehlende Erfassung / verkürzte Betriebsphase» ist im Prototyp nur teilweise vorhanden (Ampel grau «keine Nutzungen erfasst»); eine erfasste Nullnutzung und Betriebsphasen gibt es als Daten noch nicht. |
| Gleichzeitige Nutzungen (C2 4.2) | Im Berechnungskern umgesetzt (Kernversion 1.5.0): Zeiträume werden für die Schiesshalbtage vereinigt; vorher wurden die Dauern addiert | Fachliche Bestätigung durch KOMZ Lärm (`fachliche-abweichungen.md`, A6). |
| Stunden je Arbeitspaket (Z3 6) | Tabelle übernommen, mit zwei Anpassungen, damit die Summen je Firma mit der Rollentabelle übereinstimmen: Business Analyse 75 / 245 statt 80 / 240, Reserve 125 / 125 statt 120 / 130. Totale unverändert: 1'450 + 1'350 = 2'800. | Die Zahlen sind eine Angabe der Firma; die zwei Anpassungen bestätigen oder die Rollentabelle ändern. |
| Kapazität je Rolle und Zeitraum (Z3 6.1) | Tabelle übernommen. In der Vorlage standen zwei Summen, die nicht zu den Zellen passten: Betrieb / Sicherheit 195 (die Zellen ergeben 190) und PI 4 500 (die Zellen ergeben 495). Mit 195 / 500 wäre das Total 2'805 gewesen; eingetragen sind 190 und 495, Total 2'800. | Trainer-Stunden (120 h) stehen in LP1a als «Einführung und Schulungsvorbereitung»; die Schulungen selbst sind LP3. Abgrenzung im Preisblatt prüfen. |
| Vertragsablauf und Meilensteine (Z3 4, 5) | Planungsphase Januar–März 2027, vier PI April 2027–März 2028, Abnahmekaskade in PI 4; M2 neu Juni, M3 September, M4 Dezember 2027 | Die Artikel 2.2.1, 2.2.6, 2.3.8, 2.3.9, 2.13.2 und A1.2 Ziffer 7 sind aus der Rückmeldung übernommen; der Rahmenvertrag liegt nicht im Repository. Am Vertragstext prüfen. |
| Demo-Rolle (C2 6.5) | Schiessplatz-Verantwortlicher statt Interessent | Das Demo-Konto `schiessplatz@demo.ch` ist den Schiessplätzen Geissalp und Thun zugeordnet. |
| slm 51 in der Matrix | Zeile berichtigt: slm 51 ist die Mehrsprachigkeit (B1 12.2), nicht nur die deutschen DB-Bezeichnungen; Kapitel 2.3 und 5.4 | – |
| 3rd-Level-Zugriff der Technologiepartnerin (E1) | Als kontrollierte Ausnahme inventarisiert: Konzept der Technologiepartnerin Kapitel 2, 6 und 9, Konzept der Generalunternehmerin Kapitel 9.1 | Alternative wäre, den Zugriff ganz auszuschliessen. |
| Sicherung der Entwicklungssysteme (E1, Technologiepartnerin Kapitel 8) | Täglich, 30 Tages- und 12 Monatsstände, zweiter Schweizer Standort, halbjährlicher Wiederherstellungstest mit Protokoll | Die Zahlen sind als Regel gesetzt und zu bestätigen; Stand der Einrichtung und Datum des ersten Tests eintragen. |
| Offline-Erfassung (E1, Generalunternehmerin Kapitel 9.3) | Je Mandant ausgeschaltet bis zur Vereinbarung der Einsatzbedingungen; Auswahlwerte höchstens 30 Tage (wie im ELO-Offline-Konzept), wartende Erfassungen höchstens 7 Tage; Regeln für Abmeldung, Sitzungsablauf, Kontowechsel | Fristen und zulässige Geräte mit der Auftraggeberin abstimmen. Im Prototyp gibt es keine Offline-Erfassung. |
| Systeminventar (E1, Generalunternehmerin Kapitel 6) | Serverseitiger Kartendruck und Redis ergänzt, dazu der Datenfluss Druckdienst → geo.admin.ch | – |
| C2 2.3 «Demo- neben Produktivmandant» | gestrichen; neu: reale und synthetische Daten liegen nie in derselben Instanz | – |
| C2 Status slm 2 und slm 53 | auf T gesetzt (Server-Druck bzw. Inhalt des Handbuchs stehen aus) | – |
| C2 Lasttest | Teiltests ab PI 1, vollständiger Nachweis auf der Zielplattform bis M4 (Dezember 2027), wie Z3 | – |
| C2 Quellenstand Frageforum | nachgeführt: «Stand 02.10.2026 (182 Fragen, alle beantwortet)» im Deckblatt-Kommentar von C2 und in Z3 (Abschnitte 1 und 15) | – |
| Import der Berechnungsdaten: Entwurf und Freigabe (C2 3.2) | **Vorgeschlagener Ablauf, keine bestätigte Vorgabe:** (1) Fehlerhafte Datei oder nicht auflösbare Referenzen brechen die betreffende Importtransaktion ab. (2) Steht eine ergänzende WLR- oder Betriebsdaten-Datei aus (B1 5.19), bleibt der Zustand ein unvollständiger Entwurf. (3) Die Freigabe als «aktuell gültig» oder «Stand MGDM» prüft die Vollständigkeit und unterbleibt bei relevanten Lücken. (4) Fehlende Pegel werden nie durch Nullwerte ersetzt; die Beurteilung gilt als «nicht beurteilbar». Ein pauschaler Abbruch bei jeder fehlenden Zeitgruppe ist verworfen, weil er die getrennte Nachlieferung verhindert. | Durch KOMZ Lärm bestätigen. Abstand des Prototyps zum Ablauf: Ein Waffensystem ohne Kombination ist heute eine Warnung statt ein Abbruch; es gibt keinen Entwurfsstatus und keine Vollständigkeitsprüfung beim Setzen der Zeiger; der Import kann einen Zustand direkt als aktuell markieren. Punkt (4) ist umgesetzt (`no-level`). |
