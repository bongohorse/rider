# Rider

A fresh 2D mobile driving game foundation: Defold, integrated Box2D 3, precise arcade handling and short Trials-inspired obstacle challenges.

**Current phase: G0 — repository and toolchain bootstrap. No playable game exists yet.** No code or assets were migrated from `bongohorse/buggy`.

## Verify the bootstrap

Prerequisites: Git, Python 3.12+, Node 24.11+ for Renovate tooling. Install development tooling with `python -m pip install -r requirements-dev.txt` and `npm ci --ignore-scripts`.

```sh
python tools/bootstrap_check.py
python -m unittest discover -s tests/bootstrap -v
bash tools/doctor.sh --json
npm run renovate:validate
npm run renovate:scan
```

Windows: `pwsh -File tools/doctor.ps1 --json`. The same Python implementation runs on Windows and Linux. Doctor does not install software, contact an editor or print environment secrets.

G0 doctor success means the bootstrap prerequisites work. Missing Defold/Bob/JDK 25 are WARN findings for later gates; `--require-g1` makes those missing prerequisites blocking. A detected tool is not a proven working build.

## Next steps

- [G1 acceptance contract](docs/G1_ACCEPTANCE.md): physics PoC only, after explicit authorization.
- [Toolchain candidates](docs/TOOLCHAIN_CANDIDATES.md): source-verified candidates, not runtime-approved pins.
- [Execution and repository setup](docs/REPOSITORY_SETUP.md): permissions, Renovate and evidence boundaries.
- [Masterplan](docs/BUGGY_LAB_MASTERPLAN_v1.4.1.md) and [review clarifications](docs/DECISIONS/0001-bootstrap-scope.md).

UI and player-facing diagnostics will be English. Landscape is the initial gameplay basis. Android APK and Android Chrome are separate targets. A browser preview will be prepared during G1–G3 and published only within authorized deployment scope; G9 is the production release phase.

## Licensing

No project-wide redistribution license has been selected. Public visibility does not grant a software license. Third-party candidates retain their own terms; unresolved license findings must be cleared before integration.
