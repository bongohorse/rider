# Terrain P5: resource admission (#277)

**Contents:** [Behavior and policy](#behavior-and-policy) · [Resource model](#resource-model) · [Measurements](#measurements) · [Verification](#verification) · [Preview and reproduction](#preview-and-reproduction) · [Engine evidence and limits](#engine-evidence-and-limits)

## Behavior and policy

The obsolete 800-unit estimate charged a Sprite for every terrain segment, even after Play and Edit moved to meshes. `terrain_budget.lua` now predicts the production renderer independently from source/compiler/coordinate validation. The source/compiler version remains 7; saved documents need no migration. Geometry, sampling, collision creation, physics parameters, camera and Retry remain unchanged. All configured engine pools remain unchanged.

The P0 660 m source, previously refused at 1018 legacy units, compiles to 1016 segments in two chains, 17 mesh sections, 18,312 vertices and 659,232 vertex-payload bytes. The same course with twelve four-edge static hulls and six labels is included. These are the supported representative obstacle/decoration objects; pickups are not supported by the current level format (#120 remains separate), and no fake pickup evidence is claimed.

Invalid or resource-heavy drafts remain saveable and editable with the existing bounded line fallback. Play/Export refuse unsupported input with a resource name, required amount, limit and correction. Problem targeting uses the largest sampled source, an outline for a Sprite failure, or a label for a Label failure. The actual limiting resource may change after another is corrected; no accuracy reduction or geometry dropping is used to make Play fit.

## Resource model

| Layer | Admission policy / accounting |
| --- | --- |
| Terrain sections | 64 intervals per normal section, from the production partition. Each chain adds its two end caps. At Fit every logical section may be visible and allocated. Visible intersections, enabled/preloaded sections and allocated sections are distinct; at most two allocated sections are cached, as a subset of the logical sections. |
| Deferred replacement | Twice the logical section count must fit 128 mesh components. The editor also checks the actual retained/fragmented plan before upload, including payload; its maximum interval span is 96. One source/residency refresh per frame bounds retiring plus incoming components until deferred deletion. |
| Vertex payload | Exact `(18 × segments + 12 × chains) × 36` bytes; triangles are unindexed, with nine float32 values per vertex. Policy cap 1 MiB at whole-course Fit. Replacement can temporarily retain twice that payload. |
| CPU working estimate | `512 × emitted vertices + 512 × physics vertices + 2 × payload bytes`, capped at 16 MiB. This is a deliberately conservative application estimate for arrays/descriptors/staging and engine CPU buffers, calibrated with actual Lua observations below; it is not an OS/process/Wasm heap cap. The physics-vertex term charges compiled source/descriptors, not native Box2D allocation. Fixed runtime/GUI/assets and measured native physics memory remain separate. |
| Retained engine VBs | Releasing owners does not shrink the engine pool. Conservative world ceiling: 128 slots plus the shared seed buffer, each charged the largest editor section (`(96 × 18 + 12) × 36 = 62,640 B`), or 8,080,560 B of uploaded payload. This envelope is separate from current ownership, the CPU estimate and physical GPU memory. It is an inferred lifecycle bound for this adapter, not a measured GPU reservation. |
| Sprites | Hull edges, distance ticks, FINISH, built-in checker/seesaw where applicable, plus 64 reserved for vehicle, struts, replay and fixed-world headroom; must fit 1024. Terrain segments, labels, GUI and audio are not Sprites. |
| Labels | Actual labels, FINISH and the exact distance-marker major test, plus independent reserve 64; must fit 1024. |
| GameObjects | Sections + actual decoration Sprites + Labels + reserve 64; must fit 1024 in the proxy collection. Editor admission separately includes doubled decoration/section costs plus START/FINISH headroom, or retains the bounded line preview. |
| Physics workload | At most 2048 physics vertices in total: chain vertices (including reversed two-sided copies) plus hull vertices. This conservative application workload cap replaces no engine setting or simulation behavior; individual chain/run cap 2048, 32 physical chains and 64 hulls remain independent. Actual shapes/Box2D bytes/step observations are reported separately. A terrain body owns many shapes; collision-object capacity 256 is not a segment allowance. |
| GUI / audio / particles | Editor allocates 628 of 640 GUI nodes with existing bounded handle/grid pools. The controller owns one engine-sound component/voice per Play session; no terrain-dependent audio or particle allocation exists. No new gameplay objects, sounds or particles are admitted implicitly. |
| Source / compiler / coordinates | Text/import/export 256 KiB; source 256 objects and 8192 points, per-object/run/curve 2048, fixed sampling 5 mm / 0.5 m, source names/text 64 bytes, hull vertices 3–8, numeric coordinates/bounds strictly below absolute 100,000 m. START and test starts remain within ±500 m on both axes. Storage/version/Undo caps are unchanged. |

The memory caps are bounded application policy, not a discovered universal engine limit or a promise that all combinations at every cap sustain 60 FPS. Dense two-sided content can hit physics admission before the same visible renderer hits a memory limit. Long sparse content can instead hit coordinates or source/export size. Fixed GUI/audio, engine buffers, source/Undo/history and collision costs do not disappear with culling.

## Measurements

[Final 660 m measurements](terrain-p5/budgets-optimized.json) identify runtime `05a163e`, Chromium 156.0.8078.4, local HTML5 debug `wasm-web`, 1280×720/DPR 1 and ANGLE SwiftShader. Five measured warm imports follow one first import; drives have one second warm-up plus six measured seconds. Performance runs were sequential, without concurrent browser tests or builds. [Earlier integrated P5](terrain-p5/budgets-final.json) identifies `9709453`; [retained P0 comparison](terrain-p5/p0-final.json) uses that same earlier runtime. Raw-output and observer hashes accompany the compact records. Later changes to tooling/evidence are distinct from the identified runtime.

| 660 m fixture | Fit mesh sections / payload | Edit Sprites / Labels | Play Sprites / Labels, Ghost off | Warm import median / max | Drive interval p95 | Editor callback p95 / max |
| --- | --- | --- | --- | --- | --- | --- |
| Terrain + FINISH | 17 / 659,232 B | 5 / 2 | 7 / 1 | 62.4 / 95.6 ms | 17.0 ms | 80.2 / 94.3 ms |
| + 12 hulls, 6 labels | 17 / 659,232 B | 53 / 8 | 55 / 7 | 68.2 / 78.3 ms | 17.1 ms | 75.4 / 94.7 ms |

The mixed source is 4,162 bytes; compiled export is 39,530 bytes. It retains the seven-metre jump gap and the original tight/steep features. All 17 sections are allocated/enabled at Fit; ordinary initial Play needs one section / 41,688 B and subsequent driving retains a small active/cache subset. At the far end one section is enabled and two are cached (94,824 B). Whole-course source-derived Play GameObjects are 29 / 83 without Ghost: four fixed world objects, four vehicle objects, two struts, 17 meshes and actual decoration/labels. A Ghost is three GOs/four sprites, with old/new overlap on replacement. These are audited source allocations, not a profiler census; the 64-slot reserve leaves independent margin over fixed vehicle/replay/probe needs.

Native physics remains 1016 / 1028 terrain shapes, 1020 / 1032 including the stock vehicle. The final drive windows record Box2D bytes 1,094,200–1,094,904 / 1,172,664–1,173,368, Lua 3,449–7,965 / 3,501–7,939 KiB and physics-step p95 0.2 ms on a clock with ~0.1 ms resolution. These short mostly road-contact windows do not establish dense-obstacle throughput. Wasm capacity is 256 MiB, not course usage. JS heap includes the observer; the final samples are about 6.3 / 5.1 MB and are not isolated course deltas.

[Native allocation observations](terrain-p5/native-memory.txt) exercise the actual compiler plus two complete Edit emissions. Incremental Lua observations are about 5.0 MiB (six anchors), 4.8 MiB (500 m), 6.1 MiB (mixed 500 m), 7.3 MiB (660 m), below the respective policy estimates. This validates those tested working sets, not every possible allocator state. Engine CPU buffers and native Box2D memory are separate observations; the 16 MiB estimate is no claim about total retained process memory.

Observed WebGL uploaded payload at 660 m Fit is 1,622,996 / 1,642,468 B including nonterrain buffers and retained engine pool entries; after repeated imports the initial-view snapshots are about 771 KB. Payload need not fall with current owner counts. Physical GPU allocation and GPU duration remain unmeasured. Existing 16+64-byte shader-buffer retention per world switch remains open; no engine-wide leak-free claim is made.

Before admission migration the [P4 record](terrain-p4/measurements.json) refused exactly this 660 m source at 1018 legacy units and used a simplified 1011-Sprite/2-Label Edit preview; Play physics/frame costs were unknown because it was rejected. After migration it uses the mesh figures above. The same accepted six-anchor/500 m/mixed sources still export JSON exactly equal to the tracked P0 fixtures. P4→integrated-P5 warm medians are 60.0→62.0, 53.5→55.4 and 54.6→61.9 ms; drive interval p95 remains about 16.8–17.3 ms. P4's comparable initial six-anchor WebGL snapshot was 768,472 B, versus 768,552 B in integrated P5; the instrumentation/run history differs, so this is not an isolated allocation delta. Shader retention/GC and observer differences prevent a causal performance claim.

Editor peaks remain a material limitation: integrated P5 reached 115 ms on the larger source; final live-validation reuse records peaks near 95 ms. Even accepted P0 fixtures had integrated peaks 62–98 ms versus P4's 50–56 ms. No general improvement, 60 FPS editing guarantee or resolved loading spike is claimed. Physical phone behavior, hardware GPU time/memory and process memory remain unmeasured.

## Verification

- [Native budget checks](terrain-p5/budget-native.txt) use the real compiler/geometry and verify exact descriptor/payload prediction, cached preview eligibility, separate component/Sprite/Label/GameObject/two-sided-physics/CPU refusals and the unchanged START guard. [Geometry checks](terrain-p5/geometry.txt) retain 22 routes, exact accepted mesh coordinates, seams/UVs/bounds and immutable collision/source. Existing residency/ownership checks pass, including culled edits, bounded cache, failed creation/bind cleanup and retained color ownership.
- [Both final 660 m courses](terrain-p5/budgets-optimized.json): ten tangent/Undo gestures, ten Edit↔Play/Retry cycles, all-section Fit, Saved plus IndexedDB acknowledgement, exact source/revision reopen, repeated imports and actual downhill/jump/reverse inputs pass. There are no runtime errors in those records.
- [Changed saved mixed draft](terrain-p5/launcher-660.json): actual field input changes START speed 0→1, revision 13→14; acknowledged save and parent reload restore revision 14/speed 1 with exact objects. Subsequent Play/Retry retains 1028 terrain shapes and the same world generation/load count.
- [Far-end driving](terrain-p5/far-course.json): normally validated START at `(488, -8.548)` m, within ±500 m; stock vehicle/throttle travels 172.195 m past the 660 m end and reaches FINISH. 232 sampled views retain every viewport-intersecting section; Retry stays in generation 2. This tests the last section from a legal start, not a continuous run from the default START. [Actual capture](terrain-p5/far-end.png).
- [Size protocol](terrain-p5/sizes.json), runtime `9709453`: all 17 accepted and 13 rejected cases pass, retaining every historical case and adding 1100 plus the CPU boundary at 1521 segments. The latter uses 24 sections/986,040 payload bytes, 1521 terrain shapes and observed Box2D 1,649,812 B. 1522 refuses CPU estimate (16,786,048 > 16,777,216 B); 1650 refuses Fit payload (1,069,632 > 1,048,576 B), preserving the previous valid course/save. Text/compiler/chain/hull/coordinate/START failures remain in the protocol. Exact full/split case inventories are 30 and 9 / 21 (plus the second part's unreported warm-up), with all assertions/timeouts retained.
- Final pinned debug and ordinary release build/engine guards pass. [Release QA](terrain-p5/release-check.json), runtime `05a163e`, passes both 660 m courses, all seven retained course/START views, throttle/Retry, editor/Fit, short layout, return to Play, launcher resume, station switches, exact identity and absence of debug inspection globals. [Mixed Fit capture](terrain-p5/mixed-over-budget-fit.png), [changed reopened draft](terrain-p5/resumed-editor.png).
- Bootstrap check, 55 bootstrap, 39 G1-tool, eight G2-tool, 31 Python CI and 79 Node CI/mobile checks pass. The prefab protocol passes all twelve cases on `864917f`, including oversized refusal, bounded fallback and deletion restoring Play. Final `05a163e` editor regression passes all fifteen cases, including safe oversized draft editing/save/reload and blocked Play. Full CI/required passes on `05a163e` in [run 40247332828](https://github.com/bongohorse/rider/actions/runs/40247332828); final PR-head evidence is linked in PR #289; physics/seam/reset tolerances are unchanged.

Earlier helper attempts are not accepted passes: one observer read nonexistent Play telemetry after restoring an Edit-only page (fixed optional pre-action reset read); oversized prefab selection clicked beneath the opaque palette, then tried a list row outside the visible window (fixed with real object selection/canvas panning). A stale-source bundle invocation was correctly refused. Assertions, timeout caps and source/geometry preservation checks were retained. The aborted pre-commit build is not runtime evidence.

## Preview and reproduction

Ordinary release preview, runtime `05a163e`: [660 m mixed](http://127.0.0.1:8790/terrain-preview.html?course=mixed-over-budget), [660 m terrain](http://127.0.0.1:8790/terrain-preview.html?course=long-over-budget), [ordinary Gym](http://127.0.0.1:8790/index.html?station=straight). E edits/starts Play, Home fits, R retries; the launcher preserves an acknowledged saved draft on reload. The two large courses keep their normal run-in START; later legal starts can be authored in Edit without extending the ±500 m guard. No unmerged public Pages deployment is claimed.

```sh
node tools/gym/terrain_baseline.cjs --fixtures artifacts/terrain-p5/native-inputs
<locked-bob-luajit> -joff tools/terrain_play/check_budget.lua artifacts/terrain-p5/native-inputs
<locked-bob-luajit> -joff tools/terrain_play/measure_budget.lua artifacts/terrain-p5/native-inputs
python tools/gym/bundle.py --output artifacts/terrain-p5/debug-optimized
timeout 260s node tools/gym/terrain_baseline.cjs artifacts/terrain-p5/debug-optimized artifacts/terrain-p5/budgets-optimized --mesh --editor-mesh --resident --budgets
node tools/terrain_editor/check_launcher.cjs artifacts/terrain-p5/debug-optimized artifacts/terrain-p5/release-final/RiderG1 artifacts/terrain-p5/launcher-660 mixed-over-budget
node tools/terrain_play/check_far_course.cjs artifacts/terrain-p5/debug-optimized artifacts/terrain-p5/far-course
python tools/project.py build --target html5 --configuration release --output artifacts/terrain-p5/release-final
python tools/terrain_play/prepare_preview.py artifacts/terrain-p5/release-final
python -m http.server 8790 --bind 127.0.0.1 --directory artifacts/terrain-p5/release-final/RiderG1
node tools/terrain_play/verify_preview.cjs http://127.0.0.1:8790 artifacts/terrain-p5/release-final-check <release-source-sha> --editor --budgets
```

The size observation used the manifest-verified `9709453` bundle with its explicit SHA and the existing `sizes.cjs` runner; all 17 drive-ready/13 refusal results were independently checked. CI runs the expanded protocol through `smoke.py` with the exact inventories. Full raw outputs are under `artifacts/terrain-p5/`; checked records retain source/observer and raw-output hashes. All are Rider-owned sources/assets.

Stop for Claudio’s complete long-course authoring/drive test. #278 has no GO.

## Engine evidence and limits

Pinned Defold 1.14.0 `a81dbb0478e8b73931dc2d671563204f6ac0ef82` / integrated Box2D 3.1.0. No new Defold API use is introduced. Consulted [pinned mesh buffer allocation, reference decrement and world teardown](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/gamesys/src/gamesys/components/comp_mesh.cpp#L106), [project settings](https://defold.com/manuals/project-settings/#collection) and [deferred GameObject deletion](https://defold.com/ref/go/#go.delete). These distinguish default component/collection capacity, active buffer references and recycled VBs. Driver upload instrumentation measures WebGL handle payload, not hardware GPU allocation.

Loading and editor callback peaks remain open. The reference Xiaomi Mi 10T Pro, physical touch/app switching and hardware GPU evidence are NOT RUN. No general frame-rate, arbitrary course-length or contact-heavy obstacle performance claim is made.
