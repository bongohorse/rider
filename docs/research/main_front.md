# HCR2 Technical Reference for Rider

Evidence-backed static research • English edition • 24 October 2026

## Executive overview

This reference explains what the supplied Hill Climb Racing 2 Android package can reliably teach us, and where it cannot yet answer an implementation question. It is **not an original-source restoration, a remake specification, or a runtime observation report**. Rider is described by the requester as a Defold/Box2D side-view buggy game with an editor; its source was not supplied or inspected here. Every Rider change below is an architectural proposal to validate against that implementation.

The most useful findings are:

1. **Terrain depth is partly implemented in ordinary vertex math.** Original terrain shaders move selected vertices toward a lower boundary, change depth and adjust texture coordinates. This gives a concrete way to separate a readable driving surface from a visually substantial terrain body. It does **not** establish the CPU's curve sampler, mesh topology, collision chain, camera projection or sampling interval. See the graphics chapter and its original shader citations.
2. **The Android/native boundary is observable.** Cocos renderer lifecycle and input bridges expose a practical division between platform services and native rendering/game code. An SDK or native class being packaged does not prove every capability is used by gameplay. See the Android chapter.
3. **Two-pedal air rotation and event-linked tuning effects are described in original content.** Tutorial text specifies brake → forward rotation and throttle → backward rotation. Original descriptions connect effects to pickups, flips, wheelies, landings and detachable parts. The equations, timing thresholds and balance constants remain unrecovered. [G01–G05](#gameplay-evidence)
4. **Presentation is substantially data-driven.** Original Cocos Studio layouts/timelines, particle property lists, atlases, models and shader variants expose content structures independently of most hidden gameplay code. Their serialized values are asset defaults, not measured runtime configuration. See the assets chapter.
5. **The earlier 'complete implementation' narrative is unreliable.** Camera constants, vehicle parameters, Catmull–Rom terrain, exact ghost records and several formulas appear in a JavaScript prototype or reconstructed C++ without a verified binary mapping. Passing those implementations' tests establishes their own behavior only. [Corrections](#corrections)

For Rider, prioritize a downhill-visibility camera experiment and a chunked terrain-mesh experiment. Both address stated problems without depending on missing HCR2 implementation details or adopting HCR2's visual direction wholesale. Follow with fixed-step vehicle instrumentation, reusable authored content and one authoritative race-state model. [Recommendations](#rider)

<a id="contents"></a>
## Contents

- [Provenance, confidence and limitations](#provenance)
- [Technical architecture and native evidence](#architecture)
- [Android startup, lifecycle and input](#android)
- [Terrain, depth, shaders and presentation assets](#graphics)
- [Gameplay, vehicles and tuning](#gameplay-evidence)
- [Timing, progress, modes, replay and persistence](#race-systems)
- [Performance and development techniques](#performance)
- [Corrections to previous reports](#corrections)
- [Prioritized independent Rider proposals](#rider)
- [Open questions and targeted investigations](#questions)
- [Evidence index](#evidence)
- [Glossary](#glossary)

<a id="provenance"></a>
## Provenance, confidence and research limitations

### Evidence rules

| Label | Meaning in this reference |
|---|---|
| **Confirmed** | The stated, bounded fact is directly supported by an inspected original artifact or a reproducible artifact-bound measurement. A confirmed string proves that text is shipped; it does not prove its screen is reached. |
| **Supported inference** | Multiple observations support an explanation, but a connection, configuration or implementation detail remains inferred. |
| **Unverified** | A claim exists in earlier reports, reconstructed source or the prototype without adequate original-artifact support. This does not mean the idea is necessarily false. |
| **Unknown** | The inspected evidence does not establish the answer. A bounded unsuccessful search is not proof of absence. |
| **Rider proposal** | An independently designed experiment/recommendation, not a finding about HCR2. These are marked separately from confidence labels. |

The claim register records source paths, locators, provenance, limitations and available identities. `FUN_*`, `DAT_*`, `local_*` and analyst-assigned class names are not presumed original symbols. Syntax-valid Java and completed C pseudocode remain decompiler interpretations. No supplied executable was run for this research. Gameplay videos, device traces and live server behavior were not acquired. No HCR2 assets or proprietary source should be transplanted into Rider.

### Source layers

| Layer | Workspace-relative location | What it can establish |
|---|---|---|
| Original containers | `/workspace/reference-apk/`, inventory [input_provenance.json](../decompiled/codex_verified/assets/input_provenance.json) | Supplied package identity and hash relationships; not publisher trust on its own. |
| Verified extracted originals | [decompiled/unpacked/](../decompiled/unpacked/) | Original asset/source bytes and package membership, subject to extraction hash records. |
| Actual Android output | [decompiled/android/dex/](../decompiled/android/dex/), [method register](../decompiled/codex_verified/android/methods_reconciled.jsonl) | DEX descriptors, bytecode, Smali and method-specific Java export status. |
| Actual native analysis | [decompiled/native/](../decompiled/native/), [codex_verified/native/](../decompiled/codex_verified/native/), [native_final](../decompiled/codex_verified/native_final/) | Input-bound disassembly, function hypotheses, attempts and pseudocode diagnostics. |
| Static derived bytes | [native_derived](../decompiled/codex_verified/native_derived/) | Separately identified transformations of original bytes; assumptions must accompany their use. |
| Schema-derived decoded assets | [assets/decoded](../decompiled/codex_verified/assets/decoded/), [schema sources](../decompiled/codex_verified/assets/schema/) | Parsed structures supported by a compatible reader/schema; not automatically runtime semantics. |
| Historical analyst reports | [specs/](../specs/), root Markdown, [decompiled/reports/](../decompiled/reports/) | Search leads and previous interpretations; assertions require corroboration. |
| Reconstructed C++ | [decompiled_src/cpp/](../decompiled_src/cpp/) | Proposed implementations with insufficient source-to-binary provenance. Six files are explicitly classified in [legacy_work_classification.json](../decompiled/codex_verified/provenance/legacy_work_classification.json). [P07–P08](#claim-p07) |
| Browser prototype | [src/](../src/), [index.html](../index.html), [test/](../test/) | Local prototype behavior and assumptions, never original-game correctness. |

### Measured recovery context

The following are **analysis-snapshot counts**, not claims of complete semantic understanding. These distinctions matter because much readable Android output belongs to platform/advertising/support libraries, whereas central native gameplay remains difficult to interpret.

| Measurement | Recorded value | Interpretation / evidence |
|---|---:|---|
| Supplied regular input files | 58 | Provenance inventory; containers and existing extracted input files are separate rows, not58independent game builds. |
| Archive regular entries | 17,325 | Archive-member accounting, not decoded formats or independent assets. [archive_entries.json](../decompiled/codex_verified/assets/archive_entries.json) |
| APK packages | 36 | One base and35splits; APKM container separate. |
| SHA-distinct native libraries | 30 | Ten per architecture: ARM64, ARMv7, x86_64. [package links](../decompiled/codex_verified/provenance/native_binary_package_links.json) |
| Defined DEX methods / bodies / declarations | 562,847 /529,347 /33,500 | Sixteen DEX including statically recovered embedded DEX. [M01](#claim-m01) |
| Syntax-verified structured Java bodies | 477,361 | Not semantic equivalence; includes synthetic and bridge methods. |
| Other selected executable-method outputs | 29,932 simplified;3,877 initializer fragments;18,177 with diagnostics | All529,347 bodies have fresh attempts and selected nonempty snippets; these categories are not all high-level implementations. [java_summary.json](../decompiled/codex_verified/android/java_summary.json) |
| Native metadata starts | 320,486 | Not proven complete functions;98,729belongs to ARM64 Cocos alone. [M03](#claim-m03) |
| Raw-original Ghidra function objects | 69,624 | Function hypotheses, thunks and failed bodies included. [M02](#claim-m02) |
| Raw PF_X file-byte union | 123,175,991 bytes | Executable-marked segments can include data and padding. |
| Raw function-body PF_X union | 6,280,395 bytes | About5.10%of PF_X; not a measure of correct high-level source. |
| Raw listing instruction / defined-data / unclassified unions | 8,928,964 /18,234,102 /96,012,925 bytes | Decoder/listing classifications; unclassified does not mean encrypted. [totals.json](../decompiled/codex_verified/native_final/totals.json) |
| Raw completed pseudocode without `halt_baddata` | 28,054 | No-halt does not prove correctness. Other statuses include9,753thunks,19,373partial-with-halt,3,929halt-only and concrete failures/conflicts. |

The native table describes the frozen raw-original analysis. Later isolated loader corrections and the separate201,440-byte derived ARM64 helper region must not be added naively: overlapping ranges require unions within the same input/derived identity. The helper-stage provenance records the assumed untraced-process key byte; its131unwind-derived exports are not exhaustive game recovery. See the native chapter. Older asset summary files also retain obsolete Effekseer blockers; the specific newer runtime-parser evidence supersedes them. This report avoids treating a stale aggregate as the definitive current remaining-work total.

