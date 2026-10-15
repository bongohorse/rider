[Documentation index](../../README.md)

# 5.5 Debug-Funktionen und Live-Tuning

- **Pause/Resume:** Muss dem tatsächlichen Engine-Lifecycle entsprechen; keine verborgene World-Simulation.
- **Single-Step:** Eigener G3-PoC. Erfolgreich nur, wenn **genau ein Physiktick** nachweisbar stattfindet. Wenn unsupported, UI nicht vortäuschen; `BLOCKED`/`DEFERRED` mit Alternativen.
- **Slow Motion:** Nur mit belegter Zeitsteuerung; definierte Auswirkung auf Rendering/Physics dokumentieren.
- **Live-Tuning:** Für jeden Parameter: `LIVE`, `NEXT_RESET` oder `REBUILD`. Änderungen werden validiert (finite Zahl, erlaubter Bereich, Einheit), versioniert und an einer definierten Tickgrenze atomar angewandt. Kein Versprechen, jede Motor-/Kollisionsgeometrie live ändern zu können.
