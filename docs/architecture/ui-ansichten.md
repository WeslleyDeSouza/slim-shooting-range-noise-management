# UI-Ansichten für das Usability-Konzept

Stand: 2026-09-11. Beilage A2 verlangt kein fertiges UI-Design, aber ein
Usability-Konzept; diese Ansichten belegen es. Skizzen zeigen den Aufbau, Screenshots
der laufenden Anwendung werden unter `docs/architecture/images/` ergänzt, sobald die
Seiten fertig sind (Bildpfade unten sind Platzhalter).

## Grundlagen

- **Design System** `libs/app/design-system` (`@ui-slim/design-system`): SCSS-Tokens
  als `--slim-*`, BEM-Blöcke (`slim-page`, `slim-card`, `slim-table`, `slim-badge`,
  `slim-chip` …), Light und Dark, Farbschema wie ELO. Lebender Styleguide unter
  `/styleguide`. Regeln in `.claude/styleguide.md`.
- **Mobile first**: unter 1024 px Topbar + Tabbar, ab 1024 px Sidebar (`app-admin-layout`);
  Tabellen stapeln auf dem Telefon (`slim-table--stack`), Touch-Ziele ≥ 44 px.
- **Navigation**: Sitemap Abbildung 18 (`docs/architecture/sitemap.md`), Breadcrumbs auf
  jeder Seite, Kontextleiste je Schiessplatz mit den Reitern Übersicht · Schusszahlen ·
  Details · Simulation, Schiessplatz-Wechsel in der Leiste.
- **Ampel-Logik** (B1 5.10, umgesetzt in `@slim/lsv`):

  | Ampel | Kontingent (Ist vs. Soll Plangenehmigung) | Lärm (Lr vs. Grenzwert je ES) |
  | --- | --- | --- |
  | grün «Eingehalten» | Ist ≤ Soll | Lr ≤ Grenzwert − 5 dB |
  | orange «Zu prüfen» | Ist ≤ 125 % Soll | Lr > Grenzwert − 5 dB |
  | rot «Überschritten» | Ist > 125 % Soll | Lr > Grenzwert |
  | grau «Keine Daten» | kein Soll | keine Berechnung / Reservepunkt |

  Aggregation: rot, sobald ein Element rot ist, sonst orange, sonst grün. Die Pille
  (`app-status-pill`) trägt Symbol und Text, nicht nur Farbe.
- **Mehrsprachigkeit** de / fr / it / en über `translate`-Pipe, Sprachwahl in der Kopfzeile.

## Übersicht Schiessplätze mit Ampeln

Route `/admin/area` (umgesetzt, `views/admin/area/area-overview.component.ts`).
Daten: `GET admin/area` über `AreaFacade`.

```mermaid
flowchart TB
  subgraph Page["slim-page · Übersicht Schiessplätze"]
    direction TB
    BC["Breadcrumbs: Startseite › Übersicht Schiessplätze"]
    HEAD["Titel + Untertitel · rechts: Jahr-Select, Exportieren"]
    TOOL["Toolbar: Suche Bezeichnung / Koordinationsabschnitt-Nr. · Status-Filter · Zähler · «Nur berechtigte Schiessplätze»"]
    TABLE["Tabelle: Bezeichnung · KA-Nr. · Sachplan-Nr. · Kontingent-Ampel · Lärm-Ampel · Navigation"]
    ROW["Zeile klickbar → Schiessplatz-Übersicht; Aktionen: Übersicht, Schusszahlen"]
    FOOT["Fuss: 1–n von total · Pager"]
    LEGEND["Legende der Ampeln"]
    BC --> HEAD --> TOOL --> TABLE --> ROW --> FOOT --> LEGEND
  end
```

Elemente: Suche (auch Sachplan-Nr.), Filter «Nur Handlungsbedarf» (orange/rot) — von
der Einstiegsseite per `?status=attention` vorbelegt —, zwei Ampeln pro Zeile, auf dem
Telefon gestapelte Karten mit `data-label`.

![Übersicht Schiessplätze](images/area-overview.png)

## Schiessplatz – Details: Karte mit Empfangspunkten

Route `/admin/area/:id/details` (im Bau nach `_mocks/area/detail.index.html`).
Daten: `GET admin/area/:id/calculation/assessment?calculationId&from&to`.

```mermaid
flowchart TB
  subgraph Page["slim-page · Details · Empfangspunkte"]
    direction TB
    CTX["Kontextleiste: ‹ Übersicht · 1104.020 Geissalp ▾ · Ampeln · Reiter Übersicht · Schusszahlen · Details · Simulation"]
    HEAD["Titel «Details · Empfangspunkte» · Bericht PDF"]
    CALC["Karte Immissionsberechnung: gültiger Zustand, Baujahr Anlageteile, letzte Berechnung · Ansicht: Zustand-Select, Betrachtungszeitraum von–bis, Hinweis bei abweichendem Zustand"]
    KPI["KPIs: n Empfangspunkte · überschritten · zu prüfen · eingehalten · ohne Berechnung"]
    subgraph Split["zweispaltig ab md, gestapelt auf dem Telefon"]
      direction LR
      MAP["Karte / Liste umschaltbar<br/>schematische SVG-Karte mit farbigen Pins E1…E6<br/>Legende: eingehalten, zu prüfen, überschritten, keine Berechnung"]
      DET["Detailbereich des gewählten Punkts<br/>Nr., EGID, Typ, Empfindlichkeitsstufe<br/>Tabelle: Anhang 9 IGW/PW, Anhang 7 IGW/PW · Grenzwert · Pegel · Reserve-Balken<br/>Delta zum gültigen Zustand"]
    end
    CTX --> HEAD --> CALC --> KPI --> Split
  end
```

Elemente: Pin-Farbe = schlechteste anwendbare Beurteilung des Punkts; Planungswert
nur für Anlageteile nach 1985 (gemischt: nur diese Stellungsräume); Reservepunkte ohne
Gebäude erscheinen grau. Die Liste ist die barrierefreie Alternative zur Karte
(Sortierung rot → orange → grün → grau). Die Karte ist heute schematisch (SVG,
Positionen in Prozent); die swisstopo-Karte mit Vollansicht ist geplant, nicht
umgesetzt.

![Details mit Empfangspunkten](images/area-details.png)

## Schiessplatz – Schusszahlen: Nutzungstabelle

Route `/admin/area/:id/shots` (im Bau nach `_mocks/area/index.html`).
Daten: `GET admin/area/:id/usage/overview?year`, Mutationen `POST`/`PATCH`/`DELETE`
`admin/area/:id/usage`, Undo über `POST …/usage/restore`.

```mermaid
flowchart TB
  subgraph Page["slim-page · Schusszahlen"]
    direction TB
    CTX["Kontextleiste mit Reitern · Ampel «Kontingent Jahr»"]
    HEAD["Titel + Beschreibung · Jahr-Select · Exportieren · Nutzung erfassen"]
    RO["Hinweisbalken bei Leseberechtigung: erfassen/bearbeiten/löschen gesperrt"]
    KPI["KPIs: Schuss gesamt · Nutzungen erfasst · Anteil zivil · letzte Nutzung"]
    subgraph Split["Seitenleiste + Tabelle, ab md nebeneinander"]
      direction LR
      ROOMS["Stellungsräume gruppiert<br/>Zielräume · Stellungsräume · NGST<br/>Zähler je Raum, «Alle»"]
      subgraph Card["Karte"]
        direction TB
        TOOL["Suche · Datum von/bis · Chips Nutzung Mil/Zivil · Kategorie · Filter zurücksetzen"]
        BULK["Auswahlleiste: n ausgewählt · Ausgewählte löschen · Auswahl aufheben"]
        TBL["Tabelle sortierbar: ☐ · Stellungsraum · Nutzungseinheit · Zeitraum · Nutzung · Kategorie · Waffe/Kaliber · Anzahl Schuss · Erfasser (ELO-Kennzeichen) · Bearbeiten/Löschen"]
        FOOT["Fuss: n von total · Summe Anzeige"]
        TOOL --> BULK --> TBL --> FOOT
      end
    end
    DRAWER["Drawer «Nutzung erfassen / bearbeiten»: Stellungsraum · Nutzungseinheit · Datum (Heute/Gestern) · Zeitraum (Vormittag/Nachmittag/Nachtschiessen) · Nutzung · Kategorie · Waffe nur aus Zuordnung · Anzahl Schuss (Stepper) · Bemerkung · ungespeicherte Änderungen"]
    MODAL["Löschen-Dialog mit Folgen für die Lärmberechnung · Toast mit «Rückgängig»"]
    CTX --> HEAD --> RO --> KPI --> Split
    Split -.-> DRAWER
    Split -.-> MODAL
  end
```

Elemente: Standardfilter laufendes Jahr; Waffenliste nur aus den erlaubten
Kombinationen Stellungsraum × Waffe (5.17); Zeilen aus der ELO-Schnittstelle sind
gekennzeichnet; Löschen ist ein Soft-Delete mit Undo. Jede Mutation löst
`DATA_RELOAD` aus, sodass KPIs und Zähler mitziehen.

![Schusszahlen](images/area-shots.png)

## Schiessplatz – Simulation

Route `/admin/area/:id/simulation` (im Bau nach `_mocks/area/simulation.index.html`).
Daten: `GET admin/area/:id/calculation/simulation?year` (Ist), `POST …/simulation`
(Rechnen); nichts wird gespeichert.

```mermaid
flowchart TB
  subgraph Page["slim-page · Simulation"]
    direction TB
    CTX["Kontextleiste mit Reitern"]
    HEAD["Titel · Bericht PDF (nach Lauf)"]
    NOTE["Hinweis Sandkasten: verändert keine echten Daten"]
    subgraph Split["zweispaltig ab lg"]
      direction LR
      subgraph Left["Eingaben"]
        direction TB
        TBL["Tabelle Stellungsraum (KA-Nr.) × Waffe/Munitionstyp<br/>Spalten: innerhalb Werktag · ausserhalb Werktag<br/>Ist-Werte, überschreibbar, Delta in % je Zelle, Total"]
        QUICK["Schnellwahl: −20 % · −10 % · +10 % · +20 % · +50 %"]
        TBL --> QUICK
      end
      subgraph Right["Berechnung und Resultat"]
        direction TB
        CALC["Immissionsberechnung: Zustand, Baujahr, Beurteilung Anhang 9"]
        MAP["Karte mit Pins: Simulation, Ist als Schatten · Popup Grenzwert / Ist / Simulation / Differenz"]
        RES["Resultat je Empfangspunkt: Grenzwert · Ist · Simuliert · Differenz · Beurteilung (Ampel-Übergang)"]
        CALC --> MAP --> RES
      end
    end
    BAR["Aktionsleiste unten: Status (aktuelle Werte / nicht berechnet / veraltet) · n Werte geändert · Total Schuss vs. Ist · Zurücksetzen · Simulation ausführen"]
    CTX --> HEAD --> NOTE --> Split --> BAR
  end
```

Elemente: Initialwerte = militärische Schusszahlen des Jahres pro Quelle nach 7.4.5;
ein Resultat wird als «veraltet» markiert, sobald Werte danach geändert werden; die
Beurteilung zeigt den Ampel-Übergang Ist → Simulation. Die Rechnung läuft synchron in
der API mit den WLR-Werten des gültigen Zustands (siehe
[gesamtarchitektur.md](gesamtarchitektur.md#datenfluss-lärmberechnung)).

![Simulation](images/area-simulation.png)

## Ergonomie-Regeln, die alle Ansichten teilen

- Ein Block pro Komponente, Zustände als Modifikatoren (`--active`, `--stale`), keine
  reinen Farbcodierungen ohne Text oder Symbol.
- Formulare als Drawer (Telefon: Vollbild), Pflichtfelder markiert, Validierung am Feld
  und im Backend (`class-validator`).
- Tastatur: alle Pins und Zeilenaktionen sind Buttons/Links mit `aria-label`; Fokus
  sichtbar (`focus-visible`).
- Leere Zustände mit Handlungsaufforderung («Erste Nutzung erfassen»), Ladezustände mit
  Spinner/Skeleton, Fehler als `slim-alert` mit übersetzter Meldung (auch «offline»).
