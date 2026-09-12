# Nachweis Rechenfälle durch die Kette (Testplatz S)

**Stand:** 12.09.2026 · **Geprüfter Commit:** `79e9c67` (master) · **Umgebung:** lokal, Windows 11, Node 24,
Vitest 4.1.11, in-memory SQLite (`@api-slim/tests`) · **Lauf:** `cd apps/api && npx vitest run`

Zweck: die Lücke zwischen «Kernel korrekt» (`libs/shared/lsv`, Kontrollwerte B1.4) und «die Anwendung
wendet die Regeln korrekt an» schliessen. Grundlage ist der synthetische **Testplatz S**
(`libs/api/tests/src/lib/fixtures/testplatz-s.dataset.ts`, Handrechnung
`apps/app-e2e/src/actors/fixtures/platz-s.md`). Jeder Soll-Wert stammt aus der Handrechnung und der
unabhängigen Python-Gegenrechnung (`TESTPLATZ_S_REFERENCE`, volle Genauigkeit), nie aus der Anwendung.
Geprüft werden Zwischenwerte (Betriebsdaten, Halbtage, Quellenanteile, Rohpegel) und Endwerte (Anzeige,
Status), je Fall mit frisch geseedeter Fixture.

## Ergebnis

| Suite | Ergebnis |
|---|---|
| API gesamt (`apps/api`, 23 Dateien) | **240 bestanden, 0 fehlgeschlagen, 0 todo** |
| davon `modules/calculation/rechenfaelle.spec.ts` | 25 bestanden |
| davon `libs/shared/lsv/operating-data.spec.ts` (Kernel, Fall 2a neu) | 23 bestanden |

Fälle in `rechenfaelle.spec.ts` (Nummern wie in der Testvorbereitung):

| Fall | Regel | Soll (Anzeige) | Stand |
|---|---|---|---|
| 0 | Abgleich Handrechnung → Dataset → Seed → Service: Zähler, Betriebsdaten 1 210 / 200 / 110, Halbtage {1, 1}, Rohpegel 57.14939920 / 38.14477796, DTO 57.1 warn / 38.1 ok; Z2 −6 dB mit E2; Z3 Σ Gewichte 0 → `zero-weights`; 2025 ohne Quelle; **Negativfall** Z2 mit Σ Abend-Gewichte 0 → unvollständig, Mengen sichtbar, Teilwert 49.3233 nie als Ampel | – | 8 ✓ |
| 1 | Trennung 12:00 (U3 11–13 = ½ + ½) | 38.1; Gegenprobe 11–12 → 37.6 | ✓ |
| 2a | Kernel: 2 h = ½, 2 h 01 = 1, 2 h 15 = 1 | – | ✓ |
| 2b | Service, Raster: 08–10 → 29.0; 08–10:15 → 32.0 | | ✓ |
| 2c | Service, interner Rechentest 08–10:01 → 32.0 | | ✓ |
| 3 | Feiertag 25.12.2026: A9 57.1 (ohne Kalender 56.6); A7 Zivil am Feiertag 41.4 (ohne 40.0); halber Feiertag 24.12. 50/50 und ½ + ½ | | 3 ✓ |
| 4 | ×10: Nutzungen → A9 67.1 (Δ 10.000) / A7 41.1 (Δ 3.000); Simulation → 67.1 over, Δ 10.0, Nutzungen unverändert | | 2 ✓ |
| 5 | Grenzwertvergleich auf ganze dB aus dem Rohwert: 3 900 → 60.4 warn; 3 985 → 60.5 **warn**; 3 990 → 60.5 over; dasselbe in der Simulation (Ist und simuliert) | | 4 ✓ |
| 6 | Jahresmittel ohne vorzeitige Rundung: 1.25; 2.5/3 auf 1e-9, Anzeige «0.833» | | 2 ✓ |
| 7 | Mehrere Nutzungen im selben Halbtag: 180 min → 1 (32.5); 120 min → ½ (29.5); Kategorien a/b getrennt, b ohne Quelle → unvollständig | | 3 ✓ |

## Befunde aus dem ersten Lauf (rot → korrigiert → grün)

| Befund | Ursache | Korrektur |
|---|---|---|
| Fall 6: Mittel 0.833 statt 0.8333… | `operating-data.ts` rundete das Jahresmittel intern auf 3 Dezimalen | Rundung entfernt; volle Genauigkeit, Rundung nur in der Anzeige |
| Fall 5: N = 3 985 → `over` statt `warn` | Doppelrundung: `assessment.service.ts` gab den auf 0.1 dB gerundeten Wert an `noiseState` (60.4997 → 60.5 → 61); dieselbe Stelle in `simulation.service.ts` | Vergleich mit dem Rohwert, `roundDb` nur für die Anzeige; Simulation explizit getestet |
| Z2 (Fixture): 49.32 statt 51.15 | Fixture-Fehler, kein App-Fehler: Q1a hatte Gewicht 0 «ausserhalb», Q1b 0/0 → Σ = 0 → Kernel verweigert (O8); der Teilwert war korrekt als unvollständig gekennzeichnet | Referenz-Fixture Q1/Q1a = 1000/100; die alte Variante als eigener Negativtest erhalten |

## Offen

- Beurteilungswert in der Oberfläche nachvollziehbar machen (Anzeige 60.5 dB · Beurteilungswert 60 dB · Grenzwert
  eingehalten) – heute im DTO nur `level` (Anzeige) und `state`; `assessedLevel` wäre eine Vertragsänderung
  (Swagger-Regenerierung).
- Fachbestätigung E8 (B1.4: Formelblatt 14.5 / 28.0 vs. Kernel 14.3 / 28.1) bleibt Voraussetzung für Prio 1.1
  (`apps/app-e2e/src/actors/fachablaeufe/prio1-kernablaeufe.spec.ts`).
- Die Fachabläufe der E2E-Akteure (`apps/app-e2e/src/actors`) sind weiterhin `fixme`-Skelette.
