[Documentation index](../../README.md)

# 5.2 Einheitenvertrag (`docs/PHYSICS_UNITS.md`)

Nicht einfach „1 Meter = N Pixel“ behaupten. Für **jede** verwendete API dokumentieren:
- Erwartete Koordinateneinheit für Position, Geschwindigkeit, Beschleunigung, Kraft, Impuls, Drehmoment, Winkel und Winkelgeschwindigkeit.
- Gilt `physics.scale`? Ist die `b2d`-Funktion eine interne World-/Box2D-Einheit oder engine-seitig skaliert?
- Wer konvertiert Eingaben und Rückgabewerte? **Einmalig nur an einer definierten Grenze.**
- Einheit von Camera, GUI, Terrain-Generator, Debug-Zeichnung und Kontaktpunkten.
- Probe: definierter Körper/Gravitation, gemessener Fallweg und Gelenkabstand; Test mit bewusst verändertem Scale-Wert, um Doppelskalierung zu erkennen.
- Winkel: intern Radiant, UI Grad; Speed intern physikalisch konsistent, UI-Einheiten explizit.

**Abnahme:** Konversionsmatrix ausgefüllt, empirische Einheitentests unter Windows und HTML5 (Android frühstmöglich) innerhalb vor Testlauf definierter numerischer Toleranzen; keine doppelte Skalierung.

