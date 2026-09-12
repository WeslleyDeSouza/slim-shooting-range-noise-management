# Protokoll-Vorlage für einen Fachablauf

Vor jedem Durchspielen (manuell oder als Playwright-Fall) **vorher** ausfüllen – bis und mit
«erwartetes Ergebnis». «Tatsächliches Ergebnis» und «Beleg» kommen nach dem Lauf dazu.

```text
Fachablauf:        <Prio · Titel, z. B. «1 · Empa-Demodaten importieren und A7/A9 berechnen»>
Akteur:            <A01 … / T04 / S01>, Rolle, Platzzuordnung
Anforderung:       B1 <Kapitel / slm>, Matrix-Zelle <Bereich Recht>
Datum / Umgebung:  <YYYY-MM-DD>, <lokal | Akzeptanzsystem>, Commit <sha>, Seed <Datensatz + Version>

Ausgangslage:      welcher Datenzustand ist hergestellt (Platz, Zustand «aktuell», Nutzungen, Feiertage,
                   Kontingente, Rollen). Nur was für das Ergebnis relevant ist.
Aktion:            der echte Anwendungspfad (Maske / Import / API), Schritt für Schritt.
Erwartetes Ergebnis:
                   der Soll-Wert MIT Herleitung – Empa-Referenz (B1.4 Blatt/Zelle), Handrechnung
                   (fixtures/platz-s.md Abschnitt) oder fachlich bestätigte Regel (B1 Kapitel, FAQ-Nr.).
                   Nie «was die Anwendung heute zeigt».
Tatsächliches Ergebnis:
                   Zahl / Zustand, wie angezeigt UND wie persistiert (API-Antwort, DB).
Beleg:             Screenshot / Playwright-Trace / HTML-Report-Link / Export-Datei / Logbuch-Eintrag.
Bewertung:         abgenommen | bedingt (Abweichung + Ticket) | nicht abgenommen
```

## Regeln

1. Soll-Wert vor dem Lauf festhalten. Steht er erst nach dem Lauf, ist es kein Test, sondern eine Beobachtung.
2. Quelle des Soll-Werts benennen. Zulässig: Beilage B1.4 (Kontrollwerte, siehe `src/criterias/support/criteria.ts`
   `B14_CONTROL`), eine nachvollziehbare Handrechnung (`fixtures/platz-s.md`), eine bestätigte Fachregel
   (B1-Kapitel, FAQ, Fachbestätigung E8/O8). Nicht zulässig: der aktuelle Wert der Anwendung.
3. Sichtbare und persistierte Wirkung getrennt prüfen (Anzeige ≠ Datenbank).
4. Negativfall dazu (fremdes Objekt, fehlendes Recht, fehlende Grundlage) – auch per API.
5. Stub ausweisen: ein Lauf mit gestubbtem ELO/Kartendienst ist kein systemübergreifender Nachweis.
6. Skelette (`fixme`, `todo`) zählen nicht als bestanden.
7. Rundung: Vergleich mit Grenzwerten auf ganze dB (B1.2 10.4), Anzeige eine Dezimale – im Soll beides angeben.

## Beispiel (ausgefüllt, noch nicht gelaufen)

```text
Fachablauf:        1 · Nutzung mit einer Kombination ohne passende Quelle berechnen
Akteur:            A01 Fachspezialist, keine Platzeinschränkung
Anforderung:       B1 7.5 (slm 32), Fachregel O8 (docs/architecture/laermberechnung.md, distribution.ts)
Ausgangslage:      Testplatz S, Zustand Z1 aktuell, Zeitraum 2025 (U5 pist75 50 Schuss, U6 sprengladung 2.5 kg);
                   Z1 hat nur die Quelle Q1 Stgw90.
Aktion:            Details /admin/area/{S}/details, Zeitraum 2025 wählen, Empfangspunkt E1 öffnen;
                   GET /api/admin/area/{S}/calculation/assessment?from=2025-01-01&to=2025-12-31
Erwartetes Ergebnis:
                   E1 state = incomplete («nicht beurteilbar»), missingSources = [pist75 · …, sprengladung · …],
                   keine Ampelfarbe (kein grün, kein orange), counts.incomplete = 1, Übersicht Schiessplätze
                   zeigt für Testplatz S «nicht beurteilbar». Herleitung: O8 – fehlende Quelle darf keine
                   Menge verschwinden lassen; Rest-Lr ist keine Untergrenze (laermberechnung.md).
Tatsächliches Ergebnis:   –
Beleg:                    –
Bewertung:                –
```
