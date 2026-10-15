[Documentation index](../../README.md)

# 5.3 Lifecycle-/Tick-Vertrag (`docs/PHYSICS_LIFECYCLE.md`)

**Ausgangskonfiguration:** 60 Hz Fixed Timestep, also 1/60 s pro Physiktick. Vier Solver-Substeps sind der zu verifizierende Startwert. Defold dokumentiert dafür die Box2D-3-Einstellung `Sub Step Count`; konkrete Konfiguration und Wirkung werden gegen den gewählten Build geprüft. Substeps sind keine zusätzlichen Gameplay-Ticks. Legacy-Iterationswerte und das als 3D-spezifisch dokumentierte `Max Fixed Timesteps` dürfen nicht als gleichwertige 2D-Catch-up-Steuerung verwendet werden. G1 konfiguriert ausdrücklich `physics.use_fixed_timestep = true` und `engine.fixed_update_frequency = 60`; Schlüssel und effektive Werte werden am gewählten Engine-Build verifiziert. G1 weist Konfiguration und Wirkung anhand der gewählten Engine nach. Gezählt werden Fixed-Update-Callbacks und messbarer Physikfortschritt; Callback-Anzahl allein beweist weder interne World-Steps noch Solver-Substeps. Vier Substeps über effektive Konfiguration und einen geeigneten versionsbezogenen Nachweis belegen, keine vier Lua-Callbacks erwarten. Renderfrequenz, Physikticks und Solver-Substeps getrennt messen. Ein 30-FPS-Renderfallback ändert die 60-Hz-Physikbasis nicht. Eine spätere Änderung der Physikbasis verlangt einen dokumentierten Vergleich und Freigabe.

Konzeptionell: **Input erfassen → pro Tick normalisieren und anwenden → Defold simulieren lassen → nachweislich verfügbarer Zustand/Kontaktinformationen auswerten → für Darstellung interpolieren, falls nötig.**

Wichtig: Exakte Callback-Reihenfolge von Defold in der gewählten Version **messen und belegen**. Nicht annehmen, dass `fixed_update` vor/nach dem Engine-Step liegt, ohne dies zu prüfen. Inputs und Forces müssen an der jeweils richtigen, dokumentierten Stelle angewandt werden; Simulation ausschließlich von Defold. Ein Wechsel zu manueller World-Steuerung wäre eine gesondert freizugebende Architekturänderung und ist nicht durch einen erfolgreichen API-Aufruf autorisiert.

Bei Kollisionen/Kontaktevents keine nicht unterstützte Body-/Joint-Erzeugung oder -Zerstörung innerhalb eines gesperrten Physics-Schritts. Stattdessen einen **Deferred Mutation Queue**-Vertrag prüfen/implementieren: mutierende Operationen für ein sicheres Zeitfenster vormerken; Reihenfolge, Fehler und Rückgabehandles definieren.

Bei Framedrops/Background:
- Kein ungeprüftes unbegrenztes Nachholen von Physikticks.
- Delta-/Catch-up-Verhalten des Engine-Systems messen.
- Bei längerer Inaktivität Inputs freigeben, Session pausieren/sicher weiterführen.
- Keine erzwungenen extra Steps, die vom Engine-Lifecycle abweichen.

