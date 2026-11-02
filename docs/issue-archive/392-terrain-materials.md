# Issue #392 archived planning text

Full body of [#392 [Terrain Materials] Kenney Platformer Pack 1.1 — section/region textures, renderer + editor preparation](https://github.com/bongohorse/rider/issues/392) as of 2026-11-02, moved here (unchanged except repo-relative links made absolute) during the issue cleanup ([issue guide](../ISSUES.md#length)). Current scope, binding rules and GOs live in the issue body, its sub-issues and STATUS.md; superseded parts of this text are history.

**Contents:** [Binding asset selection and implementation-readiness audit (2026-11-02)](#binding-asset-selection-and-implementation-readiness-audit-2026-11-02) · [Goal and scope](#goal-and-scope) · [User-facing material regions (two orthogonal scopes)](#user-facing-material-regions-two-orthogonal-scopes) · [Recommended design / alternatives](#recommended-design--alternatives) · [Editor UX proposal](#editor-ux-proposal) · [Proposed slices (each with explicit GO/owner/test stop)](#proposed-slices-each-with-explicit-goownertest-stop) · [Mandatory QA checks](#mandatory-qa-checks) · [Official implementation sources](#official-implementation-sources)

> **ASSET READINESS UPDATE — 2026-11-02.** The user supplied and the assistant inspected the exact Kenney New Platformer Pack **v1.1** ZIP. Six real 28-tile terrain families (Grass, Dirt, Sand, Snow, Stone, Purple) are verified; a deterministic **24-slot, 512/1024px** atlas + manifest + offline QA handoff (18 files) is prepared for Codex. SHA256 ZIP: `553b907f3f0e505ab65f56f245ccaff3123c8fe3f3a0dfce9373b996bfc18cc2`. **See [new exact asset audit and shader risk handoff](https://github.com/bongohorse/rider/issues/392#issuecomment-6586976841) before starting.** Old text below is design history; where it says asset ZIP not inspected or 6 presets unverified, this update supersedes it. **ENGINE/EDITOR NOT RUN; no implementation GO; first obtain owner #333/#281 hand-off.**

## Binding asset selection and implementation-readiness audit (2026-11-02)

**Maintainer selected: Kenney [New Platformer Pack](https://kenney.nl/assets/new-platformer-pack), preferably upstream current v1.1 (440 entries listed by creator; CC0), for the FIRST texture prototype.** This replaces the previous assumption that six entirely new Rider-owned material families must be authored before proof. It is **asset/art direction approval**, not a claim that the binary assets have already been added or that the renderer/editor is implemented. Keep parent #121 and Codex-owned #281 boundaries; do not bypass single-writer and CI gates.

**Readiness: DESIGN READY / IMPLEMENTATION NOT YET READY.** Current default branch has UVs and colour-based terrain shader but lacks a textured mesh `tex0` binding, sampler, validated tile subset, shader atlas lookup, material source serializer, UI swatches and real engine test. The latest upstream ZIP was **not downloaded/inspected in this research environment** (network/DNS restriction); exact tile IDs, PNG sizes/dimensions, archive hash, alpha treatment and seam tileability remain **UNVERIFIED**. A third-party 1.0 ZIP mirror is not the preferred pinned 1.1 deliverable.

### High-value corrections / first implementation checklist

1. **Asset intake, licensing, no asset bloat.** Fetch the *actual creator-hosted* `kenney_new-platformer-pack-1.1.zip`, record origin URL, retrieval date, SHA-256, included `License.txt`, and inventory the tile PNGs + spritesheet XML. Inspect **individual** tile edge pixels and visual adjacency; whole platform-corner/slope sprites are *not necessarily repeatable textures on arbitrary Rider curves*. Pick only a small verified subset of interiors, edge strips and side-fill tiles; re-author/adapt small derived tiles with retained CC0 provenance if necessary. Keep original names in a manifest and build reproducible derived atlas + editor thumbnails. **Do not vendor all 440 sprites, unrelated sounds/characters, entire ZIP or Kenney branding** into the runtime. Credit is optional under CC0 but provenance file is encouraged. Pack contents must be inspected before selecting exact named presets; do not imply asphalt/snow/stone are guaranteed in this specific pack.
2. **Explicit small pilot:** first prove **2 genuinely available distinct terrain looks** (e.g., grass/soil and sand/stone if pack supports them) across **two connected authored sections**, with **Surface / Rim / Side / End** visually distinct. Expansion to more named presets is conditional on inspected tiles and review of the same Rider toy-look art direction. Existing levels remain unchanged unless explicitly reauthored.
3. **Texture on mesh, not sprites/tilemap:** Pinned Defold docs explicitly support `mesh.tex0` and `sampler2D` (see links below). Present `main/terrain_perspective/chunk.mesh` has no tex0; its material has no sampler and fragment program uses only color × cosine. **Test the exact mesh texture-resource binding in Defold 1.14.0**, including whether a built atlas/tilesource or a standalone packed PNG texture works in `tex0`. A Defold GUI `.atlas` *as an asset container* is not itself evidence that the shader understands per-frame atlas UVs. For multiple packed repeated tiles, a **fixed-layout image atlas + explicit shader region mapping** may be simpler/safer than an auto-repacking Sprite atlas. No new Sprite/GO per segment.
4. **Two independent paint axes:** (a) select one/multiple source sections along the course; (b) apply independent material slots to tread/top, lip/rim, earth/side and actual open end caps. Existing **`editor_edit.lua:119` `split()` and :446 `split_curve()`** already split a selected inner line point or curve anchor with a continuous connection, preserving `road_look`. Extend that metadata-copy rule to the future `terrain_material`. For a boundary inside a segment without an existing vertex/anchor, author an explicit source insertion first; **do not** claim arbitrary mouse-painting within unsplit objects already exists.
5. **Very important UV/color correctness:** existing `terrain_geometry.lua` emits **three quad groups per physical interval** but writes `texcoord0.y=0 or 1` on all, including the side-fill quad extending to the global level floor. Without a UV redesign the soil texture would stretch down an arbitrarily deep face. Give the side-fill V a **stable world-metres mapping** while preserving arc-length U phase across source joints/chunk boundaries, reverse paths and current perspective. Region/material IDs must be constant per triangle, never interpolated between materials; preserve vertex `color.a`/selection, `look_data.z` tagged floors and existing projection shader. Do not naively use `fract` in a shared atlas and assume mip seams cannot occur: test guard/extrude + edge filtering and derivatives at several editor zooms. If no clean reuse of current streams exists, test a **one-float vertex stream** with newly measured 52 B perspective stride and correctly amended admission/CPU/transient budget rules; do not simply raise caps.
6. **Backward-compatible authoring:** keep `road_look` v1 and legacy fixed-perspective courses intact. Store stable **Kenney-derived internal material IDs**, not direct filenames, atlas coordinates or ephemeral source sample/chunk numbers. Source/version validation must refuse unsupported future IDs without data loss; one Apply = one Undo; preview isolated until Apply; copy/mirror/split/Undo/Save/Reload/Export/Import retain slots and external source identity. Editor uses the existing bounded 640-GUI-node pools, small swatch pagination, and lock/mixed states. No material friction/physics side effects.
7. **QA and evidence:** measure the **real** pinned Defold build with 660-m Fit (18,312 vertices × 48 = 878,976 untextured perspective bytes; × 52 = 952,224 if one float added), zoom/pan/motion and editing; measure atlas texture resident memory (RGBA8 1024×1024 = 4 MiB *before* mipmaps/compression), actual shader/image sampling, origin-independent UV phase, rendering at material joins, replay and the accepted 60-Hz simulation. Keep source, artifacts, selected tile names and exact SHA in the PR. Real hardware GPU performance remains **NOT RUN** until Android testing resumes.

**Recommended bounded order:** `Asset inventory + CC0 manifest` → `single textured shader + two materials / mesh & atlas test` → `versioned material mapping + regression` → `Editor swatches / apply` → `visual & mobile acceptance`. Shader spike may be separately delegated to renderer owner #263 once Director grants scope; **editor writes must wait for Codex #281 file ownership release**.

**Official evidence:** [Kenney asset + version/CC0](https://kenney.nl/assets/new-platformer-pack) · [Kenney rights/support](https://kenney.nl/support) · [Defold mesh texture property](https://defold.com/manuals/mesh/) · [Defold textured mesh example](https://defold.com/examples/mesh/textured/) · [Defold samplers/wrap/filter](https://defold.com/manuals/material/) · [Defold atlas extrusion](https://defold.com/manuals/atlas/).

---

## Goal and scope

**Research/preparation for Rider's next terrain visual slice, under [visual authoring epic #121](https://github.com/bongohorse/rider/issues/121) and renderer owner [#263](https://github.com/bongohorse/rider/issues/263).** User request (2026-11-02): select one or many authored track sections in the level editor, choose from a preset texture library, and apply textures to **different parts/regions of the road**, including distinct materials along a course.

**Status: design/research only — no implementation GO, writer claim, code edit, new physics, or test PASS.** Do not preempt Codex's exclusive #281 interactive-object editor files or the existing studio CI/FPS/camera/mobile drafts. Deliver in small approved renderer/source/editor slices after current ownership/priority is checked.

### Verified current Rider foundation (default branch, 2026-11-02)

- **Already built:** `main/gym/terrain_geometry.lua` emits 18 vertices for each sampled interval (three **separate quads**): (1) body/fill, (2) front lip/rim, (3) extruded top/depth face; six-vertex caps at genuine run ends. `M.prepare()` gives continuous world-distance `u=arc_length/4` across 64-interval chunk boundaries. Monotone runs have filled earth; steep/overhang/nonmonotone runs use a bounded ribbon. End caps only on run ends, not renderer chunks.
- `main/gym/terrain_mesh.lua` builds runtime buffers with `position`, `color`, `texcoord0` and, for perspective, `look_data`; reuses chunk buffer objects and the visibility/caching policy from `terrain_residency.lua`. `main/terrain_perspective/{terrain.vp,terrain.fp,terrain.material,chunk.mesh}` supplies coherent visual projection; the current fragment shader only modulates vertex color with a *procedural cosine*, **does not sample a texture**. `chunk.mesh` has **no tex0 set**.
- Current `editor_look.lua` / `main/terrain_perspective/look.lua` / [road-look contract](https://github.com/bongohorse/rider/blob/main/docs/contracts/road-look.md#editor-authoring) already offer **Level default** vs **Selected terrain source objects** (line/curve/prefab) with live Preview, Apply as **one Undo**, save/reopen and stable source IDs. Per-source look overrides currently carry *width/side/shading*, **not a material/texture preset**. Don't overload or rewrite their version-1 data silently.
- `editor_terrain.lua` uses a source-object→sample owner map, retained per-section geometry and selective updates; `terrain_budget.lua` enforces **128 mesh components**, **1 MiB Fit vertex payload**, **16 MiB CPU working estimate** and separate other caps. [P5](https://github.com/bongohorse/rider/blob/main/docs/TERRAIN_P5_REPORT.md): mixed 660 m / 1,016 sample intervals / 17 sections / **18,312 vertices**. The authored perspective profile uses **48 bytes/vertex** = 878,976 bytes. Adding **one float/vertex** would give **52 bytes/vertex** = 952,224 bytes on *that fixture*, under 1,048,576 but with only 96,352 bytes margin; larger near-limit courses may fail. This is a **design estimate**, not an implementation result. CPU/buffer upload, atlas RAM and transient double-generation accounting must be revalidated.
- `editor.gui_script` + `editor_ui.lua` have a hard **640 GUI-node pool**, around **628 reserved**. No new unbounded grid of GUI nodes; reuse paged/virtualized UI pools. Mobile gameplay is landscape-only; this does **not** grant a mobile editor.

## User-facing material regions (two orthogonal scopes)

**A. Along-track painting:** choose one/many *source* sections (a line, curve or terrain prefab) via the existing Select tool; material changes affect the selected source IDs, **not mesh chunk IDs**. A long source can initially be divided at a material boundary using existing geometry/split tooling where supported; later author *within-one-source* material spans with stable source anchors/normalized offsets, designed separately (no naïve mesh-index references).

**B. Cross-section material slots** in each track section (all visual, no independent colliders):

| Slot | Present geometry | Examples / UV rule |
| --- | --- | --- |
| **Surface / tread** | Existing extruded top/depth quad | Grass, paved road, gravel, snow; repeat by **arc length** along the road and world depth, never stretch over a 660 m chain |
| **Rim / lip** | Thin quad immediately under the authoritative driveable line | Clean silhouette/grass edging, stones, curb; never obscure tire-contact position |
| **Side / ground fill** | Body quad to lower bound; ribbon for overhangs | Repeating dirt, rock, sand, clay; **world-space vertical tiling**, not 0–1 stretch over an arbitrarily tall face |
| **End caps** | The existing actual run-end quads | Matching or inherited cut-section texture; never add caps at 64-interval mesh boundaries |

Potential later **upper soil vs deep rock** bands require deliberate geometry/UV policy and extra budget; not necessary for first implementation. No visual seam across connected source joints or 64-interval mesh chunks. Genuine gaps remain gaps.

## Recommended design / alternatives

**Preferred: one bounded terrain texture atlas + shader lookup on the existing mesh pipeline.**
- Author a *small cohesive toy/stylized Rider-owned* preset catalogue, e.g. **Meadow/soil, gravel, sand, stone, snow/ice look, paved road**. Each preset specifies default Surface/Rim/Side/Cap tiles, an m-per-tile scale, palette and fallback solid color. Allow a selected section to override the **overall preset** and, optionally, one of the four slots; preserve independent section inheritance.
- Pack repeatable material tiles into **one shared texture resource/atlas** and add a `sampler2D tex0` only on the explicit textured renderer route. The official [Defold textured mesh example](https://defold.com/examples/mesh/textured/) demonstrates `texcoord0` + `tex0`; [material sampler settings](https://defold.com/manuals/material/) permit wrap/filter controls. This reduces texture swaps and component proliferation; **it does not guarantee a single draw call for every chunk**. A shader decodes a bounded slot ID and applies tile-cell UV scale/offset. Avoid one Sprite/GameObject per interval and avoid terrain Tilemaps: neither follows sampled slopes and perspective cheaply under existing budgets.
- Minimal **engineering spike:** compare (A) atlas-region selection encoded into existing UV/color streams vs (B) an explicit float stream for stable `preset/slot` ID (48→52 B for perspective; 36→40 B for legacy) in **real pinned Defold HTML5**, with full 660 m Fit and compact landscape; keep look/selection alpha intact. The single-float ID is the clearest fallback for four surfaces and separate world V tiling, but requires an *explicit* budget update and could exceed limits on some existing near-capacity courses. No bitpacking into existing `color.a` (used for Hide/selection), `look_data.z` (bottom mode), or magic negative UVs without a robust proof.
- Maintain **continuous arc-length U** at shared joins and chunks (including reverse/steep terrain) and **metres-per-tile V** for fill and top depth. Do not interpolate *categorical* material IDs across neighboring source sections. First prototype can use an intentional clean seam; blend strips/crossfade are a separately measured polish option. Textures should not slide when camera pans, perspective varies, or terrain is subdivided into new mesh chunks.
- Use padded/extruded atlas borders and carefully test `fract` tile wrapping/mipmap/LOD seams at various zoom levels; see [Defold atlas](https://defold.com/manuals/atlas/) and [texture filtering](https://defold.com/manuals/texture-filtering/). Test on WebGL and actual Android when device work resumes. Consider **512/1024px atlas candidates** only after a prototype visual/memory comparison, not as an accepted allocation. [Texture profiles](https://defold.com/manuals/texture-profiles/) support BasisU/ASTC to bound GPU memory where supported; PNG bundle size alone is not GPU RAM.
- Keep **legacy untextured courses byte-for-byte visually identical** until the user explicitly applies a material; no change to existing physics chains, material grip, collision masks, fixed-tick ownership, camera, sprite pools or road projection.

**Rejected as primary track system:** thousands of segment sprites (undoes P0–P5 capacity gains); a tilemap painted over arbitrary curved edges (seams/stretched perspective and independent collider complexity); separate rendered GO for each surface/material region (unbounded resource growth); shipping copied HCR2 assets or physically changing friction because a section *looks* snowy. Retain possible separate decorative decals/grass later under #121.

## Editor UX proposal

Add a **Materials** tab/subsection to the existing **Terrain Look** workflow, or a compact Properties group when supported terrain is selected; do not build another editor. Suggested controls:

1. **Scope:** `Level default` | `Selected sections (N)`. Multi-select through existing source object IDs. `Inherited` / `Mixed` / `Override` indicator per selected group.
2. **Preset gallery:** six **named swatches with thumbnails** (bounded/paged, not 6 × 4 × source-count nodes): Meadow, Gravel, Sand, Rock, Snow, Asphalt (all in the same Rider toy visual style). Tap/click previews on the *actual course*, never edits saved source until Apply.
3. **Region:** `Whole material` | `Surface` | `Rim` | `Side` | `End`; optional `Inherit` for per-slot overrides. **Texture scale in metres/repeat**, predictable across zoom.
4. **Apply** / **Reset to inherited** / **Cancel or Close**: one validated source commit and Undo per Apply. Show explicit errors for locked pieces or unsupported presets. Switching sections preserves unsaved preview only in its bound document/session, following existing Terrain Look semantics.
5. Show a subtle authored-material tag in selected Properties; hide/lock affects edit manipulation only, never removes the material from Play/Export. Preserve material assignment on copy, mirror, split/conversion according to source identity; preview and gameplay use the same compiled mapping.

**Illustrative versioned data (proposal, not current Rider schema, and not license to write it yet):**

```json
{
  "editor": {
    "terrain_materials": {
      "version": 1,
      "default": "meadow-dirt-v1"
    },
    "objects": [
      {
        "id": "o17",
        "type": "line",
        "points": [[0,0],[5,1],[10,0]],
        "terrain_material": {
          "version": 1,
          "preset": "gravel-v1",
          "slots": {"surface": "gravel-fine-v1", "side": "stone-brown-v1"},
          "metres_per_tile": 2
        }
      }
    ]
  }
}
```

Source structure needs a **proper version/migration design** before implementation: editor/compiler 12, station schema 5 and `road_look` v1 already exist; don't silently insert unknown keys into v1 look or let old clients rewrite them. Use stable material IDs (not fragile atlas indices), fail closed on unsupported IDs/versions, save complete copied source and preserve unchanged legacy levels. Decide whether a **new compiler/editor version** or equivalent explicit capability marker is necessary, and report import/export/downlevel behavior. Compile/type mapping must survive changed sample count, selected piece split, source reorder, undo/redo and persisted files.

## Proposed slices (each with explicit GO/owner/test stop)

1. **Texture spike / shader proof (renderer-only, no editing UI/defaults):** one original two-material test, 4 surface slots, 2D + perspective; demonstrate tiling, atlas bleeding and local sprite-free residency on actual Defold HTML5. Record exact VS/FS material support, vertex stride, GPU/CPU allocations and before/after 660 m Fit/scroll. Stop and revise if cap/quality fails.
2. **Source mapping / serialization (small follow-up):** validator, material registry and deterministic source-ID-to-sample ownership. Keep old 36/48 layouts for untextured sources; source compiled map invariant through Save/Reload/Export/Import/Undo/Retry. No UI code while #281 editor owns those files.
3. **Editor swatches / region slots (Codex or separately delegated editor author, after #281 handoff):** extend existing selected source+Terrain Look GUI and one-Apply workflow; real mouse/keyboard selection, swatches, per-region preview and mixed/locked/refusal states.
4. **Art and performance approval:** six cohesive original/appropriately licensed preset families and thumbnails; user visual/drive signoff, HTML5 plus later physical Android GPU/texture memory tests; test legacy/non-perspective and perspective courses.

## Mandatory QA checks

- Two adjacent source sections with different presets; multi-select; locked section; complete six-preset swatch apply + reset; one-Undo; no automatic restyling after a preset registry update. Camera pan/zoom, reverse, steep/vertical, curve crest/valley, gap and landing, overhang ribbon, world-depth fill, section split and two render chunk boundaries show no stretched textures, seams, shimmer or false contacts.
- Check top/rim/side/end visual independence, UV phase continuity, selection/hidden alpha unaffected, no per-frame full geometry rebuild by camera or swatch *hover*, and no extra gameplay collision/body or changed physics/replay.
- Budget: baseline same source vs textured, 660 m Fit (18,312 vertices/17 sections), near-cap overlong rejection, transient two-generation allocation, texture bytes resident, draw calls/texture switches if actually measurable, editor upload CPU/frame peaks, save/import 256KiB, current 640-node GUI. Do not weaken existing caps or tests to fake admission; give actionable refusal on exceed.
- Source-diff and real-input checks on existing built Debug Gym, exact-head `required` CI + independent QA; production aesthetic / phone final gate separately. No new synthetic-only screenshot as hardware proof. Record **PASS / FAIL / BLOCKED / NOT RUN** accurately.

## Official implementation sources

- [Defold textured mesh example (UV + sampler; CC0 reference code)](https://defold.com/examples/mesh/textured/)
- [Mesh buffers and runtime updates](https://defold.com/manuals/mesh/)
- [Material samplers and wrap/filter modes](https://defold.com/manuals/material/)
- [Shader UV and interpolation](https://defold.com/manuals/shader/)
- [Atlas gutters / extrude border](https://defold.com/manuals/atlas/)
- [Texture formats / compression profiles](https://defold.com/manuals/texture-profiles/)
- [Texture sampling and filtering](https://defold.com/manuals/texture-filtering/)
- [Kenney New Platformer Pack (CC0, possible *reference* only; art-style approval needed)](https://kenney.nl/assets/new-platformer-pack)
- [Kenney Road Textures (CC0, possible *reference* only)](https://kenney.nl/assets/road-Textures)

**Ownership:** #121 product/editor art; #263 renderer/mesh/budgets; source/editor implementation coordinate with Codex-exclusive #281 and Director #333. User's request authorizes research/preparation; detailed gameplay/art implementation requires a separately bounded GO and dedicated reviewer.
