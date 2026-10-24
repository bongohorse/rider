<a id="performance"></a>
## Performance and development techniques

### Observed techniques versus tempting explanations

| Evidence-backed observation | Practical implication | What it does not establish |
|---|---|---|
| Packed vertex attributes in original terrain shaders | Several visual controls can be evaluated without per-vertex CPU updates | Actual draw-call count, vertex-buffer reuse, GPU cost or CPU savings in a running game |
| Atlas/frame metadata and UI layouts/timelines | Asset-driven presentation with shared texture references is supported | Actual batching order, runtime atlas residency, UI pooling |
| Multiple native ABIs and density/language APK splits | Architecture/resource packaging is explicit | A custom runtime LOD system or texture-streaming policy |
| Particle property lists and dedicated particle shaders | Parameterized effects and specialized render paths exist in content | That all emitters use one simulation backend or are always active |
| App/SDK crash, profiling and diagnostic material | Diagnostic infrastructure is packaged | Internal developer workflow, test coverage, production telemetry configuration |
| Static loader code transforms selected native regions | Build/distribution pipeline includes nontrivial protection/initialization | A gameplay-performance optimization or a reason to reproduce it in Rider |

These observations are grounded in the following system chapters and their claim records. Culling, object pooling, level streaming, memory arenas, LOD, static/dynamic batching and editor preview caches remain **unknown for the game-specific runtime** unless a cited native call path establishes them. Generic engine functionality is not a measured optimization. An original model's Blender exporter comment identifies that particular artifact's export provenance, not every content creator's tools or the complete studio pipeline.

The legacy prototype is useful as a source of experiments, but it currently rebuilds visible terrain slices during render and uses its own JavaScript physics. Those choices and any browser test successes cannot establish original mobile performance. Investigating Rider should measure its actual object/component counts, draw calls, buffer writes, Lua allocations, physics contacts and frame-time spikes on a representative device.

<a id="corrections"></a>
## Corrections to previous reports

| Earlier statement / source | Evidence-backed correction | Consequence |
|---|---|---|
| `architecture_analysis.md`: protected asset prefix implies AES/CBC/PKCS5Padding | The shared prefix is observed; reader-backed algorithm/key/padding identification is not established for those1,908assets. Native-loader cipher recovery is a separate, specific finding. | Do not derive schemas or gameplay values from these opaque files. |
| Same report: `libbts.so`/`libwtp.so` are linked unpacker helpers | Their packaging alone is not a dependency/call graph. Original Cocos loader work found a specific Fingersoft-library callback lead; inspected needed entries do not establish the proposed bts/wtp relationship. | Trace loader calls/relocations per binary; do not assign vendors/roles from filenames. |
| `vehicle_physics.md`, `COMPLETE_VEHICLE_ROSTER.md`: exact masses, friction, suspension, drive ratios and air torque | Values overlap prototype defaults/reconstructed classes without accepted native/config reader provenance. [P03,P07–P08](#claim-p03) | Exclude them as HCR2 balancing data. |
| `TRACKS_AND_CAMERA.md`: Catmull–Rom, 0.35 s lookahead, 7/s damping, 55° FOV | These are directly readable in prototype code, not established original settings. [P01–P02](#claim-p01) | Keep as optional experiments; no need for Rider to adopt perspective. |
| `track_and_3d_rendering.md`: MVP proves perspective and exact CPU terrain extrusion | MVP can contain orthographic or perspective projection; shader math does not reveal CPU topology/sampling. [P06](#claim-p06) also records a prototype Z-sign discrepancy. | Separate shader equations, matrix configuration and mesh generation. |
| Ghost report: complete Protobuf schema and16-byte delta records | No actual game reader validates names/units; report uses field15,prototype uses field 12; someDATfiles fail whole-stream parsing. [P04](#claim-p04) | Preserve wire evidence, reject invented semantic schema. |
| `DECOMP_INVENTORY.md`/hand-named native exports: Box2D and `Box2DWorldStepSimulation` prove physics | Independent raw symbol/string checks do not yet confirm these identifiers in originals; analyst names are not original symbols. See native evidence. | Treat the HCR2 physics engine/integration as unresolved in this evidence set. |
| Old native reports:98,729 functions /26,691 genuine C exports /22,704 bad-data stubs /complete 30 libraries |98,729 is an ARM64 Cocos unwind subset. Metadata records, unique starts, Ghidra objects, C status and byte coverage differ. Latest raw snapshot has 320,486 metadata starts and 69,624 Ghidra objects. [M02–M03](#claim-m02) | A library processed is not a library semantically recovered. |
| `halt_baddata`, high entropy or missing section headers prove encrypted entire functions | None of these alone proves encryption or total uselessness. Concrete transformation arithmetic can establish a bounded derived region, with assumptions. | Retain partial output and diagnostics; credit only verified conclusions. |
| All1255CSB exports imply correct full UI semantics | Earlier decoders had wrong field interpretations. Pinned-schema structural recovery repairs those fields; actual screen binding/update code is still needed. | Use verified decoded assets and serialized defaults only. |
| Passing prototype tests proves original mechanics | Tests exercise local JS code and assumptions. | No game-behavior provenance is gained by those tests. |

These corrections concern evidence quality. They do not claim the original game cannot use any of the plausible mechanisms in the earlier reports. [Historical reports](../decompiled/reports/) remain unchanged and should be read as historical leads.

<a id="rider"></a>
## Prioritized independent Rider proposals

**All items in this section are proposals, not recovered HCR2 implementations.** Rider's source and pinned Defold/Box2D version are unavailable. Complexity estimates are relative engineering scope, not time commitments. Use Rider-owned art and independently written code.

### Priority and dependencies

| Priority | Experiment | Evidence-backed starting point | Expected value | Complexity / dependency |
|---|---|---|---|---|
| Immediate 1 | Downhill-aware movement camera | Original shader exposes a camera-bottom input; original follow law is unknown. Prototype prediction is an unverified idea. | Better landing visibility and less framing lag | Low–medium; camera/update ownership and curve query |
| Immediate 2 | Chunked visual terrain mesh | Original shader separates surface attributes from body deformation | Fewer render objects, bounded rebuilds, clear2Dstyle | Medium; Defold version, material/buffer integration |
| Immediate 3 | Measured vehicle handling harness | Original tutorial describes two-pedal rotation; original parameters unknown | Repeatable suspension/traction tuning | Medium; selected Box2D backend and units |
| Immediate 4 | One race-state/progress authority | Original content distinguishes finish/checkpoint/fuel/record concepts | Reliable timers, rewards and resets | Medium; fixed clock and event ownership |
| Later 1 | Reusable editor content and validation | Original content mentions overlap checks, themes, completion before publishing | Faster authoring, fewer invalid levels | Medium; stable level schema and IDs |
| Later 2 | Event-driven equipment and feedback | Original text ties boosts to specific events and attachment state | Controlled extensibility and clear feedback | Medium; event semantics and balance tests |
| Later 3 | Cosmetic pose ghosts | Replay concepts exist; original format is unknown | Personal best comparison without live multiplayer | Medium; fixed state capture/versioning |
| Investigate |2Dparallax, material variety, richer VFX | Original shaders/atlases/particle settings are concrete examples | Added depth without forced3D | Low–medium; overdraw and readability measurements |
| Defer | Live competitive backend / complex protection / exhaustive vehicle roster | Current evidence does not resolve implementation | Value uncertain for stated Rider problems | High; separate product/security requirements |

### R1. Downhill camera visibility and movement-based lookahead

**Original technique established:** terrain shader accepts `u_cameraBottom`; no inspected artifact recovers the camera's follow law. The local prototype uses velocity-directed prediction and exponential smoothing. [P01](#claim-p01). This makes it an experiment candidate, not a HCR2 finding.

**Problem:** a side-view camera centered above the buggy can hide downhill landings; horizontal-only lookahead can point above the actual track. Rider can remain orthographic and clearly2D.

**Independent approach:** predict forward distance from horizontal velocity, clamp it to a useful range, sample Rider's authored curve ahead, and build a framing region containing the buggy and likely landing corridor. Blend grounded terrain prediction with airborne velocity prediction; do not force the camera toward terrain below an unreachable gap. Give downhill framing an asymmetric vertical allowance. Smooth the resulting target using a time-based response; clamp *the final viewport* against valid level bounds. Handle reverse travel, respawn, loops and editor preview explicitly.

Explanatory pseudocode — **our design**, with tunable symbols rather than claimed HCR2 constants:

```text
lead_x = clamp(vx * horizon, -reverse_limit, forward_limit)
predict = car_position + velocity * horizon
if grounded and forward_route_sample_is_valid:
    predict.y = blend(predict.y, route_height(car.x + lead_x), terrain_weight)
frame = bounds(car_position, predict, safe_landing_region)
target = fit_orthographic_view(frame, aspect, safe_margins)
alpha = 1 - exp(-response_rate * render_dt)
camera = smooth_then_bound(camera, target, alpha, level_bounds)
```

`horizon` is seconds, response rate is 1/seconds; distances use Rider's chosen world units. These variables require measured tuning. Avoid introducing hardcoded HCR2/prototype values. Zoom may be optional: first test position changes at constant orthographic size. The official [Defold camera manual](https://defold.com/manuals/camera/) supports orthographic and perspective modes; it does not prescribe this controller. Documentation was consulted on24October2026; Rider's engine version must be checked.

**Benefit/complexity/dependencies:** high likely value, low–medium complexity; requires reliable velocity, route sampling and one camera owner. An ahead sample must follow route progress rather thanXfor non-monotone tracks. Use the same displayed/interpolated vehicle pose for camera tracking to avoid relative jitter.

**Smallest validation:** one fixed route containing a crest, steep descent, jump and reverse section. Compare centered camera, velocity-only prediction and terrain-aware prediction using identical recorded input. Measure landing-zone screen visibility before touchdown, peak car/camera screen error, zoom movement, input-to-visible response and subjective motion discomfort at30/60/120Hzand multiple aspect ratios. Success is improved visible landing margin without abrupt motion; it is not “matching HCR2.”

### R2. Terrain rendering without one object per curve segment

**Original technique established:** shader attributes distinguish a surface/body role and pack lighting/texture controls; body vertices can extend to a lower visual boundary. CPU batching, chunk size and collision construction remain unknown. See graphics evidence.

**Independent approach:** retain editable control points as canonical content. Compile them into a reusable sampled route with stable segment IDs and arc-length metadata. Generate **separate** visual and collision products: a denser top ribbon/body fill for appearance, and a collision approximation constrained by allowed physical error. Use a modest set of mesh chunks with shared material/atlas, not one render object per curve sample. Keep decorative grass, background depth and collision edges logically independent.

For visual adaptivity, subdivide a curve span until its projected midpoint/tangent error is below a chosen pixel tolerance. This is our proposed algorithm, not a recovered HCR2 sampler. For collision, use world-distance and normal-angle tolerances, a maximum segment length and consistent seam orientation. Preserve authored endpoints at chunk boundaries. Never change already-contacting geometry merely because the camera zoom changed.

The official [Defold mesh manual](https://defold.com/manuals/mesh/) documents runtime vertex buffers and mesh bounds metadata for culling. Shared buffers are resources: verify ownership before changing a chunk so edits do not unintentionally change all instances. A material using world-space vertices has different batching implications from a local-space material. These are version-dependent Defold constraints, not evidence about HCR2.

**2Dvisual direction:** use a clear rideable top edge, a shallow shaded side band, a fill below and independently scrolling background layers. Zordering or UV/vertex-color shading may suffice; full perspective/extruded scenery is optional. Surface artwork must not imply a different collision crest. Never CPU-extrude already transformed vertices again in the shader without a defined space contract.

**Tradeoffs:** tiny chunks increase components/draw work; huge chunks harm culling and editor rebuild latency. Denser collision adds contacts and seam risks. Rebuilding all buffers each frame can erase the object-count benefit. Retain unchanged chunks; rebuild only edited spans and neighboring continuity boundaries. Defold's [render manual](https://defold.com/manuals/render/) explains material/texture/constant/order constraints on batching; fewer objects do not automatically mean fewer draw calls.

**Smallest validation:** render the same long curve as current Rider output and as a fixed number of mesh chunks using Rider-owned flat-color geometry. Measure visible/total objects, actual draw calls, triangles, upload bytes/frame, Lua allocations, CPU/GPU frame time and editor edit-to-preview latency on mobile. Test chunk seams at high wheel speed and slow suspension compression. Sweep chunk length rather than choosing one based on an unsupported HCR2 number.

### R3. Vehicle handling and fixed-step measurements

**Original technique established:** the shipped tutorial maps two pedals to opposite rotation directions, and upgrades describe grip/shock absorption/handling effects. Exact solver, suspension parameters and HCR2's Box2D integration remain unknown. [G01,G05](#claim-g01)

**Independent approach:** first pin Rider's physics backend, world scale, fixed step and body/joint topology. Instrument chassis/wheel poses, contacts, relative travel, angular velocity, motor torque limits and resource state. Prefer existing engine constraints where suitable; avoid writing a replacement collision solver to imitate the prototype.

The official [Defold physics manual](https://defold.com/manuals/physics/) distinguishes selectable Box2D implementations and recommends fixed-step force interaction. The [joint manual](https://defold.com/manuals/physics-joints/) documents wheel joints and programmatic construction. Verify the actual API/parameter availability in Rider's pinned engine and backend rather than assuming current documentation matches it.

For a spring-design *starting model*, not an HCR2 formula:

```text
omega = 2*pi*frequency_hz
stiffness = effective_mass * omega^2
damping = 2*damping_ratio*effective_mass*omega
```

Use this only when the chosen API expects coefficients; do not feed coefficients into fields expecting frequency/ratio, or apply a second manual spring over an active joint spring. Effective mass depends on attachment geometry and constraints, not simply total vehicle mass. Tune contact stability before maximum acceleration. Keep pedal input, motor command and resource cutoff separate so braking/coasting/fuel exhaustion can be tested independently.

For air control, compare bounded torque with a target-angular-rate controller; clamp and test both directions. Grounding should use stable contact state/contact normals with appropriate hysteresis, not only “wheel height minus terrain height.” For traction, first use documented contact behavior of the selected backend. Current upstream [Box2D simulation documentation](https://box2d.org/documentation/md_simulation.html) describes geometric-mean friction mixing; that neither proves HCR2 uses it nor licenses multiplying surface factors blindly in Rider's different backend.

**Smallest validation:** flat acceleration/braking, constant slope, step bump, repeatable drop, crest-to-jump and wheelie tests. Record settling time, bottom-outs, wheel-contact duty cycle, slip estimate and landing recovery. Run identical input at different render rates and verify fixed-state results within a declared tolerance. Check the effect of paused/resumed simulation. Change one parameter family per experiment.

### R4. Separate simulation, presentation and race authority

**Original evidence:** renderer bridges and race/content concepts exist; original full update order is unresolved. Rider should make its own update ownership explicit.

The official [Defold lifecycle manual](https://defold.com/manuals/application-lifecycle/) describes fixed, regular and late script stages and warns that order among objects is unspecified. Its current description concerns versions from1.12.0. The official [interpolation example](https://defold.com/examples/physics/interpolation/) demonstrates separate visual transforms between fixed physics samples. Neither document establishes Rider's current configuration.

**Independent proposed order:** capture input → one fixed-step controller reads that snapshot → physics/contact events → authoritative race/resource state → presentation reads a snapshot → camera/render. Use explicit orchestration or queued events where ordering matters. Do not depend on incidental object iteration. If visual interpolation is added, interpolate a separate visual object; never move the authoritative dynamic body backward between fixed samples. Account for one-step presentation latency and reset both interpolation samples on respawn/teleport.

For timing, choose simulation ticks versus monotonic elapsed time deliberately. A single state machine can own `READY`, `RUNNING`, `FINISHED`, `FAILED` and pause policy. A finish event carries a run ID and is accepted once; rewards consume that event once. Store checkpoints by stable route progress, with an allowed direction/order. For loops or overlapping track sections, use segment IDplus local curve parameter, not just nearest X. Medal thresholds belong to level data with a version; collectibles have stable instance IDs and idempotent collection state. Fuel state is independent of HUD smoothing.

**Benefit/complexity:** medium scope, high reliability payoff; depends on route IDs and time policy. **Validation:** cross the finish twice, respawn after a pickup, pause during a jump, run backward through a checkpoint, replay after a level edit, and load an old result. Assert one finish/reward, correct timer behavior and no duplicated collection. These are proposed Rider tests, not claims about HCR2's tests.

### R5. Editor compilation and reusable content

**Original evidence:** overlap feedback, editor themes, compatibility text and completion-before-publish instruction. [G07](#claim-g07). The proprietary level serialization is not recovered.

**Independent approach:** keep a versioned authored document containing control points, stable object IDs, prefab/type IDs, transforms and explicit gameplay properties. Derive visual meshes, collision geometry and spatial indexes as disposable caches. Maintain dependencies from an edited curve span to its affected chunks and anchored objects. Separate decorations from physics-enabled obstacles and triggers. Store path attachment as route ID/parameterplus offset where appropriate; do not silently bind all scenery to world X.

Reusable objects should declare collision, visual resource, trigger/event outputs and editing bounds independently. Validate missing assets, unsupported versions, start/finish reachability assumptions, invalid overlaps and unsafe spawn contacts. A finishable editor playtest is useful even without a publishing backend; it does not prove all player vehicles can finish.

**Benefit/complexity:** medium complexity; reduces authoring/rebuild cost and supports schema migration. **Validation:** edit one hill and verify only its affected chunks rebuild; reload/save without ID churn; test a bridge, pickup and decorative prefab; open an older schema and validate an intentional migration. Full undo/redo and network publishing are later scope.

### R6. Event-driven upgrades, HUD, particles and audio

**Original technique established:** original descriptions bind effects to discrete actions and attachment state; layouts/timelines and particle parameters are asset-driven. [G02–G04](#claim-g02).

**Independent approach:** define small explicit events (`pickup_collected`, `stable_landing`, `flip_completed`, `attachment_detached`) and validated effect states with start/end ticks, caps and stacking rules. Apply bounded modifiers through a single vehicle controller. HUD, audio and particles subscribe to presentation events, while reward/fuel state consumes authoritative events. Do not let a visual animation completion grant a race reward.

Begin with one pickup boost and one landing effect. Define an actual landing detector before adding multiple gadgets. Keep2Dfeedback concise; compare opaque coverage and particle counts on mobile. Atlas/material sharing and persistent small effect emitters are candidates to measure, not proof that pooling is necessary. **Validation:** duplicate-event injection, pause/resume, quick retrigger, detached part and reset during an effect; ensure physics modifiers and HUD return to baseline. Complexity is medium once event semantics exist.

### R7. Later pose replay and format compatibility

**Original evidence:** replay/newer-client rejection messages and DATfiles exist; their semantic schema is unresolved. [G08,P04](#claim-g08).

**Independent approach:** first record timestamped chassis/wheel poses and sparse events against a level hash, physics/build identifier and format version. Display a non-colliding cosmetic ghost. Linear position/shortest-angle interpolation is a sufficient initial experiment; Hermite is optional only when valid velocities justify it. A pose ghost does not reproduce physical state and must not participate in contact or reward logic. Deterministic input replay requires a stronger cross-platform determinism investigation.

**Benefit/complexity:** useful personal-best feedback with medium scope; depends on stable level identity and fixed clock. **Validation:** compare playback duration and checkpoints with the source run, test uneven render rates, reject a changed level/version visibly, and bound file size. Network opponent exchange is a separate system requiring product/backend requirements.

