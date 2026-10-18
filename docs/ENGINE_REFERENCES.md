# Official engine references

[Documentation index](README.md) · [Version lock](TOOLCHAIN_LOCK.md) · [Machine lock](../tools/toolchain-lock.json)

**Contents:** [Read only what the task needs](#read-only-what-the-task-needs) · [Defold](#defold) · [Box2D: integrated physics](#box2d-integrated-physics) · [Automation Bridge and native extension work](#automation-bridge-and-native-extension-work) · [Build, platforms and gameplay evidence](#build-platforms-and-gameplay-evidence) · [Maintenance and review](#maintenance-and-review)

## Read only what the task needs

1. Identify the affected subsystem and pinned version from the machine lock.
2. Find the relevant official manual/API/example through the indexes below.
3. Check the exact version's source/API when the live documentation differs or has no version label. Record any unresolved discrepancy.
4. Apply the existing Rider contract and run the affected build/runtime checks. Documentation does not establish runtime support on every platform.
5. Put the consulted sources, version, implementation consequence and verification limits in the PR documentation-evidence section. Never claim a page was read when only its URL was listed.

No documentation snapshots or new dependencies are installed by this document. Full-text bundles are optional offline search inputs, not mandatory task context.

## Defold

- [Official LLM index](https://defold.com/llms.txt)
- [Manuals index](https://defold.com/llms/manuals.md)
- [API index](https://defold.com/llms/apis.md)
- [Examples index](https://defold.com/llms/examples.md)
- [AI agent workflow](https://defold.com/manuals/ai-agents/)
- [Pinned engine source](https://github.com/defold/defold/tree/a81dbb0478e8b73931dc2d671563204f6ac0ef82)

Current lock: Defold/Bob 1.14.0, engine commit above. The machine lock remains authoritative after updates; update these entry points when it changes. Current online stable documentation may describe another version. Prefer the running matching editor's `/ref` where available; otherwise use pinned engine source and focused probes. Discover the editor's actual operations through `/openapi.json`; access requires an available authorized editor, not an assumed cloud connection.

## Box2D: integrated physics

- [Official upstream docs directory — current development](https://github.com/erincatto/box2d/tree/main/docs)
- [Version 3.1.0 documentation sources](https://github.com/erincatto/box2d/tree/v3.1.0/docs)
- [Version 3.1.0 public headers](https://github.com/erincatto/box2d/tree/v3.1.0/include/box2d)
- [Official rendered manual — check its displayed version](https://box2d.org/documentation/)
- [Defold b2d API](https://defold.com/ref/b2d-lua/)
- [Defold physics manual](https://defold.com/manuals/physics/)

The current engine lock records integrated Box2D 3.1.0. Upstream docs explain simulation semantics; they do not establish which APIs Defold exposes. Check the pinned Defold integration for adaptations and the actual Lua signature. Upstream headers establish C signatures only. `main/docs` is discovery material, not the compatibility authority for 3.1.0. Keep Defold-owned worlds/bodies and the existing fixed-tick lifecycle; do not introduce a separate Box2D binding or simulation.

Project contracts: [physics contract](contracts/physics.md) (API, units, lifecycle, ownership/reset, collisions), [G1 baseline](contracts/g1-baseline.md) (measured API matrix), [engine pitfalls](contracts/engine-pitfalls.md).

## Automation Bridge and native extension work

The Automation Bridge controls debug inspection/input/screenshots. It is not a physics bridge.

- [Pinned official extension and wrapper source](https://github.com/defold/extension-automation-bridge/tree/567c7efb2f72626af71967984bd33dde856f0d36)
- [Native extensions](https://defold.com/manuals/extensions/) and [Defold SDK](https://defold.com/manuals/extensions-defold-sdk/) — only for affected extension/build work
- [Editor HTTP API](https://defold.com/manuals/editor-http-api/)
- [Engine service](https://defold.com/manuals/engine-service/)
- [Automated testing](https://defold.com/manuals/automated-testing/)

Use [bridge.md](contracts/bridge.md) for exact versions, capabilities, wrapper provenance, lifecycle, release boundaries and unresolved license evidence. Use [interface distinctions](contracts/automation.md#interfaces) before touching editor/runtime automation. HTTP API discovery is live; runtime capabilities must be negotiated rather than inferred from documentation.

## Build, platforms and gameplay evidence

| Work | Official starting point | Existing Rider contract |
|---|---|---|
| Builds/tool versions | [Bob](https://defold.com/manuals/bob/), [project settings](https://defold.com/manuals/project-settings/) | [Tooling and commands](TOOLING.md#commands), [lock/update rules](TOOLCHAIN_LOCK.md) |
| Touch/input | [Mouse and touch](https://defold.com/manuals/input-mouse-and-touch/) | [Platforms and real-device requirements](PLATFORM_MATRIX.md) |
| Screen layout | [Screen sizes](https://defold.com/manuals/adapting-graphics-to-screen-size/) | [Gym notes](../main/gym/README.md), [platform matrix](PLATFORM_MATRIX.md) |
| Android/HTML5 lifecycle | Locate the relevant platform manual through the official manuals index | [Platform matrix requirements](PLATFORM_MATRIX.md), [runner protocol](contracts/automation.md#enginerunner-protocol) |
| Saving, HTML5 storage, JS bridge | [sys API](https://defold.com/ref/sys-lua/), [HTML5 manual](https://defold.com/manuals/html5/), [html5 API](https://defold.com/ref/html5-lua/) | [Custom level save (LE1a)](contracts/level-editor.md#custom-level-runtime-and-save-le1a) |
| Performance | Locate profiling/optimization manuals through the official manuals index | [Phase E measurements](PLAN.md#later-phases-no-issues-yet), [LE1b custom level cost](LE1B_REPORT.md#engine-sources) |
| Vehicle behavior | Box2D and Defold references above | [Vehicle commands](contracts/vehicle.md), [Game design](GAME_DESIGN.md), [plan](PLAN.md) |

Android is the first release target, HTML5 the main test platform. iOS builds wait until Phase G after Play Store launch. Keep gameplay platform-neutral and existing manifest exports possible. The reference phone and evidence limits are in PLATFORM_MATRIX.md; Current budget and interpolation decisions are in PLATFORM_MATRIX.md and PLAN.md (D13). This page does not invent completed measurements or approvals.

## Maintenance and review

Keep rules short in root AGENTS.md and route here for details. Preserve existing contracts rather than copying them. On a version change, update the lock and affected source links together and rerun the required platform checks. PR review must inspect whether the consulted source actually supports the change. CI can check the presence of fields, but cannot prove that an agent read or understood documentation; no automatic reading guarantee is claimed.
