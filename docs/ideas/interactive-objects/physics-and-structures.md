# Physical objects and breakable structures

Status: **worked out** (idea catalogue; not implementation authorization)

These are speculative gameplay proposals and historical design notes. **Do not implement from this folder.** Current scope, issue ownership, milestones and any GO are controlled by [#120](https://github.com/bongohorse/rider/issues/120) and its sub-issues; vehicle architecture lives under [#198](https://github.com/bongohorse/rider/issues/198).

Pushable toys, balancing objects, yielding surfaces and destructible props; see [hazards](surfaces-and-hazards.md) for damage and explosions.

**Contents:** [Group 1 — Basic physics objects and balance](#group-1--basic-physics-objects-and-balance) · [Group 5 — Yielding and breakable structures](#group-5--yielding-and-breakable-structures) · [A. Additional physical toys and cargo](#a-additional-physical-toys-and-cargo)

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

## A. Additional physical toys and cargo

| Concept | Driving interaction | Authoring / feasibility considerations |
|---|---|---|
| Loose tyre / tyre stack | Roll a tyre, push a soft obstacle or topple a small stack before a climb | Circular-body preset, tyre count and contact cap; not the vehicle wheel assembly |
| Oversized bouncy ball | Push a ball that rebounds strongly; use it as a temporary moving obstacle | Radius, bounded restitution and damping; avoid energy gain and retry drift |
| Tipping container | Drive into a large container to rotate it into a ramp or block a passage | Pivot, initial angle, stops and mass; fixed shape rather than free breakage |
| Snap-off bumper / obstacle | Hit a small obstacle hard enough to detach it from its mount | Declared impact rule, one-time state and capped released bodies |
| Fragile crystal / glass barrier | Break a shortcut barrier by impact, with clearly readable risk | Fixed break condition and pre-cut collision pieces; cosmetic shards separately budgeted |
| Rolling tyre obstacle course | Thread between a few loose wheels or knock them into a gap | Composition of the tyre preset; no separate runtime system |

Related existing entries: crates, balls, boulders, barrels, seesaws, breakaway mounts and dominoes remain in Groups 1 and 5; do not duplicate them.
