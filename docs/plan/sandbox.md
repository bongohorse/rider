[Documentation index](../README.md)

# 6. Sandbox-MVP statt übergroßer Testumgebung

Die Sandbox wird **zunächst minimal** aufgebaut:
- **Zwei bis drei** Szenarien statt zehn Physik-Labs; einfaches Body-Lab, Wheel-Joint-Lab, Terrain-Rampe.
- Szenariowechsel, Reset, Pause, Kamera, Parameterview mit wenigen essenziellen Reglern.
- Renderer: primitives, gut unterscheidbares Debug-2D, keine Produktionssprites.
- Separate Schnittstelle `create(config)`, `reset(seed)`, `configure(parameters)`, `inspect()`, `destroy()`. Asynchrone Operationen melden Abschluss/Fehler eindeutig. Eine optionale Debug-Aktion `request_single_tick()` steuert ausschließlich den in G3 nachgewiesenen Engine-Mechanismus; sie ist keine eigene World-Step-Schleife.
- Nach jedem Szenariowechsel Owner-/Cleanup-Test.
- `Scenario Registry` als kleiner Datenkatalog, ohne spekulatives Pluginframework.
- Parameter-Panels erst bei echtem Einstellbedarf, optional Druid nach API-/Lizenz-Check.
- Keine ausgefeilte Editoroberfläche vor der ersten spielbaren Challenge.

**Sandbox ist dauerhaftes Entwicklerwerkzeug, nicht Wegwerfcode.** Sie muss aber nicht alle zukünftigen Features zu Beginn enthalten.

---
