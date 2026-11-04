# Finite course design, challenges and repeatable variants

**Status:** worked-out concept; **not approved for implementation**. Historical source: [Issue #230](https://github.com/bongohorse/rider/issues/230) (backlog, needs GO). Current issues/child tasks and code contracts take precedence.

Keep finite generated routes readable, playable and editable; reuse supported objectives and recorded seeds.

## Group 3 — Finite course drafts and pacing

**Purpose:** generate a usable starting point for a short authored level.

| Idea | Design intent |
|---|---|
| Course outline | Introduction → preparation → challenge → recovery → finish |
| Driving emphasis | Flow, jumps, precision or balance; select only supported categories |
| Difficulty envelope | Bound obstacle dimensions and combinations against a declared vehicle/preset |
| Repetition limits | Limit repeated modules, similar jumps and identical challenge sequences |
| Recovery budget | Require enough safe driving between demanding passages |
| Gradual introduction | Show a mechanic in a simpler situation before combining it |
| Length target | Approximate distance or expected duration; label duration as an estimate |
| Terrain profile | Bounded hills, descents and valleys with controlled slope/clearance |
| Alternative solutions | Leave room for different driving approaches where intended |
| Fair failure design | Avoid traps, immediate blind hazards and impossible landings after required actions |

Difficulty must describe actual driving demands, not simply increase slope, speed and obstacle density together. Consider combinations: two individually easy passages may be difficult when the first disrupts the second's approach.

Do not promise branching routes until the terrain/editor representation supports them.

## Group 4 — Rewards and interactive challenges

Depends on implemented, tested runtime objects from #120.

| Candidate | Useful generation rule |
|---|---|
| Collectible placement | Place on intentional reachable driving/jump lines; optional risk should be readable |
| Precision landing | Choose a suitable landing and explicit tolerance for the target vehicle |
| Hold-position challenge | Place on a surface that can safely contain the vehicle |
| Cargo delivery | Provide a usable loading approach, transport route and valid target socket |
| Pressure plate and gate | Ensure the player can reach and operate the source before the target is required |
| Timed passage | Allow for operation, travel and recovery; avoid arbitrary impossible timing |
| Moving obstacle | Declare phase, entry conditions, waiting space and safe exit |
| Booster and jump | Treat launch and landing as one designed combination; bounded effects |
| Balance section | Reuse accepted seesaws/platforms with viable approaches and exits |
| Optional task / shortcut | Preserve a valid main route; use existing route support only |

Generate small approved interaction templates first, not arbitrary event graphs. Cap object counts and validate references/reset policy. A successful simulated run demonstrates one solution, not fairness or fun.

Checkpoints remain owned by the existing progression work. Candidate checkpoint positions need safe authored respawn conditions and explicit obstacle/event state policy.

## Group 6 — Repeatable course variants and sharing

| Feature | Behaviour / dependency |
|---|---|
| Seeded drafts | Save seed, generator version, settings and content/vehicle assumptions |
| Baked level snapshot | Preserve accepted concrete geometry and object data through the normal level format |
| Course families | Bounded variations around an accepted template; reuse #180 |
| Shared daily course | Everyone receives the same resolved course/configuration for a declared period |
| Curated packs | Human-select generated drafts, edit them and publish through existing content workflows |
| Build/course pairing | Declare the supported vehicle and assists; custom builds need separate validity/rules |
| Version handling | Older accepted levels remain playable without silently regenerating into different courses |

A seed alone is insufficient for durable sharing after modules or algorithms change. Choose a concrete baking/version policy before shipping shared courses.

Retry must preserve the course. Identical generation inputs do not guarantee bit-identical cross-device physics simulation. Competitive scoring, anti-cheat, online distribution and leaderboards are separately scoped work.

