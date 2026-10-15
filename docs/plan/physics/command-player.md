[Documentation index](../../README.md)

# 5.6a Minimaler Test-Command-Player

Spätestens G5 steht ein kleiner Testadapter bereit, der Commands erneut ausführt und Zustände prüft. G4a nutzt ihn nur, soweit für die dortigen Testeingaben nötig. Kein separates Replay-Produkt bauen.

- Kanonische Startkonfiguration, Body-Erzeugungsreihenfolge, Startpositionen/-geschwindigkeiten und definierter erster aktiver Command-Tick festhalten.
- Tick 0 erst nach bestätigter Initialisierung/READY definieren; kein unbeabsichtigter Vorlauf vor der Messung.
- Pro Tick genau einen normalisierten Command durch denselben Vehicle-Command-Pfad wie beim Spielen anwenden. Live-Eingaben während des Testlaufs ausschließen; keine direkte Pose-Manipulation als Ersatz für Steuerung.
- Policy für nicht belegte Ticks, doppelte oder ungeordnete Commands ausdrücklich definieren. Ungültige Traces ablehnen; keine implizite, wechselnde Hold-Policy.
- Vorab festgelegte Messpunkte, Ergebnisbedingungen und Toleranzen vergleichen. Dieselbe Trace mehrfach aus vollständig zurückgesetztem Zustand prüfen. Zusätzlich dieselben Tick-Commands unter mindestens zwei tatsächlich gemessenen Renderfrequenzbedingungen (z.B. 30 und 60 FPS) vergleichen, ohne die 60-Hz-Physikbasis zu ändern. Renderframes sind keine Command-Indizes. Frame-Stalls/Überlastung, Pause und gegebenenfalls verworfene Simulationszeit separat protokollieren; Ergebnisse nur bei vergleichbarem Ablauf nach gleichem Physiktick bewerten. Ein Slowdown darf durch toleranzbasierten Zustandsvergleich nicht verborgen werden.
- Erfolgs- und absichtlich ungeeignete Trace müssen jeweils ihr erwartetes Ergebnis bestätigen. Erwartetes Scheitern einer Challenge ist ein bestandener Negativtest, kein technischer Suite-Fehler.
- Test-Playback, Gameplay-Replay und visuelle Ghosts getrennt behandeln. Nur Test-Playback ist frühe Pflicht; keine Replay-UI oder allgemeine Ghost-Infrastruktur.
