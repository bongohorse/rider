[Documentation index](../README.md)

# 2. Verbindliche Grundregeln

1. **Engine:** Defold, mit ausdrücklich aktiviertem **integriertem Box2D Version 3**. Kein stiller Legacy-Fallback. Version erst nach Kompatibilitätsnachweis festschreiben.
2. **Physik-Ownership:** Defold besitzt die Engine-Physikwelt. Keine selbst erfundenen parallelen World-Step-Schleifen, **kein doppelter World-Step** und keine zweite Physics Engine.
3. **Sprache:** Lua für Gameplay/Sandbox. Keine eigene C/C++-Physik-Bridge.
4. **Entkopplung:** UI/Input → normalisierte Commands → Gameplay/Vehicle → Physics Adapter; Physikzustand → Visualisierung. Darstellung schreibt nicht in die Physik.
5. **Mobil zuerst:** Touch, Resize, Hintergrund-/Vordergrund-Wechsel und echtes Android-Gerät früh prüfen.
6. **AI:** GitHub/CLI/Defold-Zugriffe müssen tatsächlich vorhanden sein. MCP darf die Fähigkeit erweitern, aber niemals die einzige Build-/Testmöglichkeit sein.
7. **Sicherheit:** Editor-/Runtime-HTTP lokal; keine ungeschützten Release-Endpoints oder Secrets. Debug-Werkzeuge im Release nachweislich nicht enthalten.
8. **Gates:** Kein Weiterarbeiten, Merge oder Deployment ohne dazu passende ausdrückliche Freigabe; nach jeder Phase STOP.
9. **Wahrheit vor grünen Checks:** Keine künstlichen Tests, Screenshots, Logs oder nicht ausgeführten Builds behaupten. `NOT RUN`, `BLOCKED`, `FAIL`, `PASS` strikt unterscheiden.
10. **Änderungen klein halten:** Jede Architekturentscheidung mit konkretem Testfall und minimalem Diff belegen.

---

