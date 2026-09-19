# Vertiefte Prüfung: Fachimplementierung und Tests

**Stand 13.09.2026**, Anwendungscode auf Commit `1c94687d6942c0aef890d515a9bf72edbbe39a35`. Ergänzung und fachliche Präzisierung der [Codebase-Analyse](codebase-analyse-2026-09-13.md).

**Ergebnis:** Die bestehende Testsuite ist eine brauchbare Grundlage, deckt aber wichtige Kombinationen der Fachregeln nicht ab. Sieben zusätzlich ausgeführte Prüftests reproduzieren sechs offene Befunde. Besonders kritisch: Die Simulation kann trotz neu hinzugefügter, nicht berechenbarer Mengen weiterhin eine grüne Ampel liefern. Aus «246 Tests bestanden» lässt sich deshalb keine vollständige fachliche Korrektheit ableiten.

## Korrekturstand nach dem Review

**Die sechs reproduzierten Befunde F01–F06 sind im Arbeitsstand korrigiert.** Die nachfolgenden Reviewabschnitte dokumentieren den ursprünglichen Befund und den damaligen roten Testlauf. Sie sind keine Beschreibung des korrigierten Ist-Zustands.

- F01: Nutzungsdauer zählt je Nutzung und A7-Kategorie einmal; Mengen aller Positionen bleiben erhalten.
- F02: Quellenanteile werden ohne Tausendstel-Quantisierung berechnet, auch für kleine Jahresmittel.
- F03: Auch eine einzelne Quelle durchläuft die zentrale O8-Nullgewichtsregel.
- F04: Fehlende relevante Day-/Eve-Pegel werden gemeldet; keine stille Ersetzung. Berechenbare Teilenergie bleibt sichtbar, unbenötigte Zeitgruppen sind nicht erforderlich.
- F05: Simulationspegel und Vollständigkeit werden aus denselben simulierten A9-Mengen ermittelt; Ist-Status bleibt separat erhalten.
- F06: Die Simulation startet mit allen Ist-Mengen, einschliesslich historischer Mengen inaktiver Zuordnungen, und überschreibt nur die explizit eingereichten aktiven Zeilen.

Die Regressionen liegen nun in der [regulären API-Suite](../../apps/api/src/modules/calculation/fachreview.spec.ts). Der bisherige separate Aufruf funktioniert als Verweis auf dieselben Tests weiter. Ergänzt wurden Prüfungen für getrennte Kategorien, neue Räume, Mengenverhältnisse/Quellenreihenfolge, nur tatsächlich benötigte WLR-Zeitgruppen und eine [Datenbankregression für deaktivierte Zuordnungen](../../apps/api/src/modules/calculation/simulation.service.spec.ts).

Zwei bestehende Testaufbauten wurden fachlich eingegrenzt: Der Grenzwerttest erhöht nur die berechenbare Zielkombination; der reine Tag-/Abendvergleich verwendet eine Kombination mit positiven Gewichten in beiden Zeitgruppen. Die Verteilungstests prüfen jetzt ungerundete Verhältnisse statt einer künstlichen Tausendstel-Rundung. Die sieben ursprünglichen fachlichen Sollwerte wurden nicht abgeschwächt.

Die Kernversion gespeicherter neuer Berechnungsläufe wurde auf `@slim/lsv 1.2.0` erhöht. Bestehende gespeicherte Läufe werden nicht nachträglich verändert. Frühere Ergebnisse können bei den betroffenen Eingaben von neuen Berechnungen abweichen. Bereits gespeicherte Übersichts-Caches benötigen eine Neuberechnung; deren produktive Aktualisierung ist der separate Befund B03 der Gesamtanalyse.

Die weiteren statischen Auffälligkeiten und offenen Fachentscheide aus Abschnitt 4 sind nicht Teil dieser sechs Korrekturen und bleiben separat zu bearbeiten.

**Validierung des Korrekturstands:** 258 API-/Shared-Tests in 25 Dateien bestanden; 73 Angular-Tests in 11 Suiten bestanden; API-TypeScript-Prüfung und ESLint der geänderten TypeScript-Dateien erfolgreich. Davon sind 12 neue reguläre Regressionstests. Kein neuer Playwright- oder Produktionsdatenlauf.


## 1. Vorgehen und Nachweise

Geprüft wurden A7/A9-Kern, Betriebsdatenaufbereitung, Quellenverteilung, WLR-Zuordnung, Assessment, Simulation, gespeicherte Berechnungsläufe und die entsprechenden Tests. B1 Kapitel 7.4–7.6 wurde nochmals direkt aus dem Original-PDF gelesen. Die Bewertung folgt den gelieferten Anforderungen und dokumentierten Fachentscheidungen; sie ist keine neue rechtliche Auslegung der LSV.

Neue, **separat aufrufbare Prüftests**:

- [fachreview.spec.ts](nachweise/fachreview.spec.ts)
- [fachreview.vitest.config.mts](nachweise/fachreview.vitest.config.mts)

Ausführung im Projektverzeichnis:

```powershell
npx --no-install vitest run --config docs/anforderungskatalog/nachweise/fachreview.vitest.config.mts
```

Ergebnis: **7 Tests ausgeführt, 7 fehlgeschlagen**, Laufzeit 3,92 s. Alle scheitern an fachlichen Soll/Ist-Abweichungen, nicht an Import- oder Setupfehlern. Diese Tests formulieren das beabsichtigte Verhalten und bleiben bis zur jeweiligen Korrektur rot. Sie liegen ausserhalb der regulären Testsuite und werden nur mit der eigenen Konfiguration ausgeführt. Der Anwendungscode wurde nicht verändert.

Die neuen Tests verwenden echte Rechenfunktionen und den echten `SimulationService`, aber minimale In-Memory-Daten und ersetzte Repository-Zugriffe. Sie belegen die jeweiligen Rechen-/Servicefehler; HTTP, Datenbankintegration, Dateiimport und Browser werden damit nicht geprüft. Die bisherigen **246 API-/Shared-Tests und 73 Angular-Tests** wurden im vorausgehenden Review desselben Anwendungscodes erfolgreich ausgeführt, nicht nochmals für diese Ergänzung.

## 2. Reproduzierte Befunde

| Befund | Soll | Tatsächliches Ergebnis | Einordnung |
|---|---|---|---|
| F01: Zwei Positionen derselben A7-Kategorie in einer Nutzung, 08:00–09:30 | 90 Minuten einmal zählen → 0,5 Werk-Halbtag | 180 Minuten → 1 Werk-Halbtag | Hoch; slm 31/33 |
| F02: Jahresmittel `0.001 / 3`, zwei Quellen mit gleichen Gewichten | Summe der Quellenanteile bleibt `0.000333333333…` | Beide Anteile null; Summe 0 | Hoch; slm 32/33 |
| F03: Eine Quelle mit Gewicht null, positive Menge, Default O8 | Dieselbe Verweigerungsregel wie im Kernel | Service verteilt ohne `zero-weights`-Befund | Hoch; Widerspruch zur eigenen Fachregel O8 |
| F04: Abendmenge positiv, Day-WLR vorhanden, Eve-WLR fehlt | Fehlenden relevanten Pegel melden bzw. explizit freigegebene Ersatzregel anwenden | Kein Befund; Day-Pegel wird als Eve-Pegel eingesetzt | Hoch; slm 32/33, Unvollständigkeitskonzept |
| F05a: Simulation ergänzt Menge für Kombination ohne Quelle | Simulierte Bewertung `incomplete` | `ok` | Hoch; slm 12, fachlich irreführende Ampel |
| F05b: Simulation setzt die einzige Menge ohne Quelle auf null | Simulierte Unvollständigkeit entfällt | Bleibt `incomplete` | Hoch; Gegenrichtung desselben Fehlers |
| F06: Historische Menge gehört zu inzwischen inaktiver Zuordnung; Simulation ohne Änderungen | 100 Mengeneinheiten bleiben erhalten | Simulierte Summe 0 statt Ist-Summe 100 | Hoch; slm 12/44 |

### F01 – Schiesszeit wird pro Waffenposition vervielfacht

In [deriveOperatingData](../../apps/api/src/modules/calculation/operating-data.ts) wird innerhalb der Positionsschleife für jede Kombination ein vollständiger Nutzungszeitraum in `categorised` eingefügt. [annex7HalfDays](../../libs/shared/lsv/src/lib/operating-data.ts) summiert diese Minuten je Datum und Kategorie. Zwei verschiedene Kombinationen derselben A7-Kategorie verdoppeln dadurch die Zeit derselben Nutzung.

B1 7.4.3 betrachtet die Nutzungszeiträume der identifizierten Schiessplatznutzungen gesamtheitlich. Eine zweite Position derselben Kategorie erzeugt keine zweite Nutzungsdauer. Bei unveränderten Mengen und Pegeln hebt die Verdoppelung von 0,5 auf 1 Halbtag den A7-Kategorieteilpegel um `10·log10(2) = 3,0103 dB` an.

**Warum bestehende Tests grün bleiben:** Der CRUD-Test mit mehreren Positionen prüft das Speichern, nicht die anschliessende A7-Zeitberechnung. Die Halbtagtests verwenden überwiegend eine Position je Nutzung und nicht überlappende Nutzungen.

**Korrekturrichtung:** Je Nutzung und A7-Kategorie den Zeitraum nur einmal berücksichtigen. Zusätzlich die Vereinigung überlappender Zeitintervalle verschiedener Nutzungen fachlich festlegen und testen. Die neue Reproduktion beweist die Mehrfachzählung innerhalb einer einzigen Nutzung; sie setzt keine abschliessende Interpretation sämtlicher Überlappungsfälle voraus.

### F02 – Präzision geht nach der Jahresmittelung wieder verloren

Die Jahresmittelung in `deriveOperatingData` erhält die Genauigkeit. Anschliessend quantisiert [distributeShots](../../libs/shared/lsv/src/lib/distribution.ts) die gesamte Menge jedoch mit `Math.round(quantity * 1000)` auf Tausendstel. Ein gültiger Eingang von 0,001 kg über drei Jahre wird bei zwei Quellen vollständig auf null gerundet. Auch grössere nicht endliche Dezimalbrüche werden verändert.

**Warum bestehende Tests grün bleiben:** Die Verteilungstests verwenden Mengen mit höchstens drei Dezimalstellen. Fall 6 in [rechenfaelle.spec.ts](../../apps/api/src/modules/calculation/rechenfaelle.spec.ts) prüft das ungerundete Jahresmittel und die DTO-Daten, aber keine vollständige Verteilung dieses kleinen Mittels auf mehrere positive Quellen mit anschliessendem Pegel.

**Korrekturrichtung:** Abgeleitete Mengen intern mit ausreichender Genauigkeit verteilen; Anzeigepräzision getrennt behandeln. Prüfinvarianten: Mengenerhaltung, positive Menge verschwindet nicht, Reihenfolge der Quellen beeinflusst den Pegel nicht relevant, Mittelung und Verteilung sind konsistent.

### F03 – Service umgeht die getestete Nullgewichtsregel

[distribution.spec.ts](../../libs/shared/lsv/src/lib/distribution.spec.ts) prüft ausdrücklich: Auch **eine** Quelle mit Gewicht null wird standardmässig verweigert. `distributeOntoState` hat dagegen einen vorgezogenen Sonderzweig `sources.length === 1`, der die gesamte Menge direkt zuordnet. Der Kernel wird dort gar nicht aufgerufen.

**Warum bestehende Tests grün bleiben:** Der Kernel testet die richtige Regel isoliert. Die Service-Rechenfälle prüfen Nullgewichte bei mehreren Quellen, nicht bei einer einzelnen Quelle.

**Korrekturrichtung:** O8-Regel zentral anwenden und dieselbe Eingabematrix über Kernel und Service prüfen. Falls eine einzelne Quelle fachlich bewusst anders behandelt werden soll, muss dies als ausdrückliche Ausnahme dokumentiert und in beiden Schichten konsistent umgesetzt werden. O8 ist eine projektspezifische Ausgestaltung, kein wörtlich vorgegebenes B1-Detail.

### F04 – Fehlendes Eve-WLR wird still ersetzt

[pointSources](../../apps/api/src/modules/calculation/operating-data.ts) prüft nur das Vorhandensein von `row.day`. Für den Abend verwendet es `row.eve?.lae ?? row.day.lae`. Bei positiven Abendmengen kann dadurch ein vollständiges Ergebnis mit einem nicht gelieferten Abendpegel entstehen.

**Warum bestehende Tests grün bleiben:** Der bestehende `no-level`-Test entfernt die WLR-Daten des Punktes/der Quelle vollständig. Er prüft nicht das gezielte Fehlen nur der relevanten Zeitgruppe.

**Korrekturrichtung:** WLR-Abdeckung nach tatsächlich positiver Menge und Zeitgruppe prüfen. Day→Eve-Ersatz nur bei dokumentierter, expliziter Fachregel. Ergänzend prüfen: nur Day-Mengen ohne Eve-WLR; nur Eve-Mengen ohne Day-WLR; beide Zeitgruppen mit unterschiedlichen Pegeln. Ein fehlender, aber gar nicht benötigter Pegel ist getrennt von einem relevanten Datenverlust zu behandeln.

### F05 – Simulation bewertet Vollständigkeit anhand der falschen Eingaben

In [SimulationService.run](../../apps/api/src/modules/calculation/simulation.service.ts) wird der Pegel aus den simulierten Mengen neu berechnet, `noiseState` erhält jedoch weiterhin `{ incomplete: base.incomplete }`. Auch das ausgegebene `incomplete` stammt durch `...base` aus dem Ist-Zustand.

**Warum bestehende Tests grün bleiben:** Skalierung, unveränderte Werte und Nullsetzung werden überwiegend auf einem bereits vollständig berechenbaren Demo-Zustand geprüft. Es fehlt der Wechsel vollständig → unvollständig und zurück aufgrund der Simulationseingaben.

**Korrekturrichtung:** Pegel und Vollständigkeit gemeinsam aus derselben simulierten Verteilung berechnen. Ist- und Simulationsstatus separat führen. Beide neuen Tests sind nötig: Eine Korrektur darf weder fehlende Mengen verschweigen noch alte Warnungen nach deren Entfernung beibehalten.

### F06 – Simulation verliert historische Mengen inaktiver Zuordnungen

`SimulationService.load` lädt nur aktive Zuordnungen. Die Ist-Betriebsdaten enthalten dagegen weiterhin historische Nutzungen inaktiver Zuordnungen. `run` baut die neue `annex9`-Map ausschliesslich aus den angezeigten aktiven Zeilen auf. Damit verschwinden historische Mengen schon bei `rows: []`, also ohne jede Änderung.

**Warum bestehende Tests grün bleiben:** [usage.service.spec.ts](../../apps/api/src/modules/usage/usage.service.spec.ts) testet die Gültigkeit historischer Nutzungen nach Deaktivierung; [simulation.service.spec.ts](../../apps/api/src/modules/calculation/simulation.service.spec.ts) testet unveränderte Simulation auf einem anderen, vollständig aktiv zugeordneten Datensatz. Die Kombination fehlt.

**Korrekturrichtung:** Simulation aus einer Kopie sämtlicher Ist-Mengen aufbauen und nur explizit geänderte zulässige Zeilen überschreiben. Historische Mengen in der UI nachvollziehbar anzeigen, auch wenn sie nicht mehr neu erfassbar sind.

## 3. Qualität der bestehenden Tests

| Testbereich | Was gut abgesichert ist | Grenze des Nachweises |
|---|---|---|
| A7/A9-Referenztests | Mehrere Empa-Punkte, Rohwerte, Leerfälle, getrennte Skalierung A9 +10 dB und A7 +3 dB bei zehnfacher Menge | Fixtures werden im Test nicht erneut aus dem Original-XLSM extrahiert; E8 folgt einer explizit gewählten Variante. |
| Betriebsdaten-Kernel | 07/19-Uhr-Grenzen, 12-Uhr-Trennung, exakt 2 h/knapp darüber, Wochenenden, ganze/halbe Feiertage | Mehrere Positionen derselben Kategorie, Überlappungen und Repräsentationsabhängigkeit fehlen. |
| Testplatz-S-Rechenfälle | Frische Daten je Fall; Mengen, Halbtage, Rohpegel und Ampeln werden getrennt geprüft | Gute Kette, aber keine vollständige Kreuzkombination mit inaktiven Zuordnungen, kleinen Mitteln und fehlenden Zeitgruppen. |
| Quellenverteilung | 3:1-Verhältnis, Nullgewichte, Freigabe der Ersatzregel, negative Eingaben | Service-Sonderzweig und Mengen unter 0,001 nach Mittelung nicht abgedeckt. |
| Rundung/Grenzwerte | Besonders guter Nachweis: Rohwert 60,4997 und 60,5052 werden beide als 60,5 angezeigt, aber unterschiedlich beurteilt | Dieses Muster sollte auf Simulationen mit gemischten Baujahren und unvollständigen Daten erweitert werden. |
| Simulation | Identität, Skalierung, Teiländerung, andere Zustände, keine Berechnungsgrundlage | Viele Erwartungen vergleichen zwei Aufrufer desselben Rechenkerns; gemeinsame Fehler können unentdeckt bleiben. F05/F06 fehlen. |
| Zustandsisolation | Composite-FKs, getrennte Zustände, Importabbruch, spätere Änderungen verändern gespeicherte Ergebnisse nicht | Kein Beweis für konsistente Snapshots bei gleichzeitigen Änderungen während eines Laufs. |
| Nutzungserfassung | CRUD, erlaubte Kombinationen, historische Zuordnungen, sequentielle Idempotenz | Direkte Service-Aufrufe durchlaufen keinen Nest-ValidationPipe; damit kein Nachweis für den HTTP-Eingabevertrag. |
| Browser-/Akzeptanztests | Viele fachliche Drehbücher und erwartete Ergebnisse beschrieben | `test.fixme` zählt nicht als Ausführung. Die neuen Prüftests schliessen diese Lücke ebenfalls nicht. |

### Unabhängigkeit der Sollwerte

Die festen Werte in [TESTPLATZ_S_REFERENCE](../../libs/api/tests/src/lib/fixtures/testplatz-s.dataset.ts) sind im Test nicht aus dem aktuellen Anwendungsergebnis berechnet. Zwei zentrale Werte habe ich zusätzlich mit einer unabhängigen Python-Rechnung nachvollzogen:

```text
A9 = 10·log10(1210·10^8 + 200·10^8.5)
     − 10·log10(52·5·12·3600) + 15
   = 57.14939920103325 dB

A7 = 70 + 10·log10(1 + 3·1) + 3·log10(110) − 44
   = 38.1447779687543 dB
```

Beide stimmen mit den eingecheckten Referenzen überein. Das stärkt deren Aussage für genau diese Fälle. Es ersetzt keine unabhängige Prüfung aller Quellen, Kategorien, Original-Excel-Formeln oder Importdaten. Die synthetische Saison mit 27 Werk- und einem Sonn-Halbtag bestätigt die erzeugte Saisonzählung, nicht den Import der Empa-Betriebsdatei.

## 4. Weitere statische Auffälligkeiten und offene Fachentscheide

Diese Punkte wurden gelesen, aber noch nicht durch zusätzliche Fehlertests reproduziert; sie sind getrennt von F01–F06 zu behandeln.

- **Gespeicherter Berechnungslauf:** [CalculationRunService.run](../../apps/api/src/modules/calculation/calculation-run.service.ts) berechnet zuerst das Ergebnis und lädt anschliessend Referenzen und Nutzungen erneut für den Snapshot. Bei gleichzeitigen Änderungen können Ergebnis und gespeicherte Eingaben auseinanderfallen. Der aktuelle Isolationstest ändert Daten nach dem Lauf und erfasst diese Situation nicht. Die Prüfsumme enthält Zustand-ID, Eingaben, Referenzen und Parameter, aber weder Ergebnis noch expliziten Zeitraum noch vollständigen Zustandsinhalt. Gleiche Prüfsumme ist daher kein vollständiger Nachweis identischer Berechnungsläufe.
- **Beliebige Zeiträume:** `resolvePeriod` verwendet `Math.max(1, Math.round(days / 365.25))`. Das erzeugt sprunghafte Nenner bei Teiljahren. B1 fordert sinngemässe Anwendung auf beliebige Zeiträume; die fachliche Normierung für 6/18/30 Monate sollte ausdrücklich festgelegt und dann getestet werden. Ohne diese Festlegung hier kein abschliessendes Fehlerurteil.
- **A9-Zeitsplit:** `splitAnnex9` orientiert sich an der Zahl der Dezimalstellen des Eingabewerts. Beispielsweise wird 1 kg bei einer hälftigen Zeitteilung zu 1/0 statt 0,5/0,5. Die Tests schreiben eine Rundung mit Restzuweisung ausdrücklich fest; eine entsprechende Fachfreigabe ist in diesen Tests nicht nachgewiesen. Eingabespeicherpräzision und Genauigkeit abgeleiteter Betriebsdaten trennen.
- **Gemischte Baujahre in der Simulation:** `toSimulationReceiver` wählt bei vorhandener IGW-Betrachtung diese eine Grenze. Die zusätzliche PW-Teilbetrachtung neuer Anlageteile wird dort nicht wie im Assessment ausgegeben. Mit einem Fall «IGW gesamt eingehalten, PW neuer Teil überschritten» gegen den gewünschten Simulationsumfang prüfen.
- **A7-Kategorie:** Halbtage folgen der Kategorie aus den Waffenstammdaten; verteilte Quellen können dagegen `source.dataA7.category` verwenden. Widersprüchliche Kategorien müssen beim Import ausgeschlossen oder als unvollständig gemeldet werden. Sonst kann eine Kategorie Schüsse, aber keine passenden Halbtage erhalten.
- **Veraltete Kommentare:** `distribution.ts` beschreibt an einzelnen Stellen Gleichverteilung als Default, obwohl der Kernel verweigert; `operating-data.ts` erwähnt noch 13:00 in einem Kommentar. Solche Widersprüche sind bei Fachcode besonders problematisch, weil sie Testentwürfe und Reviews fehlleiten.

## 5. Konkrete nächste Test- und Korrekturschritte

1. **F05 und F06 zuerst korrigieren:** Sie können simulierte Mengen bzw. deren fehlende Berechenbarkeit verschweigen. Die drei vorhandenen Prüftests danach als reguläre Service-/DB-Regressionstests übernehmen.
2. **F01–F04 korrigieren bzw. die Ersatzregeln verbindlich festlegen:** Kernel und Aufrufer müssen dieselbe Regel anwenden. Neue Tests nicht durch Anpassung der Sollwerte an das fehlerhafte Ist «grün» machen.
3. **Gezielte Invarianten ergänzen:** Mehrere Positionen gleicher Kategorie ändern keine Nutzungsdauer; reine Aufteilung einer identischen Quelle verändert den Pegel nicht; Mengen bleiben nach Mittelung/Verteilung erhalten; ungeänderte Simulation entspricht dem Ist auch bei historischen Stammdaten.
4. **Zeitgruppen und Vollständigkeit kreuzen:** Day/Eve einzeln fehlend, Mengen jeweils null/positiv, eine/mehrere Quellen, Null-/Teilnullgewichte, Übergang vollständig/unvollständig.
5. **HTTP- und Nebenläufigkeitstests ergänzen:** Ungültige Eingaben vor jeder Speicherung abweisen; Kopf/Positionen atomar; parallele externe ID; Snapshot während gleichzeitiger Änderung konsistent.
6. **Reale Referenzkette abnehmen:** Originaldatei → Import → Betriebskalender → Verteilung → Rohpegel → Beurteilung → Anzeige/Export. Mit unabhängig dokumentierten Sollwerten und expliziter E8-Freigabe.

Die erste Anforderungsmatrix ist für `slm 31–33` mit diesen Befunden zu lesen: Der Kernumfang ist implementiert und in bestehenden Fällen getestet, **die fachliche Korrektheit ist in den hier nachgewiesenen Fällen noch nicht erreicht**.
