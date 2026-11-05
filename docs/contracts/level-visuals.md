# Level visuals contract (#537)

Binding vocabulary and data model for level materials, depth, light, backgrounds, decorations and local textures under [#121](https://github.com/bongohorse/rider/issues/121). Decisions are Claudio's of 2026-11-05 unless noted; the [#536 experiment](https://github.com/bongohorse/rider/issues/536) tested them. Issue labels hold task state.

**Contents:** [Boundary](#boundary) · [Vocabulary](#vocabulary) · [Track material](#track-material) · [Depth look](#depth-look) · [Vehicle position](#vehicle-position) · [Facing](#facing) · [Run order](#run-order) · [Light](#light) · [Vehicle shadow](#vehicle-shadow) · [Backgrounds and foreground](#backgrounds-and-foreground) · [Decorations](#decorations) · [Local textures](#local-textures) · [Format and compatibility](#format-and-compatibility) · [Assets](#assets) · [Measurement](#measurement) · [Task map](#task-map)

## Boundary

Everything here is visual. It never reads or writes collision, physics, replay or the follow camera. The collision plane and driving line stay where the compiled level puts them. The [road-look contract](road-look.md) still owns parameter set v1, the projection, resources and Terrain Look controls; this contract owns what later tasks add to them.

## Vocabulary

| Term | Meaning |
| --- | --- |
| Driving line | The compiled terrain line the wheels touch. |
| Surface | The top of the track, seen from above. |
| Side Band (Band) | The strip that follows the driving line down the front face, such as a grass edge. |
| Side Fill (Fill) | The body below and behind the Band, such as earth. |
| Level material | One Surface, Band and Fill choice for a whole level. |
| Override | A replacement for one of those three in the level material. |
| Rim, End | Internal geometry derived by the renderer, not authored. They replace nothing a level stores. |
| Depth | The one control per parallax layer; it drives movement in X and Y. |

## Track material

- A level has one material, with optional Surface, Band and Fill overrides. Materials per section, material changes along the track and dark zones are later work.
- **Surface** repeats along the track and shows one cross-section over its width, without repeating across it.
- **Band** follows the driving line and shows once. It repeats along the track and is transparent below its art. On very steep slopes it compresses along the line; the Smooth Tool ([#564](https://github.com/bongohorse/rider/issues/564)) is the remedy, not a slope limit.
- **Fill** lies in world coordinates and repeats, so it never stretches. Claudio chose this on 2026-11-05: "texture verzerrung will ich nicht".
- Surface and Band meet in one colour at the fold, without a hard light edge.
- The textured route keeps its 52-byte vertex and no new vertex stream. Levels without a material stay byte-identical at 36 or 48 bytes, according to their profile.
- The Surface art may have a frayed transparent far edge above an opaque lower zone. The contact side stays opaque, so the wheels never appear to touch a hole. Above image row 24 of 128 the art blends over whatever lies behind the run: the background or an earlier run. Below it the art lies over Fill.

## Depth look

Claudio chose these values on 2026-11-05. No level has a material before this work, so the rule is:

- The first material Apply replaces the level-wide look with these defaults and enables the authored profile, also on a legacy level. The panel previews this before Apply, and Apply is one Undo step. Section overrides stay. [#542](https://github.com/bongohorse/rider/issues/542) stores the material and enables the profile, [#573](https://github.com/bongohorse/rider/issues/573) sets these values, and [#543](https://github.com/bongohorse/rider/issues/543) offers it.
- A level without a material keeps its values and parameter set v1.
- Parameter set v2 is valid only on a level with a material; without one it is refused.

| Value | Default | Range |
| --- | --- | --- |
| `width` | 0.6 m | 0.05–4 |
| `perspective` | 6 | 0–6 |
| `angle` | 45° | 0–75 |
| `side` | 64 m | 0.25–64 |
| `shading` | 1.15 | 0–2 |
| `vehicle_position` | 0.5 | 0–1 |

These ranges come from the #536 prototype, where Claudio used them. He confirms them with the GO of [#573](https://github.com/bongohorse/rider/issues/573). They form parameter set v2:

- v2 is stored as `road_look.params.version` 2. It has the fields of v1 plus `vehicle_position`, and a wider range for the listed values.
- The `road_look.version` container, the section override version and the `authored-v1` profile ID stay at their present values. An older reader refuses `params.version` 2.
- Section overrides of `width`, `side` and `shading` use the v2 ranges on a level with v2.
- `vehicle_position`, `perspective` and `angle` are level-wide.
- Set v1 keeps its ranges and meaning.

The formula in [road-look.md](road-look.md#projection-and-spaces) stays, with the body shift below. These [road-look.md](road-look.md) limits hold only for v1: the denominator of at most 1.05 with no folds, and the 2 m bound for local styles. In v2 the denominator lies between 0.4 and 1.6, [Facing](#facing) handles folds, and bounds use a width of up to 4 m.

## Vehicle position

`vehicle_position` sets where the driving line lies on the Surface: `0` at the front edge, `1` at the back edge. The renderer moves the complete visible body by `vehicle_position × width` in front of the line, using the local width where a section override sets one, so the vehicle stays on the middle there too. The shift needs no new geometry, and projected bounds include it. The value exists only in v2, so levels without a material have no shift.

## Facing

On a level with a material, a face that turns away from the camera is hidden, never drawn over a face in front of it. This covers run-end caps on both sides and the Surface. A level without a material keeps its present streams, so these faces stay drawn there, as they always were. The Surface folds at `tan(angle) / (perspective / 40)` above the camera centre: about 6.7 m with the values above, so zoomed-out views depend on this rule.

## Run order

Where two runs overlap, the one that is lower in that overlap is in front (Claudio's idea of 2026-11-05). Height is compared only inside the overlap, so a bridge stays behind a long climb that passes under it. All sections of a run share one draw position, so runs that truly cross keep one order: the rule holds where one run is lower throughout. This applies on all routes, in Play and in Edit. Terrain stays behind all other world objects.

## Light

Static light bakes into existing colour data and never follows the camera. It comes softly from the upper left: rising faces brighten and falling faces darken, while flat ground stays neutral. It fades within a few metres below the driving line, and the Surface darkens slightly towards its back edge. `shading` sets the strength, and a section override sets it locally. Starting values from the prototype, which [#541](https://github.com/bongohorse/rider/issues/541) may tune:

| Value | Start |
| --- | --- |
| Light direction | (-0.55, 0.83) |
| Gain limits | 0.62–1.22 |
| Fade below the line | `exp(-drop / 2.5 m)` |
| Body darkening | `mix(0.7, 1, exp(-drop / 5 m))` |
| Surface back edge | 0.86 |

## Vehicle shadow

A soft ellipse lies on the driving line below the vehicle and follows the slope. It gets smaller and lighter with height. Over a gap with no ground below it disappears. It reads wheel positions and driving lines, not physics state, and its lookup must stay cheap on a full-size level. Starting values, which Claudio judges in the [#572](https://github.com/bongohorse/rider/issues/572) drive test:

| Value | Start |
| --- | --- |
| Width | 1.7 × wheel distance, with a 5:1 ellipse |
| Strength | 0.5 on the ground, 0.08 at the fade height |
| Size | 100% on the ground, 40% at the fade height |
| Fade height | 4 m |

## Backgrounds and foreground

- A level has up to five background layers and one foreground, stored as one level-wide block: preset ID and, per layer, visibility, image, Depth and Auto.
- One Depth value per layer drives X and Y. Auto is the default. [#545](https://github.com/bongohorse/rider/issues/545) measures the cost. [#546](https://github.com/bongohorse/rider/issues/546) defines the Depth range, its mapping to X and Y, and what Auto selects; [#548](https://github.com/bongohorse/rider/issues/548) validates that range.
- Vertical motion never shows a gap, and empty layers cost nothing.
- The foreground stays in a safe zone at the lower edge and draws below the HUD and touch controls.
- A missing image falls back to the preset.

## Decorations

- A decoration belongs to the track, not to world XY: terrain source ID, position along the run, offset from the line, placement, tilt flag and asset ID.
- Placements are Behind, Front and Body. Body is darkened inside the terrain body.
- Anchors resolve to a position and angle on compiled samples, and a track edit refits them on release.
- Decorations have no collider and no effect on physics or replay. Rendering stays within the 1024 sprite and game object pools, with an actionable refusal.

## Local textures

- Imported images stay in a browser-local store with a size budget, keyed by content hash. Levels hold references only, which protects the 256 KiB source limit.
- Local textures are not exported with a level. Claudio promotes an image to a built-in preset through GitHub ([#556](https://github.com/bongohorse/rider/issues/556)).
- A missing texture shows its preset and a warning. A failed store never touches the level save.

## Format and compatibility

- A saved reference is a stable preset ID or a local content hash, never a path. An unknown preset ID is refused. A local hash whose data is missing falls back to the level's preset, with a warning.
- A layer or surface that references a local hash also names the preset it falls back to.
- A task that adds a stored block or value raises the version in that task; `road_look.params.version` 2 carries parameter set v2.
- The level material is `editor.material`: `{"version":1,"preset":"meadow","surface":"quarry"}`, where `surface`, `band` and `fill` are optional overrides. It needs editor and compiler version 14 and the authored profile, and compiles to `material` in station schema 6. New documents stay at version 13 until they get a material, so older readers keep opening them.
- Unknown versions and values are refused and the original file stays unchanged, as in [road-look.md](road-look.md#production-compatibility). Older levels stay byte-identical until an explicit Apply.
- `terrain_material` in the URL works only in debug builds, as a test override.

## Assets

- Original generated assets are the normal source and need recorded generation inputs and provenance. Do not wait for supplied final art.
- Claudio may supply assets to complement or replace them; those need recorded permission.
- Kenney assets are test fixtures, separate from the original presets. They stay until Claudio explicitly asks to remove them.
- Nothing is copied from a third-party game's assets or look, and Claudio's reference stills stay out of the repository.
- Claudio approves art direction.

## Measurement

- The 1 MiB Fit payload and 16 MiB CPU working limits in `main/game/terrain_budget.lua` stay.
- Three 512 px textures with mipmaps cost about 4.2 MB by calculation. [#539](https://github.com/bongohorse/rider/issues/539) ships the texture profile that gives terrain textures mipmaps. [#544](https://github.com/bongohorse/rider/issues/544) measures real cost and the profile's effect on the sprite atlas.
- Software-rendered frame times prove nothing about a device. Real GPU and phone cost stays NOT RUN until Claudio's device session.

## Task map

| Section | Tasks |
| --- | --- |
| Track material | [#538](https://github.com/bongohorse/rider/issues/538), [#539](https://github.com/bongohorse/rider/issues/539), [#540](https://github.com/bongohorse/rider/issues/540), [#543](https://github.com/bongohorse/rider/issues/543) |
| Depth look | [#573](https://github.com/bongohorse/rider/issues/573) |
| Vehicle position | [#571](https://github.com/bongohorse/rider/issues/571) |
| Facing | [#570](https://github.com/bongohorse/rider/issues/570) |
| Run order | [#577](https://github.com/bongohorse/rider/issues/577) |
| Light | [#541](https://github.com/bongohorse/rider/issues/541) |
| Vehicle shadow | [#572](https://github.com/bongohorse/rider/issues/572) |
| Backgrounds and foreground | Epic [#565](https://github.com/bongohorse/rider/issues/565) |
| Decorations | Epic [#567](https://github.com/bongohorse/rider/issues/567) |
| Local textures | Epic [#566](https://github.com/bongohorse/rider/issues/566) |
| Format and compatibility | [#542](https://github.com/bongohorse/rider/issues/542), [#548](https://github.com/bongohorse/rider/issues/548), [#557](https://github.com/bongohorse/rider/issues/557), [#552](https://github.com/bongohorse/rider/issues/552) |
| Measurement | [#544](https://github.com/bongohorse/rider/issues/544) |
