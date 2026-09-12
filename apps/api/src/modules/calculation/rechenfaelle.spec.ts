/**
 * Mathematische Randfälle durch die ganze Kette Nutzung → Betriebsdaten → Pegel → Ampel
 * (Vorbereitung, 12.09.2026, Review-Korrekturen eingearbeitet). Kleine Rechentests statt
 * Browser-Tests: der Kernel ist in `libs/shared/lsv` je Regel schon abgesichert (Tabelle), hier
 * fehlt der Nachweis, dass der Service dieselbe Regel mit echten Nutzungen, Feiertagskalender,
 * Quellenverteilung und Jahresmittel anwendet. Grundlage: Testplatz S
 * (`apps/app-e2e/src/actors/fixtures/platz-s.md`, Handrechnung; Dataset `platz-s.dataset.json`,
 * Seed über `datasetKey`, sobald der Schlüssel in `tenant.mock.json` liegt oder der Seed ein
 * Dataset-Objekt annimmt).
 *
 * | Regel                                              | Kernel-Test (grün)                                   | Service (hier) |
 * |----------------------------------------------------|------------------------------------------------------|----------------|
 * | Nutzung 11:00–13:00 → Trennung 12:00, ½ + ½        | operating-data.spec.ts «splits a usage spanning 12:00» | todo 1        |
 * | genau 2 h = ½, knapp darüber = 1                    | dito (10:00–12:00 = ½); 08:00–10:01 fehlt → todo 2a  | todo 2b/2c     |
 * | Werktag vs. lokaler Feiertag in A7 und A9            | «Saturday, Sunday and holidays entirely outside», «treats Saturday as workday, Sunday and holidays as Sunday» | todo 3 |
 * | ×10 Menge: A9 +10 dB, A7 +3 dB                      | annex9.spec.ts «raises Lr by exactly 10 dB», annex7.spec.ts «raises Lr by exactly 3 dB» | todo 4 |
 * | 60.4 / 60.5 bei Grenzwert 60 → eingehalten / überschritten | traffic-light.spec.ts «rounds to whole dB before the comparison» | todo 5 |
 * | Mittelung kleiner kg-Mengen ohne Rundung             | operating-data.spec.ts «keeps decimal quantities (kg)», distribution.spec.ts «three decimals» | todo 6 |
 * | mehrere Nutzungen im selben Halbtag → keine Mehrfachzählung | operating-data.spec.ts «adds several usages of the same category in the same half» | todo 7 |
 *
 * Grundsätze für die Umsetzung:
 * - **Frische Fixtures je Fall**: `beforeEach` → `testDbSeedBeforeEach(dataSource)` + `seedDemoDataset(…, { force: true })`;
 *   zusätzliche Nutzungen, entfernte Feiertage oder geänderte Gewichte eines Falls dürfen keinen anderen Fall beeinflussen.
 * - **Zwischenergebnisse prüfen**, nicht nur die Endampel: Halbtage (`annex7HalfDays`), Mengen je Kombination
 *   (`operatingData` inside/outside), Quellenanteile (Verteilung 7.5), Rohpegel (`level`, ungerundet, Toleranz 1e-3),
 *   Beurteilungswert (`assessedLevel`, ganze dB), Status (`state`). Fehlt ein Zwischenwert im DTO, ist das ein Befund.
 * - **Rundung**: Der Grenzwertvergleich rundet den *ungerundeten* Pegel direkt auf ganze dB (B1.2 10.4) – nie zuerst
 *   auf die Anzeige-Dezimale. Anzeige = eine Dezimale (`roundDb`). Soll-Werte hier: ungerundeter Referenzwert → Anzeige.
 * - Soll-Werte aus platz-s.md (Handrechnung, Python-Gegenrechnung), nie aus dem Ist der Anwendung. `it.todo` zählt nicht.
 */
describe('Rechenfälle durch die Kette (Testplatz S, Vorbereitung)', () => {
  // Setup wie assessment.service.spec.ts: testDbSetup([AreaModule, UsageModule, CalculationModule]);
  // beforeEach: testDbSeedBeforeEach(dataSource); seedDemoDataset(dataSource, mockTenantId,
  //   { now: new Date(2026, 11, 31), datasetKey: 'SLIM Testplatz S', force: true });
  // areaId von «Testplatz S», Z1 = aktueller Zustand. PERIOD_2026 = { from: '2026-01-01', to: '2026-12-31' }.
  // Zusätzliche Nutzungen eines Falls per UsageService anlegen (nicht per Roh-SQL), damit derselbe Pfad wie die Maske gilt.

  it.todo(
    '1 · U3 11:00–13:00 (Zivil, 10 Schuss) zählt ½ Vormittag + ½ Nachmittag: A7 E1 Z1 2026 = 38.1448 → 38.1',
    // Zwischenwerte: Halbtage a = { work: 1, sunday: 1 } (U3 ½ + ½, U2 So 3 h = 1); Schüsse A7 = 110; Li(a) = 70.0 (eine Quelle).
    // Rohpegel: 70 + 10·log10(1 + 3) + 3·log10(110) − 44 = 38.14478 (Toleranz 1e-3); Anzeige 38.1; Beurteilungswert 38 < IGW 60 → ok.
    // Gegenprobe im selben Fall (frische Fixture, U3 auf 11:00–12:00 gesetzt): work 0.5 → 37.56486 → 37.6.
  );

  it.todo(
    '2a · Kernel: 08:00–10:00 = ½ Halbtag, 08:00–10:01 = 1 Halbtag (interner Rechentest, Minute ausserhalb des Rasters)',
    // annex7HalfDays([{ date: MON, from: '08:00', to: '10:00', category: 'a' }]).a → { work: 0.5, sunday: 0 }
    // annex7HalfDays([{ … to: '10:01' … }]).a → { work: 1, sunday: 0 }   (LSV Anh. 7 Ziff. 322: «mehr als zwei Stunden»)
    // Ablage: libs/shared/lsv/src/lib/operating-data.spec.ts, describe annex7HalfDays.
  );

  it.todo(
    '2b · Service, regulärer Erfassungspfad (Viertelstundenraster): Zivil 08:00–10:00 → A7 28.9897 → 29.0; 08:00–10:15 → 32.0',
    // Fixture: Testplatz S + je eine Zivil-Nutzung Mo 2026-03-16, 100 Schuss stgw90, Zeitraum 2026 OHNE U2/U3 (frische Fixture,
    // U2/U3 entfernt), damit nur diese Nutzung die Halbtage bestimmt.
    // 08:00–10:00 (120 min): work 0.5 → 70 + 10·log10(0.5) + 3·log10(100) − 44 = 28.98970 → Anzeige 29.0.
    // 08:00–10:15 (135 min): work 1   → 70 + 0 + 6 − 44 = 32.00000 → Anzeige 32.0.
    // Zwischenwerte: Halbtage, M = 100, Li = 70, Rohpegel (1e-3), Beurteilungswert 29 bzw. 32, Status ok.
  );

  it.todo(
    '2c · Service mit 08:00–10:01 → 32.0 – ausdrücklich interner Rechentest (Raster wird von Maske/ELO erzwungen, nicht vom Kernel)',
    // Nutzung per Repository mit timeTo '10:01' anlegen (die DTO-Validierung würde sie abweisen – genau das ist der Punkt:
    // der Test belegt die Kernelregel im Service, nicht den Erfassungspfad). Erwartung wie 2b/10:15: work 1 → 32.0.
  );

  it.todo(
    '3 · Feiertag 25.12.2026 (Fr, Eintrag «Weihnachten» im Dataset): A9 «ausserhalb» → E1 Z1 2026 = 57.1494 → 57.1; A7 Sonn-Halbtag',
    // Vorbedingung: HolidayEntity 2026-12-25 (ganz) und 2026-12-24 ab 12:00 (halb) für den Mandanten/Platz vorhanden – prüfen, bevor
    // gerechnet wird (Zwischenwert). Zeitraum 2026; alle Nutzungen dieses Falls liegen im Zeitraum.
    // A9 (Basis-Fixture U1–U4): Mengen stgw90 inside 1 210 / outside 200 (U4 ganz ausserhalb);
    //   LAE1 = 110.82785, LAE2 = 108.01030, ESM = 112.65397, Lr = 112.65397 − 70.50457 + 15 = 57.14940 (1e-3) → Anzeige 57.1;
    //   Beurteilungswert 57, IGW 60, Warnzone > 55 → Status warn.
    // Gegenprobe (frische Fixture, Feiertagszeilen entfernt): inside 1 310 / outside 100 → LAE1 111.17271, LAE2 105.0,
    //   Lr = 56.60724 → 56.6 (der Unterschied ist der Nachweis, dass der Kalender im Service ankommt).
    // A7 (frische Fixture + Zivil-Nutzung 2026-12-25 09:00–12:00, 100 Schuss, im Zeitraum 2026): Halbtage a = { work: 1, sunday: 2 }
    //   (U2 So + 25.12. als Sonn-/Feiertag, U3 ½ + ½); M = 210; Lr7 = 70 + 10·log10(1 + 6) + 3·log10(210) − 44 = 41.41764 → 41.4.
    //   Ohne Feiertagsbehandlung wäre der 25.12. ein Werk-Halbtag: { work: 2, sunday: 1 } → 70 + 6.98970 + 6.96666 − 44 = 39.95636 → 40.0.
    // Halber Feiertag (frische Fixture + Militär-Nutzung 2026-12-24 10:00–14:00, 400 Schuss): A9 inside 200 / outside 200 (50 %);
    //   dieselbe Nutzung als Zivil → A7 zusätzlich { work: 0.5, sunday: 0.5 }.
  );

  it.todo(
    '4 · ×10 auf alle Nutzungen 2026: A9 E1 Z1 57.1494 → 67.1494 (+10.000), A7 38.1448 → 41.1448 (+3.000, Halbtage unverändert)',
    // Zwei Wege, gleiches Ergebnis: (a) SimulationService, alle Zeilen ×10; (b) frische Fixture, Mengen von U1–U4 ×10 über UsageService.
    // Zwischenwerte: Mengen 12 100 / 2 000, Halbtage unverändert { work: 1, sunday: 1 }, Rohpegel-Differenz 10.000 ± 1e-6 (A9)
    // bzw. 3.000 ± 1e-6 (A7); Beurteilungswert 67 > IGW 60 → over; A7 41 → ok.
  );

  it.todo(
    '5 · Grenzwertvergleich rundet den ungerundeten Pegel direkt auf ganze dB: 60.406 → 60 warn, 60.4997 → 60 warn, 60.505 → 61 over',
    // Fixture je Variante frisch: Testplatz S, Z1 (WLR 80), Zeitraum 2026 mit genau einer Militär-Nutzung Mo 08:00–11:00 innerhalb
    // Werktag und N Schuss stgw90 (U1–U4 entfernt). Lr = 80 − 70.50457 + 15 + 10·log10(N) = 24.49543 + 10·log10(N).
    //   N = 3 900 → Rohwert 60.40608 · Anzeige 60.4 · Beurteilungswert 60 · IGW 60 → eingehalten, in der 5-dB-Warnzone → warn
    //   N = 3 985 → Rohwert 60.49971 · Anzeige 60.5 · Beurteilungswert 60 · IGW 60 → eingehalten → warn
    //   N = 3 990 → Rohwert 60.50516 · Anzeige 60.5 · Beurteilungswert 61 · IGW 60 → überschritten → over
    // Regel (kein offener Entscheid): Math.round(Rohwert) gegen den Grenzwert – nie zuerst auf die Anzeige-Dezimale runden.
    // N = 3 985 ist kein Rechenwiderspruch, aber irritierend (Anzeige 60.5, Beurteilung 60): das DTO muss den Beurteilungswert
    // (`assessedLevel`, ganze dB) neben `level` liefern und die Oberfläche ihn ausweisen – Assertion auf beide Felder.
  );

  it.todo(
    '6 · Jahresmittel: Rohwert mit Toleranz, Anzeige separat – 2025–2026: 1.25 kg, {2025, 2026, 2028}: 0.8333… kg (Anzeige «0.833 kg»)',
    // Fixture: Basis + 2028 Mo 2028-03-06 08:00–10:00 Militär stgw90 300 (frisch). Jahre über `years: [2025, 2026, 2028]`.
    // Rohwerte (operatingData je Kombination, 3 Jahre): sprengladung 2.5/3 = 0.83333… (toBeCloseTo(0.8333, 3)), pist75 16.6667,
    //   stgw90 inside 503.3333, outside 66.6667. Anzeige (Formatierung getrennt prüfen): «0.833 kg», «16.667», «503.333».
    // Hinweis Rechengenauigkeit: der Service rundet das Mittel intern auf 3 Dezimalen (operating-data.ts, `avg`) – Wirkung auf den
    //   Pegel 10·log10(0.833/0.83333) = −0.0017 dB, deshalb Toleranz 1e-3 statt Gleichheit; keine Rundung auf ganze Einheiten (nicht 1, nicht 0).
    // Zwei Jahre {2025, 2026}: 1.25 kg exakt (toBeCloseTo(1.25, 6)), pist75 25, stgw90 605 / 100.
    // Status: incomplete (keine Quelle für pist75/sprengladung in Z1) – die Mengen stehen trotzdem im DTO (O8: nichts verschwindet).
  );

  it.todo(
    '7 · zwei Zivil-Nutzungen im selben Vormittag (Mo 2026-03-16 08:00–09:00 und 09:30–11:30) = 1 Werk-Halbtag; A7 32.5283 → 32.5',
    // Fixture frisch ohne U2/U3; Mengen 100 + 50 = 150 Schuss stgw90.
    // Zwischenwerte: Halbtage a = { work: 1, sunday: 0 } (60 + 120 = 180 min > 120 → 1). Weil ½ + ½ zufällig auch 1 ergäbe,
    //   Variante 08:00–08:30 + 09:30–11:00 (30 + 90 = 120 min, nicht > 2 h → ½) mitprüfen: { work: 0.5 } → 70 − 3.01030 + 6.52827 − 44 = 29.51797 → 29.5.
    //   M = 150; Li = 70; Lr7 = 70 + 0 + 3·log10(150) − 44 = 32.52827 → 32.5; Beurteilungswert 33 → ok.
    // Zusatz: dieselben zwei Nutzungen in Kategorien a (08:00–09:00) und b (09:30–11:30, pist75): je Kategorie eigener Halbtag
    //   (a: 0.5, b: 0.5 – 120 min sind nicht > 2 h); b hat in Z1 keine Quelle → Zeile A7 incomplete (O8), a bleibt berechnet.
  );
});
