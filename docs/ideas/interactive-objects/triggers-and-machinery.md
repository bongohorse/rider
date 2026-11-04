# Triggers, motors and mechanical transport

Status: **worked out** (idea catalogue; not implementation authorization)

These are speculative gameplay proposals and historical design notes. **Do not implement from this folder.** Current scope, issue ownership, milestones and any GO are controlled by [#120](https://github.com/bongohorse/rider/issues/120) and its sub-issues; vehicle architecture lives under [#198](https://github.com/bongohorse/rider/issues/198).

Switches, gates, cranes, lifts, moving platforms, belts, crate factories and chain reactions.

**Contents:** [Group 2 — Triggers and simple reactions](#group-2--triggers-and-simple-reactions) · [Group 3 — Guided and rotating movement](#group-3--guided-and-rotating-movement) · [B. New active machinery and precision hazards](#b-new-active-machinery-and-precision-hazards) · [K. Bridges, conveyors, cranes, balloons and cargo factories](#k-bridges-conveyors-cranes-balloons-and-cargo-factories)

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

## B. New active machinery and precision hazards

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

## K. Bridges, conveyors, cranes, balloons and cargo factories

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
