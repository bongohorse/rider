# Rider documentation

[Current status](../STATUS.md) · [Plan](PLAN.md) · [Game design](GAME_DESIGN.md)

Read STATUS.md, the current issue and only its affected contract. Work is organized into issues and milestones M1–M5, replacing the old gates. Active agent documents are English; archived source records retain their original wording.

| Task | Read |
| --- | --- |
| Decisions, phases, milestones, authorization | [Plan](PLAN.md) |
| Gameplay intent and open design choices | [Game design](GAME_DESIGN.md), [vehicle commands](contracts/vehicle.md) |
| Engine/API changes | [Curated engine pitfalls](contracts/engine-pitfalls.md), [official engine references](ENGINE_REFERENCES.md) |
| Units, tick order, reset/ownership | [G1 verified baseline](contracts/physics/G1_CONTRACT.md); affected [physics contract](contracts/physics/) |
| Automation and runner changes | [Automation contracts](contracts/automation/), [Bridge](contracts/automation/bridge.md) |
| Tool setup/build/run | [Tooling](TOOLING.md), [toolchain lock](TOOLCHAIN_LOCK.md) |
| VS Code / WSL move and independent agent audit | [VS Code migration review dossier](VSCODE_MIGRATION_REVIEW.md) |
| M3 touch/tilt trial procedure | [Mobile trial](MOBILE_TRIAL.md) |
| A18 seam geometry, qualification and reproduction | [Seam protocol](A18_SEAM_PROTOCOL.md) |
| Level editor rules, data model, evidence | [Level-editor contract](contracts/level-editor.md) (epic [#118](https://github.com/bongohorse/rider/issues/118)) |
| Device evidence | [Platform matrix](PLATFORM_MATRIX.md) |
| CI/protection, dependencies, repository operations | [Repository setup](REPOSITORY_SETUP.md) |
| Status meanings and reporting | [Evidence policy](contracts/evidence.md) |
| Completed G0–G2 and superseded gates/masterplan | [History](history/README.md) |
| Unscheduled ideas (not approved work; do not implement) | [Ideas](ideas/README.md) |

History is evidence, not the current queue or authority. Physics and automation contracts remain binding; the plan determines when later validations become necessary.
