<a id="questions"></a>
## Open questions and targeted follow-up investigations

This is a comprehensive reference to the evidence inspected, **not a claim that all listed game systems have been reconstructed**. The table makes unresolved topics actionable and keeps them from being filled with plausible folklore.

| Question / system | Current status | Smallest targeted next investigation |
|---|---|---|
| Engine identity/version and languages | Cocos Java/JNI integration, native ELF and GLSL confirmed; exact upstream engine version/native source language boundaries unresolved | Match stable engine functions/version resources; do not identify a version from generic JNI names alone |
| Startup order/native initialization | Java load path and specific native loader transforms partly known | Follow the exact constructor/callback dependency with saved binary identity and source-mapped ranges |
| Native scene management/game loop | Unknown beyond render boundary | Trace `nativeRender` after validated transformation; identify scheduler and scene transition callers |
| Simulation step/interpolation | Java render pacing confirmed; native physics timing unknown | Recover timestep argument producer and accumulator/solver call, then instrument an isolated authorized runtime if needed |
| Terrain controls/sampling/topology | Shader-side visual contract confirmed; CPU and collision unknown | Trace terrain program/attribute setup, find buffer producers, and match decoded authored curve data |
|2Dphysics versus3Dvisuals | Authored depth geometry and shader behavior confirmed; simulation dimensionality/Box2D unconfirmed here | Identify actual collision/world implementation, not only `.rube`extension or analyst labels |
| Camera lookahead/zoom/bounds/slopes | Unknown original controller | Trace `u_cameraBottom`, projection/view matrices and their update callers; compare fixed input replay only after runtime is authorized |
| Body/wheel/joint/suspension topology | Unknown | Decode one genuine vehicle config and its consuming builder; verify shape/joint parameters at each call |
| Traction/braking/air control | Intended air-rotation controls described; exact laws unknown | Follow native control consumers and contact state; distinguish torque, rate control and wheel reaction |
| Crash/ragdoll conditions | Intended driver protection/crash concepts supported; implementation unknown | Recover driver config, contact classification and fail-state transition path |
| Special vehicles/upgrades | Shipped effect descriptions confirmed; numerical tuning unknown | Recover one upgrade's configuration reader and parameter application; validate serialized default versus runtime override |
| Obstacles/moving/breakable objects | Content describes interactions; physical algorithms unknown | Pick one object and trace model→config→builder→contact/event handler |
| Touch/gamepad/keyboard | Concrete Java forwarding and mapping paths confirmed | Resolve native coordinate conversion, eventIDs, deadzones and per-mode consumers |
| Sensors | Bridge capability confirmed; use for driving not established | Find callers enabling accelerometer and native value consumer |
| Timer/progress/checkpoints/finish | Content concepts confirmed; algorithms unknown | Identify authoritative race clock/state and crossing predicates; do not use prototype world Xas evidence |
| Fuel/coins/collectibles/rewards | Shipped descriptions/tasks confirmed; laws and authority unknown | Recover pickup/state reader and one complete event→resource→reward path |
| Medals | Not established by inspected primary evidence | Locate original threshold data and award consumer; avoid conflating rank icons with medals |
| Race modes/progression/records | Multiple modes and progression concepts supported by content | Recover one actual mode transition graph and result serialization |
| Ghost/replay/networking | Replay content/compatibility and service paths confirmed; format/transport unknown | Recover a real DAT reader/writer and playback call path before assigning fields; traffic only in a separately authorized environment |
| UI/HUD/animation | Authored trees/timelines confirmed; runtime bindings unknown | Match actionTags/nodes to code and trace one HUD quantity end-to-end |
| Lighting/materials/particles/weather/audio | Selected source computations and serialized defaults confirmed | Trace active shader/effect/audio selection and uniform/emitter producers; profile actual passes |
| Culling/batching/pooling/streaming/LOD | Asset delivery integration and some enabling data confirmed; game optimization policy unknown | Identify one concrete buffer/resource lifecycle and measure runtime counters; avoid capability→usage inference |
| Save serialization/migrations | Compatibility/corruption/cloud text confirmed; schema unknown | Trace local write/read + version checks; keep account SDK payloads separate |
| Tools/diagnostics/testing | CocosStudio/Effekseer/selected exporter metadata and diagnostic paths observable | Trace actual build/editor artifacts or explicit test hooks; production game tests are not established by prototype tests |

Further investigation should be driven by these questions, not another indiscriminate decompiler run. The highest-value original-game targets are `u_cameraBottom`/matrix producers, terrain vertex-buffer producers, one verified vehicle configuration reader and the real DAT reader. The highest-value **Rider** work can proceed independently through R1–R4and does not require solving the entire native protection layer.

### Research reproducibility and validation

Supporting source-specific ledgers remain in [parent_claims.json](parent_claims.json), [assets_claims.json](assets_claims.json), [android_claims.json](android_claims.json) and [native_claims.json](native_claims.json). The normalized [evidence_register.csv](evidence_register.csv) is the cross-system claim register, with one or more artifact rows per claim. The native symbol collector and bounded raw searches are retained under [evidence/](evidence/). These are research tools, not game source.

The document builder [build_reference.py](build_reference.py) normalizes claim categories, checks local source existence, verifies supplied hashes, generates source links and records a citation manifest. [verify_reference.py](verify_reference.py) checks local links/anchors, unique evidenceIDs, artifact hashes and generated navigation. [validation.json](validation.json) records the final checks. Hash verification establishes the cited artifact's identity, not semantic equivalence of decompiled code.

<a id="evidence"></a>
## Evidence index

Each entry below links the workspace-relative artifact and its locator. The CSV additionally carries confidence, provenance, limitation and SHA-256. Native source identities and symbols/coordinates are preserved in the native claimJSON; research evidence exports are derived from those originals. Supporting external documentation is listed after the local index.

@@EVIDENCE_INDEX@@

### Authoritative external references

These explain available technologies; they do not prove HCR2 or Rider uses a particular implementation/configuration. Defold documentation is live and was consulted on24October2026. Rider's engine/backend version is unknown; the lifecycle manual explicitly describes versions from1.12.0,while the retrieved generated physics API identified1.14.0Stable. Compatible reader versions used in existing asset recovery are recorded separately.

| Reference | Bounded use here |
|---|---|
| [Defold cameras](https://defold.com/manuals/camera/) | Orthographic/perspective options for independent R1 |
| [Defold meshes](https://defold.com/manuals/mesh/) | Buffers, vertex spaces and mesh bounds for independent R2 |
| [Defold rendering](https://defold.com/manuals/render/) | Batching conditions and culling for measurement design |
| [Defold physics](https://defold.com/manuals/physics/) | Backend selection, scale and fixed-step settings; match Rider's installed version |
| [Defold joints](https://defold.com/manuals/physics-joints/) | Available programmatic constraint categories; verify backend support |
| [Defold lifecycle](https://defold.com/manuals/application-lifecycle/) | Callback ordering guarantees and unspecified order among objects |
| [Defold interpolation example](https://defold.com/examples/physics/interpolation/) | Visual/physics separation for an independent experiment |
| [Upstream Box2D simulation](https://box2d.org/documentation/md_simulation.html) | Current generic friction behavior; not proof of HCR2's engine/version |
| [Pinned Cocos schema/reader source](https://github.com/cocos2d/cocos2d-x/tree/1528ea01d2749b4ef65e97f79cffa6135fe13c4d/cocos/editor-support/cocostudio) | Compatible CSB structural decoding; not an identification of game-engine revision |
| [Effekseer source repository](https://github.com/effekseer/Effekseer) and [local pinned recovery evidence](../decompiled/codex_verified/assets/effekseer_runtime/recovery_summary.json) | Compatible1.53creader versus supplied1.53eeditor metadata; parser scope documented |

<a id="glossary"></a>
## Glossary

| Term | Meaning here |
|---|---|
| ABI | Architecture/calling-convention interface; ARM64, ARMv7 and x86_64 inputs are separate identities. |
| APK / APKM | Android package / supplied outer package container; splits and entries are distinct accounting units. |
| DEX / Smali | Android bytecode container / textual bytecode representation. |
| JNI | Java/native boundary; an exported name is evidence of an interface, not its whole implementation. |
| ELF VA / file offset / Ghidra address | Different coordinate spaces; use PT_LOAD and actual project mappings. |
| FDE / CIE / EXIDX | Unwind metadata records; function candidates/metadata, not recovered source implementations. |
| PF_X | ELF executable segment permission; not proof every contained byte is executable code. |
| Interval union | Byte coverage counting overlapping ranges once within a defined source identity/address space. |
| Pseudocode | Decompiled interpretation with tool/analysis limitations, not original C/C++ source. |
| `halt_baddata` | Decompiler diagnostic/fallback construct; neither standalone encryption proof nor a complete usefulness score. |
| MVP / clip space | Model-view-projection transform / homogeneous output coordinates before perspective division. |
| Orthographic / perspective | Projection without / with distance-dependent size; an MVP name alone distinguishes neither. |
| UV / atlas | Texture coordinates / multiple packed regions sharing a texture. |
| CSB / actionTag | CocosStudio binary layout/timeline format / authored binding identifier. |
| Serialized default | Stored content value that runtime code may override; not a measured active parameter. |
| Wire-compatible Protobuf | Bytes can be consumed by protobuf wire rules; field names/units/message semantics remain separate. |
| RUBE | A file-extension/content-pipeline lead in this package; opaque bytes are not a decoded physics schema. |
| Fixed step / interpolation | Regular simulation interval / presentation between sampled states; original HCR2 use remains unresolved. |
| Pose ghost | Proposed non-colliding replay of transforms; does not imply deterministic simulation or network authority. |
| Rider proposal | Independently specified experiment requiring validation in Rider's actual source and pinned engine. |
