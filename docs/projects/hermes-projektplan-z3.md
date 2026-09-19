# SLIM – HERMES-Projektmanagementplan und Projektplan Z3

**Version 0.2 · Stand 12.09.2026 · Status: interner Arbeitsentwurf, nicht freigegeben**

Anbieterfirma: **OFFEN** · Projektleitung Lieferantin: **OFFEN**

Dieser Entwurf bereitet den Projektplan für Zuschlagskriterium Z3 und den lieferantenseitigen
Projektmanagementplan (PMP) nach Teil B 2.3.1 vor. Im Zuschlagsfall wird er gemeinsam mit dem Auftraggeber
konkretisiert und mit dessen PMP abgestimmt. Er ist keine bereits bestätigte Termin-, Personal- oder
Abnahmevereinbarung. Termine und Stundenverteilung sind **Vorschläge**; die Ausschreibung verwendet teilweise
andere Phasenbegriffe als HERMES 2022, die Zuordnung ist in Abschnitt 2 ausdrücklich festgehalten.

Zugehörige Unterlagen im Repository: [Lösungskonzept C2](../anforderungskatalog/C2-Loesungskonzept-SLIM.md),
[Prüfstand des Konzepts](../anforderungskatalog/checkliste.md), [Umsetzungsstand des Prototyps](../anforderungskatalog/umsetzungsstand.md),
[FAQ-Export](../anforderungskatalog/FAQ-Export-2026-09-11.md), [Prototyp-Roadmap](prototyp-roadmap.md).

## 1. Ziel, Umfang und Grundlagen

Ziel ist die Detailkonzeption, Realisierung und Einführung von SLIM mit dem geschuldeten funktionalen und
nichtfunktionalen Umfang, nachvollziehbarer Lärmberechnung, unabhängigen Berechnungsständen, ELO-Anbindung und
geregelter Betriebsübergabe.

| Paket | Behandlung im Plan |
|---|---|
| LP1a | Grundauftrag: Projektmanagement, Design, Architektur, agile Planung, Realisierung und Einführung der zwingenden Anforderungen |
| LP1b | Angebotene optionale Umsetzung; Realisierung nur nach Abruf. Zuordnung insbesondere der Simulation vor Finalisierung mit Unterlagen/FAQ konsolidieren. Stundenumfang in den Unterlagen widersprüchlich: A1 Art. 4.7.4 nennt 500 h, Preisblatt C3 750 h (offene Auslegung, Abschnitt 15) |
| LP2 | Allfällige Lizenzen einschliesslich Drittlizenzen; separat deklarieren |
| LP3 | Optionale Schulungsleistungen; Mengengerüst 10 initiale und 2 wiederkehrende Schulungen laut Teil B; Kalkulationsbasis je Schulung ist eine offene Auslegung (Abschnitt 15); Abgrenzung zu Einführung/Befähigung in LP1a dokumentieren |
| LP4 | Optionaler Applikationsbetrieb und Support; Betriebsbereitschaft und Übergabe bereits im Einführungsplan vorbereiten. Abbildung der Infrastrukturkosten im Preisblatt ist eine offene Auslegung (Abschnitt 15) |
| LP5a / LP5b | Gesondert beauftragte Erweiterungen während Projekt bzw. Betrieb; keine stillschweigende Finanzierung unerledigter Muss-Anforderungen |

Massgebende Projektquellen: Teil A (Z3), Teil B insbesondere 2.3.1–2.3.3 und 2.9, B1 samt Beilagen, Vertrag mit
Abnahmevorschriften (A1, A1.2) und beantwortete FAQ/Berichtigungen. Vor Angebotsfreigabe Quellenstand aktualisieren;
der FAQ-Export vom 11.09.2026 enthält 132 Fragen, davon viele noch offen.

**Umgang mit Quellen in diesem Plan:** Vertragsaussagen werden direkt mit Dokument und Artikelnummer belegt.
Beantwortete FAQ gelten als Auskunft der Auftraggeberin. Eine **offene FAQ ist keine Entscheidung**; sie wird nur
als offene Auslegung genannt und in Abschnitt 15 separat geführt, nie als Grundlage für eine Planungsaussage.

**Vorhandener Prototyp als Ausgangspunkt:** Vorhandene Funktionen werden zu Projektbeginn gemeinsam überprüft,
fachlich validiert und in die vereinbarte Architektur überführt. Die Releaseplanung wird anhand des bestätigten
Restumfangs konkretisiert. Der Prototyp verkürzt die Validierung, ersetzt aber weder AG-Mitwirkung, Integration
noch Abnahme; die Termine in Abschnitt 4 berücksichtigen diese drei Faktoren.

Stand des Prototyps: [umsetzungsstand.md](../anforderungskatalog/umsetzungsstand.md). Die rechtliche Prüfung
der wiederverwendeten Bibliotheken steht aus (Abschnitt 10). Vorvertragliche Eigenleistungen werden nicht
automatisch als Projektstunden verrechnet.

## 2. HERMES-Vorgehen und Zuordnung

HERMES 2022 unterscheidet im agilen Vorgehen Initialisierung, Umsetzung und Abschluss. Teil B verlangt HERMES 2022,
verwendet zugleich die Begriffe «Konzept, Realisierung und Einführung» und «Entwicklung Agil». Diese Begriffe werden
nicht als identische Standardphasen ausgegeben.

**Tailoring-Vorschlag:** HERMES-2022-Szenario IT-Entwicklung mit agiler Umsetzung; Konzept, Realisierung und
Einführung werden als nachvollziehbare Arbeitsschwerpunkte und Freigabepunkte innerhalb der Umsetzung geplant. Die
endgültige Szenario-/Phasenzuordnung stimmt die Projektleitung mit dem Auftraggeber ab. Keine Vorgabe aus Teil B
entfällt dadurch.

| HERMES-Rahmen | SLIM-Arbeit / Nachweis |
|---|---|
| Initialisierung / Übergabe in die Durchführung | Bestehenden Auftraggeber-Projektauftrag, Beschaffungsresultat, Ziele und Freigaben übernehmen; keine bereits erledigte Initialisierung erneut verkaufen |
| Umsetzung: Konzeptschwerpunkt | Anforderungen präzisieren, Architektur und Sicherheits-/Betriebsansatz validieren, Backlog und Releaseplan belastbar machen |
| Umsetzung: Realisierungsschwerpunkt | Getestete Inkremente auf dem Akzeptanzsystem; laufendes Refinement und Aktualisierung der Konzepte |
| Umsetzung: Einführungsschwerpunkt | Migration, Befähigung, Betriebsbereitschaft, Abnahmen und gestufte Produktivsetzung |
| Abschluss | Übergabe, offene Punkte und Zuständigkeiten, Projektschlussbeurteilung und formeller Abschlussentscheid |

Methodenquelle: [Offizielles HERMES-Referenzhandbuch, Ausgabe 2022](https://www.hermes.admin.ch/_Resources/Persistent/e/8/5/9/e8596469c2f16dc3e0e5c43c85e6f7743f22435a/HERMES_PjM2022_DE.pdf).
Die konkrete SLIM-Planung unten ist ein eigener Vorschlag auf Basis der Beschaffungsunterlagen.

Der Vertragsentwurf verlangt zudem je Programm-Inkrement (PI) ein separates Angebot mit geschätztem Maximalaufwand,
Kostendach und Terminplan (A1, Regelung zu den PI-Angeboten; Artikelnummer vor Angebotsfreigabe eintragen). Die
Release-Schwerpunkte in Abschnitt 5 sind eine **mögliche** Zuordnung zu solchen PI: vier Release-Schwerpunkte
bedeuten nicht automatisch vier vertragliche PI. Anzahl, Dauer und Zuschnitt der PI sind mit dem Auftraggeber zu
vereinbaren (offene Auslegung, Abschnitt 15).

## 3. Organisation und Entscheidungen

| Rolle | Verantwortung | Besetzung |
|---|---|---|
| Auftraggeber / zuständiges Entscheidungsgremium | Projektfreigaben, Mittel, verbindliche Leistungsänderungen und Abschluss im Rahmen der festgelegten Kompetenzordnung | AG benennt |
| Fachprojektleiter / Auftraggebervertreter | Koordination der Mitwirkungen und interne Abstimmung | AG stellt |
| Product Owner | Fachliche Priorisierung, Refinement und fachliches Feedback; keine automatisch unterstellte Befugnis zur Vertragsänderung | AG stellt |
| Projektleitung Lieferantin | SPOC, Termine, Ressourcen, Reporting, Risiken und Eskalationen; Entscheidungsgrundlagen vorbereiten | **OFFEN** |
| Lead Business Analyst | Fachregeln, Anforderungskatalog, Abnahmekriterien, Nachverfolgbarkeit und Workshops | **OFFEN** |
| Lead Entwicklung / Architektur | Architektur, Implementierung, Datenmodell, Integrationen, technische Nachweise | Weslley D., geplant; Zusage/Rolle bestätigen |
| Qualitätssicherung / Testing | Unabhängige Sollwerte, Testplanung, Integrations-/E2E-/Lasttests und Nachweisführung | **OFFEN** |
| Betrieb / Sicherheit | Schweizer Plattform, Berechtigungen, Deployment, Monitoring, Restore, Betriebsübergabe | **OFFEN** |
| KOMZ Lärm / Anwendervertretung | Fachliche Prüfung, fachliche Entscheidungen und repräsentative Anwenderszenarien | AG koordiniert |

Rollen können bei geeigneter Kapazität kombiniert werden, sofern Unterlagen und tatsächliche Lieferfähigkeit dies
zulassen. Kritische Eigenleistungen sollen fachlich gegengeprüft werden. Für jede Schlüsselrolle sind Name,
Verfügbarkeit und Stellvertretung vor Angebotsfreigabe einzutragen. Ersatzfähigkeit nach E4 (14 Tage, gleich
qualifiziert, Einarbeitung ohne Kostenfolge für AG) organisatorisch nachweisen.

## 4. Termin- und Meilensteinplan

**Planungsannahme:** Mobilisierung ab Januar 2027, Einführung im ersten Quartal 2028, Abschluss im zweiten Quartal
2028 mit April 2028 als Planungsziel. Dies konkretisiert den bisher ausgewerteten Grobterminplan; Vertragsbeginn,
Abhängigkeiten und definitive Termine sind mit AG zu bestätigen. A1 Art. 2.11.1 nennt den Termin «Einführung SLIM:
30.06.2028». Wie Einführung, Schlussabnahme und Schlussgenehmigung zeitlich zusammenhängen, ist nach den Unterlagen
nicht geklärt (offene Auslegung, Abschnitt 15); der Plan leitet daraus **keine** Vorgabe für den Projektabschluss ab.
Bei späterem Start gemeinsam neu baselinieren, nicht ungeprüft dieselben Endtermine zusagen.

Die Meilensteine knüpfen an den vorhandenen Prototyp an: M1 enthält die gemeinsame Überprüfung und fachliche
Validierung der vorhandenen Funktionen, M2 und M3 bauen darauf auf. Die Termine bleiben trotzdem von AG-Mitwirkung
(Daten, Fachentscheide, ELO-Testumgebung), Integration und Abnahme bestimmt.

| Meilenstein | Zieltermin, Vorschlag | Ergebnisse und Entscheidungskriterien |
|---|---|---|
| M0 – Projektstart abgestimmt | Januar 2027 | Auftrag/Kompetenzen geklärt, Team verfügbar, Mitwirkungsplan, Zugänge, PMP und Start-Backlog abgestimmt |
| M1 – Konzeptbasis bestätigt, Prototyp überführt | März 2027 | Vorhandene Funktionen gemeinsam überprüft, fachlich validiert und in die vereinbarte Architektur überführt; bestätigter Restumfang; Architektur, Kapitel-10-Datenmodell, Fachregeln, Sicherheits-/Betriebsansatz, priorisierter Backlog, Test-/Migrationsansatz und Aufwandprognose nachvollziehbar |
| M2 – Technische Integrationsbasis nachgewiesen | Mai 2027 | PostgreSQL/PostGIS, unabhängige Zustände, repräsentativer FGDB-Import/-Export und ELO-Verbindung auf Akzeptanzumgebung geprüft |
| M3 – Fachlicher Durchstich mit dokumentiertem Review | August 2027 | Die im Prototyp vorhandene Kette Nutzungen → Betriebsdaten → Quellenverteilung → A7/A9 → Beurteilung/Anzeige auf der Zielarchitektur mit AG-Daten, unabhängigen Sollwerten und O8 durchgängig; fachliches Review durch KOMZ Lärm dokumentiert (frühere Zwischenreviews ab M1 möglich) |
| M4 – Einführungskandidat bereit | November 2027 | Gesamter geschuldeter Umfang für Anwenderprüfung bereit, Dokumentation, Rollen, Migration und Betriebsabläufe prüfbar; Restmängel klassifiziert |
| M5 – Freigabe Produktivsetzung | Januar/Februar 2028 | Fachliche/technische Abnahmevoraussetzungen gemäss Vertrag erfüllt, Migration geprobt, Berechtigungen und Support bereit, Restore/Rollback geprüft |
| M6 – Einführung stabilisiert | März 2028 | Produktivmigration abgestimmt, erste Betriebszeit begleitet, betriebliche Übergabe und offene Punkte zugeordnet |
| M7 – Projektabschluss | April 2028 (Planungsziel) | Schlussabnahme entsprechend Vertrag, Ergebnisse übergeben, Schlussbeurteilung und Abschlussentscheid |

Die Meilensteinbezeichnungen sind Projektvorschläge, keine HERMES-Standardentscheide. Ein Review ist nicht
automatisch eine rechtswirksame Abnahme. Teil-/Schlussabnahmen und Zeichnungsberechtigungen richten sich nach
Vertrag und Kompetenzordnung.

### Abhängigkeiten und Terminreserve

- PostgreSQL-/Bibliothekskompatibilität und echtes FGDB-Format früh prüfen; sie liegen vor vollständiger Migration
  und GIS-Abnahme auf dem kritischen Pfad. Stand Prototyp: der Postgres-Boot ist durch die Typ-Map in
  `@app-galaxy/*` blockiert ([validierung-technisch.md](../anforderungskatalog/validierung-technisch.md)), Beilage
  B1.2 (FGDB-Schema) liegt nicht im Repository.
- ELO-Schnittstelle: Die Auftraggeberin verantwortet die Schnittstellenspezifikation auf Seite ELO unter Zuzug der
  ELO-Entwicklerfirma, stellt zu Projektbeginn eine Testumgebung bereit (vorbehältlich des Zeitbedarfs für
  Anpassungen aus der Spezifikation) und trägt allfällige Anpassungen an ELO (FAQ 17, beantwortet). Abstimmung
  und Testzugang deshalb vor M2 terminieren.
- Initiale Datenbereitstellung: Format und Struktur werden im Projekt mit der Anbieterin festgelegt, die
  Qualitätssicherung (Dubletten, Bezeichnungen, fehlende Zuordnungen) liegt beim Auftraggeber, die initiale
  Aufbereitung per ETL braucht etwa drei Monate (FAQ 28, beantwortet; Mengengerüst: 120 aktive und 150 historisch
  relevante Schiessplätze, 2–40 Stellungsräume je Platz, ca. 250 Waffen/Kaliber, ca. 50'000 Zuordnungen). Diese
  drei Monate laufen ab Festlegung des Formats und sind im Mitwirkungsplan zu terminieren.
- Fachregelfreigaben müssen vor der betreffenden Abnahme vorliegen; offene Regeln mit Auswirkung auf Pegel nicht
  als unkritische Restpunkte behandeln (Fachentscheidregister, siehe Abschnitt 9).
- Zwischen M4 und M5 Zeit für Anwenderprüfung, Fehlerbehebung und erneute Migrationsprobe vorsehen. Verzug früh
  eskalieren; Reserve ist kein Grund zum Verschieben notwendiger Tests.

## 5. Agile Durchführung und Releases

Vorschlag: zweiwöchige Sprints während aktiver Entwicklung. Refinement bereitet klare Akzeptanzkriterien, Daten
und Abhängigkeiten vor. Jeder Sprint liefert ein lauffähiges Inkrement auf das Akzeptanzsystem;
Stakeholder-Feedback fliesst in die Folgeplanung ein. Sprints werden nach verfügbarer Kapazität geplant, nicht mit
erfundener Velocity.

| Release-Schwerpunkt | Inhalte |
|---|---|
| R1 – Plattform und Referenzen | CH-Umgebungen, Build/Deployment, MFA/Rechte, Stammdaten und Kapitel-10-Struktur |
| R2 – Austausch und Fachkern | FGDB/WLR/Betriebsdaten, ELO, Quellenverteilung, Kalender, Rundung, Referenzrechnungen und Reproduzierbarkeit |
| R3 – Fachoberflächen | Übersicht, Nutzungen, Berechnungsverwaltung, GIS, Exporte, konfigurierte Fachparameter und Rollenoberflächen |
| R4 – Einführungskandidat | Vollständige Sprachen/Dokumentation, Last-/Sicherheits-/Anwendertests, Migration, Befähigung und Betrieb |

Sicherheit, Dokumentation und Tests laufen in allen Releases mit. Optionen werden nach Abruf in den Releaseplan
integriert; Auswirkungen auf Kapazität und Termine vor Zusage ausweisen.

**Fertig-Kriterium eines Inkrements:** Akzeptanzkriterien erfüllt, Code geprüft, relevante automatisierte Tests
bestanden, Migration/Deployment geprüft, Rechte und Fehlerfälle behandelt, Dokumentation/Matrix aktualisiert,
Ergebnis auf Akzeptanzsystem demonstrierbar. Fehlende Pflichtnachweise dürfen nicht durch einen grünen
Unit-Testlauf ersetzt werden.

## 6. Ressourcen- und Aufwandsplanung

**Interner Verteilungsvorschlag, keine Aufwandsschätzung aus dem Codefortschritt:** LP1a 4'000 Stunden als
Kostendach laut Preisblatt C3, Stundensatz CHF 115/h = CHF 460'000 exkl. MWST. Die Herleitung des Kostendachs
durch die Auftraggeberin ist nicht bekannt, und aus den Unterlagen ergibt sich keine bestätigte Möglichkeit, die
LP1a-Menge für die Preisbewertung zu reduzieren (offene Auslegungen, Abschnitt 15). Vor Freigabe mit PL und
Bottom-up-Schätzung validieren. Keine Garantie, dass die folgende Aufteilung den vollständigen Umfang bereits
belastbar deckt.

| Arbeitsschwerpunkt | Planstunden |
|---|---:|
| Projektleitung, Steuerung, Reporting und Koordination | 400 |
| Business Analyse, Fachklärung und Anwenderworkshops | 450 |
| Architektur, Sicherheit und technische Konzepte | 350 |
| Entwicklung einschliesslich Datenmodell, GIS und Integrationen | 1'450 |
| Fach-/Integrations-/E2E-/Lasttests und Qualitätssicherung | 550 |
| Migration, Dokumentation, Einführung und Betriebsübergabe | 450 |
| Interne Aufwandsreserve | 350 |
| **Summe LP1a** | **4'000** |

Dies sind Arbeitspakete, keine zusätzlich zu summierenden Personenbudgets. Fehlerschleifen sind in
Arbeitspaketen/Reserve zu berücksichtigen. Reserve ist weder pauschal abrechenbar noch ein Anspruch auf
Kostendachausschöpfung. Abrechnung richtet sich nach Vertrag und tatsächlich abrechenbarem Aufwand.

### 6.1 Kapazitätsplanung je Rolle (auszufüllen vor Angebotsfreigabe)

Die Aufteilung der Stunden auf Tätigkeiten ersetzt keine Kapazitätsplanung. Für Z3 muss der Plan zeigen, **wer
wann mit welchem Pensum arbeitet und wer vertritt**. Die Tabelle ist der Rahmen; Namen, Pensen und Stellvertretungen
sind **OFFEN** und werden mit den Zusagen der Personen eingetragen. Die Summenzeile muss mit Abschnitt 6 und dem
Preisblatt übereinstimmen.

| Rolle | Person | Stellvertretung | Pensum Jan–Mär 2027 | Apr–Aug 2027 | Sep–Dez 2027 | Jan–Apr 2028 | Stunden gesamt |
|---|---|---|---:|---:|---:|---:|---:|
| Projektleitung Lieferantin | OFFEN | OFFEN | OFFEN | OFFEN | OFFEN | OFFEN | ≈ 400 |
| Lead Business Analyst | OFFEN | OFFEN | OFFEN | OFFEN | OFFEN | OFFEN | ≈ 450 |
| Lead Entwicklung / Architektur | Weslley D. (Zusage bestätigen) | OFFEN | OFFEN | OFFEN | OFFEN | OFFEN | ≈ 1'000 |
| Entwicklung (zweite Person) | OFFEN | OFFEN | OFFEN | OFFEN | OFFEN | OFFEN | ≈ 800 |
| Qualitätssicherung / Testing | OFFEN | OFFEN | OFFEN | OFFEN | OFFEN | OFFEN | ≈ 550 |
| Betrieb / Sicherheit | OFFEN | OFFEN | OFFEN | OFFEN | OFFEN | OFFEN | ≈ 450 |
| Reserve (rollenübergreifend) | – | – | – | – | – | – | 350 |
| **Summe** | | | | | | | **4'000** |

Die Stundenwerte je Rolle sind eine erste Zuordnung der Arbeitspakete aus Abschnitt 6 (Architektur 350 h verteilt
auf Lead Entwicklung und Betrieb/Sicherheit; Migration/Einführung 450 h auf BA, Entwicklung und Betrieb). Je Rolle
und Monat sind verfügbare Stunden, Parallelprojekte, Urlaub und Vertretung einzutragen; Pensen unter 20 % für
Schlüsselrollen sind zu begründen. Auch AG-Kapazitäten je Workshop, Review und Abnahme bestätigen; ein Total von
4'000 Stunden allein ist noch kein Nachweis ausreichender Teamkapazität.

## 7. Ergebnisse und Lieferobjekte

Alle Ergebnisse erhalten Verantwortlichen, Reviewer, Version und Freigabestand. Sie dürfen als abgestimmte Kapitel
gemeinsamer Dokumente geführt werden, sofern Anforderungen vollständig auffindbar bleiben.

| Ergebnisgruppe | Geforderte / vorgesehene Inhalte | Federführung |
|---|---|---|
| Projektmanagement | PMP, Organisation, Termine/Ressourcen, Statusberichte, Entscheidungs-/Risiko-/Änderungsregister | PL |
| Fachliche Basis | Detailspezifikation, Backlog, Fachregeln und Akzeptanzkriterien mit B1-Zuordnung | BA + PO |
| Architektur und UX | Systemarchitektur, Usability-Konzept, GUI-Guidelines, Rollenkonzept | Architektur + BA |
| Integration und Daten | Schnittstellenkonzept, Migrationskonzept, Schema-/Mappingdokumentation | Entwicklung |
| Qualität | Testkonzept, Qualitätsmanagementplan, Testnachweise, Mängelliste | QA |
| Release und Konfiguration | Releasemanagementkonzept, Konfigurationsmanagementplan, nachvollziehbare Builds | Entwicklung + Betrieb |
| Sicherheit und Betrieb | Informationssicherheitskonzept, Betriebskonzept, IT Service Continuity Management, Backup-/Restore- und Notfallverfahren | Sicherheit + Betrieb |
| Einführung | Ausbildungskonzept, Einführungsmassnahmen/-konzept, deutsches Benutzerhandbuch, Schulungsunterlagen, Übergabeprotokolle | BA + Betrieb |
| Abschluss | Abnahmeunterlagen, offene Punkte mit Verantwortlichen, Projektschlussbeurteilung | PL |

Konzepte werden iterativ aktualisiert und liegen bei Einführung/Abnahme in konsistenter Endfassung vor; nicht als
einmalig erledigte Startdokumente behandeln. Die Architektur-Dokumente des Prototyps
([docs/architecture](../architecture)) sind Ist-Beschreibungen und werden im Projekt zur Zielarchitektur fortgeschrieben.

## 8. Kommunikation und Reporting

| Termin | Rhythmus / Teilnehmende | Zweck |
|---|---|---|
| Steuergremium | Gemäss Teil B monatlich 2 h: PL Lieferantin, PL AG, PO | Inhalt, Termine, Aufwand, Risiken und Entscheidungen |
| Kernteam | Gemäss Teil B alle 1–3 Wochen 2 h, PO; Projektleitungen bei Bedarf | Fachliche und technische Klärung |
| Sprint Planning / Review / Retrospektive | Vorschlag je zweiwöchigem Sprint; passende Team-/Stakeholderbesetzung | Planung, Akzeptanzsystem-Feedback, Verbesserung |
| Refinement | Regelmässig passend zum Backlog; möglichst mit vorhandenen Fachterminen bündeln | Anforderungen und Testbarkeit vorbereiten |
| Eskalation | Bei kritischen Abweichungen unverzüglich über PL/SPOC | Entscheidungsbedarf und Auswirkungen transparent machen |

Statusbericht vor dem Steuergremium: Lieferfortschritt je Anforderung/Release, Meilensteine, Ist-Aufwand,
Restaufwand, Prognose bei Fertigstellung, Risiken, Mitwirkungen und Entscheidungen. Prozentsätze nicht aus
Codezeilen oder Testanzahl ableiten. Besprechungen und Dokumentation auf Deutsch; Vor-Ort-Termine gemäss Teil B
schweizweit, insbesondere Bern, einplanen.

## 9. Qualität, Einführung und Abnahme

- Fachtests mit unabhängigen Empa-Referenzen und dokumentierten Entscheidungen; Rohwert, Anzeige und
  Beurteilungswert unterscheiden (Muster: [nachweis-rechenfaelle.md](../anforderungskatalog/nachweis-rechenfaelle.md)).
- Zustandsisolation, Importabbruch, Dezimalmengen, lokale Feiertage, gemischte Baujahre und O8 auf Service-/DB-Ebene
  prüfen.
- ELO-Vertrag, Wiederholungen, Fehler und Berechtigungen über Integrationstests absichern.
- Echte FGDB-Dateien mit vollständigem Attribut-/Beziehungs-/Geometrieabgleich prüfen.
- Rollenbezogene Browserabläufe, MFA, Barrierefreiheit und Last mit zehn gleichzeitigen Nutzern auf Zielumgebung
  prüfen.
- Testläufe mit Commit, Datum, Umgebung und Ergebnis dokumentieren; Gerüste/übersprungene Tests separat ausweisen
  (im Prototyp: `criterias`-Skelette sind kein Nachweis).
- Migration stufenweise auf Akzeptanzsystem proben; Mengen, Zuordnungen und ausgewählte fachliche Ergebnisse
  gegenprüfen. Historischen Vollimport nicht unbelegt in LP1a aufnehmen.
- Vor Produktivsetzung Betriebsorganisation aktivieren, Rollback und Restore nachweisen, Benutzer/Trainer
  befähigen und Bereitschaft dokumentieren.
- Begleitung der ersten Betriebszeit planen; Mängel nach Vertragsregeln (A1 Art. 2.12, 2.13.2; A1.2 Kap. 7)
  priorisieren. Keine neue Abnahmetoleranz in diesem Entwurf erfinden; die Fristen für «bedingt abgenommen» /
  «nicht abgenommen» sind eine offene Auslegung (Abschnitt 15).

## 10. Risiken und Massnahmen

Einstufungen sind vorläufige Planungsannahmen, keine bestätigte Risikoanalyse.

| Risiko | Auswirkung | Massnahme / Verantwortlicher |
|---|---|---|
| Unvollständige Rechtekette vorbestehender Bibliotheken (`@app-galaxy/*`, ELO-Übernahmen) | Übergabe-/Nutzungsrechte nicht gesichert | Inventar und Rechteklärung vor Angebotsfreigabe; Anbieterleitung |
| PostgreSQL-/Bibliotheksblocker | Architektur-/Migrationstermine gefährdet | Früher Zielplattformtest, verbindliche Behebung und Nachweis; Lead Entwicklung |
| FGDB-Feld-/Geometrieverlust | Fachliche Ergebnisse/Datenaustausch unbrauchbar | Originalschema und echter Roundtrip vor M2; Architektur/QA |
| Fachliche Sonderfälle ungeklärt | Falsche Beurteilung oder Abnahmeverzug | Fachentscheidregister, KOMZ-Review, unabhängige Sollwerte; BA |
| Daten oder ELO-Zugänge verspätet | Integration/Migration verschoben | Mitwirkungsplan und frühe Eskalation; PL AG/PL Lieferantin |
| Schlüsselpersonen fallen aus | Lieferfähigkeit sinkt | Benannte Vertretungen, Wissenstransfer, nachvollziehbare Dokumentation; PL |
| Prototypfortschritt überschätzt | Aufwand/Kostendach reicht nicht | Bottom-up-Restschätzung und monatliche Fertigstellungsprognose; PL/Lead Entwicklung |
| Sicherheits-/Betriebsanforderungen spät geprüft | Keine Produktivfreigabe | Kontinuierliche Prüfung und Restore-/Lasttests vor M5; Betrieb/QA |
| Widersprüchliche Vorgaben (B1 informativ vs. verbindlich, LP1b 500/750 h, PI-Zuschnitt) bleiben bis Vertrag offen | Umfang und Vergütung strittig | Offene Auslegungen (Abschnitt 15) vor Angebotsfreigabe mit den Antworten der Auftraggeberin abgleichen, verbleibende Annahmen im Angebot ausweisen; PL |

## 11. Änderungen, Werkzeuge und Dokumentenlenkung

Jede Änderung erfasst Anlass, B1-/Backlog-Bezug, Nutzen, Auswirkungen auf Umfang/Termine/Kosten/Sicherheit und
Entscheidung. Fehlerbehebung bzw. Konkretisierung bestehender Pflichten nicht pauschal als bezahlten Change
einstufen. PO-Priorisierung ändert kein vertragliches Kostendach. Verbindliche Änderungen nur durch zuständige
Stellen nach Vertragsprozess.

Werkzeuge: versioniertes Repository, Backlog/Tickets, Dokumentenablage, CI/CD und Testnachweise. Konkrete
Produkte/Provider **OFFEN**. Datenhaltung von Code, Projektdaten, Logs, Telemetrie, Support und KI gemäss E1/E5 und
geklärten FAQ prüfen; kein ausländisches Tool allein wegen Verfügbarkeit festlegen.

Dokumente mit Version, Status, Verantwortlichem und Freigabe führen. Baselines für Anforderungen, Releaseumfang,
Architektur und Abnahme nachvollziehbar halten. Entscheidungen aus Gesprächen schriftlich protokollieren.

## 12. Mitwirkungen und Beistellungen des Auftraggebers

| Beistellung | Benötigt bis | Zweck |
|---|---|---|
| PL-/PO-/Fachvertretung und Entscheidungsbefugnisse | M0 | Planbare Abstimmung und Freigaben |
| Aktuelle Originalunterlagen, Berichtigungen und interne Vorgaben | M0, danach bei Änderung | Verbindliche Anforderungsbasis |
| Repräsentative FGDB/WLR/Betriebsdaten | Vor M2 | Import-/Fachvalidierung |
| Bereinigte Migrationsdaten und fachliche Zuordnungen (Format im Projekt festgelegt, Qualitätssicherung beim AG, ca. 3 Monate Aufbereitung; FAQ 28) | Stufenweise, Vorlauf ab Formatfestlegung | Probeläufe und Einführung |
| ELO-Schnittstellenspezifikation, Testumgebung und Anpassungen auf Seite ELO (Verantwortung AG mit ELO-Entwicklerfirma; FAQ 17) | Testumgebung zu Projektbeginn, Spezifikation vor M2 | Schnittstellennachweis; ELO-seitige Arbeiten separat koordinieren |
| Fachentscheide, Review-/Abnahmeteilnehmende | Je Sprint/Meilenstein | Rechtzeitige fachliche Prüfung |
| Französische Übersetzungen gemäss B1 | Vor Sprach-/Anwenderabnahme | Mehrsprachige Einführung |
| Trainer und organisatorische Einführung | Vor M5 | Befähigung der Nutzerorganisation |

Konkrete Termine, Lieferformate und AG-Kapazitäten gemeinsam vereinbaren (Mitwirkungspflichten: Beilage A1.1).
Verzögerungen mit Auswirkung und Handlungsoptionen dokumentieren.

## 13. Übergang in den Betrieb

Bei Abruf LP4: Schweizer SaaS-Plattform, Betriebsverantwortliche und Vertretungen, Ticket-/Hotlineweg sowie
Incident-, Problem- und Change-Prozesse aktivieren. Rahmen gemäss Teil B: 99 % pro Kalendermonat bezogen auf
Mo–Fr 07–19 Uhr; Support Mo–Fr 08–17 Uhr, Reaktion maximal 4 h, Behebungsbeginn innerhalb 24 h, Behebung in der
Regel innerhalb 48 h. Vor-Ort-Fähigkeit Bern innerhalb eines Arbeitstags organisatorisch sicherstellen.

Backup-/Restore-Vorgaben einschliesslich RPO 1 Tag, RTO 2 Tage, zwölf Monaten Mehrgenerationen und jährlichem
Restore-Test im Betriebskalender verankern. Die geplante zehnjährige Betriebsphase ist eine eigene
Lebenszyklusplanung; nicht zehn Jahre Vollzeit-Projektentwicklung und keine garantierte Optionsbeauftragung.

## 14. Vor Freigabe dieses Plans

- [ ] Firma, PL, BA, QA/Betrieb und Stellvertretungen benannt und verfügbar.
- [ ] HERMES-Tailoring und Kompetenzordnung mit AG-PMP abgestimmt bzw. im Angebot als Vorschlag klar ausgewiesen.
- [ ] Grobterminplan/Vertragslaufzeit/FAQ mit aktuellen Originalquellen abgeglichen; offene Auslegungen aus
      Abschnitt 15 mit den inzwischen eingegangenen Antworten nachgeführt.
- [ ] Kapazitätsplanung 6.1 vollständig: Namen, Pensen je Periode, Stellvertretungen, Zusagen der Personen.
- [ ] Vertragsstellen (Artikelnummern A1, A1.2, Teil B) je Aussage geprüft und eingetragen.
- [ ] Ressourcen je Rolle und Monat nachgewiesen; 4'000-h-Verteilung bottom-up plausibilisiert.
- [ ] Alle Pflichtleistungen und Optionen eindeutig abgegrenzt; Simulation und Schulungen widerspruchsfrei zugeordnet.
- [ ] Termine/Ergebnisse mit C2, C1/E1 und Preisblatt konsistent.
- [ ] Anbieter-/AG-Mitwirkungen, Provider, Rechte und Toolstandorte konkretisiert.
- [ ] Risiken, Freigabekriterien und Abnahmeprozess mit Vertrag abgeglichen.
- [ ] Kein Prototyp- oder Teststand als unabhängig nachgewiesen bezeichnet, der nur aus externem Bericht bekannt ist.
- [ ] PL hat den Entwurf geprüft; erst danach als Angebotsfassung ausgeben.

## 15. Offene Auslegungen (Stand FAQ-Export 11.09.2026)

Diese Punkte sind in den Unterlagen widersprüchlich oder nicht geregelt. Eine Frage an die Auftraggeberin ist keine
Entscheidung; bis zur Antwort oder Vertragsklärung gilt die konservative Annahme in der letzten Spalte. Nummern
beziehen sich auf den [FAQ-Export](../anforderungskatalog/FAQ-Export-2026-09-11.md).

| Thema | Quelle im Vertrag / in den Unterlagen | Offene Frage | Annahme in diesem Plan |
|---|---|---|---|
| Zeitfenster Schlussabnahme, Lage des Termins 30.06.2028 | A1 Art. 2.11.1, 2.12, 2.13.2; A1.2 Kap. 7; Teil B Kap. 2.9 | FAQ 50 (offen): Dauer der Schlussabnahmetests, Termin vor oder nach Schlussabnahme/-genehmigung, Fristen bei «bedingt» / «nicht abgenommen» | Projektabschluss April 2028 als eigenes Planungsziel; Abnahmezeiten zwischen M4 und M7 eingeplant, keine Ableitung aus dem 30.06.2028 |
| Verbindlichkeit von B1 | B1 Kap. 1 und 5.1.1 gegen A1.2 | FAQ 51 (offen): B1 informativ oder verbindliche Leistungsgrundlage für Change Requests | B1 in der Fassung bei Vertragsabschluss als Referenz behandelt; zusätzliche Anforderungen aus 5.1.1 über den Änderungsprozess |
| Herleitung des Kostendachs 4'000 h | Preisblatt C3 | FAQ 59 (offen): Begründung, Einsicht in die Aufwandschätzung | Kostendach unverändert übernommen, Bottom-up-Schätzung intern |
| Geringere Maximalstundenzahl für LP1a anbietbar? | Preisblatt C3, A1 Art. 3.1.10 | FAQ 62, 63 (offen) | Keine bestätigte Reduzierbarkeit; Preisbewertung mit 4'000 h angenommen |
| Stundenumfang LP1b | A1 Art. 4.7.4 (500 h) gegen Preisblatt C3 (750 h) | FAQ 66 (offen): welcher Wert gilt, welches Dokument wird korrigiert | Beide Werte ausgewiesen, keine Festlegung |
| Infrastruktur- und Hostingkosten LP4 | Teil B Kap. 2.6, Preisblatt LP2/LP4, A1 Art. 3.1.10 | FAQ 67, 131 (offen): Preisposition für zeitabhängige Kosten, Bindung bis 31.12.2038 | Im Plan nicht bepreist; Betriebsplanung in Abschnitt 13 ohne Kostenaussage |
| PI-Angebote | Vertragsentwurf A1 (Regelung zu PI) | FAQ 69 (offen): Anzahl, Dauer und Zuordnung der PI zu Releases/Meilensteinen | Release-Schwerpunkte als mögliche PI-Zuordnung, Zuschnitt mit AG zu vereinbaren |
| Kalkulationsbasis Schulungen LP3 | Teil B (10 + 2 Schulungen), Preisblatt | FAQ 70 (offen): Dauer, Teilnehmer, Form, Ort, Sprachen | Mengengerüst übernommen, keine Kalkulationsannahme im Plan |

Beantwortete und im Plan verwendete Auskünfte: FAQ 17 (ELO: Spezifikation und Anpassungen bei der Auftraggeberin,
Testumgebung zu Projektbeginn), FAQ 28 (initiale Datenbereitstellung: Format im Projekt, Qualitätssicherung beim
Auftraggeber, ca. drei Monate Aufbereitung, Mengengerüst).
