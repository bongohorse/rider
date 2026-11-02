# Terrain P3: retained editor mesh preview

[#275](https://github.com/bongohorse/rider/issues/275), after Claudio accepted #274. Normal Play and admitted Edit previews share the production Depth section builder. Stop for Claudio's editor test. Culling and resource-budget migration remain #276/#277, without GO.

**Contents:** [Behavior and boundaries](#behavior-and-boundaries) · [Dependencies and reuse](#dependencies-and-reuse) · [Ownership and rendering](#ownership-and-rendering) · [Measured editor behavior](#measured-editor-behavior) · [Verification](#verification) · [Preview and reproduction](#preview-and-reproduction) · [Engine evidence and open performance points](#engine-evidence-and-open-performance-points)

## Behavior and boundaries

Source objects, anchors/tangents, connections, selection, hide/lock, Undo/Redo and storage remain authoritative and unchanged. The physics-free Edit world now draws the chosen Depth terrain, retaining existing source markers, hull outlines, labels, handles and GUI. Current-document structural edits, including sample-count changes, update render products in place. Document-instance changes and Edit↔Play retain the loader/proxy lifecycle; Retry remains the existing in-world Play reset.

No compiler/sampling, source/export/version, collision, physics, camera, feel or configured limit changes. Runtime visual resources are not persisted. Normal Play retains its original section partition and geometry; the 22-route compatibility check still compares it with the accepted P1 output. Source version/compiler 7 stays unchanged.

The conservative 800-object Play guard remains. Oversized drafts retain their existing bounded/simplified line view and actionable Play errors, including the rejected larger P0 source. Invalid drafts are still editable/savable; they are not made playable by the mesh preview. A safe internal preview replacement bound also falls back to lines rather than raising the unchanged engine capacity. This is not #277's budget migration.

## Dependencies and reuse

`terrain_geometry.prepare` and `section` are the production builder split into shared preparation and emission. The editor assembles source runs with the existing `editor_doc.run_chains`; prefabs retain separate parts/gaps. Authored identities, logical connections and physical chain orientation are not rewritten.

A change-event dependency pass scans sampled runs, styles, continuity normals and cumulative arc lengths. Existing source sampling caches still reuse unchanged curve objects. The pass matches old sections by exact point sequences, rather than absolute indices: an earlier span gaining samples does not shift every later section's identity. Vertex emission occurs only for changed section signatures, including necessary shared-normal/end-cap neighbors. A short changed sliver may absorb its adjacent section to avoid fragmentation; the provisional target is 64 intervals, with edited ranges bounded to 96. Forty successive native test edits retain at most eleven sections on the six-anchor route.

Unchanged sections retain their GameObjects, buffer resources and vertex arrays. Changed live slots reuse their resource identity via `resource.set_buffer`; removed slots are released, with no history-sized GPU cache. Adding/removing source objects or changing a Kicker's facing does not reload an otherwise valid Edit world. Selection, hover and Hide recolor only affected vertex streams in place, without rebuilding positions. Lock still protects source operations through the existing editor rules. Hidden objects stay in compilation/Play, as before.

Cumulative UV phase and the common body floor are separate per-section material values. The editor's local UVs plus phase reproduce the production UVs; tagged floor vertices use the common floor uniform. Changing an upstream length or lowest point updates these values and necessary projected bounds while retaining unrelated geometry/resources. Normal Play uses the material's zero defaults and its unchanged original vertices. Pure checks decode the editor representation back to production coordinates/UVs.

This does not make every editor operation O(changed vertices): source/run/UV dependency scanning and existing validation remain. Idle frames and view-only pan/zoom skip terrain work; changed geometry previews are coalesced to at most one request per 33 ms, while committed results are applied immediately. No full-course vertex rebuild runs every frame. There is no visibility policy, culling, streaming or second editor implementation.

## Ownership and rendering

The shared Play adapter creates/updates the same position3/color4/UV2 float buffers, 36 bytes/vertex. Source positions/local origins convert metres to engine units once. The existing local-space Depth material keeps the original projection and layer −2. Editor-only parameters carry UV phase, local floor, engine-space extrusion width and an enable flag; floor tags never enter physics or source data. Color sidecars are retained only for editor streams.

The proxied Edit owner holds its section entries. Reuse, replacement, removal and world teardown have explicit resource ownership. Pending uploads are registered before mutation so a failed partial update is included in idempotent cleanup. Existing scene teardown owns component references; script-owned dynamic references are released once. The immutable material remains loader-owned to avoid the pinned engine shader churn described in P2. A failed preview can retain the original line view with a diagnostic, without mutating the source or weakening Play admission.

Bounds describe projected XY, including the current floor; the encoded depth is flattened onto the terrain render plane. Normal engine rendering behavior remains. GameObject/Sprite/label/GUI/mesh limits are unchanged. The original line view also remains the compatibility fallback for oversized drafts, with deletion completed before replacement allocation.

## Measured editor behavior

[Measurement data, event times, resource paths and hashes](terrain-p3/measurements.json). Final runtime/preview source: `5380b9a029672b350df7c23683381b07b344ec51`; later evidence/launcher commits do not alter runtime files.

Three saved P0 fixtures; five real tangent drags per fixture, twelve mouse moves over eight CSS pixels, Undo after each. Six-anchor uses tangent `o3`; long/mixed use `o2` on their first curve. These are local tangent edits, **not P0's earlier endpoint/anchor gesture**, so no direct drag-speedup claim follows. The same observer also retains five Edit→Play→Edit/Retry cycles per route, six imports, six-second drive windows and descent/jump/reverse captures. No other browser suite/build overlapped this performance run. All three re-exports equal the original P0 source and compiled documents.

1280×720 DPR 1, Chromium 156, ANGLE SwiftShader, preset A, 60 Hz physics/factor 1. Nearest-rank quantiles; one local observation, natural GC. CPU publication is not GPU presentation or device input evidence.

| Course | Edit sprites before → after | Initial meshes / vertex KiB | Geometry sections rebuilt per preview | Unchanged sections retained |
| --- | --- | --- | --- | --- |
| six-anchor | 671 → 5 | 11 / 421.9 | 5–6 | 5–6 |
| long-curves | 701 → 5 | 12 / 441.3 | 5–6 | 6–7 |
| mixed | 749 → 53 | 12 / 441.3 | 5–6 | 6–7 |

The chosen tangent's linked in/out directions affect two neighboring Bézier spans; the native one-sided out-tangent check changes three sections and retains eight. Every measured drag preserves Edit-world generation. Script-owned mesh references equal the live section count after every drag. Resource paths and per-update counters are recorded, including retained buffers across changed sample counts. Labels and GUI stay separate; the 800-segment regression uses four Edit marker sprites, 13 meshes / 518,832 bytes and the same 628 / 640 GUI nodes.

| Course | Mouse-up → committed mesh publication p50 / max ms | Local mesh/update CPU p50 / p95 / max ms | Edit main callback p95 / max ms |
| --- | --- | --- | --- |
| six-anchor | 20.6 / 30.7 | 27.0 / 30.0 / 34.0 | 48.9 / 53.8 |
| long-curves | 38.3 / 42.1 | 29.0 / 32.0 / 34.0 | 47.2 / 53.2 |
| mixed | 26.3 / 28.9 | 29.0 / 33.0 / 33.0 | 48.9 / 58.6 |

Publication after the gesture starts includes the editor's drag threshold, input scheduling and explicit move/frame handshakes. The JSON retains all pointer timestamps. Its latest-recorded-pointer age is only a scheduling proxy, not exact handler latency. The unambiguous committed-result measurement starts before mouse-up and ends at the first mesh publication for the new revision. A more allocation-heavy first candidate was also measured; it is superseded, not combined with this run. Local emission avoids temporary XYZ/tint tables; the resulting frame peaks above still remain material limitations.

Play remains at 7 / 7 / 55 live sprites, 11 / 12 / 12 meshes and 670 / 700 / 712 world shapes. Drive interval p95 is 16.9–17.0 ms, with occasional ~33 ms peaks. Warm import medians are 88.4 / 90.4 / 93.0 ms here, versus P0 ~55–63 ms and P2 ~93–96 ms in separate runs. **Higher load/construction time remains OPEN; no FPS gain or statistically established loading improvement is claimed.** WASM 256 MiB is capacity, not used memory. GPU memory/timing and physical Xiaomi behavior are unmeasured / NOT RUN.

## Verification

- Native incremental checks: exact reuse on unchanged input; local tangent 3 rebuilt / 8 retained; changed floor retains unrelated sections; Hide changes colors without positional rebuild; 40 edits with bounded sections; gap/neighbor signatures; immutable source; decoded editor floor/UV matches Play; finite output for a transient degenerate preview.
- Actual planner/adapter with a simulated engine boundary: initial eleven resources, zero idle updates, same resource identities on local updates, selection without positional rebuild, partial-upload failure cleanup and idempotent final. Independent review found a stale color-owner index when upstream resampling shifts a retained section. Recoloring now maps its stored interval indices to the new section offset; a focused adapter regression covers hidden/selected intervals and both physical end caps. Native incremental/ownership and 55 bootstrap tests pass after this correction. This is not a physical-device test; earlier browser timings remain observations of the recorded build.
- Existing ordinary HTML5 suites pass on integrated runtime `59bf099`: le2 (19), le3 (15), le4 (12), le5a (12), le5b (11), le5c (4), le5d (5), le6 (14), ea2 (7), ea3 (7), a22 (7), a6. Final `5380b9a` additionally passes le5b, native checks, the fifteen measured tangent/Undo gestures and the retained Play resource guard. Test inventories/results are in the PR; no lowered physics tolerances or admission assertions.
- The existing Kicker-facing test now requires a local upload with the same world generation instead of waiting for the removed full-world reload. The 800-segment test asserts actual mesh count/bytes and four Edit sprites. Invalid/oversized draft expectations remain unchanged.
- [Final Play resource guard](terrain-p3/play-lifecycle.json): eight reloads retain one current terrain VB set and no added per-switch small-buffer growth over the recorded original renderer. P2's existing small engine shader-buffer retention remains open.
- [Release QA](terrain-p3/release-check.json): pinned guards for both Wasm variants; seven course/START views, exact source and unchanged shape counts, no debug editor/mesh inspection globals, Retry, Edit→Play return and keyboard A→B→A station changes. Editor/Home and two desktop layouts were captured; a Save shortcut was sent, **not treated as persistence proof**. Real storage/version restore/reopen coverage comes from the existing debug le4/ea2/ea3 protocols.

[Launcher reload check](terrain-p3/launcher-reload.json): real input changes START speed, waits for Saved and IndexedDB synchronization, reloads the parent page, and verifies the unplayed draft returns with the same revision/value and unchanged source objects. The launcher resumes existing game/draft state instead of reimporting on refresh; a restored draft is preserved even if another fixture was selected, with the existing editor Import and fixture-download path available. This is a debug browser check of the ordinary editor plus artifact launcher, separate from physical-device evidence.

Current-head full CI is tracked in the PR. Claudio's #275 editor acceptance is pending; the preceding #274 drive acceptance does not approve this editor change.

## Preview and reproduction

Direct local release preview: http://127.0.0.1:8786/terrain-preview.html?course=six-anchor . Select the varied course or mixed-content course in the launcher. Press **E** to edit and return to Play; Home fits the course. Existing source handles, parameter fields, Mirror, Objects eye/padlock, Undo/Redo, Versions and Save/Open remain the actual editor controls. The artifact-only launcher uses the ordinary release import path and is not packaged into the game. Reload resumes saved/unplayed work; it does not automatically reset the fixture. No public Pages deployment is claimed for this unmerged PR.

Actual captures: [six anchors](terrain-p3/six-anchor-edit.png), [long course](terrain-p3/long-curves-edit.png), [mixed](terrain-p3/mixed-edit.png), [unchanged over-budget refusal](terrain-p3/long-over-budget-edit.png), [release editor](terrain-p3/release-editor-mixed.png), [resumed unplayed draft](terrain-p3/resumed-editor.png), [short release viewport](terrain-p3/release-editor-short.png), [Play airborne gap](terrain-p3/camera-jump.png). No generated/edited screenshots.

```sh
python tools/gym/bundle.py --output artifacts/terrain-p3/debug
# Source fixture/native-input preparation is the same as P2.
node tools/gym/terrain_baseline.cjs --fixtures artifacts/terrain-p3/native-inputs
<verified-locked-bob-luajit> -joff tools/terrain_editor/check_incremental.lua artifacts/terrain-p3/native-inputs
<verified-locked-bob-luajit> -joff tools/terrain_editor/check_ownership.lua artifacts/terrain-p3/native-inputs
timeout 260s node tools/gym/terrain_baseline.cjs artifacts/terrain-p3/debug artifacts/terrain-p3/measure --mesh --editor-mesh
timeout 120s node tools/terrain_play/check_lifecycle.cjs artifacts/terrain-p3/debug artifacts/terrain-p3/lifecycle mesh
# Build an ordinary pinned release with exact rider.source_sha, not the isolated P1 flag.
python tools/terrain_play/prepare_preview.py <release-bundle>
python -m http.server 8786 --bind 127.0.0.1 --directory <release-bundle>/RiderG1
timeout 240s node tools/terrain_play/verify_preview.cjs http://127.0.0.1:8786 artifacts/terrain-p3/release-check <release-sha> --editor
```

## Engine evidence and open performance points

Pinned Defold 1.14.0 `a81dbb0478e8b73931dc2d671563204f6ac0ef82`, integrated Box2D 3.1.0. Consulted [runtime mesh/local-space manual](https://defold.com/manuals/mesh/), [Buffer streams/metadata](https://defold.com/ref/buffer/), [Resource API](https://defold.com/ref/resource/#resource.set_buffer), and pinned [buffer transfer/update implementation](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/gamesys/src/gamesys/scripts/script_resource.cpp#L3230) / [mesh material constants and vertex property](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/gamesys/src/gamesys/components/comp_mesh.cpp#L937). The adapter uses explicit ownership transfer on updated buffers; borrowed resource buffer wrappers are short-lived, with collection cleanup unchanged. Same-buffer color updates advance buffer content version; projected floor metadata and per-instance constants preserve bounds/UV continuity without replacing unrelated buffers.

Open: P2's higher loading/construction times, edit spikes up to ~59 ms in this local run, source/validation/dependency scan cost, hardware GPU cost and reference-phone behavior. Existing source/coordinate/compiler constraints remain. This task supplies local product reuse, not 60-FPS editor proof. Human build→adjust→save→reopen→drive feedback is the stop point. No #276/#277 work is authorized.
