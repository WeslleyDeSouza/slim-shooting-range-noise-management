import { FIXTURE_AREAS, tags } from '../support/actors';
import { test } from '../support/test';

/**
 * A04 Schiessplatz-Nutzer — B1 4.5 «Schiessplatznutzung (Schusszahlen) entgegennehmen».
 *
 * B1 4.2.3: Übungsleiter, Polizei, SAT-Vereine, zivile Vereine – erfassen die Nutzung
 * (Anzahl Schuss, Zeitdauer, Waffe/Kaliber) in der «Schusszahlenerfassung (ELO)». 4.5: die
 * Übernahme nach SLIM läuft über die Schnittstelle B1 6.1/6.2 (Maschinenidentität S01);
 * alternativ importiert A01 Excel-Dateien (9.3). Mengen: 100–1'500 Nutzungen je Platz und Jahr.
 *
 * A04 hat KEIN SLIM-Konto (readme 1, Abschnitt 1): der Akteur ist im Test die Person, die in
 * ELO erfasst; SLIM sieht nur den Request von S01. Diese Datei prüft deshalb die fachliche
 * Wirkung einer ELO-Erfassung in SLIM (Grundablauf). Protokoll, Fehlercodes, Token und
 * Wiederholung der Schnittstelle selbst stehen in `s01-elo/` und werden hier nicht gedoppelt.
 * Ein Lauf mit gestubbtem ELO-Client ist als Stub auszuweisen; erst der Lauf gegen die echte
 * ELO-Instanz (pwa-elo-shot-counting) ist der systemübergreifende Nachweis.
 *
 * Stand: der Endpunkt `public/elo` existiert noch nicht (c07-elo-interface, Sprint 2).
 * Skelett: alle Fälle `test.fixme` mit Drehbuch; Skelette zählen nicht als bestanden.
 */
const { A } = FIXTURE_AREAS;

test.describe('A04 · 4.5 Schiessplatznutzung (Schusszahlen) entgegennehmen', () => {
  test.describe('Grundablauf über ELO (B1 4.5, 6.1, slm 28–30)', () => {
    test.fixme(
      'ELO holt die Anlageninformationen: der Nutzer sieht in ELO nur zulässige Räume und Kombinationen von SLIM',
      { annotation: tags({ actor: 'A04', useCase: '4.5', slm: [28, 17] }) },
      async () => {
        // Vorbedingung: S01-Token (E2E_S01_TOKEN); Zuordnung Waffen von Platz A wie im Seed.
        // Aktion: GET Anlageninformationen als S01 (Struktur B1 6.1.3: Schiessplatz → Stellungsraum →
        //         zulässige Waffenkategorie → zulässige Kombination mit DE/FR/IT).
        // Erwartung: Geissalp mit 14 Räumen; Raum «Stellungsrm Mw Neuhaus, B 3» enthält Stgw 90 – 5.6 mm;
        //            Ids ≤ 20 Zeichen (6.2.3); inaktive Plätze/Kombinationen fehlen (5.16 Aktiv-Flag).
        // Erwartung Änderungsfolge: A01 entfernt eine Zuordnung (4.4) → nächster GET liefert sie nicht mehr.
      },
    );

    test.fixme(
      `Nutzer erfasst in ELO eine Nutzung auf ${A.name} mit mehreren Waffen-/Kaliber-Positionen – SLIM übernimmt sie 1:1`,
      { annotation: tags({ actor: 'A04', useCase: '4.5', slm: [29, 30, 10] }) },
      async () => {
        // Aktion (als S01 im Namen des Nutzers): POST genau eine Schiessplatznutzung (6.1.3):
        //         Nutzungsdatum heute, 08:00–11:45, Benutzende Einheit «Inf Bat 12», Anzahl Personen 24,
        //         Nutzungskategorie Militär, Stellungsraum-Id aus dem GET, Positionen
        //         [Stgw 90 / 5.6 mm: 1'200], [Pistole 12 / 9 mm: 300], [Sprengstoff: 2.5 (kg)].
        // Erwartung: 201 mit synchroner Bestätigung; als A01 auf /admin/area/{A}/shots: eine Nutzung mit
        //            3 Positionen, ELO-Badge (`shots-src-elo`), Erfasser:in = ELO/Einheit, Mengen dezimal.
        // Erwartung fachlich: KPI-Summe steigt um 1'500 Stück; Details (5.12) für das laufende Jahr ändern
        //            sich; Ampel (5.9) reagiert bei genügender Menge (c07 Fall 3).
        // Erwartung: dieselbe Nutzung als A02 sichtbar (Platz A zugeordnet) und korrigierbar (4.10).
      },
    );

    test.fixme(
      'zivile Nutzung mit ziviler Nutzungsart und Nutzung über die Tagesgrenze (zwei Erfassungen)',
      { annotation: tags({ actor: 'A04', useCase: '4.5', slm: [29, 31] }) },
      async () => {
        // Aktion: POST Kategorie Zivil + zivile Nutzungsart «Feldschiessen», Sonntag 09:00–12:00.
        // Erwartung: übernommen; Betriebsdaten Anhang 7 zählen einen Sonntags-Halbtag (7.4.3), Anhang 9
        //            zählt die Schüsse als «ausserhalb Werktag» (7.4.4) – Nachweis der Zahlen in c01/c03.
        // Aktion: Nachtschiessen 22:00–02:00 → als zwei Erfassungen (Tag 1 22:00–24:00, Tag 2 00:00–02:00)
        //         (B1 6.1.3 Hinweis Workshop 31.03.2025); ein einzelner POST über Mitternacht → 400.
      },
    );

    test.fixme(
      'fehlerhafte Erfassung des Nutzers wird abgewiesen, nichts halb gespeichert (Viertelstunde, Ende < Start, unbekannter Raum)',
      { annotation: tags({ actor: 'A04', useCase: '4.5', slm: [30] }) },
      async () => {
        // Aktion: 08:10 → 400 (Raster); Ende vor Start → 400; Einheit > 256 Zeichen → 400; Raum-Id unbekannt → 404;
        //         Kombination nicht zulässig für den Raum → 400/422.
        // Erwartung: keine Nutzung auf der Schusszahlen-Seite, keine KPI-Änderung (Zählung vorher/nachher).
        // Details (Feldfehler-Struktur, Statuscodes) → s01-elo.
      },
    );

    test.fixme(
      'Wiederholung nach Verbindungsabbruch erzeugt kein Duplikat',
      { annotation: tags({ actor: 'A04', useCase: '4.5', slm: [29, 30] }) },
      async () => {
        // Aktion: denselben POST zweimal senden (gleiche ELO-Kennung, z. B. collectionIdentifier ELO-2026-1100-00001).
        // Erwartung: eine Nutzung in SLIM; zweite Antwort idempotent (200/409 gemäss Schnittstellenvertrag –
        //            aus dem Vertrag übernehmen, nicht erfinden).
      },
    );
  });

  test.describe('Alternativer Weg: Excel-Import durch A01 (B1 4.5, 9.3, slm 37)', () => {
    test.fixme(
      'Excel-Datei gemäss Beilage B1.6 wird für einen Schiessplatz importiert, Fehlerzeilen im Bericht',
      { annotation: tags({ actor: 'A04', useCase: '4.5', slm: [37] }) },
      async () => {
        // Vorbedingung: fixtures/schusszahlen/geissalp-{{year}}.xlsx (Blätter Erfassung, Areal_Grundlagen, Nutzung,
        //               Waffen mil/ziv), 3 gültige Zeilen + 1 Zeile mit unbekanntem Stellungsraum.
        // Aktion: als A01 Import auf Platz A (Ausführungspfad beim Umsetzen eintragen; c03).
        // Erwartung: 3 Nutzungen übernommen (Herkunft «Import», Erfasser:in = A01), 1 Zeile im Fehlerbericht mit
        //            Zeilennummer und Grund; kein Teilimport der fehlerhaften Zeile.
      },
    );
  });
});
