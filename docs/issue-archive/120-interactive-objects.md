# Issue #120 archived planning text

Full body of [#120 [Gameplay] Interactive objects and event wiring (future epic)](https://github.com/bongohorse/rider/issues/120), moved here on 2026-11-02 (unchanged except repo-relative links made absolute) during the issue cleanup ([issue guide](../ISSUES.md#length)). Current scope, binding rules and GOs live in the issue body, its sub-issues and STATUS.md; superseded parts of this text are history.

**Contents:** [Goal and status](#goal-and-status) · [Index](#index) · [Research basis and approved delivery plan](#research-basis-and-approved-delivery-plan) · [Scope and ownership](#scope-and-ownership) · [Delivery order](#delivery-order) · [Group 1 — Basic physics objects and balance](#group-1--basic-physics-objects-and-balance) · [Group 2 — Triggers and simple reactions](#group-2--triggers-and-simple-reactions) · [Group 3 — Guided and rotating movement](#group-3--guided-and-rotating-movement) · [Group 4 — Driving surfaces and force effects](#group-4--driving-surfaces-and-force-effects) · [Group 5 — Yielding and breakable structures](#group-5--yielding-and-breakable-structures) · [Group 6 — Objectives and combined challenges](#group-6--objectives-and-combined-challenges) · [Group 7 — Separate feasibility experiments](#group-7--separate-feasibility-experiments) · [Box2D building blocks](#box2d-building-blocks) · [Event wiring and feedback](#event-wiring-and-feedback) · [Shared acceptance requirements](#shared-acceptance-requirements) · [Suggested first playable slice](#suggested-first-playable-slice)

## Goal and status

Build a reusable catalogue of interactive gameplay objects and simple event/action connections for Rider. Objects must work in normal courses and editor Play tests through the same runtime.

**Status: future planning epic.** This update expands and organizes the idea backlog; it does not start implementation or assign a milestone. Each selected mechanic needs a scoped task, an API check against the pinned engine, a playable example and Claudio's GO/acceptance.

Originally extracted from #118 on 2026-10-18; expanded and reorganized on 2026-10-22.

## Index

- [Research basis and approved delivery plan](#research-basis-and-approved-delivery-plan)

- [Scope and ownership](#scope-and-ownership)
- [Delivery order](#delivery-order)
- [Group 1 — Basic physics objects and balance](#group-1--basic-physics-objects-and-balance)
- [Group 2 — Triggers and simple reactions](#group-2--triggers-and-simple-reactions)
- [Group 3 — Guided and rotating movement](#group-3--guided-and-rotating-movement)
- [Group 4 — Driving surfaces and force effects](#group-4--driving-surfaces-and-force-effects)
- [Group 5 — Yielding and breakable structures](#group-5--yielding-and-breakable-structures)
- [Group 6 — Objectives and combined challenges](#group-6--objectives-and-combined-challenges)
- [Group 7 — Separate feasibility experiments](#group-7--separate-feasibility-experiments)
- [Box2D building blocks](#box2d-building-blocks)
- [Event wiring and feedback](#event-wiring-and-feedback)
- [Shared acceptance requirements](#shared-acceptance-requirements)
- [Suggested first playable slice](#suggested-first-playable-slice)

## Research basis and approved delivery plan

Plan approved by Claudio on 2026-10-24: prioritize **long, visually substantial 2D courses that are fast to author and smooth to play**. Issue creation approves backlog organisation, not runtime implementation or a new milestone. Preserve the existing per-task scope/GO/drive-test process.

Primary references: [HCR2 technical reference](https://github.com/bongohorse/rider/blob/main/docs/research/HCR2_Technical_Reference_for_Rider.md), [asset/graphics findings](https://github.com/bongohorse/rider/blob/main/docs/research/assets_findings.md), [native findings and limitations](https://github.com/bongohorse/rider/blob/main/docs/research/native_findings.md). Original shader math supports terrain-body extension, depth/UV changes and authored lighting; some original models have depth coordinates. HCR2's full CPU mesh generator, projection, chunk/culling policy, physics laws and numerical tuning are not recovered. Treat our architecture as independent Rider work, using Rider-owned art/code.

### Small shared runtime before catalogue breadth

- [ ] #280 — one crate, one occupancy plate and one gate through a small shared runtime, with canonical Retry and measured cost.
- [ ] #281 — editor placement, supported properties, safe previews and typed plate→gate wiring; depends on #280.

Keep the catalogue below as later choices. These two tasks establish only the identity/events/reset/authoring machinery needed by one playable interaction. Initial plate detection is explicitly occupancy, not a claimed weight measurement. No general scripting graph, exhaustive gadget system or second seesaw/checkpoint implementation is required.

Gameplay activation is independent of #263 render visibility: offscreen mechanisms may still affect the run. Use stable source/actor IDs, typed events, once/repeat/rearm rules, generation isolation and bounded spawn/body/joint/fragment cost. HUD/audio/particles observe presentation events; authoritative pickups, fuel/rewards and finish rules stay with #262. Vehicle attachment construction belongs to #198.

The first interaction can use a short existing course; it does not depend on finishing the full terrain renderer. Schedule it after the chosen long-course/editor priorities unless separately selected. Original text supports event-linked effects and breakable/detachable concepts, not exact HCR2 mechanics, load thresholds or native algorithms.


## Scope and ownership

- This epic owns the gameplay catalogue, runtime behaviour, event semantics, reset/performance requirements and example interactions.
- #118 owns the editor MVP: static terrain, START/optional FINISH, test loop, editing and document handling. It does not depend on this catalogue.
- Implement and verify each selected runtime mechanic before or alongside its editor integration. Placement, parameters, previews and wiring expose that same implementation.
- Reuse existing M4 mechanics and separately planned checkpoint/object work. The seesaw/balance plank must reuse the runtime associated with #57; check its current implementation before scoping work. No second seesaw or checkpoint system.
- Editor authoring of interactive mechanics is also referenced in #170.
- Visual textures, procedural decoration and environment/mood belong to #121. Decorative instances stay non-colliding. Cosmetic generation/quality settings must not insert, remove or retune gameplay objects.
- Keep the pinned engine, Defold-owned worlds/bodies, one physics owner, existing units and fixed-tick/reset lifecycle. No additional physics engine, binding or custom stepping.
- Prefer interactions operated through throttle, brake, tilt, vehicle contact or object weight. Extra mobile controls need a concrete gameplay reason.

## Delivery order

These are planning groups, not seven large implementation tasks or a fixed schedule. Select small useful slices; only build the shared infrastructure they actually require.

| Order | Group | Main dependency / useful outcome |
|---|---|---|
| 1 | Basic physics objects and balance | Reusable object identity, material presets and reliable reset; push and balance objects |
| 2 | Triggers and simple reactions | Group 1 where physical actors are needed; one source event opens a gate or releases a prepared ball |
| 3 | Guided and rotating movement | Verified motion/joint behaviour and blocked-motion policy; timing and transport |
| 4 | Driving surfaces and force effects | Explicit contact/zone rules and bounded forces; new driving situations |
| 5 | Yielding and breakable structures | Relevant joints, load/impact rules and bounded debris; reactive terrain |
| 6 | Objectives and combined challenges | Reuse selected mechanics from earlier groups; progression and small physics puzzles |
| 7 | Separate feasibility experiments | Individual stability, control-feel and mobile-cost trials |

For every selected object: **runtime behaviour → Retry/reset verification → editor placement and persistence → small playable example**. Existing editor/runtime infrastructure should be reused.

## Group 1 — Basic physics objects and balance

| Object | Gameplay | Key authored parameters |
|---|---|---|
| Playable ball | Push, roll, launch or deliver a ball | Radius, mass/material preset, initial pose, objective tag |
| Boulder / heavy ball | Rolling hazard, counterweight or gate opener | Size, mass preset, release pose, initial velocity, tag |
| Crate / stackable block | Weight for a plate, movable step or cargo | Dimensions, mass/material preset, initial pose, tag |
| Barrel / rolling log | Rolling obstacle or temporary support | Dimensions, material preset, initial pose/velocity |
| Seesaw / balance plank | Shift vehicle or cargo weight to change slope | Pivot, length, angle limits, initial pose; reuse existing runtime |
| Tipping block stack | Carefully pass or push over a stack to make a route | Approved pieces, initial arrangement, mass/friction presets, body cap |
| Seesaw step sequence | Cross several short balance planks | Repeated existing seesaw instances and spacing; no new physics system |

**Useful first examples:** push a crate up a ramp; cross one seesaw; tip a small block stack into a usable step.

## Group 2 — Triggers and simple reactions

| Object | Gameplay | Key authored parameters |
|---|---|---|
| Trigger zone / sensor gate | Detect entry, exit or directed crossing | Shape/size, accepted tags, event, direction, once/repeat, cooldown |
| Push / impact button | Bump a button to open a route | Accepted actor, activation direction/condition, momentary/toggle/latch mode, cooldown |
| Pressure plate | Hold a gate open with vehicle or cargo | Area, contact/load rule, threshold, hysteresis, press/release delay |
| Physical lever | Push a handle to change a mechanism state | Rest angle, angle threshold, limits, latch/release rule |
| Timer / delayed relay | Delay closing or periodically activate an object | Delay/period, initial state, once/repeat, reset phase |
| Gate / door / barrier | Open or close a route | End poses, travel time, initial state, hold/close rule, blocked-motion policy |
| Release cradle / bounded dispenser | Release a prepared ball; optionally replenish | Template, outlet, interval, one-shot/repeat, live-object cap, reclaim/reset policy |

Start with the event/action pairs needed by the first course. Do not implement every control mode or a general programming graph upfront. A pressure plate must declare whether it detects occupancy or estimates physical load; sensor overlap alone is not a weight measurement.

## Group 3 — Guided and rotating movement

| Object | Gameplay | Key authored parameters |
|---|---|---|
| Lift / elevator | Carry vehicle or cargo between heights | Stops/path, speed, acceleration, dwell, initial stop, activation |
| Moving platform / shuttle | Time a landing or ride across a gap | Path, loop/ping-pong/one-shot, speed, dwell, phase |
| Hinged / drawbridge | Lower a bridge or change ramp angle | Pivot, closed/open angles, limits, actuation time |
| Rotating arm / paddle | Time passage through a moving obstacle | Pivot, shape/radius, direction, angular speed, phase |
| Piston / sliding block | Moving step, timed obstruction or pusher | Axis, stroke, speed, dwell, initial extension |
| One-way flap | Push through in one direction; flap returns | Pivot, permitted angle range, return behaviour, damping |
| Roller track | Free rollers reduce traction; powered rollers drive objects | Roller size/spacing/count, free/powered mode, speed/torque |
| Rideable rotating drum / wheel | Drive on a rotating surface and choose an exit | Geometry, rotation speed/direction, phase, approved collision shape |
| Pendulum / hanging weight | Swinging timing hazard | Support/pivot, length, mass, initial angle, limits |
| Swinging platform | Land on a suspended moving surface | Suspension layout, platform size, initial pose, travel limits |

Gates, lifts and pistons need an explicit response when blocked. They must not teleport the vehicle through geometry. Connected moving surfaces require their own drive tests; static-terrain seam results do not establish their behaviour. Verify each suspension representation before promising a particular joint arrangement.

## Group 4 — Driving surfaces and force effects

| Object | Gameplay | Key authored parameters |
|---|---|---|
| Booster pad | Accelerate before a jump | Extent, direction, impulse/bounded-force mode, strength, accepted actors, cooldown |
| Brake pad / deceleration zone | Slow an approach | Extent, effect profile/strength, accepted actors, activation |
| Spring / launch pad | Launch vehicle or cargo | Direction, strength, contact/load condition, cooldown |
| Fan / wind zone | Alter a jump or push a light ball | Region, direction, bounded force profile, affected tags |
| Ice / mud / sand / sticky surface | Change grip and resistance | Surface binding, supported material/drag parameters, transition rule |
| Conveyor | Transport cargo or change approach speed | Extent, direction, target speed/strength, affected actors; runtime method to verify |
| Reset / hazard zone | Mark a pit or dangerous obstacle that requests Retry | Region, accepted actor, reason and readable warning |
| Spring bumper / rubber cushion | Soften landing or rebound from an obstacle | Geometry, direction, spring or restitution preset, damping, effect limits |

Prevent unlimited booster stacking while an actor remains inside a trigger. Define application timing and units. Surface and wind controls are exposed only after their runtime mechanic exists; atmospheric rain alone does not change grip. A conveyor is not automatically equivalent to applying a constant force.

## Group 5 — Yielding and breakable structures

| Object | Gameplay | Key authored parameters |
|---|---|---|
| Yielding platform | Sink under vehicle weight and return | Guided axis, travel limits, spring/damping, initial height |
| Spring-mounted ramp | Ramp bends/rotates under load and changes take-off | Pivot, angle limits, spring/damping, rest angle |
| Breakable plank / fragile platform | Collapse under a declared load or impact | Threshold/rule, delay, geometry, approved pre-cut pieces, debris cap |
| Breakaway mount | An attached platform or object detaches | Connection, load/impact condition, threshold duration, released-body behaviour |
| Delayed falling track piece | A segment drops shortly after crossing | Trigger/filter, delay, release mode, reset pose |
| Small physical domino chain | A push starts a visible chain reaction | Piece preset/count/spacing, initial pose, collision rules |

Breakage is an explicit gameplay decision: evaluate the declared rule and release/destroy the appropriate connection at a safe lifecycle point. Box2D does not supply a complete destruction system automatically.

Use prepared pieces rather than arbitrary runtime fracture. Keep cosmetic debris separate from colliding fragments. No unlimited spawners or unrestricted physical debris.

## Group 6 — Objectives and combined challenges

| Objective / challenge | Gameplay and rules to define |
|---|---|
| Ordered checkpoints | Visible marker, directed crossing, safe authored respawn and declared obstacle/event reset policy; reuse separately planned checkpoint work |
| Collectible / optional token | Reward a difficult line; declare attempt-only versus persistent collection |
| Cargo delivery / target socket | Deliver tagged cargo; define containment, settling/hold time, count and whether the vehicle must also finish |
| Precision landing | Land in a marked region; define both-wheel contact, orientation/speed tolerances and stable completion |
| Hold-position target | Remain on a small platform for a declared duration with speed/pose tolerances |
| Speed gate | Cross within a chosen speed range and direction |
| Stunt / skill target | Airtime or rotation objective only after the relevant measurement exists |
| Cargo retention challenge | Deliver a loose load without dropping it; define what counts as lost or damaged before adding scoring |
| Simultaneous pressure plates | Leave cargo on one plate and operate another; add only the small combination rule required |
| Timed passage | Activate a switch and reach a gate before it closes; make remaining time visible |
| Optional route / risk choice | Safe detour versus faster moving-obstacle route; does not imply new branching-terrain support in the MVP |
| Optional physics task | Deliver a ball or activate a mechanism to open a shortcut |

A ball touching a socket once is not sufficient proof of delivery. A trigger is not automatically a checkpoint. Compose existing objects rather than creating a bespoke system for each challenge.

### Example combinations

| Course | Interaction | Main skill |
|---|---|---|
| Crate opens the route | Push crate onto plate → gate opens → cross yielding platform | Positioning and controlled throttle |
| Lift jump | Button → lift reaches upper stop → jump to landing | Timing |
| One ball, two tools | Spring launches ball → button hit → drawbridge lowers | Toy-like chain reaction |
| Controlled launch | Booster → ramp → precision landing | Approach speed and air control |
| Cargo run | Carry tagged crate → deliver to socket | Gentle acceleration/braking |
| Balance route | Shift weight on seesaw → access raised platform | Balance |
| Falling escape | Cross delayed falling pieces → reach a safe hold-position target | Momentum and braking |
| Two weights | Crate holds one plate → vehicle presses second → route opens | Simple physics puzzle |

These are authored examples, not automatically generated or guaranteed-solvable courses.

## Group 7 — Separate feasibility experiments

| Experiment | What must be established first |
|---|---|
| Short suspension bridge | Small linked-plank count, drive feel, stable joints, reset and mobile cost |
| Counterweight lift | Supported coupling approach, force limits, blocked motion and reset; do not assume pulley/gear API support on the active backend |
| Multi-link ropes / chains | Supported joint representation, practical link count, stability and collision budget |
| Larger chain-reaction machinery | Repeatability, readable timing, body/contact budget and recovery |
| Magnet / repulsion zone | Custom bounded force law, accepted actors, range and useful control feel |
| Portal / teleporter | Safe destination, velocity/orientation policy, jointed vehicle handling and cooldown |
| Altered-gravity zone | Per-body force approach, transitions and stable vehicle handling |

No commitment to fluid simulation, soft-body machinery, arbitrary scripting or custom physics follows from this catalogue.

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

## Suggested first playable slice

**Core:** push one crate onto a pressure plate → one gate opens → drive to the finish.

**Follow-up:** add one yielding platform after its spring/motion behaviour is verified. It is an extension, not a prerequisite for validating the core interaction.

This exercises reusable objects, a single event/action connection and reset with a small course. Other high-interest follow-ups are the one-way flap, delayed falling track pieces, roller track, precision landing and hold-position target.

Before implementation: check existing work, choose the slice, verify the pinned APIs, agree acceptance/budget and obtain Claudio's implementation GO. This entire catalogue is not one delivery package.
