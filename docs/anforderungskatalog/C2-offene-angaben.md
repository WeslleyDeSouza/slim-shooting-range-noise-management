# C2 – offene Angaben vor Abgabe

Arbeitsliste zum Lösungskonzept, Stand 21.09.2026. Kein Bestandteil der Anforderungsmatrix und kein Erfüllungsnachweis. Die folgenden Angaben können nicht aus dem Prototyp abgeleitet werden; sie bleiben bis zur Entscheidung bzw. zum Beleg offen.

| Stelle | Fehlende Angabe / nötiger Nachweis |
| --- | --- |
| Deckblatt | Einreichende Firma, verantwortliche Person und Funktion; Angaben stehen bisher nur im Markdown-Kommentar und erscheinen deshalb nicht in der erzeugten Word-Datei. |
| Zusammenfassung / 3.1 | Verhältnis der einreichenden Firma zu ELO und belegbare Erfahrung des Projektteams; beide Textstellen konsistent finalisieren. |
| 2.2 | Rechtekette und Abtretung der galaxy-Komponenten, endgültiger Lizenztext und OSS-Entscheid. |
| 2.5 | Hostinganbieter und Vertragspartner sowie Nachweise zum Schweizer Betrieb. Vollständige Systemsicherung und Restore-Verfahren sind beschrieben, ihre betriebliche Umsetzung ist noch nachzuweisen. |
| 5.2 | Nachvollziehbare Aufwandsschätzung für zusätzliche Kartenlayer unter LP5 gemäss FAQ 13. |
| 5.4 | Beauftragtes Büro für die italienische Fachübersetzung. |
| 6.3 Support | Standort des 3rd-Level-Supports; konkrete Besetzung, Stellvertretung, Bereitschaft und Eskalation. Fristbeginn gemäss FAQ 115 bei Eingang innerhalb der Supportzeit, sonst mit der nächsten Erreichbarkeit; ab diesem Zeitpunkt laufen die 4/24/48-Stunden-Fristen kalendarisch weiter. |
| 6.3 Datenhaltung | Dienste und Anbieter der gesamten Entwicklungs- und Betriebskette, Schweizer Verarbeitungs-/Speicherstandorte, Datenflüsse und Nachweise; nötige Umstellungen bestehender Prototyp-Werkzeuge ausweisen. |
| 6.4 | Schulungsannahmen mit Preisblatt LP3 abgleichen. |
| 6.5 FGDB | Vor Abgabe Lese-/Schreibprobe mit verfügbaren Referenzdaten und dokumentierten Grenzen; endgültiges Schema gemäss FAQ 99 erst im Projekt festlegen und danach vollständig prüfen. Gegebenenfalls Konvertierungswerkzeug, Lizenzen, Betrieb und Aufwand auf Anbieterseite konkretisieren. |
| 6.5 Demo | Tatsächliche URL, freigegebene Zugangsinformationen in der Begleitnotiz, Freeze-Datum und Softwareversion. |
| 4.3 / slm 33 | A7X-Referenzvariante im Anwendungsservice umsetzen und nachweisen. Abweichende Regel nur mit dokumentiertem Fachentscheid; der aktuelle E8-Standard ist kein vollständiger Erfüllungsnachweis. |
| Matrix / Tests | P bezeichnet den beschriebenen Umsetzungsstand, keine Abnahme. T kennzeichnet Teilumsetzungen oder fehlende wesentliche Nachweise, Z ausstehende Umsetzung. Abnahmeprotokolle müssen die tatsächlich ausgeführten Tests und offenen Befunde ausweisen. |

## Stand der FAQ-Grundlage

Der FAQ-Export (`FAQ-Export.md`) ist am 02.10.2026 aus dem PDF-Export des Forums nachgeführt (`docs/FAQ_Schiesslärmimmissionsmanagement_01_10_2026.pdf`): 182 Fragen, 167 beantwortet, 15 offen (53, 61–63, 126, 145–152, 154, 169), Antworten im Wortlaut, letzte Antwort vom 23.09.2026. Die zuvor nur im Review mitgeteilten Präzisierungen sind damit belegt: FAQ 93 (platzweite Angebotsbasis, getrennte Anlagenberechnungen LP5), FAQ 99 (endgültiges FGDB-Schema erst im Projekt), FAQ 113 (Hyperscaler nur bei ausschliesslicher Bearbeitung in der Schweiz), FAQ 115 (Fristbeginn bei Eingang innerhalb der Erreichbarkeit, sonst mit der nächsten Erreichbarkeit; danach kalendarischer Lauf), FAQ 116 (konsistenter Gesamtzustand über alle Komponenten), FAQ 117 (Simulation als Option LP1b), FAQ 121 (FGDB als Basis) und FAQ 128 (Verweis auf FAQ 9).

Noch nicht ins Lösungskonzept eingearbeitet:

| FAQ | Stelle | Inhalt der Antwort |
| --- | --- | --- |
| 37, 70 | 6.4 | Unterlagen auf Deutsch; Schulung bei Bedarf auch auf Französisch oder Italienisch, vor Ort (Bern und weitere Standorte), rund ein halber Tag, 2–3 Personen je Schulung. |
| 52 | 5.1, Matrix slm 17 | Pflegefunktion im UI entfällt; 5.17 ist Anzeige, Pflege über Import bzw. DB-Administration; Rechtematrix 8.1.2 für 5.17 von R/W auf R. |
| 97, 138, 170 | 2.2, Risikotabelle 6.5 | Vorbestehende Komponenten bleiben bei der Entwicklerin; Nutzungsrecht nach Art. 6.2.4, Quellcode-Lieferung (Art. 2.9.1), Deklaration in der SBOM; im Projekt erstellte Erweiterungen sind Arbeitsergebnisse der Bestellerin. |
| 121, 176 | 2.2, 3.2 | FGDB bleibt Angebotsbasis; Import/Export über eine klar abgegrenzte Verarbeitungsschicht, damit ein Wechsel auf GeoPackage/INTERLIS mit vertretbarem Aufwand möglich ist (Change LP5). |
| 142 | 5.4, Summary | Basislösung für Desktop und Tablet (mindestens 1600 × 1200); Smartphone nur für die mobile Erfassungsmaske mit QR-Zugriff (LP1b). |
| 157, 158, 160, 163, 172 | 6.3 | Entwickelter Code muss in der Schweiz gehostet sein; Entwicklungs-, Betriebs- und KI-Werkzeuge ausserhalb der Schweiz sind zulässig, solange sie keine produktiven oder realen fachlichen Daten bzw. schützenswerten Projektinformationen verarbeiten; Nachweis im Umsetzungskonzept zu E1. |
| 165 | 4.2 | Betriebsdaten Anhang 9 in B1 sind «Schuss militärisch innerhalb/ausserhalb Werktag»; ob zivile Nutzungen einfliessen, wird zu Beginn der Realisierung mit KOMZ Lärm geklärt. |
| 32 | 4.4 | 10 bis über 1000 Empfangspunkte je Schiessplatz, FGDB wenige MB, rund 20 neue FGDB pro Jahr. |

## Abschliessende Dokumentprüfung

Nach Finalisierung aller Angaben Word erneut erzeugen, tatsächliche Seitenzahl und Diagrammlesbarkeit in Word/PDF prüfen. Die mit `--pages` erzeugte Vorschau ersetzt derzeit Bilder durch Flächen und ist kein visueller Nachweis der Diagrammlesbarkeit oder der exakten Word-Paginierung. Seitenbudget: Lösungskonzept maximal 15 A4-Seiten, Anforderungsmatrix maximal zwei A4-Seiten gemäss FAQ 8.
