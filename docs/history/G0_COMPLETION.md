> Historical record, superseded for current work by [PLAN.md](../PLAN.md). Old status, scope and authorization statements are not current instructions.

# G0 completion — Rider

Date: 2026-10-15. Result: **PASS for G0 repository/bootstrap scope**. G1 remains unapproved and not started.

## Integrated and tested source

- Repository: [bongohorse/rider](https://github.com/bongohorse/rider).
- Implementation PR: [#1](https://github.com/bongohorse/rider/pull/1).
- Tested implementation PR head: `dfdfce4d763bba9322677852fe5b90e54564263a`.
- Integrated source/main SHA: `cfe168a052471665b59856ca6b33ed0867b78c15`.
- [Implementation PR CI](https://github.com/bongohorse/rider/actions/runs/38673590655): all three jobs passed.
- [Main CI for that exact merge SHA](https://github.com/bongohorse/rider/actions/runs/38673688733): all three jobs passed.
- This follow-up changes documentation only. Its own PR and required CI identify its exact later documentation commit; the implementation evidence above is not presented as testing a later SHA.

## Verification

| Check | Result | Evidence / boundary |
|---|---|---|
| Repository bootstrap and no legacy/game implementation | PASS | File-boundary checks; no game.project or app manifest |
| Python bootstrap regression suite | PASS | Five cases on Linux and Windows, plus local Linux |
| Doctor wrappers | PASS | Linux shell and Windows PowerShell in CI; no engine-runtime claim |
| Strict Renovate configuration validation | PASS | CI and local pinned Renovate 44.161.0 |
| Real dependency extraction | PASS | 11 entries: GitHub Actions 8, npm 2, pip requirements 1; guarded against empty extraction |
| Hosted Renovate access/detection | PASS | renovate[bot] created [Dashboard #4](https://github.com/bongohorse/rider/issues/4); onboarding #2 closed after repository config reached main |
| Main protection and required CI | PASS | Fresh branch metadata: protected=true; exact three check names; enforcement=everyone; source GitHub Actions app ID 15368 |
| Detailed protection options | USER-CONFIRMED | User saved settings; screenshot guided correction of required checks. Full admin endpoint is inaccessible to integration |
| New documentation integration | Required CI | Follow-up PR must pass protection normally; no bypass |

Commands used: `python tools/bootstrap_check.py`, `python -m unittest discover -s tests/bootstrap -v`, `bash tools/doctor.sh --json`, `pwsh -File tools/doctor.ps1 --json`, `npm run renovate:validate`, `npm run renovate:scan`.

CI uses Ubuntu 24.04, Windows Server 2025, Python 3.14.8 and Node 24.21.0 where required. Local verification used Linux, Python 3.12.14 and Node 24.19.0. The first Windows run found Python 3.12.14 unavailable as a Windows binary; the compatible CI pin was corrected using the official versions manifest, then the required checks passed. No assertions were removed.

## Delivered

README/agent rules, repository hygiene, scoped G1 acceptance, adapted masterplan and review clarifications, source-provenance candidate data, shared read-only doctor, bootstrap regression checks, SHA-pinned CI, locked developer tooling and conservative Renovate configuration. Generated artifacts stay outside Git.

## Remaining future-gate work

- Engine/Bob/JDK25 project builds and physics assertions: **NOT RUN**, G1 scope.
- Interactive Windows/browser and physical Android behavior: **NOT RUN**, later gates.
- Bridge 2.5.0 license/distribution permission: unresolved before G2; no Bridge code integrated.
- Defold dependency manager detection: prove when actual dependencies are introduced, not through candidate metadata alone.
- Ubuntu 26.04 upgrade remains unapproved; keep Ubuntu 24.04 baseline.
- Deployment: **NOT RUN**; no playable preview is claimed.

No missing future prerequisite is presented as an engine/platform PASS. Stop after G0; next action requires explicit G1 authorization.
