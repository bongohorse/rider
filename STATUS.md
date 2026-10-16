# Rider status

Updated 2026-10-16. This is the sole current progress/blocker source. Evidence below identifies the tested source; CI, merged main, deployment and Claudio's acceptance remain distinct.

## Current work

M3 scope audit corrected the premature technical-completion claim: all five assigned issues remain open (#58, #28, #29, #68, #69). #68 and #69 were omitted from the prior execution; they are implementation work, not device-only acceptance. Claudio reauthorized completing M3. A13a/#68 is merged in PR #73 (`faefa53`), with green required 38956567507 at `5b11ec0`: coast distance 11.5282 m and brake-tap rest 0 m/s. Closed under the explicit priority-comment authorization; actual-phone feel remains NOT RUN in #28. Current work: #69 compact HUD, P preset cycling, reserved station keys, responsive slider/picking regressions and injected FPS-colour tests. M4 remains unauthorized. Real-device criteria are not replaced by CI.


Claudio authorized starting and completing M3 on 2026-10-16. **A12b presentation is technically complete and merged in [PR #63](https://github.com/bongohorse/rider/pull/63), `b42040a`.** Final source `ceacf4d` passed [required CI 38883421693](https://github.com/bongohorse/rider/actions/runs/38883421693); final desktop/landscape/portrait images were reviewed. Resizing, all nine slider endpoint pairs and input release, camera proportions and both DPI modes passed. CI software-browser DPI2 callback means: ON 37.736 ms / OFF 16.667 ms; this is not phone/GPU performance. #58 stays open for real-device evidence.

**A13 is technically complete and merged in [PR #64](https://github.com/bongohorse/rider/pull/64), `a285f08`.** Final source `ce41b60` passed [required CI 38885765551](https://github.com/bongohorse/rider/actions/runs/38885765551), including eleven release touch cases, actual 30-second capture, fullscreen driving, editor capture release and all existing regressions. Final compact landscape/portrait images were reviewed. #28 stays open for actual-phone criteria.

**A14 tilt implementation is complete; runtime/merge/deployment evidence is tracked in [PR #67](https://github.com/bongohorse/rider/pull/67).** It is OFF by default, uses explicit motion enable/permission, neutral calibration, full-lean angle, dead zone and inversion. It feeds the same normalized lean command; touch/keyboard lean overrides it. Retry, focus/view changes and UI capture pause calibration. Denial, unsupported/missing/invalid sensor data visibly leave touch available. Three local mapping/normalization tests pass; injected orientation events must not be mistaken for real-phone sensor results. M2 human feel/listening acceptance is still not inferred from M3 authorization.

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

**Preview:** https://bongohorse.github.io/rider/ . [build.json](https://bongohorse.github.io/rider/build.json) identifies the exact deployed SHA and run/attempt. Main preview deployment is permanently authorized and waits for green `required`; use PR #67 for cumulative M3 main/deployment evidence.

M3 trial procedure: [MOBILE_TRIAL.md](docs/MOBILE_TRIAL.md). After the M3 technical increments deploy, compare mirrored touch layouts, Retry and the tilt trial on the reference phone. Record Chrome version and actual 60/144-Hz settings, feel/stutter and High DPI ON/OFF captures. Numeric phone physics budgets and the interpolation decision remain unmeasured; keep the initial 60-FPS budget until actual evidence exists.

M3 technical implementation and final verification: A14 is merged as `998248b` with green PR-head and main `required`; the deployed-source check matches. Its first public runtime run passed responsive checks and ten touch cases but failed the immediate post-fullscreen throttle acknowledgement. [A13 follow-up PR #72](https://github.com/bongohorse/rider/pull/72) waits for owner/viewport settlement and requires three fullscreen driving cycles. Exact current-head, merged-main and final public runtime results are tracked there and linked from PR #67.

Next action after green final verification in PR #72: Claudio's reference-phone trial. A12b, A13 and A14 real-device criteria remain open until Claudio supplies actual-phone observations. M4 is not authorized.
## M3 technical checkpoint

- Keep the single fixed owner, existing reset/preset paths and unit adapter. Touch and tilt are browser input sources, not another simulation loop. Native/desktop input remains available.
- Full-window CSS alone was insufficient: panel-root grouping keeps visible sizes, knob/graph positions and picking consistent. Actual engine input/release acknowledgements and screenshots caught gaps that DOM dispatch or static boot checks missed.
- Compact phone controls, mirror comparison and captures make the next acceptance concrete. Detailed tuning remains best in landscape; portrait editor text is small. CI software timings and injected orientation events cannot choose phone DPI, budgets, interpolation, comfort or tilt retention.
- Keep the issue/PR loop. Complete current-head/merged-main/live verification in PR #67, collect Claudio's real-device comparison, then decide whether M3 needs tuning. M4 remains stopped until approval.

## M2 checkpoint: what worked / what changes next

- Keep the pinned Defold-owned Box2D world and sole tick owner. Motor/units, camera, source/run identity and all 100-reset regressions stayed green while the gym grew. The A/B/C and live controls are ready for measured comparison rather than choosing final values upfront.
- Focused runtime probes were necessary: shape filters require group_index; terrain visitors must enable sensor events too; sprite tint uses go.set rather than an obsolete helper. Read exact pinned signatures/defaults and run a minimal probe before expanding the next API-dependent feature.
- Release READY plus a static scene was insufficient when diagnostics were suppressed. Release/live verification now requires continuing owner-to-GUI telemetry sequences.
- Browser down/up pulses can disappear between sampled input frames. Tests now hold inputs until the engine acknowledges them; a corrected observer no longer reinjects an already recovered crash.
- Keep the course and issue/PR loop. Next acceptance priority is Claudio's actual feel/listening feedback, then M3 touch/pacing/device budgets; CI does not choose the preset or prove fun.

## Platform evidence and remaining limits

Reference phone: Xiaomi Mi 10T Pro, Android 12, Snapdragon 865, 2400×1080, adaptive 30–144 Hz. Claudio confirmed M1 desktop driving and actual-phone loading on 2026-10-16. That is not M2 acceptance. Installed phone Chrome version, actual touch, 60/144-Hz pacing, lifecycle and audio listening remain NOT RUN; A13 collects them. Desktop/20:9 browser screenshots are emulation evidence only. Start budget remains 60 FPS / 16.666667 ms mean frame interval; physics-time budget remains unset until measurement.

Local Bob runtime builds were unavailable because build.defold.com did not resolve on this host; native/HTML5/Bridge/APK checks executed in required CI. APK build/signature/manifest checks do not establish installation or device runtime. Test orchestration is guarded out of release execution but its compiled resource is still packaged; physical exclusion requires a build-time split without losing debug coverage.

Bridge license provenance remains unresolved under the existing explicit implementation authorization. Remove the native extension from release binaries before Phase B app distribution; verify exclusion then. No public editor/debug service is deployed. [Release contract](docs/contracts/automation/release.md).

`required` remains the sole mandatory protection context; no bypass or assertion weakening. Administration endpoints remain inaccessible; other saved branch settings rely on Claudio's configuration.

## Prior completed work

S1–S3 and M1 are complete. S3's design direction is in [the plan](docs/PLAN.md) / [brief](docs/GAME_DESIGN.md). M1 uses PRs #41–#44; actual desktop/phone reachability is recorded in closed #19. The pre-M2 wheel-centering fix is merged in #46 (`42e1d0c`), with generated-art checks and deployed preview verification. Historical G0–G2 acceptance is linked from [the documentation index](docs/README.md); it does not replace current gameplay acceptance.
