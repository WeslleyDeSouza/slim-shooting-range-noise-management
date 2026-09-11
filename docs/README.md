# Dokumentation SLIM – Schiesslärmimmissions-Management

Stand der Ablage: 2026-09-11

| Ordner                                        | Inhalt                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------ |
| [`anforderungskatalog/`](anforderungskatalog) | Ausschreibungsbeilagen (A2, B1, B1.4–B1.7); [index.md](anforderungskatalog/index.md) = Lesehilfe, Ampel-Regeln, Berechnungsformeln, Prototyp-Prioritäten |
| [`architecture/`](architecture)               | Sitemap / Modulstruktur, Datenstruktur, i18n                             |
| [`projects/`](projects)                       | Laufende Vorhaben mit eigenem Plan                                       |
| [`userstories/`](userstories)                 | Fachliche Beschreibung der Abläufe                                       |

## architecture

| Datei                                             | Inhalt                                                                                                                |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| [sitemap.md](architecture/sitemap.md)             | **Struktur der Benutzeroberfläche** (Abbildung 18 des Anforderungskatalogs) mit Routen, Angular-Views und API-Modulen |
| [datenstruktur.md](architecture/datenstruktur.md) | Ordnerstruktur von API und App, Modul-Muster (galaxy Auth/Tenant + eigene Module), Facade/SignalStore, Libs           |
| [i18n.md](architecture/i18n.md)                   | Mehrsprachigkeit (de/fr/it/en) nach dem ELO-Muster: Locale-Sektionen, Resolver, Transmart                             |

## projects

| Datei                                         | Inhalt                                                                              |
| --------------------------------------------- | ----------------------------------------------------------------------------------- |
| [prototyp-roadmap.md](projects/prototyp-roadmap.md) | **Roadmap Prototyp**: Abnahmekriterien, Meilensteine M1–M6, Arbeitspakete pro Sprint, Demo-Skript, Nachweis-Matrix slm → Prototyp |
| [design-system.md](projects/design-system.md) | Design System (`libs/app/design-system`): Tokens, Light/Dark, BEM, Styleguide-Seite |

## userstories

Noch leer. Vorlage: `pwa-elo-shot-counting/docs/userstories/admin.md`
(pro Bereich: Base Route, Zweck, Funktionalitäten, Benutzeroberfläche).

## Referenzen

- Mock der Einstiegsseite und der Schiessplatz-Übersicht: [`_mocks/home/index.html`](../_mocks/home/index.html)
- Styling-Regeln für die Entwicklung: [`.claude/styleguide.md`](../.claude/styleguide.md)
- Setup-Wizard (`npm run setup`, `@app-galaxy/setup-api`): Schritte in [`setup/`](../setup), Anleitung zum Schreiben von Schritten in [`setup/SETUP_FOLDER.md`](../setup/SETUP_FOLDER.md)
- Referenzprojekt: `C:\Users\User\Projects\alco\pwa-elo-shot-counting` (ELO Schusszahlmeldung)
