# Terrain rendering — completed epic background

**Source:** [Issue #263](https://github.com/bongohorse/rider/issues/263) · **Issue status on 2026-11-04:** closed · **Type:** closed-issue historical record.

> **Reference, not implementation approval.** The epic is closed. Some historical passages still describe it as open; those statements do not override the live issue state. Current GitHub issues, child tasks and active contracts are authoritative.

**At a glance:** Long tracks, depth meshes, object/GO budgets, culling and performance evidence.

**Contents:** [Goal and status](#goal-and-status) · [Index](#index) · [Research basis and approved delivery plan](#research-basis-and-approved-delivery-plan) · [1. Problem and motivation](#1-problem-and-motivation) · [2. Historical pre-mesh implementation (superseded)](#2-historical-pre-mesh-implementation-superseded) · [3. Goals and non-goals](#3-goals-and-non-goals) · [4. Target architecture](#4-target-architecture) · [5. Delivery order and gates](#5-delivery-order-and-gates) · [6. 2.5D terrain visual direction](#6-25d-terrain-visual-direction) · [7. Culling, streaming and object lifecycle](#7-culling-streaming-and-object-lifecycle) · [8. Budgets, diagnostics and mobile performance](#8-budgets-diagnostics-and-mobile-performance) · [9. Verification and acceptance](#9-verification-and-acceptance) · [10. Ownership and related issues](#10-ownership-and-related-issues) · [11. Historical first small task (completed)](#11-historical-first-small-task-completed) · [Camera-dependent perspective follow-up](#camera-dependent-perspective-follow-up) · [Accepted perspective production integration (2026-10-26)](#accepted-perspective-production-integration-2026-10-26)

## Goal and status

Remove the structural terrain-rendering bottleneck so Rider can support long, smoothly curved, visually rich mobile courses **without exhausting the 800-object validation budget or the 1,024 sprite/GameObject pools**. Establish a measured rendering foundation for **depth-bearing terrain in Rider's clear 2D style**, using the existing 2D level editor and Box2D physics.

**Delivery status (2026-10-28): P0–P5 (#272–#277) are closed and their PRs #283, #285–#289 are merged.** The comparison #290 / PR #291, production perspective #292 / PR #293, and visual look authoring #278 / PR #294 are also delivered. This epic remains open for any unmet end-to-end acceptance (especially representative Android visual/performance evidence) and narrowly justified follow-ups; closed child issues do **not** automatically check every cross-device acceptance item. No full renderer rewrite or physics-contract change is authorized.

## Index

- [Camera-dependent perspective follow-up](#camera-dependent-perspective-follow-up)

- [Research basis and approved delivery plan](#research-basis-and-approved-delivery-plan)

1. [Problem and motivation](#1-problem-and-motivation)
2. [Historical pre-mesh implementation](#2-historical-pre-mesh-implementation-superseded)
3. [Goals and non-goals](#3-goals-and-non-goals)
4. [Target architecture](#4-target-architecture)
5. [Delivery order and gates](#5-delivery-order-and-gates)
6. [2.5D terrain visual direction](#6-25d-terrain-visual-direction)
7. [Culling, streaming and object lifecycle](#7-culling-streaming-and-object-lifecycle)
8. [Budgets, diagnostics and mobile performance](#8-budgets-diagnostics-and-mobile-performance)
9. [Verification and acceptance](#9-verification-and-acceptance)
10. [Ownership and related issues](#10-ownership-and-related-issues)
11. [Historical first small task](#11-historical-first-small-task-completed)

## Research basis and approved delivery plan

Plan approved by Claudio on 2026-10-24: prioritize **long, visually substantial 2D courses that are fast to author and smooth to play**. Issue creation approves backlog organisation, not runtime implementation or a new milestone. Preserve the existing per-task scope/GO/drive-test process.

Historical idea sources, not implementation inputs ([provenance](https://github.com/bongohorse/rider/blob/main/docs/research/README.md)): [HCR2 technical reference](https://github.com/bongohorse/rider/blob/main/docs/research/HCR2_Technical_Reference_for_Rider.md), [asset/graphics findings](https://github.com/bongohorse/rider/blob/main/docs/research/assets_findings.md), [native findings and limitations](https://github.com/bongohorse/rider/blob/main/docs/research/native_findings.md). Original shader math supports terrain-body extension, depth/UV changes and authored lighting; some original models have depth coordinates. HCR2's full CPU mesh generator, projection, chunk/culling policy, physics laws and numerical tuning are not recovered. Treat our architecture as independent Rider work, using Rider-owned art/code.

This epic is the technical owner for sampled-route → visual mesh chunks → bounded visible/allocated resources, plus the early depth comparison. #121 owns look controls, authored materials and later decoration/atmosphere. Closed #118/#167 remain foundations; #168/#169 own existing construction/testing tasks. No duplicate editor, camera, replay or physics systems.

The depth experiment moves **forward into P1**, before renderer integration, so vertex formats, top/side/body surfaces and layering are informed by a visible comparison. It does not wait until the whole optimisation chain is finished. Production look authoring follows in #278.

Long-course acceptance includes source-document size, compile/sample limits, world coordinates and start-distance restrictions, not only rendering. P0 audits those separately. No arbitrary course-length promise, physics streaming or automatic origin rebasing follows from mesh rendering.


## 1. Problem and motivation

A user-drawn curve with only a few editable anchors can produce hundreds of compiled line segments and quickly trigger **"Station render budget exceeds 800 objects"**, even though the course does not appear especially long. This makes the editor impractical for complete levels: terrain consumes most of the render object capacity before vehicle art, coin sprites, decorations, obstacles and other visual content are added.

The underlying distinction matters:

- **Authoring complexity:** a small number of editable anchors.
- **Compiled geometry:** many sampled line segments needed to approximate a curve.
- **Rendering resources (today):** approximately one Sprite + GameObject per compiled terrain segment.
- **Other budgets:** audio, particle systems, physics bodies/shapes and GUI nodes do *not* all consume Sprite slots, but still have separate resource and performance costs.

The desired result is **not** to merely increase `sprite.max_count` or hide a warning. The goal is a renderer whose instance count no longer scales approximately 1:1 with terrain sample count.

## 2. Historical pre-mesh implementation (superseded)

**Historical diagnostic baseline before #274–#277, not a snapshot of current `main`:** The former per-segment Sprite path and 800-object gate were replaced with mesh-section rendering and resource-specific admission. Recheck present source/limits before any new work.

Relevant pre-mesh code paths (for problem history only):

| File | Historical behavior / limitation |
| --- | --- |
| [`game.project`](https://github.com/bongohorse/rider/blob/main/game.project) | `[sprite] max_count = 1024`; no separately configured `collection.max_instances` (Defold default applies). `[physics] type = 2D`, Box2D fixed-step; `max_collision_object_count = 256` is **not** a terrain-segment count. |
| [`main/editor/editor_sample.lua`](https://github.com/bongohorse/rider/blob/main/main/editor/editor_sample.lua) | Adaptive curve sampling: `TOLERANCE = 0.005` m (5 mm), `MAX_SEGMENT = 0.5` m, `MAX_POINTS = 2048`. Shape accuracy and chord length can create many sampled segments. |
| [`main/editor/editor_doc.lua`](https://github.com/bongohorse/rider/blob/main/main/editor/editor_doc.lua) | Compiles connected paths to collision chains; `drawn()` counts all sampled segments as line sprites. |
| [`main/game/stations.lua`](https://github.com/bongohorse/rider/blob/main/main/game/stations.lua) | `line()` creates an individual line Sprite/GameObject per segment; `decorate()` traverses the full compiled terrain. Box2D chains are built independently. |
| [`main/game/station_data.lua`](https://github.com/bongohorse/rider/blob/main/main/game/station_data.lua) | Rejects levels exceeding **800 calculated render objects**, including terrain segments, obstacle edges, labels, finish and markers. |
| [`main/editor/editor_view.lua`](https://github.com/bongohorse/rider/blob/main/main/editor/editor_view.lua) | Editor can simplify the preview by distributing fewer line sprites, but the full geometry remains and Play still requires the 800-object validator to pass. |

Previous issue [#236](https://github.com/bongohorse/rider/issues/236) addressed an incorrect/premature warning on a longer six-anchor curve. It is **closed**. This epic concerns the remaining *structural* per-segment scaling problem, not a duplicate regression ticket.

**Historical context:** The former 800 figure was a Rider safety/validation budget, **not** a hard Defold terrain limit; #277 superseded its segment-based admission model. The configured 1,024 Sprite pool and the GameObject instance pool are distinct resource constraints; invisible sprites can still occupy those pools. Frustum culling alone therefore does not fix allocation pressure.

## 3. Goals and non-goals

### Goals

- Long curves and courses must be authorable/playable without a near-linear explosion of Sprite/GameObject instances.
- Preserve current source documents, anchors, seams, editor operations, collision chains, driving feel, reset and replay semantics.
- Separate **authored path**, **physics sampling** and **render geometry / LOD**. Each needs independently justified precision and limits.
- Batch visible terrain into a small number of GPU-friendly meshes/chunks; validate exact Defold 1.14.x APIs, material/vertex formats and limits before implementation.
- Efficiently render visible/nearby geometry and prepare incoming chunks ahead of camera motion.
- Make room for future visual surfaces (top surface, face/side depth, shading, material/texture UVs) and for other game art.
- Track actual CPU, GPU/draw-call, memory, stutter and mobile results rather than relying only on object count.

### Non-goals

- Switching game physics, vehicle movement or editor coordinates to 3D.
- Claiming Hill Climb Racing 2 internally uses any particular renderer (its appearance is a visual reference, not proof of implementation).
- A general streaming/asset engine, infinite procedural world or speculative framework.
- Changing physical terrain friction or shape through cosmetic styling.
- Implementing biome styles, decoration generators, weather, parallax content or full art direction in this issue; those belong to #121.
- Immediately enabling/disabling gameplay simulation according to camera visibility; physics correctness takes priority.

## 4. Target architecture

```text
Editor document (anchors, curves, prefabs, connections)
             |
       versioned compile
             |
    +--------+------------------+
    |                           |
Box2D collision chains     Visual terrain builder
(physics-owned, fixed)     (render-only)
                                |
                      geometry -> mesh chunks
                                |
                   bounds, UVs, materials, LOD
                                |
                  visibility + active chunk pool
```

Key rules:

1. **One source of truth:** retain source points and compile deterministically; a display-quality change must not mutate collision geometry, START/FINISH, level bounds or vehicle physics.
2. **Independent sampling:** preserve collision accuracy and contact continuity; render mesh density may differ. Measure gameplay before relaxing the existing 5 mm / 0.5 m sampling contract or altering compiler versions.
3. **Batching:** one mesh can hold many vertices/triangles; avoid one Sprite/GameObject per triangle, curve chord or sampled point.
4. **Chunk boundaries:** shared vertices and normals/UV seams must join without visible cracks or collision changes; no tiny extra GameObjects for every sample.
5. **Editor fidelity:** selection handles, Undo/Redo, dragging, curves, prefabs, saved drafts, Test Play and Save/Reload continue to use original authoring data. Editor previews may use a cheaper visual representation but may not misrepresent actual geometry.
6. **Budget transition:** maintain a protective guard while old rendering exists. Replace the 800-render-object validator only after a measured new allocation model exists; do not simply remove all level validity limits.
7. **Serialization compatibility:** existing saved levels and station JSON remain playable; changes to compiler-derived geometry require explicit versioning/migration and reproducibility where applicable.

## 5. Delivery order and gates

**Delivered implementation sequence (not a pending task list).** The table captures original dependencies and scope; PRs and closed issues confirm work landed, while the cross-device acceptance checklist below remains a separate evidence gate.

| Order | Issue | Outcome / dependency |
| --- | --- | --- |
| P0 | #272 — curve/long-course cost baseline | Representative source, physics, allocation and frame measurements; audit remaining size/coordinate limits |
| P1 | #273 — flat/depth road mesh comparison | Depends on P0; same 2D course/collision, early top/side/body/UV/layer comparison and Claudio's visual selection |
| P2 | #274 — normal Play integration | Depends on accepted P1; chunk meshes without per-segment Sprite allocation; preserve collision/reset |
| P3 | #275 — editor mesh preview/local rebuilds | Depends on P2; responsive source editing, Undo/recovery and Edit↔Play parity |
| P4 | #276 — active/cached resource lifecycle | Depends on P3; bounds, preload/hysteresis, culling and bounded allocations without missing terrain |
| P5 | #277 — resource-specific admission and acceptance | Depends on P4; replace old segment-based estimate only after measured resource guards exist; long mixed-course acceptance |
| Visual V1 (#121) | #278 — authored section look | Depends on P5 and accepted P1 direction; editor controls, versioned visual settings and safe section application |

Keep protective guards during migration. P1 uses a bounded prototype; P2/P3 must not bypass still-valid level guards to claim unrestricted long-course support. Camera #239/#236 behavior is preserved and evaluated on downhill/jump/reverse fixtures; any new camera defect gets a narrowly evidenced follow-up rather than an assumed replacement.

## 6. 2.5D terrain visual direction

A desirable visual reference is a Hill Climb Racing 2–like road whose top, front edge and side faces communicate depth while it rises and falls.

Explore (do not prematurely commit to one):

- **2D strip/mesh:** terrain outline, filled ground body, beveled edge, shading, continuous UVs.
- **2.5D impostor:** width/depth projected into view without a perspective game camera.
- **Shallow extruded mesh:** actual depth/side faces with an orthographic/slightly angled visual projection, while the driving collision stays 2D.

Requirements:

- Keep 2D gameplay coordinates and vehicle visibility readable; do not rotate the whole camera so that existing 2D vehicle artwork is distorted.
- Perspective/depth cues should behave consistently on climbs, descents, crests, gaps and reverse traversal, with no unnatural flipping.
- Look for good results on a portrait/landscape mobile viewport, including small screens.
- Determine how road/ground meshes coexist with 2D vehicle and object render layers without incorrect occlusion or seams.
- Styling/material palette, generated decorations and atmosphere are owned by [#121](https://github.com/bongohorse/rider/issues/121). This issue provides the renderer capability/budget interface.

## 7. Culling, streaming and object lifecycle

Two different problems must be handled separately:

1. **Draw culling:** do not submit offscreen geometry unnecessarily (use Defold's renderer/frustum behavior for supported component types, with valid mesh bounds).
2. **Allocation/lifecycle management:** don't allocate *every* track segment as a persistent GameObject. Pool/reuse a bounded set of chunk render components where that is demonstrably beneficial.

Guidelines:

- Chunk positions/bounds in world space; account for both X **and** Y extents (steep courses, high jumps, valleys), camera zoom and viewport aspect ratio.
- Use a configurable preload margin (and optional velocity-aware look-ahead), plus hysteresis to avoid thrashing at chunk borders.
- Avoid per-frame full-document traversals and mesh rebuilding. Regenerate only affected chunks when source geometry changes; update visibility cheaply.
- Preserve clean transitions during camera teleports, editor pans, Retry, reloads and station changes.
- Do **not** disable static Box2D terrain collision just because a chunk is offscreen. Dynamic actors, triggers, coins and moving hazards will need separate lifecycle/reset policies owned by their gameplay systems.
- An end-to-end performance goal is fewer instances, draw calls and offscreen work, not merely zero visible draw calls for offscreen lines.

## 8. Budgets, diagnostics and mobile performance

Replace the single misleading `800 objects` number with distinct observed counters, as relevant:

- Authored anchors / compiled physics vertices and chain counts.
- Mesh vertices/indices, mesh chunks, chunk bounds and active/cached chunks.
- Sprite, mesh, GameObject and GUI component counts relative to configured pool capacities.
- Draw calls/batching, overdraw, GPU/CPU frame time, memory and worst-frame spikes.
- Dynamic body/shape counts and physics time (separate from rendering).
- Particle and sound budgets (separate systems; not charged as terrain Sprites).

Do not pick arbitrary higher fixed limits without profiling. Use baseline and before/after measurements on the existing reference Android device and HTML5 desktop; include representative long curves and other gameplay entities. Keep budget feedback understandable for level authors (what is expensive and why, not simply "800 exceeded").

## 9. Verification and acceptance

### Minimum functional checks

- [ ] A short **six-anchor** curve and a longer curved test course can be edited, saved, reopened, played and retried without a premature render-budget rejection.
- [ ] The rendered road matches the authored path; no visible gaps at segment/chunk joins, including steep slopes, wave crests, gaps and long descents.
- [ ] Collision positions/contact behavior, start placement, finish crossing, two-sided chains, Retry and camera look-ahead behavior remain unchanged within existing tolerances.
- [ ] Existing level files load without data loss; moving/deleting/editing geometry updates only the affected visual chunks and Undo/Redo remains correct.
- [ ] Camera pan/zoom, fast forward movement, reverse, jumps, deep falls and instant camera reset never expose missing chunks or persistent stale geometry.
- [ ] The same course can include the vehicle and representative sprites for coins, obstacles and decorative props without consuming nearly the entire Sprite pool for terrain alone.
- [ ] Invalid/oversized inputs fail with an actionable resource-specific message; runtime stays within configured memory/component/physics limits.
- [ ] Comparison reports include object counts, chunk/vertex counts, frame-time distribution and worst spikes on desktop HTML5 and the reference Android phone.
- [ ] Changes use existing real-input Playwright UI tests plus targeted render/geometry diagnostics; don't duplicate button tests or create a broad testing framework.

### Quality gates

- **Physics:** track drives the same; no driving/landing regressions or false seam contacts.
- **Visual:** level readability and road depth validated by a human drive test.
- **Performance:** no regression against the measured baseline without an explicit trade-off; smooth gameplay on target mobile hardware.
- **Workflow:** one issue/one PR per small scope; no blanket approval of all phases.

## 10. Ownership and related issues

- [#236](https://github.com/bongohorse/rider/issues/236) — closed fix for the premature curve-budget warning; preserve its regression fix, do not reopen or duplicate.
- [#121](https://github.com/bongohorse/rider/issues/121) — terrain look, decoration, materials and environment authoring; consumes the renderer, owns the visual content pipeline.
- [#118](https://github.com/bongohorse/rider/issues/118) — level editor core and level data; preserve its contracts.
- [#120](https://github.com/bongohorse/rider/issues/120) — dynamic/interactive gameplay objects and events; their simulation lifecycle is distinct from rendering visibility.
- [#230](https://github.com/bongohorse/rider/issues/230) — future procedural course content; no streaming/endless generator is required here.

**This epic owns:** scalable terrain **rendering infrastructure**, its interface to source/physics geometry, chunk visibility and its own diagnostics. It does not take ownership of gameplay objects or final visual styling.

## 11. Historical first small task (completed)

**Completed:** #272 / PR #283 established the baseline; #273–#277 followed as distinct completed implementation slices. Do not restart P0/P1. Next only if needed: document representative mixed/long-course and phone visual/performance results, then scope evidenced regressions separately.

**P0: Curve cost audit + smallest reproducible benchmark.** Build one editor-authored six-anchor curve and a longer curve, record actual compiled sample count and allocated objects; determine how much comes from `editor_sample.lua` sampling versus `stations.lua` / `editor_view.lua` Sprite creation. Verify the existing #236 fix. Produce a short before/after-compatible benchmark report and a concrete P1 mesh prototype scope. **No limits increased and no physics/visual redesign in P0.**

**Historical gate fulfilled:** subsequent slices received their own approvals. Any new renderer or visual task still requires explicit scope and GO.

## Camera-dependent perspective follow-up

Claudio's clarification (2026-10-26): preserve the accepted Depth direction but make its apparent perspective respond **subtly and naturally to camera position**, as a view of a fixed road body. No bending, breathing, speed-based widening or movement of the rideable contact edge.

- [x] #290 — fixed-vs-camera-dependent perspective comparison with live look controls (PR #291 merged).
- [x] #292 — accepted perspective in normal Play and Editor, preserving older fixed-Depth courses (PR #293 merged).
- [x] #278 — selected section/course Terrain Look controls, preview, Undo and versioned save (PR #294 merged; visual authoring owner #121).

Updated visual sequence: **#277 acceptance → #290 comparison/visual acceptance → any explicitly scoped production integration required by that result → #278 look authoring**. This supersedes the earlier direct #277 → #278 link; the existing accepted fixed Depth remains the baseline/fallback. The new issue owns projection and resource/bounds correctness; #278 owns full per-section authoring/persistence and reuses its parameter contract. #121 tracks visual direction. No change to current #277 scope, collision, gameplay camera, budgets or per-task GO gates. Preserve #276 residency correctness under the changed projected bounds and #277 worst-case/transient limits.


## Accepted perspective production integration (2026-10-26)

**Current status (2026-10-28):** #292 / PR #293 and #278 / PR #294 have since merged. Normal Play/Edit use the accepted projection with legacy fixed-Depth compatibility; authored Terrain Look uses the delivered controls and persistence. **#278 is no longer blocked.** Remaining decoration/atmosphere belongs to #121, and actual Android/mixed-course validation must be reported separately from CI/desktop results.
