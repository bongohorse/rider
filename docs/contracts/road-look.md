# Road look comparison contract (#290)

**Contents:** [Scope and activation](#scope-and-activation) · [Parameter set v1](#parameter-set-v1) · [Projection and spaces](#projection-and-spaces) · [Geometry and resources](#geometry-and-resources) · [Controls and retention](#controls-and-retention) · [Production compatibility](#production-compatibility) · [Editor authoring](#editor-authoring) · [Consumer boundary](#consumer-boundary)

## Scope and activation

Claudio accepted the camera-dependent direction in #290 and authorized the separate #292 integration. The explicit comparison remains available through `rider.terrain_perspective = 1`, supplied only by `tools/terrain_perspective/build.py`. Ordinary builds select the profile using the compatibility rule below; the native Terrain Look editor authors versioned source values. It does not read comparison localStorage or expose the comparison style-request API. Source/collision/physics/camera/Retry remain unchanged.

The prototype keeps the existing 64-interval partition, source sampling and front contour. It adds a visual depth projection; it does not introduce 3D physics or move the actual follow camera. All state affecting the projection is the parameter set plus the current camera XY. There is no speed/direction input, oscillator, lag or shape-history filter.

## Parameter set v1

Only these fields are accepted. Numbers must be finite and inside the ranges; unsupported versions, modes, unknown fields and invalid values are refused while the last valid set remains active.

| Field | Type / range | Meaning |
| --- | --- | --- |
| `version` | integer `1` | Parameter contract version, separate from level/editor/compiler formats. |
| `mode` | `fixed` or `perspective` | Fixed affine depth or camera-dependent central projection, with the same other values. |
| `width` | 0.25–2 m | Authored world-space extrusion away from the collision plane; never animated by camera/speed. |
| `perspective` | 0–1 | Reciprocal focal contribution `a = perspective / 40 m`. Zero is the fixed-projection bypass. |
| `angle` | 10–45 degrees | Vertical view calibration: top-exposure shear `tan(angle)`. Does not rotate/move the actual camera or vehicle. |
| `side` | 0.25–64 m | Maximum filled side below each source point, capped by the existing global floor. Overhang ribbons remain bounded to their accepted 0.9 m thickness and can be shortened. |
| `shading` | 0–1 | Static interpolation from a neutral terrain color to accepted top/edge/body colors. Alpha/source Hide remains intact; lighting does not follow the camera. |

The restrained preset is width `0.9`, perspective `0.35`, angle `atan(0.55)` = approximately `28.810793742973°`, side `64`, shading `1`, mode `perspective`. Reset uses the same values with mode `fixed`; on the supplied fixtures this recovers accepted Depth, including its floor. The default side cap is sufficient for those fixtures, not a promise of the same floor appearance for arbitrary taller future courses.

Width and angle both influence apparent top exposure. They describe different things: width is a fixed physical visual extent; angle is the view calibration of that same extent. Perspective strength controls vanishing behavior, not an independent per-section width animation. Horizontal shear remains the accepted `0.18` and is not another tuning axis.

Example retained set:

```json
{"version":1,"mode":"perspective","width":0.9,"perspective":0.35,"angle":28.810793742973,"side":64,"shading":1}
```

## Projection and spaces

Source points are metres. The engine adapter converts positions to engine units once; the shader uses the documented scale to express the visual projection in world metres and restores local engine coordinates before the existing world/view/projection transform. Extra attributes identify the source road point for a bottom vertex; they do not replace collision data.

Let `C` be the unchanged current camera XY in metres, `P` a fixed body point’s XY, `z` its fixed extrusion depth (0…width), `b = (0.18, tan(angle))`, and `a = perspective / 40 m` in camera mode (zero in fixed mode):

```
Q(P,z) = (P + z * (a*C + b)) / (1 + a*z)
```

For `a > 0`, this is the central projection from virtual eye `(C + b/a, -1/a)` onto plane `z = 0`, followed by the unchanged gameplay camera’s 2D transform. Its vanishing behavior is coherent across the complete body; there are no chunk-specific offset clamps. Positive denominators (at most 1.05 over the permitted width/strength) prevent poles or folds. At `z = 0`, the shader explicitly bypasses the projection: `Q(P,0) = P`, preserving the driving contour’s accepted transform. At zero strength it uses the accepted affine shear directly, avoiding camera-dependent cancellation even in the reference mode.

The shader carries the homogeneous denominator into `gl_Position.w`, keeping UV/color interpolation perspective-correct. Output depth/layering remains the accepted terrain layer; vehicle/prop art is unchanged. Static builder colors provide shading, not a camera-driven fake light. Returning to the same pose and parameters returns the same projected vertices exactly in the pure model.

## Geometry and resources

Both prototype variants use the same buffers: positions/colors/UVs plus a three-float `look_data` stream (road-local XY and filled/ribbon flag), 48 bytes/vertex. Width, side depth and view settings are uniforms; ordinary camera changes never resample source, rebuild sections or upload vertex streams. Source/selection edits retain the existing dependency and ownership paths.

The accepted body/floor AABB conservatively contains every permitted side cap/ribbon. Project its rectangle corners at depth 0 and width, with a 1 cm additional guard. A positive linear-fractional map reaches its extrema at those endpoints. The accepted base bound already includes its depth guard, so these bounds may overestimate coverage; “visible” means a conservative projected AABB intersection, not measured pixels or draw calls.

Residency uses current-frame projected bounds and the existing visible-first/preload/hysteresis/two-cached policy. Engine buffer `AABB` metadata is updated separately in local engine coordinates. Pinned Defold reads it at visibility evaluation, and `SetMetaData` does not increment buffer content version. Constant/AABB updates are distinct from buffer uploads; actual browser evidence must verify that distinction.

No pool or admission cap is increased. The comparison configures the existing budget policy for stride 48 and working estimate 560 bytes/vertex (512 plus two generations of three eight-byte Lua value slots). The 1 MiB payload and 16 MiB renderer/source working caps, 128 mesh components, Sprite/Label/GameObject reserves, physical-vertex guard and all source/compiler/START/coordinate constraints remain. At Fit all logical sections may be needed; cache is a subset. Actual fragmented editor plans and deferred old/new component overlap remain guarded. The retained engine VB ceiling changes with stride (not pool count); it is not physical GPU-memory evidence.

The loader retains the shared prototype material to avoid per-proxy shader churn. Both materials/factories remain packaged; each normal course selects only its compatibility profile. Baseline fixed-versus-camera measurements in the comparison include the same material/layout overhead in both modes; they do not establish a zero-cost addition relative to the earlier production executable.

## Controls and retention

The artifact-only parent panel supplies five labeled ranges plus numeric inputs. Fixed/Camera buttons compare the same set live without loading a new world. Reset restores the accepted supplied-course preset. Apply retains only a successfully acknowledged set in the preview origin’s `localStorage`; Reapply and page reopen restore it. JSON can be copied/reopened; invalid requests leave the last valid set and source untouched. A storage failure reports that retention failed and offers JSON copying.

The panel lives outside the game iframe: its arrows/numeric editing do not become drive inputs. Gameplay commands remain the existing Arrows/A/D/R/E/Home. The engine exposes only a bounded style-request interface in the explicit comparison build, not physics, source, camera mutation or debug services. Retained tuning is separate from the existing level saves/Undo/versions; the launcher preserves editor drafts instead of silently replacing them on a reload.

## Production compatibility

The immutable identifier `perspective-v1` selects exactly `projection.DEFAULT`: perspective mode, width 0.9 m, strength 0.35, angle atan(0.55) = 28.810793742973°, side cap 64 m, shading 1. This is the preset recorded in the shipped/hosted #290 evidence. Claudio accepted the camera-dependent direction and requested no further tuning; his private retained browser JSON was not supplied. Do not claim that unreported personal changes were observed. A different future preset must use a different identifier rather than changing this mapping silently.

- Existing saved/imported documents without `editor.road_profile` retain the previous fixed Depth renderer, exact uncapped accepted floor behavior, and 36-byte budget layout. Open, editing, save/export, reopen, Play and Retry never add a profile. This also preserves larger legacy courses that fit 36-byte budgets but would exceed 48-byte budgets.
- New empty documents carry `editor.road_profile = "perspective-v1"`. Compilation copies this source metadata through the existing editor block; geometry, sampling and compiler versions stay unchanged. It is a coarse course compatibility identifier, not tunable parameters or per-section authoring.
- Built-in station resource loads select that profile in memory (`_road_profile`); original station JSON is not rewritten. Import/restore ignores that runtime-only field in external JSON, retaining the original file text; only `editor.road_profile` opts a custom source into the new look. An editor template copy carries its source profile. Copying an old unmarked custom course keeps it unmarked.
- Play resolves the profile from the validated course; Editor resolves it from the same source document. Both use the same `projection`/`runtime` modules and immutable preset. There is no ordinary-build style-request API, localStorage adoption or extra tuner.
- Admission and editor planning resolve 36/48-byte stride and 512/560-byte working estimate from each document, including import/restore before a world exists. They do not depend on the previously displayed course. Fit, cache and delayed old/new overlap keep existing caps.
- Unsupported profile identifiers return an unsupported-format refusal. The existing alternating-slot protections keep unknown saves unchanged; they may not be overwritten as ordinary invalid data. Known profile metadata does not upgrade editor/compiler geometry versions. Older Rider executables cannot be assumed to understand the new profile; downgrade is not a supported look-preserving workflow.

The existing renderer is retained to preserve old courses, not selected from a date/id heuristic. #278 adds the explicit authoring workflow below; opening a menu alone never opts an old course into perspective.

## Editor authoring

Claudio explicitly authorized #278 after merging #293; he did not report an additional drive test. The persistent **Terrain Look** button opens a native menu built from the existing GUI pool, `projection.CONTROLS` and `projection.RANGES`. There is one projector and one parameter validator. Scope is **Level** defaults or **Selected sections** (existing terrain line/curve/prefab source objects, not render chunks, hulls or labels). Perspective strength and view angle remain level-wide and are read-only in Selected scope, preserving one central projection space. Width, side depth and shading can be local.

A menu session belongs to the current document instance. Slider/numeric edits preview without mutating source, revision, save slots or Undo. Close/Esc retain valid draft values; opening again restores them. `Terrain Look *` indicates retained preview values awaiting Apply. Preview is not saved by closing or ordinary Save; Apply writes the selected source scope once through the existing commit/Undo/autosave/version pipeline. Switching to Play uses committed source. Reset previews accepted level defaults, or inheritance for selected sections; Apply makes that reset persistent. Level Reset/Apply retain manual object overrides. Unknown/future look versions stay protected by existing save-slot handling.

Explicit Apply uses `editor.road_profile = "authored-v1"` with:

```json
{"road_look":{"version":1,"params":{"version":1,"mode":"perspective","width":0.9,"perspective":0.35,"angle":28.810793742973,"side":64,"shading":1}}}
```

An optional terrain object's `road_look` is `{"version":1,"width":1.2,"side":8,"shading":0.7}`. Projection/angle in a section override are refused. Authored look version 1 supports known editor/compiler versions 7, 8, 9, 10 and 11; geometry and sampling semantics are unchanged. Version 8 adds medal metadata; version 9 adds ordinary coin objects; version 10 adds optional Wonder Gem kinds on those objects; version 11 adds fuel rules and canisters. The new profile ID makes older #292 readers refuse the file safely instead of silently ignoring authored settings. Unknown container/parameter/section versions or keys are refused; recognized numeric ranges remain the #290 ranges. No date-based migration or automatic adoption occurs.

Legacy files remain on the original fixed renderer until explicit **Level Apply**. Their menu says that Apply enables perspective. Selected Apply first requires a perspective-enabled level, so a local edit cannot silently convert every other section. Level operations refuse locked terrain; Selected operations refuse a connected run containing locked terrain, preserving shared transitions. Unlock it or select another run. Hidden flags, manual source geometry, names and untouched look overrides remain. Moving/copying/splitting/converting source sections preserves their look metadata; authored template copies retain editable source. Undo/Redo restore look and geometry through the existing source snapshots.

Local cross-sections are fixed in world space. At a source joint, a manual section pins its default neighbor; two manual (or two default) values use their mean. Values interpolate between existing source samples; no extra collision samples, independently clamped chunk offsets or camera-driven shape animation appear. Shared samples receive exactly the same cross-section across mesh boundaries. Editing either of two unlocked manual sections can change their shared blend; their stored parameters remain independent. Protect a connected run to prevent such indirect changes. Normals/UV phase, run-end caps and the z=0 driving edge keep the existing builder.

The authored layout stays **48 bytes/vertex**: local width uses the existing visual depth coordinate, bounded bottoms are baked into position/look-data, and shading into existing color/base-color arrays. A tagged baked bottom bypasses the uniform floor calculation; the same shader projects its actual depth. No new vertex stream, per-section GameObject, material system or pool is introduced. Level-only settings use the existing uniform path. A local style/floor source change regenerates affected baked sections; a floor dependency can invalidate otherwise unchanged bottoms. Camera movement only updates existing constants/AABB metadata.

Projected bounds for local styles conservatively cover the full permitted width 2 m, including dirty/cached entries before materialization. Floors/ribbons remain inside the existing guarded base extent. All-visible Fit, cached ownership, deferred old/new overlap, exact 48-byte payload, CPU working estimate, remaining sprites/labels/GameObjects and separate physics/source/compiler/coordinate limits retain their caps. Resource names advance across renderer changes to avoid collision with still-retiring resources. Modal inputs consume world-edit, pan/zoom and drive commands; closing does not replay them. Short windows scroll the controls and keep menu actions above existing HTML overlays.

The same native **Terrain Look** menu is also available in normal Gym Play (Claudio extension GO after his successful Editor test). Opening it prepares the current source document without entering Edit, switching/reloading the world or resetting the vehicle. The renderer accepts only look candidates with the same chain samples as the current running station. A differing unplayed editor geometry is refused with a request to Play that design first. The draft belongs to one document instance and running-world generation; station switches cannot carry its look into another station. Retry retains the current visual preview in the same world. Close retains the draft/live appearance; Apply alone commits through the same editor Undo/autosave pipeline, and E opens that same document. A built-in station is edited as its ordinary source/template copy; the shipped station is not overwritten. Unplayed saved edits reopen in the Editor using existing recovery rules. Selected sections use the Editor's retained selection; no Play-mode selection tool or second authoring UI is introduced.

Gym menu inputs use the existing top input-stack owner and an independent capture flag, so closing it cannot release a simultaneously open feedback/import capture. Opening/closing clears held vehicle controls; commands typed into the menu are not replayed when it closes. Physics continues normally with neutral user controls; the follow camera is unchanged. Parameter changes update existing mesh constants or the affected baked buffers in place. Camera motion never recompiles source or marks meshes dirty. Legacy material/layout switches retire the old visuals with unique resource names and retain the existing replacement budget.

## Consumer boundary

#278 has explicit implementation GO. Claudio accepted the Editor preview and extended the same open PR to Gym live preview; stop for his new Gym test after its playable preview. His GO superseded the previous hold; no additional #292 practical test was reported. Later decoration, weather, atmosphere and broader visual systems are outside this slice. Physical phone/GPU evidence and load/editor spikes remain open; no general FPS or arbitrary-length claim follows from the projection.
