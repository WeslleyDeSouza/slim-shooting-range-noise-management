# SLIM – HERMES-Projektmanagementplan und Projektplan Z3

**Version 1.0 · Stand 02.10.2026 · Angebotsfassung**

Anbieterin (Generalunternehmerin): **[PLATZHALTER FIRMA]** · Subunternehmerin Entwicklung: **[OFFEN: Firmenname Technologiepartnerin]**
(nachfolgend «Technologiepartnerin») · Projektleitung: **[OFFEN: Projektleiter/in]**

Dieser Plan ist der Projektplan zum Zuschlagskriterium Z3 und zugleich der lieferantenseitige Projektmanagementplan
(PMP) nach Teil B 2.3.1. Organisation, Leistungsaufteilung und Aufwand sind verbindlich angeboten. Die Termine sind
auf einen Projektstart im Januar 2027 gerechnet; sie werden nach dem Zuschlag mit dem PMP der Auftraggeberin
abgestimmt und bei späterem Start gemeinsam neu baseliniert. Die Ausschreibung verwendet teilweise andere
Phasenbegriffe als HERMES 2022; die Zuordnung ist in Abschnitt 2 festgehalten.

Zugehörige Angebotsunterlagen: Lösungskonzept (Z2), Datenhaltungskonzept (E1), Preisblatt (C3).

## 1. Ziel, Umfang und Grundlagen

Ziel ist die Detailkonzeption, Realisierung und Einführung von SLIM mit dem geschuldeten funktionalen und
nichtfunktionalen Umfang, nachvollziehbarer Lärmberechnung, unabhängigen Berechnungsständen, ELO-Anbindung und
geregelter Betriebsübergabe.

**Anbieterorganisation:** [PLATZHALTER FIRMA] ist Generalunternehmerin und alleinige Vertragspartnerin; sie trägt die
Gesamtverantwortung und verantwortet Betrieb, Support und Schulung. Die Technologiepartnerin ist als spezialisierte
Technologiepartnerin und Subunternehmerin verbindlich für die Entwicklung eingebunden (LP1 und LP5).

| Paket | Behandlung im Plan | Leistungserbringung |
|---|---|---|
| LP1a | Grundauftrag: Projektmanagement, Design, Architektur, agile Planung, Realisierung und Einführung der zwingenden Anforderungen. Angeboten mit einem Maximalaufwand von 2'800 Stunden (Kostendach der Ausschreibung: 4'000 Stunden) | Technologiepartnerin 1'450 h, [PLATZHALTER FIRMA] 1'350 h (Abschnitt 6) |
| LP1b | Option: mobile Erfassungsmaske als ELO-Ersatz und Simulation, gemeinsam abgerufen, 750 Stunden (FAQ 66, 117); Realisierung nach Abruf | Technologiepartnerin |
| LP2 | Lizenzen einschliesslich Drittlizenzen; Deklaration im Preisblatt. Die eingesetzten Open-Source-Komponenten sind lizenzkostenfrei; an den vorbestehenden Komponenten der Technologiepartnerin erhält die Auftraggeberin über [PLATZHALTER FIRMA] das unentgeltliche Nutzungsrecht gemäss Art. 6.2.4 Rahmenvertrag | – |
| LP3 | Option Schulung: 10 initiale und 2 wiederkehrende Schulungen (Abschnitt 9) | [PLATZHALTER FIRMA], zu 100 % durch eigene Trainer |
| LP4 | Option Applikationsbetrieb, Wartung und Support im SaaS-Modell über die Betriebsphase von zehn Jahren (Abschnitt 13); Infrastruktur- und Hostingkosten sind gemäss FAQ 30, 67 und 131 in LP4 einzurechnen | [PLATZHALTER FIRMA] |
| LP5a / LP5b | Gesondert beauftragte Erweiterungen während Projekt bzw. Betrieb; keine stillschweigende Finanzierung unerledigter Muss-Anforderungen | Entwicklung: Technologiepartnerin; Überführung in den Betrieb: [PLATZHALTER FIRMA] |

Massgebende Projektquellen: Teil A (Z3), Teil B insbesondere 2.3.1–2.3.3 und 2.9, B1 samt Beilagen, Rahmenvertrag mit
Abnahmevorschriften (A1, A1.2) und das Frageforum mit Stand 01.10.2026 (182 Fragen, 167 beantwortet). Vertragsaussagen
werden mit Dokument und Artikelnummer belegt; beantwortete Fragen gelten als Auskunft der Auftraggeberin, unbeantwortete
Fragen sind keine Entscheidung (Abschnitt 15).

**Vorhandener Prototyp (MVP) und ELO-Erfahrung als Ausgangspunkt:** Die Technologiepartnerin bringt einen lauffähigen Prototyp
von SLIM ein und hat ELO entwickelt, das System auf der anderen Seite der Schnittstelle. Beides reduziert das
Umsetzungsrisiko für den Bund; darauf beruhen der angebotene Maximalaufwand von 2'800 statt 4'000 Stunden für LP1a
und die geplante produktive Einführung im März 2028, drei Monate vor dem vertraglichen Termin (Abschnitt 4).
Stand 02.10.2026 sind im Prototyp umgesetzt: Anmeldung, Rollen und Objektregeln, Übersicht mit berechneten Ampeln, die
Masken Schusszahlen, Details und Simulation, der GIS-Kartenviewer, die Datenverwaltung, Auswahllisten, erweiterte
Konfiguration, Hilfe, das Datenmodell nach B1 Kapitel 10 und der gegen Beilage B1.4 geprüfte Berechnungskern. Noch
nicht umgesetzt sind insbesondere die ELO-Schnittstelle (slm 28–30), der FGDB-Zugriff über GDAL (slm 19–21), der Betrieb
auf PostgreSQL/PostGIS mit Views (slm 38), die Seite 5.10 (slm 9), der Excel-Import der Schusszahlen (slm 37) und die
Exporte nach B1.6 und MPV (slm 40, 41). Der Stand je Anforderung steht in der Matrix des Lösungskonzepts.

Vorhandene Funktionen werden zu Projektbeginn gemeinsam überprüft, fachlich validiert und in die vereinbarte
Architektur überführt; die Releaseplanung wird anhand des bestätigten Restumfangs konkretisiert. Der Prototyp verkürzt
die Realisierung, ersetzt aber weder die Mitwirkung der Auftraggeberin noch Integration und Abnahme. Er ist
vorbestehende Software der Technologiepartnerin (Lösungskonzept 2.2); seine Erstellung wird nicht als Projektaufwand verrechnet.

## 2. HERMES-Vorgehen und Zuordnung

HERMES 2022 unterscheidet im agilen Vorgehen Initialisierung, Umsetzung und Abschluss. Teil B verlangt HERMES 2022,
verwendet zugleich die Begriffe «Konzept, Realisierung und Einführung» und «Entwicklung Agil». Diese Begriffe werden
nicht als identische Standardphasen ausgegeben.

**Tailoring:** HERMES-2022-Szenario IT-Entwicklung mit agiler Umsetzung; Konzept, Realisierung und Einführung werden als
nachvollziehbare Arbeitsschwerpunkte und Freigabepunkte innerhalb der Umsetzung geplant. Die endgültige Szenario- und
Phasenzuordnung stimmt die Projektleitung mit dem Auftraggeber ab. Keine Vorgabe aus Teil B entfällt dadurch.

| HERMES-Rahmen | SLIM-Arbeit / Nachweis |
|---|---|
| Initialisierung / Übergabe in die Durchführung | Bestehenden Projektauftrag der Auftraggeberin, Beschaffungsresultat, Ziele und Freigaben übernehmen; eine bereits erledigte Initialisierung wird nicht erneut erbracht |
| Umsetzung: Konzeptschwerpunkt | Anforderungen präzisieren, Architektur und Sicherheits-/Betriebsansatz validieren, Backlog und Releaseplan belastbar machen |
| Umsetzung: Realisierungsschwerpunkt | Getestete Inkremente auf dem Akzeptanzsystem; laufendes Refinement und Aktualisierung der Konzepte |
| Umsetzung: Einführungsschwerpunkt | Migration, Befähigung, Betriebsbereitschaft, Abnahmen und gestufte Produktivsetzung |
| Abschluss | Übergabe, offene Punkte und Zuständigkeiten, Projektschlussbeurteilung und formeller Abschlussentscheid |

Methodenquelle: [Offizielles HERMES-Referenzhandbuch, Ausgabe 2022](https://www.hermes.admin.ch/_Resources/Persistent/e/8/5/9/e8596469c2f16dc3e0e5c43c85e6f7743f22435a/HERMES_PjM2022_DE.pdf).

**Programm-Inkremente (PI):** Der Rahmenvertrag verlangt je PI ein separates Angebot mit geschätztem Maximalaufwand,
Kostendach und Terminplan, zu erstellen innerhalb von drei Wochen nach Angebotsaufforderung (Art. 2.3.4); die
Auftraggeberin rechnet mit vier bis sechs PI von rund drei Monaten (FAQ 69). Dieser Plan sieht fünf PI vor: PI 1
Januar–März 2027, PI 2 April–Juni 2027, PI 3 Juli–September 2027, PI 4 Oktober–Dezember 2027, PI 5 Januar–März 2028.
Anzahl, Dauer und Zuordnung zu den Releases werden in der agilen Planung gemeinsam festgelegt.

## 3. Organisation und Entscheidungen

| Rolle | Verantwortung | Firma | Besetzung |
|---|---|---|---|
| Auftraggeber / zuständiges Entscheidungsgremium | Projektfreigaben, Mittel, verbindliche Leistungsänderungen und Abschluss im Rahmen der Kompetenzordnung | Auftraggeberin | AG benennt |
| Fachprojektleiter / Auftraggebervertreter | Koordination der Mitwirkungen und interne Abstimmung | Auftraggeberin | AG stellt |
| Product Owner | Fachliche Priorisierung, Refinement und fachliches Feedback; Priorisierung innerhalb des vereinbarten Umfangs ohne Change Request (FAQ 51) | Auftraggeberin | AG stellt |
| Projektleiter/in | SPOC, Termine, Ressourcen, Reporting, Risiken und Eskalationen; Entscheidungsgrundlagen vorbereiten | [PLATZHALTER FIRMA] | [OFFEN: Projektleiter/in] |
| Lead-Business-Analyst/in | Fachregeln, Anforderungskatalog, Abnahmekriterien, Nachverfolgbarkeit und Workshops | [PLATZHALTER FIRMA] | [OFFEN: Lead-Business-Analyst/in] |
| Lead-Applikationsentwickler / Architektur | Architektur, Implementierung, Datenmodell, Integrationen, technische Nachweise | Technologiepartnerin | Weslley De Souza |
| Applikationsentwicklung | Implementierung, automatisierte Tests, Schnittstellen | Technologiepartnerin | [OFFEN: Applikationsentwickler/in] |
| Qualitätssicherung / Testing | Unabhängige Sollwerte, Testplanung, Integrations-, End-to-End- und Lasttests, Nachweisführung | [PLATZHALTER FIRMA] | [OFFEN: Qualitätssicherung] |
| Betrieb / Sicherheit | Schweizer Plattform, Berechtigungen, Deployment, Monitoring, Restore, Betriebsübergabe | [PLATZHALTER FIRMA] | [OFFEN: Betrieb / Sicherheit] |
| Trainer | Schulungsunterlagen und Durchführung der Schulungen (LP3) | [PLATZHALTER FIRMA] | Trainer von [PLATZHALTER FIRMA] |
| KOMZ Lärm / Anwendervertretung | Fachliche Prüfung, fachliche Entscheidungen und repräsentative Anwenderszenarien | Auftraggeberin | AG koordiniert |

Projektleiter/in, Lead-Business-Analyst/in und Lead-Applikationsentwickler sind namentlich besetzt (Eignungskriterium
E3). Sie üben ihre Rolle federführend und mit dem höchsten Arbeitspensum aus und vertreten sie an der Präsentation
(Z6, FAQ 133). Für jede Schlüsselrolle ist eine Stellvertretung benannt (Abschnitt 6.1). Fällt eine Schlüsselperson
aus, stellt die Anbieterin innert 14 Tagen gleich qualifizierten Ersatz; die Einarbeitung erfolgt ohne Kostenfolge für
die Auftraggeberin (E4). Die Entwicklungsleistungen einschliesslich Test und Dokumentation werden in der Schweiz
erbracht (E5).

## 4. Termin- und Meilensteinplan

**Planungsgrundlage – frühere Produktivsetzung dank MVP:** Projektstart im Januar 2027, Schlussabnahme im
Januar/Februar 2028, produktive Einführung im März 2028, Projektabschluss im April 2028. Der Rahmenvertrag nennt als
verbindlichen Termin «Einführung SLIM: 30.06.2028» (Art. 2.11.1). Dieser Termin bezeichnet gemäss FAQ 50 die
produktive Einführung und liegt nach Schlussabnahme und Schlussgenehmigung; für die Schlussabnahmetests sind rund
30 Tage vorgesehen. Der Plan sieht die produktive Einführung damit **rund drei Monate vor dem vertraglichen Termin**
vor; diese drei Monate bleiben als Terminreserve bestehen.

Möglich macht das der vorhandene Prototyp (MVP): Die Zeit bis M1 dient der gemeinsamen Überprüfung und fachlichen
Validierung vorhandener Funktionen, nicht ihrem Aufbau; M2 und M3 bauen darauf auf, und der fachliche Durchstich (M3)
überführt eine Kette, die im Prototyp bereits läuft. Die Schulungen von [PLATZHALTER FIRMA] (Abschnitt 9) sind auf die Einführung
im März 2028 ausgerichtet. Die Termine bleiben von der Mitwirkung der Auftraggeberin (Daten, Fachentscheide,
ELO-Testumgebung), Integration und Abnahme bestimmt.

| Meilenstein | Zieltermin | Ergebnisse und Entscheidungskriterien |
|---|---|---|
| M0 – Projektstart abgestimmt | Januar 2027 | Auftrag und Kompetenzen geklärt, Team verfügbar, Mitwirkungsplan, Zugänge, PMP und Start-Backlog abgestimmt |
| M1 – Konzeptbasis bestätigt, Prototyp überführt | März 2027 | Vorhandene Funktionen gemeinsam überprüft, fachlich validiert und in die vereinbarte Architektur überführt; bestätigter Restumfang; Architektur, Datenmodell nach B1 Kapitel 10, Fachregeln, Sicherheits-/Betriebsansatz, priorisierter Backlog, Test- und Migrationsansatz und Aufwandprognose nachvollziehbar |
| M2 – Technische Integrationsbasis nachgewiesen | Mai 2027 | PostgreSQL/PostGIS, unabhängige Zustände, FGDB-Import und -Export über GDAL mit den Testdaten von KOMZ Lärm und ELO-Verbindung auf der Akzeptanzumgebung geprüft |
| M3 – Fachlicher Durchstich mit dokumentiertem Review | August 2027 | Die im Prototyp vorhandene Kette Nutzungen → Betriebsdaten → Quellenverteilung → Anhang 7/9 → Beurteilung und Anzeige läuft auf der Zielarchitektur mit Daten der Auftraggeberin und unabhängigen Sollwerten; fachliches Review durch KOMZ Lärm dokumentiert (Zwischenreviews ab M1) |
| M4 – Einführungskandidat bereit | November 2027 | Gesamter geschuldeter Umfang für die Anwenderprüfung bereit; Dokumentation, Rollen, Migration und Betriebsabläufe prüfbar; Restmängel klassifiziert |
| M5 – Schlussabnahme und Freigabe der Produktivsetzung | Januar/Februar 2028 | Schlussabnahmetests (rund 30 Tage) gemäss A1.2 bestanden, Schlussgenehmigung erteilt, Migration geprobt, Berechtigungen und Support bereit, Restore und Rollback geprüft |
| M6 – Einführung (produktive Inbetriebnahme) | März 2028; vertraglicher Termin 30.06.2028 | Produktivmigration durchgeführt, Betrieb an [PLATZHALTER FIRMA] übergeben (LP4), erste Betriebszeit begleitet, offene Punkte zugeordnet |
| M7 – Projektabschluss | April 2028 | Ergebnisse übergeben, Projektschlussbeurteilung und Abschlussentscheid |

Ein Review ist keine rechtswirksame Abnahme. Teil- und Schlussabnahmen sowie Zeichnungsberechtigungen richten sich
nach Vertrag und Kompetenzordnung. «Bedingt abgenommen» heisst: geringfügige Mängel werden innerhalb der vereinbarten
Frist behoben; «nicht abgenommen»: Nachbesserung und Wiederholung der Schlussabnahme. Eine vom Lieferanten zu
vertretende Verzögerung verschiebt den Termin nach Art. 2.11.1 nicht (FAQ 50).

### Abhängigkeiten und Terminreserve

- PostgreSQL/PostGIS und FGDB liegen auf dem kritischen Pfad und werden deshalb bis M2 nachgewiesen. Der Prototyp
  läuft auf SQLite/MariaDB; die Typzuordnung der vorbestehenden Bibliotheken für PostgreSQL ist die erste Aufgabe der
  Technologiepartnerin in PI 1. Das FGDB-Schema wird zu Beginn der Realisierung gemeinsam festgelegt, eine Muster-FGDB stellt
  die Auftraggeberin im Projektverlauf bereit (FAQ 99, 176); die Lese- und Schreibfähigkeit über GDAL wird validiert,
  sobald die Testdaten von KOMZ Lärm vorliegen.
- ELO-Schnittstelle: Die Auftraggeberin verantwortet die Schnittstellenspezifikation auf Seite ELO unter Zuzug der
  ELO-Entwicklerfirma, stellt zu Projektbeginn eine Testumgebung bereit (vorbehältlich des Zeitbedarfs für
  Anpassungen aus der Spezifikation) und trägt allfällige Anpassungen an ELO (FAQ 17, 91, 177). Abstimmung und
  Testzugang werden vor M2 terminiert.
- Initiale Datenbereitstellung: Format und Struktur werden im Projekt festgelegt, die Qualitätssicherung (Dubletten,
  Bezeichnungen, fehlende Zuordnungen) liegt bei der Auftraggeberin, die Aufbereitung per ETL braucht etwa drei Monate
  (FAQ 28; Mengengerüst: 120 aktive und 150 historisch relevante Schiessplätze, 2–40 Stellungsräume je Platz, rund
  250 Waffen/Kaliber, rund 50'000 Zuordnungen). Diese drei Monate laufen ab Festlegung des Formats und werden im
  Mitwirkungsplan terminiert.
- Fachregelfreigaben liegen vor der betreffenden Abnahme vor; offene Regeln mit Auswirkung auf Pegel werden im
  Fachentscheidregister geführt (Abschnitt 9) und nicht als unkritische Restpunkte behandelt.
- Zwischen M4 und M5 ist Zeit für Anwenderprüfung, Fehlerbehebung und eine erneute Migrationsprobe eingeplant.
  Verzug wird früh eskaliert; die Reserve ist kein Grund, notwendige Tests zu verschieben.

## 5. Agile Durchführung und Releases

Zweiwöchige Sprints während der aktiven Entwicklung. Das Refinement bereitet klare Akzeptanzkriterien, Daten und
Abhängigkeiten vor. Jeder Sprint liefert ein lauffähiges Inkrement auf das Akzeptanzsystem, mit formeller
Iterationsabnahme nach A1.2; das Feedback fliesst in die Folgeplanung ein. Sprints werden nach verfügbarer Kapazität
geplant.

| Release-Schwerpunkt | PI | Inhalte |
|---|---|---|
| R1 – Plattform und Referenzen | PI 1 | Umgebungen in der Schweiz, Build und Deployment, PostgreSQL/PostGIS, MFA (TOTP) und Rechte, Stammdaten und Struktur nach B1 Kapitel 10 |
| R2 – Austausch und Fachkern | PI 2 | FGDB über GDAL, WLR und Betriebsdaten, ELO-Schnittstelle, Quellenverteilung, Kalender, Rundung, Referenzrechnungen und Reproduzierbarkeit |
| R3 – Fachoberflächen | PI 3–4 | Schiessplatz-Übersicht 5.10, Nutzungen, Berechnungsverwaltung, Karte in der Datenverwaltung, Importe und Exporte, konfigurierte Fachparameter und Rollenoberflächen |
| R4 – Einführungskandidat | PI 4–5 | Vollständige Sprachen und Dokumentation, Last-, Sicherheits- und Anwendertests, Migration, Befähigung und Betrieb |

Sicherheit, Dokumentation und Tests laufen in allen Releases mit. Optionen (LP1b) werden nach Abruf in den Releaseplan
integriert; die Auswirkungen auf Kapazität und Termine werden vor der Zusage ausgewiesen.

**Fertig-Kriterium eines Inkrements:** Akzeptanzkriterien erfüllt, Code geprüft, relevante automatisierte Tests
bestanden, Migration und Deployment geprüft, Rechte und Fehlerfälle behandelt, Dokumentation und Matrix aktualisiert,
Ergebnis auf dem Akzeptanzsystem demonstrierbar. Ein grüner Unit-Testlauf ersetzt keine fehlenden Pflichtnachweise.

## 6. Ressourcen- und Aufwandsplanung

LP1a wird mit einem Maximalaufwand von **2'800 Stunden** angeboten: **1'450 Stunden der Technologiepartnerin** und **1'350
Stunden von [PLATZHALTER FIRMA]**. Das Kostendach der Ausschreibung beträgt 4'000 Stunden (Preisblatt C3). Die Differenz erklärt
sich aus dem vorhandenen Prototyp und der ELO-Erfahrung der Technologiepartnerin (Abschnitt 1). Die Anbieterin realisiert den
Grundauftrag mit sämtlichen Muss-Anforderungen innerhalb dieses Maximalaufwands; vergütet wird der tatsächliche
Aufwand (Rahmenvertrag Art. 3.1).

Die Technologiepartnerin führt Architektur, Integration und Entwicklung. [PLATZHALTER FIRMA] führt Projektleitung, Business Analyse,
Qualitätssicherung, Dokumentation, Einführung und Betriebsübergabe.

| Arbeitspaket | Technologiepartnerin | [PLATZHALTER FIRMA] | Stunden |
|---|---:|---:|---:|
| Projektleitung, Steuerung, Reporting und Koordination | – | 280 | 280 |
| Business Analyse, Fachklärung und Anwenderworkshops | 65 | 250 | 315 |
| Architektur, Sicherheit und technische Konzepte | 245 | – | 245 |
| Entwicklung einschliesslich Datenmodell, GIS und Integrationen | 1'015 | – | 1'015 |
| Fach-, Integrations-, End-to-End- und Lasttests, Qualitätssicherung | – | 385 | 385 |
| Migration, Dokumentation, Einführung und Betriebsübergabe | – | 315 | 315 |
| Aufwandsreserve | 125 | 120 | 245 |
| **Summe LP1a** | **1'450** | **1'350** | **2'800** |

Dies sind Arbeitspakete, keine zusätzlich zu summierenden Personenbudgets. Die automatisierten Tests der Technologiepartnerin
gehören zum Paket Entwicklung; das Paket Tests und Qualitätssicherung ist die davon unabhängige Prüfung durch [PLATZHALTER FIRMA].
Fehlerschleifen sind in den Arbeitspaketen und in der Reserve berücksichtigt. Die Reserve ist weder pauschal
abrechenbar noch ein Anspruch auf Ausschöpfung des Maximalaufwands.

### 6.1 Kapazitätsplanung je Rolle

Projektdauer Januar 2027 bis April 2028 (16 Monate): fünf Programm-Inkremente von je drei Monaten (Januar 2027 bis
März 2028) und der Abschlussmonat April 2028. Das durchschnittliche Pensum bezieht sich auf 160 Arbeitsstunden je
Monat über diese 16 Monate (2'560 Stunden je Vollzeitstelle). Die Rollenstunden ergeben zusammen 2'555 Stunden, mit
der Reserve von 245 Stunden 2'800 Stunden.

| Rolle | Firma | Person | Stellvertretung | Stunden | Ø Pensum |
|---|---|---|---|---:|---:|
| Projektleiter/in | [PLATZHALTER FIRMA] | [OFFEN: Projektleiter/in] | [OFFEN: Stellvertretung Projektleitung] | 280 | 11 % |
| Lead-Business-Analyst/in | [PLATZHALTER FIRMA] | [OFFEN: Lead-Business-Analyst/in] | [OFFEN: Stellvertretung Lead-Business-Analyst/in] | 250 | 10 % |
| Lead-Applikationsentwickler / Architektur | Technologiepartnerin | Weslley De Souza | [OFFEN: Stellvertretung Lead-Applikationsentwickler] | 765 | 30 % |
| Applikationsentwicklung | Technologiepartnerin | [OFFEN: Applikationsentwickler/in] | [OFFEN: Stellvertretung Applikationsentwicklung] | 560 | 22 % |
| Qualitätssicherung / Testing | [PLATZHALTER FIRMA] | [OFFEN: Qualitätssicherung] | [OFFEN: Stellvertretung Qualitätssicherung] | 385 | 15 % |
| Betrieb / Sicherheit | [PLATZHALTER FIRMA] | [OFFEN: Betrieb / Sicherheit] | [OFFEN: Stellvertretung Betrieb / Sicherheit] | 315 | 12 % |
| Reserve (rollenübergreifend) | Technologiepartnerin 125 / [PLATZHALTER FIRMA] 120 | – | – | 245 | – |
| **Summe** | | | | **2'800** | |

Die Stunden je Rolle folgen aus den Arbeitspaketen: Architektur (245 h) und Entwicklung (1'015 h) verteilen sich auf
die beiden Entwicklungsrollen, der Anteil der Technologiepartnerin an der Business Analyse (65 h, Spezifikation von
Schnittstellen und Datenmodell) liegt beim Lead-Applikationsentwickler, das Paket Migration, Dokumentation, Einführung
und Betriebsübergabe (315 h) bei der Rolle Betrieb / Sicherheit. Die Durchschnittspensen der Schlüsselrollen liegen
zwischen 10 % und 30 %. Das entspricht dem Projektvolumen: Der Maximalaufwand ist dank des vorhandenen Prototyps auf
2'800 Stunden reduziert und verteilt sich auf 16 Monate; die Verfügbarkeit ist über die benannten Stellvertretungen
abgesichert. Die Verteilung der Stunden je Person auf die PI: [OFFEN: Pensen je Person und PI]. Die Kapazitäten der Auftraggeberin je Workshop, Review und Abnahme werden im
Mitwirkungsplan vereinbart (Abschnitt 12).

## 7. Ergebnisse und Lieferobjekte

Alle Ergebnisse erhalten Verantwortlichen, Reviewer, Version und Freigabestand. Sie dürfen als abgestimmte Kapitel
gemeinsamer Dokumente geführt werden, sofern die Anforderungen vollständig auffindbar bleiben.

| Ergebnisgruppe | Geforderte / vorgesehene Inhalte | Federführung |
|---|---|---|
| Projektmanagement | PMP, Organisation, Termine und Ressourcen, Statusberichte, Entscheidungs-, Risiko- und Änderungsregister | Projektleitung ([PLATZHALTER FIRMA]) |
| Fachliche Basis | Detailspezifikation, Backlog, Fachregeln und Akzeptanzkriterien mit B1-Zuordnung | Business Analyse ([PLATZHALTER FIRMA]) + PO |
| Architektur und UX | Systemarchitektur, Usability-Konzept, GUI-Guidelines, Rollenkonzept | Architektur (Technologiepartnerin) + Business Analyse |
| Integration und Daten | Schnittstellenkonzept, Migrationskonzept, Schema- und Mappingdokumentation | Entwicklung (Technologiepartnerin) |
| Qualität | Testkonzept, Qualitätsmanagementplan, Testnachweise, Mängelliste | Qualitätssicherung ([PLATZHALTER FIRMA]) |
| Release und Konfiguration | Releasemanagementkonzept, Konfigurationsmanagementplan, nachvollziehbare Builds | Entwicklung (Technologiepartnerin) + Betrieb ([PLATZHALTER FIRMA]) |
| Sicherheit und Betrieb | Informationssicherheitskonzept, Betriebskonzept, IT Service Continuity Management, Backup-, Restore- und Notfallverfahren | Betrieb / Sicherheit ([PLATZHALTER FIRMA]) |
| Einführung | Ausbildungskonzept, Einführungskonzept, deutsches Benutzerhandbuch, Schulungsunterlagen, Übergabeprotokolle | Business Analyse + Trainer ([PLATZHALTER FIRMA]) |
| Abschluss | Abnahmeunterlagen, offene Punkte mit Verantwortlichen, Projektschlussbeurteilung | Projektleitung ([PLATZHALTER FIRMA]) |

Konzepte werden iterativ aktualisiert und liegen bei Einführung und Abnahme in konsistenter Endfassung vor. Die
Architektur-Dokumente des Prototyps sind Ist-Beschreibungen und werden im Projekt zur Zielarchitektur fortgeschrieben.

## 8. Kommunikation und Reporting

| Termin | Rhythmus / Teilnehmende | Zweck |
|---|---|---|
| Steuergremium | Gemäss Teil B monatlich 2 h: Projektleitung Lieferantin, Projektleitung AG, PO | Inhalt, Termine, Aufwand, Risiken und Entscheidungen |
| Kernteam | Gemäss Teil B alle 1–3 Wochen 2 h, PO; Projektleitungen bei Bedarf | Fachliche und technische Klärung |
| Sprint Planning / Review / Retrospektive | Je zweiwöchigem Sprint; passende Team- und Stakeholderbesetzung | Planung, Feedback auf dem Akzeptanzsystem, Verbesserung |
| Refinement | Regelmässig passend zum Backlog; möglichst mit vorhandenen Fachterminen gebündelt | Anforderungen und Testbarkeit vorbereiten |
| Eskalation | Bei kritischen Abweichungen unverzüglich über Projektleitung / SPOC | Entscheidungsbedarf und Auswirkungen transparent machen |

Statusbericht vor dem Steuergremium: Lieferfortschritt je Anforderung und Release, Meilensteine, Ist-Aufwand,
Restaufwand, Prognose bei Fertigstellung, Risiken, Mitwirkungen und Entscheidungen. Prozentsätze werden nicht aus
Codezeilen oder Testanzahl abgeleitet. Besprechungen und Dokumentation auf Deutsch; Vor-Ort-Termine gemäss Teil B
schweizweit, insbesondere in Bern.

## 9. Qualität, Einführung und Abnahme

- Fachtests mit unabhängigen Empa-Referenzen (Formelblätter A9X/A7X der Beilage B1.4, FAQ 19, 98) und dokumentierten
  Entscheidungen; Rohwert, Anzeige und Beurteilungswert werden unterschieden. Weitere Referenzfälle werden zu Beginn
  der Realisierung als Abnahmegrundlage gemeinsam festgelegt.
- Zustandsisolation, Importabbruch, Dezimalmengen, lokale Feiertage, gemischte Baujahre und die Regel «nicht
  beurteilbar» werden auf Service- und Datenbankebene geprüft.
- ELO-Vertrag, Wiederholungen, Fehler und Berechtigungen werden über Integrationstests abgesichert.
- Echte FGDB-Dateien werden mit vollständigem Attribut-, Beziehungs- und Geometrieabgleich geprüft.
- Rollenbezogene Browserabläufe, MFA, Barrierefreiheit (Tastaturbedienung und Kontraste, orientiert an eCH-0059 / WCAG 2.1 AA) und Last mit zehn gleichzeitigen
  Nutzern werden auf der Zielumgebung geprüft.
- Testläufe werden mit Commit, Datum, Umgebung und Ergebnis dokumentiert; Testgerüste und übersprungene Tests werden
  separat ausgewiesen und gelten nicht als Nachweis.
- Die Migration wird stufenweise auf dem Akzeptanzsystem geprobt; Mengen, Zuordnungen und ausgewählte fachliche
  Ergebnisse werden gegengeprüft. Ein historischer Vollimport ist nicht Teil von LP1a (B1 9.2).
- Vor der Produktivsetzung wird die Betriebsorganisation aktiviert, Rollback und Restore werden nachgewiesen und die
  Bereitschaft dokumentiert.
- Die erste Betriebszeit wird begleitet; Mängel werden nach den Vertragsregeln priorisiert (A1 Art. 2.12, 2.13.2;
  A1.2 Kapitel 7).

**Schulung (LP3):** Die Schulungen werden zu 100 % durch die Trainer von [PLATZHALTER FIRMA] durchgeführt: zehn initiale Schulungen
zur Einführung und zwei wiederkehrende über die Laufzeit, z. B. bei Wechsel der Applikationsverantwortung (FAQ 36, 38).
Geschult werden die Applikationsverantwortlichen der Auftraggeberin, die danach die Benutzer schulen und den 1st-Level-
Support leisten: vor Ort (Bern und weitere Standorte), rund ein halber Tag, zwei bis drei Personen je Schulung,
Unterlagen auf Deutsch, Durchführung bei Bedarf auch auf Französisch oder Italienisch (FAQ 37, 70). Die initialen
Schulungen finden nach dem Einführungskandidaten (M4) und vor der produktiven Einführung (M6, März 2028) statt, damit
die Applikationsverantwortlichen zur vorgezogenen Produktivsetzung befähigt sind.

## 10. Risiken und Massnahmen

| Risiko | Auswirkung | Massnahme / Verantwortlicher |
|---|---|---|
| Umstellung des Prototyps auf PostgreSQL/PostGIS | Architektur- und Migrationstermine gefährdet | Typzuordnung der vorbestehenden Bibliotheken in PI 1, Nachweis auf dem Akzeptanzsystem bis M2; Lead-Applikationsentwickler |
| FGDB-Feld- oder Geometrieverlust | Fachliche Ergebnisse und Datenaustausch unbrauchbar | Lesen und Schreiben über GDAL, Validierung mit den Testdaten von KOMZ Lärm und vollständiger Roundtrip vor M2; Architektur / Qualitätssicherung |
| Fachliche Sonderfälle ungeklärt | Falsche Beurteilung oder Abnahmeverzug | Fachentscheidregister, Review durch KOMZ Lärm, unabhängige Sollwerte; Business Analyse |
| Daten oder ELO-Zugänge verspätet | Integration und Migration verschoben | Mitwirkungsplan und frühe Eskalation; Projektleitungen AG und Lieferantin |
| Schlüsselpersonen fallen aus | Lieferfähigkeit sinkt | Benannte Stellvertretungen, Wissenstransfer, nachvollziehbare Dokumentation, Ersatz innert 14 Tagen (E4); Projektleitung |
| Restumfang höher als angenommen | Maximalaufwand von 2'800 Stunden reicht nicht | Bestätigter Restumfang bei M1, monatliche Prognose bei Fertigstellung, Aufwandsreserve von 245 Stunden; Projektleitung / Lead-Applikationsentwickler |
| Übergabe zwischen zwei Firmen (Entwicklung und Betrieb) | Reibungsverluste, unklare Zuständigkeit bei Störungen | Rolle Betrieb / Sicherheit von [PLATZHALTER FIRMA] ab Projektbeginn im Team, gemeinsame CI/CD-Pipeline, dokumentierter Übergabeprozess, Gesamtverantwortung bei [PLATZHALTER FIRMA] (Abschnitt 13) |
| Sicherheits- und Betriebsanforderungen spät geprüft | Keine Produktivfreigabe | Kontinuierliche Prüfung, Restore- und Lasttests vor M5; Betrieb / Qualitätssicherung |
| Nutzungsrechte an vorbestehender Software | Übergabe- und Nutzungsrechte strittig | Deklaration als vorbestehend, Nutzungsrecht nach Art. 6.2.4, Quellcode-Lieferung und SBOM (Lösungskonzept 2.2); Anbieterin |

## 11. Änderungen, Werkzeuge und Dokumentenlenkung

Jede Änderung erfasst Anlass, B1- und Backlog-Bezug, Nutzen, Auswirkungen auf Umfang, Termine, Kosten und Sicherheit
sowie die Entscheidung. Massgebend ist B1 in der Fassung bei Vertragsabschluss: Konkretisierungen ohne Änderung des
vereinbarten Umfangs gehören zu LP1a, inhaltliche Abweichungen sind Change Requests unter LP5a (FAQ 51, 68).
Fehlerbehebung und die Konkretisierung bestehender Pflichten sind kein bezahlter Change. Die Priorisierung durch den
Product Owner ändert kein vertragliches Kostendach. Zu einem Change Request nimmt die Anbieterin innerhalb von zehn
Arbeitstagen Stellung (Rahmenvertrag Art. 2.15).

Werkzeuge: Der Quellcode liegt in einem selbst betriebenen GitLab, Container-Images und Pakete in einem selbst
betriebenen Nexus; beide laufen ab Projektbeginn auf Schweizer Infrastruktur. Die CI/CD-Pipeline (Build, Lint,
automatisierte Tests, Bereitstellung auf Akzeptanz und Produktion) ist der einzige Weg von der Entwicklung in den
Betrieb. Backlog, Tickets, Dokumentenablage und Testnachweise werden in Werkzeugen mit Datenhaltung in der Schweiz
geführt. Die Standorte aller Werkzeuge mit Applikations- oder Projektdaten weist das Datenhaltungskonzept (E1) aus.

Dokumente werden mit Version, Status, Verantwortlichem und Freigabe geführt. Baselines für Anforderungen,
Releaseumfang, Architektur und Abnahme bleiben nachvollziehbar. Entscheidungen aus Gesprächen werden schriftlich
protokolliert.

## 12. Mitwirkungen und Beistellungen des Auftraggebers

| Beistellung | Benötigt bis | Zweck |
|---|---|---|
| Projektleitung, PO, Fachvertretung und Entscheidungsbefugnisse | M0 | Planbare Abstimmung und Freigaben |
| Aktuelle Originalunterlagen, Berichtigungen und interne Vorgaben | M0, danach bei Änderung | Verbindliche Anforderungsbasis |
| Testdaten von KOMZ Lärm: repräsentative FGDB, WLR- und Betriebsdaten (FAQ 176) | Vor M2 | Validierung des FGDB-Zugriffs über GDAL, Import- und Fachvalidierung |
| Bereinigte Migrationsdaten und fachliche Zuordnungen (Format im Projekt festgelegt, Qualitätssicherung bei der Auftraggeberin, rund drei Monate Aufbereitung; FAQ 28) | Stufenweise, Vorlauf ab Formatfestlegung | Probeläufe und Einführung |
| ELO-Schnittstellenspezifikation, Testumgebung und Anpassungen auf Seite ELO (Verantwortung der Auftraggeberin mit der ELO-Entwicklerfirma; FAQ 17, 177) | Testumgebung zu Projektbeginn, Spezifikation vor M2 | Schnittstellennachweis |
| Fachentscheide, Teilnehmende für Reviews und Abnahmen | Je Sprint und Meilenstein | Rechtzeitige fachliche Prüfung |
| Französische Übersetzungen gemäss B1 | Vor Sprach- und Anwenderabnahme | Mehrsprachige Einführung |
| Applikationsverantwortliche (Trainer der Auftraggeberin) für die Schulungen | Vor M5 | Befähigung der Nutzerorganisation |

Konkrete Termine, Lieferformate und Kapazitäten der Auftraggeberin werden gemeinsam vereinbart (Mitwirkungspflichten:
Beilage A1.1). Verzögerungen werden mit Auswirkung und Handlungsoptionen dokumentiert.

## 13. Übergang in den Betrieb

**Übergabe von der Entwicklung in den Betrieb:** Die Technologiepartnerin (Subunternehmerin) und die Betriebsorganisation
([PLATZHALTER FIRMA]) arbeiten ab Projektbeginn eng zusammen; die Rolle Betrieb / Sicherheit von [PLATZHALTER FIRMA] gehört zum Projektteam.
[PLATZHALTER FIRMA] verantwortet den vollständigen SaaS-Betrieb über die Betriebsphase von zehn Jahren (LP4) und leistet den
2nd- und 3rd-Level-Support gemäss SLA (Reaktion innerhalb von vier Stunden). Codeänderungen im 3rd Level erstellt die
Technologiepartnerin; sie gelangen ausschliesslich über die CI/CD-Pipeline von der Entwicklung in den Betrieb. Die
Gesamtverantwortung gegenüber der Auftraggeberin liegt bei [PLATZHALTER FIRMA].

Mit dem Abruf von LP4 aktiviert [PLATZHALTER FIRMA] die Schweizer SaaS-Plattform, benennt Betriebsverantwortliche und
Stellvertretungen und nimmt Ticket- und Hotlineweg sowie Incident-, Problem- und Change-Prozess in Betrieb. Rahmen
gemäss Teil B: Verfügbarkeit 99 % pro Kalendermonat bezogen auf Mo–Fr 07–19 Uhr; Support Mo–Fr 08–17 Uhr, Reaktion
innerhalb von vier Stunden, Behebungsbeginn innerhalb von 24 Stunden, Behebung in der Regel innerhalb von 48 Stunden
(Fristenlauf gemäss FAQ 115). Vor-Ort-Einsatz in Bern innerhalb eines Arbeitstags.

Backup und Restore mit RPO ein Tag, RTO zwei Tage, Mehrgenerationen über zwölf Monate und jährlichem Restore-Test
werden im Betriebskalender verankert. Sämtliche Daten einschliesslich der Sicherungen bleiben in der Schweiz (E1).
Die zehnjährige Betriebsphase ist eine eigene Lebenszyklusplanung und keine Fortsetzung der Projektentwicklung;
Erweiterungen laufen über LP5.

## 14. Voraussetzungen dieses Plans

- Projektstart im Januar 2027; bei späterem Start werden die Termine gemeinsam neu baseliniert.
- Die Auftraggeberin erbringt die Mitwirkungen nach Abschnitt 12 und Beilage A1.1 zu den vereinbarten Terminen.
- Das HERMES-Tailoring und die Kompetenzordnung werden mit dem PMP der Auftraggeberin abgestimmt.
- Anzahl, Dauer und Zuschnitt der PI werden in der agilen Planung gemeinsam festgelegt (Abschnitt 2).
- Die Optionen LP1b, LP3, LP4 und LP5 werden nach Abruf geplant; ihre Stunden sind nicht in den 2'800 Stunden von
  LP1a enthalten.

## 15. Berücksichtigte Auskünfte der Auftraggeberin (Frageforum, Stand 01.10.2026)

| Thema | Auskunft | Umsetzung in diesem Plan |
|---|---|---|
| Schlussabnahme und Termin 30.06.2028 | FAQ 50: rund 30 Tage Schlussabnahmetests; der Termin bezeichnet die produktive Einführung nach Schlussabnahme und Schlussgenehmigung | M5 Schlussabnahme, M6 Einführung im März 2028, rund drei Monate Reserve (Abschnitt 4) |
| Verbindlichkeit von B1 | FAQ 51, 68: B1 in der Fassung bei Vertragsabschluss ist verbindliche Leistungsgrundlage; Konkretisierungen gehören zu LP1a, inhaltliche Abweichungen zu LP5a | Änderungsprozess (Abschnitt 11) |
| Kostendach LP1a | FAQ 59, 137: 4'000 Stunden als einheitliche Bewertungs- und Kostendachgrundlage; sämtliche Muss-Anforderungen sind innerhalb von LP1a zu realisieren | Maximalaufwand 2'800 Stunden (Abschnitt 6) |
| Geringere Stundenmenge für LP1a | FAQ 61–63, 151, 169: am 01.10.2026 unbeantwortet | Die 2'800 Stunden sind die verbindliche Obergrenze der Anbieterin innerhalb des Kostendachs; das Preisblatt wird nach den Vorgaben der Auftraggeberin ausgefüllt |
| Stundenumfang LP1b | FAQ 66, 117: 750 Stunden; Erfassungsmaske und Simulation werden gemeinsam abgerufen | Abschnitt 1 |
| Infrastruktur- und Hostingkosten | FAQ 30, 67, 131, 143, 174: Betriebsumgebungen in LP4; Akzeptanzsystem und weitere Projektumgebungen während der Projektphase in LP1 | Abschnitte 1 und 13 |
| Programm-Inkremente | FAQ 69: vier bis sechs PI von rund drei Monaten; PI-Angebote werden nicht separat vergütet | Fünf PI (Abschnitt 2) |
| Schulungen LP3 | FAQ 36–38, 70: zehn initiale, zwei wiederkehrende Schulungen; vor Ort, rund ein halber Tag, rund drei Personen, Unterlagen auf Deutsch | Abschnitt 9 |
| ELO-Schnittstelle | FAQ 17, 91, 177: Spezifikation und Anpassungen auf Seite ELO bei der Auftraggeberin, Testumgebung zu Projektbeginn | Abschnitte 4 und 12 |
| Initiale Daten | FAQ 28: Format im Projekt, Qualitätssicherung bei der Auftraggeberin, rund drei Monate Aufbereitung | Abschnitte 4 und 12 |
| FGDB | FAQ 99, 121, 176: Schema zu Beginn der Realisierung gemeinsam festgelegt, Muster-FGDB im Projektverlauf, Formatwechsel als Change unter LP5 | M2, Abschnitte 4 und 10 |
| Schlüsselrollen | FAQ 133: Eine Person darf zwei der drei Lead-Rollen federführend ausüben, wenn Pensen und Stellvertretung ausgewiesen sind | Abschnitte 3 und 6.1 |
| Generalunternehmerin, Subunternehmerin, Hosting | FAQ 132, 136, 140, 167, 173: Betriebsverantwortung und Gesamtverantwortung bei der Anbieterin; Subunternehmer verbindlich und exklusiv eingebunden; Aufteilung des Supports zulässig; Hosting-Anbieter im Angebot benannt | Abschnitte 1, 3 und 13; Lösungskonzept 2.5 und 6.3 |
| Ort der Leistungserbringung | FAQ 43, 44, 168, 179: Entwicklung, Test und Dokumentation in der Schweiz | Abschnitt 3 |
