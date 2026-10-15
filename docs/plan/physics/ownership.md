[Documentation index](../../README.md)

# 5.4 Ownership/Reset-Vertrag (`docs/RESOURCE_OWNERSHIP.md`)

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

