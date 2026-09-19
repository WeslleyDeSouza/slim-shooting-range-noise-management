# Priorisierte Fachkorrekturen – 13.09.2026

Die Prioritäten des Fachreviews wurden gegen Implementierung und Tests geprüft. Die nachstehenden Nachweise gelten für die beschriebenen Fälle; sie sind keine vollständige fachliche Abnahme der Anwendung.

| Priorität | Punkt | Stand und Nachweis |
|---|---|---|
| 1 | A9-Zeitaufteilung | Korrigiert: abgeleitete Mengen werden nicht mehr auf die Dezimalstellen der Eingabe gerundet. 1 kg bei hälftiger Zeitaufteilung ergibt 0,5/0,5. Regression in `fachreview.spec.ts`; weitere Zeitgrenzen im gemeinsamen Kerneltest. |
| 1 | Gemischte Baujahre | Simulation berechnet zusätzlich zum Gesamt-IGW den PW der neuen Anlageteile. Beide Beurteilungszeilen werden ausgegeben und angezeigt; der schlechteste Status bestimmt die Ampel. Regression: Gesamtpegel unter IGW, neuer Teil über PW. Frontendtest prüft IGW/PW in der Tabelle und rote Kartenmarkierung. |
| 1 | Widersprüchliche A7-Kategorien | Explizite Importkategorie muss zur Waffenkategorie passen; andernfalls Importabbruch ohne neue Zustände. Bereits widersprüchliche Quellen werden bei positiver betroffener A7-Menge als `category-mismatch` gemeldet; die Beurteilung ist unvollständig. |
| 2 | Berechnungssnapshots | Der Lauf übernimmt die tatsächlich vom Assessment geladenen Eingaben, statt Nutzungen und Referenzen nach der Berechnung erneut zu lesen. Zustand, WLR und gegebenenfalls Vergleichszustand werden gespeichert. Prüfsumme umfasst auch Zeitraum und Ergebnis. Datenbanktest verändert eine Nutzung nach dem Assessment und vor der Speicherung: der Snapshot behält die verwendete Menge. |
| 2 | Übersichtscaches | Neuberechnung beim Start und täglich um Mitternacht Europe/Zurich. Vor der Neuberechnung werden alte Statuswerte invalidiert; ein Fehler lässt keinen alten grünen Wert stehen. Fehler werden protokolliert. Tests prüfen fehlgeschlagene Aktualisierung und Schweizer Jahreswechsel bei noch altem UTC-Jahr. |
| 2 | Teiljahre und beliebige Zeiträume | Offen: verbindliche Normierung angefragt. Die bestehende Rundung des Jahresnenners bleibt bis zum Fachentscheid unverändert und ist ausdrücklich nicht fachlich freigegeben. |
| 3 | Originaldateien, Browser und Export | Offen: keine vollständige Kette ausgeführt. Der Berechnungsimport nimmt aufbereitete JSON-Daten entgegen; Originaldateiparser und Upload-Maske fehlen laut Implementierung und Umsetzungsstand. Komponenten- und Service-Tests ersetzen diesen Abnahmenachweis nicht. |

## Prüfungen

- `npx --no-install vitest run --config apps/api/vitest.config.mts`: **265 Tests bestanden**, 25 Dateien.
- Nach Ergänzung des Zeitzonen-Grenzfalls gezielt `area-status.service.spec.ts` erneut ausgeführt: **8 Tests bestanden**.
- `npx --no-install jest --config apps/app/jest.config.ts --runInBand`: **73 Tests bestanden**, 11 Suites, einschließlich Anzeige der getrennten IGW-/PW-Beurteilungen.
- API-TypeScript-Prüfung und ESLint für die zuletzt geänderten Dateien: bestanden.
- Kernelversion der gespeicherten Läufe: **1.3.0**.

Die präzisere Zeitaufteilung verändert den synthetischen Geissalp-Referenzwert E5/Anhang 9. Eine separate Python-Rechnung aus `tenant.mock.json` zählt die Zeitanteile minutenweise unter Berücksichtigung der Feiertage, verteilt die Mengen nach den Quellengewichten und summiert die Day-/Eve-Energien mit 5 dB Zuschlag ausserhalb der Werktagszeit. Sie ergibt **61,84899362915047 dB**, angezeigt **61,8 dB**. Der bisherige Erwartungswert 61,9 wurde deshalb angepasst. Diese Nachrechnung betrifft die Demo-JSON-Daten, nicht die Original-Excel-Datei.

## Grenzen und nächste Schritte

1. **Teiljahre:** fachlich entscheiden, ob und wie Mengen und Halbtage eines Teilzeitraums annualisiert werden. Danach unabhängige Sollwerte für 6, 18 und 30 Monate, Schaltjahre und jahresübergreifende Zeiträume festlegen und testen.
2. **Originalkette:** Parser und Upload für die gelieferten Formate sowie den vorgesehenen Export fertigstellen. Danach Originaldatei → Import → Betriebsdaten → Verteilung → Rohpegel → IGW/PW → Browseranzeige → Export mit unabhängigen Sollwerten prüfen. Vorhandene `test.fixme`-Drehbücher zählen nicht als bestandene Tests.
3. **Snapshotgrenze:** Ergebnis und gespeicherte Eingaben stammen nun aus denselben geladenen Objekten. Eine transaktionsweit einheitliche Datenbanksicht über sämtliche Leseabfragen ist damit noch nicht nachgewiesen. Kontingente werden zusätzlich gespeichert, sind aber kein Eingang der Lärmberechnung und werden separat gelesen.
4. **Cachegrenze:** Start-/Tagesaktualisierung und Fehlerinvalidierung sind abgedeckt. Ein allgemeiner Nachweis gegen konkurrierende Aktualisierungen über mehrere API-Instanzen steht noch aus. Historische gespeicherte Läufe werden nicht umgerechnet; ihre Kernelversion bleibt erhalten.

Relevante Implementierungen und Tests liegen unter `apps/api/src/modules/calculation`, `libs/shared/lsv/src/lib/operating-data.*` und `apps/app/src/app/views/admin/area/simulation`.
