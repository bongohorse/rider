# Terrain P2: Depth mesh sections in normal Play

[#274](https://github.com/bongohorse/rider/issues/274), after Claudio's visual acceptance of Depth in #273. This integrates the chosen treatment in ordinary Play. Editor meshes, custom culling/streaming and budget migration remain later tasks. Stop for Claudio's same-course drive test.

**Contents:** [Behavior and scope](#behavior-and-scope) · [Geometry and ownership](#geometry-and-ownership) · [HTML5 comparison](#html5-comparison) · [Resource lifetime evidence](#resource-lifetime-evidence) · [Verification and preview](#verification-and-preview) · [Engine sources and reproduction](#engine-sources-and-reproduction)

## Behavior and scope

The ordinary Play owner still builds collision through unchanged `stations.build` first. It then derives depth mesh sections from those same chains and draws the existing hull outlines, labels, markers, checkerboard and FINISH through the original decorator. Terrain no longer allocates one line Sprite/GameObject per sample. Physics, vehicle, camera, normal input, section/preset switching and in-world Retry are unchanged. Edit still uses its existing sprite view and GUI; Edit→Play re-enters the normal mesh path.

`game.project`, station validator, source/compiler, exports and saved-document formats are unchanged. Runtime visual geometry has an internal version 1, never written into documents; there is no format migration. The unchanged conservative 800-object guard continues to charge sampled intervals, even though their actual Play resources are now different. The rejected larger P0 source remains rejected. No pool, source, compiler, physics or coordinate limits were increased.

The isolated P1 comparison remains available through its existing separate build. Ordinary Play uses Depth without a feature flag. Both use the accepted material/shaders and mesh prototype from `main/terrain_compare`; no duplicate art or shader implementation was introduced. Only the normal geometry/ownership adapters are new.

## Geometry and ownership

Sections contain at most 64 intervals (11 / 12 / 12 on the P0 routes); this is provisional, not an optimum. A stable key identifies the original run index and its interval range; resource paths additionally include the loader's world generation. Shared endpoints, arc-length U and whole-run joins match at section boundaries. Disconnected runs stay separate, including the seven-metre gap. Hull boundaries and route identities are untouched.

For ordinary x-monotone terrain, front body, 0.18 m edge, projected 0.9 m top/depth and finite original lower safety bound match the accepted P1 output. Vertical intervals are supported. General non-monotone/curl routes retain the exact authored driving edge but use a bounded 0.9 m ribbon body with shared, capped normal joins: filling vertically below an overhang would paint across its opening. This compatibility treatment changes visuals only; two-sided and original physical chain orientations are untouched. Separate authored runs may overlap as before; this is not a new solid-region modeller.

Vertex positions and local XY origins are in metres, converted once at the visual boundary to engine units. Colors/UV are unscaled. The accepted local-space material projects encoded depth into XY and flattens render Z; terrain stays at layer −2 behind unchanged vehicle artwork. Projected bounds include the same float margin. Normal engine bounds/render behavior remains; no new visibility, culling or pooling policy is implemented. Every section stays resident until the proxied world is unloaded.

The unchanged 800-segment / 32-run domain needs at most 44 sections, within the engine's unchanged default 128 mesh components. Position3/color4/UV2 use 36 bytes/vertex. Runtime resources belong to the Play owner; each mesh retains its own buffer reference. Retry neither rebuilds nor releases them. On unload the owner releases its dynamic references and Defold destroys components/world references; temporary Lua wrappers are collected normally. Failed partial creation/binding deletes generated GOs and releases acquired references, with idempotent cleanup. No simulation handles live in the renderer or module state.

The shared immutable terrain material is retained by a `resource.material` property on the loader for application lifetime. It is shared across worlds, not repeatedly destroyed/recompiled. This avoids a measured pinned-OpenGL shader-buffer retention problem described below; it is not a terrain cache or streaming system.

## HTML5 comparison

[Measurements and hashes](terrain-p2/measurements.json), final runtime `8c85cdd3b15efc5f196ac3a1ada6f007d945c0a5`. Same P0 fixtures and normal import/Edit/Play protocol: five warm import observations after one initial import, five Edit→Play→Edit/Retry cycles per route, six-second driving window after one-second warm-up, 1280×720 DPR 1, default preset A/struts, 60 Hz physics at factor 1. Chromium 156 with ANGLE SwiftShader; no build or other browser suite overlapped the performance run. All three re-exported source/compiled documents equal the accepted P0 documents.

| Course | Live sprites before → after | World GOs before → after (derived) | Meshes | Depth vertex payload | World shapes |
| --- | --- | --- | --- | --- | --- |
| six-anchor | 673 → 7 | 678 → 23 | 11 | 12,000 vertices / 421.9 KiB | 670 |
| long-curves | 703 → 7 | 708 → 24 | 12 | 12,552 vertices / 441.3 KiB | 700 |
| mixed | 751 → 55 | 762 → 78 | 12 | 12,552 vertices / 441.3 KiB | 712 |

Live counts include the same four vehicle/two strut sprites; mixed retains 12 hull outlines and six labels. GO counts derive from four static objects plus observed sprite/label/mesh creation, not an engine-wide census. Generated vertex bytes exclude headers, temporary CPU arrays, driver copies and shared template/material. WASM capacity is 256 MiB, not used memory. Box2D bytes and Lua heap observations are separate in the JSON.

| Course | Warm import median before → after ms | Drive interval p95 / max before → after ms | Main callback p95 / max after ms | WebGL calls p50 / max after |
| --- | --- | --- | --- | --- |
| six-anchor | 63.1 → 93.2 | 17.1 / 33.4 → 17.0 / 33.0 | 4.9 / 6.4 | 22 / 23 |
| long-curves | 54.7 → 94.4 | 16.9 / 34.1 → 17.0 / 33.3 | 4.9 / 7.2 | 22 / 22 |
| mixed | 61.1 → 95.7 | 17.0 / 17.6 → 17.0 / 33.3 | 5.0 / 6.4 | 22 / 22 |

P0 before source is `75a9a3d`; these are separate observations, not a statistical speed ranking. Additional WebGL call instrumentation is present after, so main-callback comparisons also include observer differences. Calls include GUI, sprites, labels and meshes; they are neither isolated terrain draws nor GPU time. Short driving windows cover the start area, not an entire course. The local run has occasional 33 ms spikes and establishes **no FPS improvement**. Physics p95 remains 0.1–0.2 ms in these observations.

Allocation reduction is established, with a load-time trade-off: CPU triangle expansion and buffer population cost more than line decoration. Warm import medians rose about 30–40 ms. The full data keeps construction, import, Edit→Play, drag and frame costs separate. The editor still compiles/draws its original source view; this task does not solve its responsiveness or remove its conservative admission guard.

## Resource lifetime evidence

Eight same-course loads compare the real new renderer with the retained original normal-Play bundle `c11971a` (flag absent), with exact bundle manifests/source identity checked. [Final mesh run](terrain-p2/lifecycle-final.json), [original reference](terrain-p2/lifecycle-reference-2.json), [pre-fix mesh diagnosis](terrain-p2/lifecycle-mesh-2.json).

Each final load retains exactly one current terrain VB payload set: nine 41,472-byte buffers, one 41,688-byte buffer and one 17,064-byte buffer (432,000 bytes total), with no growth across loads. Explicit adapter-owned references remain 11; acquired/released counts balance across every world replacement. Repeated Retry and Edit/Play/import switches retain stable counts. These are WebGL upload/handle observations, not a claim of physical GPU memory usage.

The first integration candidate also accumulated an extra 64-byte WebGL buffer on each world replacement, alongside the original renderer's existing one 16-byte and one 64-byte increase. Pinning only the shared terrain material to loader lifetime removes that additional growth. This controlled observation is consistent with the pinned OpenGL program teardown: it deletes scratch block memory but omits the buffer deletion performed by its reload path. The current baseline's small per-world shader-buffer retention remains an existing engine limitation, explicitly open; this task does not patch the engine or claim total-process leak freedom. Mesh vertex resources and the added shared material do not add per-switch growth.

The lifecycle checker enforces stable terrain VB payloads and no extra small-buffer growth over the existing reference. Initial histogram instrumentation mistook the full WASM typed-array capacity for an upload size; the corrected check accounts for WebGL2 source offset/length overloads. Those failed diagnostic attempts are not accepted passes. Partial create/bind fault injection additionally checks the actual Lua adapter's release balance and idempotent final at a simulated engine boundary; it is not evidence of device behavior.

## Verification and preview

Focused native geometry checks cover 22 routes, including every built-in station, P0 fixture equality with P1, vertical and non-monotone/curl compatibility, multi-section body/edge/top seams and UVs, deterministic identities, hull-only/32-run/800-segment cases, deep immutable source/collision data and the original larger-source rejection. The 800-segment route uses 13 meshes and 518,832 bytes. In the existing le6 runtime regression, Edit stays at 804 sprites / 628 GUI nodes; Play uses 6 live sprites / 13 meshes; replay uses 10 sprites with unchanged mesh allocation.

Pinned debug builds/engine guards, bootstrap/tool checks and ordinary a6, le2, le3, le5b, le6 and a22 pass (initial integrated runtime `e3debec`; material-lifetime correction is separately exercised by the lifecycle guard, le2 (19 cases) and a22 (7 cases) on final runtime). Existing assertions and physics/seam/reset tolerances remain. Final ordinary release `8c85cdd` passes both Wasm engine guards and [release interaction QA](terrain-p2/release-check.json): seven course/START views, exact source identity, unchanged shapes, no debug inspection globals, throttle/Retry, normal editor entry/return, and real keyboard A→B→A station changes, without observed runtime errors. 1280×720, 1280×480 and 390×844 browser viewports were captured. Exact-head full CI is tracked in the PR; neither evidence is inferred from the isolated P1 build.

Actual normal-Play captures: [descent](terrain-p2/camera-descent.png), [airborne gap](terrain-p2/camera-jump.png), [reverse](terrain-p2/camera-reverse.png), [mixed course](terrain-p2/mixed-drive.png). Release launcher captures: [landing](terrain-p2/release-long-curves-landing.png), [portrait aspect](terrain-p2/release-portrait.png). No generated or edited screenshots. Human #274 same-course seam/descent/jump/Retry acceptance is pending Claudio's drive test. Physical Xiaomi Mi 10T Pro, GPU time and GPU memory evidence remain **unmeasured / NOT RUN**.

The delivered local release preview includes the ordinary Gym and an artifact-only launcher `terrain-preview.html`. The launcher imports the saved P0 fixtures through the existing release import interface; optional START variants modify both source START and compiled spawn consistently, without a new editor or physics/camera path. The launcher is not packaged into the game or installed into normal Play. Direct local preview: http://127.0.0.1:8785/terrain-preview.html?course=long-curves&view=start ; ordinary Gym: http://127.0.0.1:8785/index.html?station=straight . A launcher-only issue waiting for an import dialog on a saved-level restore was corrected; readiness now requires the newly imported world generation. No public Pages deployment is claimed for this unmerged PR.

## Engine sources and reproduction

Pinned Defold 1.14.0 `a81dbb0478e8b73931dc2d671563204f6ac0ef82`, integrated Box2D 3.1.0:

- [Resource declarations/material](https://defold.com/ref/resource/#resource.material) and [resource management](https://defold.com/manuals/resource/): explicit loader-lifetime reference for the immutable shared material.
- [Buffer API](https://defold.com/ref/buffer/), [runtime mesh buffers/local space](https://defold.com/manuals/mesh/), [dynamic buffer ownership](https://defold.com/ref/resource/#resource.create_buffer), [release](https://defold.com/ref/resource/#resource.release). Same accepted P1 buffer layout, property binding and projected bounds.
- Pinned [mesh buffer/property/world cleanup](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/gamesys/src/gamesys/components/comp_mesh.cpp#L263), [resource transfer/reference handling](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/gamesys/src/gamesys/scripts/script_resource.cpp#L3017), [OpenGL shader teardown](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/graphics/src/opengl/graphics_opengl.cpp#L4381) and [reload deletion](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/graphics/src/opengl/graphics_opengl.cpp#L4362). Mesh capacity stays at the default 128; distinct buffers still split batch keys.

```sh
python tools/gym/bundle.py --output artifacts/terrain-p2/debug
node tools/gym/terrain_baseline.cjs --fixtures artifacts/terrain-p2/native-inputs
python - <<'PYINPUT'
import json
from pathlib import Path
def lua(v):
    if isinstance(v, list): return '{' + ','.join(map(lua, v)) + '}'
    if isinstance(v, dict): return '{' + ','.join('['+json.dumps(k)+']='+lua(x) for k,x in v.items()) + '}'
    if isinstance(v, bool): return 'true' if v else 'false'
    return 'nil' if v is None else json.dumps(v, ensure_ascii=False)
for p in Path('main/gym/stations').glob('*.json'):
    Path('artifacts/terrain-p2/native-inputs', p.stem+'-compiled.lua').write_text('return '+lua(json.loads(p.read_text()))+'\n')
PYINPUT
<verified-locked-bob-luajit> -joff tools/terrain_play/check_geometry.lua artifacts/terrain-p2/native-inputs
<verified-locked-bob-luajit> -joff tools/terrain_play/check_ownership.lua
timeout 120s node tools/terrain_play/check_lifecycle.cjs artifacts/terrain-p2/debug artifacts/terrain-p2/lifecycle mesh
timeout 260s node tools/gym/terrain_baseline.cjs artifacts/terrain-p2/debug artifacts/terrain-p2/measure --mesh
python tools/terrain_play/prepare_preview.py <ordinary-release-bundle>
python -m http.server 8785 --bind 127.0.0.1 --directory <ordinary-release-bundle>/RiderG1
timeout 240s node tools/terrain_play/verify_preview.cjs http://127.0.0.1:8785 artifacts/terrain-p2/release-check <release-source-sha>
```

Use the standard pinned release builder with empty HTML5 native dependencies and exact `rider.source_sha`; do not set the P1 comparison flag. Stop for Claudio's #274 drive test; no later-task GO is implied.
