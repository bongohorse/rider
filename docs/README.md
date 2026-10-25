# Rider documentation

Index of every active document. Read [STATUS.md](../STATUS.md), the current issue and only the documents its task needs. Every longer document starts with a **Contents** line: read it, then jump to the section (search for its `## ` heading) instead of reading the whole file.

## By task

| Task | Read |
| --- | --- |
| What is next, what is open | [STATUS.md](../STATUS.md) |
| Decisions, roadmap, stop points | [PLAN.md](PLAN.md) |
| Gameplay intent, open design choices | [GAME_DESIGN.md](GAME_DESIGN.md), [vehicle contract](contracts/vehicle.md) |
| Physics, units, tick owner, reset | [physics contract](contracts/physics.md), [engine pitfalls](contracts/engine-pitfalls.md); measured API table in [G1 baseline](contracts/g1-baseline.md) |
| Engine/API changes (Defold, Box2D) | [engine references](ENGINE_REFERENCES.md), [engine pitfalls](contracts/engine-pitfalls.md) |
| Gym stations, features, test protocols | [gym notes](../main/gym/README.md); seams: [A18 protocol](A18_SEAM_PROTOCOL.md) |
| Level editor | [Editor A layout previews](editor-a/README.md) · [level-editor contract](contracts/level-editor.md) (epic [#118](https://github.com/bongohorse/rider/issues/118)); custom level cost: [LE1b report](LE1B_REPORT.md) |
| Test CLI, runner protocol, release boundary | [automation contract](contracts/automation.md) |
| Native Bridge | [bridge contract](contracts/bridge.md) |
| Setup, build, tests, CI, preview | [TOOLING.md](TOOLING.md), [toolchain lock](TOOLCHAIN_LOCK.md); [CI Speed 3 evidence](CI_SPEED_3_REPORT.md) |
| Device evidence, phone testing | [platform matrix](PLATFORM_MATRIX.md), [phone trial](MOBILE_TRIAL.md) |
| Status values and reporting | [evidence policy](contracts/evidence.md) |
| Unscheduled ideas (do not implement) | [ideas](ideas/README.md) |
| Past session reports (German, for Claudio) | [reports](reports/README.md) |

## All documents

| Document | Purpose | Sections |
| --- | --- | --- |
| [AGENTS.md](../AGENTS.md) | Rules for every AI agent | Start · Workflow · Technical boundaries · Verification |
| [STATUS.md](../STATUS.md) | Current progress and blockers | Now · Open acceptance · Milestones · Measured limits · Open limits and blockers |
| [PLAN.md](PLAN.md) | Goal, decisions D1–D13, roadmap | Goal · Decisions · Roadmap · Stop points · Later phases |
| [GAME_DESIGN.md](GAME_DESIGN.md) | Design brief | Core loop and duration · Controls and feel trials · Crash, recovery and checkpoints · Identity and fun acceptance |
| [TOOLING.md](TOOLING.md) | Commands and operations | Prerequisites · Commands · Gym tests · Local environment · Worktrees · CI and required check · Agent CI completion watch · Dependencies and Renovate · Preview deployment · Gemini read-only reviewer setup |
| [CI_SPEED_3_REPORT.md](CI_SPEED_3_REPORT.md) | P1 browser setup, EA3 correction and before/after evidence (#264) | Scope and implementation · Measurements · Failures and verification · Decisions and limits |
| [TOOLCHAIN_LOCK.md](TOOLCHAIN_LOCK.md) | Pinned Defold/Bob/JDK/Bridge and update rules | — |
| [ENGINE_REFERENCES.md](ENGINE_REFERENCES.md) | Official Defold/Box2D sources | Read only what the task needs · Defold · Box2D · Automation Bridge · Build, platforms and gameplay evidence · Maintenance |
| [PLATFORM_MATRIX.md](PLATFORM_MATRIX.md) | Evidence per platform and device | — |
| [MOBILE_TRIAL.md](MOBILE_TRIAL.md) | Reference-phone test procedure | Touch and layout · Coasting and HUD · Comparable phone captures · Tilt comparison |
| [TERRAIN_P0_REPORT.md](TERRAIN_P0_REPORT.md) | Curve and mixed-course resource/performance baseline (#272) | Scope and environment · Fixtures and allocations · Measurement method · Results · Cost and limit audit · Recommendation for #273 · Reproduction and verification |
| [LE1B_REPORT.md](LE1B_REPORT.md) | Custom level size, performance and world-switch measurement (`le1b` case) | Summary · Protocol · Desktop results · Phone results · Phone procedure · Findings for later tasks · Reproduction · Engine sources |
| [A18_SEAM_PROTOCOL.md](A18_SEAM_PROTOCOL.md) | Chain vs hull seam experiment (`a18` case) | Revision history · Fixed commands and qualification · Sampling and bump definition · Reproduction · Engine boundary |
| [contracts/physics.md](contracts/physics.md) | Binding physics rules | API and platform · Units · Lifecycle and tick owner · Ownership and reset · Collisions and sensors · Scenario and result data · Pause, slow motion and live tuning · Command playback and ghosts |
| [contracts/g1-baseline.md](contracts/g1-baseline.md) | Measured G1 API/unit matrix and fixture | API and units · Start state · Ownership and cleanup · Running and protocol |
| [contracts/vehicle.md](contracts/vehicle.md) | Vehicle commands and gameplay constraints | — |
| [contracts/engine-pitfalls.md](contracts/engine-pitfalls.md) | Recurring engine traps | — |
| [contracts/automation.md](contracts/automation.md) | Test CLI, runner protocol, release boundary | Interfaces · Test CLI and results · Engine/runner protocol · Release boundary |
| [contracts/bridge.md](contracts/bridge.md) | Native Automation Bridge | Setup and commands · Tested behavior · Limits and license · Network boundary · Network test procedure |
| [contracts/evidence.md](contracts/evidence.md) | PASS/FAIL/BLOCKED/NOT RUN and reporting | — |
| [contracts/level-editor.md](contracts/level-editor.md) | Level editor rules R1–R18, data model | Rules · Screen layout · Controls · Editing basics · Data model · Prefab library v1 · Storage · Additional checks · Technical constraints |
| [main/gym/README.md](../main/gym/README.md) | Gym implementation and test protocols | See its Contents line |
| [ideas/](ideas/README.md) | Unscheduled ideas | Roadmap waves · Vehicle builder |
| [reports/](reports/README.md) | Session reports for Claudio (German) | Studio report · Day report · Preset comparison (2026-10-20) |

Superseded gate records (G0–G3), the v1.4.1 masterplan and the VS Code migration dossier were removed on 2026-10-18; they remain in [git history](https://github.com/bongohorse/rider/tree/764cc01dc94d56448921191405c7f5c601ba42b6/docs/history).
