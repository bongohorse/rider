# Interactive objects O1 (#280)

**Contents:** [Scope and next authoring step](#scope-and-next-authoring-step) · [Source settings and signals](#source-settings-and-signals) · [Physics and units](#physics-and-units) · [Lifecycle and ownership](#lifecycle-and-ownership) · [Admission and observed cost](#admission-and-observed-cost) · [Verification and stop](#verification-and-stop)

## Scope and next authoring step

Claudio selected interactive objects before graphics/atmosphere and deferred the playable introduction until mechanics/content have settled (2026-10-30). O1 implements a small shared runtime and a directly playable crate → plate → gate course. It also includes his clarified three plate modes, object settings data and many-to-many assignments, including two plates/three gates.

The required per-object settings panel, placement tools and simple visible node-style connection editing are the next dependent task [#281](https://github.com/bongohorse/rider/issues/281). They are not completed by O1. This runtime preview preserves these settings/IDs/links through Edit/Save/Export/Play and displays read-only outlines/travel extents. It never instantiates physical mechanisms in Edit. There is no arbitrary scripting graph, second seesaw/checkpoint system or procedural object generator.

## Source settings and signals

Optional compiled `mechanisms` version1 uses station schema5; optional `editor.mechanisms` uses editor/compiler12. Old1–11 sources remain readable and retain their established geometry. The new field participates in R1 source/compiled comparison, bounds, resource admission and durable source storage. Unknown versions, fields, modes, input rules and event/action semantics are protected. Source IDs are unique within the mechanism registry; `vehicle` is reserved. Objects and references are never silently dropped.

| Object | Supported source settings |
|---|---|
| Crate | Centre position, rotation in radians, mass1–40 kg (default8), friction0–1.5 (default0.5), restitution0–0.5 (default0); fixed1.2 m square |
| Plate | Centre position, width1–8 m (default3), explicit accepted actor IDs, `hold`/`toggle`/`pulse` mode, pulse duration0.1–30 s (default4), toggle initial ON/OFF |
| Gate | Closed-pose centre, upward travel3.5–6 m, speed0.25–2 m/s, initial open pose, `any`/`all` input rule; fixed0.6×3 m, mass16 kg and finite500 N motor |
| Link | Existing plate `from`, `event=active`, existing gate `to`, `action=open`; distinct pairs, multiple targets/sources supported |

Plate mode `hold` is active while at least one accepted actor occupies it. `toggle` changes ON/OFF once per new press and retains state after release. `pulse` emits one timed activation per press and expires even while held; release is needed before another press. Occupancy is not a weight estimate. Rising/falling occupancy uses0.08/0.15 s simulation-time debounce. The vehicle's chassis and both wheels collapse to one actor; head and other sensor shapes do not create extra presses. A crate is a separate stable actor.

Signals carry source ID, generation and a monotonically increasing serial. Duplicate/stale signals cannot change a new attempt. Gate `any` opens for at least one active input; `all` requires every connected input. These are two built-in rules, not general graph operators. An unconnected gate retains its configured initial state. For connected gates, initial pose is restored by Retry and the linked plate signal determines the subsequent target.

## Physics and units

Defold1.14.0 / integrated Box2D3.1.0 owns every body and the world. Collision objects/factories create dynamic crates, static plates and dynamic gates in the existing proxied collection. A prismatic joint guides each gate along world up relative to the existing static terrain body. Gravity is zero for gates; the joint limits and finite motor perform movement. The controller's existing fixed callback reads completed-step sensor overlaps and chooses motor speed. No manual stepping or position integration is added.

The gate's swept path has a conservative occupancy sensor. A vehicle or declared crate in that path stops its motor until the path clears; ordinary physical contacts and the finite force remain authoritative. The example has a clear opening path. All collision/filter choices retain category/mask1 in the existing `gym` group. Sensors have zero density. Offscreen mechanisms keep operating independently of terrain render residency.

| API boundary | Units and verified use |
|---|---|
| Body/shape positions, sensor vertices, anchors and prismatic translations | Source metres divided once by `physics.scale` to engine units; readback multiplied once |
| Prismatic motor speed | Source m/s divided by scale; pinned binding multiplies by scale |
| Prismatic maximum motor force | Source500 N divided by scale; pinned binding multiplies by scale |
| Mass data | Mass kg; centre engine units; inertia remains raw SI and scales with the mass ratio |
| Friction, restitution and gravity multiplier | Dimensionless |
| Rotation, debounce and pulse | Source radians; seconds from the existing simulation dt |

Read the pinned [prismatic implementation](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/gamesys/src/gamesys/scripts/box2d/v3/script_box2d_joint_v3.cpp), [body/mass binding](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/gamesys/src/gamesys/scripts/box2d/v3/script_box2d_body_v3.cpp), [shape binding](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/gamesys/src/gamesys/scripts/box2d/v3/script_box2d_shape_v3.cpp), and current1.14.0 [joint](https://defold.com/ref/b2d.joint-lua/), [body](https://defold.com/ref/b2d.body-lua/) and [sensor-overlap](https://defold.com/ref/b2d.shape-lua/) references. Body/GO synchronization, sleep-timer handling and reset-angle tolerances follow the existing [engine pitfalls](contracts/engine-pitfalls.md).

## Lifecycle and ownership

One explicit session instance owns source references, factory IDs, borrowed body/sensor handles, gate joints and the pure signal model. Factory creation occurs in setup; the following attach borrows bodies and creates sensors. Canonical first placement uses the same reset as Retry. A gate guard normally belongs to the first static plate body; a gate without plates uses the known terrain body. Its extra shapes participate in topology assertions and are removed by fresh-handle/index lookup if placement cleanup is needed.

Retry destroys each old gate joint and verifies invalidity, synchronizes body and GO poses, clears linear/angular velocities, clears the crate/gate sleep timer, recreates one gate joint, restores source initial states and clears debounce/pulse/signal work. Initial dynamic centres are bounded within600 m. The first two fixed ticks ignore old overlaps so prior contacts cannot rearm a fresh attempt. No timers or detached callbacks survive reset. Collection teardown belongs to Defold; final drops Lua instance references.

Pause stops physics and signal time through the existing proxy owner. Read-only snapshots continue at100 ms wall-clock intervals to prove actual paused poses, without using that publication clock for actions. Terminal finish stops gate motors. Normal and editor Play use the same controller/runtime; editor outlines are only sprites and do not simulate occupancy.

## Admission and observed cost

Limits are8 crates,8 plates,8 gates and32 distinct links. Worst declared additions are24 bodies,40 shapes,8 joints and160 physical vertices. Runtime sprites and read-only preview sprites count against existing terrain/GameObject admission, using the larger representation (up to104 preview sprites). Existing body/world ownership, pool sizes, terrain sampling and physics budgets are unchanged.

The three-object reference adds3 bodies,5 shapes and1 joint. With the vehicle/terrain, the observed normal world has7 bodies,10 shapes and3 joints. The two-plate/three-gate example adds6 bodies,11 shapes and3 joints; observed totals are10/16/5. Retry retains these counts. Additional measured contact/sensor/event/frame observations are recorded in the release test artifact; `peak_overlaps` is collected at each fixed tick, while world profiles/contact samples are read at100 ms intervals. Browser timer resolution limits zero/0.1 ms profile samples. These are not physical-phone or hardware-GPU performance claims.

## Verification and stop

Production Lua checks cover validation, source compilation/reopen/copy, all three plate modes, hysteresis, actor deduplication, two plates/three gates, ANY/ALL rules, protected future semantics and stale/duplicate signals. Ordinary release checks use actual driving, brake/reverse, pause, Retry, native Export/import and browser reload; no physics/score-state injection. They also verify isolated objects, configured crate mass/rotation, fresh paused readbacks and stable body/joint counts. Existing editor-version assertions are updated exactly to12; old source fixtures stay unchanged and remain compatibility coverage.

The final normal HTML5 release at `75ec93e46dbb2c1f6226ba9da36798a20d9b6886` (build280-5) passed desktop objects12, synthetic touch objects2, gem compatibility3 and fuel compatibility6, plus the local fast suite. Release screenshots were inspected. At this run, 310 fresh desktop samples observed maxima of10 bodies/16 shapes/5 joints,10 sampled contacts and20 fixed-tick sensor overlaps; sampled step p95 was0.2 ms (max0.3 ms). Local software-rendered/concurrent browser samples are not device performance acceptance. Exact heads, builds and commands also live in STATUS.md and the linked PR. Stop with a playable O1 preview for Claudio to push the crate, cross the gate, Retry and test the interaction. #281 then exposes the already requested settings and visible links. No graphics/atmosphere implementation begins before that object-authoring stage is accepted. Native/Android/device behavior is NOT RUN unless separate evidence says otherwise.
