# Terrain perspective comparison (#290)

**Contents:** [Scope and preview](#scope-and-preview) · [Projection and resources](#projection-and-resources) · [Measurements](#measurements) · [Verification](#verification) · [Limits and stop point](#limits-and-stop-point) · [Engine sources](#engine-sources)

## Scope and preview

Claudio accepted #277; PR #289 was independently reviewed without credentials, passed exact-head required run 40248266439 and merged as `902e54e`. #290 is a gated comparison in draft PR #291. The playable release is http://127.0.0.1:8791/perspective.html. Choose Fixed Depth or Camera perspective in the surrounding panel. Both use the same source and parameter values. Five live sliders have editable numeric values; Apply retains settings locally, Reset restores accepted fixed Depth values, and Reapply saved restores the retained set. Copy JSON provides a versioned handoff for later consumers.

The actual tested runtime is `4e710d1b5f4d71ccf151f55616a26b701d4f38ec`, pinned Defold 1.14.0 engine `a81dbb0478e8b73931dc2d671563204f6ac0ef82`. Subsequent publication changes contain observer tools and evidence only. Ordinary builds retain the accepted renderer and admission. Prototype factory/material assets add fixed packaged overhead even in ordinary builds; the new rendering path requires explicit build configuration. No production look or preference has been adopted.

[Fixed screenshot](terrain-290/fixed.png) and [perspective screenshot](terrain-290/perspective.png) were captured from the served release at one paused vehicle/camera pose. [Jump screenshot](terrain-290/jump.png) records actual release play. These are browser observations, not a human visual acceptance.

## Projection and resources

The [road-look contract](contracts/road-look.md) defines bounded parameters, coordinate spaces, rejection and retention. A rigid shallow body is projected globally onto the unchanged collision plane. With camera XY `C`, extrusion coordinate `z`, `b=(0.18,tan(angle))` and `a=perspective/40`, projection is `(P+z*(a*C+b))/(1+a*z)`. Fixed mode uses `a=0`. The front contact contour at z=0 is explicitly preserved; homogeneous shader interpolation carries the denominator. There is no time, speed, direction, lag or previous-shape input. Actual camera follow, source, collision geometry, physics ownership and reset remain unchanged.

Width, angle, body depth and shading use cached uniforms. The accepted 64-interval partition/topology remains. Camera motion updates constants and conservative projected bounds without emitting geometry or uploading terrain vertex buffers. Bounds include all allowed body/ribbon extrema and use the existing viewport/residency logic. Existing floor and overhang caps remain.

The gated stream is 48 bytes/vertex (normal 36). Budget calculations use that actual stride and a larger CPU estimate; no pool or cap was increased. Payload limit remains 1 MiB, CPU working estimate 16 MiB, and mesh capacity 128. Active, cached, all-visible Fit and overlapping replacement generations are charged separately from sprites, labels, GameObjects and physics. Source/compiler/START/coordinate limits remain independent.

The 660 m mixed course has 1,016 segments, 18,312 vertices, 17 sections, payload 878,976 B, replacement payload 1,757,952 B, estimated CPU working set 12,558,464 B, peak 34 mesh instances and 1,066 physical vertices including hulls. Its snapshot charges 49 sprites, 7 labels and 137 instances including reserve 64. Fit actually allocated/enabled all 17 sections with zero cached. The conservative retained engine-VB ceiling is 10,774,080 B (129 retained slots × 1,740 vertices × 48 B), not a measured physical GPU allocation. Terrain upload count stayed 17→17 through controls, mode toggles, pan and Home.

The native payload boundary accepts 1,212 prototype segments and refuses 1,213. Normal admission still accepts that input and keeps its previous 1,521 boundary. A real 1,521-segment import was safely refused by the prototype payload guard with the existing world retained. Guards name the violated budget and corrective action.

## Measurements

Checked summaries retain raw result hashes and the exact observer hash: [debug](terrain-290/debug-final-observation.json), [release](terrain-290/release-observation.json), [hosted pair](terrain-290/hosted-final.json). Large debug editor/mesh objects, pointer traces and buffer inventories are omitted from these summaries; raw local results remain under `artifacts/terrain-290`. Screenshots are unmodified.

Chromium 156.0.8078.4, ANGLE SwiftShader, non-isolated wasm-web, parent viewport 1280×900 (game height 739 px). Each full variant uses four courses × two modes, three imports per trial, one second warmup and five seconds driving. No other automated browser/build ran during accepted timing collection. Both modes use the same 48-byte comparison layout; this does not measure production overhead or establish a causal performance difference. Fixed was sampled before perspective; natural browser GC was not controlled.

Debug median ready times and steady callback p95 in milliseconds:

| Course | Fixed ready | Perspective ready | Fixed callback p95 | Perspective callback p95 |
| --- | ---: | ---: | ---: | ---: |
| Six anchor | 56.8 | 62.8 | 4.8 | 4.9 |
| Long 500 m | 60.0 | 62.5 | 5.0 | 4.7 |
| Mixed 500 m | 60.3 | 60.6 | 4.8 | 5.2 |
| Mixed 660 m | 75.5 | 63.9 | 5.7 | 5.4 |

Frame-interval p95 was 16.8 ms in these trials. Import ready maxima reached 88.6 ms. During sampled driving the six-anchor trial activated a section once per mode (11.3/7.2 ms callback); other courses had no activation in that short window. Initial activation remains in import measurements. GUI buffer writes continued normally; the zero-upload claim concerns terrain vertex buffers only. Total live tracked WebGL buffers at all-section Fit were 1,786,920 B, including nonterrain buffers. These are WebGL API allocation sizes, not GPU physical residency. The 256 MiB Wasm reserved capacity is not per-course used memory.

[Native retained allocation evidence](terrain-290/memory-retained.txt) constructs and keeps two full editor geometry generations, forces GC before and after construction, and measures actual live Lua allocation. Normal→comparison: six-anchor 4,228,600→4,994,440 B; long500 and mixed500 4,381,672→5,193,704 B; long660 6,508,024→7,688,648 B. Corresponding policy estimates remain higher. This measures neither process nor GPU memory; natural-GC high-water observations are not interpreted as exact incremental overhead.

## Verification

Pinned debug and release bundles pass engine guards and complete observer runs. Debug verifies projected coverage at maximum settings across 1920×540, 720×1280 and 1280×900, all numeric controls plus real range input, mode changes, pan/Home, exact source restoration after actual tangent edit/Undo, acknowledged save, Apply/Reset/Reapply/reload, invalid parameter rejection, and safe oversized refusal. Six actual START views cover crest, descent, jump, landing, valley and reverse, followed by Retry. Release verifies playable imports, modes, controls/retention, six views and Retry, with debug inspection globals absent. Hosted screenshots verify paused pose and generation equality across modes.

[Native checks](terrain-290/native-final.txt) cover front-plane equality, every emitted vertex against projected bounds at extreme settings/cameras, memoryless reverse/return evaluation, ribbons, parameter validation and independent budget boundaries. Existing editor ownership checks, bootstrap (55 tests), Node CI/mobile (79), G1 tools (39), G2 tools (8) and Python CI (31) passed. Normal full CI/required passed run 40251701685 on runtime `4e710d1`; final publication-head CI is linked in the PR.

Earlier observer pilots exposed duplicate HTML IDs, existing editor refocus click suppression, and an invalid oracle requiring screen-space pan/Home to return camera coordinates within 0.01 mm. The helper now uses unique IDs, waits the existing focus guard and compares unchanged camera state directly across mode toggles; native math checks exact same-pose determinism. An initial hosted helper incorrectly awaited telemetry advancement during pause; it now reads the existing public pause state. These failed pilots are not PASS evidence. No physics/reset/seam tolerance was changed.

Reproduction (empty build outputs; pinned repository environment):

```sh
python tools/terrain_perspective/build.py --output artifacts/look-debug
python tools/terrain_perspective/build.py --release --output artifacts/look-release
python tools/terrain_perspective/prepare_preview.py artifacts/look-debug --output artifacts/look-launcher
node tools/terrain_perspective/observe.cjs artifacts/look-debug artifacts/look-launcher artifacts/look-debug-results
node tools/terrain_perspective/observe.cjs artifacts/look-release artifacts/look-launcher artifacts/look-release-results
python tools/terrain_perspective/prepare_preview.py artifacts/look-release
python -m http.server 8791 --bind 127.0.0.1 --directory artifacts/look-release/RiderG1
# Separate terminal; use the actual bundle source SHA:
node tools/terrain_perspective/verify_hosted.cjs http://127.0.0.1:8791/perspective.html SOURCE_SHA artifacts/look-hosted
```

Keep the launcher external during immutable bundle inventory checks; adding it into the bundle afterward is intentional final preview preparation. Native checks use the pinned LuaJIT with `-joff`, generated P0 fixtures and `tools/terrain_perspective/check_projection.lua` / `measure_memory.lua`.

## Limits and stop point

Existing #277 load/editor spikes up to 115 ms remain OPEN. Current editing is functionally verified, not a new editor latency benchmark. Shader-constant retention is bounded by the existing engine behavior and remains an open measurement concern. No hardware-GPU timing/memory, draw-call comparison, phone/touch/app-switch or device thermal evidence exists. No FPS gain is claimed.

Stop here for Claudio’s visual selection and fine tuning. Live settings and copied JSON do not authorize production adoption or automatically change another consumer. #278 has no GO. No physics or automatic START/coordinate-limit changes were made.

## Engine sources

New API use was checked against official [material constants](https://defold.com/manuals/material/), [go.set](https://defold.com/ref/go/#go.set), [shader](https://defold.com/manuals/shader/) and [HTML5](https://defold.com/ref/html5/) documentation. Style delivery is bounded and avoids source interpolation.

Pinned [mesh component source](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/gamesys/src/gamesys/components/comp_mesh.cpp) reads AABB metadata for visibility and separately checks buffer content versions for vertex uploads. Pinned [buffer source](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/dlib/src/dlib/buffer.cpp) updates existing metadata without advancing the content version. Consequently 24-byte AABB metadata updates can refresh engine culling without a terrain vertex-buffer upload; the browser probe verifies that consequence on the pinned engine.
