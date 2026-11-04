# Issue #120 archived planning text

Full body of [#120 [Gameplay] Interactive objects and event wiring (future epic)](https://github.com/bongohorse/rider/issues/120), moved here on 2026-11-02 (unchanged except repo-relative links made absolute) during the issue cleanup ([issue guide](../ISSUES.md#length)). Current scope, binding rules and GOs live in the issue body, its sub-issues and `status:` labels; superseded parts of this text are history.

**Contents:** [Goal and status](#goal-and-status) · [Index](#index) · [Research basis and approved delivery plan](#research-basis-and-approved-delivery-plan) · [Scope and ownership](#scope-and-ownership) · [Delivery order](#delivery-order) · [Group 1 — Basic physics objects and balance](#group-1--basic-physics-objects-and-balance) · [Group 2 — Triggers and simple reactions](#group-2--triggers-and-simple-reactions) · [Group 3 — Guided and rotating movement](#group-3--guided-and-rotating-movement) · [Group 4 — Driving surfaces and force effects](#group-4--driving-surfaces-and-force-effects) · [Group 5 — Yielding and breakable structures](#group-5--yielding-and-breakable-structures) · [Group 6 — Objectives and combined challenges](#group-6--objectives-and-combined-challenges) · [Group 7 — Separate feasibility experiments](#group-7--separate-feasibility-experiments) · [Box2D building blocks](#box2d-building-blocks) · [Event wiring and feedback](#event-wiring-and-feedback) · [Shared acceptance requirements](#shared-acceptance-requirements) · [Suggested first playable slice](#suggested-first-playable-slice) · [Addendum — Additional gameplay concepts](#addendum--additional-gameplay-concepts-2026-11-04-brainstorm)

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

## Addendum — Additional gameplay concepts (2026-11-04 brainstorm)

This is an **idea pool, not Group 8 of the delivery plan and not an implementation GO**. The historical planning text above remains unchanged. Issue #120 and its sub-issues determine actual scope, ownership, order and acceptance. The extra concepts below favor short, legible 2D driving interactions, toy-like physical feedback and reuse of the existing mechanisms. They must not delay agreed vehicle-feel, camera, editor, CI or performance work.

### A. Additional physical toys and cargo

| Concept | Driving interaction | Authoring / feasibility considerations |
|---|---|---|
| Loose tyre / tyre stack | Roll a tyre, push a soft obstacle or topple a small stack before a climb | Circular-body preset, tyre count and contact cap; not the vehicle wheel assembly |
| Oversized bouncy ball | Push a ball that rebounds strongly; use it as a temporary moving obstacle | Radius, bounded restitution and damping; avoid energy gain and retry drift |
| Tipping container | Drive into a large container to rotate it into a ramp or block a passage | Pivot, initial angle, stops and mass; fixed shape rather than free breakage |
| Snap-off bumper / obstacle | Hit a small obstacle hard enough to detach it from its mount | Declared impact rule, one-time state and capped released bodies |
| Fragile crystal / glass barrier | Break a shortcut barrier by impact, with clearly readable risk | Fixed break condition and pre-cut collision pieces; cosmetic shards separately budgeted |
| Rolling tyre obstacle course | Thread between a few loose wheels or knock them into a gap | Composition of the tyre preset; no separate runtime system |

Related existing entries: crates, balls, boulders, barrels, seesaws, breakaway mounts and dominoes remain in Groups 1 and 5; do not duplicate them.

### B. New active machinery and precision hazards

| Concept | Gameplay | Authoring / feasibility considerations |
|---|---|---|
| Flipper paddle | Contact-triggered paddle propels the buggy or cargo, like a pinball machine | Pivot, rest/active angles, bounded motor force, activation and rearm; no extra player button by default |
| Rotating gear pair | Two geared-looking wheels form a timed route or moving driving surface | Prefer explicitly synchronized motion rather than assuming a supported gear joint |
| Cable trolley / hanging ferry | Ride a suspended carrier between two ledges | Guided movement with a visually hanging carrier; verify stable vehicle contacts and joint budget |
| Sliding circular saw | Avoid a rotating saw that travels on a short rail | Path, speed, phase, collision policy and high-contrast warning; reuse any existing saw obstacle work |
| Oscillating crusher | Cross between a moving jaw and a wall during its open phase | Travel, dwell, speed, telegraph and safe blocked-motion behavior |
| Falling icicle / stalactite | Passing below a sensor releases a pointed obstacle | Finite prepared bodies, explicit trigger timing, capped active count and full Retry restore |
| Pneumatic launcher | A visibly charging piston launches cargo or the vehicle | Reuse piston/spring components; impulse cap and readable launch direction |
| Counter-rotating roller gate | Navigate between two rollers that affect approach speed | Bounded powered-roller preset; test stall/jam conditions and wheel-contact stability |

These are variants or combinations when possible: the existing rotating arm, piston, roller track, moving platform, pendulum and gate entries remain the foundational mechanics.

### C. Surface and environment interactions

| Concept | Player-facing effect | Ownership / technical caution |
|---|---|---|
| Oil patch | A short, conspicuously slippery section changes braking and hill grip | Surface-material variant of the ice/mud system, not a second friction engine |
| Deep snow bank | Visible resistance slows momentum, potentially hiding a small bump | Prefer bounded drag/contact effect plus cosmetic snow; no deformable snow simulation |
| Shallow puddle | Splash and optional small contact/rolling effect | Default cosmetic only; if handling changes, define an explicit surface rule |
| Thin ice sheet | Breaks after contact duration or a declared impact threshold | Pre-authored breakable pieces and per-attempt reset, not terrain fracture |
| Geyser / steam vent | A periodic vertical burst can alter a jump or launch a light ball | Pulsed bounded force with visible charge phase; particles remain cosmetic |
| Rockfall chute | A small finite sequence of rocks rolls into the track on trigger | Reuse boulder and release-cradle logic; cap live bodies and clear between attempts |
| Snow-slide / mini-avalanche | Drive ahead of a short wave of prepared rolling obstacles | Predefined finite release, not general fluid, soft-body or granular simulation |
| Pliable plant / rubber arch | A stylized plant bends and springs back when the buggy hits it | Prefer one hinged/sprung obstacle; do not require skeletal vegetation physics |
| Shallow water crossing (experiment) | Float, slow down or partially submerge the vehicle | Separate feasibility test for forces, buoyancy approximation, handling and camera; not approved by this catalogue |

**Materials vs textures:** when #121 provides visual terrain materials, author gameplay grip/drag as separately declared material properties, not implicit texture-name effects. A decorative mud, snow or rain texture must never silently change traction; material transitions need visible inspector values and predictable wheel contacts.

### D. New objective and skill-rule variants

| Objective | Player challenge | Reuse / validation |
|---|---|---|
| One-wheel balance stretch | Cross a short section while only one wheel supports the vehicle | Wheel-contact state, minimum duration, tolerance for momentary contact jitter |
| Reverse-driving segment | Traverse a marked gate or short section while driving backward | Reuse directed crossing / motion sign; define whether body heading or velocity counts |
| Low-speed precision corridor | Stay below a speed ceiling while clearing an obstacle sequence | Reuse speed-gate measurement, with explicit begin/end and tolerances |
| Multi-stunt combo | Link a jump, rotation and landing without touching an invalid surface | Reuse future stunt measurements; reset chain on declared interruption |
| Intact-cargo bonus | Reach the target without losing or striking carried cargo | Requires an explicit cargo loss/damage rule; not inferred from mere proximity |
| Clean-run medal condition | Complete with no declared crash/hazard event | Add only when crash semantics and result ownership (#262) expose a reliable signal |
| Target-speed landing | Reach a designated zone with controlled touchdown speed | Compose precision-landing and speed measurement, not a separate physics mechanic |
| Optional stunt shortcut | Risk a jump or moving obstacle to save time or reach a bonus | Level-layout composition; avoid inventing a second reward pipeline |

Existing objectives already cover precision landings, hold-position, speed gates, ordered checkpoints, cargo delivery, airtime/rotation and timed passages. These rows are new *rules or variants*, not approvals to create parallel checkpoint, coin, medal or result systems.

### E. Example themed course compositions

| Example course | Short sequence | What it tests |
|---|---|---|
| Toy factory | Push tyre onto a plate → timed door → moving rollers → flipper launch → finish | Low-speed control, event wiring and airborne attitude |
| Frozen pass | Oil/ice-like low-grip approach → thin ice sheet → falling icicle → precision landing | Braking and prediction on changing surfaces |
| Hazard workshop | Timed circular saw → oscillating crusher → breakaway barrier → short escape jump | Telegraphing, rhythm and collision fairness |
| Stunt park | Booster (existing) → spring launch (existing) → midair combo → target-speed landing | Approach speed, air control and measurement |
| Mountain chase | Release a finite set of boulders → cross a yielding bridge → reach safe gate | Momentum choice, bounded spawn cost and reset |
| Cargo puzzle | Guide large bouncy ball through rollers → activate plate → cross drawbridge | Object-to-object contact, stable event states and recovery |

Author these as **small sample courses made of reusable objects**, not bespoke course scripts. Each challenge should be playable with throttle, brake, tilt and standard air rotation. Keep ordinary (non-objective) routes completable without demanding new touchscreen controls.

### F. Candidate order for future selection (not the work order)

The table ranks *potential design value* and approximate *relative implementation risk*, not measured effort or approved priorities. Scope and GO are still decided through #120 after its O1/O2 workflow.

| Candidate | Value | Relative risk | Why consider it |
|---|---|---|---|
| Spring / launch pad (existing Group 4) | High | Low–medium | Strong immediate feedback, new jump lines and vehicle-feel testing |
| Booster pad (existing Group 4) | High | Low–medium | Creates optional speed lines; must cap force and repeat activation |
| Slippery oil patch as material variant | High | Low–medium | Useful braking/traction challenge; pairs with planned surface authoring |
| Rolling tyre / bouncy ball | Medium–high | Low–medium | Low setup cost after reusable loose-body presets |
| Sliding saw | High | Medium | Strong timed obstacle; reuse saw code rather than a duplicate implementation |
| Flipper paddle | High | Medium | Memorable pinball-style interaction; depends on measured joint/impulse behavior |
| Thin ice / collapsing piece | High | Medium | Time pressure and new route choices; bounded preset breakage |
| Oscillating crusher | High | Medium | Readable rhythm challenge; explicit blocked-motion policy required |
| Cable trolley / suspended ferry | Medium | High | Distinct set piece, but vehicle contact and joint stability are unproven |
| Shallow-water buoyancy / vehicle size changes | Experimental | High | Separate physics/UX experiments; do not fold into routine object delivery |

Suggested evaluation sequence: complete the currently scoped object-authoring path first, then select **one** mechanic that strengthens driving feel and **one** that demonstrates level-editor event wiring. Prototype, measure and human-drive-test each before widening the catalogue.

### G. Shared authoring and safety notes for the addendum

- **Editor:** reuse existing object palettes, per-object inspector, IDs and typed signal links. Preview hazard sweep, release trajectories, active zones, timing and physical-vs-cosmetic distinction without running physics in Edit mode. Show meaningful invalid-reference and budget warnings.
- **Runtime:** stick to the pinned Defold/Box2D API, one fixed-tick owner and single object runtime; never derive simulation state from render visibility. Define Retry and mid-course start initial states before implementation.
- **Object budgets:** default to one or a few dynamic bodies per obstacle; set explicit per-level and per-mechanic live body, joint, spawn and collision-fragment caps. Cosmetic particles and fragments do not receive physics bodies by default.
- **Fairness and feel:** moving hazards should telegraph timing; keep random patterns seeded or deterministic per attempt. Never trap the vehicle by teleporting a closed gate through it. Ensure throttle/brake/tilt remain central.
- **Rules ownership:** rewards, medals, coin/fuel behavior and authoritative finish results belong to #262; vehicle assemblies and attachments to #198; visual decoration/material presentation to #121. Reuse the seesaw from #57 and existing saw implementations where applicable.
- **Delivery discipline:** prefer presets and small parameter sets over general logic graphs; one scoped mechanic per task with an observable example, input tests and a human drive test where needed. No entire-course fluid, destructive terrain, arbitrary fracture or new physics engine is implied by these ideas.

### H. Vehicle modifiers, temporary transformations and tyres

These are future *vehicle modifiers*, not permission to mutate Box2D bodies or shapes during a collision. Reuse the validated vehicle definitions and car-editor architecture in [#198](https://github.com/bongohorse/rider/issues/198); course items/events in #120 should request only approved presets. Every modifier needs a source, clear on-screen feedback, duration, stacking/conflict rule and Retry restoration.

| Modifier | Gameplay effect | First safe design rule / concern |
|---|---|---|
| Grow / shrink whole buggy | Huge car pushes barriers; tiny car fits into narrow tunnels | Switch between tested complete vehicle presets at a collision-free pose; handle chassis/wheels, mass/inertia, geometry, momentum, camera, joint and reset coherently |
| Bigger / smaller wheels | Climb taller blocks or squeeze through smaller gaps | Tested wheel radius, clearance and suspension presets; resizing the visual sprite alone is insufficient |
| Different wheel sets | Swap between road, off-road, balloon, heavy and other tyres | Separate cosmetic appearance from physical parameters |
| Spiked wheels | Grip tagged surfaces and possibly engage designated breakables | Start with a traction/interaction preset; physical spikes with many collision shapes need a separate cost test |
| Slippery wheels | Intentionally low grip; drift and hard braking | Wheel friction preset, explicit length of effect and recovery |
| Soft wheels | Absorb shocks, bounce or deform visually | First test compliant suspension/response plus cosmetic squash; not full soft-body tyres |
| Sticky wheels | Very high traction on difficult climbs | Clamp traction/forces; wall and ceiling driving need an additional gravity/contact experiment |
| Change suspension height | Duck through a low passage or climb over rough ground | Validate physical clearance and contact transitions; do not clip terrain |
| Light/heavy vehicle | Different jumps, inertia and load-based puzzles | Explicit validated mass preset; an occupancy plate is not a mass sensor |
| Magnetic wheels | Stick to tagged metal strips | Bounded tagged force; separate feasibility prototype |
| Temporary hover mode | Glide above short hazards | Distinct validated controller preset and safe re-landing; not mere visual lift |
| Shield / invulnerable state | Survive one declared hazard | Only after the crash/damage policy is specified; not a substitute for collisions |

**Transitions:** when a new wheel size, body scale or archetype is activated, ensure there is physical space and a valid state. Rebuild/swap the complete validated vehicle at a controlled boundary, or defer/reject the transformation; define whether linear/angular momentum is preserved. Start with friction-only tyre swaps rather than live body rescaling.

### I. Alternative vehicles and movement modes (vehicle epic, not new #120 objects)

| Archetype | Distinct player experience | Main feasibility risk |
|---|---|---|
| Unicycle (1 wheel) | Balance with torque, wheelies and precise jumps | One-point support and body stability |
| Existing buggy (2 wheels) | Baseline | Preserve handling and tests |
| Tricycle / 3-wheel buggy | Different balance and obstacle response | Additional suspension/wheel setup |
| Tracked vehicle / tank | Slow powerful climbing over uneven terrain | Expensive individual links; consider affordable contact approximation |
| Soft-wheel buggy | Cushioned landings and rebound | Controlled compliance without full soft-body physics |
| Sticky-wheel climber | Steep climbs | Adhesion forces and contact transitions |
| Hover vehicle | Gliding above surfaces | New hover force and camera model |
| Pogo-stick vehicle | Repeated spring hops | Balance, grounded timing and impulse bounds |
| Stilts / walker | Step over short gaps | Many constraints and contact instability |
| Trials-style crossbike | Weight transfer, balance and flips | New geometry, rider pose and tuned input |
| Airplane / glider | Launch, glide and land | Lift/drag forces and ground-to-air transitions |
| UFO | Hover and steer through airborne obstacles | Different flight controls |
| Flappy-style craft | Repeated tap to stay aloft | Touch control timing and level pacing |
| Train engine + wagons | Pull connected cargo over rolling hills | Couplers, joints, turning and camera length |
| Rocket craft | Directional thrust and landing | Thrust/torque, fuel/heat and safe impacts |
| Witch on a broom | Playful flying special vehicle | Flight physics, controls and animation |

**Ownership:** car construction and archetypes belong to #198 or separately approved movement experiments. #120 may eventually host a level object that activates an *already implemented* mode. Avoid building all vehicles at once: choose a single prototype and retain the stock buggy as comparison.

### J. Active abilities, stunt hoops and reward feedback

| Feature | Gameplay | Required contract |
|---|---|---|
| Player-activated nitro | Save boost for a ramp, gap or chase | Charge/duration/cooldown, force limit and justified additional touch control |
| Car jump ability | Hop on command to clear a small barrier | Ground/contact eligibility, bounded impulse, cooldown and air-control interaction |
| Rocket propulsion | Short burst of thrust, potentially midair | Chassis/world-relative direction, charge, torque and camera response |
| Recharge pickup | Restore ability charge | Reuse existing pickup and results ownership; no new economy |
| Jump-through ring | Cross a visible ring for a coin or other existing bonus | Crossing direction, whole buggy/center condition, once-per-attempt and event deduplication |
| Ring combo / ordered hoops | Chain difficult jumps for larger bonus | Order, time window, retry and intermediate feedback |
| Perfect landing / skill bonus | Combine ring, speed and precision landing | Build from existing measurements, not duplicate score logic |

**Presentation:** ring glow/pulse, particles, brief celebratory sound, floating bonus text, streak counter and clear color-independent completed state. Verify whether coin, score, gem or medal bonuses actually exist in the delivered #262 game loop; do not invent a second persistent reward system.

### K. Bridges, conveyors, cranes, balloons and cargo factories

Some basic versions are **already catalogued**: suspension bridge (Group 7), conveyors, elevator/moving platform (Group 3), launcher (Group 4), crate, ball and release dispenser (Groups 1–2). The rows below define *new variants and playable examples*, not duplicate systems.

| Variant | Distinct interaction | Authoring and safe runtime limits |
|---|---|---|
| Wooden plank bridge | Individual hinged Box2D planks sag, wobble or fail as buggy crosses | Anchors, segment size/count, joint limits/damping, break rule; short stability/mobile budget experiment first |
| Physical conveyor belt | Moves buggy, crates and balls that land on it | Signed direction/surface speed, area, accepted actor types; verify real wheel/object contact response in pinned Defold/Box2D |
| Red/green direction belt | Belts reverse or stop; moving red/green arrows signal direction and speed | Arrow direction and animation plus labels/icons (not color alone); configurable acceleration and maximum speed |
| Crate-spawner conveyor level | A finite overhead spawner drops differently sized boxes onto belts; drive over the pile | Sized presets, spawn period, live-object cap, blocked exit, deterministic sequence, cleanup and Retry |
| Elevator / freight lift | Carry buggy and loose cargo between floors | Stops, path, dwell, acceleration, blocked-motion and cargo-contact tests |
| Grab arm / mechanical claw | Reach, grab a crate/ball, transport and release it onto a target | One held actor, limited joints/reach, typed grab/release and no dangling connections |
| Flying transport platform | Airborne carrier moves along a path; buggy rides it over a gap | Guided moving platform with cosmetic hover/propellers rather than a second flight engine |
| Bounce balloon | Rebound from a giant soft balloon, chain several jumps | Bounded spring impulse, cooldown, simple physical shape and cosmetic squash/stretch |
| Balance atop a rolling ball | Stay on a large ball and move it across a passage or to a destination | Mass/radius/contact stability, explicit goal and safe recovery if ball rolls away |
| Chained machinery puzzle | Crate → belt → ball → button → claw → gate | Compose typed links and timers; bound cycles and avoid a general scripting graph |

**Conveyor acceptance example:** a crate drops onto a belt and travels in the displayed direction without buggy contact; reversing direction affects both crate and buggy. After Save/Reload and Retry, the exact same sequence plays. Crate accumulation never spawns unlimited bodies; stalled exits and full buffers must have declared behaviour. Test sloped belts and wheel traction separately.

### L. Explosives, breakage, lasers, missiles and bosses

| Object / mode | Gameplay | Safe implementation and fairness rule |
|---|---|---|
| Burning red barrel | Hit barrel → reaches damage threshold → ignites → explodes after X seconds | Explicit intact/burning/exploded states, fuse telegraph, bounded radial impulse and physical/cosmetic debris caps |
| Timed laser | Weave past intermittent laser beams or block with cargo | Clear on/off warning and accepted-actor filter; avoid offscreen instant damage |
| Homing missile | Dodge a rocket steering toward the buggy | Speed/turn cap, finite lifetime, cooldown, visible warning and limited live projectiles |
| Breakable wood | Cracks/splinters under specified impact or sustained load | Declared threshold and capped prepared fragments |
| Breakable glass | Fragile windows/platforms shatter | Impact rule and cosmetic-only shards where possible |
| Breakable stone | Heavy barrier that resists weak collisions | Stronger rule and bounded rubble |
| HP-based damage | Several distinct hits weaken an object | Hit deduplication; wheel contact every physics tick must not drain HP instantly |
| Force/impulse breakage | A sufficiently hard impact breaks the object | Verify measurable signal on pinned backend; overlap alone is not impact force |
| Weight/time breakage | Hold a heavy object on a weak plank until it fails | Define true load measurement versus occupancy+duration proxy |
| Boss chase: giant steamroller | Outdrive an oversized crushing machine moving behind the player | Deterministic bounded pursuit, readable gap/camera, safe Retry and no need for generic enemy AI |
| Boss chase: shredder vehicle | Escape a themed mechanical crusher on a collapsing track | Similar pursuit but more hazard presentation; reuse one chase runtime |
| Race a visible ghost | Beat a transparent recorded run that demonstrates the fastest line | Ghost is non-colliding replay, synchronized to attempt time; separate from physical boss |

**Damage semantics:** HP, single impact, sustained load and triggered demolition are distinct selectable rules, not a vague combined "damage" number. No arbitrary runtime fracture: use known pieces, limit physical debris, and handle explosion/Retry state atomically. Use existing finish/time/reward ownership for ghost/ring results.

### M. Time manipulation and portals — special feasibility experiments

Rider has a single fixed 60 Hz Box2D simulation owner. It is **not straightforward or physically equivalent** to run one contacted vehicle at a different clock rate from other bodies. This section describes desired player effects and candidate approximations, *not* an approved per-body time engine.

| Mode | Intended player experience | First test and honest limitation |
|---|---|---|
| Global slow motion | Dramatic slow-motion jump or crash | Explore presentation/animation and consistent global mechanics policy; preserve simulation contract and timing semantics |
| Vehicle-only slowed time | Buggy reacts slowly while machines keep moving | First approximate with reduced motor/input/thrust; physical impacts are not actually time-dilated |
| World-only slowed time | Buggy drives normally while lifts, hazards, spawners and missiles seem frozen | Scale/pause authored mechanism schedules, not free dynamic-body clocks; dynamic crates continue physically interacting |
| Freeze specific mechanisms | Stop an elevator, moving saw or conveyor temporarily | Explicit pause/resume state, blocked interactions, remaining timer and Retry |
| Fixed portal pair | Vehicle enters one portal, exits another preserving understandable orientation/speed | Atomic whole-vehicle relocation, destination clearance, momentum mapping, cooldown, camera and stable contacts |
| Cargo portal | Teleport tagged unjointed balls/crates through the same paired portals | Define supported actor types, velocity/orientation and loop prevention |
| Portal Gun | Player places entry/exit portals on valid surfaces with aim controls | Only after fixed portals pass physics tests; wall whitelist, angle and clearance rules, two active portals, mobile aiming/UI and persistence |
| Portal puzzle | Move cargo through portals to operate switches and gates | Combine proven fixed portals and typed object events, without unrestricted arbitrary teleport |

**Portal rollout gate:** fixed, aligned and stationary pair → varied orientations → stable buggy wheels/chassis → one cargo type → repeated Retry and rapid re-entry → only then investigate Portal Gun placement. Never teleport a vehicle into geometry or detach joints implicitly.

**Time rollout gate:** each experiment must specify whether only visuals, authored motors/timers, input/forces or the *entire world simulation* changes; it must not claim actual per-body local time dilation when Box2D contacts remain at a common tick. No second physics world/step or arbitrary per-body delta time is authorized.

### N. Selection and combined level concepts (unapproved backlog)

| Prototype | Source | Risk | First success criterion |
|---|---|---|---|
| Crate factory: overhead spawner + red/green belts + boxes of varying size | #120 objects/events | Medium | Buggy and crates move, pileup bounded, retry deterministic |
| Balloon canyon: balloon rebounds + bonus hoops | #120 objects and game-loop events | Low–medium | Bounce predictable, ring crossings counted once |
| Rolling-ball balance trial | #120 object + target | Medium | Balance is possible under standard controls |
| Explosive warehouse: barrels, destructible wood/glass/stone | #120 hazard/materials | Medium | Fuse readable, limited fragments, full reset |
| Steamroller chase + personal best ghost | #120 moving hazard + existing results | Medium–high | Fair camera gap, non-colliding replay |
| Jointed plank bridge + grabber claw | #120 experiments | High | Stable loading, grasp/release, mobile cost measured |
| Reversible spiked/slippery wheel pickup | #198 vehicle + #120 typed modifier request | Medium | Safe wheel effect, no physics desync |
| Tiny/giant vehicle size switch | #198 vehicle experiment | High | Complete collision-safe chassis/wheel swap |
| Nitro / jump / rocket ability | #198 vehicle controls and level abilities | Medium | Clear limited activation from mobile UI |
| Unicycle, bike, tracks, hover and flight modes | #198 separate prototypes | High | One compelling tuned mode; original buggy unaffected |
| Fixed portals → Portal Gun | #120 feasibility experiment | High → very high | Repeatable safe teleport before user placement |
| Local vehicle/world time control | #120 feasibility experiment | Very high | Honest approximation versus true physics; no second tick |

**Candidate mini-courses:** *Crate Factory* (spawn boxes over multiple belts and drive across); *Balloon Canyon* (jump rings through springy balloons); *Run from the Roller* (escape a giant machine over failing planks while racing a ghost); *Portal Lab* (send one ball through a portal to open a gate). Each would need a small implementation task, tested API usage and a separate GO. These ideas do not change the active #281 editor work or the existing milestone order.