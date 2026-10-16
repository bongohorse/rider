# Future feature roadmap (ideas, not approved work)

Status: **worked out** — idea backlog, **not** approved work. Entry gates below are proposals; scheduling still requires Claudio's explicit approval and an issue with a milestone.
Owner of priorities: Claudio. Last revised: 2026-10-16.

## How to read this

- Features are grouped into **waves**, not loose priority lists. A wave starts only when its entry gate is met.
- Every feature names a **technical approach** that fits the binding decisions (Defold 1.14.0, integrated Box2D 3.1.0, no custom physics, mobile-first, data-driven tracks).
- **Cost:** S = a few issues, M = a milestone, L = several milestones. **Mobile risk:** impact on frame time, memory or app size on the reference device (Xiaomi Mi 10T Pro).
- Status labels: *verified* (checked in engine source or docs), *plausible* (technically reasonable, untested), *experiment* (needs a prototype before any commitment).

## Guiding rules

1. **Gameplay first, effects second.** Physics (grip, drag, forces) and presentation (particles, decals, shaders) are always separate layers. Effects never change the simulation.
2. **One track format for everything.** Built-in tracks, the dev editor, the player editor and shared tracks all use the versioned station/track JSON format from A16 (#31). No levels in code.
3. **Cheap model before simulation.** Mud, honey, water and weather start as zones with grip/drag/force multipliers, not as fluid or particle simulation.
4. **Fair time trials.** Anything that changes vehicle performance must not invalidate medal times (see Wave 4).
5. **Offline first.** No backend until there is an explicit decision (the product scope currently excludes a cloud backend). Online features stay in Wave 6.
6. **Every visual feature ships with a quality tier.** Low / high setting from day one, so older phones keep 60 FPS.

## Overview

| Wave | Theme | Entry gate |
|---|---|---|
| 0 | Core loop proposals for Phases B/C | Claudio's scope decision; existing plan remains authoritative |
| 1 | Identity: surfaces, reactive obstacles, feel | Phase B fun acceptance passed |
| 2 | Content tooling: track editor | Phase C (three challenges) done; track format stable |
| 3 | Atmosphere: light and weather | Phase D art style chosen; frame budget measured with real art |
| 4 | Second vehicle and customisation | Wave 1 surfaces done; buggy feel signed off |
| 5 | More modes and replay value | Enough tracks (≥ 15) to support modes |
| 6 | Online and community | Explicit backend decision |
| X | Experiments | Any time, as timeboxed spikes; no commitment |

---

## Wave 0 – Core loop (move into the current plan)

These were listed as "future", but they *are* the game loop of a Trials/TrackMania-style game. Recommendation: consider them for Phase B/C. The current plan includes elapsed time and best time, but starts the first challenge without checkpoints; checkpoints are a later trial only if full restarts hinder learning. Medals, a personal-best ghost, fault rules and section practice remain proposals until explicitly scheduled.

| Feature | Idea | Approach | Cost | Proposed plan slot |
|---|---|---|---|---|
| Time trial + best time | Every track has a timer and a stored personal best | Local save file | S | Phase B |
| Medals | Bronze / silver / gold / author time | Author time = designer's own best run; medal thresholds derived from it | S | Phase B |
| Ghost of personal best | Race against your own best run | Record transforms per tick (not re-simulation; avoids cross-device determinism issues). Reuses A21 | S | Phase B |
| Checkpoints + instant respawn | Trials' core: respawn at last checkpoint in under a second | In-world reset (D9) to a checkpoint state | S | Phase B |
| Fault counter | Count respawns; medals require low faults | Part of result screen | S | Phase B |
| Section practice | Repeat one section without time pressure | Checkpoint + "restart section" button | S | Phase C |

---

## Wave 1 – Identity: surfaces, obstacles, feel

### Surfaces

| Feature | Idea | Approach | Cost | Mobile risk |
|---|---|---|---|---|
| Surface types | Asphalt, dirt, gravel, sand, grass, snow, ice, mud | One chain per surface segment; surface = `material` id on the chain (*verified*: Defold exposes one material id per chain, not per segment). Feel layer maps material → grip, rolling drag, speed cap | M | Low |
| Mud | Wheels lose grip, sink slightly, throw mud | Physics: low grip + extra drag + small downward offset of the visual wheel only. Visuals: particles + decals | M | Medium (particles) |
| Ice | Very low grip; momentum management | Material parameter only | S | Low |
| Tyre tracks | Different marks on sand, mud, snow, dirt | Decals in a fixed-size ring buffer; oldest marks fade out | M | Medium (draw calls) → cap count per quality tier |
| Dirt build-up | Vehicle gets progressively dirty | 3 dirt levels as overlay sprites or one shader mask, driven by time spent on dirty surfaces | S–M | Low |

Note: rolling resistance and tangent speed from Box2D 3.1 are not reachable from Lua (*verified*); grip/drag are emulated with forces in the feel layer.

### Reactive obstacles

| Feature | Idea | Approach | Cost |
|---|---|---|---|
| Crates and stacks | Push, topple, carry | Dynamic boxes; per-track body budget | S |
| Boulders | Rolling rocks, chase sequences ("escape the boulder") | Dynamic circle, high mass; scripted release trigger | S |
| Seesaws, bridges | Tilting planks, swinging/collapsing bridges | Revolute joints; chains of planks with revolute joints; breakable via joint force check (`get_reaction_force`, *verified* in bindings) | M |
| Moving platforms, pistons | Timing obstacles | Kinematic bodies on scripted paths | S |
| Springs / launch pads | Catapult the vehicle | Impulse on sensor contact | S |
| Conveyor belts | Push or slow the vehicle | Force on bodies in a sensor zone (tangent speed not exposed, see above) | S |
| Switches, doors | Pressure plate opens a gate | Sensor + simple event wiring in track data | M |
| Breakables | Planks, glass, crates break under load | Swap intact body for pre-cut pieces above an impulse threshold | M |
| Chain reactions | Ball triggers weight, weight moves bridge | Emerges from the items above; needs no extra system | – |

### Feel and personality

| Feature | Idea | Approach | Cost |
|---|---|---|---|
| Wobbly rider | Exaggerated reactions to jumps and impacts | Spring-damped visual offset of the rider sprite (no ragdoll) | S |
| Squashy tyres, visible suspension | Cartoon squash on landing | Visual scale from suspension compression | S |
| Wobbly antenna, loose parts | Secondary motion; spoiler can fall off in a crash | Visual spring; detach = spawn a short-lived debris body | S |
| Cartoon crashes | Funny, non-violent crash reactions | Crash event → animation + sound + slow-motion moment | S |
| Haptics | Short vibration on landings and crashes | *Plausible* via an Android vibration extension; check Defold extension support first | S |
| Sound set | Squeaks, rattles, tyre slip, surface sounds | Event-driven, per material | M |
| Living environment | Birds fly off, signs wobble, pebbles roll | Cosmetic only, quality tier | S |

---

## Wave 2 – Content tooling: track editor

The editor is a long-term flagship feature. Build it in two steps that share code and the track format.

| Step | Feature | Approach | Cost |
|---|---|---|---|
| 2a Dev editor | In-game editor used by us to build tracks | Runs inside the game (so it works on desktop and phone); places format objects; "play from here" | M |
| 2a | Terrain drawing | Draw/edit polylines; auto-smoothing; produces chains | M |
| 2a | Instant test | One button switches edit ↔ drive, same session | S |
| 2a | Undo/redo | Command list over track data | S |
| 2a | Object library | Ramps, crates, boulders, springs, … from Wave 1 | S |
| 2a | Grid and snapping | Snap to grid and to terrain | S |
| 2a | Property panel | Size, angle, mass, friction, motor strength; compact, touch-sized | M |
| 2a | Validation | Warns about too many bodies (budget), unreachable finish, seams that cause bumps | M |
| 2b Player editor | Same editor, simplified UI for players | Touch-first: large targets, pinch zoom, drag; fewer options than 2a | M |
| 2b | Templates | Starting tracks | S |
| 2b | Layers | Background / physics / foreground edited separately | M |
| 2b | Triggers without code | Switch → door, pressure plate → piston | M |
| 2b | **Author validation** | A track can only be shared after its author finishes it; author time becomes the gold/author medal (TrackMania rule) | S |
| 2b | Share via track code | Compressed JSON as file or text code; works offline | S |

---

## Wave 3 – Atmosphere: light and weather

Start visual, add gameplay only where it creates interesting decisions.

| Feature | Idea | Approach | Cost | Mobile risk |
|---|---|---|---|---|
| Time of day / mood | Morning, noon, sunset, night | Colour grading + background set | S | Low |
| Vehicle lights | Headlights, tail and brake lights | Additive sprites first; real light cones later | S | Low |
| 2D lighting and normal maps | Pseudo-3D depth, reactive tyres and parts | Start from the official [defold/sample-normal-maps-2d](https://github.com/defold/sample-normal-maps-2d) (MIT, updated 2026-05-27): sprite material with two samplers (diffuse + normal) and a simple per-pixel point light (*verified* in its shader). Not included and needed for Rider: rotating the normals with the sprite (wheels spin constantly), several lights (headlights + sun), shadows. Extend in a timeboxed spike, measure on the reference device | M | Medium–high (extra texture read per pixel) → quality tier |
| Light rain | Particles, wet look, slightly lower grip | Global grip multiplier on outdoor surfaces | S | Medium |
| Heavy rain, puddles | Reduced view, puddle zones with splash and lower grip | Puddle = surface zone | M | Medium |
| Snow | Snowfall, snow tracks, lower grip | Snow surface + particles | M | Medium |
| Thunderstorm | Flashes, thunder | Lighting flashes + audio; no gameplay change | S | Low |
| Wind / fans | Wind affects jumps and light objects | Force zones; same system as fans | S | Low |
| Weather per track | Track data selects weather | Editor property (Wave 2) | S | – |

Cut or deferred: **hail physics** (little gameplay value), **tornado** and **floods** (move to Experiments), **weather change during a run** (conflicts with fair time trials; only for special tracks).

---

## Wave 4 – Second vehicle and customisation

| Feature | Idea | Approach | Cost |
|---|---|---|---|
| Motorbike | Second vehicle; closest to Trials and most different feel | Two wheels, lean-heavy tuning in the existing feel layer | M |
| Vehicle classes | Light buggy, bike, heavy truck | Each track declares allowed class(es); medals per class | M |
| Truck / transport tasks | Heavy, big wheels, carry cargo to the finish | Cargo = dynamic boxes; finish requires cargo | M |
| Cosmetics | Colours, stickers, spoilers, antennas | Visual only; no stat changes | M |
| Performance upgrades | Engine, suspension, tyres | **Only in a separate mode** (e.g. career/free play). Time trials and medals use fixed, published vehicle stats, otherwise times become incomparable | M |
| Tyre choice | Road / off-road / wide | Same rule as upgrades; strong fit for mud challenges | S |

Vehicle builder: see [vehicle-builder.md](vehicle-builder.md).

Deferred: **water vehicles** (needs buoyancy and a separate track type; see Experiments), **fun vehicles** (pick concrete ideas after the bike proves a second vehicle works).

---

## Wave 5 – Modes and replay value

| Feature | Idea | Approach | Cost |
|---|---|---|---|
| Hidden shortcuts | Riskier, faster lines | Track design guideline, no system needed | – |
| Collectibles | Bonus items in hard spots | Sensor pickups, stored per track | S |
| Stunt mode | Points for flips, airtime, clean landings | Score from rotation/airtime tracking | M |
| Puzzle mode | Solve obstacles with physics | Track type with goal conditions | M |
| Daily challenge (offline) | One featured track per day | Deterministic pick from bundled tracks by date; no server | S |
| Vehicle challenges | Same track, different vehicle | Needs Wave 4 | S |
| Replay camera | Watch runs from other angles | Reuse transform recordings | M |
| Photo mode | Pause, free camera, save image | Cheap and shareable | S |
| Training mode | Practice sections without timer | Extends section practice from Wave 0 | S |
| Accessibility | Movable/scalable/transparent touch buttons, left-handed layout, controller support | Input already normalised to commands; layout editor + gamepad mapping | M |
| Favourites | Mark favourite tracks | Local list | S |

Note: adjustable touch layout and left-handed layout should move up to Phase B/C if early testers struggle with the default layout.

---

## Wave 6 – Online and community (needs a backend decision)

| Feature | Note |
|---|---|
| Online leaderboards | Needs a server and cheat protection (ghost/input validation) |
| Community tracks: publish, rate, download | Needs hosting, moderation and a privacy review |
| Creator profiles | Needs accounts |
| Community competitions | Builds on leaderboards |
| Video/replay export | Heavy on mobile; prefer sharing ghost/track codes |

Until a decision: track codes (Wave 2) cover sharing offline.

---

## Experiments (timeboxed spikes, no commitment)

| Idea | Cheap version to test first |
|---|---|
| Soft-body vehicle or objects (JellyCar-like) | Ring of small bodies connected by joints; measure stability and step time |
| Honey / sticky world | Surface zone with high drag + sticky force; no fluid simulation |
| Water and buoyancy (floods, boats) | Water zone applying buoyancy and drag forces per body |
| Fluids (water, mud as liquid) | Only if the zone versions above prove insufficient; likely too expensive for mobile |
| Magnets | Radial force on bodies tagged "metal" |
| Gravity zones | Per-zone gravity scale / direction via forces |
| Portals | Teleport with preserved velocity; check camera and ghost behaviour |
| Collapsing buildings | Pre-fractured structures with joints and break thresholds |
| Vehicle swap mid-track | Needs Wave 4 |
| Tornado | Force field + debris; spectacle event, not a weather mode |
| Editor assistant | Automatic detection of problem spots (extends editor validation) |
| Random challenges | Combine prepared obstacle modules |

---

## Open decisions

- Art style base: plastic toy, wooden blocks or gummy look (decide in Phase D, ideally after a one-day style test of each on the gym).
- Backend: yes/no and when (blocks Wave 6).
- Monetisation: currently out of scope; if it comes, cosmetics fit better than performance upgrades.
