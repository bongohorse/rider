# First playable run (#279)

**Contents:** [Behavior](#behavior) · [Scoring and storage](#scoring-and-storage) · [Verification](#verification) · [Preview and limits](#preview-and-limits) · [Engine evidence](#engine-evidence)

## Behavior

Claudio accepted Terrain Look in Editor and Gym and authorized #294 review/merge, then explicitly granted #279 GO (2026-10-26). #262 is the parent; later progress/medals/economy tasks have no GO.

**First run** in the existing Gym HUD, or `?station=first-run`, opens a 168 m directed course. It derives from Rider's P0 six-anchor source at half size, with a flat staging pad, gently rolling road and existing START/FINISH. The gentle course deliberately prioritizes completing and retrying this first loop. It is not a completed Phase B skill challenge. No vehicle/physics/camera tuning, collision API, pool, resource cap or source-format change.

The first normalized driving command (throttle, brake/reverse or lean) starts the attempt. Loading and waiting on the flat pad do not count. The existing controller is still the sole tick owner; `run.lua` holds ready/running/paused/finished/failed state and the attempt ID. The adapter advances the clock from the preceding command's completed simulation step, then uses the existing directed chassis/line crossing. Finish is quantized to the first observed crossing tick; no presentation clock or crossing interpolation is used. One unrounded result is frozen per attempt. Display precision is hundredths; comparisons use the unrounded simulation value.

Space/the existing Pause control freezes time and physics. Focus loss/background requests idempotent suspension through the existing proxy owner and requires explicit resume. Held input is cleared by the existing acknowledgement handshake. Finish and head/bounds failure hold the world through that same proxy owner. The visible Retry button, R and touch Retry resume only to perform the canonical in-world reset; they keep world generation and resource ownership. No automatic stuck reset. Retry prepares a fresh attempt and clears result/new-best flags and stale input.

Terrain Look stays available. Its live preview/Apply changes visual state without changing official eligibility or the course/rules identity. Entering Edit and playing its source copy uses the existing custom-level path and cannot write an official record.

## Scoring and storage

Official identity: `first-run-course1-rules1-buggy-a-crash`. Course geometry/start/finish changes require a course revision bump; gameplay/vehicle/assist changes require a rules revision bump. Cosmetic source revision, Terrain Look, labels and projection are excluded. This first slice has one official identity, with the existing buggy, unmodified preset A, crash ON, default zero start speed and factor 1.0. Other presets, tuning, changed crash rules, scaled time, record/replay, debug engines and automated Gym/test starts are practice for that entire attempt. Restoring controls does not upgrade an already-practice attempt. Custom/editor worlds never acquire official status from their document ID.

`run_best.lua` uses `custom.slot_store`, the existing alternating slot/readback mechanism, and the existing HTML5 IndexedDB synchronization acknowledgement. The version-1 record contains key and unrounded time; its files are separate from levels, drafts and versions. A worse/equal result does not write. The UI announces a saved best only after acknowledgement. Failed writes keep the previous valid slot; failed/unavailable browser synchronization keeps the last acknowledged best and says **Best not saved**. Unreadable or future record data protects the files and refuses replacement. As with the existing editor storage, one writing game tab is supported; no cloud account or attempt restoration is added.

## Verification

Three focused Lua checks use the production authority, runtime adapter and alternating store with faulting filesystem/sync adapters: start/pause/finish/failure/Retry, stale IDs, exact-once result/stop, render grouping, official/practice isolation, cosmetics, minimum preservation, reopen, future versions and write/sync failure. Run with the repository's verified Bob LuaJIT executable:

```sh
.cache/g1/luajit -joff tests/gameplay/run.lua
.cache/g1/luajit -joff tests/gameplay/best.lua
.cache/g1/luajit -joff tests/gameplay/runtime.lua
```

`tools/gameplay/check_run.cjs` is called by the existing desktop release verification, so current-head `required` gates the actual first-run loop without another CI group or build. It drives with real keyboard/pointer input, checks waiting/start, pause and synthetic focus loss, directed finish/frozen result, native Retry without a world reload, slower result, acknowledged IndexedDB close/reopen, practice isolation and injected browser-sync failure. It observes public state and visible UI text; it never teleports or sets score/physics. The browser check is also runnable directly against the ordinary release URL:

```sh
node tools/gameplay/check_run.cjs http://127.0.0.1:8801/ <runtime-sha> artifacts/gameplay-g1/qa
```

Initial release `bf746e8`: complete real-input loop PASS, result 26.000001356006 s, slower 28.133334800601 s did not downgrade, close/reopen restored the exact best, faster practice 25.783334678039 s did not overwrite it. This earlier run preceded the final frozen-result/Retry and sync-failure checks and is not final-head evidence. Initial pilot ended before FINISH and is excluded from completion evidence. Baseline check, 55 bootstrap, 31 Python CI, 79 Node CI/mobile, 39 G1 and 8 G2 tooling tests PASS. Release `3be52ac` additionally passed all eight desktop workflows, including frozen world/native Retry, Terrain Look Apply retaining official status, actual editor Play isolation and injected browser synchronization failure. Focused checks also pass against the production runtime adapter. A touch pilot found that the engine reports HTML5 canvas blur when the DOM toolbar takes focus: auto-suspension plus the toolbar Pause toggle resumed immediately. The listener now distinguishes actual document/window loss; browser blur/visibility still suspend. The failed pilots are excluded from PASS evidence. The final touch check uses actual synthetic touch zones and toolbar taps and is integrated in the existing phone release verification. Full runtime-head CI / exact-head `required` PASS on `93201ef` in [40363135711](https://github.com/bongohorse/rider/actions/runs/40363135711). Its packaged merge SHA is `8f614763d177efe2dca634cf89b53b2fa4e2f3a0`. All selected native/HTML5/Android/Bridge/editor/replay/release checks passed, including [eight desktop workflows](gameplay-g1/desktop.json) and [two synthetic touch workflows](gameplay-g1/phone.json). Inspected [desktop result](gameplay-g1/desktop-finished.png), [phone ready](gameplay-g1/phone-ready.png) and [phone result](gameplay-g1/phone-finished.png): the mobile clock/best now uses the existing readout below the toolbar; terminal Pause is labeled Finished and disabled, while Retry remains available. Final self-review additionally freezes the official/practice classification after a terminal result, so changing settings after FINISH cannot relabel it; the focused authority regression passes. Final publication-head CI and hosted build identity are tracked in the PR and STATUS.md.

## Preview and limits

Local ordinary release: http://127.0.0.1:8801/index.html?station=first-run . Final preview delivery and tested runtime identity are recorded in the PR and STATUS.md.

Claudio should drive from the staging pad to FINISH, pause/resume, retry, close/reopen to see the best, and try Terrain Look. Stop before merge for that drive test; no further task starts automatically. Browser emulation and synthetic focus/pointer tests do not establish physical touch, real app switching, device storage durability or human driving/fun acceptance. No physical-device, GPU or FPS improvement claim.

## Engine evidence

Consulted official stable 1.14.0 [sys persistence APIs](https://defold.com/ref/sys-lua/#sys.save), [HTML5 storage](https://defold.com/manuals/html5/) and [window events/listener](https://defold.com/ref/window/#window.set_listener). Reuse the existing single window listener and loader-owned proxy time-step/clear-input acknowledgement; do not introduce a second listener or simulation loop. The pinned proxy/fixed-step source and reset ownership remain as documented in the [physics contract](contracts/physics.md#pause-slow-motion-and-live-tuning). Native GUI layout, picking and render order reuse the existing Gym/Editor helpers. Engine guard and actual release/browser observations, rather than documentation alone, establish build/runtime evidence.
