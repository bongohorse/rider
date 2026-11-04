# Challenges, rewards and sample courses

Status: **worked out** (idea catalogue; not implementation authorization)

These are speculative gameplay proposals and historical design notes. **Do not implement from this folder.** Current scope, issue ownership, milestones and any GO are controlled by [#120](https://github.com/bongohorse/rider/issues/120) and its sub-issues; vehicle architecture lives under [#198](https://github.com/bongohorse/rider/issues/198).

Skill targets, stunt rings, cargo tasks, timed challenges and themed level concepts. Reuse the game loop rather than inventing a second reward system.

**Contents:** [Group 6 — Objectives and combined challenges](#group-6--objectives-and-combined-challenges) · [D. New objective and skill-rule variants](#d-new-objective-and-skill-rule-variants) · [E. Example themed course compositions](#e-example-themed-course-compositions) · [J. Active abilities, stunt hoops and reward feedback](#j-active-abilities-stunt-hoops-and-reward-feedback) · [N. Selection and combined level concepts (unapproved backlog)](#n-selection-and-combined-level-concepts-unapproved-backlog)

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

## D. New objective and skill-rule variants

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

## E. Example themed course compositions

| Example course | Short sequence | What it tests |
|---|---|---|
| Toy factory | Push tyre onto a plate → timed door → moving rollers → flipper launch → finish | Low-speed control, event wiring and airborne attitude |
| Frozen pass | Oil/ice-like low-grip approach → thin ice sheet → falling icicle → precision landing | Braking and prediction on changing surfaces |
| Hazard workshop | Timed circular saw → oscillating crusher → breakaway barrier → short escape jump | Telegraphing, rhythm and collision fairness |
| Stunt park | Booster (existing) → spring launch (existing) → midair combo → target-speed landing | Approach speed, air control and measurement |
| Mountain chase | Release a finite set of boulders → cross a yielding bridge → reach safe gate | Momentum choice, bounded spawn cost and reset |
| Cargo puzzle | Guide large bouncy ball through rollers → activate plate → cross drawbridge | Object-to-object contact, stable event states and recovery |

Author these as **small sample courses made of reusable objects**, not bespoke course scripts. Each challenge should be playable with throttle, brake, tilt and standard air rotation. Keep ordinary (non-objective) routes completable without demanding new touchscreen controls.

## J. Active abilities, stunt hoops and reward feedback

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

## N. Selection and combined level concepts (unapproved backlog)

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
