# Lärmberechnung – `@slim/lsv`

Die Berechnung der Beurteilungspegel nach LSV (Beilage B1, Kapitel 7; Formeln und
Kontrollwerte aus Beilage B1.4 «Berechnung Beurteilungspegel sonARMS Demo») liegt als
**abhängigkeitsfreie Bibliothek** in `libs/shared/lsv` (Import `@slim/lsv`). Sie wird von
der API (Beurteilung pro Empfangspunkt, Simulation) und bei Bedarf direkt von der App
verwendet. Die Specs (`libs/shared/lsv/src/lib/*.spec.ts`) laufen mit `npx nx test api`.

## Was die Bibliothek kann

| Datei               | Inhalt                                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| `levels.ts`         | `gemw` (gewichtetes energetisches Mittel), `esm` (energetische Summe), `roundDb` (kaufmännisch runden)   |
| `annex9.ts`         | `annex9Level` – Beurteilungspegel militärisches Schiessen (Anhang 9)                                     |
| `annex7.ts`         | `annex7Level` – Beurteilungspegel ziviles Schiessen (Anhang 7, Waffenkategorien a–f)                     |
| `distribution.ts`   | Schritt 2 (7.5, `slm 32`): `distributeShots(menge, quellen[{sourceId, weight}])` verteilt die Menge einer Kombination im Verhältnis der Gewichte auf die Quellen (Schusslinien); **Σ Gewichte = 0 → Gleichverteilung mit `warning: 'zero-weights'`** (Fachregel O8; Option `onZeroWeights: 'refuse'` verweigert stattdessen, Entscheid KOMZ Lärm im Refinement), teilweise Nullen behalten das definierte Verhältnis, **keine Quelle → `warning: 'no-source'`** (Menge «nicht zuordenbar», nie stillschweigend weg), Dezimalmengen auf 3 Dezimalen summentreu. Warnungen gehören in Prüfbericht, Lauf-Protokoll und an die Empfangspunkte. Angebunden, sobald Quellen mit Gewichten je Zustand importiert werden (heute: eine Quelle je Kombination) |
| `operating-data.ts` | Schritt 1 (7.4): `splitAnnex9` (Schuss innerhalb/ausserhalb Werktag), `annex7HalfDays` (Schiesshalbtage); `CalendarOptions.holidays` = lokale Feiertage des Standorts, ganz (`'YYYY-MM-DD'`) oder halb (`{ date, from: '12:00' }` – B1 S. 71) |
| `types.ts`          | `USAGE_CATEGORIES` (Militär, Zivil, Blaulicht, SAT – B1 Tabelle 2) und `countsForAnnex7(category, annex7Overall)`: Anhang 9 rechnet alle Kategorien, Anhang 7 Zivil + SAT bzw. alle bei «Gesamtbeurteilung nach Anhang 7» |
| `limits.ts`         | Grenzwerte PW/IGW/AW je Empfindlichkeitsstufe und Anhang, `applicableLimits` nach Baujahr (7.7)          |
| `traffic-light.ts`  | Ampeln (5.10): `noiseState` (Vergleich mit dem auf **ganze dB** gerundeten Pegel, Projekthandbuch B1.2 Kap. 10.4: 60.4 → 60 eingehalten, 60.5 → 61 überschritten; Modus `whole`/`tenth`/`none` als Parameter), `assessedLevel`, `worstState` (Aggregation), `quotaState` (Kontingent 100 % / 125 %) |

`LSV_EMPTY_LEVEL = −99` ist – wie in sonARMS und B1.4 – der Marker für «keine Energie»
(keine Schüsse). Alle Pegel werden ungerundet zurückgegeben; für die Anzeige `roundDb`.

## Formeln

```
GEMW(g_i, L_i) = 10·log10( Σ g_i·10^(0.1·L_i) / Σ g_i )        −99 wenn Σ g_i = 0
ESM(L_i)       = 10·log10( Σ 10^(0.1·L_i) )                    Einträge ≤ −99 zählen nicht

Anhang 9 (pro Empfangspunkt, Gewichte = Schuss innerhalb / ausserhalb Werktag)
  LAE1 = GEMW(schuss_tag,   LAE_day) + 10·log10(Σ schuss_tag)
  LAE2 = GEMW(schuss_abend, LAE_eve) + 10·log10(Σ schuss_abend) + 5
  Lr   = ESM(LAE1, LAE2) − 10·log10(52·5·12·3600) + 15

Anhang 7 (pro Empfangspunkt und Waffenkategorie k, Wh/Sh = Werk-/Sonn-Halbtage)
  Li_k  = GEMW(schuss_k, LAFmax_day)
  Lri_k = Li_k + 10·log10(Wh_k + 3·Sh_k) + 3·log10(Σ schuss_k) − 44
  Lr    = ESM(Lri_a … Lri_f)
```

Betriebsdaten (7.4): Anhang 9 – Werktag Mo–Fr 07:00–19:00, Schüsse anteilig nach Zeit,
Sa/So/Feiertag ganz «ausserhalb». Anhang 7 – Werktag Mo–Sa, pro Kalendertag und Kategorie
Vormittag/Nachmittag je 1 Halbtag (> 2 h) bzw. ½ (≤ 2 h), getrennt Werktag / Sonn-Feiertag.

Grenzwertvergleich (7.7): Baujahr vor 1985 → IGW, nach 1985 → PW, gemischt → beide.
Ampel: Rot `Lr > Grenzwert`, Orange `Lr > Grenzwert − 5 dB`, sonst Grün; Vergleich auf den
angezeigten (auf 0.1 dB gerundeten) Wert.

## Kontrollwerte B1.4 (Unit-Test-Erwartungen)

Demo-Projekt: 4 Quellen (`SH300-Links/Rechts_Stgw90/Stgw57`), Betriebsdaten A9 Tag/Abend
100/2, 20/1, 500/5, 888/12; A7 Kategorie a 5000/500/4000/1000 Schuss, 27 Werk- und
1 Sonn-Halbtag. WLR-Pegel aus `sonARMS_Demo_Day`/`_Eve` (Fixture `b14-demo.fixture.ts`).

| Empfangspunkt | LAE1   | LAE2   | Lr Anh. 9 | Li(a) | Lr Anh. 7 |
| ------------- | ------ | ------ | --------- | ----- | --------- |
| E1            | 116.06 | 102.24 | **60.7**  | 90.92 | **73.8**  |
| E2            | 107.08 | 93.53  | **51.8**  | 83.45 | **66.3**  |
| E3            | 101.93 | 88.24  | **46.6**  | 77.64 | **60.5**  |
| E4a           | 97.13  | 83.45  | **41.8**  | 70.23 | **53.1**  |
| E4b           | 96.60  | 82.92  | 41.3      | 69.59 | 52.4      |
| E4c           | 96.71  | 83.03  | 41.4      | 69.85 | 52.7      |
| E5a           | 115.93 | 102.06 | 60.6      | 89.11 | 71.9      |
| E5b           | 117.13 | 103.23 | 61.8      | 90.42 | 73.3      |
| E6            | 108.42 | 94.56  | 53.1      | 81.60 | 64.4      |
| E7            | 86.26  | 72.95  | 31.0      | 61.26 | 44.1      |
| E8            | 69.84  | 56.55  | 14.5 ¹    | 45.21 | 28.0 ²    |
| E9            | 108.20 | 95.39  | 52.9      | 85.17 | 68.0      |

¹ Der sonARMS-Kernel (Blatt A9p) schreibt für E8 LAE2 = 0 und Lr 14.3, weil er Quellen
unter seiner Relevanzschwelle weglässt; das Formelblatt A9X der Ausschreibung ergibt 14.5 –
das reproduziert die Bibliothek.
² Das Formelblatt A7X summiert die 0-dB-Zellen leerer Kategorien und zeigt 28.1; der Kernel
(A7p) und die Bibliothek lassen leere Kategorien weg → 28.0.

Alle zwölf Empfangspunkte beider Anhänge sind als Tests hinterlegt (`annex9.spec.ts`,
`annex7.spec.ts`), dazu Rand- und Fehlerfälle (keine Schüsse, nur Tag/Abend, Skalierung
×10 = +10 dB, Reihenfolge, negative Werte).

## Verwendung

- **API** `modules/area`: Beurteilung pro Empfangspunkt (Details 5.12) und Simulation (5.13)
  aus Nutzungen (`splitAnnex9`) × WLR-Pegel der Berechnungsgrundlage → `annex9Level` /
  `annex7Level` → `noiseState` gegen `limits(annex, ES)`.
- **App**: Anzeige der Ampeln und Reserven; die Berechnung selbst läuft in der API.
- **Erweiterte Konfiguration (5.28)**: `ANNEX9_LIMITS` / `ANNEX7_LIMITS`, `NOISE_WARN_BAND_DB`
  und `QUOTA_WARN_FACTOR` sind exportierte Defaults, die später aus der Admin-Konfiguration
  überschrieben werden.
