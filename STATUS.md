# Rider status

Updated 2026-10-17. This is the sole current progress/blocker source. Evidence below identifies the tested source; CI, merged main, deployment and Claudio's acceptance remain distinct.

## Current work

M3 is accepted by Claudio on 2026-10-16 after his browser and phone drive test: he is satisfied with the adjustments, reports that tilt works well, and explicitly authorizes complete M3 closure. All five assigned issues are complete under this acceptance: #58, #28, #29, #68 and #69. M4 is authorized by Claudio on 2026-10-17. Started #30 (A15): validated station data, straight markers, speed start, retry and serialized proxy switching. Implementation checks are in progress; no M4 drive-test acceptance claimed.

| M3 issue | Completion evidence |
| --- | --- |
| [#58 A12b](https://github.com/bongohorse/rider/issues/58) | Full-window/HiDPI/responsive pointers, PR #63; final resized views and eleven slider pairs verified in PR #74. Browser/phone presentation accepted by Claudio. High DPI stays enabled; no phone DPI cost measurement claimed. |
| [#28 A13](https://github.com/bongohorse/rider/issues/28) | Touch/mirrored layouts/Retry/capture, PR #64; final twelve synthetic touch cases pass. Claudio accepts browser/phone driving. No specific mirrored-layout preference or measured refresh-rate comparison supplied. |
| [#29 A14](https://github.com/bongohorse/rider/issues/29) | Tilt, PR #67 and fullscreen follow-up #72; twelve synthetic tilt cases pass. Claudio reports actual-phone tilt works well: KEEP the opt-in implementation, default OFF, with touch fallback. No tuning change requested. |
| [#68 A13a](https://github.com/bongohorse/rider/issues/68) | PR #73 (`faefa53`), required 38956567507 and main/public 38957394494 PASS. Automated coast from 5 m/s stops after 11.5282 m; brake tap settles/stays at 0 m/s. Covered by Claudio's overall acceptance of the adjustments. |
| [#69 A13b](https://github.com/bongohorse/rider/issues/69) | PR #74 (`6df34ec`): compact HUD, collapsible tuning/help, retry toast, slim graphs, P presets and 1–9 reserved. Final current-head required 38961958188 PASS at `bdc429f`; main/public 38962932203 PASS. Browser/phone adjustments accepted by Claudio. |

Accepted implementation: `6df34ecf4c0f79f7003bce96670cf6aec5a05125`, public build `38962932203-1`. [Final CI and public runtime](https://github.com/bongohorse/rider/actions/runs/38962932203) covers twelve touch and twelve tilt cases, all eleven slider endpoint pairs at desktop/portrait/20:9/896×400, fullscreen driving and A5–A12 regressions. Automated evidence and human acceptance remain separate.

Closure exception (owner: Claudio): his explicit instruction to close M3 after successful browser/phone testing is accepted as a qualitative sign-off without the originally requested full Chrome version, locked 60/144-Hz captures, measured phone DPI cost, numerical physics budget or measured interpolation decision. Those measurements remain NOT RUN / not supplied, not PASS. Risk: device performance margins remain unquantified. Retain the initial 60 FPS / 16.666667 ms frame target, no invented physics limit and the current presentation without adding interpolation. Follow up with the reusable mobile capture procedure if pacing problems appear; sustained performance acceptance remains Phase E. Detailed rotation/lifecycle and layout-comparison observations were not supplied. This acceptance does not imply M2 audio listening or APK installation.

A15 implementation is in [PR #76](https://github.com/bongohorse/rider/pull/76). Preliminary runtime evidence at `6e46b5c` / [CI 38985943961](https://github.com/bongohorse/rider/actions/runs/38985943961): new station suite PASS (8 m/s ±0.2 first-step speed and wheel spin, moving Retry without reload, A→B→A with held-input release and hull loading, invalid schema/URL fallback, straight measurements/feedback). Native Linux/Windows physics, Bridge, Android build and isolated build-error regression PASS. Final browser regressions and final-head review remain pending; this is not merged/deployed or human M4 acceptance.

The completed M2 implementation evidence remains below.

| Step | Implementation / evidence |
| --- | --- |
| A5 measurements | Merged [#47](https://github.com/bongohorse/rider/pull/47), `3d932e9`. [Required 38847977625](https://github.com/bongohorse/rider/actions/runs/38847977625) PASS: displayed telemetry/budget; all 100 retries retained. Scenarios extracted from gameplay owner and debug-gated. |
| A6 feel | Merged [#48](https://github.com/bongohorse/rider/pull/48), `9432c56`. [Required 38848408643](https://github.com/bongohorse/rider/actions/runs/38848408643) PASS: reverse -175.73 u/s over -348.78 u, airborne lean 0.220 rad, camera direction/zoom and 100 resets. |
| A7 head rule | Merged [#49](https://github.com/bongohorse/rider/pull/49), `9ed05c7`. [Required 38850563678](https://github.com/bongohorse/rider/actions/runs/38850563678) PASS: displayed contact with default OFF, exactly one labelled head reset when ON, retained sensor, keyboard and overlay switches. |
| A8 sliders | Merged [#50](https://github.com/bongohorse/rider/pull/50), `3f80ebb`. [Required 38851016652](https://github.com/bongohorse/rider/actions/runs/38851016652) PASS: actual spring change without restart, captured throttle isolation, neutral release and invalid tuning rejection. |
| A9 presets | Merged [#51](https://github.com/bongohorse/rider/pull/51), `d34ce9d`. [Required 38851546921](https://github.com/bongohorse/rider/actions/runs/38851546921) PASS: B by URL, invalid fallback, all three candidates driven with real key events, full replacement and one world. |
| A10 sound | Merged [#52](https://github.com/bongohorse/rider/pull/52), `48cb5a9`. [Required 38852084467](https://github.com/bongohorse/rider/actions/runs/38852084467) PASS: no autoplay, one voice, wheel-dependent 1.370x playback property and running browser AudioContext after input. Human listening remains NOT RUN. |
| A11 feedback | Merged [#53](https://github.com/bongohorse/rider/pull/53), `7388396`. [Required 38852573731](https://github.com/bongohorse/rider/actions/runs/38852573731) PASS: actual isolated-browser clipboard readback with every field/current source, and visible selectable fallback after injected denial. Native clipboard is unavailable and labelled. |
| A12 graphs | Implemented in [#54](https://github.com/bongohorse/rider/pull/54). Code-head `ace30e5b420e325573fdf95ed2df9d01aadaa1f6` [required 38853100487](https://github.com/bongohorse/rider/actions/runs/38853100487) PASS: physical stop peak 17.6 u drawn, expired naturally, 301 samples over 5.0000003 s; spike/desktop/phone-emulation images reviewed. Final PR checks also cover the narrower panel, restored probe limits and no-reset expiry. |

Claudio authorized the M2 feedback follow-up [#61](https://github.com/bongohorse/rider/issues/61) on 2026-10-16: expanded speed/air controls, separate ground pitch assistance, readable speed units, and #58 input-layout dependency. Implementation and local checks complete in [PR #62](https://github.com/bongohorse/rider/pull/62); required runtime/visual and merged-main deployment evidence is tracked there. No human acceptance claimed. Ramps and human air-control testing remain M4; M3 is authorized; A12b and A13 are merged. Candidate values are documented in main/gym/README.md.

Before M3, Claudio authorized closing docs-only [#59](https://github.com/bongohorse/rider/issues/59) through existing [PR #60](https://github.com/bongohorse/rider/pull/60). Review reduced the list to five recurring pitfalls, added direct evidence links and corrected the shape-index guidance. Documentation checks and final required/main deployment evidence are tracked in that PR; no gameplay change. M3 was separately authorized afterwards.

## Preview and next action

**Preview:** https://bongohorse.github.io/rider/ . [build.json](https://bongohorse.github.io/rider/build.json) identifies the exact deployed SHA and run/attempt. Main preview deployment is permanently authorized and waits for green `required`; use PR #74 for the final HUD/current M3 main/deployment evidence; PR #73 records the coasting fix.

M3 drive test is accepted. [MOBILE_TRIAL.md](docs/MOBILE_TRIAL.md) remains a reusable diagnostic procedure; [PLATFORM_MATRIX.md](docs/PLATFORM_MATRIX.md) distinguishes Claudio's qualitative acceptance from unmeasured performance. M4 authorized on 2026-10-17. Work through its eleven assigned issues one PR at a time, starting with #30. At the end, stop for Claudio’s browser/phone drive test; M5 is not authorized.

## M3 checkpoint

- Keep the single fixed owner, reset/preset paths and unit adapter. Touch and tilt remain input sources rather than simulation loops.
- Check the live milestone assignment list at closure: the original audit missed #68 and #69.
- Full-window panel roots, GUI-mapped picking and engine input/release acknowledgements caught gaps that static boot checks missed. Preserve these regression checks.
- Claudio accepted the browser/phone adjustments and tilt. Keep optional tilt and the current controls; no additional tuning was requested. M4 approval subsequently granted on 2026-10-17; keep the M3 acceptance limits above.

## M2 checkpoint: what worked / what changes next

- Keep the pinned Defold-owned Box2D world and sole tick owner. Motor/units, camera, source/run identity and all 100-reset regressions stayed green while the gym grew. The A/B/C and live controls are ready for measured comparison rather than choosing final values upfront.
- Focused runtime probes were necessary: shape filters require group_index; terrain visitors must enable sensor events too; sprite tint uses go.set rather than an obsolete helper. Read exact pinned signatures/defaults and run a minimal probe before expanding the next API-dependent feature.
- Release READY plus a static scene was insufficient when diagnostics were suppressed. Release/live verification now requires continuing owner-to-GUI telemetry sequences.
- Browser down/up pulses can disappear between sampled input frames. Tests now hold inputs until the engine acknowledges them; a corrected observer no longer reinjects an already recovered crash.
- Keep the course and issue/PR loop. Next acceptance priority is Claudio's actual feel/listening feedback, then M3 touch/pacing/device budgets; CI does not choose the preset or prove fun.

## Platform evidence and remaining limits

Reference phone: Xiaomi Mi 10T Pro, Android 12, Snapdragon 865, 2400×1080, adaptive 30–144 Hz. Claudio accepted M3 browser/phone testing and tilt on 2026-10-16. Full Chrome version, actual refresh modes, numerical phone timings/DPI comparison and detailed lifecycle observations were not supplied; see the closure exception above. Desktop/20:9 CI screenshots remain emulation evidence. Audio listening and APK installation are not inferred.

Local Bob runtime builds were unavailable because build.defold.com did not resolve on this host; native/HTML5/Bridge/APK checks executed in required CI. APK build/signature/manifest checks do not establish installation or device runtime. Test orchestration is guarded out of release execution but its compiled resource is still packaged; physical exclusion requires a build-time split without losing debug coverage.

Bridge license provenance remains unresolved under the existing explicit implementation authorization. Remove the native extension from release binaries before Phase B app distribution; verify exclusion then. No public editor/debug service is deployed. [Release contract](docs/contracts/automation/release.md).

`required` remains the sole mandatory protection context; no bypass or assertion weakening. Administration endpoints remain inaccessible; other saved branch settings rely on Claudio's configuration.

## Prior completed work

S1–S3 and M1 are complete. S3's design direction is in [the plan](docs/PLAN.md) / [brief](docs/GAME_DESIGN.md). M1 uses PRs #41–#44; actual desktop/phone reachability is recorded in closed #19. The pre-M2 wheel-centering fix is merged in #46 (`42e1d0c`), with generated-art checks and deployed preview verification. Historical G0–G2 acceptance is linked from [the documentation index](docs/README.md); it does not replace current gameplay acceptance.
