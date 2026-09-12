# Testplatz S – synthetischer Schiessplatz mit Handrechnung

Stand: 12.09.2026. Zweck: ein Platz, den man im Kopf nachrechnen kann – ein Stellungsraum,
eine Quelle je Zustand, ein Empfangspunkt, sechs Nutzungen. Jeder Soll-Wert unten ist aus den
Formeln B1 Kapitel 7 (Beilage B1.4, Blätter A9X/A7X) von Hand hergeleitet und mit einem
unabhängigen Python-Nachrechnen bestätigt – **nie** aus der Anwendung übernommen.

Dataset (Format `apps/api/src/mocks/tenant/tenant-dataset.ts`, Stand 12.09.2026) liegt im gemeinsamen Testbereich
`libs/api/tests/src/lib/fixtures/testplatz-s.dataset.ts` (`TESTPLATZ_S_DATASET`, dazu `TESTPLATZ_S_REFERENCE` mit den
vollständigen Werten der unabhängigen Gegenrechnung). Seeden: `seedDemoDataset(ds, tenantId, { dataset: TESTPLATZ_S_DATASET,
now: new Date(2026, 11, 31) })` – ausführbarer Abgleich in `apps/api/src/modules/calculation/rechenfaelle.spec.ts`.
Die Daten sind auf **2026** ausgelegt (Wochentage!) – bei anderem Jahr die Nutzungsdaten neu setzen (Mo/So/Feiertag müssen stimmen).

## 1. Stammdaten

| Objekt | Wert |
|---|---|
| Schiessplatz | «Testplatz S», Ko-Nr. `9999.001`, keine Sachplan-Nr., Gesamtbeurteilung Anhang 7 = nein |
| Stellungsraum SR1 | Ko-Nr. `9999.001.01`, «Stellungsraum S1» |
| Zulässige Kombinationen SR1 | `stgw90` (Stgw 90 – 5.6 mm, Kategorie a) · `pist75` (Pist 75 – 9 mm, Kategorie b) · `sprengladung` (kg) |
| Kontingent | `stgw90` 2 000 Schuss/Jahr (→ Ist 2026 = 1 410 → 70.5 % → Kontingent-Ampel **grün**) |
| Empfangspunkt E1 | Fassade, **ES II** → Anhang 9 PW 55 / IGW 60; Anhang 7 PW 55 / IGW 60 |
| Empfangspunkt E2 | nur in Z2/Z3 (verschobener/neuer Punkt), ES III → A9 PW 60 / IGW 65 |
| Feiertag | 25.12.2026 (Freitag) ganz; 24.12.2026 ab 12:00 halb (Standard-Kalender des Datasets) |

## 2. Berechnungen und Zustände

| Berechnung | Zustand | Baujahr | Quellen (Anlageteil P1 = SR1) | WLR E1 (day = eve) | WLR E2 |
|---|---|---|---|---|---|
| B1 «Ist-Aufnahme 2020» | **Z1** «Z1 Ist 2020», aktuell + MGDM | vor 1985 → IGW | Q1 Stgw90 (a9 1000/100, a7 10/1/1000) | LAE 80.0, LAFmax 70.0 | – |
| B2 «Sanierung 2024» | **Z2** «Z2 Sanierung 2024» | vor 1985 → IGW | Q1a Stgw90 (a9 1000/100), Q1b Stgw90 (a9 **0/0** – Teil-Null) | Q1a: LAE 74.0, LAFmax 64.0 · Q1b: LAE 74.0 | Q1a: LAE 80.0 |
| B2 | **Z3** «Z3 Sanierung ohne Gewichte» | vor 1985 | Q1a, Q1b beide a9 **0/0** (Σ = 0) | wie Z2 | wie Z2 |

Keine Quelle für `pist75` und `sprengladung` in irgendeinem Zustand (→ O8-Fälle). Die tragende Quelle hat in beiden
Zeitgruppen ein Gewicht > 0: bei zwei Quellen mit Σ Gewicht = 0 in einer Zeitgruppe verweigert der Kernel die Verteilung
(O8) – Befund aus dem ersten Lauf (Q1a 1000/0 hätte die 200 Schüsse «ausserhalb» in Z2 nicht beurteilbar gemacht).

## 3. Nutzungen (Jahr 2026 = Betrachtungszeitraum der Grundfälle)

| # | Datum | Tag | Zeit | Kategorie | Kombination | Menge | Zweck |
|---|---|---|---|---|---|---|---|
| U1 | 2026-03-02 | Mo | 08:00–11:00 | Militär | stgw90 | 1 200 | Grundlast innerhalb Werktag |
| U2 | 2026-03-08 | So | 09:00–12:00 | Zivil (Feldschiessen) | stgw90 | 100 | Sonntag: A9 ausserhalb, A7 1 Sonn-Halbtag (3 h) |
| U3 | 2026-03-09 | Mo | 11:00–13:00 | Zivil (Anderes) | stgw90 | 10 | Trennung 12:00: ½ + ½ Werk-Halbtag |
| U4 | 2026-12-25 | Fr, Feiertag | 08:00–11:00 | Militär | stgw90 | 100 | Feiertag: A9 ausserhalb, nicht innerhalb |
| U5 | 2025-03-03 | Mo (Vorjahr) | 08:00–10:00 | Militär | pist75 | 50 | keine Quelle → O8 (nur im Zeitraum 2025) |
| U6 | 2025-03-03 | Mo (Vorjahr) | 14:00–16:00 | Militär | sprengladung | 2.5 kg | Dezimalmenge, keine Quelle (Zeitraum 2025) |

Summen 2026, `stgw90`: innerhalb Werktag 1 200 + 10 = **1 210**, ausserhalb 100 + 100 = **200**, total 1 410.

## 4. Handrechnung Anhang 9 (B1 7.6.2), Zeitraum 2026, E1

Konstante: 10·log10(52·5·12·3600) = 10·log10(11 232 000) = **70.5046**; Lr = ESM(LAE1, LAE2) − 70.5046 + 15.

**Z1** (WLR 80.0):
- LAE1 = 10·log10(1 210 · 10^8.0) = 80 + 10·log10(1210) = 80 + 30.8279 = **110.828**
- LAE2 = 80 + 10·log10(200) + 5 = 80 + 23.0103 + 5 = **108.010**
- ESM = 10·log10(10^11.0828 + 10^10.8010) = 10·log10(1.2100e11 + 6.3246e10) = 10·log10(1.8425e11) = **112.654**
- Lr = 112.65397 − 70.50457 + 15 = **57.1494** (ungerundet) → Anzeige **57.1 dB**
- Beurteilungswert = round(57.1494) = **57** (ganze dB aus dem ungerundeten Wert, nie aus der Anzeige); IGW ES II = 60 → 57 ≤ 60, aber > 55 → Ampel **orange**

**Z2** (WLR 74.0, alle Schüsse auf Q1a, Q1b hat Gewicht 0): alles −6 dB → Lr = **51.1494** → Anzeige **51.1 dB**, Beurteilungswert 51 → **grün** (51 ≤ 55).
E2 in Z2 (WLR 80.0, ES III IGW 65): Lr = **57.1** → grün (57 ≤ 60).

**Z3**: Σ Gewichte Q1a + Q1b = 0 → `distributeShots` verweigert → E1 und E2 **nicht beurteilbar** (`incomplete`), keine Farbe, kein Pegel für stgw90.

**Ohne Feiertagsbehandlung** (Fehlerbild, darf nicht auftreten): U4 innerhalb → 1 310 / 100 → LAE1 111.173, LAE2 105.000, Lr **56.6**. Die 0.5 dB Differenz ist der Nachweis, dass der Feiertag wirkt.

**×10** (Simulation: alle Schüsse verzehnfacht): Lr Z1 = **67.1** (= 57.1 + 10) → rot.

## 5. Handrechnung Anhang 7 (B1 7.6.1), Zeitraum 2026, E1, Kategorie a

Nur zivile Nutzungen (U2, U3), Gesamtbeurteilung Anhang 7 = nein → Militär bleibt aussen vor.

- Halbtage: U2 So 09–12 = 3 h > 2 h → **1 Sonn-Halbtag**; U3 Mo 11–13 → 11–12 = 1 h → ½, 12–13 = 1 h → ½ → **1 Werk-Halbtag**
- Schüsse M = 100 + 10 = **110**; Li(a) = LAFmax_day = **70.0** (eine Quelle)
- Lri(a) = 70 + 10·log10(Wh + 3·Sh) + 3·log10(M) − 44 = 70 + 10·log10(1 + 3) + 3·2.0414 − 44 = 70 + 6.0206 + 6.1242 − 44 = **38.1448** → Anzeige **38.1 dB**
- Lr = Lri(a) (einzige Kategorie) = **38.1** → grün (IGW 60)

**Fehlerbild Halbtagsgrenze 13:00** (alter Stand): U3 ganz im Vormittag, 2 h → ½ → Wh = 0.5 → Lri = 70 + 5.4407 + 6.1242 − 44 = **37.5649 → 37.6**. Die 0.5 dB sind der Nachweis der 12:00-Regel.

**Z2** (LAFmax 64.0): Lr = **32.1**. **×10** Schüsse (Halbtage gleich): +3·log10(10) = **+3 dB → 41.1**.

## 6. Soll-Tabelle (für Protokolle)

| Fall | Zustand | Zeitraum | E1 A9 Lr | E1 A9 Ampel | E1 A7 Lr | E2 A9 Lr |
|---|---|---|---|---|---|---|
| Grundfall | Z1 | 2026 | **57.1** | orange | **38.1** | – (nicht im Zustand) |
| Zustandswechsel | Z2 | 2026 | **51.1** | grün | **32.1** | **57.1** |
| Σ Gewichte 0 | Z3 | 2026 | nicht beurteilbar | keine Farbe | nicht beurteilbar | nicht beurteilbar |
| ohne Quelle (O8) | Z1 | 2025 | nicht beurteilbar (pist75, sprengladung fehlen) | keine Farbe | – | – |
| Simulation ×10 | Z1 | 2026 | **67.1** | rot | – | – |
| ohne Feiertag (Fehler) | Z1 | 2026 | 56.6 | – | – | – |
| Grenze 13:00 (Fehler) | Z1 | 2026 | – | – | 37.6 | – |
| Variante + Zivil 25.12.2026 09–12, 100 Schuss | Z1 | 2026 | 57.1 | orange | **41.4** (41.4176; Sh = 2) – ohne Feiertag 40.0 | – |
| Mittel 2025+2026 | Z1 | 2025–2026 | stgw90: 605 / 100 je Jahr; pist75 25 und sprengladung **1.25 kg** je Jahr (dezimal, nicht gerundet) → O8 wegen fehlender Quellen | – | – | – |

Prüfregel Rundung (Projekthandbuch B1.2 10.4): der Grenzwertvergleich rundet den **ungerundeten** Pegel direkt auf ganze dB
(57.1494 → 57); die Anzeige rundet separat auf eine Dezimale (57.1). Nie zuerst auf die Anzeige runden – sonst kippt ein
Rohwert 60.4997 (Anzeige 60.5) fälschlich auf 61. Soll-Werte in dieser Datei: ungerundeter Referenzwert → Anzeige.
