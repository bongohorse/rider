[Documentation index](../README.md)

# G4a — Nur fahrzeugkritische Physik

**Ziel:** Alle physikalischen Grundlagen für genau den ersten Buggy.

**Aufbau und Grenze zu G5:** Das G1-Mini-Rig aus Chassis, einem Rad, Wheel Joint und Untergrund weiterverwenden. Nur für den jeweiligen Test notwendige Fixtures ergänzen. Repräsentative Massen, Abmessungen, Geschwindigkeiten und Belastungen des geplanten Buggys dokumentieren; keine allgemeine Realismusanforderung. G4a prüft Motor/Bremse/Reverse, Federung, Kontakt und Terrain an diesem Prüfstand. G5 kombiniert diese nachgewiesenen Funktionen im vollständigen zweirädrigen Fahrzeug mit Steuerung, Kamera und Challenge. Gemeinsame Produktionsmodule weiterverwenden, soweit schon benötigt; keine zweite Fahrzeugarchitektur oder doppelte Physikimplementierung für Tests.

**Arbeit:**
- Rad-Bodenkontakt, Federung, Motor, Bremse, Reverse, Chassis-/Radfilter, Terrain-Geometrie, Sensoren.
- Rampen, Terrain-Nähte, Übergänge mehrerer flacher Segmente und Kontakt-/Bodennormalen mit rollendem Rad prüfen; keine unerklärten Kantenhänger oder Kontaktstöße. Schnelle Kollisionen/CCD nur im für den ersten Buggy vorgesehenen Geschwindigkeitsbereich und mit repräsentativer Masse prüfen. Extreme CCD-/Massematrizen nach G5/G6 verschieben, sofern kein konkreter kritischer Befund sie vorher erforderlich macht.
- 100 definierte Szenario-Resets, Kontakt-/Handle-Validität; High-Speed-Test mit festem Input.
- Zu jeder verwendeten `b2d`-API den Backend-/Plattformstatus bestätigen.

**Gate:** Für alle P0-Mechaniken reproduzierbare Tests mit vorher definierten Toleranzen, keine fehlerhaften Handles oder Instabilitäten in der Testlast. Keine anderen Joint-Labs parallel.

