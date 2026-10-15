# Rider documentation index

Read this index and the active gate first. Do **not** read every planning file by default. Open only the contracts needed for the current change; use `rg` to find additional requirements.

**State:** G0 complete. User authorized documentation restructuring followed by G1. Stop before G2.

## Start here

| Task | Read |
|---|---|
| Current work | [G1 progress](G1_PROGRESS.md), [G1 acceptance](G1_ACCEPTANCE.md), then [G1 plan](gates/G1.md) |
| Rules and sign-off | [Principles](plan/principles.md), [gate policy](plan/gate-policy.md), [evidence policy](plan/evidence-policy.md) |
| Completed setup | [G0 completion](G0_COMPLETION.md), [repository setup](REPOSITORY_SETUP.md) |
| Tool selection | [Verified candidate provenance](TOOLCHAIN_CANDIDATES.md), [version policy](plan/toolchain.md) |
| Architecture review clarifications | [ADR 0001](DECISIONS/0001-bootstrap-scope.md) |

## Physics: choose the relevant contract

| Topic | File |
|---|---|
| API/backend/platform support | [API matrix](plan/physics/api.md) |
| Coordinates and scaling | [Units](plan/physics/units.md) |
| Fixed ticks, callback ordering, mutation | [Lifecycle](plan/physics/lifecycle.md) |
| Body/joint ownership, reset, sessions | [Ownership](plan/physics/ownership.md) |
| Pause, single step, live tuning | [Debug](plan/physics/debug.md) |
| Config and result data | [Data](plan/physics/data.md) |
| Tick-command test playback | [Command player](plan/physics/command-player.md) |
| Collision groups/masks | [Collisions](plan/physics/collisions.md) |

## Automation: choose the relevant contract

- [Editor, engine service and MCP](plan/automation/interfaces.md)
- [Test CLI and result schema](plan/automation/test-cli.md)
- [G1 runner protocol](plan/automation/test-protocol.md)
- [Bridge capabilities, matching wrapper and release boundaries](plan/automation/release.md)

## Product and platform context

[Product scope](plan/product.md) · [Platforms](plan/platforms.md) · [Sandbox](plan/sandbox.md) · [Vehicle/gameplay](plan/vehicle.md) · [Repository layout](plan/repository-layout.md) · [Sources](plan/sources.md)

## Gates — open only the active gate

| Gate | Purpose | Prerequisite |
|---|---|---|
| [G0](gates/G0.md) | Repository/bootstrap | Complete |
| [G1](gates/G1.md) | Integrated Box2D 3 PoC | Authorized after docs split |
| [G2](gates/G2.md) | Automation and tests | Explicit authorization after G1 |
| [G3](gates/G3.md) | Minimal sandbox and Android | G2 |
| [G4a](gates/G4a.md) | Vehicle-critical physics | G3 |
| [G5](gates/G5.md) | Buggy and first challenge | G4a |
| [G4b](gates/G4b.md) | Optional extra physics labs | Optional after G5 |
| [G6](gates/G6.md) | Stability/performance | G5 |
| [G7](gates/G7.md) | Three challenges | G6 |
| [G8](gates/G8.md) | Art/content pipeline | G7 |
| [G9](gates/G9.md) | Release | Separate release approval |

## Maintenance

These files are the canonical modular v1.4.1 plan. Update the relevant file and cross-links; do not regenerate a monolithic copy. Acceptance/result documents such as `G1_ACCEPTANCE.md` are execution records, not duplicates of the full plan. Historical prompts grant no current authorization.

[Provenance/version notes](plan/provenance.md) · [Historical G0 prompt](plan/history/g0-initial-task.md) · [Former masterplan entry point](BUGGY_LAB_MASTERPLAN_v1.4.1.md)
