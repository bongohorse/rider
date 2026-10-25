# Terrain P0: curve and long-course baseline

Cost analysis for [#272](https://github.com/bongohorse/rider/issues/272), under [epic #263](https://github.com/bongohorse/rider/issues/263). This report does not authorize #273. No runtime code, sampling settings, pools, physics, renderer or camera changed.

**Contents:** [Scope and environment](#scope-and-environment) · [Fixtures and allocations](#fixtures-and-allocations) · [Measurement method](#measurement-method) · [Results](#results) · [Cost and limit audit](#cost-and-limit-audit) · [Recommendation for #273](#recommendation-for-273) · [Reproduction and verification](#reproduction-and-verification)

## Scope and environment

Final refined runtime build source: `75a9a3dcdf3826b17e6a57aa2b38111d15d83110`; its runtime files are byte-identical to main-at-start `2a2289865a8733608ba58ae83a1092e1bd4bc310`. The later source changes in this task are docs/observers/fixtures only. Pinned Defold 1.14.0 `a81dbb0478e8b73931dc2d671563204f6ac0ef82`, integrated Box2D 3.1.0, four substeps, one owner at 60 Hz, scale 0.01. Editor/compiler 7, sampling 5 mm / 0.5 m. Fresh debug HTML5 bundle passed the existing engine provenance guard for both Wasm variants; benchmark uses non-isolated `wasm-web` as on Pages. Benchmark tooling is additional observer code, absent from the game bundle.

Desktop: WSL2 Linux `6.18.54.1-microsoft-standard-WSL2`, x86_64, 12 logical CPUs; Chromium 156.0.8078.4 headless, 1280×720 DPR 1, High DPI on, preset A, default struts, Ghost off. ANGLE Vulkan SwiftShader software rendering. Browser clock observed 0.1 ms. These are local desktop measurements, not CI, hardware-GPU or Android numbers. No previous LE1b timing is presented as a controlled before/after comparison.

Xiaomi Mi 10T Pro: **NOT RUN**. Real touch, mobile storage, refresh/thermal behavior, app switching and human comfort/readability: **NOT RUN**. GPU time, draw calls/overdraw and GPU/total process memory are **unmeasured** by the existing probes. Callback work includes engine main-thread work and submission, not GPU completion.

## Fixtures and allocations

The default fixtures are synthetic, deterministic editor-source courses; Claudio confirmed these default fixtures and required flats, tight/wide curves, steep climbs/descents and jump gaps. Source construction and automatic tangents are in the observer. Importable compiled exports and authored source inputs are retained in [terrain-p0/](terrain-p0/measurements.json), with SHA-256 hashes. Size columns are compact JSON bytes excluding the final newline, not the pretty-printed source file size.

| Fixture | Authored content | Anchors / source objects | Sampled segments / chain vertices | Chains / hulls / hull vertices | Source / export bytes | Admission units |
| --- | --- | --- | --- | --- | --- | --- |
| [six-anchor](terrain-p0/six-anchor.json) | 330 m x-span; one six-anchor curve | 6 / 1 | 666 / 667 | 1 / 0 / 0 | 1004 / 23803 | 668 / 800 |
| [long-curves](terrain-p0/long-curves.json) | 500 m x-span; flats, wide/tight bends, 45° climb/descent, crest and gap jump | 14 / 12 | 696 / 698 | 2 / 0 / 0 | 2419 / 25943 | 698 / 800 |
| [mixed](terrain-p0/mixed.json) | Same 500 m geometry + 12 non-contact boxes + six labels | 14 / 30 | 696 / 698 | 2 / 12 / 48 | 4009 / 28423 | 752 / 800 |

Every course has START `[2,2]` at speed 0 and a FINISH near its end. Six-anchor positions are `[0,0], [66,4], [132,-2], [198,5], [264,0], [330,3]`. The long course is 12 named terrain objects: flat 0–24 m; wide hill 24–174 m (10 m rise); flat to 198 m; tight S-bends to 210 m (±3 m); 45° climb to `[230,20]`; rounded crest through `[236,22]` to `[242,20]`; 45° descent to `[262,0]`; flat to `[286,0]`; jump lip at `[294,4]`; seven-metre unconnected gap; landing `[301,2]` to `[313,0]`; wide valley through `[388,-10]` to `[463,0]`; flat run-out to `[500,0]`. Connected joins form two physical chains, with no connection across the gap. These are x-extents, not driven distances; each six-second run covers only roughly the first 37 m. The hulls lie at y = −16…−15 m, so this is allocation/memory coverage, not obstacle-contact stress or future coin/decor gameplay.

| Fixture | Edit sprites / labels | Play sprites / labels | Source-derived Edit / Play GOs | Actual terrain / whole-world shapes | Terrain meshes |
| --- | --- | --- | --- | --- | --- |
| six-anchor | 671 / 2 | 673 / 1 | 677 / 678 | 666 / 670 | 0 |
| long-curves | 701 / 2 | 703 / 1 | 707 / 708 | 696 / 700 | 0 |
| mixed | 749 / 8 | 751 / 7 | 761 / 762 | 708 / 712 | 0 |

Edit includes START (four sprites + label) and FINISH (sprite + label). Play includes FINISH and the live vehicle (four sprites + two struts); replay is unallocated in these runs. The mixed course adds 48 hull-outline sprites and six labels. GO totals derive from four static world objects plus one GO per sprite/label in these owners. They exclude the loader collection and are not an engine-wide live enumeration. Each fresh world reports the same component counts after all six imports; no hidden components are counted as freed. Editor GUI allocation is 628/640 throughout.

The six-anchor course passes current source validation, export, Play, Retry and repeated Edit↔Play without a budget error; the accepted `le5b` regression separately checks compiler-6 sampling and upgrade behavior. This preserves #236 without assuming its older example used these exact anchors. The mixed course has **48 admission units** left, despite only 30 authored objects. Its greater x-span can cost fewer sampled segments than an all-curved course because authored straight lines remain single chords; length alone is not the budget. Extra labels/obstacle edges consume that reserve.

Use the three compiled `.json` files above for direct Play/phone import. The `*-source.json` inputs are for **Import while in Edit mode**; their stale seed is not the full route. The observer also has a source-generation-only command, `node tools/gym/terrain_baseline.cjs --fixtures <output-directory>`.

The [660 m larger source](terrain-p0/long-over-budget-source.json) extends each wide bend from 150 to 230 m, retaining the same tight bends, 20 m climb/descent and gap. Actual editor-derived geometry is **1016 segments**, and the existing validator reports **1018/800** including FINISH: `Station render budget exceeds 800 objects: 1018 drawn (1016 terrain segments, 2 FINISH)`. The source is structurally valid and reaches Saved/idle sync, but a real E/Play input leaves the same Edit world generation; no Play collision world is built. The editor simplifies its view to **1011 sprites + 2 labels**. [Inspected refusal capture](terrain-p0/long-over-budget-edit.png). No compiled playable export is claimed for this source. The 500 m course is the additional smaller valid variant, not a relaxed-limit version of the larger one. A START near the larger course’s end would also cross the independent ±500 m start restriction; that additional start case was not executed.

## Measurement method

The local observer [terrain_baseline.cjs](../tools/gym/terrain_baseline.cjs) reuses `launch.cjs`, `pointer.cjs`, `editor_ui_target.cjs` and the existing `le6` / `le1b` publications. It is not registered as a new CI suite. Three deterministic source imports are opened in the actual editor, exported through its real compiler and then imported through the existing custom-level text path. Source fixtures intentionally carry a small stale compiled seed without `compiled_revision`; the editor source is authoritative, and the measured geometry is the fresh export. No script sets a budget override or writes bodies, camera state or renderer state.

- **Allocations:** `le6` reports Edit sprites/labels/GUI allocation and Play decoration, vehicle, struts and replay. `le1b` reports actual terrain shapes and Box2D world memory/profile. Repeated imports must produce identical shape/sprite/label counts. GameObject totals in the fixture table are explicitly derived from source ownership, not an engine-wide enumeration.
- **Import:** one first import plus five repeated imports per fixture, each persisted before the next. Trigger is the Import text button click; endpoint is the existing `riderReady` write in the vehicle-attach frame. Parse/build/decoration use existing Lua clocks, quantized to whole milliseconds. Setup frames are included in maximum callback work.
- **Edit↔Play:** five alternating transitions per fixture. Trigger timestamp precedes real E input. Endpoint is `riderReady` for Play, or the first published Edit view with a newer world generation for Edit. Main-thread callback maxima include the endpoint frame.
- **Retry:** five real R inputs per fixture. Endpoint is the first telemetry publication with a larger reset count. Telemetry publishes about every 250 ms, so these are **observed completion upper bounds**, not exact reset latency. They do not justify an in-world lifecycle rewrite.
- **Editing:** select/centre the first curve through the actual object list. Five anchor drags, each twelve pointer moves over eight screen pixels, one animation-frame wait per move; release commits, Ctrl+Z restores the original objects exactly before repeating. First-preview latency ends at the first existing editor publication whose anchor-drag readout reflects a preview; this observes preview state, not GPU presentation. Callback statistics cover dragging and commit. Only callbacks that publish Edit state count in the drag distribution, excluding the pointer helper’s additional rAF callbacks. The debug editor publishes every Edit frame; its own inspection/serialization cost and the observer are included. A source/point-count change can reload the edit world; it is not a local-mesh-rebuild measurement.
- **Driving:** after the last import, hold ArrowUp, warm up one second and capture six seconds. The existing mobile poll reports one world-update interval and Box2D step per update. Wrapped engine rAF callbacks provide main-thread work. Quantiles use nearest rank; p95 of five transitions is therefore their maximum. Raw observations stay in ignored `artifacts/terrain-p0/`; committed summaries retain sample counts, transition observations, memory snapshots and hashes.
- **Memory:** Box2D bytes and Lua heap are snapshots (natural GC, no forced collection). WASM bytes are linear-memory capacity, not resident/used memory. CDP JS heap metrics include the page and observer, and are not game-only or total browser memory. No leak conclusion follows from one six-second window.

A separate [terrain_cpu.lua](../tools/gym/terrain_cpu.lua) uses the **verified pinned Bob's bundled LuaJIT with JIT disabled**, with 31 CPU-time observations per operation. It invokes the actual pure sampler and document compiler, comparing fresh sampling, cached paths, cold compilation of copied objects and warm compilation. This isolates costs in a native interpreter; it is **not** a measurement of those functions inside HTML5, nor a timing estimate for the phone. HTML5 sampler-only CPU remains unavailable through the existing probes.

## Results

Accepted detailed run: `terrain-p0-1792876195255`; full summaries and observations: [measurements.json](terrain-p0/measurements.json). There is one six-second drive window per course, not a long-duration stress test.

| Fixture | Import ready median / worst ms | Maximum import callback ms | Driving interval p50 / p95 / p99 / max ms | >25 ms / intervals | Callback p50 / p95 / max ms | Physics p50 / p95 / max ms |
| --- | --- | --- | --- | --- | --- | --- |
| six-anchor | 63.1 / 81.1 | 16.1 | 16.7 / 17.1 / 17.7 / 33.4 | 2 / 358 | 2.1 / 5.3 / 8.3 | 0.1 / 0.1 / 0.3 |
| long-curves | 54.7 / 73.2 | 12.1 | 16.7 / 16.9 / 17.5 / 34.1 | 1 / 358 | 1.9 / 5.2 / 8.6 | 0.1 / 0.2 / 0.2 |
| mixed | 61.1 / 73.7 | 20.2 | 16.7 / 17.0 / 17.6 / 17.6 | 0 / 359 | 1.9 / 4.9 / 7.9 | 0.1 / 0.1 / 0.2 |

A zero physics sample means below clock resolution, not zero cost. Raw profile observations are quantized; occasional maxima are not a sustained budget. Stable driving here does not prove smoothness on hardware or throughout the complete course.

| Fixture | Edit→Play median / max ms; peak callback | Play→Edit median / max ms; peak callback | Retry observed median / max ms | Drag callback p50 / p95 / max ms | Gesture→first-preview readout upper bound median / max ms |
| --- | --- | --- | --- | --- | --- |
| six-anchor | 53.2 / 68.9; 20.8 | 44.1 / 59.2; 28.8 | 239.3 / 239.6 | 7.8 / 29.4 / 34.6 | 407.7 / 462.1 |
| long-curves | 57.9 / 65.6; 63.6 | 58.2 / 63.4; 34.8 | 238.7 / 242.3 | 7.7 / 22.2 / 29.0 | 311.3 / 485.3 |
| mixed | 56.1 / 71.3; 77.4 | 58.5 / 59.9; 30.6 | 239.2 / 240.2 | 7.9 / 23.0 / 29.6 | 315.3 / 408.5 |

The preview-readout column includes the deliberately paced small pointer moves and time until the 0.5 m grid produces a changed anchor. It is an upper bound for this gesture, **not isolated input-processing, sampling or pixel-presentation latency**. The more useful CPU evidence is the complete callback distribution and the isolated native results below. Retry's roughly 240 ms observation is similarly constrained by the existing 250 ms publication cadence. No new high-frequency production telemetry was added to make these numbers look more precise.

| Fixture | Box2D world KiB (last) | Lua heap KiB range during capture | WASM capacity MiB | CDP JS heap used / total MiB |
| --- | --- | --- | --- | --- |
| six-anchor | 724.7 | 2519.0 / 5231.4 | 256 | 5.8 / 9.9 |
| long-curves | 763.0 | 2572.2 / 5313.6 | 256 | 4.4 / 13.4 |
| mixed | 767.5 | 2849.1 / 5269.4 | 256 | 5.5 / 13.9 |

Memory snapshots are not incremental per-course costs: GC, retained source data, shared state and observer buffers differ over the run. Box2D bytes are actual world counters; the 256 MiB WASM capacity is reserved linear address space, not proof that 256 MiB was used by the course. JS heap includes observer data. No total process or GPU-memory measurement is available.

Supplementary native CPU timing ([raw values](terrain-p0/cpu-measurements.json)), medians of 31, JIT disabled:

| Fixture | Fresh sampling ms | Cached path lookup ms | Cold compile with copy ms | Warm compile ms |
| --- | --- | --- | --- | --- |
| six-anchor | 1.761 | 0.001 | 2.534 | 0.791 |
| long-curves | 1.937 | 0.002 | 2.774 | 0.781 |
| mixed | 1.899 | 0.003 | 2.878 | 0.877 |

Fresh sampling dominates cold pure compilation on this native interpreter; warm source reuse is much cheaper. This supports keeping cache identities stable and reducing repeated full work in a later approved editor slice. It does not identify a particular HTML5 callback as sampler-only time, and meshes alone will not remove source validation or physics-memory cost.

The [repeat drive/import summary](terrain-p0/repeat-summary.json) records a separate successful pass on the same runtime and fixtures: import medians 53.7–56.4 ms, driving p95 17.0 ms, worst intervals 17.7–33.3 ms. It uses the same refined source and cost protocol; only the later camera-capture stage changed. There is no statistically supported claim that one fixture is faster than another from these small differences.

Additional camera captures use the same long course outside the cost windows: synthetic browser keyboard input captured the long course’s [45° descent](terrain-p0/camera-descent.png), [airborne jump after the lip](terrain-p0/camera-jump.png) and [reverse](terrain-p0/camera-reverse.png). The observer imports ordinary START variants at `[244,18.9]` / 5 m/s, `[282,0.9]` / 7 m/s and `[12,0.9]` / 0 m/s for descent/jump/reverse; authored terrain and collision are identical to the canonical long course. Predicate-qualified telemetry and these START values are in the summary; the screenshots were inspected. `a6` also passes its existing direction/window and synthetic deep-fall/landing/wave assertions. These establish reproducible later comparison views; they do not prove human comfort, full-course traversal or real-phone behavior. The camera implementation is untouched.

## Cost and limit audit

| Stage / resource | Evidence on this source | Consequence |
| --- | --- | --- |
| `editor_sample.lua` | Adaptive longest-chord Bézier walking; 5 mm error, 0.5 m maximum chord, 2048 points per curve. Every non-collinear anchor is retained; a corner-to-corner segment can remain one chord. | Few anchors do not imply few samples. Keep #236/compiler-6 improvement; do not relax sampling to fit a Sprite pool. Length alone is not a geometry budget. |
| `editor_doc.lua` | Exact-number weak-key cache per curve object; `drawn()` sums sampled chords. Connected pieces produce one chain without internal seams. Source validation and compiled validation are separate. | Stable source reuses samples. A copied document introduces new object identities and cold caches. |
| Anchor-drag path in `editor.gui_script` | Changed pointer position copies the document, changes anchors/downstream objects, runs `problems()` and `compile()`, then publishes preview objects. | Sampling and whole-document checks recur during edits. Native cold/warm measurements support this cost mechanism; the browser probes cannot assign each observed spike to one function. |
| `editor_view.lua` | Full shape comparisons and individual GO transforms for changed geometry; sample-count changes respread existing sprites during drag, then can reload the edit world on commit. Proportional simplification protects pools only in Edit. | Existing preview simplification does not permit an over-budget Play or eliminate geometry validation. Hidden components retain allocations. |
| `stations.lua` | `decorate()` creates one line Sprite **and GO** per terrain chord or hull edge, even far outside the camera. Build independently creates chain shapes and hulls on the terrain body. | Confirmed first admission/allocation bottleneck. Culling draw work alone cannot reclaim instances. Terrain shape count is independent of Sprite count. |
| `station_data.lua` | 800 includes terrain segments, hull edges, labels, FINISH, station-specific markers/seesaws. Mixed fixture has 48 admission units left; the larger variant is actually refused at 1018/800. | This is a Rider safety guard, not the engine's hard terrain limit. Extra content can hit it before the configured pools are exhausted. |
| Physics / memory | World-shape and world-byte counters grow with sampled geometry. Within these short drive windows step p95 remains near clock resolution. Hulls are below the road and add no vehicle contact workload. | No measured physics-throughput bottleneck here; no basis for changing physics, reducing collision accuracy or promising contact-heavy object performance. Meshes will not remove these shapes or their memory. |
| Frames / load | Driving is mostly cadence-limited here; imports still build hundreds of decoration objects in one setup frame, and editing has longer callbacks. GPU/production-device costs unavailable. | Prioritize allocations and measured setup/editor CPU work. Do not claim a GPU speedup or eliminate real-world stutter from this software-rendered baseline. |

Other independent limits remain after any mesh experiment:

| Boundary | Current limit / meaning |
| --- | --- |
| Source/import/export | Custom text ≤256 KiB before JSON decode; the export includes compiled geometry **and** source, so saving only a handful of anchors does not describe its full size. 64-byte level/object names and label text. |
| Source complexity | 256 objects; 2048 line points or curve anchors per object; 8192 total source points, counting three control points per curve anchor. Tangent components ≤1000 m. History is separately bounded to 100 Undo snapshots. |
| Compiler | Editor/compiler 7; sampling settings must match exactly. 2048 sampled points per curve and 2048 points per connected run; at most 32 physical chains including reversed two-sided copies. No silent geometry loss on overflow. |
| Collision data | 64 convex CCW hulls, 3–8 vertices each; adjacent chain vertices at least 1 cm apart. Unsupported self-crossing/closed/retracing runs remain errors. Two-sided terrain doubles collision chains while drawing once. |
| World coordinates | Most numeric coordinates/bounds require absolute value **less than 100,000 m**. Compiler bounds add margins/headroom, so authoring an anchor just below that bound need not compile. START and temporary test starts require **both x and y within ±500 m**; this is not a course-length allowance. |
| Far from origin | Previous LE1b placement failures and the tightened start guard are documented in [the contract](contracts/level-editor.md#decisions-after-le1b-claudio-2026-10-18). Driving far from origin remains unmeasured. Float32 precision, contact quality, reset tolerances and camera behavior at long distances are not solved by meshes. No origin rebasing or physics streaming was tested. |
| Component pools | Configured Sprite 1024, Label 1024, collision objects 256. `collection.max_instances` is unset; pinned engine default is 1024 per collection, distinct from Sprite capacity. A terrain body can own hundreds of shapes: collision-object capacity is not a segment budget. Mesh capacity is not exercised (zero mesh components). |
| GUI and storage | GUI max 640; existing allocations near that cap are independent of terrain mesh replacement. My levels 64; per-level versions 10 automatic + 10 named, aggregate serialized history cap 16 MiB. A new renderer does not enlarge them. |

Pinned source consulted for pool interpretation: [`DEFAULT_MAX_COLLECTION_CAPACITY`](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/gameobject/src/gameobject/gameobject.h#L39), [collection allocation](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/gameobject/src/gameobject/gameobject.cpp#L456), [Sprite configuration](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/engine/src/engine.cpp#L1581). No new Defold API is used by this PR.

## Recommendation for #273

Use a **bounded, separate comparison scene** with the same source/compiler output and unchanged 2D collision, vehicle, camera and Retry. Retain normal Play/editor rendering and every admission guard. Implement none of this until Claudio's feedback and a new GO.

1. Define authored world metres, chunk-local vertices and the unchanged world-to-clip projection explicitly. Use accumulated route arc length for continuous UVs across chunk joins; declare a bounded terrain-body lower extent derived from the course bounds, not an infinite fill. Compare a flat filled/beveled 2D strip against a projected top/side/body depth version and, only if useful to decide projection, a shallow extruded variant. Keep the vehicle artwork and gameplay camera in their existing 2D frame. Use only Rider-owned geometry/materials. Do not start biome/decoration authoring (#278).
2. Start with **64 terrain intervals per mesh chunk**, at most **16 terrain chunks** in the experiment: these 666/696-segment routes need 11 chunks instead of 666/696 terrain Sprites/GOs. This is a provisional experiment parameter, not an increased production limit or a proven optimum. Combine top/side/body into one component per chunk where the verified material/vertex format permits; report actual vertices/indices, mesh components and draw calls. Check exact pinned 1.14.0 buffer/mesh APIs, bounds, index/vertex limits, material streams and render ordering before choosing the representation. Do not substitute one GO per face or sample.
3. Keep the exact sampled collision vertices, orientation, two-sided flags, bounds, START/FINISH and physics settings; compare their hashes before/after. Show chunk joins, crests, steep descent, gap/jump, reverse traversal and the mixed course, in landscape and portrait. Preserve wheel/road contact readability and rider/vehicle/props layer order. Human visual selection belongs to Claudio; benchmark timing cannot select the look.
4. Re-run the **same fixtures, five transitions/imports, drag protocol, warm-up and six-second drive windows** with an old/new toggle in the same debug build and alternating order, same device/browser/DPI. Report both all allocated chunks and visible chunks; do not claim allocation savings from hidden components alone. Record generation/count stability over Retry and Edit↔Play. New mesh setup time and worst transition frame matter as much as steady driving.
5. Gather the missing GPU/draw-call counters through the existing Defold profiler where available, with unsupported counters explicit. On the Xiaomi Mi 10T Pro record Chrome version, 60 Hz mode, DPI, thermal/background conditions, three load repeats and the existing 30-second Measure capture per fixture, plus visible stutter and depth readability. Repeat the declared cases in portrait. No mobile PASS until those trials exist.

P1's measurable success is a large reduction in **terrain Sprite/GO allocation** with identical collision output and a visible depth comparison. This baseline gives no safe claim about an arbitrary course length or an optimum chunk size. Sampling/validation and editor rebuild costs remain candidates for their approved later slice (#275); culling/cache lifecycle belongs to #276. Do not fold those into P1 or raise the 800 guard for a demonstration.

## Reproduction and verification

Run from the dedicated checkout with the pinned JDK/Python and lockfile-installed Node dependencies. The shared bundle verifier requires the checkout's current HEAD; build afresh on another commit rather than changing its identity. No runtime files differ from the measured base in this PR.

```sh
python tools/gym/bundle.py --output artifacts/terrain-p0/bundle
node tools/gym/terrain_baseline.cjs artifacts/terrain-p0/bundle artifacts/terrain-p0/reproduce
python tools/gym/smoke.py --bundle artifacts/terrain-p0/bundle --output artifacts/terrain-p0/a6 --case a6
python tools/gym/smoke.py --bundle artifacts/terrain-p0/bundle --output artifacts/terrain-p0/le5b --case le5b
```

The observer verifies the bundle identity/inventory, writes the three source/compiled fixture pairs, all raw frames/polls, screenshots and `results.json` to its output directory, and requires the larger source to stay saved with Play refused without a world change, all three accepted courses, five transitions/Retry/drags each, six identical-count imports each, exact source restoration after Undo, three predicate-qualified camera captures and no observed runtime errors. The detailed summary records the observer SHA-256 and bundle inventory. Run one observation process at a time; do not overlap measurement with builds, tests or other benchmarks.

For the supplementary native measurement, extract only the executable from the already SHA-256-verified Bob (no installation or dependency update). This command is for the measured x86_64 Linux host:

```sh
python - <<'PY'
from pathlib import Path
import hashlib, json, zipfile
bob = Path('.cache/g1/bob.jar')
assert hashlib.sha256(bob.read_bytes()).hexdigest() == json.load(open('tools/toolchain-lock.json'))['bob']['sha256']
with zipfile.ZipFile(bob) as archive:
    executable = archive.read('libexec/x86_64-linux/luajit-64')
target = Path('artifacts/terrain-p0/luajit-64')
target.write_bytes(executable)
target.chmod(0o700)
PY
artifacts/terrain-p0/luajit-64 -joff tools/gym/terrain_cpu.lua artifacts/terrain-p0/reproduce
```

Historical verification: pinned debug bundles + engine guard PASS on `2a22898` and the refined `75a9a3d` build; revised three-course observer plus over-budget refusal PASS on `75a9a3d`; unchanged-runtime checks on `2a22898`: `a6` PASS; `le5b` all 11 named cases PASS (including over-budget refusal, compiler-6 upgrade, dense geometry error checks, mirror and three repeat drives). Bootstrap check + 55 bootstrap tests, 31 Python CI tests, 39 G1 tooling tests, 8 G2 tooling tests and 79 Node CI/mobile tests PASS. G2 unit tests intentionally print simulated FAIL results internally; the unittest suite itself passes. CI/review state belongs in the PR and this task's STATUS entry.

Earlier local measurement candidates are excluded from the accepted detailed baseline: the first observer wrongly expected Edit to publish a Play load-generation endpoint; a later added assertion found that plain Z did not Undo (corrected to Ctrl+Z and exact object restoration). The first handle-based preview observer measured commit rather than preview; the final run watches the existing drag readout. The final callback distribution also excludes the pointer helper’s extra rAF callbacks, retaining engine Edit publications only. An early airborne screenshot could have captured initial settling, so the final jump capture additionally requires more than 13 m of travel past the jump START, beyond the lip at 12 m. No existing assertion, runtime limit or physics behavior was weakened to get these results.

Claudio’s late clarification superseded the earlier gentle-wave long/mixed fixtures. Their timing/allocation values are excluded from the final comparison; both refined runs use the saved diverse 500 m source.

Remaining evidence limits are intentional: GPU/draw-call instrumentation and real-phone/human observations are unavailable here, isolated HTML5 sampler timing is not exposed, and full-course/far-origin driving was not measured. These are not PASS claims. #273 requires Claudio's feedback and a separate GO after this report.
