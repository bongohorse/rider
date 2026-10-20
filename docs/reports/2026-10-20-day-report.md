# Rider Tagesbericht (20.10.2026, Tagesabschluss)

> Report for Claudio, kept in its original German. It records what happened; it is not an agent rule. Binding rules stay in [AGENTS.md](../../AGENTS.md), [PLAN.md](../PLAN.md) and [STATUS.md](../../STATUS.md).

**Contents:** [Kurzfassung](#kurzfassung) · [Seit dem letzten Bericht gemergt](#seit-dem-letzten-bericht-gemergt) · [Preset F](#preset-f-neutrale-flüge) · [Was gut lief](#was-gut-lief) · [Was schlecht lief](#was-schlecht-lief) · [Fahrprobe](#fahrprobe-ca-40-minuten) · [Delegation heute](#delegation-heute)

## Kurzfassung

M4, M5 und der Level Editor (LE1–LE6) sind technisch fertig, gemergt und deployt. Dazu kamen vier Kandidaten-Presets, sichtbare Federbeine und eine deutlich robustere CI. Beim Stopp: kein offener PR, kein laufender CI-Lauf, kein aktiver Agent. Editor A ist bewusst nicht gestartet.

- 34 PRs gemergt am 20.10.
- 3 Meilensteine technisch fertig (M4, M5, Level Editor).
- main war einmal rot (Zeitrennen in einem neuen Test, in etwa einer Stunde behoben).
- Vorschau zum Stopp: `e49e90b`; main: `d876efa` (Doku-Merges deployen nicht neu).

## Seit dem letzten Bericht gemergt

| Bereich | PR | Merge | Kern |
| --- | --- | --- | --- |
| M5 / A22 | #216 | `b3853f0` | Regressionstests aus drei Preset-A-Fahrten, Toleranzen eingefroren, Neuaufnahme in CI gesperrt |
| LE6a | #218 | `4684f9b` | Warnungen springen zur Quelle, Fit/Centre/START/Last test, Grenzen, blätterbare Vorlagen |
| LE6b | #225 | `f7d33a0` | Label-Werkzeug [L], Hilfe [H], Fahrzeug-Silhouette, einheitliche Anzeigen |
| Preset F | #213 | `7320c57` | D + Dämpfung nur im neutralen Flug; letzter Kandidat |
| Wippe | #220, #229 | `ba84538`, `bdc416b` | Reset kanonisch (Box2D-Schlaf-Timer), Test misst pro Tick |
| Engine-Absicherung | #214, #219 | `1a1eb2b`, `e7c3017` | Cache-Hygiene; Box2D-v3-Prüfung auch für die Engine, die Spieler laden |
| CI-Stabilität | #223, #222, #226, #231, #232 | `5fb3d6a`, `e965f52`, `0aa1544`, `2d3dac6`, `e49e90b` | Testserver-Reset, le6-Rennen, verlorene Klicks (gemeinsamer Frame-Helfer) |
| STATUS | #234 | `d876efa` | Alles dokumentiert, Claudios Entscheidungen eingetragen |

Außerdem: #95 geschlossen (geplanter Nightly auf neuer Matrix grün), 98 gemergte Remote-Branches gelöscht, zwei alte Worktrees entfernt, Bumps-Abnahme eingetragen.

## Preset F: neutrale Flüge

| Air, ohne Lehnen | A | D | F |
| --- | --- | --- | --- |
| big | Crash −151° | Crash −178° | gelandet −58° |
| mid | Crash −113° | gelandet −127° | gelandet −54° |
| flat | Crash −133° | gelandet −130° | gelandet −54° |
| low | Crash −88° | Crash −93° | gelandet −47° |

Volles Lehnen ist bei F wie bei D (±0,5°). Andere Stationen fast unverändert gegenüber D, bei 7 m/s 1 m mehr Lücke. A bleibt an allen Stationen bit-gleich. Synthetische Desktop-Läufe. Vollständige Vergleichstabelle A–E: [Preset-Vergleich](2026-10-20-presets-compare.md).

## Was gut lief

- **Prioritäten umgesetzt.** Nach Claudios Ansage zuerst M4/M5, dann Editor, Auto-Varianten zurückgestellt; die Merge-Reihenfolge wurde entsprechend umgestellt.
- **Reviews fanden echte Fehler**, u. a.: Warnliste schluckte Klicks im Datei-Dialog, die Hilfe-Taste veränderte eine halbe Linie, eine Validierung hätte gespeicherte Level unöffenbar gemacht.
- **Ursachen statt Neustarts.** Wackelnde Tests bis zur Ursache verfolgt: Keep-Alive-Rennen des Testservers, verlorene Klick-Flanken, Box2D-Schlaf-Timer.
- **Agenten fanden Wechselwirkungen selbst.** Preset F hätte die A22-Spuren gebrochen; das wurde vor dem Merge bemerkt und gelöst.
- **Sauberer Abschluss.** Kein offener PR, keine verwaisten Prozesse, Worktrees und Branches aufgeräumt.

## Was schlecht lief

- **Main einmal rot.** Ein neuer LE6-Test hatte ein Zeitrennen, das in drei PR-Läufen nicht auftrat. Fix in etwa einer Stunde, Merges solange angehalten.
- **Viele wackelnde Tests.** Steps zweimal, a21, le2 und einmal le5c. Die Fixes kosteten einen großen Teil des Tages.
- **Wartezeiten.** Agenten standen mehrfach, weil sie auf Plan-Freigabe oder Merge-Platz warteten.
- **Regeln nicht immer befolgt.** Agenten haben trotz Ein-Schreiber-Regel STATUS bearbeitet; die Reviews haben das zurückgedreht.
- **CI-Werkzeug.** „Fehlgeschlagene Jobs neu starten“ funktioniert nicht (Artefakte pro Versuch); nur „alle Jobs“ hilft.

## Fahrprobe (ca. 40 Minuten)

Vorschau: https://bongohorse.github.io/rider/ — Desktop mit Maus und Tastatur.

1. **Presets (10 min):** P durch A → B → C → D → E → F. `?station=air` „big“: A, D und F ohne und mit Lehnen. Fühlt sich F natürlich oder „unterstützt“ an? Dann eine Lücke und ein Gefälle ohne Gas mit E.
2. **Federbeine (1 min):** gut lesbar? Abschalten im Tuning-Panel oder mit `?struts=0`.
3. **M4-Stationen (8 min):** `?station=air`, `?station=balance` (Balken langsam, Wippe). Bumps ist bereits abgenommen.
4. **Pause und Replay (4 min):** Leertaste, X für Zeitlupe; B aufnehmen, P wechseln, G abspielen.
5. **Editor LE5b–LE5d (6 min):** Bump/wave und Curve-Tal; Dreieck glätten und eckig machen; Punkte per Rahmen wählen, Make smooth; Bump/wave umwandeln (5 Punkte).
6. **LE6-Abnahme (10 min):** Kurs mit Prefabs und Kurven bauen, Label setzen (auch mit Umlauten), verbundene Rampe ändern, Passage kopieren und spiegeln, von später testen, Undo/Redo, Export/Import, neu laden. Dazu: Warnung anklicken, Home, Hilfe mit H.

Entscheidungen für Claudio:

- Welches Preset wird Standard-Kandidat: A, D, E oder F?
- Abnahme M4, M5 und LE6 (#129)?
- GO für Editor A (A1a #183 zuerst)?

Bewusst offen: #233 (einmaliger le5c-Doppelklick-Ausreißer, nur beobachtet), #112 (Firewall-Tests, laut Claudio nein), #101 (npm), Car-Editor-Epic #198, Editor A–C.

## Delegation heute

Bis zu sechs Agenten gleichzeitig, jeder mit eigenem Worktree. Jeder PR bekam ein unabhängiges read-only Review; Design-Gates vor riskanter Arbeit (Wippe, Pause, Replay, LE5d, LE6, A22). Insgesamt über 30 Review- und Analyse-Agenten neben den schreibenden Agenten.

Wichtigste Lehre: Je mehr parallel gemergt wird, desto mehr tragen stabile Tests. Der Klick-Helfer und die Testserver-Wiederholung sollten künftige Läufe deutlich ruhiger machen; neue Tests sollten von Anfang an frame-basiert warten.
