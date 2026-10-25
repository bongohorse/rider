# Terrain P1: isolated flat/depth mesh comparison

[#273](https://github.com/bongohorse/rider/issues/273), following accepted [P0](TERRAIN_P0_REPORT.md). This is a visual experiment, not normal Play/editor integration. Claudio's visual choice is pending; #274 has no GO.

**Contents:** [Preview and scope](#preview-and-scope) · [Geometry and ownership](#geometry-and-ownership) · [Measurements](#measurements) · [Verification and limits](#verification-and-limits) · [Engine evidence and reproduction](#engine-evidence-and-reproduction)

## Preview and scope

The separate release build offers **Flat fill**, **Top + edge + depth**, and the unchanged **Original lines** reference. Select the six-anchor course, diverse 500 m course or mixed-content course from P0. Additional ordinary START variants expose tight bends, climb, crest, descent, gap jump, landing, wide valley and reverse without editing the route or the gameplay camera. Switching variant/view reloads the isolated page; R retains canonical in-world Retry.

Use the directly served release preview links supplied with the PR/delivery. For a local reproduction, build the separate bundle below and serve its `RiderG1/` directory on loopback; for example `python -m http.server 8784 --bind 127.0.0.1 --directory <bundle>/RiderG1`. Then compare:

- `http://127.0.0.1:8784/index.html?course=long-curves&look=flat&view=crest`
- `http://127.0.0.1:8784/index.html?course=long-curves&look=depth&view=crest`
- `http://127.0.0.1:8784/index.html?course=long-curves&look=sprites&view=crest`

These are local preview URLs, not a claim of public Pages deployment. English controls explain driving and restart behavior. Editing/import into normal saved levels is disabled in this comparison; the normal build still has its original editor/renderer. The isolated build flag is set only by `tools/terrain_compare/build.py`, which selects a separate boot/world collection and its mesh factory. Normal URL parameters cannot select this path in the ordinary build. Small explicit gates in the shared loader, owner and GUI select the experiment only with that build flag; there is no production terrain pipeline adoption.

All three compiled course resources are byte-for-byte copies of P0 exports. The original validator still runs, including the 800 estimate; source/compiler/physics limits, fixed step/substeps, physics bodies, vehicle artwork, layer offsets, preset A and camera remain unchanged. This experiment does not make the rejected 660 m source playable. The benchmark course is not a promise that preset A clears every obstacle; the landing/valley STARTs make the far side directly inspectable without changing its gap or physics.

## Geometry and ownership

`geometry.lua` reads copies of the source chains for visuals only. The unchanged `stations.build` constructs the actual collision first. Only a shallow decoration copy omits the old terrain strokes; hull outlines, labels and FINISH retain their original drawing. The approved routes are open and x-monotone; other terrain domains are explicitly outside this prototype.

Flat fill uses a filled front body and narrow surface edge. Depth stores a shallow 0.9 m width in vertex Z, projects it by `(0.18, 0.55)` into XY, and draws a top band, 0.18 m front edge and end caps at physical run ends. Body fill ends at the original finite lower safety bound. The shader flattens visual Z back onto the terrain's render plane; it does not rotate or change the orthographic gameplay camera. This is a projected shallow mesh, not a perspective-world experiment. Per-face colors and a faint four-metre UV reference are study materials, not production art.

Source data stays in metres. Each chunk has a local X origin; the render adapter converts its vertex positions and origin once by the existing physics scale (100 engine units/metre). The material uses local vertex space and the existing world-view-projection matrix. The same arc-length U coordinates and endpoint vertices are shared across chunk joins; runs remain separate across the seven-metre gap. Caps occur only at physical run ends, not chunk boundaries. Triangle lists have position3/color4/UV2 float streams (36 bytes/vertex), with no index buffer. No stream exceeds 2,316 vertices in the exercised chunk sizes.

Default chunks contain at most 64 intervals: **11** chunks for six anchors and **12** for the two-run course/mixed course. The extra partial chunk at the gap is deliberate. At 128 intervals, the mixed course uses **7**, with the same total vertices and buffer bytes. Focused checks also cover 32 intervals (up to 23 chunks). This is not an optimal-size claim. The local experiment bounds allocations to 24 components within the unchanged engine default of 128 meshes; no configured pool or station admission limit increased.

The mesh material uses the existing `tile` pass, terrain GO layer −2 and the original vehicle layers. Projected AABB metadata includes shader XY offsets and a small float32 margin; ordinary engine frustum behavior can discard draws. All chunks remain allocated: no active/cached pool, streaming or custom visibility system was added. Local-space buffers have independent engine batch keys, so fewer GOs do not imply fewer draw calls everywhere.

Each proxied owner instance retains its generated resource hashes. Buffers transfer to newly created resources; mesh components acquire their resource references through the `vertices` property. Retry neither reconstructs nor releases them. Owner final releases its own dynamic-resource references; Defold subsequently destroys mesh components/world references. There is no simulation handle in a visual chunk and no per-frame mesh rebuild. Temporary CPU arrays and buffer wrappers are eligible for ordinary GC; reported buffer bytes exclude headers, the shared template buffer and GPU/driver copies.

## Measurements

Detailed statistics and hashes: [measurements.json](terrain-p1/measurements.json). Runtime measurement build is `c11971ad0521f790e23bd4781208b674e819f508`; subsequent extra view selectors do not change its geometry, renderer, shaders or collision resources. Release preview/QA source is `07c6f9267a8ed98578b609d37babf0cc2c397a91`; later report/status evidence commits do not change the runtime files. [Release check](terrain-p1/release-check.json) records the source, engine guard and actual button navigation.

Nine local debug HTML5 cases use the same isolated entry/UI and physical courses, alternating reference/new order. One second warm-up, six seconds full throttle, preset A/default struts, 1280×720 DPR 1, non-isolated Chromium 156.0.8078.4 with ANGLE SwiftShader. Nearest-rank quantiles, natural GC. This is one drive window per cell, not a statistical speed ranking or long-duration/full-course test. The P0 import/Edit protocol is not silently equated with separate-page loading here.

| Course | Original live sprites / world GOs | Flat/depth live sprites / world GOs | Meshes | Flat / depth vertices | Flat / depth payload KiB |
| --- | --- | --- | --- | --- | --- |
| six-anchor | 673 / 678 | 7 / 23 | 11 | 7992 / 12000 | 281.0 / 421.9 |
| long-curves | 703 / 708 | 7 / 24 | 12 | 8352 / 12552 | 293.6 / 441.3 |
| mixed | 751 / 762 | 55 / 78 | 12 | 8352 / 12552 | 293.6 / 441.3 |

Live totals include the original four vehicle sprites and two struts; GO totals are source-derived (four static world objects, sprite/label owners and observed created mesh objects), not an engine-wide enumeration. The reference uses the original station decorator in the same comparison scene.


Six-anchor and long/mixed physical world shapes remain 670 / 700 / 712 across all three renderers. Three Retries per cell preserve world generation, world-load count and renderer allocation metadata. The vertex expansion costs approximately 281–294 KiB for flat and 422–441 KiB for depth, independent of hull/label instances. These are generated vertex payloads, not total CPU/GPU memory. WASM linear capacity stays 256 MiB; Box2D/Lua snapshots remain separately identified in the JSON.

| Course / treatment | Interval p50 / p95 / max ms | Main-thread callback p95 / max ms | Total WebGL calls p50 / max | Physics p95 / max ms |
| --- | --- | --- | --- | --- |
| six-anchor / sprites | 16.7 / 16.9 / 33.3 | 5.2 / 7.4 | 22 / 22 | 0.1 / 0.2 |
| six-anchor / flat | 16.7 / 16.9 / 33.5 | 4.9 / 7.0 | 21 / 22 | 0.1 / 0.2 |
| six-anchor / depth | 16.7 / 16.8 / 17.6 | 4.8 / 7.5 | 21 / 22 | 0.1 / 0.2 |
| long-curves / sprites | 16.7 / 16.9 / 33.2 | 5.2 / 8.0 | 22 / 22 | 0.1 / 0.2 |
| long-curves / flat | 16.7 / 17.0 / 33.3 | 5.3 / 8.3 | 21 / 21 | 0.2 / 0.4 |
| long-curves / depth | 16.7 / 16.9 / 33.3 | 4.9 / 8.5 | 21 / 21 | 0.1 / 0.2 |
| mixed / sprites | 16.7 / 17.0 / 33.2 | 5.4 / 8.0 | 21 / 21 | 0.1 / 0.2 |
| mixed / flat | 16.7 / 16.9 / 33.9 | 5.3 / 6.7 | 21 / 21 | 0.2 / 0.2 |
| mixed / depth | 16.7 / 16.9 / 33.4 | 5.5 / 6.9 | 21 / 21 | 0.2 / 0.3 |


Construction is a single Lua-clock observation per cell, quantized to whole milliseconds: about **8–10 ms** for original decoration, **31–34 ms** flat, **46–50 ms** depth. The prototype's CPU triangle expansion and buffer writes cost more at load time. Allocation reduction is established; no steady-frame speedup, optimal chunk size or production loading solution is claimed.

WebGL counts observe actual JavaScript draw entry calls, including GUI/vehicle/labels and any instanced calls, using the same instrumentation for all variants. They are not GPU duration or isolated terrain draw calls. In these short start-area windows totals stay around 21–22 calls/frame. The engine source confirms that separate buffer names split mesh batch keys; a camera showing more chunks can increase submission count. No GPU-duration extension was available in this software-rendered run. GPU memory, hardware GPU timing and Xiaomi Mi 10T Pro behavior remain **unmeasured / NOT RUN**.

## Verification and limits

The local measurement completes all nine cases, 27 canonical Retries, ten difficult flat/depth captures (tight bends, crest, descent, airborne gap and reverse), portrait aspect checks and a 128-interval resource check, with no observed script/resource/GO errors. Snapshots are actual runtime captures. Release interaction QA PASS: five actual variant-button navigations, climb/landing/valley selectors, canonical R Retry, blocked Edit and throttle input, with no observed runtime errors. Both bundled Wasm variants passed the pinned engine provenance guard. Release has no debug editor/world inspection globals. Observed click-to-telemetry-ready upper bounds were 1.185–1.296 s on a warm local browser (includes navigation/download/startup, not first GPU presentation or P0 Edit→Play). The checker does not claim physical-device input. Inspected examples:

| View | Flat | Top/edge/depth |
| --- | --- | --- |
| crest | [Capture](terrain-p1/view-crest-flat.png) | [Capture](terrain-p1/view-crest-depth.png) |
| descent | [Capture](terrain-p1/view-descent-flat.png) | [Capture](terrain-p1/view-descent-depth.png) |
| jump | [Capture](terrain-p1/view-jump-flat.png) | [Capture](terrain-p1/view-jump-depth.png) |
| Portrait aspect | [Capture](terrain-p1/portrait-flat.png) | [Capture](terrain-p1/portrait-depth.png) |


The focused pure-Lua check runs 18 fixture/variant/chunk-size combinations against the actual editor compiler output. It checks immutable source/collision input, exact interval coverage and seam indices/U coordinates, buffer sizes, projected bounds and absence of triangles spanning disconnected runs; the larger source still fails the original 800 guard. These checks and inspected views found no chunk cracks or unwanted fill across the gap. Human landing readability, perceived depth, surface width and comfort are pending Claudio's visual feedback.

Normal-path regressions use the ordinary boot with the flag absent: a6, le2, le5b, le6 and a22, plus bootstrap/tooling checks. They retain their original assertions, sampling, physics tolerances and budgets. Full CI and current-head evidence are linked in the PR. No independent physical-phone or full-course completion claim is made. This is an isolated static-mesh experiment; editor preview, resource-specific production admission, lifecycle streaming and integration remain later tasks.

## Engine evidence and reproduction

Checked against pinned Defold 1.14.0 `a81dbb0478e8b73931dc2d671563204f6ac0ef82`, integrated Box2D 3.1.0:

- [Buffer API](https://defold.com/ref/buffer/): typed streams and six-float AABB metadata. [Mesh manual](https://defold.com/manuals/mesh/): runtime buffers, local space and metadata-driven culling. Consequence: explicitly populate position/color/UV and projected bounds; default automatic bounds are insufficient for the shader encoding.
- [Resource API](https://defold.com/ref/resource/#resource.create_buffer): ownership transfer and runtime resource names; [release](https://defold.com/ref/resource/#resource.release) requires correct ownership. [Pinned resource implementation](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/gamesys/src/gamesys/scripts/script_resource.cpp#L3017) and [mesh property handling](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/gamesys/src/gamesys/components/comp_mesh.cpp#L1013) establish the component/dynamic-resource references used here.
- [Pinned mesh implementation](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/gamesys/src/gamesys/components/comp_mesh.cpp#L344): resource-specific batch keys; [AABB handling](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/gamesys/src/gamesys/components/comp_mesh.cpp#L819) transforms the supplied bounds. The same file defaults mesh capacity to 128. The locked Bob's built-in default render script was inspected for tile pass, depth-mask and camera behavior.

These sources are API/source evidence; the local HTML5 builds and runtime checks establish the exercised support. They do not establish Android or hardware-GPU performance.

```sh
python tools/terrain_compare/build.py --configuration debug --output artifacts/terrain-p1/debug
# One process at a time; do not overlap profiling with builds/tests.
timeout 420s node tools/terrain_compare/measure.cjs artifacts/terrain-p1/debug artifacts/terrain-p1/measure
node tools/gym/terrain_baseline.cjs --fixtures artifacts/terrain-p1/sources
# Use the SHA-verified locked Bob's LuaJIT executable as in P0, JIT disabled:
<verified-luajit> -joff tools/terrain_compare/check_geometry.lua artifacts/terrain-p1/sources
python tools/terrain_compare/build.py --configuration release --output artifacts/terrain-p1/release
node tools/terrain_compare/verify_release.cjs artifacts/terrain-p1/release artifacts/terrain-p1/release-check
```

A release preview is served only after the pinned engine guard and release runtime checks pass. Stop for Claudio's visual choice; no #274 work is authorized.
