# Rider agent rules

These rules apply to every AI agent working in this repository. `CLAUDE.md` and `GEMINI.md` only import this file.

## Start

- `bongohorse/rider` is the only source; do not reuse code or assets from any earlier Rider prototype or other project outside this repository.
- Check branch, HEAD and working tree before editing; preserve existing changes.
- Read the current issue, its epic and the contracts it touches. The [documentation index](docs/README.md) routes further reading; [PLAN.md](docs/PLAN.md) defines decisions, the [work order](docs/PLAN.md#work-order) and stop points.
- Create, update and close issues per the [issue guide](docs/ISSUES.md): templates, sub-issues of the owning epic, type/area/priority/status labels and a wave milestone.
- Longer docs start with a **Contents** line: read it and jump to the needed section instead of reading the whole file. Keep that line in sync when you add, rename or remove a `## ` section.

## Project state

- Live state lives only on GitHub: GOs, owners, progress and blockers in issue comments and `status:` labels, open drive tests as issues labelled `status: needs drive test`, order in milestones and sub-issues, evidence in PRs. The [current-state links](docs/README.md#current-state) open these views.
- Never write current state into repository files (no status file, dated snapshots or "currently open" lists). Docs hold rules, contracts, decisions and immutable reports; a report may state its historical outcome with its date.

## Workflow

- Work only within approved scope: an issue with a recorded GO ([GO protocol](docs/ISSUES.md#go-owner-and-status)) and completed dependencies, one issue per PR, one writing agent per task.
- Decisions: Claudio decides GOs, scope, priorities and acceptance. A coordinator he appoints decides only within the authority recorded in pinned issue [#333](https://github.com/bongohorse/rider/issues/333), which also names it. Human acceptance — drive tests, real phone or device checks, art direction — is never delegated, inferred or replaced by synthetic tests.
- Parallel work: several agents may work at once, one writing agent per task, each in its own worktree and branch ([worktrees](docs/TOOLING.md#worktrees)). Never switch branches or edit files in another agent's checkout. A stop point or blocker in one task does not stop independent tasks.
- Ownership first: before any local work, assign the issue, set `status: in progress` and post an owner comment naming agent, branch and worktree. No ownership comment, no work; never pick up a branch or worktree someone else owns without a handoff comment.
- At most three writing agents at once, plus the integrator.
- Shared files (registries, CI lists): add or change only your task's entries; whoever rebases keeps everyone else's.
- Merging: one integrator merges — the coordinator named in #333, or a session it names there — and #333 records the merge order. Writers bring their PR to a green `required` with a recorded review, comment "ready to merge" and then stop pushing. They do not rebase or merge themselves. `main` does not require up-to-date branches. The integrator merges a PR at its green head unless it conflicts or shares changed paths with a PR merged after its last green run; only then it rebases, re-checks locally and waits for a new green `required`. After each merge the `main` push CI must turn green; if it fails, the integrator fixes forward or reverts before the next merge.
- Stop where PLAN.md says (milestone end, or after each task where stated): give the preview URL, put the drive-test steps into the issue with `status: needs drive test` and wait for a new GO.
- Fix ordinary failures yourself. On a structural blocker, stop the affected work, label the issue `status: blocked` with a comment giving evidence and options, and continue independent work.
- Local development: use the [T3 setup and commands](docs/LOCAL_T3_SETUP.md), run fast and affected real-input checks and correct failures before pushing a coherent change. Keep local Git checkpoints; do not push every correction just to get test feedback. A focused local PASS is not a full-suite pass; final current-head CI/review remains required.
- Watch your PR's CI yourself instead of asking the maintainer ([how](docs/TOOLING.md#agent-ci-completion-watch)); on failure, read the logs and fix.
- Review: every PR gets an independent read-only review (an agent or person other than the writer) of its final change. Post its findings and the resolution of each — fixed, or declined with a reason — as a PR comment; must-fix findings are fixed before merge.
- Merge only with a green `required` check for the current head, that recorded review and existing authorization. Never weaken tests or assertions, bypass CI, or change branch protection, secrets or credentials.
- After each step, briefly report what changed and what comes next. Record progress and blockers on the issue, evidence in the PR.
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

- Follow [TOOLING.md](docs/TOOLING.md). Every change runs `python tools/bootstrap_check.py`, `python tools/ci/lint_lua.py` and `python -m unittest discover -s tests/bootstrap -v`, plus every suite that the [affected-suites table](docs/TOOLING.md#affected-suites) lists for the paths it changes.
- Dependency changes also run Renovate validation/extraction.
