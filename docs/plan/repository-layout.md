[Documentation index](../README.md)

# 11. Repo-Dateien und Dokumente

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
