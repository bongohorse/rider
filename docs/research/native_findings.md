# Native engine and game research: verified evidence

This research establishes Cocos Android rendering/input integration and OpenGL ES dependencies. It does **not** establish Box2D integration or the game's terrain, camera, vehicle or physics algorithms. No full decompilation or runtime execution was performed for this research. Original inputs and prior results were preserved. Machine-readable claims, exact symbol records, addresses and SHA-256 evidence manifests are in [native_claims.json](native_claims.json).

## Primary binary and coordinates

Primary ARM64 ELF: `decompiled/native/arm64-v8a/libcocos2dcpp.so/libcocos2dcpp.so`, SHA-256 `32d1198004a39ecaec3fcf0e9aa4efdd2f3a73e52491fdb4ee11b9a0b7f26181`.

Dynamic symbols were read from PT_DYNAMIC rather than relying on missing section headers. [Collector](evidence/collect_native_research.py) and [selected records](evidence/selected_native_symbols.json) preserve symbol indices, symbol-table record file offsets, bindings, sizes and source hashes. There are 29,447 dynamic symbol records across the three libcocos ABIs; ARM64 has 9,792. ARM64 defines 119 `Java_` exports, of which 81 belong to `Java_com_fingersoft_hcr2_AppActivity_`; the earlier claim that all 119 were AppActivity functions is incorrect.

| Actual ARM64 symbol suffix | ELF VA / file offset | Ghidra address | ELF symbol size |
|---|---:|---:|---:|
| `Cocos2dxRenderer_nativeRender` | `0x1b31f74` | `0x1c31f74` | 28 |
| `Cocos2dxRenderer_nativeInit` | `0x1b301a8` | `0x1c301a8` | 376 |
| `Cocos2dxRenderer_nativeOnSurfaceChanged` | `0x1b303d0` | `0x1c303d0` | 180 |
| `Cocos2dxRenderer_nativeOnPause` | `0x1b31f90` | `0x1c31f90` | 224 |
| `Cocos2dxRenderer_nativeOnResume` | `0x1b32070` | `0x1c32070` | 224 |
| `Cocos2dxRenderer_nativeTouchesBegin` | `0x1b33338` | `0x1c33338` | 112 |
| `Cocos2dxRenderer_nativeTouchesMove` | `0x1b33418` | `0x1c33418` | 468 |
| `Cocos2dxRenderer_nativeKeyEvent` | `0x1b3380c` | `0x1c3380c` | 448 |
| `AppActivity_getTimeStampNow` | `0xdc09c0` | `0xec09c0` | 20 |

Renderer names above have full prefix `Java_org_cocos2dx_lib_`; AppActivity has prefix `Java_com_fingersoft_hcr2_`. Symbol sizes describe ELF records, not validated complete function bodies. The current original-ELF `nativeRender` inventory status is `halt_only_output`; its named C file is not a recovered render implementation. [Exact current records](evidence/native_bridge_inventory_records.json) preserve the distinction.

ELF VA maps to file offset through the containing file-backed PT_LOAD: `p_offset + (VA - p_vaddr)`, only within `p_filesz`. Ghidra coordinates come from actual saved MemoryBlockSourceInfo mappings in `decompiled/codex_verified/native/arm64-v8a/libcocos2dcpp.so/call_recovery/mapping.jsonl`. Selected JNI symbols above happen to have ELF VA equal to file offset and Ghidra VA larger by `0x100000`. This is not a global file-offset rule: ELF `0x2254000` maps to file `0x224c000`, Ghidra `0x2354000`.

## Rendering, timing and performance

[Original dynamic dependencies](evidence/cocos_arm64_dynamic.txt) include GLESv2, GLESv1_CM, EGL, OpenSLES, Android, log, dl, libc and libm. Undefined imported symbols include `glDrawArrays`, `glDrawElements`, `glBufferData`, `glTexImage2D`, `glUseProgram`, `clock_gettime`, `gettimeofday`, `usleep` and `nanosleep`. Their zero symbol values are import placeholders, not implementation addresses. These establish platform/API capability; they do not reveal the renderer's scene pipeline, batching, draw-call count, frame cost or camera projection.

The primary bytecode `decompiled/android/dex/base_classes_02/smali/org/cocos2dx/lib/Cocos2dxRenderer.smali` confirms the readable Java at `decompiled/android/jadx/base_classes_02/sources/org/cocos2dx/lib/Cocos2dxRenderer.java`. Raw bytecode is preserved at `decompiled/android/dex/raw/base_classes_02.dex`; all three hashes are in the claims manifest.

`Cocos2dxRenderer` defaults `sAnimationInterval` to 16,666,666 ns (Smali line 14). `setAnimationInterval(D)V` converts seconds to nanoseconds (line 88). `onDrawFrame` (line 205) skips drawing when `skipdraw` is set. For intervals at or below 16,666,666.666666666 ns it calls `nativeRender()` immediately; larger intervals sleep for the remaining whole milliseconds, update the stored nanoTime, then call `nativeRender()` (calls at lines 229 and 267). The native descriptor is `nativeRender()V` (line 73), with no timestep argument.

This supports a Java-side rendering throttle. It does not prove fixed 60 FPS, a fixed physics step, interpolation, solver iterations, deterministic simulation, or measured runtime performance. A timestamp-named native export similarly does not establish its implementation.

## Physics, terrain, camera and vehicle findings

No raw-byte matches for `Box2D`, `box2d`, `b2World`, `b2Body`, `b2WheelJoint`, `b2PolygonShape`, `b2ChainShape`, `b2EdgeShape`, `b2Fixture` or `b2ContactListener` were found in any of the 30 original ELF copies. [Search evidence](evidence/box2d_raw_byte_search.json) records every file's SHA-256, size and hits. No corresponding names appear in the independently parsed libcocos dynamic symbols across three ABIs.

This is bounded negative evidence. Hidden, transformed or stripped code may implement physics without these strings. **Box2D presence and API integration remain unconfirmed.** No verified native call chain currently connects a game physics step to a named Box2D implementation. The opaque file `decompiled/unpacked/base.apk/assets/Common/rube/driver.rube` has the shared binary prefix `1213aa1213ba13ba`; its filename alone establishes neither a parsed RUBE schema nor suspension parameters.

The terrain collision representation, vehicle chassis/joints, suspension model, torque/air control, gravity settings, camera tracking/projection and game update loop remain unknown from the inspected native evidence. Generic engine support cannot establish which features this game uses. No engine version or “2.5D hybrid” rendering architecture is established here.

Historical names including `TrackMeshPhysicsEvaluator`, `Box2DWorldStepSimulation`, `VehicleChassisJointSolver`, `TerrainGeometryGenerator` and `VehicleSuspensionModel` were hardcoded in `decompiled/scripts/RecoverCocosUnwindFunctions.java` (e.g. lines 27–28), then used in `decompiled/native/arm64-v8a/libcocos2dcpp.so/newly_recovered/newly_recovered_functions.json`. These are investigator-assigned labels, not original symbols or verified semantic implementations. Historical `DECOMP_INVENTORY.md` physics/suspension numerical claims lack primary evidence in this research and must not be cited as recovered facts.

## Corrected accounting context

The existing measured snapshot `decompiled/codex_verified/native_final/totals.json` separates different coverage questions. It covers the 30 original native binaries; derived transformation experiments are separate.

| Measure | Verified snapshot |
|---|---:|
| Historical function rows | 58,927 |
| Live Ghidra functions before / after | 59,006 / 69,624 |
| Added live functions | 10,618 |
| Ghidra thunks, counted separately | 9,753 |
| Completed pseudocode without halt status | 28,054 |
| Partial pseudocode with halt status | 19,373 |
| Halt-only output status | 3,929 |
| PF_X file-backed bytes | 123,175,991 |
| Function-body PF_X interval union before / after | 6,042,301 / 6,280,395 |
| Listing instruction PF_X interval union | 8,928,964 |
| Listing defined-data PF_X interval union | 18,234,102 |
| Remaining unclassified PF_X bytes | 96,012,925 |

Function statuses are not high-level correctness scores. Additional statuses (including boundary conflicts, no instructions, CFG-only and failures) remain in the machine-readable snapshot. No-halt output does not prove correct semantics. PF_X permissions do not make every byte code; union coverage is not bytecode recovery or decompiler correctness.

Metadata accounting is 238,978 EH FDE records, 81,505 ARM EXIDX entries and 3 debug FDE entries: 320,486 start-metadata entries. The 36 EH CIE records are separate and are not functions. Physical EH walks are recorded in `decompiled/codex_verified/native_audit/physical_eh_frames/summary.json`. ARM64 cocos alone has 98,729 FDE starts but 9,652 live Ghidra functions; unwind entries cannot be reported as completed functions.

Full linear original-file exports cover all 30 binaries in 40 architecture/mode views, as recorded by `decompiled/codex_verified/native_audit/linear_export_summary.json`. They account for PF_X input bytes, including failed decode and alternate ARM/Thumb interpretations. They do not establish that every decoded instruction is executable code. ARM and Thumb views must not be added as distinct input bytes.

A feasible next research step is a validated static transformation of still-unrecovered game code followed by trustworthy cross-references from JNI rendering/update entry points to internal game routines. Existing transformed helper-stage outputs concern loader/JNI support and do not by themselves recover game physics or rendering semantics. This report makes no original-source restoration claim.
