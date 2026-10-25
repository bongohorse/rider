# Terrain P4: bounded render residency (#276)

**Contents:** [Behavior](#behavior) · [Policy and ownership](#policy-and-ownership) · [Measurements](#measurements) · [Verification](#verification) · [Preview and reproduction](#preview-and-reproduction) · [Engine evidence and limits](#engine-evidence-and-limits)

## Behavior

Play and the admitted mesh editor now allocate terrain mesh components and vertex resources around the current camera view. The complete collision world, vehicle, hazards, trigger state, camera behavior, source sampling, compiler, conservative 800-unit admission and configured component limits remain unchanged. Retry remains an in-world reset. Oversized drafts retain their existing line preview and Play refusal; this does not implement #277.

The three saved [P0 fixtures](terrain-p0/) are reused: 330 m / six anchors / 666 segments; 500 m / 696 segments with flats, wide and tight curves, 20 m ascent/descent, crest, seven-metre open jump and valley; the same long route plus twelve hulls and six labels. The rejected 660 m draft remains rejected without a limit increase. Physics shapes are still 666 / 696 / 708 terrain shapes, plus the unchanged vehicle's four world shapes.

Source edits still plan dependencies through the existing editor path. Unchanged sections retain their descriptor and, while resident, their geometry/resource identity. A culled section records its latest source, selection/hover/hidden style, floor and UV phase; returning to it builds the current version. Pan, zoom and ordinary camera movement only test section bounds. They do not compile/sample the document or rebuild unchanged resident geometry.

## Policy and ownership

- A section is visible for this accounting when its **projected two-dimensional AABB intersects the entire camera viewport**. This includes the body down to the existing floor and the depth projection, not just the road's X interval. It is an intersection count, not a measured draw-call or pixel count; source Hide retains the existing alpha semantics.
- Visible sections are prepared/uploaded synchronously before the frame renders. This correctness path can activate every section in a whole-course view; it is deliberately not a hard two-upload frame budget.
- Preload uses an 8 m symmetric XY margin, with twice the last view displacement added up to 32 m. It handles reverse and downward motion too. Already resident sections have another 4 m hysteresis. At most **two additional nonresident, nonvisible sections** are prepared per frame, nearest first. Dirty resident sections still refresh through the existing dependency path; visible catch-up remains synchronous. The editor applies residency once per frame, including source refresh/rebuild transitions. These starting values are exercised on the three fixtures, not established as optimal constants.
- Beyond this active envelope there are at most **two cached sections**. Their mesh components are disabled, but their owned resources and CPU geometry remain allocated. Excess components are deleted and owned buffer references released; emitted Lua position/color/UV arrays are dropped. Source/sample descriptors remain, as needed to recreate a section.
- An evicted slot can be reassigned before creating another component. There is no additional application-wide pool/history. The measured fine-grained browser pans needed no slot reassignment; no measured pooling speedup is claimed. Existing Defold VB reuse is accounted for separately.

For a fixed document the bound is `allocated = enabled + cached`, with `cached <= 2` and `allocated <= logical sections`. Enabled sections include preload/hysteresis and can exceed viewport intersections. The unchanged accepted Play domain has at most 44 sections; the existing editor replacement guard is 64. A Fit view can legitimately require all of them. This is a viewport lifecycle within current admission, not a new density/admission budget or a promise of constant memory for arbitrarily dense visible terrain. The unchanged default mesh capacity is 128.

These measured allocation counters count adapter-owned component/resource pairs at publication, not an engine-wide GameObject/component census. `go.delete` completes at the end of the frame; retiring components can retain their buffer reference until then. Even the conservative old-plus-incoming transient bound is 88 Play / 128 Edit components under those existing section guards. That is a source/engine-lifecycle bound, separate from the measured steady owner counts and from the WebGL pool observations.

Resources belong to the proxy/editor instance. There are no world handles in module state. Changed-source replacement keeps the existing failure-cleanup registration; activation failures in Edit clean up and fall back through the existing line-view path. Final cleanup is idempotent. The native adapter check includes create/bind/update failures and a culled endpoint/style edit revealed later, compared against freshly emitted production geometry.

**Released is different from hidden and from physical GPU reclamation.** Disabling a cached component frees neither its component slot nor its resource. Deleting excess components and releasing our references frees those owners after Defold's deferred deletion/GC rules. Pinned Defold retains freed VBs in its mesh-world pool until reuse or world destruction. A prior Fit can therefore leave higher WebGL payload than the currently allocated section payload. Wasm allocator/physical GPU/process memory reduction is not inferred from releasing a Lua reference.

## Measurements

[Resource evidence](terrain-p4/resources.json) records exact source/observer hashes, environment, five loads per fixture, raw load-frame observations, component/reference counts, WebGL handle/upload-size histograms, all 174 editor snapshots, activation events and their enclosing callbacks. Complete observer outputs remain reproducible with the commands below. [P0 observer evidence](terrain-p4/measurements.json) adds five tangent/Undo gestures and Edit↔Play/Retry cycles per fixture, compilation/export equality and six-second drive windows.

Measured on local HTML5 debug, Chromium 156.0.8078.4, ANGLE SwiftShader, nonisolated `wasm-web`, 1280×720 / DPR 1; natural GC, no concurrent build/browser during performance collection. Before is the immutable accepted P3 build `5380b9a029672b350df7c23683381b07b344ec51`; after is `47c980a3725f8203a234153e9eeae930da5a3065`. The same observer hash `00732b…9259918` and input protocol run sequentially on both. The saved P3 baseline precedes the #287 review's color-index correction; the comparison does not change source sample indices, so that corrected edge case is outside this timing protocol. It is not represented as a measurement of merged-main `ff27590`.

| Fixture | P3 resident sections / vertex payload | P4 at initial drive-ready view | Warm import median, P3 → P4 | Largest load callback, P3 → P4 |
| --- | --- | --- | --- | --- |
| Six-anchor | 11 / 432,000 B | 1 / 41,688 B | 90.2 → 64.1 ms | 48.2 → 38.4 ms |
| Long | 12 / 451,872 B | 1 / 41,688 B | 91.0 → 55.9 ms | 48.6 → 13.0 ms |
| Mixed | 12 / 451,872 B | 1 / 41,688 B | 90.8 → 56.4 ms | 49.4 → 14.2 ms |

Warm medians exclude the first of five imports. The separate P0 observer records warm medians 60.0 / 53.5 / 54.6 ms and maxima 61.4 / 55.2 / 60.9 ms. The historical P0 medians were about 55–63 ms. Local loading improves for this view/protocol, but the earlier higher-load-time performance point remains open for broader views, courses and devices.

After eight seconds of forward driving, observed allocation is two sections / 83,160 B; Retry keeps the same world and a bounded cache. Actual descent and airborne-gap snapshots allocate three / four sections, while every original collision shape remains. Native forward/reverse/vertical/teleport sweeps peak at six allocated sections per fixture and emit nothing after stationary preload drains. In the browser, the whole-course editor uses all 11 / 12 sections; clipped pans release excess owners, with no more than two cached sections. Long-course camera X spans roughly 10–622 m, including beyond the end and return; source geometry and the seven-metre gap remain intact.

The resource observer's 86 activation-containing callbacks have median 11.3 ms, p95 38.3 ms and maximum 51.7 ms. Lua residency work peaks near 9 ms on its coarser clock; zeros are not zero-cost evidence. Entire mixed-operation callback p95/max is 7.2 / 58.6 ms before and 7.4 / 51.7 ms after. These include UI, activation and engine work and are **not GPU durations**. The new steady drive windows still show p95 intervals 16.8–16.9 ms and occasional ~33 ms intervals, with whole-frame WebGL call medians around 22. No general FPS gain follows from these measurements.

The final tangent protocol records editor callback p95/max 49.0 / 56.1 ms (six-anchor), 46.0 / 51.7 ms (long), 44.8 / 49.8 ms (mixed). P3's peaks up to ~59 ms remain an open performance concern, not a resolved 60 FPS editing guarantee. Edit→Play also has observed callback peaks near 49–52 ms on the long/mixed routes. No physics/seam tolerance or admission assertion was relaxed.

WebGL snapshots record all observed buffer payload, not terrain-only physical memory. For example, the fifth initial six-anchor load records 1,158,784 B before versus 768,472 B after, including nonterrain buffers. Editor Fit then raises the retained pool even after owner counts fall. Repeated world switches preserve the pre-existing small shader-buffer growth (16 B + 64 B per switch); that pinned-engine issue remains open. Terrain components/owned references are bounded and replaced-world terrain payload does not accumulate as another complete resident course. The evidence does not claim leak-free engine-wide memory or a device GPU-memory result.

## Verification

- Verified pinned debug/release engines; both Wasm variants pass the extender/byte-identity guard.
- Native production geometry: 22 routes retain accepted P1 world coordinates, seams, UVs and bounds; source/collision immutable; original 800 refusal remains. Native residency sweeps cover fast forward/reverse, vertical displacement, Fit and teleport, bounded cache, no idle emission and discarded evicted arrays.
- Native actual adapter/planner with simulated engine boundary: ownership/failure cleanup, retained-resource styling after shifted indices, and culled source/style edits revealed as current geometry. This is not a device test.
- Final runtime resource observer: 18 loads, three eight-second drives and Retry, 174 editor pan/zoom/Fit/aspect snapshots, descent, airborne jump and actual reverse velocity. Every published viewport-intersecting section is enabled/allocated; editor snapshots additionally check against its independent actual pixel projection. This is sampled functional/capture evidence, not an exhaustive proof of every possible frame or authored course.
- P0 observer: original over-budget refusal, complete JSON re-exports equal all three tracked P0 fixtures, unchanged terrain-shape counts; fifteen tangent/Undo gestures and fifteen Edit↔Play/Retry cycles; three drive windows and difficult START variants. Existing le5b all eleven cases pass on initial integrated runtime `58217bc`; final `47c980a` le6 (14) passes; earlier integrated `37e9ed9` a22 (seven, including 30 FPS render and negative traces) and a6 (drive/camera/reverse/reset) pass, with final exact-head coverage tracked in the PR.
- Bootstrap check, 55 bootstrap, 39 G1-tool, eight G2-tool, 31 Python CI and 79 Node CI/mobile tests pass. G2's intentional negative-fixture FAIL lines are expected test inputs; the suite itself passes.

Exact-head full CI, final ordinary release QA and final runtime editor/reset regression records are linked in the PR. A build/CI phone viewport is not a physical-phone test.

[Ordinary release QA](terrain-p4/release-check.json) passes seven course/START views, throttle/Retry, Editor/Fit/short layout, Edit→Play, station A→B→A, exact source identity, absence of debug inspection globals and launcher refresh. [Editor regression](terrain-p4/editor-regression.json), [physics traces](terrain-p4/physics-regression.json) and [drive/camera/reset](terrain-p4/retry-camera.json) retain their existing assertions.

[Draft reopen evidence](terrain-p4/launcher-check.json) records a real START-speed edit (revision 2 / speed 0 → revision 3 / speed 1), Saved/IndexedDB acknowledgement and exact draft restoration after parent reload. The original helper timed out twice after Enter with unchanged speed/revision and no runtime errors; those runs remain FAIL. The corrected helper waits for the actual field text `1` before confirmation and for the accepted revision before releasing Enter. It then passes. Frame-coalesced input ordering is the explanation consistent with that evidence, not a measured gameplay defect; no game input/storage code changed.

## Preview and reproduction

Ordinary release preview: [long course](http://127.0.0.1:8788/terrain-preview.html?course=long-curves), [six anchors](http://127.0.0.1:8788/terrain-preview.html?course=six-anchor), [mixed](http://127.0.0.1:8788/terrain-preview.html?course=mixed). E switches Edit/Play; Home uses the existing Fit; middle-drag pans and the wheel zooms. The START selector includes crest, descent, jump, landing and valley. Retry is unchanged. The artifact-only launcher preserves a restored draft instead of importing over it. No unmerged public Pages deployment or exposed debug service is claimed.

Actual debug captures: [mixed pan](terrain-p4/mixed-pan.png), [Fit](terrain-p4/mixed-fit.png), [descent](terrain-p4/descent.png), [gap flight](terrain-p4/jump.png), [reverse](terrain-p4/reverse.png). They are unmodified runtime captures, separate from the ordinary release preview.

```sh
node tools/gym/terrain_baseline.cjs --fixtures artifacts/terrain-p4/native-inputs
<verified-locked-bob-luajit> -joff tools/terrain_play/check_residency.lua artifacts/terrain-p4/native-inputs
<verified-locked-bob-luajit> -joff tools/terrain_editor/check_ownership.lua artifacts/terrain-p4/native-inputs
python tools/gym/bundle.py --output artifacts/terrain-p4/debug
timeout 260s node tools/terrain_play/observe_resources.cjs <verified-P3-bundle> artifacts/terrain-p4/before --baseline
timeout 260s node tools/terrain_play/observe_resources.cjs artifacts/terrain-p4/debug artifacts/terrain-p4/after
timeout 260s node tools/gym/terrain_baseline.cjs artifacts/terrain-p4/debug artifacts/terrain-p4/p0 --mesh --editor-mesh --resident
python tools/project.py build --target html5 --configuration release --output artifacts/terrain-p4/release
python tools/terrain_play/prepare_preview.py artifacts/terrain-p4/release
python -m http.server 8788 --bind 127.0.0.1 --directory artifacts/terrain-p4/release/RiderG1
timeout 240s node tools/terrain_play/verify_preview.cjs http://127.0.0.1:8788 artifacts/terrain-p4/release-check <release-source-sha> --editor
```

The descriptor check compiles the generated P0 source Lua with the actual existing editor compiler. The separate retained 22-route check uses the existing P2 JSON→Lua conversion for built-in inputs; neither introduces another compiler or raises limits. Build/observer manifests verify exact source and archive inventory. Raw local outputs are under `artifacts/terrain-p4/`; compact checked evidence above retains source hashes and the full outputs' hashes. Final documentation-only commits can have a later PR head than the explicitly identified runtime build; the PR distinguishes those sources.

## Engine evidence and limits

Pinned Defold 1.14.0 `a81dbb0478e8b73931dc2d671563204f6ac0ef82` / Box2D 3.1.0. Consulted [Camera API](https://defold.com/ref/camera/), [Window API](https://defold.com/ref/window/), [mesh manual](https://defold.com/manuals/mesh/) and [Resource API](https://defold.com/ref/resource/). Pinned [camera late update](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/gamesys/src/gamesys/components/comp_camera.cpp#L246), [projection getter](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/render/src/render/render_script_camera.cpp#L299) and [AUTO_FIT math](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/render/src/render/camera.cpp#L131) show that current-frame zoom/resize must not rely on the previous projection. Residency matches the existing unrotated AUTO_FIT size from current window dimensions and zoom; actual editor pixel mapping verifies it. It does not write or replace the camera algorithm.

Pinned [mesh VB allocation/pool](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/gamesys/src/gamesys/components/comp_mesh.cpp#L117), [reference decrement](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/gamesys/src/gamesys/components/comp_mesh.cpp#L164) and [world deletion](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/gamesys/src/gamesys/components/comp_mesh.cpp#L263) distinguish disabled components, released owners and actual VB deletion. Existing buffer upload/ownership transfer and projected metadata remain in the adapter.

Reference Xiaomi Mi 10T Pro, physical touch/app switching, hardware GPU time/memory and a general production frame-time guarantee are **NOT RUN / unmeasured**. The preload/cache constants and synchronous whole-view catch-up are provisional trade-offs for correctness. Source/compiler/coordinate limits and #277's budget migration remain untouched. Stop for Claudio's #276 travel, downhill/landing, reverse, editor pan/zoom and reset test; #277 has no GO.
