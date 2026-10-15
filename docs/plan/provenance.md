[Documentation index](../README.md)

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

