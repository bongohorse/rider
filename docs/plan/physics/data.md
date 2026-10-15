[Documentation index](../../README.md)

# 5.6 Datenschema und Reproduzierbarkeit (`docs/DATA_CONTRACT.md`)

Jedes Szenario/Replay beinhaltet mindestens:
- `schema_version`, `scenario_id`, `scenario_version`, `seed` (sofern RNG genutzt), Plattform, Build-SHA, Defold-/Box2D-Version;
- kanonisch serialisierte Konfiguration und **Konfigurationshash**;
- Steuerbefehle mit **Physics-Tick-Index**, nicht nur Zeitpunkt;
- wichtige Zustände/Messpunkte + Toleranzen und `input_policy`;
- Resultat/Fehlertext, Artefaktpfade, Test-ID.

Ungültige Daten (NaN/Inf, fehlende Pflichtfelder, falsche Version, out-of-range, beschädigter Speicherstand) müssen mit verständlichem Fehler oder definiertem Default/Fallback behandelt werden; keine silent corruption. Plattformübergreifende Vergleiche zunächst toleranzbasiert, nicht bitgenau.
