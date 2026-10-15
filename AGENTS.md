# Rider agent rules

Repository: bongohorse/rider. Treat this repository as the sole implementation source.

## Authorized scope

Current authorization (2026-10-15): autonomously review each PR, fix findings, complete and merge after required checks, then start the next task in plan order. G0 and the documentation split are complete; G1 is complete; G2 is active. Report material findings and stop dependent work for decisions or structural blockers. This user instruction supersedes the earlier stop-after-G1 rule.

- Inspect branch, HEAD, working tree and these instructions before editing.
- Preserve existing work. Never import old buggy scripts, vendor physics, rendering code or assets.
- Keep the documentation split separate from engine implementation. Once integrated, G1 may add the minimal project, app manifest and smoke runner; no complete buggy or sandbox UI.
- Use integrated Defold Box2D 3 in later gates. No custom physics extension or second simulation loop.
- Candidate versions are not runtime-approved. Record exact source identity and actual evidence; no invented builds or screenshots.
- Defold owns collision-object bodies and collection worlds. Prove units, ownership and lifecycle in G1. Never depend on ordering between script instances.
- UI is English. Mobile APK and browser tests are separate; synthetic events do not prove real app/tab switching.
- Fix ordinary in-scope failures autonomously. For structural blockers stop dependent work, document evidence and alternatives. Continue independent work within the active authorized scope.
- Keep PRs reviewable. Run affected checks. Never weaken assertions or suppress errors for green CI.
- Keep FAIL, BLOCKED, NOT RUN and PASS distinct. Missing optional future tools do not fail bootstrap correctness.
- Do not expose tokens or run unreviewed installation scripts. No production secrets in PR jobs.
- Merge/deployment authorization persists within its granted scope. Do not request it repeatedly when already granted. Never infer permission to start G1 from a merge.
- End each gate with exact tested SHA, PR and CI links, limitations and next recommendation; then continue in plan order under the user-authorized loop.

## Bootstrap checks (retain through G1; adapt G0-only boundaries explicitly when G1 starts)

`python tools/bootstrap_check.py`
`python -m unittest discover -s tests/bootstrap -v`
`bash tools/doctor.sh --json` or `pwsh -File tools/doctor.ps1 --json`
`npm ci --ignore-scripts && npm run renovate:validate && npm run renovate:scan`

## Documentation routing

Read `docs/README.md` and `docs/G2_ACCEPTANCE.md` first. Then open `docs/gates/G2.md` and only the relevant topic files linked by the index. Do not read all docs or the old masterplan from top to bottom. Physics edits require the affected API/units/lifecycle/ownership contracts; runner edits require the test protocol. Historical G0 prompts do not override current authorization. Scoped acceptance documents define the active gate.
