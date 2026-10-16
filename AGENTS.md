# Rider agent rules

Repository: `bongohorse/rider`; sole implementation source. Inspect branch, HEAD and working tree before editing; preserve existing work. Do not import old buggy code/assets.

## Read only the task context

Read [STATUS.md](STATUS.md), the current issue and its affected contract. [Documentation index](docs/README.md) routes additional reading. Do not read the entire history or every contract by default. [PLAN.md](docs/PLAN.md) defines decisions, issue/milestone workflow, scope and stop points; historical gate instructions do not override it.

## Execution

- S1–S3 preparation and Claudio's design feedback are recorded in STATUS.md. Comfort, preset strength and crash fairness are decided through playable trials, not demanded upfront. Within an approved milestone: take the next issue with completed dependencies, one issue per PR, review/fix, run affected checks and merge only with green `required` for the current head. Never weaken assertions for green CI.
- After each completed step, briefly report what changed and what comes next. At milestone completion, stop, give the preview URL and request Claudio's drive test; wait for approval before the next milestone.
- Ordinary in-scope failures: fix autonomously. Structural blockers: stop affected work, report evidence and alternatives; continue independent authorized work.
- Keep [STATUS.md](STATUS.md) as the only current progress/blocker source. Evidence rules and status definitions live in [evidence policy](docs/contracts/evidence.md). Never invent builds, tests, screenshots or device observations.
- Public HTML5 preview deployment on main merges and manual dispatch is permanently authorized. Store distribution remains a later phase. Android first; no iOS builds before Phase G.

## Technical boundaries

- Keep the pinned toolchain and Renovate without automerge. Use Defold-owned bodies/worlds and a single tick owner; no custom physics extension, second simulation loop or manual stepping. Convert units once at the boundary; preserve handle/reset contracts.
- Read [engine pitfalls](docs/contracts/engine-pitfalls.md) before physics/engine changes; add an entry only under its three-part rule.
- Read [engine references](docs/ENGINE_REFERENCES.md) before Defold-dependent changes; consult only relevant official docs and pinned sources. Verify signatures, units, defaults, ownership, timing and platform limits. Record sources actually read, version, consequence and verification in the PR; justified N/A for no API impact. Inaccessible required references stop dependent work when correctness remains unresolved.
- The Bridge is debug automation, not a physics binding. Keep its pin and matching wrapper, record unresolved license provenance, and remove it from release builds before app distribution (Phase B). Do not assume an editor/session or scan ports; discover `/openapi.json` only for an available authorized editor.
- English UI and active agent docs; platform-neutral gameplay commands. Real APK and real browser device evidence are separate; synthetic input does not prove real touch or app/tab switching.
- No secrets in logs/PRs; no unreviewed install scripts; use minimum CI permissions. Do not publish editor/runtime debug services.

## Verification

Use [TOOLING.md](docs/TOOLING.md). Baseline: `python tools/bootstrap_check.py`, `python -m unittest discover -s tests/bootstrap -v`, and affected `tests/g1` / `tests/g2`. Dependency changes also run Renovate validation/extraction. CI's `required` aggregates bootstrap, Renovate, native/HTML5 physics, Bridge and Android verification.
