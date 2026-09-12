import { tags } from '../support/actors';
import { test } from '../support/test';

/**
 * Fachabläufe Priorität 3 — Betrieb: Last während einer Berechnung, Ausfall des Kartendienstes
 * (readme.md, Abschnitt 7; Protokoll nach `protokoll-vorlage.md`). Soll aus B1 12.5 (Antwortzeiten)
 * und B1 5.4 (GIS). Skelett: alle Fälle `test.fixme`; Skelette zählen nicht als bestanden.
 */
test.describe('Prio 3 · Betrieb', () => {
  test.fixme(
    '3.1 zehn Benutzer arbeiten während einer Berechnung – Antwortzeiten eingehalten, niemand blockiert',
    { annotation: tags({ actor: 'A01', prio: 3, slm: [54] }) },
    async () => {
      // Ausgangslage: Geissalp mit 4 572 Nutzungen (validierung-technisch.md 1.1); 10 Sitzungen (A01 ×2, A02 ×3, A03 ×4, A05 ×1)
      //               als getrennte Browser-Kontexte; Umgebung, Datenmenge und Datum im Protokoll (checkliste.md, Qualität).
      // Aktion:       Kontext 1 startet die Beurteilung über drei Jahre (schwerste Anfrage); parallel laden die anderen Übersicht,
      //               Schusszahlen (Filter), Details, Simulation; Messung mit performance.now() pro Seite, inkl. Wartezeit und Netz.
      // Soll (B1 12.5): Suche Ø ≤ 2 s / max 5 s, Filter Ø 0.5 s / max 1 s, Details Ø 2 s / max 5 s, Berechnung Ø 5 s / max 10 s;
      //               kein Request der anderen Kontexte wartet auf die Berechnung (Zeitreihe zeigt keine Stufe während des Laufs).
      //               Ein Rechenkern-Benchmark ersetzt diesen Lasttest nicht (checkliste.md) – Ergebnis nicht linear hochrechnen.
      // Ist / Beleg:  Messtabelle (Median/Max je Seite) + k6-/Playwright-Report; Umgebung benennen.
    },
  );

  test.fixme(
    '3.2 Kartendienst fällt aus – verständlicher Fehlerzustand, übrige Anwendung bleibt benutzbar',
    { annotation: tags({ actor: 'S03', prio: 3, slm: [2, 50] }) },
    async () => {
      // Ausgangslage: Details Geissalp mit Karte (Swisstopo-Hintergrund, B1 5.4).
      // Aktion:       page.route() auf die Kartendienst-URLs: (a) 503, (b) Timeout > 30 s, (c) Verbindungsabbruch nach dem ersten Tile.
      //               Danach Empfangspunkt in der Liste wählen, Zustand wechseln, Simulation ausführen.
      // Soll:         Karte zeigt einen klaren Fehlerzustand mit Text (kein Endlos-Spinner, kein weisser Block ohne Hinweis);
      //               Empfangspunkt-Liste (`details-list-toggle`) bleibt bedienbar, Pegel/Ampel werden angezeigt, Simulation läuft;
      //               keine unbehandelte Exception in der Konsole; nach Wiederherstellung (route.continue) lädt die Karte ohne Reload.
      //               Ein Stub (page.route) ist ein Stub – der Nachweis mit dem echten Dienst folgt auf dem Akzeptanzsystem.
      // Ist / Beleg:  Screenshots (a)–(c), Konsolen-Log.
    },
  );
});
