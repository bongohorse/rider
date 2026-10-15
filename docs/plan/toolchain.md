[Documentation index](../README.md)

# 3. Versionen, Quellen und Abhängigkeiten

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

