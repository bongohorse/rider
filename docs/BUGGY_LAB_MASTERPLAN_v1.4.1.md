# BUGGY LAB — AI-Masterplan v1.4.1

**Stand:** 15. Oktober 2026
**Adressaten:** ChatGPT (Plan, Review, Gate-Entscheidungen) und Codex (Implementierung, Tests, PR)
**Ziel-Repository:** `bongohorse/rider` (erstellt und GitHub-Zugriff am 15.10.2026 bestätigt)
**Vorgänger:** `bongohorse/buggy` — ausschließlich historische Referenz, keine Code- oder Asset-Migration
**Status:** verbindliche *Planvorlage*, kein Nachweis einer Umsetzung

> **Leitgedanke:** Erst ein sauberes, überprüfbares Defold-/Box2D-3-Fundament, dann möglichst schnell ein fahrbarer Buggy auf einer kurzen Hindernisstrecke. Nur die tatsächlich benötigte Sandbox-Infrastruktur ausbauen. Spielspaß, stabile Physik, mobile Steuerung und reproduzierbare Tests gehen vor Grafik und Featuremenge.

## 0. Änderungen in v1.4.1

Diese vollständige Fassung ersetzt v1.4 als Planvorlage. Sie erteilt keine Umsetzungs-, Merge- oder Deployment-Freigabe.

- G4a verwendet den minimalen G1-Prüfstand mit repräsentativen Fahrzeugparametern weiter; vollständige Integration bleibt G5.
- G2-Bridge-Abnahme erhält konkrete Mindestfähigkeiten und eine nachgewiesene Eingabewirkung.
- Fixed-Timestep-Einstellungen und getrennte Messung von Callbacks, Physikfortschritt und Substeps präzisiert.
- G1 weist den Run-ID-Übergabeweg auf jeder Pflichtplattform nach.
- G5 erhält eine kurze verpflichtende Performance-Abnahme der vollständigen Challenge auf dem Android-Referenzgerät.
- Windows-CI als möglicher Prüfweg und Golden-Trace-Vergleich bei verschiedenen Renderfrequenzen ergänzt.

Die Regeln aus v1.4 bleiben erhalten: eindeutiges Testprotokoll, tickgenauer Test-Command-Player, passende Bridge-/Wrapper-Versionen, frühe Release-Negativtests und reale Renovate-Erkennung bei Einführung neuer Abhängigkeiten. Bridge bleibt G2-Pflicht, MCP optional. Weitere Erkenntnisse werden in den zuständigen Gate-Nachweisen festgehalten; kein automatischer Neuentwurf des Masterplans.

---

## 1. Ziel, Produktumfang und bewusst ausgeschlossene Themen

### 1.1 Produktvision

Ein 2D-Mobile-Fahrspiel mit präziser, leicht arcadiger Trials-artiger Fahrzeugbeherrschung sowie kurzen, puzzleartigen Hindernisstrecken, inspiriert von frühen TrackMania-Spielen. Später sind andere Fahrzeuge, reaktive Box2D-Hindernisse, neue Oberflächen, Wetter und Effekte vorgesehen. Grafik ist später ein konsistenter illustrierter 2D-Spielzeugstil mit Pseudo-3D-Parallaxentiefe.

### 1.2 Erstes echtes Produkt

Eine **Physics & Gameplay Sandbox**, die folgende Minimalfunktionen bietet:
- Mehrere sauber getrennte Szenarien; jedes ist zurücksetzbar und messbar.
- Debug-Geometrie statt fertiger Texturen.
- Kamera, minimaler Szenariowechsel, Pause, Reset, Parameteranzeige.
- Ein **fahrbarer Buggy** mit Motor, Federung, Bremse/Rückwärtsgang und Luftneigung.
- Eine **30–60 Sekunden lange Challenge**, in der permanentes Gasgeben nicht zur erfolgreichen Fahrt reicht.
- Native-/HTML5-Tests und früher Android-Smoke.

### 1.3 Nicht-Ziele der Gründungsphase

Kein Port des alten Spiels; keine vendorte Box2D-Bibliothek; keine eigene Physik-Extension; keine universelle Game Engine; kein generisches ECS; kein großer Leveleditor; keine Production Art; kein Wetter-/Fluidsystem; kein Cloud-Backend; keine Monetarisierung. Keine spekulativen Lua-Abstraktionen nur wegen möglicher späterer Features.

---

## 2. Verbindliche Grundregeln

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

## 3. Versionen, Quellen und Abhängigkeiten

### 3.1 Kandidaten (nicht automatisch fest gepinnt)

| Komponente | Kandidat/Regel | Pflichtnachweis vor Pin |
|---|---|---|
| Defold Editor/Engine | 1.14.0 (veröffentlicht 12.10.2026) | Installations-/Engine-Build-ID, Runtime-Test, API-Dokumentationsstand |
| Bob | exakt zu gewählter Defold-Version gehörige Distribution | passende Release-/Build-Identität, funktional vergleichbare Ergebnisse, Plattformen, CLI-Vertrag; keine implizite Bitidentität |
| JDK | OpenJDK 25 als Kandidat gemäß aktueller Bob-Doku | `java -version`, Bob-Build auf Win/CI |
| Automation Bridge | 2.5.0 als Kandidat (min. Defold 1.13.1 lt. Asset-Katalog) | Native Debug-Builds, API und Lizenz/Distribution prüfen |
| Community-MCP | `Fulviuus/defold-mcp` evaluieren | Code-/Dependency-Prüfung, Berechtigungen, lokaler Smoke |
| Druid | erst bei nützlichem Sandbox-UI-Bedarf | kontrollierter GUI-Smoke auf Zielplattformen |
| Input-/Kamera-/Testlibs | optional | konkret dokumentierter Mehrwert gegenüber Defold-Bordmitteln |
| GitHub Actions | kompatible, nachgeprüfte Releases/SHA-Pins | Workflow-Syntax, konkrete Runs, Least Privilege |
| Ubuntu Runner | zunächst 24.04 als Baseline | 26.04 nur nach Vergleichstest |

Pin-Zeitpunkte: G0 dokumentiert Kandidaten und Quellen. Ende G1 werden Engine, Bob und JDK nach bestandenen G1-Pflichtprüfungen unveränderlich festgelegt. Ende G2 werden die geprüfte Automation Bridge und ihr passender Python-Wrapper ergänzt. Weitere Plattformnachweise erweitern die Prüfmatrix, ohne bestehende Versionen still zu ändern. Ein Versionswechsel verlangt einen dokumentierten Update-PR und die betroffenen Regressionen.

**Lock ist keine pauschale Plattformfreigabe:** Nach G1 sind die Versionen festgelegt, aber nur die tatsächlich bestandenen Plattformprüfungen bestätigt. Android-Build und Geräteverhalten bleiben bis G2/G3 entsprechend NOT RUN/BLOCKED. Der Lock führt je Plattform Test-ID, Commit, Ergebnis und Datum. Ein Android-Problem ändert die Versionen nicht automatisch; erforderliche Updates durchlaufen den dokumentierten Änderungsprozess. Es gibt keinen frei austauschbaren „vorläufigen Lock“.

Nach erfolgreichen Tests in `docs/TOOLCHAIN_LOCK.md` mit **exakten Versionen, Releases, Commit-SHAs, Download-Prüfsummen und geprüften Plattformen** dokumentieren. Die verfügbare Defold-Web-API kann unterschiedliche Versionsstände je Unterseite anzeigen; maßgeblich sind die zur gebauten Engine passenden API-Definitionen und Laufzeittests. Nie aus einer Alpha- oder Legacy-Dokumentation stillschweigend Backend-3-Fähigkeiten übernehmen.

### 3.2 Dependency-Regeln

- Keine Floating-ZIP-URLs wie `master.zip` in produktiven Defold-Abhängigkeiten.
- Neue Abhängigkeit nur mit Lizenz, Zweck, Version/Commit, Herkunft, Updateweg, Entfernbarkeit und Plattformmatrix aufnehmen.
- Renovate ab G0 konfigurieren; Defold-/Bob-/Extension-Updates nicht allein anhand des GitHub-Actions-Managers als abgedeckt betrachten; zusätzliche Manager/Regeln nur bei verifizierter Erkennung.
- Major-Updates, Runnerwechsel und Engine-Upgrades immer separat mit vollständiger Regression prüfen; kein blindes Automerge.

### 3.3 Native Buildserver und Netzwerk

Die Automation Bridge ist eine native Extension. G0 erfasst, G2 prüft den benötigten Native-Extension-Buildweg tatsächlich:
- Bob-Releasekanal, Engine-/SDK-Identität und ausdrücklich dokumentierter Extender-Buildserver.
- Erreichbarkeit von Engine-/Bob-Downloads, Dependency-Quellen und Buildserver aus Windows, Agentumgebung und CI getrennt prüfen.
- Netzwerk-, Proxy-, Zertifikats- und Berechtigungsfehler verständlich melden; keine Sicherheitskontrollen umgehen.
- Cache-Schlüssel enthalten Engine/SDK, Plattform, Buildvariante und Extension-Stand; mindestens ein sauberer Build ohne Cache-Hit als Nachweis.
- Bei nicht erreichbarer Infrastruktur: BLOCKED mit konkreter Voraussetzung. Eigener Buildserver oder eigene native Toolchain sind keine automatische Ersatzaufgabe.
- Quellen und benötigte Upload-Inhalte des Native-Builds dokumentieren; keine Secrets in Uploads/Logs.

---

## 4. Betriebsarten und Plattformen

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

## 5. Technische Verträge vor der Fahrzeugentwicklung

### 5.1 API-/Backend-/Plattform-Matrix (`docs/API_COMPATIBILITY.md`)

Für jede benötigte Operation die Spalten führen:

`Funktion | exakte Defold-API/Signatur | Quelle/Ref-Version | gewählter Backend | Windows Debug | HTML5 | Android Debug | erwartete Semantik | Test-ID | Ergebnis | Einschränkung`

**G1 Pflicht-PoC:**
- Tatsächlich aktiviertes Box2D 3 (`b2d.get_version()` oder geeigneter verified Runtime-Nachweis).
- Dynamics/Static-Body, Collision, Wheel Joint **mit Spring + Motor**, sichere Erstellung/Zerstörung.
- Sichere Reset-Operation und valide Handles vor/nach Reset.
- Verfügbare Kollisionsgruppen/-Masken, Sensor-/Kontaktwege klären.

**G4a Pflicht:** Terrain-/Edge-/Chain-Option, Filterung, hoher Speed/CCD, Kontaktverhalten und mobile Plattformtests nachweisen. Fehlende Pflicht-API → Gate **FAIL/BLOCKED**, Alternativen dokumentieren, Entscheidung anfordern. Kein eigenes Box2D heimlich einbauen.

### 5.2 Einheitenvertrag (`docs/PHYSICS_UNITS.md`)

Nicht einfach „1 Meter = N Pixel“ behaupten. Für **jede** verwendete API dokumentieren:
- Erwartete Koordinateneinheit für Position, Geschwindigkeit, Beschleunigung, Kraft, Impuls, Drehmoment, Winkel und Winkelgeschwindigkeit.
- Gilt `physics.scale`? Ist die `b2d`-Funktion eine interne World-/Box2D-Einheit oder engine-seitig skaliert?
- Wer konvertiert Eingaben und Rückgabewerte? **Einmalig nur an einer definierten Grenze.**
- Einheit von Camera, GUI, Terrain-Generator, Debug-Zeichnung und Kontaktpunkten.
- Probe: definierter Körper/Gravitation, gemessener Fallweg und Gelenkabstand; Test mit bewusst verändertem Scale-Wert, um Doppelskalierung zu erkennen.
- Winkel: intern Radiant, UI Grad; Speed intern physikalisch konsistent, UI-Einheiten explizit.

**Abnahme:** Konversionsmatrix ausgefüllt, empirische Einheitentests unter Windows und HTML5 (Android frühstmöglich) innerhalb vor Testlauf definierter numerischer Toleranzen; keine doppelte Skalierung.

### 5.3 Lifecycle-/Tick-Vertrag (`docs/PHYSICS_LIFECYCLE.md`)

**Ausgangskonfiguration:** 60 Hz Fixed Timestep, also 1/60 s pro Physiktick. Vier Solver-Substeps sind der zu verifizierende Startwert. Defold dokumentiert dafür die Box2D-3-Einstellung `Sub Step Count`; konkrete Konfiguration und Wirkung werden gegen den gewählten Build geprüft. Substeps sind keine zusätzlichen Gameplay-Ticks. Legacy-Iterationswerte und das als 3D-spezifisch dokumentierte `Max Fixed Timesteps` dürfen nicht als gleichwertige 2D-Catch-up-Steuerung verwendet werden. G1 konfiguriert ausdrücklich `physics.use_fixed_timestep = true` und `engine.fixed_update_frequency = 60`; Schlüssel und effektive Werte werden am gewählten Engine-Build verifiziert. G1 weist Konfiguration und Wirkung anhand der gewählten Engine nach. Gezählt werden Fixed-Update-Callbacks und messbarer Physikfortschritt; Callback-Anzahl allein beweist weder interne World-Steps noch Solver-Substeps. Vier Substeps über effektive Konfiguration und einen geeigneten versionsbezogenen Nachweis belegen, keine vier Lua-Callbacks erwarten. Renderfrequenz, Physikticks und Solver-Substeps getrennt messen. Ein 30-FPS-Renderfallback ändert die 60-Hz-Physikbasis nicht. Eine spätere Änderung der Physikbasis verlangt einen dokumentierten Vergleich und Freigabe.

Konzeptionell: **Input erfassen → pro Tick normalisieren und anwenden → Defold simulieren lassen → nachweislich verfügbarer Zustand/Kontaktinformationen auswerten → für Darstellung interpolieren, falls nötig.**

Wichtig: Exakte Callback-Reihenfolge von Defold in der gewählten Version **messen und belegen**. Nicht annehmen, dass `fixed_update` vor/nach dem Engine-Step liegt, ohne dies zu prüfen. Inputs und Forces müssen an der jeweils richtigen, dokumentierten Stelle angewandt werden; Simulation ausschließlich von Defold. Ein Wechsel zu manueller World-Steuerung wäre eine gesondert freizugebende Architekturänderung und ist nicht durch einen erfolgreichen API-Aufruf autorisiert.

Bei Kollisionen/Kontaktevents keine nicht unterstützte Body-/Joint-Erzeugung oder -Zerstörung innerhalb eines gesperrten Physics-Schritts. Stattdessen einen **Deferred Mutation Queue**-Vertrag prüfen/implementieren: mutierende Operationen für ein sicheres Zeitfenster vormerken; Reihenfolge, Fehler und Rückgabehandles definieren.

Bei Framedrops/Background:
- Kein ungeprüftes unbegrenztes Nachholen von Physikticks.
- Delta-/Catch-up-Verhalten des Engine-Systems messen.
- Bei längerer Inaktivität Inputs freigeben, Session pausieren/sicher weiterführen.
- Keine erzwungenen extra Steps, die vom Engine-Lifecycle abweichen.

### 5.4 Ownership/Reset-Vertrag (`docs/RESOURCE_OWNERSHIP.md`)

**Verbindliches Engine-Modell:** Game Objects und Collision-Object-Komponenten werden über die unterstützten Defold-Ressourcen-/Factory-/Collection-Wege angelegt. Die Collision-Object-Komponente besitzt ihren Physics Body. `b2d.get_body()` liefert einen geliehenen Handle, keinen unabhängig besessenen Body. Löschen der Komponente/des Game Objects invalidiert diesen Handle. Keine parallele Body-Verwaltung oder unbestätigte eigene Body-Erzeugung einführen.

G1 dokumentiert konkret:
- Welches Modul Game Objects/Collision Objects erzeugt, ihre IDs hält und ihre Löschung anfordert.
- Wann der Body verfügbar ist und wie gültige Handles aus den Komponenten bezogen werden.
- Welches Modul Wheel Joints erzeugt, registriert und deren Referenzen invalidiert.
- Welche Joints beim Löschen eines Bodys durch die Engine automatisch entfernt werden und welche explizite Freigabe die ausgewählte API erlaubt/verlangt.
- Wie bereits automatisch entfernte Joints erkannt werden, damit kein zweiter Destroy erfolgt. Dokumentierte Gültigkeitsprüfung verwenden, soweit verfügbar; sonst Referenzen anhand des Lifecycle-Vertrags entfernen, ohne ungültige Handles zu dereferenzieren.
- Wie Fahrzeugteile und Terrain in derselben Collection-Proxy-Physikwelt bleiben. Getrennte Top-Level-Welten dürfen visuell überlappen, interagieren aber nicht miteinander.

Cleanup-Tests umfassen expliziten Joint-Abbau und Body-/Collection-Löschung mit angehängten Joints. Nach bestätigtem Cleanup dürfen alte Handles keine neuen Aktionen erreichen. Engine-Autocleanup und Lua-Referenzbereinigung werden getrennt nachgewiesen; die sichere Reihenfolge wird aus der tatsächlichen API abgeleitet, nicht pauschal angenommen.

**Lua-State:** Defold 1.14.0 verwendet verbindlich gemeinsamen Lua-State. Szenarioabhängiger Zustand liegt in expliziten Session-Instanzen statt unkontrollierten Globals oder langlebigen Modul-Singletons. Unveränderliche Moduldefinitionen dürfen geteilt werden. Modul-Caches, Listener, Timer und Referenzen mit Session-Bezug müssen beim Reset/Unload bereinigt oder generationssicher verwaltet werden. Collection-Unload allein wird nicht als Löschung aller Lua-Zustände gewertet.

Pflichtregression ab G3: A → B → A, dabei Einstellungen, Listener und Input verändern. Anschließend erreichen A und B jeweils ihren definierten Startzustand; keine ungewollte Übernahme von Parametern, Commands, Listenern oder Objektverweisen. Gewollt persistente globale Benutzereinstellungen werden separat ausgewiesen und ausdrücklich getestet.

Tabelle pro Ressourcentyp: `Owner | Create | Destroy | Reset | Gültigkeit | Fehlerbehandlung` für Defold-Game-Objects/Collision Objects, `b2d`-Bodies/Shapes/Joints, Kontakte/Listener, Timer, Input/Touch-IDs, GUI, Kamerafokus, Lua-Module, Subscriptions, Messages und Test-State.

Reset ist eine **atomar gedachte Sequenz**:
1. Eingaben blockieren und aktive Touch-Zuordnungen löschen.
2. Laufende/ausstehende Aktionen stoppen; Deferred Mutations kontrolliert leeren.
3. Physikobjekte/Joints in sicherer Reihenfolge freigeben oder komplette Collection neu laden (nachgewiesene Strategie).
4. Debug-UI, Kamera, Timer, Eventlistener, Subscriptions, Lua-Session-Zustand freigeben.
5. Handles invalidieren, keine Wiederverwendung alter Referenzen.
6. Neuen definierten Startzustand aus einer kanonischen Konfiguration herstellen.
7. Input wieder freigeben; Startzustand vermessen.

Asynchroner Ablauf: `RUNNING → STOPPING → UNLOADING → LOADING → INITIALIZING → READY → RUNNING`; bei Fehler/Timeout `ERROR`. Bei Wiederverwendung einer Collection nur die tatsächlich nötigen Zustände verwenden, aber dieselben Abschlussbedingungen nachweisen.

- Reset und Switch werden serialisiert; doppelte Anfragen werden eindeutig verworfen oder zusammengefasst.
- Jede neue Session erhält eine Generation. Ausstehende Timer, Callbacks, Commands und Nachrichten werden anhand dieser Generation vor Anwendung geprüft.
- Entladen/Laden/Initialisierung anhand realer Engine-Abschlussmeldungen bestätigen, nicht anhand pauschaler Wartezeiten.
- Input erst nach READY freigeben; alte Touchkontakte dürfen keinen neuen Fahrbefehl auslösen.
- Jeder Übergang besitzt ein Timeout und einen Fehlerpfad. ERROR bleibt sicher pausiert und diagnostizierbar; keine unvollständige Welt als spielbereit melden.

Freigegebene Handles dürfen weder in Lua noch zwischen Szenarien weiterverwendet werden; fehlgeschlagener Cleanup ist ein harter Testfehler.

**Unterbrechungs- und Recovery-Tests ab G3:** Reset/Switch während ausstehender Timer, Kontaktmeldungen und Ladeoperationen sowie mehrfach schnelle Reset-Anfragen ausführen. Alte Generationen dürfen keine Mutation auslösen. ERROR bietet einen definierten, expliziten Neuaufbau-/Retry-Pfad mit erneuter Generationsvergabe und bestätigtem READY; kein automatisches Weiterlaufen einer teilweise initialisierten Welt. Fehlerpfad und erfolgreiche Wiederherstellung mit gezieltem Test nachweisen.

### 5.5 Debug-Funktionen und Live-Tuning

- **Pause/Resume:** Muss dem tatsächlichen Engine-Lifecycle entsprechen; keine verborgene World-Simulation.
- **Single-Step:** Eigener G3-PoC. Erfolgreich nur, wenn **genau ein Physiktick** nachweisbar stattfindet. Wenn unsupported, UI nicht vortäuschen; `BLOCKED`/`DEFERRED` mit Alternativen.
- **Slow Motion:** Nur mit belegter Zeitsteuerung; definierte Auswirkung auf Rendering/Physics dokumentieren.
- **Live-Tuning:** Für jeden Parameter: `LIVE`, `NEXT_RESET` oder `REBUILD`. Änderungen werden validiert (finite Zahl, erlaubter Bereich, Einheit), versioniert und an einer definierten Tickgrenze atomar angewandt. Kein Versprechen, jede Motor-/Kollisionsgeometrie live ändern zu können.

### 5.6 Datenschema und Reproduzierbarkeit (`docs/DATA_CONTRACT.md`)

Jedes Szenario/Replay beinhaltet mindestens:
- `schema_version`, `scenario_id`, `scenario_version`, `seed` (sofern RNG genutzt), Plattform, Build-SHA, Defold-/Box2D-Version;
- kanonisch serialisierte Konfiguration und **Konfigurationshash**;
- Steuerbefehle mit **Physics-Tick-Index**, nicht nur Zeitpunkt;
- wichtige Zustände/Messpunkte + Toleranzen und `input_policy`;
- Resultat/Fehlertext, Artefaktpfade, Test-ID.

Ungültige Daten (NaN/Inf, fehlende Pflichtfelder, falsche Version, out-of-range, beschädigter Speicherstand) müssen mit verständlichem Fehler oder definiertem Default/Fallback behandelt werden; keine silent corruption. Plattformübergreifende Vergleiche zunächst toleranzbasiert, nicht bitgenau.

### 5.6a Minimaler Test-Command-Player

Spätestens G5 steht ein kleiner Testadapter bereit, der Commands erneut ausführt und Zustände prüft. G4a nutzt ihn nur, soweit für die dortigen Testeingaben nötig. Kein separates Replay-Produkt bauen.

- Kanonische Startkonfiguration, Body-Erzeugungsreihenfolge, Startpositionen/-geschwindigkeiten und definierter erster aktiver Command-Tick festhalten.
- Tick 0 erst nach bestätigter Initialisierung/READY definieren; kein unbeabsichtigter Vorlauf vor der Messung.
- Pro Tick genau einen normalisierten Command durch denselben Vehicle-Command-Pfad wie beim Spielen anwenden. Live-Eingaben während des Testlaufs ausschließen; keine direkte Pose-Manipulation als Ersatz für Steuerung.
- Policy für nicht belegte Ticks, doppelte oder ungeordnete Commands ausdrücklich definieren. Ungültige Traces ablehnen; keine implizite, wechselnde Hold-Policy.
- Vorab festgelegte Messpunkte, Ergebnisbedingungen und Toleranzen vergleichen. Dieselbe Trace mehrfach aus vollständig zurückgesetztem Zustand prüfen. Zusätzlich dieselben Tick-Commands unter mindestens zwei tatsächlich gemessenen Renderfrequenzbedingungen (z.B. 30 und 60 FPS) vergleichen, ohne die 60-Hz-Physikbasis zu ändern. Renderframes sind keine Command-Indizes. Frame-Stalls/Überlastung, Pause und gegebenenfalls verworfene Simulationszeit separat protokollieren; Ergebnisse nur bei vergleichbarem Ablauf nach gleichem Physiktick bewerten. Ein Slowdown darf durch toleranzbasierten Zustandsvergleich nicht verborgen werden.
- Erfolgs- und absichtlich ungeeignete Trace müssen jeweils ihr erwartetes Ergebnis bestätigen. Erwartetes Scheitern einer Challenge ist ein bestandener Negativtest, kein technischer Suite-Fehler.
- Test-Playback, Gameplay-Replay und visuelle Ghosts getrennt behandeln. Nur Test-Playback ist frühe Pflicht; keine Replay-UI oder allgemeine Ghost-Infrastruktur.

### 5.7 Physik-Kollisionsmatrix (`docs/COLLISION_MATRIX.md`)

Vor G5 Gruppen/Masken und beabsichtigte Interaktionen dokumentieren: `chassis`, `wheels`, `terrain`, `dynamic_obstacles`, `sensors`, `decorations` (letztere ohne Physik). Selbstkollision, Ghost Contacts, Start/Ziel-Sensoren, Wheels-vs-Chassis, Objektgrenzen prüfen. Keine unbekannte Standard-Kollisionsfilterung voraussetzen.

---

## 6. Sandbox-MVP statt übergroßer Testumgebung

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

## 7. Spielverträge für den ersten Buggy

### 7.1 Steuerung

Normalisierter Tick-Command, beispielsweise:

```text
vehicle_command = {
  throttle: 0..1,
  brake_reverse: 0..1,
  lean: -1..1
}
```

Die finalen Feldnamen dürfen Lua-sinnvoll gewählt werden. Regeln:
- Eingabequelle (Touch, Tastatur, später Gamepad) kennt das Fahrzeug nicht.
- Gas, Bremse/Rückwärtsfahrt und Neigung links/rechts sind eigenständige Aktionen.
- Default bei **Gas + Bremse gleichzeitig**: Bremse gewinnt (oder eindeutig dokumentierte andere Regel); Verhalten durch Test fixieren.
- Bremse und Reverse klar trennen: zunächst abbremsen bis nahezu Stillstand, erst dann kontrolliert rückwärts antreiben; Grenzgeschwindigkeit/-hysterese abstimmen.
- Touch-ID einmalig einem Button/Steuerbereich zuordnen; Release außerhalb, Fokusverlust, Touch-Cancel, Orientation Change und Szenariowechsel müssen Input loslassen.
- GUI-Panels dürfen keine versteckten Fahrzeuginputs erzeugen.

### 7.2 Motor-/Fahrverhalten

Explizite Werte für `motor_target_angular_speed`, `max_motor_torque`, erlaubte Fahrzeuggeschwindigkeit/-Limitierung, Bremsmoment, Fahrhilfe-Drehmoment, Federfrequenz und Dämpfung. **Ziel-Raddrehzahl ist nicht automatisch tatsächliche Fahrzeuggeschwindigkeit.** Test bei unterschiedlicher Masse, Reifenreibung, Bergauf/Bergab und in der Luft.

### 7.3 Failure, Retry und Kamera

- Fail-Merkmale vorab definieren: z.B. Crash-/Orientierungsfenster, Chassis-Bodenkontakt, definierter Sensor, außerhalb der Strecke oder keine Fortschrittsmöglichkeit; keine ungetestete „jeder Überschlag ist verloren“-Regel.
- Retry in kurzer Zeit, setzt vollständig zurück: Fahrzeug, dynamische Hindernisse, Input, Timer, Partikel (falls vorhanden), Kamera und Versuchsdaten.
- Checkpoints zunächst **nicht** implementieren, sofern die erste kurze Challenge sie nicht benötigt.
- Kamera: weiche Fahrzeugverfolgung, vorausschauender Blick, gute Sicht auf Landezone; prüfen bei Links-/Rückwärtsbewegung, hoher Geschwindigkeit und unterschiedlichem Seitenverhältnis.

### 7.4 Erste Challenge = Spielspaß-Gate

30–60 Sekunden, drei Stellen: dosiertes Gas / Bremsen, kurzer kontrollierter Sprung und ein Hindernis, das richtige Neigung oder Timing verlangt. Dauerhaftes Volllastfahren muss **mindestens eine** Passage nachvollziehbar scheitern lassen; geschicktes Spielen muss sie bestehen können. Direktes Retry nach Fehler; noch keine Medaillen-/Ökonomieproduktion.

Abnahme durch Mensch: „verständlich, kontrollierbar, wiederholbar, macht weitere Versuche interessant“. Diese subjektive Abnahme ist **separat** von automatischen technischen Tests festzuhalten.

G5 protokolliert je Kriterium Beobachtung, Problem und Entscheidung:

| Kriterium | Erwartete Beobachtung |
|---|---|
| Steuerbarkeit | Geschwindigkeit und Neigung lassen sich gezielt beeinflussen |
| Federung/Landung | Reaktionen sind nachvollziehbar und wiederholbar |
| Lesbarkeit/Fairness | Hindernis und Fehlerursache erkennbar; Erfolg nicht von verdecktem Zufall abhängig |
| Herausforderung | Gezielte Bedienung löst die Passage zuverlässig; Vollgas-Scheitern allein genügt nicht als Qualitätsbeleg |
| Retry | Erneuter Versuch ohne störende Wartezeit; gemessene Retry-Dauer dokumentieren |
| Mobile | Gleichzeitige Touchaktionen ohne unbeabsichtigte Eingaben |
| Motivation | Tester möchte misslungene Passagen erneut versuchen; Gründe notieren |

Desktop und echtes Touch-Gerät prüfen. Testerzahl, Gerät und Beobachtungen nennen; eine zusätzliche kleine Testgruppe ist optional. Einzelne subjektive Abnahme nicht als allgemeiner Nachweis für alle Spieler darstellen.

---

## 8. Automation, MCP und Test-Tooling

### 8.1 Drei getrennte Defold-Schnittstellen

1. **Editor HTTP API:** Offenes Editorprojekt, Ressourcen, Builds, Konsole, editorseitige Aufgaben; `/openapi.json` des *laufenden Editors* ist maßgeblich. Experimentell.
2. **Engine Service:** Eigener Prozess und dynamischer Port pro laufender **Debug**-Engine, etwa `/ping`, `/info`; nicht die Editor-API; Release hat keinen entsprechenden Debug-Dienst.
3. **Automation Bridge:** Offizielle, separate Debug-Native-Extension mit versionierter Engine-Route für Runtime-Inspektion/Eingaben/Screenshots; ihre Plattform-/Featureverfügbarkeit muss erkannt werden. Kein HTML5-Ersatz für Browserautomation.

Offizielle Bob-/HTTP-Automation ist der bereits zugelassene Standardweg innerhalb des freigegebenen Gates. Community-MCP ist optional; ungeeignete oder nicht verfügbare Adapter werden begründet DEFERRED, ohne einen zusätzlichen Freigabeschritt für den Standardweg. Blockiert dieser Standardweg eine Pflichtfähigkeit, bleibt das Gate BLOCKED.

MCP verbindet einen AI-Agenten mit diesen verfügbaren Fähigkeiten, ist kein Backend des Spiels. Kein Hardcoding von Engine-Service-Ports. Keine Veröffentlichung des HTTP-Servers nach außen. Keine MCP-Funktionen behaupten, die der konkrete Agent nicht erreichen kann.

### 8.2 Test-CLI-Vertrag spätestens G2

Die AI muss gemeinsame, dokumentierte Einstiegspunkte vorfinden:

```text
./tools/doctor.sh [--json]       # oder doctor.ps1 unter Windows
./tools/verify.sh [--suite NAME] [--output DIR]
./tools/build.sh [--target html5|desktop|android] [--configuration debug|release]
```

*Diese Befehle sind ein zu implementierender Interface-Vertrag; nicht als bereits vorhandene Skripte verstehen.*

Regeln:
- Fehler = Nichtnull-Exitcode; Erfolg = 0; Konfigurations-/fehlende Toolchain-Fehler als klarer BLOCKED-Grund.
- Jede Suite erhält ein **festgelegtes Timeout** pro Test und Lauf; keine endlosen Hanging-Prozesse.
- stdout/stderr und maschinenlesbares Resultat in `artifacts/<gate>/<run-id>/`.
- Bei Fehlschlägen: Logs, Screenshots (falls verfügbar), relevante Konfiguration, SHA, Engine-/Backend-Version sichern.
- JUnit XML für CI, JSON v1 für detaillierte Ergebnisdaten; relative Artefaktpfade.
- Keine unterdrückten Fehler durch `|| true` oder bloße Ausgabe von `PASS` ohne Assertions.
- Headless-Prozesse nach Ablauf korrekt terminieren.
- Pflicht-Testinventar je Suite vor dem Lauf festlegen. Null entdeckte Tests, fehlende Pflichtresultate, ungültige Resultatdateien oder vorzeitiger Prozessabbruch sind kein Erfolg.
- JSON/JUnit, Prozess-Exitcode und erwartete Test-IDs gemeinsam auswerten. BLOCKED darf von Pflicht-CI nicht als grüner Erfolg behandelt werden.
- Ein Timeout beendet auch gestartete Kindprozesse; Teilergebnisse bleiben als unvollständig gekennzeichnet.
- Absichtliche Fehlertests in temporärem Arbeitsverzeichnis oder isolierter Checkout/Worktree ausführen. Danach unveränderten Ausgangsstand kontrollieren und erneut erfolgreich prüfen; kein defekter Commit als finaler PR-Stand.

Beispiel `results.json`-Schema (Entwurf):

```json
{
  "schema_version": 1,
  "gate": "G4a",
  "commit_sha": "<real_sha>",
  "platform": "x86_64-linux",
  "defold_version": "<verified_version>",
  "box2d_backend": "3",
  "suite": "physics_vehicle_critical",
  "status": "PASS",
  "tests": [
    {"id":"wheel_joint_reset", "status":"PASS", "duration_ms":123,
     "assertions":3, "artifacts":[]}
  ]
}
```

### 8.2a G1-Protokoll zwischen Engine und Runner

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

### 8.3 Sicherheits- und Release-Vertrag

**Bridge-Status:** Die geplante native Automation-Bridge-Integration bleibt ein G2-Pflichtnachweis, unabhängig von der Optionalität eines Community-MCP-Adapters. Bei strukturellem Build-/Kompatibilitätsblocker die bereits funktionierenden CLI-/Runtime-Nachweise sichern und eine Entscheidung über eine gleichwertige Alternative einholen. Ohne akzeptierte Umfangsänderung bleibt G2 BLOCKED/FAIL; die Bridge nicht stillschweigend DEFERRED setzen.

**G2-Capability-Smoke:** Auf mindestens einer vorab benannten unterstützten nativen Debug-Plattform alle folgenden Fähigkeiten praktisch nachweisen und in der Plattformmatrix festhalten:
1. Richtige laufende Engine/Projektinstanz erkennen; native Bridge- und Wrapper-Version sowie erforderliche Capabilities abgleichen.
2. Bekanntes Element oder definierten Runtime-Zustand erfolgreich abfragen.
3. Einen Eingabebefehl senden, Empfang/Ausführung gemäß API bestätigen und die erwartete Zustands- oder sichtbare Verhaltensänderung beobachten. Ein HTTP-Erfolg oder bloßes Receipt allein genügt nicht.
4. Screenshot auf den vereinbarten Grafikplattformen, auf denen die gepinnte Bridge ihn unterstützt, erfassen. Headless-/andere Plattformgrenzen explizit ausweisen; fehlende zugesagte Screenshot-Fähigkeit bleibt BLOCKED/FAIL, kein stilles Weglassen.
5. Den bereits vorgesehenen Release-Negativtest bestehen. Die erfolgreiche native Bridge-Abnahme ersetzt keine HTML5-Browserautomation und keine echte Android-Abnahme.

**Wrapper:** Python-Wrapper aus dem zur gepinnten Extension passenden Stand installieren. Extension und Wrapper gemeinsam aktualisieren, Version/Commit und Herkunft im Lock dokumentieren und reale API-/Capability-Kompatibilität prüfen. Keine unkontrollierte Latest-Aktualisierung. Lizenznachweis aus dem konkreten Repository-/Release-Stand führen; fehlende Asset-Katalog-Metadaten sind weder Lizenzfreigabe noch Beweis eines Lizenzverbots.

- MCP/Editor-/Engine-Service lokal-only. Bei Container/Remote-Entwicklung Zugriff explizit dokumentieren.
- Privilegierte `/eval`-Funktionen nur nach Sicherheitsprüfung freigeben.
- Secrets in `.gitignore`, CI-Ausgaben redigieren.
- Debug-Bridge/Automations-IDs nicht in Release übernehmen, soweit die installierte Bridge dies garantiert; **Release-Negativtest** verifiziert diese Annahme.
- Minimale GitHub-Actions-Permissions; kein Secretzugriff bei untrusted PRs.

---

## 9. Gate-Plan (jeweils eigener kleiner PR/Abnahme)

### G0 — Neues Repository & überprüfbare Toolchain

**Ziel:** Neues Repo ohne Altlasten, früh funktionierende CI und saubere Versionskandidaten.

**Arbeit:**
- `bongohorse/rider` erstellen (oder tatsächlichen Namen dokumentieren). Kein Import aus Alt-Repo.
- Minimales `README`, `AGENTS.md`, `.gitignore`, `.editorconfig`, `docs/DECISIONS/`.
- Initiale Versions-/Quellenmatrix und `docs/TOOLCHAIN_CANDIDATES.md`.
- Renovate-Basis mit Dashboard und PR-Grenzen. GitHub-App-Installation/Repositoryzugriff getrennt von Konfigurationsvalidierung nachweisen; mindestens einen echten Scan mit Run-/Dashboard-Beleg und erkannten vorhandenen Abhängigkeiten prüfen. Noch nicht vorhandene Defold-Abhängigkeiten sind kein Erkennungsnachweis; deren Prüfung folgt bei Einführung. Fehlende App-Rechte oder nicht erreichbare Scan-Ergebnisse als BLOCKED ausweisen.
- Actions-Workflow mit minimalen Berechtigungen, Syntaxvalidierung und realem Bootstrap-Check.
- Doctor-Tool für Editor, Bob, JDK, Git, Pfade und optional ADB/MCP; Windows/Linux getrennt.
- Branch Protection/Required Checks soweit Berechtigungen vorhanden, sonst konkrete Anforderung dokumentieren.

**Gate:** Repository, Branch, Draft-PR und Commit existieren; CI-Run ist real; Doctor läuft; alte Dateien fehlen; auf alle fehlenden Rechte explizit hinweisen.

**STOP:** Wenn Repository oder erforderlicher PR nicht erstellt werden können → `BLOCKED`; lokales Bootstrap allein ist nicht G0-PASS.

### G1 — Defold + Box2D-3-PoC

**Ziel:** Box2D 3, Scale/Units, Wheel Joint und Reset *vor* dem UI-Fundament validieren.

**Arbeit:**
- Minimalprojekt mit `game.project`, App Manifest Box2D v3 explizit; festen Engine-/Bob-Kandidaten einrichten.
- Runtime-Nachweis aktives Backend, API-Matrix und dokumentierte Funktionstests.
- Minimales Rig aus statischem Untergrund, dynamischem Chassis und **einem Rad als Defold-Collision-Objects**, verbunden durch einen **Wheel Joint mit Spring/Motor**, mit definiertem kurzem Testlauf. Kein vollständiger fahrbarer Buggy in G1.
- Komponenten-Ownership, Handle-Bezug, gemeinsame Physikwelt und Joint-Cleanup bei Body-/Collection-Löschung praktisch prüfen.
- Einheitentests mit Position/Gravitation/Velocity/Motorparametern.
- Motorwirkung durch gemessene Radbeschleunigung/-drehrate nachweisen; Federung durch definierte Belastung, messbare Auslenkung und gedämpfte Rückkehr prüfen. Toleranzen vor Abnahmelauf festlegen; Joint-Erzeugung allein ist kein PASS.
- Für Windows nativ, Linux Runtime und HTML5 dieselben physikalischen Kernfälle verlangen: aktives Backend, Body-/Kollisionstest, Motor/Federwirkung und Reset/Cleanup. Pro Plattform Test-ID/Ergebnis führen; Browserstart ersetzt keine Physikassertions. Weitere GUI-/Grafikprüfungen separat behandeln.
- Defold-eigene Tick-/Callback-Reihenfolge experimentell bestimmen.
- 100× sicherer Reset/Create/Destroy ohne ungültige Handles.
- Desktop- und HTML5-Build einschließlich wenigstens einmaligen Runtime-Smokes.
- Bereits in G1 einen minimalen ausführbaren Smoke-Runner bereitstellen: dokumentiertes Kommando für den verwendeten Host, echte Assertions, feste Timeouts, Nichtnull-Exitcode bei Fehler, Prozess-/Kindprozess-Cleanup und Logs mit Test-ID/Commit/Engine-Version. Der Runner prüft tatsächlichen Start, Backend, Joint-Funktion und Reset; bloßes Prozessstarten reicht nicht. Fehlende Pflichtresultate oder null Tests sind kein Erfolg.
- G2 integriert diesen Runner in build/verify und JSON/JUnit, statt einen zweiten unabhängigen Testpfad aufzubauen.
- Ersten installierbaren Android-Debug-Build versuchen; Geräteverfügbarkeit erfassen. Ein Fehlschlag wird mit Ursache und G2-Pflichtaufgabe dokumentiert; er darf nicht als Android-PASS erscheinen.
- Nach bestandenen G1-Pflichtprüfungen Engine/Bob/JDK in TOOLCHAIN_LOCK sperren.

**Gate:** Box2D-3-Version bestätigt; Joints funktional, Scale-Vertrag belegt, Reset ohne Fehler, Builds erfolgreich, Testbericht mit realen Logs. Fehlende Pflicht-API = Stop/Entscheidung, nicht Workaround.

### G2 — AI/MCP + ausführbare Tests

**Ziel:** Agent kann Änderungen unabhängig vom Editor-Frontend verifizieren.

**Arbeit:**
- Bob-Lauf ohne Editor, lokale Editor-HTTP- und Engine-Service-Verbindung getrennt dokumentieren.
- Automation Bridge 2.5.0 als Kandidat gegen installierten Build prüfen; native Debug-Automation.
- Native-Buildserver und sauberen Bridge-Build prüfen; Bridge nach erfolgreicher G2-Prüfung im Lock ergänzen.
- Community-MCP optional evaluieren (Sicherheit, Node/Java, Permissions); nur nach bestandener Prüfung konfigurieren. Offizieller CLI-/HTTP-Standardweg bleibt zulässig.
- Installierbares Android-Debug-APK erzeugen und als Artefakt sichern. Buildfehler = FAIL; fehlende externe Buildvoraussetzung = BLOCKED. Installation auf realem Gerät folgt spätestens G3.
- `doctor`, `verify`, `build` implementieren; Timeouts, Exitcodes, JSON + JUnit-Artefakte und CI-Upload.
- Runtime-Signal/Screen/Element identifizierbar und Screenshots, sofern Fähigkeiten verfügbar.
- Test beim absichtlichen Einführen eines isolierten Buildfehlers: Prüfprozess/CI muss fehlschlagen; anschließend sauberer Ausgangsstand wieder grün.
- Ersten Release-Build-Negativtest nach Bridge-Integration ausführen: Release startet korrekt, aber Debug-Routen/-Lua-Modul sind gemäß dokumentiertem API-Vertrag nicht verfügbar. Ein nicht gestarteter Release ist kein Beweis. G9 wiederholt die Prüfung.

**Gate:** Minimaler Runtime-Test durch echten Prozess bestanden, maschinenlesbarer Nachweis und reproduzierbares lokales Kommando; Editor-Modus und headless-Modus sind getrennt. Installierbares Android-Debug-APK liegt vor. MCP-Status explizit `PASS` oder optional `DEFERRED`; Pflichtfähigkeiten werden unabhängig davon geprüft.

### G3 — Kleine Sandbox + erster Android-Smoke

**Ziel:** Ein kleiner, funktionierender Experimentierspielplatz.

**Arbeit:**
- 2–3 Szenarien, Scenario Registry, Reset/Switch, begrenztes Debug-UI, Kamera, Pause.
- Single-Step/Slow Motion nur nach tatsächlichem Engine-Lifecycle-PoC einbauen, andernfalls als `DEFERRED` markieren.
- Input-Zustand vollständig zurücksetzen; keine Szenario-Leaks. A → B → A mit geänderten Parametern/Listenern/Input als Lua-State-Regression ausführen.
- HTML5 Browser-Smoke für Start, Resize, Sichtbarkeit, Console Errors.
- Beim ersten Android-Lauf einfache Framezeit-Baseline und, soweit messbar, Physiklaufzeit aufnehmen; Messmethode, Objektlast, Debugstatus und Grenzen dokumentieren. Nicht verfügbare Profilerwerte nicht erfinden. Grobe Performanceprobleme vor G5 untersuchen; umfangreiche Thermik-/Lastabnahme bleibt G6.
- **Erster realer Android-Smoke:** Debug-APK installieren, starten, Touch prüfen, pausieren und fortsetzen, Rotation/Back prüfen, Logs sichern. Falls kein Gerät verfügbar: expliziter Pflicht-BLOCKED und Freigabeentscheidung, nicht als bestanden deklarieren.

**Gate:** Drei (oder minimal zwei) Szenarien sicher wechselbar und zurücksetzbar; notwendige Plattformsmokes dokumentiert. Kein umfangreiches Panel-/Inspector-Framework.

### G4a — Nur fahrzeugkritische Physik

**Ziel:** Alle physikalischen Grundlagen für genau den ersten Buggy.

**Aufbau und Grenze zu G5:** Das G1-Mini-Rig aus Chassis, einem Rad, Wheel Joint und Untergrund weiterverwenden. Nur für den jeweiligen Test notwendige Fixtures ergänzen. Repräsentative Massen, Abmessungen, Geschwindigkeiten und Belastungen des geplanten Buggys dokumentieren; keine allgemeine Realismusanforderung. G4a prüft Motor/Bremse/Reverse, Federung, Kontakt und Terrain an diesem Prüfstand. G5 kombiniert diese nachgewiesenen Funktionen im vollständigen zweirädrigen Fahrzeug mit Steuerung, Kamera und Challenge. Gemeinsame Produktionsmodule weiterverwenden, soweit schon benötigt; keine zweite Fahrzeugarchitektur oder doppelte Physikimplementierung für Tests.

**Arbeit:**
- Rad-Bodenkontakt, Federung, Motor, Bremse, Reverse, Chassis-/Radfilter, Terrain-Geometrie, Sensoren.
- Rampen, Terrain-Nähte, Übergänge mehrerer flacher Segmente und Kontakt-/Bodennormalen mit rollendem Rad prüfen; keine unerklärten Kantenhänger oder Kontaktstöße. Schnelle Kollisionen/CCD nur im für den ersten Buggy vorgesehenen Geschwindigkeitsbereich und mit repräsentativer Masse prüfen. Extreme CCD-/Massematrizen nach G5/G6 verschieben, sofern kein konkreter kritischer Befund sie vorher erforderlich macht.
- 100 definierte Szenario-Resets, Kontakt-/Handle-Validität; High-Speed-Test mit festem Input.
- Zu jeder verwendeten `b2d`-API den Backend-/Plattformstatus bestätigen.

**Gate:** Für alle P0-Mechaniken reproduzierbare Tests mit vorher definierten Toleranzen, keine fehlerhaften Handles oder Instabilitäten in der Testlast. Keine anderen Joint-Labs parallel.

### G5 — Erster Buggy + erste spielbare Challenge (**frühe Spaßabnahme**)

**Ziel:** Fahrgefühl vor Tool-/Art-Ausbau bewerten.

**Arbeit:**
- 2 Räder, Chassis, Wheel Joints, Motor, Bremse/Rückwärtsfahrt, Luftneigung; Parameter typisiert/validiert.
- Einheitlicher Input Command, Touch + Tastatur, simultane Inputs, Touch-Cancel/Focus Loss. Eigene reale Mehrfinger-Pflichtfälle: Gas + Luftneigung, Gas + Bremse, Loslassen eines Fingers bei weiterhin gehaltenem zweiten Finger sowie Cancel/Fokuswechsel; aufgezeichnete Commands und beobachtetes Verhalten abgleichen.
- Kamera mit Look-Ahead und stabiler Vorschau.
- 30–60-Sekunden-Hindernisstrecke mit 1 Bremspunkt, 1 Sprung, 1 Balance-/Timing-Hindernis.
- Fail- und Retry-Vertrag, sofortiger Reset inklusive Hindernissen/Timer/Kamera/Input.
- Zwei Golden Runs als minimale Testtraces: bewusst unpassend (z.B. Vollgas) und erfolgreiches Skill-Profil; gleiches Setup, Eingaben tickgenau.
- Menschlicher Spielspaßtest auf Desktop **und Touch-Gerät**.
- Kurze Performance-Abnahme der vollständigen Challenge auf dem vorab benannten Android-Referenzgerät, APK und Android-Browser getrennt ausweisen. Auflösung, Buildvariante, Debug-/Overlaystatus, Aufwärmung, feste Messdauer und Wiederholungszahl vor dem Abnahmelauf festlegen. P50/P95/P99 der Framezeiten, tatsächliche Physikticks pro aktiver Echtzeit und erkennbare Slowdowns dokumentieren; Physik-CPU-Zeit ergänzen, soweit zuverlässig messbar.
- Numerische Mindestwerte für Framezeiten und zulässige Simulationsverlangsamung vor dem offiziellen Lauf aus Gerätebaseline und 60-FPS-Ziel festlegen. Ein bewusst gewählter 30-FPS-Fallback muss die 60-Hz-Physik beibehalten. Grenzwerte nicht nach einem Fehlschlag verschieben; ungeklärte Unterschreitung verhindert technische G5-Abnahme. Umfangreiche Thermik-/Speicher-/Lastprüfung bleibt G6.
- Testtraces umfassen Commands pro Tick, Messpunkte und Ergebnisassertions. Kein vollständiges Replay-/Ghost-System, kein Replay-UI und keine allgemeine Replay-Persistenz in G5.

**Gate (technisch):** Fahrphysik stabil, Replay/toleranzbasierter Vergleich, Retry zuverlässig, Input und Mobile-Smoke grün; kurze Android-Challenge-Performanceprüfung besteht ihre vorher festgelegten Grenzwerte.

**Gate (Gameplay):** Person bestätigt, dass Herausforderung bewusste Steuerung verlangt und Wiederholungen motiviert. Bei schlechten Fahrgefühl kein Feature-/Art-Ausbau, sondern gezielte Fahrzeugiteration.

### G4b — Optionales Nachfolgepaket nach G5: weitere Physics Labs

**Ziel:** Nach gutem Fahrgefühl das System kontrolliert erweitern.

**Optionen** (einzeln priorisieren): Kisten/Stacks, Wippen, Pendel, Ketten, Gelenkgrenzen, Brücken, ungewöhnliche Materialeigenschaften. Nicht alles als Pflicht vorschreiben.

**Gate:** Jedes hinzugefügte Lab besitzt Own-/Reset-Test, reproduzierbares Beispiel und dokumentierte Performance. Kein großes Paket ohne Nutzenbeleg.

### G6 — Belastbarkeit und mobile Performance

**Ziel:** Maßgebliche Qualität auf Zielhardware.

**Arbeit:**
- Mindestens 1000 Resets, 60-Minuten-Dauerlauf, definierte High-Speed-/Collision-Stresstests, Browser-Reload/Visibility und Input-Interruptions.
- Performance-Protokoll je Referenzgerät: Modell/OS/GPU, Auflösung/DPR, Browser oder APK, Akkustand/Temperatur soweit verfügbar, Szenario, Objektlast, 2–5 Minuten Aufwärmzeit, definierte Messdauer, P50/P95/P99 CPU-/Framezeiten, Speicher, Lua-GC, Draw Calls, Debug an/aus.
- 15–30 Minuten Thermik-/Drosselungsläufe.
- Zahlenbasierte Grenzwerte **vor** offiziellen Abnahmeläufen anhand kalibrierter Baselines definieren; ein Framebudget bei 60 FPS liegt bei 16,67 ms, bei 30 FPS bei 33,33 ms, ist aber kein automatisch erfülltes Performanceversprechen.
- Differenzierung Render-FPS/Physik-Ticks und Slowdown-Verhalten nachweisen.

**Gate:** Keine kritischen Stabilitätsfehler unter definierter Last; kein bleibendes, nicht erklärtes Reset-Speicherwachstum; Regressionsvergleich dokumentiert. Nicht getestete Geräte = keine Geräte-Freigabe.

### G7 — Drei kompakte Gameplay-Challenges

**Ziel:** Unterschiede im Spielverhalten belegen: Sprung/Landung, Balancieren, kleines Physik-Puzzle.

**Arbeit:** Jede Challenge mit klarer Start-/Zielbedingung, Retry, reproduzierbaren Input-Traces und ohne finale Produktionsgrafik. Gameplay-Review vor zusätzlichen Features.

**Gate:** Alle drei sind manuell spielbar und automatisch auf zentrale Zustandsregeln testbar; keine reine „Gas halten“-Aufgabe. Sonst Iteration.

### G8 — Content- und Grafik-Pipeline

**Ziel:** Erst jetzt Artstyle, Audio, neue Fahrzeug-/Leveldaten und Renderoptimierung etablieren.

**Arbeit:** Gemeinsamer 2D-Stil, Sprites/Atlanten, Parallax-Assets, Profiling auf Geräten, verschiedene Oberflächen und kontrollierte zusätzliche Objekte. Wetter/Fluid nur nach eigenem Machbarkeitsnachweis. Datenformate mit Schema/Migration, Assetlizenzen, reproducible generators.

**Gate:** Konsistenter Look, keine signifikante mobile Regression, neue Inhalte ohne monolithische Sonderfälle.

### G9 — Release & Betrieb

**Ziel:** reproduzierbare HTML5-/Android-Auslieferung mit Rückrollweg.

**Arbeit:** Release-Build-Negativtests für Debug-/MCP-Endpunkte, signiertes Android-Verfahren und Secret-Handling (wenn beauftragt), Versions-/Cache-Kontrolle, Privacy-Review, CI-/Pages-Nachweise, Rollback-Prozess.

**Gate:** getestet und signiert/freigegeben, klarer Bezug zwischen Source-Commit, PR-Commit, Merge-Commit und tatsächlich deployed Build/Commit.

---

## 10. Gate-Politik und Stop-Regeln

### 10.1 Ergebnisse

- `PASS`: alle **Pflichtnachweise** bestanden und dokumentiert.
- `FAIL`: Pflichtfunktion/Test nachweislich fehlgeschlagen.
- `BLOCKED`: Pflichtprüfung nicht ausführbar, externe Voraussetzung fehlt oder API unbewiesen. **Kein PASS.**
- `DEFERRED`: nur ausdrücklich optionale Funktion zurückgestellt, mit Entscheidung/Grund und akzeptierter Konsequenz.
- `NOT RUN`: nicht ausgeführt; bei Pflichttest als nicht abgenommen werten.

**Gewöhnlicher Implementierungsfehler:** Im freigegebenen Gate beheben und betroffene Prüfungen erneut ausführen; dafür ist keine neue Nutzerentscheidung nötig.

**Struktureller Blocker:** Wenn eine externe Pflichtvoraussetzung fehlt, die gewählte Technologie eine Pflichtfunktion nicht erfüllt oder eine Änderung von Umfang/Architektur nötig wird: abhängige Arbeit stoppen → reproduzierbaren Befund und Auswirkungen vorlegen → sinnvolle Alternativen mit Aufwand/Risiko → Nutzerentscheidung. Unabhängige, bereits autorisierte Arbeit im selben Gate darf abgeschlossen werden. Keine stillen Technologie-Fallbacks, grünen Schein-Checks oder verdeckte Reduktion der Testlast.

Alle Freigaben gelten in ihrem ausdrücklich erteilten Umfang weiter. Nach einem Gate beginnt keine weitere Phase automatisch. Ein technischer PASS ersetzt bei G5 nicht die menschliche Gameplay-Abnahme.

### 10.2 Vier unabhängige Entscheidungen

1. **Technischer Gate-Abschluss:** Tests und dokumentierte Kriterien erfüllt.
2. **Review/Merge-Freigabe:** PR darf in `main`.
3. **Nächstes Gate freigegeben:** Agent darf weitere Phase beginnen.
4. **Deployment-Freigabe:** Vorschau/Release darf aktualisiert werden.

Diese Freigaben nicht miteinander verwechseln oder automatisch aus einem grünen PR ableiten.

### 10.3 Verifizierter Stand

Jeder Bericht enthält:

```text
Gate: Gx
Repository: owner/repo
Branch + HEAD SHA: ...
PR-Nummer + getesteter PR-HEAD-SHA: ...
Merge-Commit SHA: ... / N/A
Deployed Commit/Build-ID: ... / N/A
Testumgebung: Defold/Box2D/Bob/JDK/OS/Gerät
Pflichttests: PASS n / FAIL n / BLOCKED n / NOT RUN n
Optionaltests: PASS n / DEFERRED n / ...
Verifikation: exakte Commands, Logs, CI-Run-URLs, Artefakte
Resultat: PASS | FAIL | BLOCKED
Offene Punkte: ...
Empfehlung: MERGE | NACHBESSERN | STOP
Weitere Phase begonnen: NEIN
```

Test- und Deploy-Aussagen nur für **genau** den genannten Commit. PR-Test nicht ohne erneute Prüfung als Beweis für späteren Merge/Deployment verwenden.

---

## 11. Repo-Dateien und Dokumente

Dokumentation wächst mit dem jeweiligen Gate. G0 erzeugt kurze Vorlagen für spätere Nachweise, keine erfundenen Prüfergebnisse und keinen vollständigen Dokumentationsapparat.

| Gate | Tatsächlich benötigte Dateien/Inhalte |
|---|---|
| G0 | README, AGENTS.md, .gitignore, .gitattributes, .editorconfig, renovate.json, CI-Workflow, doctor.ps1/.sh, TOOLCHAIN_CANDIDATES, kurze Architekturentscheidung und G1-Abnahmevorlage |
| G1 | game.project, verifiziertes App Manifest, minimale Collections/Skripte/Ressourcen, minimaler ausführbarer Smoke-Runner, API_COMPATIBILITY, PHYSICS_UNITS, PHYSICS_LIFECYCLE, RESOURCE_OWNERSHIP, TOOLCHAIN_LOCK |
| G2 | build-/verify-Skripte für Windows und Linux, TESTING, DEPENDENCIES, Ergebnisschema und Artefaktkonvention |
| G3 | SANDBOX_CONTRACT, PLATFORM_MATRIX mit tatsächlichen Geräte-/Browserständen |
| Vor G5 | DATA_CONTRACT für Testtraces/Configs und COLLISION_MATRIX |
| G6 | PERFORMANCE_BUDGET und Messprotokolle |

`docs/DECISIONS/` enthält nur tatsächlich getroffene Entscheidungen. Weitere Verzeichnisse entstehen bei Bedarf: `core/`, `physics/`, `sandbox/`, `vehicle/`, `input/`, `ui/`, `content/`, `assets/debug/`, `tests/`. Keine leeren Module zur Erfüllung eines Baumdiagramms.

G0 erstellt **kein** game.project, App Manifest oder lauffähiges Physikprojekt. Der Bootstrap-Check prüft Repository-Hygiene, Konfiguration und Doctor-Verhalten. Ein fehlendes später benötigtes Tool ist ein dokumentierter Befund; ein fehlerhaftes Doctor-Skript ist ein G0-Fehler. G0-Pflichten und spätere Toolchain-Bereitschaft werden getrennt gezählt.

**Jede Designentscheidung** bekommt einen kurzen Eintrag mit Problem, gewählten Alternativen, Grund, Verifikation, Grenzen und Entscheidungsdatum.

---

## 12. Verbindliche erste Arbeitsanweisung für Codex (nur G0)

```text
PROJECT: New Buggy Lab (repository: bongohorse/rider)
TASK: G0 — New repository and verifiable toolchain foundation

Do NOT edit bongohorse/buggy and do NOT import old game code.

1. Inspect actual GitHub capabilities. Create the new repository if authorized.
   If repo creation is unavailable, STOP with the exact minimum user action.
   Local bootstrap alone does NOT mean G0 passed.
2. Establish a clean default branch, development branch and draft PR.
3. Prepare repository bootstrap only: minimal documentation,
   .gitignore, .gitattributes, .editorconfig, README and AGENTS.md.
   Do NOT create game.project, an app manifest or a runnable Defold project.
   Those belong to G1.
4. Record Defold 1.14.0, compatible Bob, OpenJDK 25 and Automation
   Bridge 2.5.0 as CANDIDATES, not as verified common pins.
5. Verify candidate source tags, checksums, license and platform scope.
6. Create doctor scripts for Windows/CI and minimal real bootstrap CI.
   Separate G0 script correctness from missing tools required in later gates.
   Record native buildserver/network requirements without implementing G2.
7. Add Renovate with controlled dependency discovery and updates.
   Verify app access and at least one actual scan against existing dependencies.
   Missing app permissions or scan evidence remain BLOCKED.
   Do not approve untested major upgrades or runner migration.
8. Create one concise G1 acceptance template for Box2D v3, Wheel Joint,
   units, ownership, lifecycle, reset and early Android debug build.
   Include the 60 Hz baseline and four substeps as a candidate to verify.
   Engine/Bob/JDK pins follow G1; Bridge pin follows G2.
   Official CLI/HTTP automation is permitted; community MCP is optional.
   Document Collision Object body ownership, joint cleanup, explicit Lua
   session state and the acceptance contract for a G1 smoke runner.
   Do NOT implement that runner in G0.
   Record who can actually execute each platform test; never assume
   local Windows/editor or Android access from a cloud environment.
9. Test everything actually testable in G0 and capture real evidence.
10. Return a concise gate report with exact SHAs, PR, CI URL,
    PASS/FAIL/BLOCKED counts and reasons.

Hard rules:
- Do not begin G1.
- Do not implement vehicle gameplay, Sandbox UI or production assets.
- Do not install a custom Box2D extension.
- Never claim a test passed without execution evidence.
- Fix ordinary in-scope errors autonomously; stop dependent work for
  structural blockers requiring a scope or technology decision.
- Respect existing authorizations; do not infer permission for G1.
- Do not merge or deploy without separate authorization.

STOP after G0 and request review/merge decision.
```

---

## 13. Primäre technische Quellen

- Defold 1.14.0 Release: https://defold.com/2026/10/12/Defold-1-14-0/
- Defold Physics (Backend, Fixed Timestep, Scale, Proxy-Welten): https://defold.com/manuals/physics/
- Body-/World-Ownership (`b2d`): https://defold.com/ref/b2d-lua/
- Defold Lua API, Stable-Übersicht: https://defold.com/ref/overview_defoldlua/
- Editor HTTP API: https://defold.com/manuals/editor-http-api/
- Engine-Service: https://defold.com/manuals/engine-service/
- Automated Testing: https://defold.com/manuals/automated-testing/
- Bob (JDK und Native-Buildserver): https://defold.com/manuals/bob/
- Native Extensions: https://defold.com/manuals/extensions/
- Projekteinstellungen (Substeps/Fixed Timestep): https://defold.com/manuals/project-settings/
- Offizielle Automation Bridge: https://github.com/defold/extension-automation-bridge
- Bridge Asset-Metadaten (Releases/Min-Version): https://github.com/defold/asset-portal/blob/master/assets/automation-bridge.json
- Community MCP (nur Kandidat): https://github.com/Fulviuus/defold-mcp

**Quellenregel:** Maßgeblich ist der API-Stand passend zur **tatsächlich gebauten Engine**, nicht ein veralteter Stable-Suchtreffer. Entscheidungen über verfügbare APIs nur nach realen Builds und Runtime-Tests.


## 14. Dokument- und Abnahmestatus

Diese Fassung ist ein Plan, kein ausgeführter Testbericht. Veröffentlichungsangaben und technische Quellen sind von den projektspezifischen Kompatibilitätsnachweisen zu unterscheiden. Vor Umsetzung muss der Agent die tatsächlich zugänglichen Versionen, Berechtigungen und Umgebungen prüfen.

Jeder Gate-PR enthält nur den freigegebenen Umfang. Abnahmegrenzen, fehlende Geräte und nicht geprüfte Plattformen werden sichtbar benannt. Eine akzeptierte Ausnahme wird mit betroffenem Kriterium, Risiko, Verantwortlichem und Nachholbedingung dokumentiert; der ursprüngliche Pflichttest bleibt BLOCKED/NOT RUN und wird nicht nachträglich PASS genannt.
