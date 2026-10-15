[Documentation index](../../README.md)

# 8. Automation, MCP und Test-Tooling

### 8.1 Drei getrennte Defold-Schnittstellen

1. **Editor HTTP API:** Offenes Editorprojekt, Ressourcen, Builds, Konsole, editorseitige Aufgaben; `/openapi.json` des *laufenden Editors* ist maßgeblich. Experimentell.
2. **Engine Service:** Eigener Prozess und dynamischer Port pro laufender **Debug**-Engine, etwa `/ping`, `/info`; nicht die Editor-API; Release hat keinen entsprechenden Debug-Dienst.
3. **Automation Bridge:** Offizielle, separate Debug-Native-Extension mit versionierter Engine-Route für Runtime-Inspektion/Eingaben/Screenshots; ihre Plattform-/Featureverfügbarkeit muss erkannt werden. Kein HTML5-Ersatz für Browserautomation.

Offizielle Bob-/HTTP-Automation ist der bereits zugelassene Standardweg innerhalb des freigegebenen Gates. Community-MCP ist optional; ungeeignete oder nicht verfügbare Adapter werden begründet DEFERRED, ohne einen zusätzlichen Freigabeschritt für den Standardweg. Blockiert dieser Standardweg eine Pflichtfähigkeit, bleibt das Gate BLOCKED.

MCP verbindet einen AI-Agenten mit diesen verfügbaren Fähigkeiten, ist kein Backend des Spiels. Kein Hardcoding von Engine-Service-Ports. Keine Veröffentlichung des HTTP-Servers nach außen. Keine MCP-Funktionen behaupten, die der konkrete Agent nicht erreichen kann.

