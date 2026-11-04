# Engine, events, authoring and quality requirements

Status: **worked out** (idea catalogue; not implementation authorization)

These are speculative gameplay proposals and historical design notes. **Do not implement from this folder.** Current scope, issue ownership, milestones and any GO are controlled by [#120](https://github.com/bongohorse/rider/issues/120) and its sub-issues; vehicle architecture lives under [#198](https://github.com/bongohorse/rider/issues/198).

Reusable technical boundaries for considering any of the ideas. Consult the current [physics contract](../../contracts/physics.md) and [level-editor contract](../../contracts/level-editor.md) before implementation.

**Contents:** [Box2D building blocks](#box2d-building-blocks) · [Event wiring and feedback](#event-wiring-and-feedback) · [Shared acceptance requirements](#shared-acceptance-requirements) · [G. Shared authoring and safety notes for the addendum](#g-shared-authoring-and-safety-notes-for-the-addendum)

## Box2D building blocks

Rider's engine references currently identify **Defold 1.14.0 with integrated Box2D 3.1.0**. Recheck the machine lock when implementation starts. Upstream capabilities and a function name in the combined Defold reference do not establish availability on the selected backend.

| Building block | Candidate uses | Check before implementation |
|---|---|---|
| Dynamic rigid bodies and material properties | Balls, crates, barrels, tipping stacks | Shapes, mass ranges, friction/restitution and stable vehicle contacts |
| Sensors / overlap events | Trigger zones, sockets and objectives | Defold event API, actor filtering, multiple vehicle shapes and crossing semantics |
| Revolute joints, limits and motors | Wippe/seesaw, flap, drawbridge, rollers and rotating hazards | Pinned Lua API and supported backend behaviour |
| Prismatic joints, limits and motors | Lift, piston and guided yielding platform | Force limits, travel limits and blocked-motion response |
| Distance / spring behaviour | Compliant supports and selected hanging mechanisms | Supported representation, tuning and stability |
| Weld / attachment connections | Fixed assemblies and breakaway mounts | Safe removal, reaction measurement availability and reset |
| Forces, impulses and damping | Booster, spring pad, wind and braking | Units, application timing, bounds and vehicle-body distribution |
| Contact / joint measurements where exposed | Impact or load conditions | Actual signal availability, thresholds, persistence and noise filtering |

**Sources:** [Rider engine references](https://github.com/bongohorse/rider/blob/main/docs/ENGINE_REFERENCES.md), [Defold physics manual](https://defold.com/manuals/physics/), [Defold joint API](https://defold.com/ref/b2d.joint-lua/), [Box2D 3.1.0 documentation sources](https://github.com/erincatto/box2d/tree/v3.1.0/docs).

These mappings are design candidates, not measured compatibility or performance claims. Follow Rider's physics, baseline and engine-pitfall contracts.

## Event wiring and feedback

Use visible **source event → target action** connections with stable object IDs and typed endpoints. Wiring is distinct from terrain endpoint connections.

- Candidate events: entered, exited, crossed, pressed, released and objective completed.
- Candidate actions: enable, disable, open, close, move to stop and release prepared object.
- Add delayed relays, counts, conjunctions or ordered sequences only when an actual course needs them.
- Show connection arrows, Go to source/target, invalid/dangling-reference errors and live activation state during Play.
- Define once/repeat, cooldown, re-arming, accepted actors and direction. Deduplicate events from the vehicle's multiple bodies/shapes as required by the mechanic.
- Prevent enter/exit jitter, accidental repeated activation and unbounded zero-delay cycles.
- Do not build a general visual scripting framework upfront.

## Shared acceptance requirements

Each selected object or small slice must meet the applicable requirements:

1. **Runtime parity and persistence:** same mechanic in normal play and editor tests. Transforms, parameters, connections and source IDs survive save/reload, duplication and Undo.
2. **Safe preview:** show extent, path, direction, affected actors and activation range without firing gameplay. Geometry previews need not instantiate active behaviour.
3. **Complete reset:** restore authored poses, velocities, joints/actuators, gate states, timer phases, pending events, objectives and loose-object inventory through normal reset ownership. Declare Retry and future checkpoint policies.
4. **Attempt isolation:** obsolete callbacks/generations cannot affect a new attempt; clear delayed work and reset activation state.
5. **Fairness:** declare obstacle phases and any randomness per attempt. Mid-course test starts use an explicit initial mechanism state.
6. **Bounded cost:** declare live-body, joint, spawned-object and physical-fragment caps. Measure representative combinations on the reference phone, including contact/event activity and frame/physics cost.
7. **Validation:** actionable errors for invalid parameters, unsupported object versions, missing targets and incompatible endpoint types. Never silently discard unsupported gameplay objects from an allegedly equivalent course.
8. **Readability:** distinguish decorative/colliding objects, active/inactive states, dangerous movement and timing. Supplement colour with text/icons.
9. **Playable verification:** demonstrate the intended interaction plus Retry, repeated Edit ↔ Play, save/reload and combination with existing mechanics. Use focused automated checks where useful and Claudio's drive test for feel.
10. **Scoped delivery:** check existing issues first. Create small implementation issues with 1–3 concrete acceptance criteria; distinguish runtime work from editor integration without creating duplicate systems.

## G. Shared authoring and safety notes for the addendum

- **Editor:** reuse existing object palettes, per-object inspector, IDs and typed signal links. Preview hazard sweep, release trajectories, active zones, timing and physical-vs-cosmetic distinction without running physics in Edit mode. Show meaningful invalid-reference and budget warnings.
- **Runtime:** stick to the pinned Defold/Box2D API, one fixed-tick owner and single object runtime; never derive simulation state from render visibility. Define Retry and mid-course start initial states before implementation.
- **Object budgets:** default to one or a few dynamic bodies per obstacle; set explicit per-level and per-mechanic live body, joint, spawn and collision-fragment caps. Cosmetic particles and fragments do not receive physics bodies by default.
- **Fairness and feel:** moving hazards should telegraph timing; keep random patterns seeded or deterministic per attempt. Never trap the vehicle by teleporting a closed gate through it. Ensure throttle/brake/tilt remain central.
- **Rules ownership:** rewards, medals, coin/fuel behavior and authoritative finish results belong to #262; vehicle assemblies and attachments to #198; visual decoration/material presentation to #121. Reuse the seesaw from #57 and existing saw implementations where applicable.
- **Delivery discipline:** prefer presets and small parameter sets over general logic graphs; one scoped mechanic per task with an observable example, input tests and a human drive test where needed. No entire-course fluid, destructive terrain, arbitrary fracture or new physics engine is implied by these ideas.
