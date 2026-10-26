# Road look comparison contract (#290)

**Contents:** [Scope and activation](#scope-and-activation) · [Parameter set v1](#parameter-set-v1) · [Projection and spaces](#projection-and-spaces) · [Geometry and resources](#geometry-and-resources) · [Controls and retention](#controls-and-retention) · [Consumer boundary](#consumer-boundary)

## Scope and activation

This is an explicit, bounded comparison for Claudio’s visual selection. `rider.terrain_perspective = 1` is supplied only by `tools/terrain_perspective/build.py`. Ordinary builds retain the accepted renderer, 36-byte vertex layout, current source/physics/camera/Retry behavior and admission. A URL or retained parameter set cannot enable the prototype in an ordinary build. No production look is selected automatically.

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

The loader retains the shared prototype material to avoid per-proxy shader churn. The additional material/factory assets are also packaged in normal builds, but normal rendering does not select them. Baseline fixed-versus-camera measurements in the comparison include the same material/layout overhead in both modes; they do not establish a zero-cost addition relative to the earlier production executable.

## Controls and retention

The artifact-only parent panel supplies five labeled ranges plus numeric inputs. Fixed/Camera buttons compare the same set live without loading a new world. Reset restores the accepted supplied-course preset. Apply retains only a successfully acknowledged set in the preview origin’s `localStorage`; Reapply and page reopen restore it. JSON can be copied/reopened; invalid requests leave the last valid set and source untouched. A storage failure reports that retention failed and offers JSON copying.

The panel lives outside the game iframe: its arrows/numeric editing do not become drive inputs. Gameplay commands remain the existing Arrows/A/D/R/E/Home. The engine exposes only a bounded style-request interface in the explicit comparison build, not physics, source, camera mutation or debug services. Retained tuning is separate from the existing level saves/Undo/versions; the launcher preserves editor drafts instead of silently replacing them on a reload.

## Consumer boundary

#278 is not authorized by this comparison. After Claudio’s selection, reuse this parameter contract rather than another tuner. Per-section authoring, source-format migration, Undo/versioned level persistence and any production integration require their own scoped work. Physical phone/GPU evidence and load/editor spikes remain open; no general FPS or arbitrary-length claim follows from the projection.
