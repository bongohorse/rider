# Driving surfaces, hazards and damage

Status: **worked out** (idea catalogue; not implementation authorization)

These are speculative gameplay proposals and historical design notes. **Do not implement from this folder.** Current scope, issue ownership, milestones and any GO are controlled by [#120](https://github.com/bongohorse/rider/issues/120) and its sub-issues; vehicle architecture lives under [#198](https://github.com/bongohorse/rider/issues/198).

Terrain effects, forces, saws, lasers, missiles, explosives, destructible materials and chasing hazards.

**Contents:** [Group 4 — Driving surfaces and force effects](#group-4--driving-surfaces-and-force-effects) · [C. Surface and environment interactions](#c-surface-and-environment-interactions) · [L. Explosives, breakage, lasers, missiles and bosses](#l-explosives-breakage-lasers-missiles-and-bosses)

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

## C. Surface and environment interactions

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

## L. Explosives, breakage, lasers, missiles and bosses

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
