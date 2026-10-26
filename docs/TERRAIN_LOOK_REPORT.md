# Terrain Look authoring (#278)

**Contents:** [Authorization and preview](#authorization-and-preview) · [Controls and compatibility](#controls-and-compatibility) · [Rendering and budgets](#rendering-and-budgets) · [Verification](#verification) · [Reproduction](#reproduction) · [Limits and stop point](#limits-and-stop-point)

## Authorization and preview

Claudio explicitly authorized finalizing #293 and continuing with #278. **No additional drive test was reported.** Independent read-only review found a root-field/profile ambiguity in #293, corrected in `68b0d11`; follow-up review found no remaining blocker. Exact-head required 40314554248 passed; #293 was marked ready and merged as `b47cb3e`. Main CI/deployment 40315721811 also passed. These are authorization and automated evidence, not a new human drive observation.

Claudio subsequently reported that the Editor feature works very well and granted GO to add the same Terrain Look menu with live preview to in-game Gym Play. This records only his stated Editor acceptance; no additional device or driving observation is inferred. The same open draft PR #294 covers that extension.

#278 is implemented in draft PR #294. Playable ordinary release: http://127.0.0.1:8794/terrain-preview.html?course=long-curves. Press **E**, then **Terrain Look** in the editor footer. Select source terrain objects before opening the menu for Selected scope. The launcher includes an unchanged **Legacy fixed Depth (500 m)** option and a normal Gym link.

Original Editor-only release source: `fb9c21fdd5d724bba594cb5089f9daf6beb7d0ff`; pinned Defold 1.14.0 / engine `a81dbb0478e8b73931dc2d671563204f6ac0ef82`. [Reopened release menu](terrain-278/menu-reopened.png), [applied menu](terrain-278/menu-applied.png), [short window](terrain-278/short-menu.png) and [660 m Fit](terrain-278/660-fit.png) are unmodified actual screenshots.

The accepted default remains width 0.9 m, perspective 0.35, angle atan(0.55) = 28.810793742973°, side cap 64 m, shading 1, perspective mode. Release QA deliberately used 1.25 / 0.4 / 30° / 6 / 0.6 to verify retention; those are automated test settings, not a new user preference. No private retained browser JSON or additional human observations are claimed.

## Controls and compatibility

The [shared road-look contract](contracts/road-look.md#editor-authoring) defines the five ranges, schema and transitions. The menu uses the existing native GUI pool and shared `projection.CONTROLS`, `projection.RANGES` and validator. There is one projection/material path. No second tuner, shader system, decoration, weather or atmosphere is introduced.

- **Level** changes defaults and the common projection. Existing manual section overrides remain. Any locked terrain blocks a level operation.
- **Selected sections** means existing source lines, curves and terrain prefabs, with stable IDs. Split source using the existing editor when a finer section is needed. Width, side depth and shading can be local. Perspective strength/view angle stay level-wide, shown disabled in Selected scope, keeping one coherent projection space. A connected run containing locked terrain blocks a selected operation to protect its shared transitions.
- Slider/numeric input previews without changing source, revision, save slots or Undo. Close/Esc retain valid session values; `Terrain Look *` marks preview values awaiting Apply. Closing is neither Apply nor Reset. Play uses committed source.
- **Apply** is one existing source commit/Undo transaction, using normal autosave, acknowledged IndexedDB persistence, backups and versions. Closing/reopening and reloading restore applied values. Unapplied values are session state; reloading uses the committed source.
- **Reset** previews the accepted level defaults or, for Selected, removal of overrides/inheritance. Apply stores the reset. Level Reset preserves manual overrides. Undo/Redo restore look data through existing source snapshots.
- Unmarked existing levels keep the original 36-byte fixed Depth renderer until explicit **Level Apply**. Opening their menu does not change appearance/source. The menu labels the explicit perspective conversion; Selected cannot silently convert the rest of a legacy course.

Apply stores `editor.road_profile = "authored-v1"` and `editor.road_look = {version=1,params=...}`. An object's optional `road_look = {version=1,width=...,side=...,shading=...}` is separate from source geometry. Editor/compiler versions stay 7; known source and look versions are required. Older #292 readers safely refuse the new profile instead of ignoring its authoring. Unknown container/parameter/section versions/keys remain protected by save-slot handling. Root extension fields never opt compiled-only files into a look; explicit editor-context calls preserve Play/Edit parity even with other extension fields.

Move/copy/paste/Mirror/split/conversion preserve manual metadata; authored template copies retain editable source. Source edits rebase a retained preview onto current geometry without applying its look. No source geometry, collision, vehicle/physics, camera follow, Retry, START or coordinate limits change.

Gym Play now exposes the same **Terrain Look** button/menu. It opens the current level's source or built-in template copy without entering Edit or reloading the world. Live changes and Apply retain the vehicle, collision world, follow camera and Retry generation. Apply uses the existing source/Undo/autosave transaction; E opens the same copy, and the existing unplayed-draft recovery policy handles reload. Selected scope uses the retained Editor selection. No Play-mode geometry/selection tool was added. Opening a legacy menu leaves its renderer unchanged; explicitly adjusting controls previews a look, and Apply alone saves it. The menu is modal for input while normal physics continues with neutral controls. Close retains the live draft.

## Rendering and budgets

Cross-sections are fixed in world space. A manual section pins a default neighbor's shared cross-section; two manual (or default) sections share their mean at a source joint. Interpolation uses existing samples and shared chunk endpoints. Stored manual parameters remain independent; editing one of two unlocked manual sections can alter their common blend. Locked connected runs prevent indirect restyling. Physical run-end caps, UV phase and the z=0 driving edge retain the existing builder.

The layout stays **48 B/vertex**, including local styles: width uses existing visual depth, bounded bottoms use existing position/look-data, shading uses color/base-color. The same central shader projects actual depth with homogeneous interpolation. Level-only settings use uniforms; local source/style/floor changes regenerate affected baked sections. A floor change invalidates dependent bottoms. Ordinary camera motion does not sample source or rebuild the course. Dirty/cached local styles use conservative bounds covering width 2 m before materialization. Resource numbering advances across renderer changes, including delayed old/new deletion.

No pool or guard is raised. Mixed 660 m: 1,016 segments, 18,312 vertices, 17 all-visible/allocated Fit sections, zero cached at Fit, 878,976 B payload, 1,757,952 B replacement payload, estimated CPU working set 12,558,464 B, peak 34 meshes, 49 sprites, 7 labels, 137 charged instances including reserve and 1,066 physical vertices including hulls. Retained engine-VB ceiling remains 10,774,080 B. Limits stay 1 MiB payload, 16 MiB working estimate, Mesh 128, Sprite/Label/GameObject headroom and independent physics/source/compiler/START/coordinate constraints. GUI allocation stays 628/640 nodes in existing le6 measurements.

[Native memory observation](terrain-278/memory.txt) keeps two actual authored geometry generations after forced GC: 4,994,440 B six-anchor, 4,943,272 B long500, 4,929,600 B mixed500, 7,424,544 B long660. These are retained mesh-array deltas; the already constructed source/compiler descriptors and cached style map are outside that delta. They are below the working envelopes, not total-process/GPU memory or a causal memory-saving claim.

[Resource observations](terrain-278/resources.json), runtime `4697cf7`, Chromium 156.0.8078.4 / ANGLE SwiftShader, nonisolated wasm-web, 1280×720/DPR 1: four courses, five imports each plus three selected driving views (23 imports), 236 editor views and 11 drive/Retry snapshots. All terrain source objects alternate local width/depth/shading extremes. Every allowed setting retains the same topology/payload; native projection checks cover extrema and the authored curl/ribbon domain. No concurrent local automated browser/build ran during resource sampling.

| Course | Ready median / max (ms) | Steady callback p95 (ms) |
| --- | ---: | ---: |
| Six anchor | 77.3 / 83.6 | 5.4 |
| Long 500 m | 67.1 / 76.0 | 5.2 |
| Mixed 500 m | 73.5 / 77.6 | 5.5 |
| Mixed 660 m | 98.0 / 173.6 | 6.3 |

Steady windows are the last seven seconds of each eight-second drive (420 callbacks each). Largest sampled import callback was 84.1 ms; maximum published Play residency update while uploading was 17 ms. The 173.6 ms ready tail and earlier load/editor spikes remain **OPEN**. These samples do not isolate a causal projection cost or establish an FPS gain. Tracked live WebGL buffers at all-section 660 m Fit were 1,793,384 B including nonterrain/retained buffers; API sizes are not physical GPU residency.

The normal-Play adapter validates exact equality of the running chain samples before accepting a candidate's visual settings; an unplayed design with different geometry is refused with a request to Play it from the Editor first. The same section mappings, projector and resource ownership are reused. Global controls update uniforms; baked section changes dirty only sections whose local samples differ. Camera movement does not compile source or dirty meshes. Legacy layout switches use delayed retirement and monotonically named resources within the unchanged replacement budget. An independent menu-capture flag preserves any concurrent feedback/import capture.

## Verification

[Final debug menu results](terrain-278/menu-final.json), runtime `76c8783`, pass ten real-input workflows: all five numeric controls; preview isolation and Close/Reopen; input capture; Apply as one Undo action, Undo/Redo, acknowledged save/reload; selected styling with exact compiled collision export; locks/manual preservation; both scoped resets; short-window controls; Play/Retry; retained preview after real tangent edit/Undo; legacy conversion only on explicit Apply; future-format refusal preserving the world. The native source-context/protection and later Mirror fixes do not change the tested valid projection/parameter path.

[Final release menu results](terrain-278/release-menu-final.json), **`fb9c21f`**, use ordinary native pointer/text input, Export and IndexedDB reload with debug globals absent. They verify uncommitted Close/Reopen, explicit Apply, exact collision export, saved reload/menu restoration, Reset preview versus committed source, ordinary Play and same-generation Retry. The [actual applied export](terrain-278/applied-export.json) records the deliberate QA values. [Ordinary release QA](terrain-278/release-qa-final.json) also passes ten views, both 660 m courses, legacy course, crest/descent/jump/landing/valley, Editor save/export/reload, Retry and station switches. Viewport emulation is not physical phone evidence.

Native [authoring](terrain-278/native-authoring.txt), [projection](terrain-278/native-projection.txt), [session](terrain-278/native-session.txt), [compatibility](terrain-278/native-compatibility.txt) and [ownership](terrain-278/native-ownership.txt) checks pass using the actual compiler/builders. They cover geometry equality, version roundtrip, coherent bounds, floor invalidation, cached-style extent policy, protected connected transitions, manual boundary pinning, metadata-preserving Mirror/templates, future versions and root-extension isolation. Session/ownership tools simulate only their editor/resource adapter, not physics or device behavior. Source schemas and checks keep their actual limits.

Existing [le3](terrain-278/le3.json) all 15 and [le6](terrain-278/le6.json) all 14 cases pass on `76c8783`. Bootstrap check, 55 bootstrap tests, 79 Node CI/mobile, 39 G1 tooling, 8 G2 tooling and 31 Python CI tests pass. Pinned debug/release engine guards pass. Full CI/required passed 40323237671 at `9342db9`; final publication-head CI is tracked in PR #294. No tests/assertions, physics/reset/seam tolerances, pools or protection were weakened.

Earlier failed attempts are excluded from PASS evidence. Fixed real defects: delayed-resource name collision during legacy renderer conversion, short-window HTML controls obscuring Close, missing baked-floor invalidation and metadata preservation on prefab Mirror. Helper-only issues included modifier/frame ordering, querying coordinates before resize settled, and a selected-versus-level expectation in a native session test. The first Bob build exposed a static module cycle; source-only callback registration removed it without dynamic require tricks.

API references checked: official [GUI scene render order](https://defold.com/ref/gui/#gui.set_render_order) (stable 1.14.0, scene order 1 keeps the shared menu above the driving HUD), [GUI picking](https://defold.com/ref/gui/#gui.pick_node), [input consumption](https://defold.com/manuals/input/#consuming-input) and [shader interpolation](https://defold.com/manuals/shader/). Existing GUI helpers/pools and the editor's top input-stack owner are reused; the menu consumes actions. Existing pinned [mesh](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/gamesys/src/gamesys/components/comp_mesh.cpp) / [buffer](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/dlib/src/dlib/buffer.cpp) AABB/content-version assumptions remain, with actual zero terrain-VB upload checks during all-visible pan/Home. Summaries retain source/observer/raw-result hashes; full local results are in `artifacts/terrain-278`.

## Reproduction

```sh
node tools/gym/terrain_baseline.cjs --fixtures artifacts/terrain-278/native
.cache/g1/luajit -joff tools/terrain_perspective/check_authoring.lua artifacts/terrain-278/native
.cache/g1/luajit -joff tools/terrain_perspective/check_session.lua artifacts/terrain-278/native
.cache/g1/luajit -joff tools/terrain_perspective/measure_authoring.lua artifacts/terrain-278/native
python tools/gym/bundle.py --output artifacts/look-debug
node tools/terrain_perspective/check_menu.cjs artifacts/look-debug artifacts/look-menu
node tools/terrain_play/observe_resources.cjs artifacts/look-debug artifacts/look-resources --large --authored-look
python tools/gym/smoke.py --bundle artifacts/look-debug --output artifacts/look-le3 --case le3
python tools/gym/smoke.py --bundle artifacts/look-debug --output artifacts/look-le6 --case le6
```

Build ordinary release via existing `tools/g1/build.py` `build('wasm-web', output, settings, variant='release')`, exact SHA/run ID and no comparison flag; verify pinned engine output. Then prepare/serve with:

```sh
python tools/terrain_play/prepare_preview.py artifacts/look-release --perspective-profile --terrain-look
python -m http.server 8794 --bind 127.0.0.1 --directory artifacts/look-release/RiderG1
# Separate terminal; actual release SHA required:
node tools/terrain_perspective/check_menu_release.cjs http://127.0.0.1:8794 SOURCE_SHA artifacts/look-release-menu
```

## Limits and stop point

Loading peaks now reach 173.6 ms in this authored fixture run; existing editor peaks up to 115 ms remain open. Current menu/geometry editing is functionally verified, not a new comprehensive editor-latency benchmark. Hardware-GPU time/memory/draw calls, physical phone/touch/app-switch/thermal behavior and shader-buffer-retention concerns remain unmeasured/open. No FPS improvement or new human observation is claimed.

**STOP for Claudio's editor test.** PR #294 remains draft and is not merged automatically. Try Level/Selected, Close/Reopen, Apply/Reset, Save/Reload, Undo/Redo and driving. Decoration, weather and atmosphere remain outside this task.
