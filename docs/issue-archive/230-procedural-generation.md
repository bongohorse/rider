# Issue #230 archived planning text

Full body of [#230 [Future] Procedural content generation: playable course drafts, variants and mobile design](https://github.com/bongohorse/rider/issues/230), moved here on 2026-11-02 (unchanged except repo-relative links made absolute) during the issue cleanup ([issue guide](../ISSUES.md#length)). Current scope, binding rules and GOs live in the issue body, its sub-issues and STATUS.md; superseded parts of this text are history.

**Contents:** [Goal and status](#goal-and-status) · [Index](#index) · [Scope and existing owners](#scope-and-existing-owners) · [Delivery order](#delivery-order) · [Group 1 — Passage library and connection rules](#group-1--passage-library-and-connection-rules) · [Group 2 — Selected-passage generation](#group-2--selected-passage-generation) · [Group 3 — Finite course drafts and pacing](#group-3--finite-course-drafts-and-pacing) · [Group 4 — Rewards and interactive challenges](#group-4--rewards-and-interactive-challenges) · [Group 5 — Presentation and production helpers](#group-5--presentation-and-production-helpers) · [Group 6 — Repeatable course variants and sharing](#group-6--repeatable-course-variants-and-sharing) · [Group 7 — Separate feasibility experiments](#group-7--separate-feasibility-experiments) · [Generator methods and Box2D boundaries](#generator-methods-and-box2d-boundaries) · [Editor workflow and generation controls](#editor-workflow-and-generation-controls) · [Validation and quality evaluation](#validation-and-quality-evaluation) · [Shared acceptance requirements](#shared-acceptance-requirements) · [Suggested first experiment](#suggested-first-experiment) · [Research references](#research-references)

## Goal and status

Use controlled procedural generation to create more good Rider content with less manual authoring. Prioritize enjoyable driving, readable mobile gameplay and editable results over unlimited random content.

**Status: future research / planning epic. Not an implementation GO, milestone assignment or schedule change.** Expanded and reorganized on 2026-10-22.

Recommended direction: **generate a passage or finite course draft from proven authored building blocks → drive-test → edit → save as a normal level.** Runtime endless generation is a separate later experiment.

## Index

- [Scope and existing owners](#scope-and-existing-owners)
- [Delivery order](#delivery-order)
- [Group 1 — Passage library and connection rules](#group-1--passage-library-and-connection-rules)
- [Group 2 — Selected-passage generation](#group-2--selected-passage-generation)
- [Group 3 — Finite course drafts and pacing](#group-3--finite-course-drafts-and-pacing)
- [Group 4 — Rewards and interactive challenges](#group-4--rewards-and-interactive-challenges)
- [Group 5 — Presentation and production helpers](#group-5--presentation-and-production-helpers)
- [Group 6 — Repeatable course variants and sharing](#group-6--repeatable-course-variants-and-sharing)
- [Group 7 — Separate feasibility experiments](#group-7--separate-feasibility-experiments)
- [Generator methods and Box2D boundaries](#generator-methods-and-box2d-boundaries)
- [Editor workflow and generation controls](#editor-workflow-and-generation-controls)
- [Validation and quality evaluation](#validation-and-quality-evaluation)
- [Shared acceptance requirements](#shared-acceptance-requirements)
- [Suggested first experiment](#suggested-first-experiment)
- [Research references](#research-references)

## Scope and existing owners

This issue owns the cross-cutting procedural generation/design direction and eventual integration between selected systems. Existing issues retain ownership:

| Existing owner | Relationship |
|---|---|
| #175 — passage library | Reuse authored passages and their metadata; no second passage library |
| #180 — variant-series work | Reuse its existing variation capabilities rather than implementing duplicates |
| #121 — visual/environment generation | Owns terrain appearance, decoration, backgrounds and atmosphere |
| #120 — interactive objects and objectives | Supplies actual runtime mechanics; generation only places/configures supported objects |
| #198 — car editor | Defines supported vehicles; generation must declare the target vehicle rather than randomly retuning its physics |
| #118, #168, #169, #170 — editor work | Reuse document, selection, authoring, validation and Play workflows |

Check current scope/status before splitting implementation tasks. This epic does not expand the editor MVP or authorize unfinished mechanics.

Keep one physics owner, the existing level data/runtime path and pinned engine. No LLM, online service or general generator framework is required for the initial experiment.

## Delivery order

These are planning groups, not mandatory large delivery packages.

| Order | Group | Useful outcome / dependency |
|---|---|---|
| 1 | Passage library and connection rules | A few proven modules can connect under explicit vehicle/geometry assumptions |
| 2 | Selected-passage generation | Generate editable alternatives for one bounded section |
| 3 | Finite course drafts and pacing | Compose complete short courses with a designed challenge/recovery rhythm |
| 4 | Rewards and interactive challenges | Place supported objectives and mechanisms into suitable course contexts |
| 5 | Presentation and production helpers | Reuse visual generation after driving structure is accepted |
| 6 | Repeatable course variants and sharing | Preserve accepted courses and versioned configurations |
| 7 | Separate feasibility experiments | Endless modes, search and advanced adaptation only after evidence supports them |

Group 5 can progress independently under #121. Saving concrete generated geometry and reproducible inputs belong to the first experiment; Group 6 adds distribution and richer variant management.

## Group 1 — Passage library and connection rules

**Purpose:** make a small set of authored driving situations reusable without assuming every geometrically connected combination is playable.

| Building block | Driving role | Useful metadata |
|---|---|---|
| Start / run-in | Safe spawn and preparation | Start clearance, allowed initial speed, approach length |
| Acceleration / braking section | Reach or shed speed | Length, slope, intended entry/exit speed range |
| Wave / rolling terrain | Flow and suspension rhythm | Wavelength, amplitude, transition limits, vehicle assumptions |
| Ramp and landing pair | Controlled jump | Takeoff shape, expected approach range, landing area and recovery space |
| Step / precision section | Controlled wheel placement | Step dimensions, clearance and intended approach |
| Recovery / rest section | Regain control after difficulty | Safe width/length, grade and exit conditions |
| Finish section | Readable end to the course | Approach, stop/run-out space and finish direction |

Candidate connection rules:

- Endpoint position, height and slope/tangent; supported terrain representation and continuity.
- Approach distance, expected speed envelope, clearance and vehicle dimensions.
- Takeoff, landing and safe recovery space; avoid blind landings and unavoidable hazards.
- Explicit allowed predecessors/successors where rules are easier to author than infer.
- Repetition tags, challenge type, approximate duration and supported difficulty range.
- Versioned module identity and known drive-test evidence.

A speed envelope is an authored or measured assumption, not proof that every player arrives at that speed. Do not require a full vehicle trajectory solver to connect the first few modules.

## Group 2 — Selected-passage generation

**Purpose:** help authors improve one section without replacing a complete handmade course.

| Feature | Behaviour |
|---|---|
| Generate between anchors | Suggest a bounded section while preserving its external connection conditions |
| Parametric alternatives | Vary supported wave/ramp/transition parameters within approved ranges |
| Candidate preview | Offer a small bounded set of alternatives with clear differences |
| Lock manual content | Preserve selected geometry, START/FINISH and protected objects |
| Replace with Undo | Commit the selected candidate as one coherent document operation |
| Explain rejection | State why anchors, bounds or budgets prevent a valid candidate |
| Retry with a seed | Reproduce candidate generation using the same versions and configuration |

Start with a short supported terrain section and a few meaningful parameters. Complex jump replacement and interactive objects can come later.

Preserve external references and stable object identities according to the chosen replacement policy. Do not silently remove manually wired objects or strand connections.

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

## Group 5 — Presentation and production helpers

**Ownership remains with #121 and relevant asset systems.** These are integration opportunities, not duplicate implementations.

| Helper | Potential benefit / boundary |
|---|---|
| Decoration placement | Place props beside accepted driving geometry using clearance/exclusion regions |
| Biome palettes and backgrounds | Give course families a consistent identity and readable silhouette |
| Scenery profiles | Add distant hills/trees without changing collision terrain |
| Material appearance | Vary dirt/wood/plastic appearance; physical grip changes require explicit gameplay support |
| Atmosphere variants | Lighting/weather ambience while keeping hazards and landings readable |
| Vehicle cosmetic variants | Approved colours/patterns through #198; no random mass, grip or motor tuning |
| Arcade sound variants | Optional offline SFX authoring with controlled loudness and consistent identity |

Generate gameplay structure first and decorate afterward. Decorative props must not unexpectedly become colliders. Separate cosmetic random streams from gameplay; visual quality tiers must preserve the same course and physics.

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

## Group 7 — Separate feasibility experiments

| Experiment | Question to answer before expanding |
|---|---|
| Endless runtime courses | Does this mode improve Rider enough to justify streaming, pooling, visibility and recovery complexity? |
| Search-based candidate selection | Can a small bounded search reduce author corrections compared with simple authored rules? |
| Simulation-assisted reachability | Does a repeatable test catch useful failures without wrongly claiming general playability? |
| Vehicle-aware generation | Can declared stock vehicle profiles select suitable courses without secretly changing physics? |
| Adaptive difficulty | Can explicit, understandable options help players without changing an active attempt or invalidating comparisons? |
| Grammar/graph-based challenge sequences | Do more structured interaction templates produce useful variety with manageable validation? |
| WFC-style pattern generation | Is there a concrete tile/decor use under #121 beyond simpler placement rules? |
| Diagnostic course generation | Can a narrow generator reproduce a specific slope, seam or landing bug faster than a handmade fixture? |

No broad test framework, AI driver, cloud generation service or procedural vehicle-physics system is authorized by this catalogue.

## Generator methods and Box2D boundaries

| Method / building block | Suitable role | Limitation |
|---|---|---|
| Authored module assembly | Initial course structure | Requires tested modules and connection rules |
| Bounded parametric curves | Waves, grades and transitions | Parameter validity does not prove driving quality |
| Weighted selection and repetition limits | Variety and pacing | Random choice alone does not create good progression |
| Small rule/state sequence | Introduction, challenge and recovery | Keep rules scoped to actual content |
| Noise | Scenery and restrained terrain modulation | Not a complete driving-level designer |
| WFC | Optional local visual/tile patterns | Does not establish vehicle reachability |
| Box2D shapes, joints and forces | Simulate supported generated terrain/objects through existing runtime | Box2D is the physics engine, not a course generator |
| Physics queries where exposed | Candidate clearance/overlap checks | Check pinned Defold API; local checks are not playability proof |

Use the pinned engine and existing collider construction. Reuse accepted mechanisms from #120 rather than generating arbitrary joint graphs. Respect geometry/body/joint/contact budgets and safe initial placement.

## Editor workflow and generation controls

Proposed author workflow:

1. Select a section or choose a finite draft template.
2. Choose a small set of relevant controls.
3. Generate and inspect a bounded preview.
4. Accept a candidate as a normal editable level operation.
5. Drive-test, correct and save.

Candidate controls, narrowed per selected slice:

| Control | Meaning |
|---|---|
| Seed | Reproducible generation within pinned versions |
| Scope | Selected passage or finite course |
| Target vehicle/preset | Explicit assumptions for clearance and driving |
| Length | Approximate distance or estimated duration |
| Emphasis | Supported flow/jump/precision focus |
| Difficulty range | Validated constraints, not an unsupported universal score |
| Locked content | Geometry/objects the generator must preserve |
| Environment | Optional #121 presentation preset |

Keep explanations short and results editable. Repeated generation must not overwrite accepted work or pollute Undo with partial intermediate candidates. A failed generation leaves the document intact and returns a useful reason. Cancellation must discard obsolete results if generation is asynchronous.

## Validation and quality evaluation

Separate three kinds of evidence:

| Evidence | What it can establish |
|---|---|
| Structural checks | Valid schema, finite geometry, legal connections, bounds, budgets and object references |
| Focused physics/drive checks | Specific clearance, contact, reset or successful-run observations under declared conditions |
| Human drive feedback | Flow, readability, challenge, repetition, fairness and desire to retry |

Measure representative seeds against a declared vehicle/preset and reference phone. Record rejected candidates and correction effort, not only successful screenshots.

Useful evaluation questions:

- Can the next hazard and landing be read with the normal gameplay camera?
- Are there meaningful differences between generated courses?
- Do errors come from a bad module, bad connection or bad sequence?
- How often does the author need to repair a draft?
- Is generating and correcting faster than manual authoring?
- Do generation time, loading, memory and runtime cost fit measured budgets?
- Does Retry and Edit ↔ Play preserve the same course and intended initial state?

Use a small reproducible sample appropriate to the experiment; agree it when scoping. Do not invent acceptance percentages or launch a large automated benchmark upfront.

## Shared acceptance requirements

1. **Reuse:** use existing level documents/runtime, passage/variant owners and implemented object mechanics.
2. **Editable result:** accepted output is normal level data; no hidden generator-only physics.
3. **Reproducibility:** preserve configuration, seed and versions; save concrete accepted content according to the chosen policy.
4. **Safe edits:** preserve locked/manual content, valid references and coherent Undo; failures leave the source document intact.
5. **Driving validity:** validate geometry and initial placement; document assumptions and human drive-test evidence rather than claiming guaranteed fun.
6. **Reset and fairness:** Retry does not regenerate; object phases, randomness and checkpoint policy are explicit.
7. **Bounded work:** cap candidates/retries, geometry and object counts; handle unsatisfiable constraints without an unbounded search.
8. **Mobile quality:** check readability, generation/loading cost and runtime performance on the reference phone.
9. **Cosmetic separation:** decoration streams and quality tiers do not alter gameplay.
10. **Scoped delivery:** each selected task has 1–3 concrete acceptance criteria, explicit dependencies and Claudio's drive-feedback gate.

## Suggested first experiment

**One short selected passage, one declared stock vehicle/preset, a few proven modules or bounded curve variants.**

- Preserve both boundary conditions and locked neighbouring content.
- Generate one candidate at a time from a saved seed.
- Preview → accept as one Undo operation → Drive → edit/save normally.
- Reject invalid or over-budget candidates with a clear reason.
- Compare correction effort and driving quality with manually creating the same passage.

**Exclude initially:** whole-course objective graphs, endless streaming, adaptive difficulty, cloud services, sharing infrastructure and new physics mechanics.

Stop after the experiment and Claudio's drive feedback before expanding. No implementation or extra automation is authorized by this planning update.

## Research references

Retained from the original research list dated 2026-10-20. These inform design proposals; they do not prove Rider-specific feasibility or constitute new verification in this update.

- [Dead Cells: The Level Design — A Hybrid Approach](https://deepnight.net/tutorial/the-level-design-of-dead-cells-a-hybrid-approach/) — authored chunks, constraints and pacing.
- [Alto's Odyssey official press kit](https://altosodyssey.com/press/) — mobile reference for generated environments and physics-based movement.
- [Spelunky generator breakdown: path](https://tinysubversions.com/spelunkyGen/) and [room templates](https://tinysubversions.com/spelunkyGen2/) — structural/template generation reference.
- [Procedural Content Generation in Games](https://www.pcgbook.com/), especially [mixed-initiative creation](https://www.pcgbook.com/chapter11.pdf) and [evaluation](https://www.pcgbook.com/chapter12.pdf).
- [Jetpack Joyride: Depth in Simplicity](https://www.gdcvault.com/play/1015527/Depth-in-Simplicity-The-Making) — supplementary mobile design reference.
- [WaveFunctionCollapse](https://github.com/mxgmn/WaveFunctionCollapse) — optional local pattern generation reference, not an initial dependency.
- [Bfxr](https://www.bfxr.net/) — optional offline arcade SFX authoring.
