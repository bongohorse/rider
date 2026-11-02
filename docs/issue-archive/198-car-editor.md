# Issue #198 archived planning text

Full body of [#198 [Vehicle] Car editor: assemble and drive different cars (epic)](https://github.com/bongohorse/rider/issues/198), moved here unchanged on 2026-11-02 so the issue can stay a short current spec ([issue guide](../ISSUES.md#length)). The issue and its sub-issues decide scope, order and GO; this catalogue is background, not an implementation GO.

**Contents:** [Goal and status](#goal-and-status) · [Index](#index) · [Research basis and approved delivery plan](#research-basis-and-approved-delivery-plan) · [Scope and ownership](#scope-and-ownership) · [Delivery order and dependencies](#delivery-order-and-dependencies) · [Group 1 — Vehicle data and baseline parity](#group-1--vehicle-data-and-baseline-parity) · [Group 2 — Fixed-frame part swapping](#group-2--fixed-frame-part-swapping) · [Group 3 — Tuning and understandable feedback](#group-3--tuning-and-understandable-feedback) · [Group 4 — Workshop tools and vehicle library](#group-4--workshop-tools-and-vehicle-library) · [Group 5 — Grid construction](#group-5--grid-construction) · [Group 6 — Driving experiments and course integration](#group-6--driving-experiments-and-course-integration) · [Group 7 — Advanced attachments and feasibility experiments](#group-7--advanced-attachments-and-feasibility-experiments) · [Box2D building blocks and limits](#box2d-building-blocks-and-limits) · [Shared acceptance requirements](#shared-acceptance-requirements) · [Suggested first playable slice](#suggested-first-playable-slice) · [Open decisions and exclusions](#open-decisions-and-exclusions)

## Goal and status

Build a car editor where players assemble, tune and drive different vehicles on Rider's normal courses. Keep the workshop approachable: changing a part should produce an understandable difference during the next drive.

**Status: future planning epic / backlog, not an implementation GO.** Expanded and reorganized at Claudio's request on 2026-10-22. The groups below are a candidate delivery order, not a commitment to implement the entire catalogue.

Background: [vehicle-builder idea](https://github.com/bongohorse/rider/blob/main/docs/ideas/vehicle-builder.md). The idea document contains earlier proposals, including grid-first construction and sharing; this issue proposes a smaller part-swap stage first. Reconcile affected documentation when implementation is scoped rather than treating every older proposal as an MVP prerequisite.

## Index

- [Research basis and approved delivery plan](#research-basis-and-approved-delivery-plan)

- [Scope and ownership](#scope-and-ownership)
- [Delivery order and dependencies](#delivery-order-and-dependencies)
- [Group 1 — Vehicle data and baseline parity](#group-1--vehicle-data-and-baseline-parity)
- [Group 2 — Fixed-frame part swapping](#group-2--fixed-frame-part-swapping)
- [Group 3 — Tuning and understandable feedback](#group-3--tuning-and-understandable-feedback)
- [Group 4 — Workshop tools and vehicle library](#group-4--workshop-tools-and-vehicle-library)
- [Group 5 — Grid construction](#group-5--grid-construction)
- [Group 6 — Driving experiments and course integration](#group-6--driving-experiments-and-course-integration)
- [Group 7 — Advanced attachments and feasibility experiments](#group-7--advanced-attachments-and-feasibility-experiments)
- [Box2D building blocks and limits](#box2d-building-blocks-and-limits)
- [Shared acceptance requirements](#shared-acceptance-requirements)
- [Suggested first playable slice](#suggested-first-playable-slice)
- [Open decisions and exclusions](#open-decisions-and-exclusions)

## Research basis and approved delivery plan

Plan approved by Claudio on 2026-10-24: prioritize **long, visually substantial 2D courses that are fast to author and smooth to play**. Issue creation approves backlog organisation, not runtime implementation or a new milestone. Preserve the existing per-task scope/GO/drive-test process.

Primary references: [HCR2 technical reference](https://github.com/bongohorse/rider/blob/main/docs/research/HCR2_Technical_Reference_for_Rider.md), [asset/graphics findings](https://github.com/bongohorse/rider/blob/main/docs/research/assets_findings.md), [native findings and limitations](https://github.com/bongohorse/rider/blob/main/docs/research/native_findings.md). Original shader math supports terrain-body extension, depth/UV changes and authored lighting; some original models have depth coordinates. HCR2's full CPU mesh generator, projection, chunk/culling policy, physics laws and numerical tuning are not recovered. Treat our architecture as independent Rider work, using Rider-owned art/code.

### Deferred vehicle foundation

- [ ] #282 — stock buggy from a validated versioned vehicle definition, with baseline parity.

Terrain/rendering/performance (#263), long-course editor work (#168/#169) and a useful first game loop (#262) take precedence over a player-facing workshop. Preserve the existing Phase B fun-acceptance prerequisite; this vehicle task is not a dependency of the terrain/editor work.

Keep physical mass/collision/joints, cosmetic layers and event-driven equipment modifiers distinct. Use Rider's measured motor/suspension/traction behavior and explicit parameter ownership; HCR2 wheel-tier shaders establish visual blending only, and reconstructed HCR2 mass/spring/grip constants are not verified balancing data. Record vehicle/build/assist identity with #262 results. Reuse #36 recording/ghost features and existing test stations where applicable.

Later attachments and boosts must share bounded event/reset semantics with #120/#262; this update does not create a universal equipment framework or promote the entire catalogue into immediate scope.


## Scope and ownership

- This epic owns vehicle definitions, assembly validation, workshop interactions and vehicle-specific tuning.
- Reuse the existing [vehicle contract](https://github.com/bongohorse/rider/blob/main/docs/contracts/vehicle.md), feel layer, normalized input commands, physics ownership and canonical Retry path.
- Reuse level-editor document, validation, Undo and Edit/Play patterns where appropriate. Avoid coupling vehicle documents to terrain documents or building a second general editor framework.
- #120 owns interactive course objects and event wiring. Shared crates, cargo targets and hazards should reuse that runtime; vehicle attachments belong here.
- Keep clear 2D side-view gameplay and the consistent toy visual style. Cosmetic choices must declare whether they affect collision or mass.
- Core interactions should remain compatible with throttle, brake/reverse and lean/tilt. An attachment needing additional controls requires a separate mobile-control decision.
- Check existing issues and implementation before splitting work. New catalogue entries are proposed features, not claims of existing runtime support.

## Delivery order and dependencies

| Order | Group | Outcome / dependency |
|---|---|---|
| 1 | Vehicle data and baseline parity | Current buggy becomes a validated data-driven vehicle without changing its accepted behaviour |
| 2 | Fixed-frame part swapping | Build a second driveable variant with a small selection of compatible parts |
| 3 | Tuning and feedback | Understand trade-offs using supported parameters and measured results |
| 4 | Workshop tools and vehicle library | Convenient editing, local documents, presets and appearance options |
| 5 | Grid construction | Freer assembly after the data model, validator and runtime are proven |
| 6 | Driving experiments and course integration | Compare builds and use them in declared course/challenge rules |
| 7 | Advanced attachments and experiments | Individually verified mechanisms after the core workshop is useful |

Persistence, basic Undo, clear validation and Edit/Drive belong to the first player-facing slice; Group 4 expands them. Basic drive tests accompany every group; Group 6 adds richer comparison tools.

**Prerequisites:** preserve the original Phase B fun-acceptance gate before scheduling a player-facing builder. The data format may come earlier. The earlier idea's second fixed vehicle is a useful proof of generality and should be reconciled with the roadmap before free construction is scheduled. Sharing infrastructure is needed only for a selected sharing feature, not for local part swapping. Record/replay #36 helps comparison but is not required for the first workshop.

## Group 1 — Vehicle data and baseline parity

**Purpose:** establish one reliable vehicle definition used by built-in and custom vehicles.

- Versioned data: vehicle identity, parts, local positions, attachment points, connections, approved material/mass presets and per-vehicle feel values.
- Separate authored data from runtime body/joint handles, preview state and temporary test results.
- Define parameter ownership: a part preset supplies defaults; permitted overrides and the existing feel layer resolve values once. Avoid competing motor/suspension settings.
- Convert the current buggy into the first built-in definition. Preserve its accepted geometry, mass/inertia, joints, controls and measurement tolerances.
- Validate before spawning: supported schema and parts, finite bounded values, valid references, compatible attachments and practical body/joint/shape budgets.
- Define safe load failure, schema migration/version rejection and full spawn/despawn/reset ownership.
- Prove a second bounded vehicle variant can use the same runtime without vehicle-specific branching.

**Completion evidence:** current-buggy baseline parity, a second definition that drives, and invalid data rejected without leaving partial physics objects.

## Group 2 — Fixed-frame part swapping

**Purpose:** provide a useful small editor before unrestricted construction.

| Part / option | Gameplay purpose | Initial boundary |
|---|---|---|
| Fixed chassis/frame | Stable assembly foundation | One proven frame; no free geometry editing |
| Wheels | Change obstacle clearance and rolling behaviour | Start with two approved sizes; compatible mount positions |
| Motor preset | Trade acceleration, climbing ability and speed | Supported torque/speed limits through the existing feel layer |
| Suspension strut | Change compliance and landing response | Approved spring/damping presets and supported travel geometry |
| Ballast | Change balance and total mass | A few allowed positions and bounded mass presets |
| Seat and rider | Define rider placement and head-contact region | Exactly one seat; compatible frame mounts |
| Driven-wheel selection | Compare front-, rear- or all-driven wheels | Only configurations supported by the runtime; label left/right screen positions clearly |

- Parts tray → compatible mount → immediate visual preview.
- Show incompatible combinations before placement and explain why.
- Drive/Edit at a gym station; return to the exact authored build.
- Basic Undo/Redo, restore default, local save/load and save-as-copy.
- A larger wheel must not overlap the chassis or begin embedded in the ground.
- Motor and suspension visuals must not imply an additional physical body or simulated drivetrain unless implemented.

**Example:** duplicate the stock buggy, select larger wheels, move one ballast to an allowed rear mount, then compare driving feel.

## Group 3 — Tuning and understandable feedback

Expose only values that already have verified runtime meaning. Prefer a few named presets before many sliders.

| Feature | Useful feedback / rule |
|---|---|
| Suspension presets | Soft / balanced / firm with spring and damping explanation |
| Motor and braking presets | Torque cap, wheel target speed and braking strength; do not present target wheel speed as measured vehicle speed |
| Tyre material presets | Explain supported grip/restitution differences; visual tread alone does not change traction |
| Front/rear setup | Independent tuning only where supported; preserve obvious reset-to-default actions |
| Balance preview | Total mass and actual computed centre of mass; distinguish an estimate from runtime measurement |
| Geometry preview | Wheelbase, wheel radius, ground clearance, mount positions and suspension axis/range where meaningful |
| Live test measurements | Measured speed, acceleration, stopping distance and suspension response once measurement protocols exist |
| Assistance settings | Clearly separate ground/air lean assistance and optional damping from physical part properties |

Do not invent composite “handling scores” or claim predicted performance from appearance alone. Use units, bounded ranges and short explanations. Geometry, mass, motor output and assists must have an explicit policy when comparing vehicles.

## Group 4 — Workshop tools and vehicle library

| Feature | Behaviour |
|---|---|
| Selection and manipulation | Select parts, inspect compatible mounts and edit allowed values |
| Mount snapping | Highlight valid attachment points and preview collisions/clearance |
| Layer/exploded view | Reveal wheels, springs and hidden mounts without changing the build |
| Overlays | Toggle collision shapes, connection graph, centre of mass and dimensions |
| Undo/Redo | Include part replacement, tuning and later geometry edits; isolate document histories |
| Vehicle library | New from template, open, rename, duplicate, delete and restore stock build |
| Autosave and recovery | Recover draft; do not silently lose edits when switching vehicles or entering Drive |
| Validation panel | Identify the offending part and offer a concrete correction |
| Appearance | Body/wheel colours and compatible visual variants; physics effects explicitly declared |
| Rider alignment | Seat/rider and body alignment previews; no separate rider physics implied |
| Mobile workshop later | Large targets, tray, pan/zoom, selection handles and no drag/input leakage |

Keep initial desktop authoring small. Production art and a complete phone building UI remain later work. Preserve a readable 2D silhouette and consistent body/wheel/rider scale.

## Group 5 — Grid construction

**Purpose:** freely assemble simple vehicles after part swapping proves useful.

Initial candidate kit: frame blocks, two wheel sizes, motor, spring strut, one seat/rider and ballast. Grid dimensions and part limits remain to be measured; the old 8 × 5 example is not an accepted limit.

- Snap parts and attachments to a grid; preview before committing.
- Move, rotate where compatible, duplicate and delete parts with Undo.
- Start with exactly one seat, at least two wheels and all required parts connected.
- Validate the mechanical attachment graph, not just visual proximity.
- Reject unsupported joint cycles, overlapping solid parts, invalid wheel mounts and extreme mass ratios according to explicit rules.
- Merge rigid frame groups into fewer bodies where compatible with Defold ownership and reset. Do not create a body and weld joint for every decorative block by default.
- Add editable wheelbase, chassis length, seat placement and suspension mounts only within verified ranges.
- Offer a few templates: short agile buggy, long low buggy and high-clearance buggy. Names are design goals, not guaranteed performance.
- Display part/body/joint budget before spawning.

This stage does not imply arbitrary polygon drawing, unrestricted joint graphs or arbitrary user scripts.

## Group 6 — Driving experiments and course integration

| Feature | Purpose / boundary |
|---|---|
| Quick test loop | Drive at current/specified safe gym start, Retry and return to editing |
| Saved A/B builds | Compare two authored configurations without losing either document |
| Standard experiments | Existing ramps, steps, gaps, seams, braking and landing protocols where available |
| Repeated-input comparison | Reuse #36 when available; identical commands improve comparison but do not guarantee identical trajectories across different vehicles |
| Build + course pairing | Open a custom vehicle with a custom course while preserving separate document identities |
| Cargo trials | Carry a loose crate or ball using shared #120 objects and target rules |
| Design constraints | Optional authored wheel/part/mass limits once useful; avoid premature scoring/economy systems |
| Run provenance | Record vehicle definition/version and relevant feel settings with results |

Official medal/time-trial rules must declare their vehicle and assist configuration. Custom builds initially belong to free play or clearly separated results; no custom-vehicle leaderboard is included automatically.

## Group 7 — Advanced attachments and feasibility experiments

These are optional later trials, not dependencies of the core editor.

| Candidate | Gameplay | Main feasibility questions |
|---|---|---|
| Passive cargo tray / bumper | Carry objects or change contact geometry | Collision shape, mass/clearance, interaction with normal courses |
| Hinged cargo bed | Tilt a load into a target | Joint limits, actuation, mobile input and reset |
| Passive articulated trailer | Tow cargo through obstacles | Stable hitch, jackknifing, reverse, collision filtering, camera and reset |
| Rocker / bogie suspension | Keep more wheels in contact on rough terrain | Supported joints, mass ratios, drive control and body/joint budget |
| Three-or-more-wheel chassis | Experiment with longer or multi-axle builds | Torque distribution, suspension stability and contact cost |
| Spring bumper | Absorb impacts or push shared objects | Bounded spring behaviour and predictable vehicle response |
| Sliding attachment | Fork/pusher or moving ballast | Supported prismatic motion, obstruction handling and controls |
| Movable ballast experiment | Physically shift weight | Real mass movement and input policy; current lean assistance is chassis torque, not this mechanism |
| Breakaway cosmetic/physical part | Optional damage or detachment | Explicit failure rule, bounded debris, rider fairness and complete reset |

Keep powered arms, winches/rope towing, tracks and coupled machinery as separately scoped experiments if later selected. Do not assume pulley/gear/rope APIs are supported on the active backend, or introduce a separate solver. A motorbike or other fundamentally different vehicle needs its own handling acceptance.

## Box2D building blocks and limits

Use the engine version pinned at implementation time. Rider's [engine references](https://github.com/bongohorse/rider/blob/main/docs/ENGINE_REFERENCES.md) currently identify Defold 1.14.0 with integrated Box2D 3.1.0. The following are candidate mappings, not new compatibility claims.

| Building block | Candidate use | Required check |
|---|---|---|
| Rigid bodies, shapes and mass/inertia | Frame, wheels, ballast and collision geometry | Defold-owned construction, mass aggregation, units and safe geometry |
| Wheel joints, motors and spring/damping | Existing wheel/suspension model | Reuse verified adapter; valid axes, torque and tuning ranges |
| Revolute joints and limits | Trailer hitch, hinged bed, bogie | Supported pinned Lua API, stability and collision policy |
| Prismatic joints | Sliding attachment or constrained mass | Backend support, limits, motor force and obstruction behaviour |
| Weld/rigid grouping | Connected chassis parts | Prefer merged rigid groups where viable; avoid expensive unstable joint chains |
| Sensors/contact queries | Head region, clearance/contact feedback | Correct ownership and actor filtering; no accidental crash-rule changes |
| Forces/torques | Existing motor/lean/assist behaviour | One tick owner, once-only conversion, explicit application body |

Check exact APIs rather than copying speculative function signatures from the older idea document. Documentation alone does not verify a vehicle on HTML5 or the reference phone.

References: [Defold physics](https://defold.com/manuals/physics/), [joint API](https://defold.com/ref/b2d.joint-lua/), [Box2D 3.1.0 documentation](https://github.com/erincatto/box2d/tree/v3.1.0/docs), Rider's physics/baseline/engine-pitfall contracts.

## Shared acceptance requirements

1. **Baseline parity:** the data-driven stock buggy preserves accepted behaviour under the existing A-preset ramps, steps, gaps and seam protocols within their declared tolerances.
2. **Validate before spawn:** reject invalid, disconnected, incompatible or over-budget assemblies with actionable part-specific errors; safely clean up failed construction.
3. **One runtime:** editor tests and normal courses use the same vehicle construction, input and feel layer. No workshop-only physics shortcuts.
4. **Full reset and lifecycle:** Retry, station switch and repeated Edit ↔ Drive restore authored poses, velocities, joints, input, camera and attempt state without stale handles/callbacks. Preserve generation checks.
5. **Document reliability:** save/reload, duplicate and Undo preserve the intended build and tuning; failed saves do not silently discard work.
6. **Clear physical meaning:** distinguish cosmetic parts, physical mass/collision changes and gameplay assists. Compute displayed physical values from the actual definition/runtime or label estimates.
7. **Fair test conditions:** identify build, course, preset, input source and assists. Preserve baseline fixtures rather than silently retuning them for a custom build.
8. **Bounded performance:** measure largest allowed assemblies and representative object interactions on the reference phone; set explicit part/body/shape/joint limits from evidence.
9. **Focused verification:** test assembly/validation/reset and important UI paths. Claudio drive-tests each stage for handling, clarity and usefulness.
10. **Small tasks:** split selected slices into issues with 1–3 concrete acceptance criteria and explicit dependencies; do not implement the full epic in one PR.

## Suggested first playable slice

**Step 1:** load the existing buggy from a validated versioned definition with baseline parity.

**Step 2:** desktop fixed-frame workshop with two wheel sizes and one bounded ballast option; duplicate the stock build, edit it, Drive at the gym, Retry, return to Edit and save/reload locally.

**Step 3:** add a small set of verified suspension presets and A/B build selection after the loop works.

No grid construction, advanced attachments, additional driving controls or sharing service is required for this slice.

## Open decisions and exclusions

Decide when scoping the relevant stage:

- Is the workshop a core mode or a later bonus mode?
- Which courses permit custom vehicles, and which require an official fixed build?
- Which tuning values should players see directly versus through presets?
- When should phone authoring, import/export or sharing be introduced?
- Which additional vehicle template best proves the architecture without delaying the first useful workshop?

**Not included in the initial delivery:** custom-vehicle leaderboards/medals, sharing codes/services, production art, full phone building UI, unrestricted free construction, damage simulation, arbitrary scripting, custom physics extensions or manual stepping.

Implementation begins only after prerequisites are checked and Claudio gives GO for a concrete slice. No milestone is assigned by this planning update.
