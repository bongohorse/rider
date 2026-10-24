<a id="graphics"></a>
## Terrain, depth, shaders and presentation assets

All findings in this chapter concern **shipped source/data**, not captured rendering. Program selection, uniform producers, framebuffer configuration, blend/depth state and CPU update order require separate evidence. Claim IDs prefixed `AS-` link to exact paths, line ranges or decoded-asset pointers and hashes.

### Terrain representation and shader-side edge extension

**Confirmed — vertex contract.** In original `terrain.vsh`, `a_position.xyz` supplies geometry, `a_texCoord.xy` UV, `.z` lighting and `.w` a `drawToEdge` factor. `a_position.w` is forwarded as a separate multiplier. The following is a direct mathematical restatement of the original shader, **not recovered CPU pseudocode**: [AS-G01–G03](#claim-as-g01)

```text
e = a_texCoord.w
newY = (1-e)*y + e*min(y + u_params.y, u_cameraBottom)
texScale = (newY-y) / u_params.y
finalXYZ = (x, newY, z) + (u_params.x*e, 0,
                                         u_params.z*max(1,texScale)*e)
clipPosition = CC_MVPMatrix * (finalXYZ, 1)
UV.y += u_params.w * texScale
```

For an edge factor of 0 the vertex retains its original location. For 1 the lower edge can extend to the smaller of a configured lower position and supplied camera bottom. Fractional values interpolate. The shader also extends tiling and changes depth. Its fragment program samples `CC_Texture0`, multiplies RGB by interpolated lighting and applies the separate multiplier; a declared `u_texture` is unused in the active expression.

This is a concrete **visual terrain-body mechanism**. Neither its world units nor the sign/range of CPU uniforms is established. There is no shader-side guard here against `u_params.y==0`. It does not reveal whether CPU geometry uses pairs, strips, indexed triangles, baked meshes or chunk pooling. It also does not prove that the top edge equals a Box2D collision spline. The prototype's negativeZoffset is not identical to this shader's signed addition. [P06](#claim-p06)

**Unknown — authored curve and collision compilation.** Catmull–Rom, Bézier, Hermite, linear control segments, arc-length sampling, adaptive tessellation, terrain chunk size and runtime assembly are not established by the inspected originals. Opaque `.json`/`.rube` files cannot supply their parameters yet. These questions must stay separate from the confirmed GPU expression.

### Depth, projection and authored models

**Confirmed.** `tunnel.vsh` projects explicit xyz through `CC_MVPMatrix` and treats position.w as lighting; its fragment code multiplies texture RGB by that light without multiplying alpha by it. This is vertex-authored lighting, not evidence of dynamic tunnel occlusion or a cylindrical CPU generator. [AS-G04–G05](#claim-as-g04)

An original arena-ramp OBJ has differing Z coordinates, 77 position vertices, 126 UV records and 91 face records. Its header identifies Blender 2.91.2 and `arena-ramp12.blend`; the accompanying MTL supplies material coefficients and `map_Kd arena-ramp.png`. [AS-M01–M02](#claim-as-m01). This proves authored 3D geometry in that asset. It does not establish its collision mesh, current rendering, importer treatment of every material coefficient, or a globally perspective-rendered/3D simulated game.

`CC_MVPMatrix` alone cannot distinguish orthographic from perspective projection. A camera can project depth-bearing geometry orthographically. Conversely, apparent depth can come from layering, vertex color, UVshifts and authored geometry without 3D physics. For Rider's stated 2D direction, the transferable lesson is separation of collision, visual edge, body fill and background; copying a perspective camera is unnecessary.

### Materials, height effects and parallax

**Confirmed.** The caustic surface shader derives its blend from `clamp((vertexY-u_depthfade.y)/u_depthfade.x,0,1)`. Its fragment stage mixes base textures, applies lighting and adds shifted texture RGB weighted by alpha, the coefficient and `9.5*y*(1-y)^3`. Here `depthfade` is a **height-derived factor**, not sampled depth-buffer information. [AS-G06–G07](#claim-as-g06)

`parallax_multi.vsh` uses `CC_PMatrix` and divides incoming UV.y by `multi_size`. The fragment code selects nine supplied strip entries through a wrapped floor-based index, scaling horizontal coordinates by `aspectX/multi_scale`. This is a texture-layer/strip selection mechanism; layer velocity, CPU camera coupling and actual draw order are unknown. [AS-G08–G09](#claim-as-g08)

`model_float.vsh` adds `u_b*sin(u_a*CC_Time[0])` to **clip-space Y after MVP** and flips UV.y. This must not be described as a world-space buoyancy/rigid-body simulation. Under perspective, clip-space modification can have different screen consequences depending on W. [AS-G10](#claim-as-g10). The waterfall vertex shader transforms a supplied player position using `u_ssize_cview` and `CC_PMatrix`; it proves an input dependency, not its native producer or camera law. [AS-G11](#claim-as-g11)

### Particles, liquids and postprocessing

**Confirmed.** A liquid postprocess samples a field from `CC_Texture0`, derives `d=(0.5/16)/field.a`, and, when `d<1`, samples `CC_Texture1` at `0.5+d*normalize(field.rg-0.5)`; otherwise it discards. This gives a concrete two-texture field/composition contract. The accumulation pass, field-generation algorithm, blend state, target resolution and simulation are unknown. [AS-G12](#claim-as-g12)

Droplet distortion has an active intensity threshold `u_intensity>0.01`, procedural masks, a centered 1.075 scale distortion and water tint; below that it copies the source texture. Weather activation and effect curves remain unknown. A shader named `postprocess_generic2` only copies `CC_Texture0` in active main; `particle_animated_2.fsh` likewise performs a direct copy despite declarations/debug code. Filename-based claims of implemented complex effects are unwarranted. The sky fragment is simply sampled texture times `u_color`. [AS-G13–G16](#claim-as-g13)

**Confirmed — serialized effect data.** The supplied `pinata_trail.efkefc` contains original editor XML and a runtime `BIN_` identical to its sibling `.efk`. Editor metadata says ToolVersion 1.53e. A compatible authoritative Effekseer1.53creader consumed all1,988runtime bytes through279typed reads, revealing five nodes: root, twoNoneparents and twoTrackleaves. This was a parser invocation, not effect-script execution, simulation or rendering. [AS-P01,AS-P04](#claim-as-p01)

One stored parent has `MaxGeneration=1`, `life` 100, `generationTime=1`, transform binds `Always`, translation `(-0.9,-0.2,0)` with zero velocity/acceleration and rotation velocity X approximately 0.104719758. A Trackleaf stores `MaxGeneration=2147483647`, lifetime 100, generationTime 1 and binds `WhenCreating`. These are **reader-bound serialized values**; no actual concurrent particle count, world-unit scale, timebase or game attachment is inferred. [AS-P02–P03](#claim-as-p02)

### Vehicle-specific visual effects

**Confirmed.** Wheel sprite-sheet vertex code transforms mask UV through `u_transform`, adjusts the atlas center/aspect and supplied sheet dimensions. Its comment names `SpriteTransforms::setMaskUniforms()` as a possible native producer to search; the comment is not a verified call binding. The fragment program blends/selects sheet tiers according to `u_blend`/`u_blendmode`, retains alpha from tier 0 and multiplies by tint/vertex color. This establishes visual tier blending, **not tire wear, damage, grip or upgrade semantics**. [AS-V01–V02](#claim-as-v01)

Rotational texture blur takes 10 samples, accumulates squared RGBA and outputs `sqrt(sum/10)`; an annular spinner region takes one stationary sample. The translation-blur code is commented out. This is not evidence of a fullscreen velocity-buffer pipeline. Iridescent vehicle shading uses mask/base textures, normalized fragment coordinates, time and `0.25*u_playerRot`, synthesizes HSV color and overlays with a 0.2-weighted mask. Actual wheel-speed/orientation producers remain unknown. Box-blur behavior follows exact nested-loop bounds and the supplied step; normalization cannot be assumed from its name. [AS-V03–V05](#claim-as-v03)

### UI layouts, timelines and feedback

**Confirmed — authored layout, not universal device dimensions.** The decoded `reward_popup_currency.csb` root is a 960×640 Layer with zero-duration action and no timelines. A `closer` button has touch enabled, alpha 221, approximately `(481.44,320)` position and 1344×704 size; its callback fields are empty. This supports an oversized authored hit area but **does not prove dismissal behavior**, which may be bound in code. It does not establish global UI scaling or device resolution. [AS-U01–U02](#claim-as-u01)

`season_rank_icon_item.csb` stores action duration 1393 and speed 0.5, plus 25 named clips: `rank1` frames 0–18, `rank6` 385–401 and `rank6_idle` 1325–1393. Timelines bind through `actionTag`; stored entries include frameIndex, tween and easingData. A position key at frame 385 for tag `-1247020007` stores `(0,0)`, tween 1 and easing type 0. These are **frame indices**, not seconds; trigger conditions and framebase are unresolved. [AS-U03–U04](#claim-as-u03)

The verified CSB decoder uses pinned compatible Cocos readers/schema, including animation/timeline structures; it should be preferred to historical exports with incorrect wrapper/field assignments. Runtime node binding, localization substitution, HUD quantities, screen navigation and callback order remain separate questions. A layout name such as `CupRacePanel` does not establish its complete logic.

### Textures, atlases and audio

**Confirmed.** The `savanna_gfx.plist` specifies TexturePacker format 3, a 512×1024 RGBA8888 texture and `premultiplyAlpha=false`. Its tree frame defines a packed rectangle, 512×512 source size, offset and no rotation. Another original atlas has a 1254×1032 texture, Linear filters, packed bounds and optional 90° rotations/offsets. These are actual placement contracts; they do not establish runtime blend state, batch membership or animation scheduling. [AS-A01–A02](#claim-as-a01)

`backfire_single.ogg` fully decodes to 4,145 mono samples at 48,000 Hz, about 0.086354 seconds. Its filename is an intended-use lead; trigger, mixing gain, pitch scaling, looping and voice management are unknown. OpenSLES imports establish audio capability separately. [AS-AU01](#claim-as-au01)

### Formats, serialization and coverage limits

The base asset inventory records 128 `.vsh`,126 `.fsh`,276 `.obj`,209 `.mtl`,1,255 `.csb`,549 `.plist`,447 `.ogg`,7,115 `.png`,191 `.rube` and 1,794 `.json` files. These are file-extension counts, not shader programs, loaded resources or successfully interpreted configurations. [AS-F01](#claim-as-f01)

Of theJSON-extension files,1,717and all 191 RUBE-extension files share the binary prefix `1213aa1213ba13ba` without a validated game-format reader. Do not read their extension as decoded JSON or infer AES from the marker. [AS-F02](#claim-as-f02). DAT analysis preserves63complete wire-compatible originals,42unsupported/incomplete streams and36fully consumed zlib payloads, with raw ranges and nested candidates. No accepted reader/writer assigns the old replay/physics field meanings. [AS-F03](#claim-as-f03)

CSB/FlatBuffers, property-list XML, WavefrontOBJ/MTL, atlas metadata, Oggmedia, Effekseer containers and zlib payloads are therefore distinct evidence types. Structural consumption, byte preservation and semantic understanding must be tracked separately. Version metadata in an editor asset identifies that asset's tooling, not a universal game-engine version.

