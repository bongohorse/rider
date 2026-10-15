[Documentation index](../../README.md)

# 8.2 Test-CLI-Vertrag spätestens G2

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

