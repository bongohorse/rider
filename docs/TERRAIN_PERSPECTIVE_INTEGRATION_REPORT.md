# Accepted road perspective: production integration (#292)

**Contents:** [Scope and settings](#scope-and-settings) · [Compatibility](#compatibility) · [Verification](#verification) · [Resources and timings](#resources-and-timings) · [Reproduction](#reproduction) · [Limits and stop point](#limits-and-stop-point)

## Scope and settings

Claudio reports that the #290 comparison works well, accepts camera-dependent perspective as the direction, and requests no further tuning currently. PR #291 was independently reviewed read-only at `a2aa0f8`, with no blockers, exact-head required PASS 40301795152, then marked ready and merged as `244d17d`. Main CI/public deployment run 40307540487 also passed. These are the recorded acceptance and automated checks; no additional human/device observations are inferred.

The separately authorized #292 / draft PR #293 integrates the same projection, shader and parameter contract into ordinary Play and Editor. `perspective-v1` means version 1, perspective mode, width **0.9 m**, strength **0.35**, angle **atan(0.55) = 28.810793742973°**, side cap **64 m**, shading **1**. These are the shipped/hosted #290 values. Claudio's private retained browser JSON was not supplied; unreported personal adjustments are not claimed as observed.

The [shared contract](contracts/road-look.md#production-compatibility) defines spaces, immutable profile mapping and bounds. No second projector or tuner was created. The z=0 driving contour, source geometry, collision, physics, follow camera and Retry are preserved. Full per-section settings, persistence and Undo belong to #278.

Playable ordinary release: http://127.0.0.1:8792/terrain-preview.html?course=mixed-over-budget. It explicitly imports marked derived fixtures; select **Legacy fixed Depth (500 m)** for the original unmarked file, or **Open ordinary Gym** for built-in stations. The launcher does not set a renderer build flag. [Release descent](terrain-292/release-descent.png), [release Editor](terrain-292/release-editor.png), [660 m Fit](terrain-292/660-fit.png) are unmodified actual screenshots.

## Compatibility

- Existing imported/saved sources without `editor.road_profile` retain the original fixed Depth shader, its original floor extent and 36-byte layout. Opening, editing, save/export, reopen, Play and Retry do not opt them into perspective.
- New empty levels have the immutable course marker `editor.road_profile = "perspective-v1"`. Built-in resources select it in memory; their JSON files remain unchanged. Template copies preserve their source profile, including an old unmarked course remaining unmarked.
- Only this course compatibility identifier is carried through the existing editor block. Source sampling, compiler version, physics fields and storage/Undo implementation do not change. It is not section look authoring or stored slider values.
- Unsupported identifiers, including invalid types, return an unsupported-format refusal and participate in existing alternating-slot overwrite protection. External JSON cannot opt in through the private built-in `_road_profile` field; import/restore ignores it while retaining original file text.
- Admission resolves layout from each incoming document before the world exists. An old course can still fit 36-byte budgets even if the same course would exceed perspective's 48-byte budget. No date/id heuristic, comparison localStorage, silent migration or automatic legacy conversion is used. Downgrading to older executables is not a supported look-preserving workflow.

## Verification

The final runtime is `294ae68328c8467f026414c4e8b4343b1f112493`, pinned Defold 1.14.0 engine `a81dbb0478e8b73931dc2d671563204f6ac0ef82`. Later publication commits contain evidence/tools/docs only. Both normal debug and release builds pass pinned engine guards; neither enables the comparison flag.

[Final compatibility results](terrain-292/compatibility.json) verify both legacy and perspective sources through existing import, real curve-tangent drag, acknowledged save/IndexedDB sync, reload into the exact changed draft, export, Play, Retry and reload into Play. Source objects/settings remain exact before editing; legacy/profile first exports have **exactly equal compiled geometry in the same browser**. The [legacy export](terrain-292/legacy-export.json) and [perspective export](terrain-292/perspective-export.json) differ by the profile metadata only. Legacy stays unmarked throughout; perspective keeps the marker. Poisoned comparison localStorage has no effect on normal selection. Future-profile and oversized imports retain the running world.

Native [integration](terrain-292/native-integration.txt), [projection](terrain-292/native-projection.txt), [budget](terrain-292/native-budget.txt) and [ownership](terrain-292/native-ownership.txt) checks use actual compiler/builders and the pinned LuaJIT with JIT disabled. They verify exact same-backend legacy reopen/copy and profile roundtrips, geometry equality outside the marker, immutable preset, unknown-profile/save-slot protection, independent layout admission, collision-plane equality and projected extrema. The ownership tool simulates only the engine resource boundary; it does not establish device behavior.

Full resource runs use four courses, five imports each plus three selected drive views (23 imports), 236 Editor Fit/pan/zoom/aspect snapshots and 11 drive/Retry snapshots per profile. [Legacy](terrain-292/resources-legacy.json) and [perspective](terrain-292/resources-perspective-2.json) both pass on runtime `0120e9e`. A [follow-up on `6d21b2b`](terrain-292/resources-final.json) also passes current-frame projected-box/pixel-mapping coverage and actual charged-size GPU-buffer checks. Later runtime changes only harden unsupported/private import identifiers; valid geometry/projection stays unchanged. All-17-section 660 m Fit passes; ordinary all-visible pan/Home performs zero terrain vertex-buffer uploads. Longer pans legitimately allocate incoming resident sections; there is no full-course per-frame resampling.

[Release QA](terrain-292/release-qa.json) passes ten launcher views including both 660 m courses and the legacy option, crest/descent/jump/landing/valley, Editor Fit/save/export/reload, Retry and real station switches. Actual release export contains `perspective-v1`; reload does not reimport over the draft. Debug inspection and comparison style-request globals are absent. Phone-shaped viewports are browser emulation, not phone evidence.

[Far-course travel](terrain-292/far-course.json) additionally passes actual stock-vehicle driving from legal START 488 m to over 172 m farther (past 660 m), current projected visibility checks throughout, and Retry in the same world generation. No START or coordinate limit was expanded.

The normal final-runtime [le3 suite](terrain-292/le3.json) passes all 15 existing cases, including connected edits/Undo/Redo, drawing/driving, overhang behavior and oversized draft protection. Baseline check, 55 bootstrap tests, 79 Node CI/mobile tests, 39 G1 tooling, 8 G2 tooling and 31 Python CI tests pass. Full runtime-head CI/required PASS 40310448139 on `294ae68`; final publication-head CI is tracked in PR #293; no test/assertion, pool or protection was weakened.

Earlier failed helper attempts are excluded from PASS evidence. One compared a stale Editor diagnostic counter after Fit; the corrected oracle uses current projection counters and positive WebGL VB-size inventory with zero terrain uploads. Another assumed native fixture decimal output would exactly match a browser recompile (observed differences around 1e-13); it now checks exact source preservation and exact legacy-versus-profile compiler outputs in the same browser. A third dereferenced telemetry during proxy replacement; it now waits for the new telemetry. No physics/reset/seam tolerance was changed.

The reused pinned API assumptions were checked against the [mesh component](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/gamesys/src/gamesys/components/comp_mesh.cpp) and [buffer metadata implementation](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/dlib/src/dlib/buffer.cpp): visibility reads AABB metadata separately from vertex content versions. Bounds/constants can therefore update without vertex-stream upload; browser probes verify this consequence. No new Defold API is introduced beyond #290.

## Resources and timings

No engine pools or budget caps increase. For the mixed 660 m fixture: 1,016 segments, 18,312 vertices, 17 all-visible/allocated Fit sections, zero cached at Fit, peak 34 retiring/incoming meshes, 49 sprites, 7 labels, 137 charged instances including reserve, and 1,066 physical vertices including hulls. Physics cost remains separately guarded.

| Charge | Legacy | Perspective |
| --- | ---: | ---: |
| Bytes / vertex | 36 | 48 |
| Fit vertex payload | 659,232 B | 878,976 B |
| Two-generation replacement payload | 1,318,464 B | 1,757,952 B |
| Estimated CPU working set | 11,240,000 B | 12,558,464 B |
| Conservative retained engine-VB ceiling | 8,080,560 B | 10,774,080 B |

The 1 MiB Fit payload, 16 MiB CPU working estimate, 128 mesh components, sprite/label/GameObject reserves, physical-vertex guard and independent source/compiler/START/coordinate limits remain. The actual native boundary remains 1,521 segments for the simple legacy fixture and 1,212 for perspective; perspective 1,213 and a real 1,521 import fail safely with an actionable payload message. Editor fragmentation and delayed replacement still use their existing actual-plan checks.

Same-build warm ready medians / maximum (five imports each), runtime `0120e9e`, milliseconds:

| Fixture | Legacy | Perspective |
| --- | ---: | ---: |
| Six anchor | 54.1 / 82.2 | 72.5 / 84.5 |
| Long 500 m | 55.3 / 59.6 | 55.8 / 70.5 |
| Mixed 500 m | 61.9 / 73.3 | 68.9 / 75.1 |
| Mixed 660 m | 59.0 / 81.4 | 74.4 / 92.9 |

Chromium 156.0.8078.4, ANGLE SwiftShader, nonisolated wasm-web, 1280×720, DPR 1. Each profile ran sequentially without a concurrent automated browser/build. Both use identical fixtures/import/drive sampling, with natural GC uncontrolled; legacy ran first. Observer hashes differ because the stale-counter oracle was corrected before the perspective run. Timings do not isolate a causal projection cost or prove an FPS gain.

The last seven seconds of each eight-second drive contain 420 callbacks. Callback p95 by fixture above was 4.8/4.7/4.9/5.7 ms legacy and 5.3/5.1/5.4/5.9 ms perspective. Largest sampled import callback was 18.4/25.0 ms. Maximum published Play residency-update time when uploading was 9/21 ms; this includes surrounding adapter work, not isolated GPU time. Follow-up `6d21b2b` perspective p95 was 5.4/5.2/5.6/5.8 ms, maximum activation update 12 ms. These bounded windows do not replace load/editor peak investigations.

Tracked live WebGL buffer allocation at 660 m Fit was 1,567,748 B legacy / 1,787,528 B perspective in those samples, including nonterrain/retained buffers. This is API byte allocation, not physical GPU memory. Native retained-allocation evidence from [#290](TERRAIN_PERSPECTIVE_REPORT.md#measurements) remains applicable to the unchanged 48-byte builder; there is no new total-process/GPU memory measurement. Summaries preserve source/observer/raw-result hashes; raw local reports remain under `artifacts/terrain-292`.

## Reproduction

```sh
node tools/gym/terrain_baseline.cjs --fixtures artifacts/terrain-292/native
.cache/g1/luajit -joff tools/terrain_perspective/check_integration.lua artifacts/terrain-292/native
python tools/gym/bundle.py --output artifacts/normal-debug
node tools/terrain_perspective/check_production.cjs artifacts/normal-debug artifacts/compatibility
node tools/terrain_play/observe_resources.cjs artifacts/normal-debug artifacts/resources --large --perspective-profile
python tools/gym/smoke.py --bundle artifacts/normal-debug --output artifacts/le3 --case le3
```

Build ordinary release with `tools/g1/build.py`'s existing `build('wasm-web', output, settings, variant='release')`, exact source SHA/run ID and no `terrain_perspective` configuration. Record its inventory/engine guards. Separate variant caches when necessary; do not reuse an unverified engine. Then:

```sh
python tools/terrain_play/prepare_preview.py artifacts/normal-release --perspective-profile
python -m http.server 8792 --bind 127.0.0.1 --directory artifacts/normal-release/RiderG1
# Separate terminal; use the actual release source SHA:
node tools/terrain_play/verify_preview.cjs http://127.0.0.1:8792 artifacts/release-qa SOURCE_SHA --budgets --editor --perspective-profile
```

`--output` on the launcher preparer keeps fixtures external when an immutable bundle observer needs that. The generated perspective fixtures add only the explicit source profile; the legacy option copies the original file. Repository fixture JSON is unchanged.

## Limits and stop point

Existing #277 load/editor spikes up to 115 ms remain OPEN. Current editing is functionally verified, not a new latency benchmark. Pinned shader-buffer retention and actual phone/hardware-GPU timing/memory, draw-call, touch, app-switch and thermal evidence remain open. No FPS improvement, phone performance or broader human visual observation is claimed.

STOP for Claudio's integration test on the ordinary release preview. PR #293 remains draft and is not merged automatically. #278 stays blocked; full per-section look editing, parameter storage and Undo must reuse this projection/contract after a separate GO.
