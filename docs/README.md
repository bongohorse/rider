# Rider documentation

Index of every active document. Live project state is on GitHub, not in these files: start from the [current-state links](#current-state), then read the current issue and only the documents its task needs. Finished-task reports and bulky test artifacts were removed from the current tree; [technical history](TECHNICAL_HISTORY.md) retains concise findings and immutable Git links. Historical results are not current contracts. Every longer document starts with a **Contents** line: read it, then jump to the section (search for its `## ` heading) instead of reading the whole file.

**Contents:** [Current state](#current-state) · [By task](#by-task) · [All documents](#all-documents)

## Current state

Progress, GOs, owners, blockers and open drive tests change with every merge, so they live only on GitHub ([AGENTS.md](../AGENTS.md#project-state)); these links always show the current state.

| Question | Where |
| --- | --- |
| What may be worked on (GO recorded, dependencies done) | [`status: ready`](https://github.com/bongohorse/rider/issues?q=is%3Aissue+is%3Aopen+label%3A%22status%3A+ready%22) |
| What is in progress | [`status: in progress`](https://github.com/bongohorse/rider/issues?q=is%3Aissue+is%3Aopen+label%3A%22status%3A+in+progress%22) · [open PRs](https://github.com/bongohorse/rider/pulls) |
| What Claudio has to drive or test | [`status: needs drive test`](https://github.com/bongohorse/rider/issues?q=is%3Aissue+is%3Aopen+label%3A%22status%3A+needs+drive+test%22) |
| What waits for a GO | [`status: needs go`](https://github.com/bongohorse/rider/issues?q=is%3Aissue+is%3Aopen+label%3A%22status%3A+needs+go%22) |
| What is blocked and why | [`status: blocked`](https://github.com/bongohorse/rider/issues?q=is%3Aissue+is%3Aopen+label%3A%22status%3A+blocked%22) |
| Order of work | [milestones (waves)](https://github.com/bongohorse/rider/milestones?direction=asc&sort=title) and each epic's sub-issue panel; reasons in [PLAN.md](PLAN.md#work-order) |
| What is deployed | [HTML5 preview](https://bongohorse.github.io/rider/) · [build.json](https://bongohorse.github.io/rider/build.json) |

## By task

| Task | Read |
| --- | --- |
| What is next, what is open | [Current state](#current-state) (GitHub) |
| Open maintainer drive tests | [`status: needs drive test` issues](#current-state); sessions of 2026-11-02 in [ACCEPTANCE.md](ACCEPTANCE.md) |
| Decisions, work order, roadmap, stop points | [PLAN.md](PLAN.md) |
| Writing, labelling, ordering or closing issues | [issue guide](ISSUES.md), [templates](../.github/ISSUE_TEMPLATE/); migrated issue-planning references in [ideas](ideas/README.md), with compatibility pointers under [issue-archive/](issue-archive/) |
| Engineering skills: tracker, triage and domain exploration | [Issue tracker](agents/issue-tracker.md) · [triage roles](agents/triage-labels.md) · [domain docs](agents/domain.md) |
| Gameplay intent, open design choices | [GAME_DESIGN.md](GAME_DESIGN.md), [vehicle contract](contracts/vehicle.md) |
| Buggy handling baseline and A/B experiment plan (#339) | [Feel evidence and protocols](feel/buggy-baseline.md) |
| Wheel rolling-speed ceiling / fast-rotation review (#114) | [Box2D 3.1.0 findings, solutions and the 2026-11-03 decision](feel/wheel-rotation-cap-114.md) |
| Larger-wheel candidates, A/B and drive test (#114 stage 1) | [Debug-only 0.26/0.30 m wheels, measurements and caveats](feel/wheel-size-114-stage1.md) |
| Physics, units, tick owner, reset | [physics contract](contracts/physics.md), [engine pitfalls](contracts/engine-pitfalls.md); measured API table in [G1 baseline](contracts/g1-baseline.md) |
| Engine/API changes (Defold, Box2D) | [engine references](ENGINE_REFERENCES.md), [engine pitfalls](contracts/engine-pitfalls.md) |
| Gym stations, features, test protocols, measured limits | [gym notes](../main/gym/README.md) ([measured limits](../main/gym/README.md#measured-limits)); seams: [A18 protocol](A18_SEAM_PROTOCOL.md) |
| Terrain rendering, perspective and materials (#263, #290, #392) | [Road-look contract](contracts/road-look.md), [material provenance](../main/terrain_material/PROVENANCE.md), [historical evidence](TECHNICAL_HISTORY.md#terrain-rendering-and-road-look) |
| Gameplay loop, coins, gems, fuel, medals and level progression (#262) | [Game design](GAME_DESIGN.md), [historical feature and storage decisions](TECHNICAL_HISTORY.md#gameplay-and-mechanisms) |
| Interactive objects (#280) | [Level-editor contract](contracts/level-editor.md), [historical crate/plate/gate findings](TECHNICAL_HISTORY.md#gameplay-and-mechanisms) |
| Level editor (#118) | [Level-editor contract](contracts/level-editor.md), [historical LE1b measurements](TECHNICAL_HISTORY.md#editor-camera-and-driving-feel) |
| Editor GUI split (#331) | [Inventory scanner](../tools/ci/editor_inventory.py), [historical E0 inventory](TECHNICAL_HISTORY.md#editor-camera-and-driving-feel) |
| Test CLI, runner protocol, release boundary | [automation contract](contracts/automation.md) |
| Native Bridge | [bridge contract](contracts/bridge.md) |
| Setup, build, tests, CI, preview | [TOOLING.md](TOOLING.md), [toolchain lock](TOOLCHAIN_LOCK.md), [historical CI evidence](TECHNICAL_HISTORY.md#ci-and-test-evidence) |
| Gym CI critical path and coverage (#336) | [Two-run Gym profiling and safe candidates](ci/gym-critical-path-2026-11-01.md) |
| Render FPS feasibility and fixed-tick protocol (#340) | [Defold 1.14.0 platform audit and measurement plan](ci/fps-feasibility-2026-11-01.md) |
| Persistence suites in the pinned Defold engine (#385) | [Engine harness, cases, engine rules and limits](ci/persistence-engine-harness.md) |
| Local T3 Code development and Extender | [Setup, commands, host acceptance and rollback](LOCAL_T3_SETUP.md) |
| Device evidence, phone testing | [platform matrix](PLATFORM_MATRIX.md), [phone trial](MOBILE_TRIAL.md) |
| Status values and reporting | [evidence policy](contracts/evidence.md) |
| Unscheduled ideas (do not implement) | [ideas](ideas/README.md) |

## All documents

| Document | Purpose | Sections |
| --- | --- | --- |
| [AGENTS.md](../AGENTS.md) | Rules for every AI agent; [CLAUDE.md](../CLAUDE.md) and [GEMINI.md](../GEMINI.md) only import it | Start · Project state · Workflow · Technical boundaries · Verification · Agent skills |
| [agents/issue-tracker.md](agents/issue-tracker.md) | GitHub tracker operations for engineering skills; issue-guide authority and PR purpose | — |
| [agents/triage-labels.md](agents/triage-labels.md) | Skill triage roles mapped to Rider's existing labels and workflow | — |
| [agents/domain.md](agents/domain.md) | Single-context domain documentation consumer rules; create files only when needed | — |
| [ACCEPTANCE.md](ACCEPTANCE.md) | Record of the 2026-11-02 drive-test sessions (#404); open items are issues | How to run a session · Results 2026-11-02 · Session 1: desktop editor · Session 2: desktop driving and stations · Session 3: phone · Session 4: vehicle feel (deferred) · Recording results |
| [PLAN.md](PLAN.md) | Goal, decisions D1–D13, work order, roadmap | Goal · Decisions · Work order · Roadmap · Stop points · Later phases |
| [ISSUES.md](ISSUES.md) | Issue kinds, sub-issues, required sections, length, labels, waves, GO/owner/status | Kinds and hierarchy · Required sections · Length · Labels · Milestones and order · GO, owner and status · Titles · Updating and closing · Checklist |
| [issue-archive/](issue-archive/) | Legacy link compatibility; eight long briefs now live under [ideas](ideas/README.md), while #120/#198 are separately consolidated in PRs [#488](https://github.com/bongohorse/rider/pull/488) / [#489](https://github.com/bongohorse/rider/pull/489) | Historical only; use the live issue for status and scope |
| [GAME_DESIGN.md](GAME_DESIGN.md) | Design brief | Core loop and duration · Controls and feel trials · Crash, recovery and checkpoints · Identity and fun acceptance |
| [feel/buggy-baseline.md](feel/buggy-baseline.md) | Historical vs missing feel evidence, preset A–F, two reproducible protocols (#339) | System and preset inventory · Evidence and gaps · Two reproducible protocols · Candidate hypotheses and stop points · Verification and limitations |
| [feel/wheel-rotation-cap-114.md](feel/wheel-rotation-cap-114.md) | Pinned 60-Hz wheel rotation cap, upstream/Defold API gap, options and the two-stage fix decided 2026-11-03 (#114) | Decision summary · Source-backed mechanism · Rider calculations and evidence · Solutions and tradeoffs · Investigation order (pre-decision) · Reproducible test protocol · Acceptance and stop points · References and evidence status |
| [feel/wheel-size-114-stage1.md](feel/wheel-size-114-stage1.md) | Debug-only 0.26/0.30 m wheel candidates, gating, real-engine A/B against A and Claudio's drive test (#114 stage 1); historic measured artifacts in [technical history](TECHNICAL_HISTORY.md#editor-camera-and-driving-feel) | Result in short · Design · Method · Wheel A/B (w114) · Existing station runners · Preset A unchanged · Caveats · Drive test · Engine sources · Verification |
| [TECHNICAL_HISTORY.md](TECHNICAL_HISTORY.md) | Concise technical findings and permanent Git links to retired reports and test artifacts | Purpose · Terrain rendering and road look · Gameplay and mechanisms · Editor, camera and driving feel · CI and test evidence |
| [TOOLING.md](TOOLING.md) | Commands and operations | Prerequisites · Commands · Affected suites · Gym tests · Local environment · Worktrees · CI and required check · Agent CI completion watch · Dependencies and Renovate · Preview deployment · Gemini read-only reviewer setup |
| [LOCAL_T3_SETUP.md](LOCAL_T3_SETUP.md) | T3/WSL preparation, loopback builds, focused tests and host activation | Target setup · Install and connect T3 Code · Provision local Extender · Daily commands · Cache and worktree rules · Agent handoff · Host acceptance · Rollback · Sources and maintenance |
| [ci/gym-critical-path-2026-11-01.md](ci/gym-critical-path-2026-11-01.md) | Two-run Gym critical path, six-group fixture/coverage map and bounded optimization candidates (#336) | Evidence and comparability · Timing and critical path · Six-group regression map · Safe follow-up candidates · Preservation and verification |
| [ci/fps-feasibility-2026-11-01.md](ci/fps-feasibility-2026-11-01.md) | Defold 1.14.0 frame pacing, HTML5/Android caveats, fixed 60-Hz tick and future measurement gates (#340) | Pinned source and invariant · Platform feasibility · Existing ownership and UI · Future minimal implementation · Reproducible verification · Decision and evidence limits |
| [ci/persistence-engine-harness.md](ci/persistence-engine-harness.md) | Pinned Defold headless harness for the persistence Lua suites (#385) | Purpose · Run · CI · Evidence and limits |
| [TOOLCHAIN_LOCK.md](TOOLCHAIN_LOCK.md) | Pinned Defold/Bob/JDK/Bridge and update rules | — |
| [ENGINE_REFERENCES.md](ENGINE_REFERENCES.md) | Official Defold/Box2D sources | Read only what the task needs · Defold · Box2D · Automation Bridge · Build, platforms and gameplay evidence · Maintenance |
| [PLATFORM_MATRIX.md](PLATFORM_MATRIX.md) | Evidence per platform and device | — |
| [MOBILE_TRIAL.md](MOBILE_TRIAL.md) | Reference-phone test procedure | Touch and layout · Coasting and HUD · Comparable phone captures · Tilt comparison |
| [A18_SEAM_PROTOCOL.md](A18_SEAM_PROTOCOL.md) | Chain vs hull seam experiment (`a18` case) | Revision history · Fixed commands and qualification · Sampling and bump definition · Reproduction · Engine boundary |
| [contracts/physics.md](contracts/physics.md) | Binding physics rules | API and platform · Units · Lifecycle and tick owner · Ownership and reset · Collisions and sensors · Scenario and result data · Pause, slow motion and live tuning · Command playback and ghosts |
| [contracts/g1-baseline.md](contracts/g1-baseline.md) | Measured G1 API/unit matrix and fixture | API and units · Start state · Ownership and cleanup · Running and protocol |
| [contracts/vehicle.md](contracts/vehicle.md) | Vehicle commands and gameplay constraints | — |
| [contracts/engine-pitfalls.md](contracts/engine-pitfalls.md) | Recurring engine traps | — |
| [contracts/automation.md](contracts/automation.md) | Test CLI, runner protocol, release boundary | Interfaces · Test CLI and results · Engine/runner protocol · Release boundary |
| [contracts/bridge.md](contracts/bridge.md) | Native Automation Bridge | Setup and commands · Tested behavior · Limits and license · Network boundary · Network test procedure |
| [road-look.md](contracts/road-look.md) | Bounded look parameters and consumer boundary | Scope and activation · Parameter set v1 · Projection and spaces · Geometry and resources · Controls and retention · Production compatibility · Editor authoring · Consumer boundary |
| [contracts/evidence.md](contracts/evidence.md) | PASS/FAIL/BLOCKED/NOT RUN and reporting | — |
| [contracts/level-editor.md](contracts/level-editor.md) | Level editor rules R1–R18, data model | Rules · Screen layout · Controls · Editing basics · Data model · Prefab library v1 · Storage · Additional checks · Technical constraints |
| [main/gym/README.md](../main/gym/README.md) | Gym implementation and test protocols | See its Contents line |
| [ideas/](ideas/README.md) | Feature ideas, archived plans, active-issue reference briefs and closed-epic history | Roadmap · vehicle builder · procedural generation · feature briefs · history |

Superseded gate records (G0–G3), the v1.4.1 masterplan and the VS Code migration dossier were removed on 2026-10-18; they remain in [git history](https://github.com/bongohorse/rider/tree/764cc01dc94d56448921191405c7f5c601ba42b6/docs/history).
