# Rider agent rules

These rules apply to every AI agent working in this repository.

## Start

- `bongohorse/rider` is the only source; do not reuse code or assets from the old project.
- Check branch, HEAD and working tree before editing; preserve existing changes.
- Read [STATUS.md](STATUS.md), the current issue and the contracts it touches. The [documentation index](docs/README.md) routes further reading; [PLAN.md](docs/PLAN.md) defines scope, order and stop points.
- Longer docs start with a **Contents** line: read it and jump to the needed section instead of reading the whole file. Keep that line in sync when you add, rename or remove a `## ` section.

## Workflow

- Work only within approved scope: the next issue with completed dependencies, one issue per PR, one writing agent per task.
- Stop where PLAN.md says (milestone end, or after each task where stated): give the preview URL, request Claudio's drive test and wait for a new GO.
- Fix ordinary failures yourself. On a structural blocker, stop the affected work, report evidence and options, and continue independent work.
- Watch your PR's CI yourself instead of asking the maintainer ([how](docs/TOOLING.md#agent-ci-completion-watch)); on failure, read the logs and fix.
- Merge only with a green `required` check for the current head, completed review and existing authorization. Never weaken tests or assertions, bypass CI, or change branch protection, secrets or credentials.
- After each step, briefly report what changed and what comes next. Record progress and blockers only in STATUS.md.
- Never invent builds, tests, screenshots or device observations ([evidence policy](docs/contracts/evidence.md)).
- Agents used only for review or ideas work read-only and get no credentials ([setup](docs/TOOLING.md#gemini-read-only-reviewer-setup)).

## Technical boundaries

- Keep the pinned toolchain; Renovate without automerge.
- Physics: Defold-owned bodies and worlds, single tick owner; no custom physics extension, second simulation loop or manual stepping. Convert units once at the boundary; keep handle/reset contracts. Read the [physics contract](docs/contracts/physics.md) and [engine pitfalls](docs/contracts/engine-pitfalls.md) before physics/engine changes.
- For new or changed Defold API use, check [engine references](docs/ENGINE_REFERENCES.md) and cite the sources in the PR.
- The Automation Bridge is debug-only: never expose debug services or scan ports.
- English UI and agent docs; platform-neutral gameplay commands.
- Synthetic input does not prove real touch, device or app-switch behavior.
- No secrets in logs or PRs, no unreviewed install scripts, minimal CI permissions.

## Verification

- Follow [TOOLING.md](docs/TOOLING.md). Baseline: `python tools/bootstrap_check.py`, `python -m unittest discover -s tests/bootstrap -v` and affected `tests/g1`, `tests/g2`, `tests/ci`, `tests/mobile`.
- Dependency changes also run Renovate validation/extraction.
