> Historical record, superseded for current work by [PLAN.md](../../PLAN.md). Old status, scope and authorization statements are not current instructions.

[Documentation index](../../README.md)

# 4. Betriebsarten und Plattformen

| Modus | Editor benötigt? | Bob benötigt? | Engine/Automation | Zweck |
|---|---|---|---|---|
| Lokal interaktiv | Ja | nicht separat, wenn Editor selbst baut | Editor HTTP + nativer Debug-Service + Bridge, falls verfügbar | Mensch/AI testet Spiel und Sandbox |
| Lokal headless | Nein | Ja und passende JDK-Version | echter Runtime-Binary-Smoke wo möglich | schnelle Codex-Iterationen |
| GitHub CI | Nein | Ja | Linux/HTML5-Build und automatisierte Testprozesse | reproduzierbare Checks |
| Browser | Nein zum Starten des Bundles | für Build | Browserautomation, Konsole, Screenshot | HTML5-E2E |
| Physisches Android | Nein zum Starten eines APK | für Build möglich | ADB, Touch, Lifecycle, Logs | mobiles Verhalten/Performance |
| Release | Nein | ja für CI-Bundle | **keine** Bridge-/Engine-Testdienste | Auslieferung |

Android Studio ist in der Gründungsphase **nicht** nötig; ADB/Platform-Tools sind empfohlen. Gerätetest auf einem realen Android-Gerät ist ein Pflichtnachweis für spätere mobile Freigaben, kein Ersatz durch Desktop-Mausautomation.

### 4.1 Verbindliche Plattformbasis

Windows nativ und Desktop-Chrome sind die lokale Basis. Linux-CI ist eine eigene Prüfplattform und ersetzt Windows nicht. Android-Browser und Android-APK sind getrennte Ziele. iOS ist zunächst außerhalb des freigegebenen Umfangs.

| Ziel | Früher Pflichtnachweis | Spätere Abnahme |
|---|---|---|
| Windows x64 Debug | G1 Start/Physik/Reset | G5 Steuerung, G6 Stabilität |
| Desktop-Chrome HTML5 | G1 echter Runtime-Smoke | G3 Resize/Visibility, G5 Challenge |
| Linux-CI | G0 Bootstrap, G1 Build/ausführbare Runtime-Checks | G2 reproduzierbare Test-CLI |
| Android APK | G1 Versuch; G2 installierbares Debug-APK Pflicht | G3 echtes Gerät, G5 Touch-Spieltest |
| Android-Chrome HTML5 | G3 echter Geräte-Smoke | G5 Touch-Challenge, G6 Performance |

G0 erfasst verfügbare Geräte und Zugänge; konkrete Modelle, OS- und Browserversionen spätestens vor G3 in `docs/PLATFORM_MATRIX.md` festlegen. Gerätelücken bleiben Pflicht-BLOCKED und benötigen eine ausdrücklich akzeptierte Umfangsänderung, bevor abhängige Gates weitergehen.

### 4.2 Ausrichtung und Lifecycle-Nachweise

Landscape ist die anfängliche Spielbasis. Portrait muss ein lesbares, sicheres Layout ohne hängenbleibenden Input bieten; gleichwertiges Portrait-Gameplay ist keine MVP-Pflicht. Safe Areas und Seitenverhältnisse im G3-Layout prüfen; eine spätere Änderung dieser Basis separat entscheiden.

Echte Tabwechsel, Appwechsel, Displaysperre und Rotation von synthetisch ausgelösten Callbacks unterscheiden. Ein künstlicher Visibility-/Pause-Aufruf belegt nur die Handlerlogik. Pro echtem Test Ereignis, Zeitablauf, Log und Resume-Ergebnis sichern; Headless-Tests ersetzen diese Nachweise nicht. Auf Android eine Release-nahe Variante ohne Bridge zusätzlich vor Gerätefreigabe prüfen.

### 4.3 Ausführungsverantwortung und Nachweise

Jeder Pflichtnachweis nennt ausführende Person/Agent, reale Umgebung, verfügbare Zugriffe, exaktes Kommando oder manuelle Schritte, getesteten Commit und Artefakte. G0 erfasst die verfügbaren Ausführungswege; spätestens vor dem betreffenden Gate werden die Verantwortlichen konkret zugeordnet. Die folgenden Wege sind Beispiele, keine Behauptung vorhandener Zugriffe und keine Beschränkung auf einen bestimmten Agenten:

| Nachweis | Geeigneter Ausführungsweg | Grenze |
|---|---|---|
| Bob-/Bundle-Build | Agent lokal, Cloud-Agent oder CI mit nötiger Toolchain und Netzwerk | Belegt nur ausgeführte Zielplattform/Variante |
| Windows Runtime | Zugänglicher Windows-Host oder Windows-CI-Runner, sofern passendes Runtime-Binary praktisch funktioniert | Nichtgrafische Physiktests ersetzen keine sichtbaren Grafik-/Inputtests |
| Linux Runtime | CI oder zugänglicher Linux-Host | Headless belegt keine korrekte Grafik/GUI; erforderliche Fähigkeiten gesondert prüfen |
| Windows Editor/HTTP/MCP | Agent mit tatsächlichem Zugriff auf Editor und lokalen Dienst | Cloud-Zugriff nicht unterstellen |
| Sichtbarer Browser-Lifecycle | Browser-Agent oder Mensch auf zugänglichem Host | Synthetische Handleraufrufe ersetzen keinen echten Tabwechsel |
| Android APK/Browser Touch | Physisches Gerät mit autorisiertem Zugriff, bei Bedarf Mensch | Desktop-Mausautomation ersetzt keinen Touch-Nachweis |
| Review von CI-Artefakten | ChatGPT/Codex mit Zugriff auf Logs/Artefakte | Review ist keine selbst ausgeführte Geräteprüfung |

Manuell ausgeführte Tests werden als solche gekennzeichnet; der Agent dokumentiert die erhaltenen Resultate und behauptet keine eigene Ausführung. Fehlender Zugriff führt beim Pflichtnachweis zu BLOCKED. Headless-/Display-Backend und gegebenenfalls virtuelle Anzeige werden vor Linux-Runtime-Läufen erkannt und protokolliert; Wahl und Fähigkeiten des konkreten Engine-Binaries müssen zur Suite passen.

---
