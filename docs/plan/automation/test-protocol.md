[Documentation index](../../README.md)

# 8.2a G1-Protokoll zwischen Engine und Runner

Bereits G1 erhält ein kleines strukturiertes Protokoll. Zeilenweise JSON mit eindeutigem Präfix ist ein geeigneter Transport; native Prozesslogs und HTML5-Browserkonsole können denselben Ereignisvertrag tragen. Der gewählte Transport wird praktisch nachgewiesen. Dies ist eine Projektkonvention, keine behauptete eingebaute Engine-Test-API.

1. Der externe Runner erzeugt eine einmalige Run-ID, startet den Prozess/die Seite mit frischem Logkontext und übergibt die ID über einen dokumentierten unterstützten Weg.
2. `suite_start` enthält Protokollversion, Run-ID, Suite-ID, Build-/Konfigurationsidentität und erwartete Test-IDs/Anzahl.
3. `case` enthält Run-ID, eindeutige Test-ID, Status, Assertionsergebnis, Messwerte und Fehlerdetails.
4. Genau ein `suite_end` bestätigt Run-ID, abgeschlossene Testanzahl und Summen. Der Runner gleicht diese gegen das vorher festgelegte Pflichtinventar ab.
5. Erfolg nur bei vollständigen bestandenen Pflichtfällen, konsistentem Abschluss und ohne Crash-/Laufzeitfehler. Fehlender Abschluss, Timeout, unerwarteter Prozessabbruch, doppelte Pflichtresultate oder widersprüchliche Ereignisse bedeuten FAIL/unvollständig.
6. Fremde oder veraltete Run-IDs dürfen keinen Erfolg erzeugen; sie werden ignoriert und diagnostiziert. Ein zweiter Abschluss derselben Suite ist ein Protokollfehler.
7. Keine feste Wartezeit als Abschlussnachweis. Nach bestätigtem Abschluss beendet der Runner Prozess/Seite kontrolliert, sofern diese nicht selbst terminieren. Ein fehlendes Completion-Event wird durch Exitcode 0 nicht geheilt.

G1-Abnahme pro Pflichtplattform: konkrete Run-ID-Übergabe, frischer Prozess-/Seitenkontext, passender Abschluss und Ablehnung eines fremden/veralteten Ergebnisses praktisch nachgewiesen. Der Übergabeweg darf je Plattform verschieden sein, der Ereignisvertrag bleibt gleich.

G2 übernimmt dieses Protokoll in JSON/JUnit. Fehlerfälle des Collectors mit alten IDs, fehlendem Abschluss, null Fällen und doppelten Ergebnissen gezielt prüfen; kein umfangreiches eigenes Testframework entwickeln.
