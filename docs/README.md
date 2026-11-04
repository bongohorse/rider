# Rider documentation

Index of every active document. Live project state is on GitHub, not in these files: start from the [current-state links](#current-state), then read the current issue and only the documents its task needs. Finished task reports and their recorded evidence (JSON, logs, screenshots) live in [reports/](reports/); they are historical records, not current contracts. Every longer document starts with a **Contents** line: read it, then jump to the section (search for its `## ` heading) instead of reading the whole file.

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
| Gameplay intent, open design choices | [GAME_DESIGN.md](GAME_DESIGN.md), [vehicle contract](contracts/vehicle.md) |
| Buggy handling baseline and A/B experiment plan (#339) | [Feel evidence and protocols](feel/buggy-baseline.md) |
| Wheel rolling-speed ceiling / fast-rotation review (#114) | [Box2D 3.1.0 findings, solutions and the 2026-11-03 decision](feel/wheel-rotation-cap-114.md) |
| Larger-wheel candidates, A/B and drive test (#114 stage 1) | [Debug-only 0.26/0.30 m wheels, measurements and caveats](feel/wheel-size-114-stage1.md) |
| Physics, units, tick owner, reset | [physics contract](contracts/physics.md), [engine pitfalls](contracts/engine-pitfalls.md); measured API table in [G1 baseline](contracts/g1-baseline.md) |
| Engine/API changes (Defold, Box2D) | [engine references](ENGINE_REFERENCES.md), [engine pitfalls](contracts/engine-pitfalls.md) |
| Gym stations, features, test protocols, measured limits | [gym notes](../main/gym/README.md) ([measured limits](../main/gym/README.md#measured-limits)); seams: [A18 protocol](A18_SEAM_PROTOCOL.md) |
| Road look comparison (#290) | [Contract](contracts/road-look.md), [comparison](reports/TERRAIN_PERSPECTIVE_REPORT.md), [production integration](reports/TERRAIN_PERSPECTIVE_INTEGRATION_REPORT.md) |
| Interactive objects (#280) | [Crates, plate modes, linked gates and complete Retry](reports/OBJECTS_O1_REPORT.md) |
| Level selection (#320) | [Durable completion, course selection and Next Level](reports/GAMEPLAY_G7_REPORT.md) |
| Fuel (#318) | [Configurable tank, shared refills and recovery](reports/GAMEPLAY_G6_REPORT.md) |
| Wonder Gems (#314) | [Multiple special pickups, finish banking and feedback](reports/GAMEPLAY_G5_REPORT.md) |
| Ordinary coins (#300) | [Authoring, collection and durable banking](reports/GAMEPLAY_G4_REPORT.md) |
| Medal times (#298) | [Scoring, authoring, revisions and checks](reports/GAMEPLAY_G3_REPORT.md) |
| Course progress (#296) | [Route, limits, HUD and verification](reports/GAMEPLAY_G2_REPORT.md) |
| First playable run (#279) | [Behavior, scoring, persistence and checks](reports/GAMEPLAY_G1_REPORT.md) |
| Terrain Look (#278) | [Authoring report](reports/TERRAIN_LOOK_REPORT.md), [shared contract](contracts/road-look.md#editor-authoring) |
| Terrain materials (#392) | [Stage A renderer spike: Kenney atlas, textured route, temporary URL pilot, measurements](reports/TERRAIN_MATERIAL_A_REPORT.md); atlas [provenance](../main/terrain_material/PROVENANCE.md) |
| Level editor | [level-editor contract](contracts/level-editor.md) (epic [#118](https://github.com/bongohorse/rider/issues/118)); custom level cost: [LE1b report](reports/LE1B_REPORT.md) |
| Splitting the editor GUI script (#331) | [E0 inventory: state, callbacks, messages, hazards, E1 candidates, Gym coverage](reports/EDITOR_E0_INVENTORY.md) |
| Test CLI, runner protocol, release boundary | [automation contract](contracts/automation.md) |
| Native Bridge | [bridge contract](contracts/bridge.md) |
| Setup, build, tests, CI, preview | [TOOLING.md](TOOLING.md), [toolchain lock](TOOLCHAIN_LOCK.md); [CI Speed 3 evidence](reports/CI_SPEED_3_REPORT.md) |
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
| [AGENTS.md](../AGENTS.md) | Rules for every AI agent; [CLAUDE.md](../CLAUDE.md) and [GEMINI.md](../GEMINI.md) only import it | Start · Project state · Workflow · Technical boundaries · Verification |
| [ACCEPTANCE.md](ACCEPTANCE.md) | Record of the 2026-11-02 drive-test sessions (#404); open items are issues | How to run a session · Results 2026-11-02 · Session 1: desktop editor · Session 2: desktop driving and stations · Session 3: phone · Session 4: vehicle feel (deferred) · Recording results |
| [PLAN.md](PLAN.md) | Goal, decisions D1–D13, work order, roadmap | Goal · Decisions · Work order · Roadmap · Stop points · Later phases |
| [ISSUES.md](ISSUES.md) | Issue kinds, sub-issues, required sections, length, labels, waves, GO/owner/status | Kinds and hierarchy · Required sections · Length · Labels · Milestones and order · GO, owner and status · Titles · Updating and closing · Checklist |
| [issue-archive/](issue-archive/) | Legacy link compatibility; eight long briefs now live under [ideas](ideas/README.md), while #120/#198 are separately consolidated in PRs [#488](https://github.com/bongohorse/rider/pull/488) / [#489](https://github.com/bongohorse/rider/pull/489) | Historical only; use the live issue for status and scope |
| [GAME_DESIGN.md](GAME_DESIGN.md) | Design brief | Core loop and duration · Controls and feel trials · Crash, recovery and checkpoints · Identity and fun acceptance |
| [feel/buggy-baseline.md](feel/buggy-baseline.md) | Historical vs missing feel evidence, preset A–F, two reproducible protocols (#339) | System and preset inventory · Evidence and gaps · Two reproducible protocols · Candidate hypotheses and stop points · Verification and limitations |
| [feel/wheel-rotation-cap-114.md](feel/wheel-rotation-cap-114.md) | Pinned 60-Hz wheel rotation cap, upstream/Defold API gap, options and the two-stage fix decided 2026-11-03 (#114) | Decision summary · Source-backed mechanism · Rider calculations and evidence · Solutions and tradeoffs · Investigation order (pre-decision) · Reproducible test protocol · Acceptance and stop points · References and evidence status |
| [feel/wheel-size-114-stage1.md](feel/wheel-size-114-stage1.md) | Debug-only 0.26/0.30 m wheel candidates, gating, real-engine A/B against A and Claudio's drive test (#114 stage 1); evidence in [reports/wheel-size-114/](reports/wheel-size-114/) | Result in short · Design · Method · Wheel A/B (w114) · Existing station runners · Preset A unchanged · Caveats · Drive test · Engine sources · Verification |
| [TOOLING.md](TOOLING.md) | Commands and operations | Prerequisites · Commands · Affected suites · Gym tests · Local environment · Worktrees · CI and required check · Agent CI completion watch · Dependencies and Renovate · Preview deployment · Gemini read-only reviewer setup |
| [LOCAL_T3_SETUP.md](LOCAL_T3_SETUP.md) | T3/WSL preparation, loopback builds, focused tests and host activation | Target setup · Install and connect T3 Code · Provision local Extender · Daily commands · Cache and worktree rules · Agent handoff · Host acceptance · Rollback · Sources and maintenance |
| [CI_SPEED_3_REPORT.md](reports/CI_SPEED_3_REPORT.md) | P1 browser setup, EA3 correction and before/after evidence (#264) | Scope and implementation · Measurements · Failures and verification · Decisions and limits |
| [ci/gym-critical-path-2026-11-01.md](ci/gym-critical-path-2026-11-01.md) | Two-run Gym critical path, six-group fixture/coverage map and bounded optimization candidates (#336) | Evidence and comparability · Timing and critical path · Six-group regression map · Safe follow-up candidates · Preservation and verification |
| [ci/fps-feasibility-2026-11-01.md](ci/fps-feasibility-2026-11-01.md) | Defold 1.14.0 frame pacing, HTML5/Android caveats, fixed 60-Hz tick and future measurement gates (#340) | Pinned source and invariant · Platform feasibility · Existing ownership and UI · Future minimal implementation · Reproducible verification · Decision and evidence limits |
| [ci/persistence-engine-harness.md](ci/persistence-engine-harness.md) | Pinned Defold headless harness for the persistence Lua suites (#385) | Purpose · Run · CI · Evidence and limits |
| [TOOLCHAIN_LOCK.md](TOOLCHAIN_LOCK.md) | Pinned Defold/Bob/JDK/Bridge and update rules | — |
| [ENGINE_REFERENCES.md](ENGINE_REFERENCES.md) | Official Defold/Box2D sources | Read only what the task needs · Defold · Box2D · Automation Bridge · Build, platforms and gameplay evidence · Maintenance |
| [PLATFORM_MATRIX.md](PLATFORM_MATRIX.md) | Evidence per platform and device | — |
| [MOBILE_TRIAL.md](MOBILE_TRIAL.md) | Reference-phone test procedure | Touch and layout · Coasting and HUD · Comparable phone captures · Tilt comparison |
| [TERRAIN_P1_REPORT.md](reports/TERRAIN_P1_REPORT.md) | Isolated flat/depth mesh experiment (#273) | Preview and scope · Geometry and ownership · Measurements · Verification and limits · Engine evidence and reproduction |
| [TERRAIN_P2_REPORT.md](reports/TERRAIN_P2_REPORT.md) | Ordinary Play depth meshes (#274), measurements and resource lifetime | Behavior · Geometry · HTML5 comparison · Resources · Verification · Engine sources |
| [TERRAIN_P5_REPORT.md](reports/TERRAIN_P5_REPORT.md) | Resource admission, 660 m course, Fit/replacement/memory and independent limits (#277) | Behavior and policy · Resource model · Measurements · Verification · Preview and reproduction · Engine evidence and limits |
| [TERRAIN_P4_REPORT.md](reports/TERRAIN_P4_REPORT.md) | Viewport residency, bounded cache, resource/pool and frame comparisons (#276) | Behavior · Policy and ownership · Measurements · Verification · Preview and reproduction · Engine evidence and limits |
| [TERRAIN_P3_REPORT.md](reports/TERRAIN_P3_REPORT.md) | Retained editor meshes, local rebuild/latency and release evidence | Behavior · Dependencies · Ownership · Measurements · Verification · Preview · Engine evidence |
| [TERRAIN_P0_REPORT.md](reports/TERRAIN_P0_REPORT.md) | Curve and mixed-course resource/performance baseline (#272) | Scope and environment · Fixtures and allocations · Measurement method · Results · Cost and limit audit · Recommendation for #273 · Reproduction and verification |
| [LE1B_REPORT.md](reports/LE1B_REPORT.md) | Custom level size, performance and world-switch measurement (`le1b` case) | Summary · Protocol · Desktop results · Phone results · Phone procedure · Findings for later tasks · Reproduction · Engine sources |
| [A18_SEAM_PROTOCOL.md](A18_SEAM_PROTOCOL.md) | Chain vs hull seam experiment (`a18` case) | Revision history · Fixed commands and qualification · Sampling and bump definition · Reproduction · Engine boundary |
| [contracts/physics.md](contracts/physics.md) | Binding physics rules | API and platform · Units · Lifecycle and tick owner · Ownership and reset · Collisions and sensors · Scenario and result data · Pause, slow motion and live tuning · Command playback and ghosts |
| [contracts/g1-baseline.md](contracts/g1-baseline.md) | Measured G1 API/unit matrix and fixture | API and units · Start state · Ownership and cleanup · Running and protocol |
| [contracts/vehicle.md](contracts/vehicle.md) | Vehicle commands and gameplay constraints | — |
| [contracts/engine-pitfalls.md](contracts/engine-pitfalls.md) | Recurring engine traps | — |
| [contracts/automation.md](contracts/automation.md) | Test CLI, runner protocol, release boundary | Interfaces · Test CLI and results · Engine/runner protocol · Release boundary |
| [contracts/bridge.md](contracts/bridge.md) | Native Automation Bridge | Setup and commands · Tested behavior · Limits and license · Network boundary · Network test procedure |
| [TERRAIN_PERSPECTIVE_INTEGRATION_REPORT.md](reports/TERRAIN_PERSPECTIVE_INTEGRATION_REPORT.md) | #292 normal Play/Edit, legacy compatibility and evidence | Scope and settings · Compatibility · Verification · Resources and timings · Reproduction · Limits and stop point |
| [OBJECTS_O1_REPORT.md](reports/OBJECTS_O1_REPORT.md) | Shared crate/plate/gate runtime (#280) | Scope and next authoring step · Source settings and signals · Physics and units · Lifecycle and ownership · Admission and observed cost · Verification and stop |
| [GAMEPLAY_G7_REPORT.md](reports/GAMEPLAY_G7_REPORT.md) | Durable completion, level selection and Next Level (#320) | Rules and identity · Storage and ownership · Selection and switching · Verification and stop |
| [GAMEPLAY_G6_REPORT.md](reports/GAMEPLAY_G6_REPORT.md) | Configurable tank, shared refills, cutoff and recovery (#318) | Rules and authoring · Tick and vehicle boundary · Compatibility and records · Verification and stop |
| [GAMEPLAY_G5_REPORT.md](reports/GAMEPLAY_G5_REPORT.md) | Multiple special pickups, finish-only claims and bounded feedback (#314) | Behavior and authoring · Settlement and compatibility · Presentation and resources · Verification and stop |
| [GAMEPLAY_G4_REPORT.md](reports/GAMEPLAY_G4_REPORT.md) | #300 ordinary pickup authoring, per-attempt collection and finish-only banking | Behavior and authoring · Authority and banking · Resources and compatibility · Verification · Preview and engine evidence |
| [GAMEPLAY_G3_REPORT.md](reports/GAMEPLAY_G3_REPORT.md) | #298 authored target times, highest medal and next target | Behavior and authoring · Competition and revision policy · Verification · Preview and stop point · Engine evidence |
| [GAMEPLAY_G2_REPORT.md](reports/GAMEPLAY_G2_REPORT.md) | #296 current terrain-route position, reverse/Retry and unsupported topology | Route definition and limits · Lifecycle and display · Verification · Preview and stop point · Engine evidence |
| [GAMEPLAY_G1_REPORT.md](reports/GAMEPLAY_G1_REPORT.md) | #279 short official course/run timer/result/best/Retry | Behavior · Scoring and storage · Verification · Preview and limits · Engine evidence |
| [TERRAIN_LOOK_REPORT.md](reports/TERRAIN_LOOK_REPORT.md) | #278 shared Editor/Gym live menu, source styling and evidence | Authorization and preview · Controls and compatibility · Rendering and budgets · Verification · Reproduction · Limits and stop point |
| [TERRAIN_MATERIAL_A_REPORT.md](reports/TERRAIN_MATERIAL_A_REPORT.md) | #392 Stage A textured terrain route (Kenney 1.1 atlas, 52 B vertices) and evidence | Result · Temporary pilot selection · Renderer · Measurements · Findings for later stages · Engine sources · Verification and NOT RUN |
| [TERRAIN_PERSPECTIVE_REPORT.md](reports/TERRAIN_PERSPECTIVE_REPORT.md) | Gated #290 fixed/perspective comparison and evidence | Scope and preview · Projection and resources · Measurements · Verification · Limits and stop point · Engine sources |
| [road-look.md](contracts/road-look.md) | Bounded look parameters and consumer boundary | Scope and activation · Parameter set v1 · Projection and spaces · Geometry and resources · Controls and retention · Production compatibility · Editor authoring · Consumer boundary |
| [contracts/evidence.md](contracts/evidence.md) | PASS/FAIL/BLOCKED/NOT RUN and reporting | — |
| [contracts/level-editor.md](contracts/level-editor.md) | Level editor rules R1–R18, data model | Rules · Screen layout · Controls · Editing basics · Data model · Prefab library v1 · Storage · Additional checks · Technical constraints |
| [EDITOR_E0_INVENTORY.md](reports/EDITOR_E0_INVENTORY.md) | Measured inventory of `editor.gui_script` at `f493a2d` for the #331 split (scanner: `tools/ci/editor_inventory.py`): state, callbacks, messages, hazards, E1 candidates, Gym coverage | Method and limits · Size metrics · Module-local state · Callbacks, input and messages · Dependencies and extraction hazards · Responsibility map · E1 candidates · Test coverage and durations · Appendix: every top-level function |
| [main/gym/README.md](../main/gym/README.md) | Gym implementation and test protocols | See its Contents line |
| [ideas/](ideas/README.md) | Feature ideas, archived plans, active-issue reference briefs and closed-epic history | Roadmap · vehicle builder · procedural generation · feature briefs · history |

Superseded gate records (G0–G3), the v1.4.1 masterplan and the VS Code migration dossier were removed on 2026-10-18; they remain in [git history](https://github.com/bongohorse/rider/tree/764cc01dc94d56448921191405c7f5c601ba42b6/docs/history).
