# Graphics, authored UI and asset pipeline evidence

This chapter documents shipped data and source computations. It does not infer CPU terrain generation, camera control, physics, render-pass scheduling or live behavior from filenames. Original inputs and prior recovery outputs remain unchanged. Claims are reproducible through the paired JSON inventory, which records SHA-256 for every cited evidence file.

## GPU geometry and visual depth

Terrain supplies explicit xyz vertices and per-vertex presentation metadata. Its bottom-extension shader changes geometry and texture tiling relative to a supplied camera-bottom uniform. This demonstrates a visual edge treatment, not a collision-terrain algorithm. Tunnel shading and caustics use vertex lighting and height-based blending. Static OBJ meshes contain actual depth coordinates; these establish authored 3D geometry without establishing the overall camera projection or simulation dimensionality.

Projection usage is asset-specific: terrain/tunnel use CC_MVPMatrix; parallax and waterfall use CC_PMatrix; model_float applies a sine displacement after model/view/projection. Preserve that distinction in any reconstruction. Values for these matrices and uniforms still require verified native producer/caller evidence.

## Source-bound observations

### G01

a_texCoord.xy supplies UV, z supplies lighting, w supplies drawToEdge; a_position.w is forwarded separately as a multiplier. Vertex xyz is projected through CC_MVPMatrix.

Evidence: `/workspace/HC2/decompiled/unpacked/base.apk/assets/Common/shaders/terrain.vsh` — lines 1–9,19–28.

Limit: Shipped shader source establishes this computation; active program selection, uniform values, render state and CPU callers are not established by this source alone.

### G02

newY=(1-edge)*y+edge*min(y+u_params.y,u_cameraBottom); diff=newY-y; texScale=diff/u_params.y. x offset=u_params.x*edge, z offset=u_params.z*max(1,texScale)*edge; UV.y receives u_params.w*texScale. This is shader-side bottom extension/tiling, not a terrain generator.

Evidence: `/workspace/HC2/decompiled/unpacked/base.apk/assets/Common/shaders/terrain.vsh` — lines 19–28.

Limit: No CPU mesh creation, triangulation, physics collision, coordinate units, camera follow law or protection against zero u_params.y is proven here.

### G03

Active fragment expression is texture2D(CC_Texture0,UV)*vec4(light,light,light,1)*multiplier. Declared u_texture is unused in the active expression.

Evidence: `/workspace/HC2/decompiled/unpacked/base.apk/assets/Common/shaders/terrain.fsh` — lines 9–16.

Limit: Shipped shader source establishes this computation; active program selection, uniform values, render state and CPU callers are not established by this source alone.

### G04

Tunnel shader treats input position.w as lighting and projects xyz using CC_MVPMatrix.

Evidence: `/workspace/HC2/decompiled/unpacked/base.apk/assets/Common/shaders/tunnel.vsh` — lines 11–15.

Limit: Shipped shader source establishes this computation; active program selection, uniform values, render state and CPU callers are not established by this source alone.

### G05

Tunnel texture RGB is multiplied by interpolated lighting; alpha is not multiplied by lighting in this expression.

Evidence: `/workspace/HC2/decompiled/unpacked/base.apk/assets/Common/shaders/tunnel.fsh` — lines 14–17.

Limit: Shipped shader source establishes this computation; active program selection, uniform values, render state and CPU callers are not established by this source alone.

### G06

Caustic blend coefficient is clamp((vertexY-u_depthfade.y)/u_depthfade.x,0,1). Depth here is a height-driven factor, not a sampled depth buffer.

Evidence: `/workspace/HC2/decompiled/unpacked/base.apk/assets/Common/shaders/terrain_surface_caustics.vsh` — lines 4,16–18.

Limit: Shipped shader source establishes this computation; active program selection, uniform values, render state and CPU callers are not established by this source alone.

### G07

Caustics mix CC_Texture2 and CC_Texture0 by the vertex coefficient; multiply lighting and multiplier; then add shifted CC_Texture1 RGB weighted by alpha, coefficient and 9.5*y*(1-y)^3.

Evidence: `/workspace/HC2/decompiled/unpacked/base.apk/assets/Common/shaders/terrain_surface_caustics.fsh` — lines 11–24.

Limit: Shipped shader source establishes this computation; active program selection, uniform values, render state and CPU callers are not established by this source alone.

### G08

Parallax vertex projection uses CC_PMatrix and divides incoming UV.y by multi_size.

Evidence: `/workspace/HC2/decompiled/unpacked/base.apk/assets/Common/shaders/parallax_multi.vsh` — lines 6–11.

Limit: Shipped shader source establishes this computation; active program selection, uniform values, render state and CPU callers are not established by this source alone.

### G09

Nine entries supplied by loop1/2/3 select vertical texture strip offsets using a wrapped floor-based index. Horizontal coordinate scales by aspectX/multi_scale.

Evidence: `/workspace/HC2/decompiled/unpacked/base.apk/assets/Common/shaders/parallax_multi.fsh` — lines 6–12,20–45.

Limit: No CPU parallax layer velocities, camera displacement coupling or layer scheduling can be inferred from these uniforms.

### G10

After CC_MVPMatrix projection, clip-space y receives u_b*sin(u_a*CC_Time[0]); UV.y is flipped. This differs from moving a world-space rigid body.

Evidence: `/workspace/HC2/decompiled/unpacked/base.apk/assets/Common/shaders/model_float.vsh` — lines 5–20.

Limit: Shipped shader source establishes this computation; active program selection, uniform values, render state and CPU callers are not established by this source alone.

### G11

Uses u_ssize_cview and CC_PMatrix to convert supplied player position to screen-related coordinates, passing it to the fragment stage; geometry also uses CC_PMatrix.

Evidence: `/workspace/HC2/decompiled/unpacked/base.apk/assets/Common/shaders/waterfall.vsh` — lines 18–35,38–47.

Limit: Uniform producer and camera model remain unknown. An author comment expresses uncertainty; it is not a reliable specification.

### G12

Samples a field from CC_Texture0, computes d=(0.5/16)/field.a; for d<1 samples CC_Texture1 at 0.5+d*normalize(field.rg-0.5), otherwise discards.

Evidence: `/workspace/HC2/decompiled/unpacked/base.apk/assets/Common/shaders/particle_liquid_postprocess.fsh` — lines 10–24.

Limit: Shows a two-texture liquid-field composition capability. Does not establish the field accumulation pass, blend state, render-target resolution or simulation.

### G13

For u_intensity>0.01, creates aspect-correct rotated tiled procedural droplet masks, distorts scene UV toward a centered 1.075 scale, and mixes a water tint. Otherwise copies CC_Texture0.

Evidence: `/workspace/HC2/decompiled/unpacked/base.apk/assets/Common/shaders/postprocess_droplet_distort.fsh` — lines 89–118,132–193,219–223.

Limit: Declared uniforms and commented experiments are not active behavior. Weather triggers, intensity curves, framebuffer setup and pass ordering are not established.

### G14

Despite multiple declared uniforms, active main only samples CC_Texture0 and writes the result.

Evidence: `/workspace/HC2/decompiled/unpacked/base.apk/assets/Common/shaders/postprocess_generic2.fsh` — lines 7–27.

Limit: Names and declarations alone must not be described as a functioning multi-input postprocessor.

### G15

Active fragment main is a direct texture copy; debug overloads above are unused here.

Evidence: `/workspace/HC2/decompiled/unpacked/base.apk/assets/Common/shaders/particle_animated_2.fsh` — lines 58–61.

Limit: Filename does not prove animated sprites. Vertex time varying is not read by active fragment code.

### G16

Sky fragment is texture2D(u_texture,UV)*u_color.

Evidence: `/workspace/HC2/decompiled/unpacked/base.apk/assets/Common/shaders/sky.fsh` — lines 12–17.

Limit: Shipped shader source establishes this computation; active program selection, uniform values, render state and CPU callers are not established by this source alone.

### M01

Original OBJ header identifies Blender 2.91.2 and arena-ramp12.blend; this file contains 77 position vertices,126 UV records,91 face records,0 vn records and one material use. Coordinates include differing z values, demonstrating authored 3D mesh geometry.

Evidence: `/workspace/HC2/decompiled/unpacked/base.apk/assets/Common/models/arena-ramp/arena-ramp-middle.obj` — lines 1–5 and v/vt/f records throughout.

Limit: One static ramp mesh is not evidence of terrain topology construction, runtime collision mesh, perspective camera, or a fully 3D game simulation.

### M02

Material provides Ns/Ka/Kd/Ks/Ke/Ni/d/illum and map_Kd arena-ramp.png.

Evidence: `/workspace/HC2/decompiled/unpacked/base.apk/assets/Common/models/arena-ramp/arena-ramp-middle.mtl` — lines 4–13.

Limit: These are supplied material records; importer support and exact GPU interpretation need runtime/native evidence.

### A01

TexturePacker format3 metadata names savanna_gfx.png,512x1024,RGBA8888,premultiplyAlpha=false. Tree frame records textureRect {{1,1},{466,512}}, spriteSourceSize512x512, offset{-3,0}, textureRotated=false.

Evidence: `/workspace/HC2/decompiled/unpacked/base.apk/assets/HD/savanna_gfx.plist` — XML dictionary metadata and frames/textures/parallaxes/savanna_tree.png.

Limit: Frame metadata permits faithful atlas placement; it does not independently establish runtime blending or parallax motion.

### A02

Atlas names nationalpark_adventure_icon.png,1254x1032,Linear/Linear filters, packed bounds and optional offsets/90-degree rotations.

Evidence: `/workspace/HC2/decompiled/unpacked/base.apk/assets/Common/ui/cocosstudio/adventureIcons/animations/nationalpark/nationalpark_adventure_icon.atlas` — lines 1–18.

Limit: Atlas regions alone do not define skeleton animation playback or UI selection behavior.

### U01

Decoded authored root Layer has size960x640, anchor0,0, position0,0; /action has duration0,speed1,no timelines.

Evidence: `/workspace/HC2/decompiled/codex_verified/assets/decoded/base.apk/assets/Common/ui/cocosstudio/reward_popup_currency.csb.json` — /nodeTree/options/data; source CSB WidgetOptions offset8140.

Limit: 960x640 is this asset design canvas, not proof of device resolution, global scaling policy or camera size.

### U02

Button named closer has touchEnabled1, alpha221, position≈481.44,320, size1344x704; percent position≈0.5015,0.5, percent size≈1.4,1.1. Callback type/name are empty.

Evidence: `/workspace/HC2/decompiled/codex_verified/assets/decoded/base.apk/assets/Common/ui/cocosstudio/reward_popup_currency.csb.json` — /nodeTree/children/0/options/data/widgetOptions; source CSB offsets7556,7852,8016.

Limit: Authored hit-area/layout data does not prove event binding, dismissal behavior or runtime overrides.

### U03

Authored action duration1393,speed0.5;25 named clips include rank1 frames0–18,rank6 frames385–401,rank6_idle frames1325–1393. Timeline entries bind by actionTag and carry frameIndex,tween,easingData.

Evidence: `/workspace/HC2/decompiled/codex_verified/assets/decoded/base.apk/assets/Common/ui/cocosstudio/season_rank_icon_item.csb.json` — /action; /animationList; source CSB NodeAction offset12452.

Limit: Frame indices are stored indices, not seconds. Clip trigger conditions and actual playback rate/framebase require runtime evidence.

### U04

Position timeline for actionTag -1247020007 begins at frame385 with position0,0,tween1,easing type0 and no control points.

Evidence: `/workspace/HC2/decompiled/codex_verified/assets/decoded/base.apk/assets/Common/ui/cocosstudio/season_rank_icon_item.csb.json` — /action/timeLines/0/frames/0/pointFrame; binary offset224280.

Limit: This is authored data, not a capture of execution; mapping actionTag to a node must use the same asset tree.

### P01

Official compatible Effekseer1.53c reader statically consumed all1988 original runtime bytes;5 nodes total: root,2 None parents and2 Track leaves.279 reader reads decoded with compiler type layouts; no unread bytes.

Evidence: `/workspace/HC2/decompiled/codex_verified/assets/effekseer_runtime/recovery_summary.json` — /reader_parse,/node_tree,/decoded_parameter_reads,/unread_offsets.

Limit: Reader-produced structural export, not original C++ game source. No effect script execution, simulation, rendering or resource loading occurred.

### P02

Stored parent root/0 common parameters: MaxGeneration1,life min=max100,generationTime1,all transform binds Always. Translation PVA fixed(-0.9,-0.2,0) with zero velocity/acceleration; rotation velocity x≈0.104719758,other axes0.

Evidence: `/workspace/HC2/decompiled/codex_verified/assets/effekseer_runtime/parameters_by_node.json` — /nodes/root~10/stored_parameter_reads entries offset100,188,316.

Limit: Values are raw reader-bound serialized parameters. Time units, game attachment transform, playback speed and activation are not established; object summaries may normalize defaults.

### P03

Track leaf root/0/0 stores MaxGeneration2147483647,life100,generationTime1,transform binds WhenCreating,RemoveWhenLifeIsExtinct1.

Evidence: `/workspace/HC2/decompiled/codex_verified/assets/effekseer_runtime/parameters_by_node.json` — /nodes/root~10~10/stored_parameter_reads entry offset596.

Limit: No claim of actual concurrent particle count; lifetimes/emission and game stop conditions must be interpreted by runtime execution logic.

### P04

Editor container includes compressed original editor XML and runtime BIN_ identical to sibling pinata_trail.efk. Decoded editor document reports ToolVersion1.53e.

Evidence: `/workspace/HC2/decompiled/unpacked/base.apk/assets/Common/particles/effekseer/pinata_trail/pinata_trail.efkefc` — EFKE chunks: INFO offset16 size28; EDIT offset52 size1824; BIN_ offset1884 size1988.

Limit: Editor authoring version differs from compatible parser runtime1.53c; these are separately recorded, not assumed identical source versions.

### AU01

Source fully decodes to4145 mono samples at48000Hz,duration0.0863541667 seconds. Raw source and floatPCM derivative are both retained.

Evidence: `/workspace/HC2/decompiled/unpacked/base.apk/assets/Common/audio/backfire_single.ogg` — whole file; verified decode metadata in assets/audio_font_status.json corresponding source row.

Limit: Filename suggests intended use but does not prove engine backfire trigger, gain, pitch, mixing or loop policy.

### F01

Verified base inventory records128.vsh,126.fsh,276.obj,209.mtl,1255.csb,549.plist,447.ogg,7115.png,191.rube and1794.json assets.

Evidence: `/workspace/HC2/decompiled/codex_verified/assets/summary.json` — /counts.

Limit: Counts concern shipped base asset files, not runtime-loaded resources or semantic recovery. Resource-split media and derived outputs are separate.

### F02

191 RUBE plus1717 JSON-extension files have shared binary prefix1213aa1213ba13ba and no validated format reader.

Evidence: `/workspace/HC2/decompiled/codex_verified/assets/asset_status_final.json` — per-file records for .rube and shared-marker .json.

Limit: Extensions are not decoded schemas. Terrain/vehicle numerical definitions cannot be quoted from these; binary prefix alone does not establish encryption.

### F03

DAT work preserves63 complete supported wire streams,42 unsupported original streams and36 complete zlib payloads, retaining wire numbers,raw byte ranges and unproven nested candidates.

Evidence: `/workspace/HC2/decompiled/codex_verified/assets/nested_wire/summary.verified.json` — complete original DAT and inflated payload roots.

Limit: Physical wire compatibility is not a validated replay/physics schema. Historical hcr2_replay.proto semantics must not be promoted to facts.

### V01

Transforms mask UV through u_transform, subtracts atlas center, compensates aspect and divides by supplied sheet column/row counts. Source comment identifies SpriteTransforms::setMaskUniforms() as the intended transform producer.

Evidence: `/workspace/HC2/decompiled/unpacked/base.apk/assets/Common/shaders/wheel_sprite_sheet.vsh` — lines 16–19,28–50.

Limit: The comment is a useful native-search lead, not a verified call binding. Actual transforms and sheet dimensions require the producer.

### V02

Samples tier0 then traverses sheet stages; u_blendmode0 interpolates RGB between successive tiers based on u_blend, other modes select completed tiers. Alpha is retained from tier0; final color is multiplied by parent tint/opacity and vertex color.

Evidence: `/workspace/HC2/decompiled/unpacked/base.apk/assets/Common/shaders/wheel_sprite_sheet.fsh` — lines 35–78.

Limit: The visual blend does not establish tire damage, grip, upgrade or wear semantics. CPU meaning and value range of u_blend are unverified.

### V03

Rotational blur uses10 samples, repeatedly rotating the sampling offset by u_params.z; valid atlas samples contribute squared RGBA and output is sqrt(sum/10). An annular spinner region instead takes one stationary sample. Translational blur matrix code is commented out.

Evidence: `/workspace/HC2/decompiled/unpacked/base.apk/assets/Common/shaders/motionblur.fsh` — lines 16–20,43–61.

Limit: This is atlas-local rotational texture blur, not proof of full-screen velocity-buffer motion blur. Angular uniform source and physical wheel-speed coupling remain unverified.

### V04

Vehicle iridescence samples separate mask and base textures, derives a brightness-weighted red-channel mask, rotates normalized fragment coordinates by0.25*u_playerRot+time, synthesizes HSV color and overlays it with a0.2*mask mix.

Evidence: `/workspace/HC2/decompiled/unpacked/base.apk/assets/Common/shaders/iridescent_vehicle.fsh` — lines 55–77.

Limit: u_playerRot proves an input dependency in this shader, not a verified CPU vehicle orientation producer or shader-selection rule.

### V05

Box blur samples a square UV neighborhood using step-controlled nested loops and multiplies the sum by step squared; u_box_blur packs boxSize,step,pixel dimensions.

Evidence: `/workspace/HC2/decompiled/unpacked/base.apk/assets/Common/shaders/box_blur.fsh` — lines 8–28.

Limit: Sampling behavior follows the exact loop bounds; do not substitute a mathematically normalized kernel without checking the supplied step. Actual render target and pass scheduling unknown.

## Practical implementation boundaries

A faithful asset importer can consume the supplied shader source, OBJ/MTL geometry, atlas metadata, CSB tree/options/timelines, decoded particle parameters and original media. Preserve original UV conventions, arbitrary actionTag identifiers, authored defaults and clip frame indices. Do not silently convert frame indices to seconds, replace missing runtime event bindings with invented callbacks, treat a height fade as depth-buffer occlusion, or describe a pass-through shader as a functioning special effect merely because its filename suggests one.

UI runtime overrides, touch dispatch, localization substitution, layout adaptation, effect activation, audio scheduling, framebuffer formats/blending/depth state, camera movement and collision-terrain construction remain separate CPU/runtime questions. Opaque binary configurations and unvalidated DAT semantics are explicit gaps rather than sources of reconstructed numerical facts.
