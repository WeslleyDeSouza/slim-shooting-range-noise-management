# Checkliste für das Lösungskonzept SLIM

Stand: 12.09.2026. Interne Arbeitsunterlage für die Fertigstellung von C2.

**Prüfstand 12.09.2026 (abends):** abgearbeitet gegen `C2-Loesungskonzept-SLIM.md` v0.2, den FAQ-Export vom
11.09.2026, Beilage B1/B1.1/B1.2/B1.4 und den Code. Häkchen nach der Definition unten; offene Punkte tragen einen
**Befund**. Grundlage der Befunde zum Prototyp: [validierung-fachlich.md](validierung-fachlich.md) und
[validierung-technisch.md](validierung-technisch.md). «nicht prüfbar» = ausserhalb des Repositories (C1/C3/E1, Preisblatt, Firma).
Ein Häkchen heisst «im Konzept beschrieben und widerspruchsfrei», nicht «implementiert»; der Prototyp darf unvollständig
gezeigt werden, seine Ist-Aussagen müssen aber stimmen.

**Vereinbarte Reihenfolge der Nacharbeit (12.09.2026):**

| # | Arbeit |
|---|---|
| 1 | C2-Formel Anhang 9 und unbelegte Ist-Aussagen berichtigen; Matrix konsistent machen (Abschnitte 2, 7, 12). |
| 2 | Firma, Rechte, Provider und Zuständigkeiten verbindlich klären (OFFEN-Vermerke, Abschnitte 10, 11). |
| 3 | Datenmodell nach B1 Kap. 10 korrigieren (Muss-Anforderung slm 43/45), Fachfehler beheben, O8 vollständig anbinden (`validierung-fachlich.md` 4 und 7). |
| 4 | Finale Word-/PDF-Fassung rendern und Seitenlimit prüfen (Abschnitt 1). |

**Nachtrag 21.09.2026 (C2 v0.3):** Die mit «✔ 21.09.» markierten Befunde sind im Konzept v0.3 behoben: Formel Anhang 9,
E8-Referenzwerte (Formelblatt A7X 28.1 / Kern 28.0, beide Lesarten als Kernel-Parameter `emptyCategories` mit Test),
PostgreSQL 17 in allen Diagrammen, Mandant ≠ Umgebung, ERD und Prototyp-Aussagen auf das Datenmodell B1 Kap. 10
(Datenverwaltung 5.14–5.16, 5.18–5.21, 5.22–5.25, Import 5.19, Berechnungslauf, Ampeln aus der Berechnung), MFA eindeutig
(2FA vorhanden / in der Demo nicht aktiv, TOTP Ziel), ELO-Authentifizierung als Vorschlag OAuth2, FME-Ablauf B1 9.1 und
Ausschluss historischer Daten B1 9.2, Messumgebung 4.4, Barrierefreiheit (Vorgabe FAQ 9 ≠ eigener Zielstandard, manuelle
Prüfung), Testzahlen je Kategorie (Vitest 332, Jest 150, Playwright 50, 44 Kriterien-Skelette), Schulungsumfang FAQ 36/38,
Demo-Rolle Interessent, Lizenzversionen, Repository-Verweise aus dem Fliesstext, Matrix (slm 14–16, 18–25, 32, 43–45 P;
slm 55 Z). Weiterhin offen: Seitenlimit (Abschnitt 1, nach dem Render prüfen), die OFFEN-Vermerke zu Firma, Rechten,
Provider, LP5-Aufwand, Übersetzungsbüro, 3rd-Level-Standort, Repository-Standort, Schulungsannahme, Demo-URL und
Freeze-Datum sowie die Punkte «nicht prüfbar» in Abschnitt 13.

## Verwendung

Ein Häkchen bedeutet: Im aktuellen Konzept nachvollziehbar beschrieben, mit der Quelle abgeglichen und ohne Widerspruch zu Matrix, Diagrammen oder anderen Angebotsunterlagen. Es bedeutet nicht automatisch «bereits programmiert». Alle Felder sind absichtlich zunächst offen; dies ist keine neue Bewertung des aktuellen Word-Stands.

Kennzeichnung:
- **Vorgabe:** aus A2, B1, Teil A/B oder einer beantworteten FAQ abgeleitet.
- **Qualität:** empfohlene Ausarbeitung oder Absicherung, keine zusätzliche Ausschreibungspflicht.
- **Entscheid:** unsere zu klärende Ausgestaltung; nach Aufnahme ins Angebot kann daraus eine verbindliche Zusage werden.

Quellenstand FAQ: Export vom 11.09.2026. Vor Einreichung neuere Antworten/Berichtigungen prüfen. Der vollständige Wortlaut der Unterlagen bleibt massgebend; diese Checkliste ersetzt ihn nicht.

## 1. Form und Bewertbarkeit

- [x] ✔ 21.09. **Vorgabe:** Höchstens 15 A4-Seiten Konzept (A2). — **Befund 21.09.:** Vorschau v0.3 (`--pages`, ohne Deckblatt/Inhaltsverzeichnis): 17 Seiten = Konzept Seiten 1–15 (Seite 15 zu ≈ 65 % gefüllt) + Matrix Seiten 16–17. Bilder auf 50 %/15 % Breite, Diagramme 2.1/4.1 auf 90 %/92 %. Reserve zur Word-Paginierung ≈ ⅓ Seite – im Word-Endstand nachzählen; falls es kippt, das Telefon-Bild (5.4) entfernen.
- [x] ✔ 21.09. **Vorgabe:** Anforderungsmatrix als zusätzliche Beilage höchstens zwei A4-Seiten (FAQ 8). — **Befund 21.09.:** zwei Seiten (16–17) mit der kompakten Tabellenform (`<!-- compact -->`, 8.5 pt) und einzeiligen Status-Zellen.
- [x] **Vorgabe:** Deckblatt und Inhaltsverzeichnis enthalten keine bewertungsrelevanten Aussagen, wenn sie ausserhalb des Seitenlimits bleiben (FAQ 8). — Deckblatt als HTML-Kommentar «nicht bewertungsrelevant».
- [x] **Vorgabe:** Management Summary höchstens eine halbe A4-Seite (A2). — Flussseiten 1.0–1.3.
- [x] **Vorgabe:** Gesamtlösung einschliesslich der funktionalen und nichtfunktionalen Anforderungen nachvollziehbar beschrieben (Teil A Z2). — Kapitel 2–6 plus Matrix.
- [x] **Vorgabe:** Auch angebotene KANN-Funktionen schlüssig als künftige Umsetzung beschreiben; nicht einfach weglassen (FAQ 10). — slm 46–49 in 5.4, Matrix Status O.
- [x] ✔ 21.09. **Qualität:** Konzept vollständig ohne Aufruf einer Demo oder externer Repository-Links verständlich. — **Befund:** Management Summary verweist auf «Testbericht im Repository», Deckblatt-Kommentar auf `docs/architecture`; 6.5 erklärt die Demo als nicht nötig. Verweise auf das Repository aus dem Fliesstext nehmen.
- [ ] **Qualität:** Word-Endstand rendern; Seitenzahl, Lesbarkeit der Diagramme, Tabellenumbrüche und Bilder prüfen. — **Befund 21.09.:** `C2-Loesungskonzept-SLIM.docx` v0.3 gerendert (17 Vorschauseiten, ≈ 10.1 Flussseiten, 5 Diagramme, 5 Bilder); Sichtprüfung in Word (Seitenumbrüche, ERD-Lesbarkeit bei 82 %) steht aus.
- [ ] **Qualität:** Alle OFFEN-/PLACEHOLDER-Vermerke vor der Abgabe auflösen oder durch eine klar abgegrenzte, zulässige Aussage ersetzen. — **Befund 21.09.:** 11 Vermerke offen (Firma/ELO-Verhältnis, Rechtekette/OSS, Provider, Formulierung Firma, LP5-Aufwand, IT-Übersetzungsbüro, 3rd-Level-Standort, Repository-Standort, Schulungsannahme LP3, Demo-URL, Freeze-Datum) – alles Entscheide der Firma, keine fachlichen Lücken.
- [x] ✔ 21.09. **Qualität:** Kapitelverweise, FAQ-Nummern, Begriffe und Zahlen im gesamten Angebot vereinheitlichen. — **Befund:** PostgreSQL «17» (2.1, 2.2) gegen «16» (Diagramm 2.5). FAQ-Verweise geprüft: «Forum 120» (5.2, swisstopo-Nutzungsbedingungen) und «Forum 128» (5.4, Barrierefreiheit) existieren im Export (132 Fragen) und sind beide unbeantwortet – Verweise stimmen. Testzahlen: «275 Tests» (11.09.) und «95 der 180 API-Tests» (4.3) sind überholt; zutreffend am 12.09.: 197 Vitest erfolgreich, Jest erfolgreich (63 Fälle laut Doku), 32 Playwright-Fälle nicht ausgeführt, 46 Kriterien-Skelette (`test.fixme`). Diese Kategorien getrennt nennen, keine Summe bilden.

## 2. Management Summary

- [x] **Vorgabe:** Aufgabe und zentrale Merkmale der angebotenen Lösung knapp zusammenfassen.
- [x] **Qualität:** Nutzen für Fachspezialisten, Platzverantwortliche und weitere Rollen konkret erklären. — kurz, aber je Rolle benannt.
- [x] **Qualität:** SLIM als neue Fachapplikation, ELO als separates angebundenes System darstellen.
- [x] ✔ 21.09. **Qualität:** Keine Gleichsetzung von erprobten ELO-Komponenten mit bereits nachgewiesener SLIM-Funktionalität. — **Befund:** «Zwei-Faktor-Anmeldung … aus erprobten Komponenten» und 6.5 «Anmeldung mit 2FA umgesetzt»: im Prototyp ist 2FA per Konfiguration ausgeschaltet (`APP_AUTH_2FA_ENABLED` fehlt in `.env`/`.env.example`), die e2e-Suite umgeht den Schritt. Formulieren als «vorhanden, im Prototyp nicht aktiviert» oder aktivieren.
- [x] ✔ 21.09. **Qualität:** Prototypvorteile nur mit belegbaren Aussagen nennen; verbleibende Fach- und Integrationsarbeit nicht verharmlosen. — **Befund:** Testzahl veraltet und als Summe irreführend (Kategorien siehe Abschnitt 1); «Berechnungskern gegen Empa-Referenzdaten geprüft» stimmt; die sieben fachlichen Abweichungen aus `validierung-fachlich.md` (Halbtagsgrenze 13:00, gemischte Baujahre Anhang 7, Feiertage nicht angebunden, …) sind im Konzept nirgends als Restarbeit erwähnt.

## 3. Gesamtarchitektur und Technologie

- [x] **Vorgabe:** Architekturüberblick mit verständlichem Schema und Schichten (A2). — 2.1.
- [x] **Vorgabe:** Frontend, API, Fachmodule, Berechnung, Datenbank und externe Schnittstellen benennen. — 2.1.
- [x] **Vorgabe:** Eingesetzte Frameworks und Technologien nennen; Standardkomponenten sinnvoll einsetzen (A2 / Z2). — 2.2.
- [x] **Qualität:** Technologieentscheidungen begründen, insbesondere Angular, NestJS, PostgreSQL/PostGIS, GIS-Viewer und GDAL. — 2.2 Tabelle.
- [x] **Qualität:** Eigene Entscheidungen nicht als Vorgabe der Auftraggeberin bezeichnen. — «Wahl der Anbieterin», «Entscheid der Anbieterin gemäss FAQ 27».
- [x] **Entscheid:** Zielarchitektur von Prototyparchitektur unterscheiden; SQLite/MariaDB nicht als bereits erprobten PostgreSQL-Betrieb darstellen. — 2.1 gestrichelt, 2.2/2.3 «Prototyp: SQLite/MariaDB», Boot-Blocker benannt.
- [x] ✔ 21.09. **Qualität:** Worker-Container, API-Container und Datenbank in allen Diagrammen konsistent einzeichnen. — **Befund:** Worker in 2.1 und 2.5 vorhanden; Datenbankversion 17 (2.1) gegen 16 (2.5).
- [x] **Entscheid:** NGINX als Webserver/Reverse-Proxy und Coolify als Deployment-Verwaltung klar zuordnen. — 2.2, 2.5.
- [x] **Entscheid:** ELO und SLIM mit getrennten Applikationsinstanzen, Datenhaltung und Secrets darstellen, entsprechend der gewählten Architektur. — Summary, 2.3.
- [x] ✔ 21.09. **Qualität:** Mandantenkennung und Umgebungstrennung unterscheiden; tenantId ersetzt keine getrennten Umgebungen. — **Befund:** 2.3 sagt «der Mandant trennt Umgebungen innerhalb von SLIM (Demo, Akzeptanz, Produktion)», 2.5 sagt «drei getrennte Umgebungen mit identischen Container-Images». Widerspruch auflösen: Umgebungen = getrennte Instanzen, Mandant = fachliche Trennung.
- [x] **Vorgabe:** Wartbare, modular dokumentierte Architektur und konfigurierbare Fachparameter beschreiben (slm 55). — 6.1; zum Prototyp-Status siehe Abschnitt 11.

## 4. Fachliches Datenmodell

- [x] **Vorgabe:** Zeitunabhängige Referenzstruktur für Schiessplätze und Stellungsräume beschreiben (slm 42). — 2.3.
- [x] ✔ 21.09. **Vorgabe:** Immissionsberechnungen und deren versionierte Zustände nachvollziehbar modellieren (slm 18/43). — **Befund:** Text 2.3 stimmt («die Zustände tragen Quellen, Empfangspunkte und WLR-Werte»), das ERD in 2.3 widerspricht ihm: `AREA ||--o{ AREA_RECEIVER` hängt die Empfangspunkte am Schiessplatz, ein Anlageteil je Zustand fehlt, Untersuchungsperimeter und Gebäude fehlen. **Stand Prototyp 12.09.2026:** Das Datenmodell ist nach B1 Kap. 10 umgebaut (`validierung-fachlich.md` 7.3, `umsetzungsstand.md`): Anlageteile, Schusslinien mit Quelldaten, Perimeter, Gebäude, Immissionspunkte und WLR hängen am Zustand, Composite-FKs verhindern Verknüpfungen über Zustände hinweg; Matrix slm 43 kann damit auf «P» bleiben. **Offen im C2:** ERD 2.3 und der *Prototyp:*-Satz in 2.3 beschreiben noch den alten Stand («genau eine Quelle je Kombination», «Spalten noch englisch», Berechnungsstand als Zielzustand) und sind nachzuführen, damit Text, Diagramm und Matrix dasselbe Zielbild zeigen.
- [x] **Vorgabe:** Jeweils eindeutigen aktuell gültigen Zustand und Stand MGDM verwalten (slm 18). — 2.3 «Datenbank-Constraint» (Prototyp seit 12.09.2026: Unique-Indizes `uq_zustand_aktuell` / `uq_zustand_mgdm` über Markerspalten, `PATCH …/calculation/:stateId/pointer`).
- [x] **Vorgabe:** Schiessplatznutzungen von Berechnungszuständen entkoppeln; beliebige vorgesehene Perioden und Zustände kombinieren (slm 44). — 2.3, 4.1.
- [x] **Vorgabe:** Quellen-/Schusslinienzuordnung aus FGDB, WLR und Betriebsdaten beschreiben (slm 32). — 2.3, 4.2 (3).
- [x] **Vorgabe:** Relationale Datenbank mit Geometrieunterstützung und Nähe zum fachlichen Modell (slm 38). — 2.2, 3.4.
- [x] **Vorgabe:** Physische Datenbankobjekte in Deutsch vorsehen (B1 12.2); englische Codeklassen davon unterscheiden. — 2.3.
- [x] **Vorgabe:** Dezimale Schusszahlen und Mengen in kg durchgängig unterstützen (B1 6.2/11.2.3). — 2.3; Prototyp rundet beim Jahresmittel auf ganze Einheiten (`validierung-fachlich.md` 4.4).
- [x] **Qualität:** Interne Schlüssel, externe Koordinationsnummern und sonARMS-IDs eindeutig abbilden. — 2.3.
- [x] **Entscheid:** Ergebnis-Snapshots von importierten Berechnungszuständen unterscheiden; vollständige Eingaben, Parameter, Kernversion und Fachentscheidreferenzen aufbewahren. — 2.3 «Berechnungsstand».
- [x] **Qualität:** Unveränderbare Nutzdaten und veränderbare Auswahlzeiger/Archivstatus technisch konsistent beschreiben. — 2.3.
- [x] ✔ 21.09. **Vorgabe:** Strukturen für späteren historischen Import vorbereiten; historischen Vollimport nicht ungeprüft in den Grundauftrag aufnehmen (B1 9.2). — **Befund:** 3.2 zählt in der Probemigration «Nutzungen je Jahr» mit; B1 9.2 nimmt historische Nutzungen und Berechnungen ausdrücklich aus. Abgrenzung ergänzen.

## 5. Schnittstelle zu ELO

- [x] **Vorgabe:** GET Anlageninformationen mit Schiessplätzen, Stellungsräumen und zulässigen Waffen/Kalibern (slm 28). — 3.1.
- [x] **Vorgabe:** POST einer Schiessplatznutzung mit synchroner Rückmeldung (slm 29/30). — 3.1.
- [x] **Vorgabe:** JSON/UTF-8, HTTPS/TLS, Zeitformate, Viertelstundenraster, Feldlängen, Dezimalmengen und Statuscodes gemäss B1 Kapitel 6. — 3.1, 2.3.
- [x] ✔ 21.09. **Entscheid:** Maschinen-Authentifizierung, technische Berechtigungen und Schlüsselverwaltung konkretisieren. — **Befund:** 3.1 lässt «OAuth2 Client Credentials oder mTLS» offen; Entscheid treffen oder als Abstimmungspunkt mit Vorschlag formulieren.
- [x] **Qualität:** Wiederholte Übermittlungen und Doppelbuchungen behandeln; Replay-Schutz nicht mit fachlicher Idempotenz gleichsetzen. — 3.1 Idempotenz-Schlüssel, getrennt vom Replay-Header (2.1).
- [x] **Vorgabe:** Vorgehen mit AG und ELO-Entwicklerfirma sowie Verantwortlichkeiten gemäss FAQ 17 korrekt beschreiben. — 3.1.
- [x] **Qualität:** ELO-seitige Anpassungen von SLIM-Leistungen abgrenzen. — 3.1 (FAQ 17: Aufwände ELO trägt AG; kann ergänzt werden).
- [x] **Qualität:** Integrationstests für Erfolg, Fehler, Berechtigungen und Wiederholung vorsehen. — 3.1, 6.5.
- [x] **Vorgabe:** Bestehende ELO-Anbindung und optionale direkte SLIM-Erfassung nicht verwechseln. — 3.1 gegen 5.4.

Hinweis zum Prototyp (Abschnitt 12): 3.1 «Validierungsregeln des Nutzungs-Service sind umgesetzt» — Viertelstundenraster, Feldlänge 256, Anzahl Personen und zivile Nutzungsart fehlen im Prototyp.

## 6. Import, Migration und Export

- [x] **Vorgabe:** Initialimport aller geforderten Stammdaten und Beziehungen (slm 36 / B1 9.2). — 3.2.
- [x] **Vorgabe:** Excel-Schusszahlenimport nach B1.6 / B1 9.3 (slm 37). — 3.2.
- [x] **Vorgabe:** FGDB-Import sowie WLR- und Betriebsdatenübernahme beschreiben (slm 19). — 3.2.
- [x] **Vorgabe:** Unbekannte Stellungsräume mit Warnung und Importabbruch behandeln (slm 45). — 3.2/3.3 («Import mit Fehlern übernimmt nichts»; Prototyp seit 12.09.2026: `ImportService` bricht mit Befunden ab, eine Transaktion, `state-isolation.spec`).
- [x] ✔ 21.09. **Vorgabe:** Externe fachliche FME-Validierung von SLIM-internen Struktur-/Zuordnungsprüfungen unterscheiden (B1 9.1). — **Befund:** FME erscheint nur in der Risikotabelle 6.5 als Rückfall; der Ablauf «Export → Ingenieurbüro → FME-Validierung durch KOMZ → Import» aus B1 9.1 fehlt in 3.2.
- [x] **Qualität:** Staging, Prüfbericht, vollständige Übernahme oder Rücknahme und Fehlerbehebung erklären. — 3.2, 3.3.
- [x] **Qualität:** FGDB-Roundtrip mit den tatsächlichen Objektstrukturen und Geometrien als Nachweis vorsehen. — 2.2, 6.5 («vor Abgabe»); noch nicht durchgeführt (GDAL lokal nicht installiert, `umsetzungsstand.md`).
- [x] **Vorgabe:** Datenbereitstellung, Qualitätsverantwortung des AG und etwa drei Monate Aufbereitung gemäss FAQ 28 berücksichtigen. — 3.2.
- [x] **Vorgabe:** Stufenweise Datenmigration auf dem Akzeptanzsystem und Übergabe an den Betrieb beschreiben oder nachvollziehbar referenzieren (Teil B 2.3.3). — 3.2.
- [x] **Vorgabe:** Berechnungszustände als GeoDB und Schusszahlen als CSV exportieren (slm 20). — 3.4.
- [x] **Vorgabe:** Weiterverarbeitbare Exporte mindestens als CSV; vollständiger Nutzungsexport mit allen geforderten Attributen (slm 39/40). — 3.4.
- [x] **Vorgabe:** MPV-Gesamtstatistik mit den verlangten Angaben je Platz beschreiben (slm 41). — 3.4.
- [x] **Vorgabe:** DB-Views für MGDM/ImmoGIS und geregelten, verschlüsselten Zugriff für berechtigte bundesinterne Empfänger erläutern (slm 38 / Teil B 2.6.1 / FAQ 15). — 3.4.
- [x] **Qualität:** Gefilterten Tabellenexport vom vollständigen Fachexport unterscheiden. — 3.4.

## 7. Lärmberechnung und Fachregeln

- [x] **Vorgabe:** Berechnungsablauf von Nutzungen über Betriebsdaten und Quellenverteilung bis Lr/Grenzwertvergleich darstellen (A2 / slm 31–34). — 4.1, 4.2.
- [x] **Vorgabe:** Bestehende sonARMS-Ausbreitungsresultate übernehmen; den Ausbreitungskern nicht als neu zu entwickelnden SLIM-Bestandteil darstellen (FAQ 19). — 4.1.
- [x] **Vorgabe:** Anhang 9 für Militär, Zivil, Blaulicht und SAT; Anhang 7 normalerweise für Zivil/SAT sowie Sonderfall Gesamtbeurteilung nach Anhang 7 (B1 Tabelle 2). — 4.2 (1).
- [x] **Vorgabe:** Werktagssplit Mo–Fr 07–19 Uhr und anteilige Zeitverteilung beschreiben. — 4.2 (2).
- [x] **Vorgabe:** Lokale ganze und halbe Feiertage berücksichtigen. — 4.2 (2) beschrieben; **Prototyp:** Kernel kann es, Assessment/Simulation übergeben keinen Kalender (Abschnitt 12).
- [x] **Vorgabe:** Schiesshalbtage je A7-Waffenkategorie gemäss B1 7.4.3 erklären, einschliesslich Mehrfachnutzungen und Dauerregel. — 4.2 (2), 4.3; Grenze Vormittag/Nachmittag (B1: 12:00) im Text nicht genannt, **Prototyp rechnet mit 13:00**.
- [x] **Vorgabe:** Benutzerwahl von drei repräsentativen, auch nicht zusammenhängenden Jahren und beliebigem Betrachtungszeitraum ermöglichen (B1 7.4.5). — 4.2 (2); Prototyp: nur zusammenhängender Zeitraum.
- [x] **Vorgabe:** Quellengewichte gemäss Betriebsdaten, getrennt nach erforderlichen Kategorien/Zeitgruppen, anwenden (B1 7.5). — 2.3, 4.2 (3).
- [x] **Vorgabe:** LAFmax aus WLR_Day für A7; LAE aus den betreffenden WLR-Zeitgruppen für A9 eindeutig zuordnen. — 4.1.
- [x] ✔ 21.09. **Vorgabe:** Formeln und energetische Aggregation je Anhang nachvollziehbar erklären. — **Befund:** 4.2 (4) schreibt `Lr = 10·log(10^(0.1·LAE1) + 10^(0.1·(LAE2 + K2))) − 10·log(T)`; LSV Anhang 9 Ziff. 31 lautet `Lr = 10·log(10^(0.1·LAE1) + 10^(0.1·(LAE2 + K1))) − 10·log(T) + K2` mit K1 = 5, K2 = 15. Der Code (`annex9.ts`) ist korrekt, der Konzepttext nicht.
- [x] **Vorgabe:** Stichtag 01.01.1985 und gemischte Anlagen mit getrennter Datenmenge neuerer Stellungsräume berücksichtigen. — 4.2 (5); Prototyp: Anhang 7 nimmt die Halbtage aller Stellungsräume (Abschnitt 12).
- [x] **Vorgabe:** Anlagenabgrenzung gemäss B1 7.3 korrekt wiedergeben; verbleibende fachliche Klärungen ausweisen. — 2.3, 6.5 Risikotabelle.
- [x] **Vorgabe:** Rundung zur Beurteilung gemäss B1.2 10.4 von interner Rechengenauigkeit und Teilpegelanzeige unterscheiden. — 4.2 (5).
- [x] **Vorgabe:** Grenzwerte, Empfindlichkeitsstufen, Kontingentvergleich und konfigurierbare Schwellen erklären; Sollwert null und Betrachtungsbasis klären. — 4.2 (5); Prototyp: `quotaState` ohne Soll → «keine Daten» statt rot.
- [x] ✔ 21.09. **Qualität:** A7-/A9-Referenzwerte getrennt und mit einheitlicher Genauigkeit ausweisen. — **Befund:** Tabelle 4.3 mischt eine Dezimale (60.7) mit zwei Dezimalen (28.08 / 28.05) und Klammerwerten mit vier Dezimalen; einheitlich «gerundet / ungerundet» in zwei Spalten.
- [x] ✔ 21.09. **Qualität:** E8-Sonderfall mit ungerundeten Werten, Referenzmodus und dokumentierter Fachfreigabe behandeln. — **Befund:** 4.3 behauptet «der Kern hält beide Varianten als getesteten Parameter bereit» — `annex7Level` hat keinen solchen Parameter (leere Kategorien werden immer ausgelassen). Parameter bauen oder Satz streichen.
- [x] **Qualität:** Skalierungstests korrekt trennen: A9 +10 dB, A7 +3 dB bei zehnfacher Menge und sonst gleichen Voraussetzungen. — 4.3; Tests `annex9.spec`, `annex7.spec`.

### Festgelegter Entwurfsentscheid O8

Die folgenden Punkte sind unsere fachliche Ausgestaltung eines Sonderfalls, keine wörtliche Vorgabe aus B1.

- [x] **Entscheid:** Bei positiven Schusszahlen und Gewichtssumme null gilt `refuse` als Default. — 4.2 (3); `distribution.ts`.
- [x] **Entscheid:** Teilweise Nullgewichte bei positiver Gewichtssumme behalten das definierte Verhältnis; keine Gleichverteilung. — `distribution.spec.ts`; im Konzept implizit («im Verhältnis dieser Gewichte»).
- [x] **Entscheid:** Fehlende Quelle separat ausweisen; Mengen niemals still verwerfen. — 4.2 (3), `missingSources` im DTO.
- [x] ✔ 21.09. **Entscheid:** Unvollständigkeit bis zur Gesamtbeurteilung, Anzeige und Export weitergeben; keine gültige Gesamtampel aus Restdaten. — **Befund:** Detailmaske, Simulation, Zähler und Legende tragen «nicht beurteilbar»; die Ampeln der Übersicht 5.9 und der Kontextleiste kommen aus dem Seed und kennen den Status faktisch nicht; ein Export existiert nicht. 4.2 (3) «bis in Detailmaske, Zähler und Export umgesetzt und getestet» ist für den Export falsch.
- [x] **Entscheid:** Gleichverteilung nur mit expliziter dokumentierter KOMZ-Freigabe; Datum/Dokumentreferenz und angewandte Regel im Berechnungsstand speichern. — 4.2 (3); Kernel verlangt `release`; Berechnungsstand ist Zielzustand.
- [x] **Entscheid:** Keine Untergrenzenfunktion als Bestandteil dieses Angebots zusagen. — nicht zugesagt (Konzept), bewusst nicht gebaut (`laermberechnung.md`).
- [x] ✔ 21.09. **Qualität:** Kern-, Aufrufer-, Anzeige- und Exporttests getrennt nachweisen, sofern bereits als umgesetzt behauptet. — **Befund:** Kern (`distribution.spec`, 7 Tests) ✅, Aufrufer (`assessment.service.spec` O8) ✅, Anzeige (Jest Details/Simulation) ✅, Export ❌ (nicht vorhanden). `distributeShots` ist zudem nicht angebunden; der Aufrufer behandelt nur «keine Quelle».

## 8. Performance und Skalierung

- [x] **Vorgabe:** Bis zehn gleichzeitige Nutzer und alle Antwortzeiten aus B1 12.5 berücksichtigen. — 4.4.
- [x] **Vorgabe:** Zielmengengerüst aus FAQ 18/28 verwenden; Demo-Mengen nicht als Zielauslegung darstellen. — 4.4.
- [x] **Vorgabe:** Umgang mit grossen Geodaten, Import, Validierung und Visualisierung erklären. — 3.3, 5.2.
- [x] **Vorgabe:** Rechenintensive Prozesse von anderen Nutzern ressourcenisolieren (slm 54). — 4.4; Prototyp synchron im API-Prozess (so ausgewiesen).
- [x] **Entscheid:** Worker, Warteschlange, Prioritäten, Ressourcenlimits, Abbruch und Wiederanlauf beschreiben. — 4.4, 6.2.
- [x] **Qualität:** Wartezeit, DB-Zugriff und Netzwerk zur gemessenen Gesamtantwortzeit zählen. — 4.4.
- [x] ✔ 21.09. **Qualität:** Rechenkern-Benchmark klar von vollständigem Lasttest unterscheiden; Datum, Datenmenge und Umgebung angeben. — **Befund:** 4.4 nennt Datum und Datenmenge, nicht die Umgebung (Rechner, SQLite in-memory). Ergänzen; aktuelle Service-Messung vom 12.09. in `validierung-technisch.md` 1.1 (Beurteilung 4 572 Nutzungen: Ø 146 ms).
- [x] **Qualität:** Keine lineare Durchsatzverdopplung oder garantierte Vollständigkeit aus einem kleinen Benchmark ableiten. — 4.4 «Nachweis unter Last folgt im Lasttest».

## 9. Oberfläche und Fachfunktionen

- [x] **Vorgabe:** Startseite, Navigation, Kontextwechsel und Deep Links (slm 5–9). — 5.1.
- [x] **Vorgabe:** Nutzungserfassung/-bearbeitung/-löschung und Nutzbarkeit ohne Berechnungsgrundlage (slm 4/10). — 5.1.
- [x] **Vorgabe:** Empfangspunktdetails und Simulation mit hypothetischen Schusszahlen (slm 11/12). — 4.1, 5.1.
- [x] **Vorgabe:** Stammdatenpflege je Fachgruppe beschreiben: Platz, Stellungsräume, Kontingente, Waffen/Kaliber, Kategorien, sonARMS-Zuordnung, ALN/SAP und Aktivstatus (slm 13–25). — 5.1.
- [x] **Vorgabe:** Benutzer-/Platzberechtigungen und erweiterte Konfiguration einschliesslich Sperrdatum, Handbuchupload und Ampelfarben (slm 26/27). — 2.4, 5.1.
- [x] **Vorgabe:** Tabellenfunktionen mit Suche, Sortierung, Mehrfachauswahl, Filtern und Exporten beschreiben (slm 3). — 5.3.
- [x] **Vorgabe:** Geforderte persistente Benutzereinstellungen und Mehrfach-Tab-Betrieb berücksichtigen. — 5.3.
- [x] **Vorgabe:** GIS-Viewer mit LV95, Massstab, Zoom, Hintergrundkarten, konfigurierbaren Layern und PDF-Export (slm 2). — 5.2; Prototyp hat keine Kartenkomponente (Abschnitt 12).
- [x] **Vorgabe:** Anlagenteile und Immissionspunkte im Grundumfang; Gebäude, Isophonen und Untersuchungsperimeter über LP5 (FAQ 13). — 5.2.
- [ ] **Qualität:** Gewünschte Kosten-/Aufwandsschätzung für die optionalen GIS-Layer ergänzen (FAQ 13: erwünscht). — **Befund:** [OFFEN] in 5.2.
- [x] **Vorgabe:** Mobile Bedienung und Anforderungen an Desktopdarstellung/Ergonomie beschreiben. — 5.3 (1'600 × 1'200), 5.4.
- [x] **Vorgabe:** DE/FR/IT ab Start, Browsersprache, persistente Wahl und lokalisierte Berichte (slm 51). — 5.4.
- [x] **Vorgabe:** FR-Übersetzungen durch AG gemäss B1 korrekt zuordnen; EN als eigene Zusatzleistung kennzeichnen. — 5.4, Summary «Englisch zusätzlich».
- [x] **Vorgabe:** Ergonomie sowie Barrierefreiheitsantwort aus FAQ 9 korrekt berücksichtigen; FAQ 128 im Export unbeantwortet. — 5.4 «Prüfstandard gemäss FAQ 9, Forum 128 offen» entspricht dem Export (128 offen, Barrierefreiheit im Grundauftrag inkl. Karte/PDF).
- [x] ✔ 21.09. **Qualität:** Selbst zugesagten WCAG-Zielstandard von einer bestätigten Vergabevorgabe unterscheiden; manuelle Prüfungen neben automatisierten Tests vorsehen. — **Befund:** 5.4 «Barrierefreiheit nach eCH-0059 / WCAG 2.1 AA … Prüfstandard gemäss FAQ 9» vermischt eigene Zusage (2.1 AA) und Vorgabe (FAQ 9: keine speziellen Anforderungen, Anlehnung an ar.admin.ch); nur axe im Build, keine manuelle Prüfung genannt.

### Optionale direkte Erfassung in SLIM

- [x] **Vorgabe:** QR-Einstieg mit schreibgeschützter Platz-/Raumvorbelegung (slm 46). — 5.4.
- [x] **Vorgabe:** Tagesdatum, Viertelstundenpicker, Einheit/Autocomplete, zivile Nutzungsart, Personenzahl und mehrere Waffen/Kaliber-Zeilen (slm 47). — 5.4.
- [x] **Vorgabe:** Dezimalmenge und dynamische Einheit Stück/kg (slm 47). — 5.4.
- [x] **Vorgabe:** Eingabevalidierung, Zwischenspeicherung bei Verbindungsabbruch und Erfolgsbestätigung (slm 48). — 5.4.
- [x] **Vorgabe:** Kryptografischen QR-Manipulationsschutz als angebotene Option beschreiben (slm 49). — 5.4.
- [x] **Qualität:** Wiederanmeldung, duplikatfreie Übertragung und ungültige QR-Codes behandeln. — 5.4.
- [x] **Qualität:** Optionale Ablösung nicht als bereits vorhandene ELO-Funktion abrechnen oder nachweisen. — C2 tut das nicht (`index.md` Abschnitt 0 formuliert es noch als «bereits gelöst» — dort anpassen).

## 10. Sicherheit, Datenhaltung und Betrieb

- [x] **Vorgabe:** Authentifizierung, Autorisierung und Datenschutz erklären (A2). — 2.4.
- [x] **Vorgabe:** Wahl MFA oder AGOV durch Anbieterin begründen (FAQ 27). — 2.4.
- [x] **Entscheid:** E-Mail-Code als Prototypstand und TOTP als Zielzustand korrekt benennen, solange TOTP noch nicht umgesetzt ist. — 2.4; Aktivierungszustand des Prototyps siehe Abschnitt 2/12.
- [x] **Qualität:** Enrollment, Schlüsselablage, Wiederherstellung und Notfallzugang ohne schwachen Ersatzweg beschreiben. — 2.4.
- [x] **Vorgabe:** Vier Fachrollen und Objekt-/Platzrechte serverseitig prüfen; Frontend-Sichtbarkeit ergänzend umsetzen. — 2.4; Prototyp: serverseitig ✅, Frontend statisch (so ausgewiesen).
- [x] **Vorgabe:** Authentifizierungsprotokollierung und Break-Glass-Zugang (slm 56); Ist-/Zielstatus konsistent. — 2.4, Matrix «P (Break-Glass-Prozess Z)».
- [ ] **Vorgabe:** Hosting in der Schweiz und Sicherheitsanforderungen gemäss Teil B; Anbieter-/Providerangaben konkretisieren. — **Befund:** [OFFEN] Provider in 2.5.
- [x] **Vorgabe:** Bezug zum E1-Datenhaltungskonzept: auch Projektdaten, CI/CD, Logs, Telemetrie, Support und KI beachten (FAQ 49). — 6.3.
- [x] **Vorgabe:** Deployment, Container, Infrastruktur und Umgebungen beschreiben (A2). — 2.5.
- [x] **Qualität:** Geheimnisse, Adminzugriff, Sicherheitsupdates und Abhängigkeitsprüfung erklären. — 2.4 Härtung, 2.5 Coolify-Zugang.
- [x] **Vorgabe:** 99 % Verfügbarkeit pro Kalendermonat bezogen auf Mo–Fr 07–19 Uhr, genehmigte Wartungsfenster korrekt berücksichtigen. — 2.5, 6.3.
- [x] **Vorgabe:** Manuelle/automatische vollständige Backups, Integritätsprüfung, zwölf Monate Mehrgenerationen, RPO ein Tag/RTO zwei Tage und jährlicher Restore-Test. — 2.5.
- [x] **Vorgabe:** Unterstützung von Provider-Infrastruktur und Cloud-/Objektspeicher für Backups, beide Schweiz (FAQ 14). — 2.5.
- [x] **Vorgabe:** Lesbarer Datendump auf Verlangen. — 2.5.
- [x] **Entscheid:** Rollback/PITR mit tatsächlich vorgesehenen Backups, WAL-Archivierung und geprüftem Wiederherstellungsweg beschreiben. — 2.5.
- [ ] **Vorgabe:** Supportzeiten, Standorte, Ticket-/Hotlineweg, Zuständigkeiten sowie Incident-/Problem-/Change-Prozesse darstellen oder auf konkrete Angebotsbeilage verweisen. — **Befund:** 6.3 vorhanden, [OFFEN] Standort 3rd Level.
- [x] **Vorgabe:** Reaktion 4 h, Behebungsbeginn 24 h, Behebung in der Regel 48 h für entsprechende Störungen; Prioritäten-/Eskalationsmodell (FAQ 4). — 6.3.
- [x] **Vorgabe:** Vor-Ort-Fähigkeit in Bern innerhalb eines Arbeitstags berücksichtigen (Teil B 2.8). — 6.3.

## 11. Wartbarkeit, Dokumentation und Rechte

- [x] ✔ 21.09. **Vorgabe:** Modularität, Änderbarkeit und administrativ konfigurierbare Fachparameter erklären (A2 / slm 55). — **Befund:** 6.1 beschrieben; die Matrix führt slm 55 als «P» (im Prototyp nachgewiesen). Im Prototyp sind Grenzwerte, Ampelschwellen, Rundung, Werktagsfenster und Halbtagsgrenze Konstanten, Feiertage/Sperrdatum fehlen (`validierung-technisch.md` 2.2). Status auf «Z (Architektur P)» setzen.
- [x] **Vorgabe:** Vollständiges deutsches Benutzerhandbuch online/PDF, Pflege mit jedem Release und kontextsensitive Hilfe bis maximal zwei Sekunden (slm 53). — 6.4.
- [x] **Vorgabe:** Schulung/Train-the-Trainer gemäss Teil B und FAQ 36–38 beschreiben. — 6.4 per Verweis; Umfang (10 initial, 2 wiederkehrend, Annahme für Erweiterungen) ausschreiben.
- [x] **Qualität:** Technische Dokumentation, reproduzierbarer Build, Tests, Migrationen und Übergabe an einen anderen Betreiber erläutern. — 2.2, 6.4.
- [x] **Entscheid:** Vorbestehende galaxy-Bibliotheken, OSS-Abhängigkeiten und SLIM-Code getrennt inventarisieren. — 2.2 (drei Schichten, SBOM).
- [ ] **Entscheid:** Private Entwicklung durch Weslley als Herkunftsangabe festhalten; Rechtekette, fremde Beiträge und Rechte an die einreichende GmbH klären. — **Befund:** Herkunft in 2.2 genannt, Rechtekette [OFFEN].
- [ ] **Entscheid:** Lizenz an die Auftraggeberin, Änderungen, Betrieb durch Dritte sowie Quellcode-Lieferung verbindlich mit Vertrag abgleichen. — **Befund:** [OFFEN] Lizenztext/OSS; nicht prüfbar (Vertrag).
- [x] **Qualität:** Quellcode-Lieferung und Escrow nicht als gleichwertig darstellen; keine nicht beschlossene OSS-Freigabe behaupten. — 2.2 «wird geprüft».
- [x] ✔ 21.09. **Qualität:** Lizenzliste mit Versionen/Notices; GPL-Komponenten nicht pauschal als permissiv bezeichnen. — **Befund:** 2.2 nennt Lizenzen ohne Versionen und ohne Notices; PostGIS korrekt als GPL nur serverseitig.

## 12. Matrix und Prototypnachweise

- [x] **Vorgabe:** Umsetzung sämtlicher B1-Anforderungen nachvollziehbar abdecken; Matrix ersetzt keine Erklärung. — jede Zeile verweist auf ein Kapitel.
- [x] **Qualität:** Alle IDs slm 1–57 vollständig zuordnen; zusätzlich relevante Fliesstextfestlegungen beachten. — 57 Zeilen vorhanden.
- [x] **Qualität:** Eine Zeile je ID für gute Prüfbarkeit; dies ist keine hier nachgewiesene Formpflicht.
- [x] **Qualität:** Status unterscheiden: vorhanden, teilweise vorhanden, verbindlicher Zielzustand, angebotene Option, echte offene Klärung. — P/Z/O/K mit Klammern.
- [x] **Qualität:** FAQ 13/27 nicht weiterhin als offene Entscheidung der Vergabestelle markieren; offene FAQ 117/128 korrekt behandeln. — FAQ 13 (LP5) und 27 (MFA-Wahl) eingearbeitet; 117 (LP1b/Simulation) als Matrix-Status K bei slm 12, 128 als offen in 5.4 – beide im Export unbeantwortet, Verweise stimmen.
- [x] ✔ 21.09. **Qualität:** Tests mit einem gemeinsamen Datum/Commit zählen; Testgerüste, übersprungene Tests und erfolgreiche Tests trennen. — **Befund:** «275 automatisierte Tests» ist eine Summe über ungleiche Kategorien. Stand 12.09.: 197 Vitest-Tests erfolgreich; Jest erfolgreich (63 Fälle laut Doku); 32 Playwright-Fälle vorhanden, in dieser Prüfung nicht ausgeführt; 46 Kriterien-Fälle sind `test.fixme`-Skelette. 6.4 «automatisierte End-to-End-Fälle je slm-Nummer» als Skelett ausweisen.
- [x] **Qualität:** Aktuellen PostgreSQL-Boot-/Migrationstest, Berechnungstests und erforderliche Integrationsnachweise referenzieren, soweit als vorhanden behauptet. — 2.2 nennt den offenen Boot-Blocker ehrlich; Berechnungstests belegt.
- [x] ✔ 21.09. **Qualität:** Seed-Ampeln, schematische Karten und deaktivierte Exportknöpfe nicht als vollständige Fachfunktionen ausweisen. — **Befund:** Matrix slm 8 «P» und 5.1 «Übersicht Schiessplätze mit Kontingent- und Lärm-Ampel» verschweigen, dass beide Ampeln aus dem Seed kommen (8 von 9 Plätzen ohne Berechnungsgrundlage tragen trotzdem eine Lärm-Ampel). Karte und Exporte sind korrekt als Zielzustand markiert. Zusätzlich zu prüfende Prototyp-Aussagen: 3.1 Validierungsregeln (Viertelstunden, 256 Zeichen, Personen fehlen), 4.2 (3) «Export» (fehlt), 4.3 «beide Varianten als Parameter» (fehlt), 4.3 «halbe Feiertage umgesetzt» (Kern ja, Anwendung nein), 4.2 (5) «PW-Teilbetrachtung» (Anhang 7 unvollständig), 6.5 «Anmeldung mit 2FA» (deaktiviert), Matrix slm 55 «P».
- [x] **Qualität:** Alle Screenshots und Demo-Aussagen eindeutig SLIM zuordnen; Wiederverwendung aus ELO separat gekennzeichnet. — Bilder aus `docs/architecture/images`; galaxy/ELO-Herkunft in 2.2.
- [x] **Qualität:** Synthetische Daten, echte Stammdaten und Empa-Referenzdaten korrekt unterscheiden. — 6.5.
- [ ] **Qualität:** Demo-URL und eingeschränkte Konten testen, wenn eine Demo angeboten wird; keine Demo als formelle Pflicht darstellen. — **Befund:** URL [PLACEHOLDER]; Demo-Konto «nur Lesen und Simulation» widerspricht der Matrix 8.1.2 (Interessent hat für die Simulation X) – Rolle benennen.

## 13. Letzte Freigabe

- [ ] Firmenbezug, Rechte, Provider und Zuständigkeiten mit C1/E1-Unterlagen abgestimmt. — nicht prüfbar.
- [ ] Leistungspaket-Zuordnung und zugesagte Leistungen mit Preisblatt abgestimmt; insbesondere LP1b/LP5. — nicht prüfbar; Matrix slm 12 «Zuordnung LP1a/LP1b K».
- [ ] Zeitplan, Migration, Mitwirkungen und Risiken mit C3 abgestimmt; keine widersprüchlichen Termine/Zusagen. — nicht prüfbar.
- [ ] Fachprüfung der Berechnungsregeln und technische Prüfung des angebotenen Zielbilds erfolgt. — **Befund:** interne Prüfung am 12.09. erfolgt (`validierung-fachlich.md`, `validierung-technisch.md`); Bestätigung durch die Fachstelle steht aus.
- [ ] Aussagen «bereits umgesetzt/getestet» durch passende Nachweise gedeckt. — **Befund:** Liste in Abschnitt 12 abarbeiten.
- [ ] Aktueller FAQ-Stand und Berichtigungen vor Abgabe geprüft. — Export 11.09.; Fragefrist 18.09.
- [ ] Endgültiges Word/PDF visuell geprüft; Seitenlimit eingehalten. — siehe Abschnitt 1.

## Quellen und ergänzende Arbeitsunterlagen

- [Beilage A2](Beilage%20A2%20Vorgaben%20Lösungskonzept.pdf)
- [FAQ-Export vom 11.09.2026](FAQ-Export-2026-09-11.md)
- [Fachliche Validierung des Prototyps](validierung-fachlich.md)
- [Technische Validierung des Prototyps](validierung-technisch.md)
- Die früher verlinkten Dateien `05-Fachliche-technische-Gegenpruefung-C2.md` und `04-Pruefpunkte-C2-Abgleich-B1-FAQ.md` liegen nicht im Repository.

Die Checkboxen betreffen die Erstellung und Prüfung des Konzepts. Eine vollständige Produktabnahme ist ein separater Schritt.
