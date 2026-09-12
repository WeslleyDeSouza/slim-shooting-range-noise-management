import { FIXTURE_AREAS, tags } from '../support/actors';
import { test } from '../support/test';

/**
 * A04 Schiessplatz-Nutzer — Option B1 Kapitel 11 «Ablösung Schusszahlenerfassung ELO»
 * (slm 46–49): direkte, mobile Erfassung in SLIM über einen QR-Code vor Ort.
 *
 * Eigener Testsatz gemäss readme (Abschnitt 1, Option): QR-Einstieg, Platz-/Raumvorbelegung,
 * zulässige Kombinationen, Personen, zivile Nutzungsart, dezimale Mengen, Validierung,
 * Verbindungsabbruch, duplikatfreie Wiederholung. Dieser Satz ist KEIN Beleg für die bestehende
 * ELO-Anbindung (uc-4.5) und umgekehrt.
 *
 * Authentifizierung: B1 11 nennt für die erfassende Person kein SLIM-Konto; der QR-Code trägt eine
 * Signatur/Token (slm 49). Welcher Weg gilt (signierter Link ohne Login, PIN, AGOV), ist mit der
 * Auftraggeberin festzulegen – bis dahin bleibt jeder Fall `fixme` und der Weg wird hier eingetragen.
 * Route/Maske existieren noch nicht (Sitemap: keine öffentliche Erfassungsroute).
 */
const { A } = FIXTURE_AREAS;

test.describe('A04 · Option 11 direkte Schusszahlenerfassung in SLIM', () => {
  test.describe('Zugang und Initialisierung (11.1, slm 46, 49)', () => {
    test.fixme(
      `QR-Deep-Link öffnet die Erfassungsmaske mit ${A.name} und Stellungsraum schreibgeschützt vorbelegt`,
      { annotation: tags({ actor: 'A04', useCase: 'Option 11', slm: [46] }) },
      async () => {
        // Aktion: URL aus dem QR (z. B. …/erfassung?platz=1104.020&raum=1104.020.05&sig=…) im Smartphone-Viewport
        //         (375 px) öffnen – ohne App-Installation, ohne bestehende Sitzung (T01-Kontext).
        // Erwartung: Platz «Geissalp» und Raum vorbelegt und nicht editierbar; kein horizontales Scrollen.
        // Negativfall: Link ohne Raum → Platz vorbelegt, Raum wählbar (nur Räume dieses Platzes).
      },
    );

    test.fixme(
      'manipulierter QR-Link (anderer Platz, geänderte Signatur) wird abgewiesen',
      { annotation: tags({ actor: 'A04', useCase: 'Option 11', slm: [49] }) },
      async () => {
        // Aktion: `platz` auf Bière ändern, Signatur unverändert lassen → Aufruf.
        // Erwartung: Maske öffnet nicht / zeigt «ungültiger Zugang»; kein POST möglich (Server prüft Signatur).
        // Aktion: abgelaufene Signatur (falls Ablauf vorgesehen) → gleiche Verweigerung.
      },
    );
  });

  test.describe('Erfassungsmaske (11.2, slm 47)', () => {
    test.fixme(
      'Datum heute vorbelegt, Zeit-Picker nur Viertelstunden, Einheit mit Autocomplete',
      { annotation: tags({ actor: 'A04', useCase: 'Option 11', slm: [47] }) },
      async () => {
        // Erwartung: Nutzungsdatum = heute (editierbar); Start/Ende nur 00/15/30/45; «Benutzende Einheit»
        //            schlägt frühere Eingaben vor (Seed: Einheiten der Geissalp-Nutzungen).
      },
    );

    test.fixme(
      'Kategorie Zivil blendet Pflichtfeld «Zivile Nutzungsart» ein; Anzahl Personen ist Pflicht',
      { annotation: tags({ actor: 'A04', useCase: 'Option 11', slm: [47] }) },
      async () => {
        // Aktion: Kategorie Militär → Feld fehlt; Zivil → Feld erscheint (Obligatorisch | Feldschiessen | Anderes),
        //         leer lassen → Absenden blockiert; Personen leer → blockiert.
      },
    );

    test.fixme(
      'geführte Auswahl Waffenkategorie → Kombination (gefiltert nach Raum), mehrere Zeilen, Dezimalmenge, Einheit Stück/kg',
      { annotation: tags({ actor: 'A04', useCase: 'Option 11', slm: [47, 17] }) },
      async () => {
        // Erwartung: nur Kategorien/Kombinationen, die dem vorbelegten Raum zugeordnet sind (5.17);
        //            Zeile hinzufügen/entfernen; «2.5» bei Sprengstoff erlaubt, Beschriftung «kg»; bei Munition «Stück».
        // Negativfall: «-1», «abc» → Feldfehler.
      },
    );
  });

  test.describe('Validierung, Offline, Bestätigung (11.3, slm 48)', () => {
    test.fixme(
      'Absenden prüft Vollständigkeit und Endzeit ≥ Startzeit; Erfolgsmeldung mit «weitere Nutzung erfassen»',
      { annotation: tags({ actor: 'A04', useCase: 'Option 11', slm: [48] }) },
      async () => {
        // Erwartung: Fehlerliste vor dem Absenden; nach Erfolg klare Bestätigung, Option E-Mail-Zusammenfassung
        //            (falls umgesetzt) und «weitere Nutzung für denselben Platz» mit erhaltener Vorbelegung.
        // Erwartung SLIM: Nutzung auf /admin/area/{A}/shots (als A01), Herkunft «Direkt», Positionen vollständig.
      },
    );

    test.fixme(
      'Verbindungsabbruch: Eingaben bleiben lokal erhalten, erneutes Absenden erzeugt kein Duplikat',
      { annotation: tags({ actor: 'A04', useCase: 'Option 11', slm: [48] }) },
      async () => {
        // Aktion: Maske ausfüllen → context.setOffline(true) → Absenden → Hinweis «gespeichert, wird gesendet»;
        //         Reload offline → Eingaben da (Local Storage); online → Senden → 1 Nutzung.
        // Aktion: Absenden zweimal auslösen (Doppelklick / Retry) → weiterhin 1 Nutzung (Client-Kennung).
      },
    );
  });
});
