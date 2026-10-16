# Rider status

Updated 2026-10-16. This is the sole current progress/blocker source. Evidence below identifies the tested source; CI, merged main, deployment and Claudio's acceptance remain distinct.

## Current work

Claudio authorized M2 on 2026-10-16. **A5–A12 implementation is complete.** The original M2 merge and public deployment passed [CI 38867483415](https://github.com/bongohorse/rider/actions/runs/38867483415) at `f73aac5`. Technical merge/deployment verification is tracked in [PR #54](https://github.com/bongohorse/rider/pull/54); Claudio's milestone drive/listening acceptance remains pending. **M3 is not authorized or started.** No winning preset, final assist strength, crash-fairness or device-performance acceptance is implied.

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

Claudio authorized the M2 feedback follow-up [#61](https://github.com/bongohorse/rider/issues/61) on 2026-10-16: expanded speed/air controls, separate ground pitch assistance, readable speed units, and #58 input-layout dependency. Implementation and local checks complete in [PR #62](https://github.com/bongohorse/rider/pull/62); required runtime/visual and merged-main deployment evidence is tracked there. No human acceptance claimed. Ramps and human air-control testing remain M4; M3 remains unstarted. Candidate values are documented in main/gym/README.md.

## Preview and next action

**Preview:** https://bongohorse.github.io/rider/ . [build.json](https://bongohorse.github.io/rider/build.json) identifies the exact deployed SHA and run/attempt. Main preview deployment is permanently authorized and waits for green `required`; use PR #54 / issue #27 for final cumulative main/deployment evidence.

Claudio's M2 test: compare A/B/C (1/2/3 or buttons), try live sliders, throttle/brake-to-reverse, A/D ground pitch assistance (airborne feel testing in M4), camera response, C crash switch, engine audio/M mute and F feedback copy. The gym remains unrestricted. Authored ramps/step stations are M4; the A12 hard-stop probe is debug-only, not a new production suspension rule. Report feel/comfort/readability and any problems; then approve or revise before M3.

M3's next planned issue is A13 (#28), **only after Claudio's M2 approval**. It adds actual touch trials and measures the reference phone; no M3 implementation has begun.

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
