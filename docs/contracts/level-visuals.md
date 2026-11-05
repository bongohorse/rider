# Level visuals contract (#537)

Binding vocabulary and data model for level materials, depth, light, backgrounds, decorations and local textures under [#121](https://github.com/bongohorse/rider/issues/121). Decisions are Claudio's of 2026-11-05 unless noted; the [#536 experiment](https://github.com/bongohorse/rider/issues/536) tested them. Issue labels hold task state.

**Contents:** [Boundary](#boundary) · [Vocabulary](#vocabulary) · [Track material](#track-material) · [Depth look](#depth-look) · [Vehicle position](#vehicle-position) · [Facing](#facing) · [Light](#light) · [Vehicle shadow](#vehicle-shadow) · [Backgrounds and foreground](#backgrounds-and-foreground) · [Decorations](#decorations) · [Local textures](#local-textures) · [Format and compatibility](#format-and-compatibility) · [Assets](#assets) · [Measurement](#measurement) · [Task map](#task-map)

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
- The textured route keeps its 52-byte vertex and no new vertex stream; untextured levels stay byte-identical on 48 bytes.

## Depth look

Claudio chose these values on 2026-11-05. They are the default for a level that first gets a material. Existing levels keep their values until an explicit Apply.

| Value | Default | Range |
| --- | --- | --- |
| `width` | 0.6 m | 0.05–4 |
| `perspective` | 6 | 0–6 |
| `angle` | 45° | 0–75 |
| `side` | 64 m | 0.25–64 |
| `shading` | 1.15 | 0–2 |
| `vehicle_position` | 0.5 | 0–1 |

These ranges come from the #536 prototype. They form parameter set v2, which adds `vehicle_position` and otherwise uses the fields of v1. The formula in [road-look.md](road-look.md#projection-and-spaces) stays, with the body shift below. Set v1 keeps its ranges and meaning.

## Vehicle position

`vehicle_position` sets where the driving line lies on the Surface: `0` at the front edge, `1` at the back edge. The renderer moves the complete visible body by `vehicle_position × width` in front of the line, so the shift is rigid and needs no new geometry. Projected bounds include the shift. It applies to textured levels; untextured levels stay at `0`.

## Facing

A face that turns away from the camera is hidden, never drawn over a face in front of it. This covers run-end caps on both sides and the Surface. With the values above the Surface folds at `tan(angle) / (perspective / 40)` above the camera centre, about 6.7 m, so zoomed-out views depend on this rule.

## Light

Static light bakes into existing colour data and never follows the camera. It comes softly from the upper left: rising faces brighten and falling faces darken, while flat ground stays neutral. It fades within a few metres below the driving line, and the Surface darkens slightly towards its back edge. `shading` sets the strength. Starting values from the prototype, which [#541](https://github.com/bongohorse/rider/issues/541) may tune:

| Value | Start |
| --- | --- |
| Light direction | (-0.55, 0.83) |
| Gain limits | 0.62–1.22 |
| Fade below the line | 2.5 m |
| Body darkening | to 0.7, over 5 m |
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
- One Depth value per layer drives X and Y. Auto is the default. [#545](https://github.com/bongohorse/rider/issues/545) measures the cost and [#546](https://github.com/bongohorse/rider/issues/546) sets the value mapping.
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

- A saved reference is a stable preset ID or a local content hash, never a path.
- The format is editor and compiler version 13 before these tasks. A task that adds a stored block or value raises the version in that task; `road_look.version` 2 carries parameter set v2.
- Unknown versions and values are refused and the original file stays unchanged, as in [road-look.md](road-look.md#production-compatibility). Older levels stay byte-identical until an explicit Apply.
- `terrain_material` in the URL is a temporary pilot, and [#542](https://github.com/bongohorse/rider/issues/542) replaces it.

## Assets

- Original generated assets are the normal source and need recorded generation inputs and provenance. Do not wait for supplied final art.
- Claudio may supply assets to complement or replace them; those need recorded permission.
- Kenney assets are test fixtures, separate from the original presets. They stay until Claudio explicitly asks to remove them.
- Nothing is copied from a third-party game's assets or look, and Claudio's reference stills stay out of the repository.
- Claudio approves art direction.

## Measurement

- The 1 MiB Fit payload and 16 MiB CPU working limits in `main/game/terrain_budget.lua` stay.
- Three 512 px textures with mipmaps cost about 4.2 MB by calculation. [#544](https://github.com/bongohorse/rider/issues/544) measures real cost and the effect of the #536 mipmap texture profile on the sprite atlas.
- Software-rendered frame times prove nothing about a device. Real GPU and phone cost stays NOT RUN until Claudio's device session.

## Task map

| Section | Tasks |
| --- | --- |
| Track material | [#538](https://github.com/bongohorse/rider/issues/538), [#539](https://github.com/bongohorse/rider/issues/539), [#540](https://github.com/bongohorse/rider/issues/540), [#543](https://github.com/bongohorse/rider/issues/543) |
| Depth look | [#573](https://github.com/bongohorse/rider/issues/573) |
| Vehicle position | [#571](https://github.com/bongohorse/rider/issues/571) |
| Facing | [#570](https://github.com/bongohorse/rider/issues/570) |
| Light | [#541](https://github.com/bongohorse/rider/issues/541) |
| Vehicle shadow | [#572](https://github.com/bongohorse/rider/issues/572) |
| Backgrounds and foreground | Epic [#565](https://github.com/bongohorse/rider/issues/565) |
| Decorations | Epic [#567](https://github.com/bongohorse/rider/issues/567) |
| Local textures | Epic [#566](https://github.com/bongohorse/rider/issues/566) |
| Format and compatibility | [#542](https://github.com/bongohorse/rider/issues/542), [#548](https://github.com/bongohorse/rider/issues/548), [#557](https://github.com/bongohorse/rider/issues/557), [#552](https://github.com/bongohorse/rider/issues/552) |
| Measurement | [#544](https://github.com/bongohorse/rider/issues/544) |
