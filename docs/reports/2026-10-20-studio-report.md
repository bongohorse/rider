# Rider Studio-Bericht (20.10.2026, Abend und Nacht)

> Report for Claudio, kept in its original German. It records what happened; it is not an agent rule. Binding rules stay in [AGENTS.md](../../AGENTS.md), [PLAN.md](../PLAN.md) and [STATUS.md](../../STATUS.md).

**Contents:** [Kurzfassung](#kurzfassung) · [Ergebnisse](#ergebnisse) · [Was gut lief](#was-gut-lief) · [Was schlecht lief](#was-schlecht-lief) · [Delegation mehrerer Agenten](#delegation-mehrerer-agenten) · [Verbesserter Workflow](#verbesserter-workflow-rider-als-agenten-studio) · [Ergebnis der Nacht](#ergebnis-der-nacht) · [Fahrprobe](#fahrprobe-ca-30-minuten)

## Kurzfassung

An einem Abend liefen ein Editor-Track und vier M4-Aufgaben gleichzeitig, koordiniert von einer Director-Session. Danach arbeitete ein Agenten-Team über Nacht selbstständig weiter. Jeder Merge wurde gegen Main-Run und `build.json` geprüft; Belege stehen in den PRs, Issues und CI-Runs.

## Ergebnisse

| Aufgabe | PR | Merge | Kern |
| --- | --- | --- | --- |
| LE5c Corner/Smooth | #187 | `1b6815d` | Eck- und Glattpunkte, Prefab → Pfad |
| Agenten-Regeln | #189 | `85155f2` | Ein schreibender Agent pro Aufgabe statt pro Track |
| bob.jar-Quelle | #191 | `7d8b048` | Defold-Archiv-URL, gleicher Hash; CI lud frisch |
| A20 Pause/Zeitlupe | #193 | `7f65dfa` | Space/X, Messungen nur bei 1/60 s |
| LE5d Mehrfachauswahl | #196 | `cc0998f` | Punkte/Objekte glätten; Wave 65 → 5 Punkte |
| Car-Editor (Epic) | #198 | – | Backlog: Fahrzeugformat zuerst, dann Part-Swap-Editor |

Außerdem: 12 Nicht-Editor-Issues aufgeräumt (nichts geschlossen), Parcours aus A20 gestrichen, #114 geparkt.

## Was gut lief

- **Durchsatz.** Vier Stationen, ein Editor-Task und Infrastruktur-Fixes liefen gleichzeitig, jeder Merge mit Review und grüner CI.
- **Unabhängige Reviews fanden echte Fehler**, z. B. eine veraltete Bestätigung bei Pause (#193), übersehene Kantensprünge (#197), eine zu schwache Wippen-Prüfung (#195).
- **Design vor Code** bei riskanten Aufgaben (Wippe, Pause, Replay, LE5d): keine musste umgebaut werden.
- **bob.jar-Anomalie** bemerkt, read-only untersucht (offizieller Rebuild, keine Manipulation) und behoben, bevor die CI daran brach.
- **Agenten korrigierten den Director**, z. B. beim Stopp nach #55.
- **Board + Brief** als gemeinsame Quelle für Besitz, Regeln und Merge-Reihenfolge.

## Was schlecht lief

- **Regelkonflikt blockierte den Start**, bis #189 die Regel „ein Agent pro Track“ änderte.
- **Gemeinsame Listen als Konfliktherd** (g1.yml, smoke.py, Inventar-Test, Fallisten, feste Vorlagenzahl): jede Station musste rebasen.
- **Build-Sperre zu streng**, erst spät auf mehrere Slots umgestellt.
- **Nachrichten kreuzten sich**, z. B. eine Merge-Freigabe nach dem Abschlussbericht eines Agenten.
- **Behauptungen über Tests**: Ergebnisse standen wie Testergebnisse im PR, ohne geprüft zu werden; die Reviews fingen das.
- **STATUS hinkte hinterher**, weil niemand fest dafür zuständig war.
- **Benachrichtigungs-Rauschen** durch viele „wartet auf Hintergrundjob“-Meldungen.

## Delegation mehrerer Agenten

| Art | Agenten | Erfahrung |
| --- | --- | --- |
| Bestehende Claude-Sessions | rider-d2 (LE5c), rider-24 (A19b), rider-de | Per Nachricht erreichbar, aber mit eigenem Nutzerkontext; Übergabe per Notizen klappte |
| Eigene Umsetzungs-Agenten | rider-air, rider-balance, rider-pause, rider-editor, rider-replay, rider-toolchain u. a. | Gut steuerbar: klare Briefs, eigene Worktrees, Design-Gate, Merge-Slots |
| Read-only Spezialisten | rider-triage, rider-bobcheck, Reviewer | Schnell und ergiebig; jedes Review fand mindestens einen echten Punkt |
| Nicht erreichbar | Codex (nur Daemon aktiv) | Kein Kanal vorhanden |

Wichtigste Lehre: Die Engpässe waren nicht die Agenten, sondern geteilte Dateien, Repo-Regeln, die der Praxis hinterherliefen, und fehlende feste Zuständigkeit für STATUS.

## Verbesserter Workflow: Rider als Agenten-Studio

Rollen:

- **Producer** (Director-Session): plant, vergibt Besitz, hält die Merge-Queue, schreibt STATUS als Einziger, sammelt die Fahrprobe-Liste.
- **Game Designer**: Feel-Ziele mit Messgröße, Issues mit 1–3 prüfbaren Kriterien.
- **Tech Lead Fahrzeug**: Architektur, Physik-Verträge, Design-Gate vor riskantem Code.
- **Programmierer**: 1 Aufgabe = 1 Worktree = 1 PR; messen statt behaupten.
- **QA & Messung**: Preset-Vergleiche, Regression, CI-Gesundheit, Testliste.
- **Art & Juice**: sichtbares Feedback ohne Physik zu berühren.

Ablauf einer Iteration: Kickoff → Planung (Issues + Besitz) → Design-Gate → Umsetzung im eigenen Worktree → CI grün → unabhängiges Review → Fixes + Resolution-Kommentar → Merge-Slot → Deploy prüfen, QA misst → Fahrprobe-Liste → nächster Kickoff.

Regeln aus diesem Abend:

1. Ein Manifest statt vieler Listen (CI-Gruppen, Inventar, Fallisten aus einer Datei; Vorlagenzahl aus `stations.ids` ableiten).
2. STATUS hat einen Schreiber (Producer, Sammel-PR pro Runde).
3. „Gemessen“ und „geprüft“ trennen.
4. Merge-Queue nach Bereitschaft; der Producer sagt die Rebase-Reihenfolge an.
5. Mehrere Build-Slots über `buildslot.sh`.
6. Regeln zuerst anpassen, wenn sich die Arbeitsweise ändert.
7. Kurze Berichte mit fester Form (Design, PR offen, review-ready, Merge-Wunsch, fertig, Blocker).

## Ergebnis der Nacht

| Arbeit | PR | Merge | Kern |
| --- | --- | --- | --- |
| A19b Bumps | #194 | `77c65cf` | Wellenleiter, Kamm/Tal, Abhebetempo |
| A19c Air | #197 | `ce81963` | Flugzeit, Rotation, Landewinkel |
| A19d Balance | #195, #206 | `085a8ba` | Balken und Wippe; Runner auch für andere Presets |
| A21 Replay | #202 | `850b2c9` | B aufnehmen, P Preset, G abspielen mit Geist |
| Presets D/E | #203 | `f00c29a` | Registry, A/B/C per SHA geschützt |
| Federbeine | #205 | `d9f8e97` | Sichtbare Federung, abschaltbar |
| Preset-Vergleich | #207 | `a594495` | Tabelle A gegen B–E über alle Stationen |
| Engine-Guard | #210 | `05958a0` | Kein stiller Engine-Tausch mehr möglich |
| STATUS | #212 | `31e8d6a` | M4 und Nacht dokumentiert |

Kandidaten-Presets (A bleibt unverändert):

| Messung | A | D „snappy“ | E „planted“ |
| --- | --- | --- | --- |
| Kick-Rampe / lange Rampe | 45° / 35° | 60° / 45° | 35° / 35° |
| Lücke bei 7 / 9 m/s | 3 / 4 m | 4 / 5 m | 3 / 4 m |
| 10°-Gefälle ohne Gas | +1,17 m/s | +1,16 m/s | −1,04 m/s |
| Ausrollen aus 5 m/s | 11,5 m | 11,5 m | 6,4 m |
| Air, Rotation neutral / hinten / vorn | −151 / +422 / −639° | −178 / +720 / −846° | −148 / +391 / −589° |
| Air, gelandet von 12 | 2 | 6 | 5 |

Wichtige Befunde:

- **Nase nach unten:** Ohne Lehnen kippt der Buggy nach jedem Sprung vorn über (Hinterrad-Gelenk an der scharfen Kante, keine Dämpfung in der Luft). Daraus entstand Preset F.
- **Falsche Engine im Build:** Bob verpackte einmal still Defolds Standard-Engine mit Box2D v2; G1 hat es gefangen, der Guard (#210) verhindert es jetzt für alle Builds.

## Fahrprobe (ca. 30 Minuten)

Vorschau: https://bongohorse.github.io/rider/ — Desktop, Tastatur.

1. **Presets (8 min):** P durch A–E; `?station=air` „big“ mit A, D und E; eine Lücke und ein Gefälle ohne Gas.
2. **Federbeine (1 min):** lesbar? Abschalten im Tuning-Panel oder mit `?struts=0`.
3. **Neue Stationen (10 min):** `?station=bumps`, `?station=air`, `?station=balance`.
4. **Pause und Replay (4 min):** Leertaste, X; B aufnehmen, P wechseln, G abspielen.
5. **Editor LE5b/c/d (8 min):** Bump/wave und Curve-Tal; Spitze glätten und eckig machen; Punkte per Rahmen wählen, Make smooth; Bump/wave umwandeln.

Die Fortsetzung steht im [Tagesbericht](2026-10-20-day-report.md).
