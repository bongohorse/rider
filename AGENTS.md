# Rider agent rules

Repository: bongohorse/rider. Treat this repository as the sole implementation source.

## Authorized scope

Current implementation phase is G0 only. Complete and verify repository bootstrap; stop before G1. The user authorized repository administration and integration for this setup. This does not authorize later gameplay phases.

- Inspect branch, HEAD, working tree and these instructions before editing.
- Preserve existing work. Never import old buggy scripts, vendor physics, rendering code or assets.
- No game.project, app manifest, runnable physics project or G1 smoke-runner implementation in G0. Only document G1 acceptance requirements.
- Use integrated Defold Box2D 3 in later gates. No custom physics extension or second simulation loop.
- Candidate versions are not runtime-approved. Record exact source identity and actual evidence; no invented builds or screenshots.
- Defold owns collision-object bodies and collection worlds. Prove units, ownership and lifecycle in G1. Never depend on ordering between script instances.
- UI is English. Mobile APK and browser tests are separate; synthetic events do not prove real app/tab switching.
- Fix ordinary in-scope failures autonomously. For structural blockers stop dependent work, document evidence and alternatives. Continue independent authorized G0 work.
- Keep PRs reviewable. Run affected checks. Never weaken assertions or suppress errors for green CI.
- Keep FAIL, BLOCKED, NOT RUN and PASS distinct. Missing optional future tools do not fail bootstrap correctness.
- Do not expose tokens or run unreviewed installation scripts. No production secrets in PR jobs.
- Merge/deployment authorization persists within its granted scope. Do not request it repeatedly when already granted. Never infer permission to start G1 from a merge.
- End each gate with exact tested SHA, PR and CI links, limitations and next recommendation; no later gate automatically.

## G0 checks

`python tools/bootstrap_check.py`
`python -m unittest discover -s tests/bootstrap -v`
`bash tools/doctor.sh --json` or `pwsh -File tools/doctor.ps1 --json`
`npm ci --ignore-scripts && npm run renovate:validate && npm run renovate:scan`

Use docs/G1_ACCEPTANCE.md for the next phase. Full plan is background; scoped acceptance documents determine which work belongs to the active gate.
