# Rider status

Updated 2026-10-18. The only source for current progress, open acceptance and blockers. Evidence details (SHAs, CI runs, screenshots) live in the linked PRs and issues; the earlier detailed log is in the [git history of this file](https://github.com/bongohorse/rider/blob/764cc01dc94d56448921191405c7f5c601ba42b6/STATUS.md).

**Contents:** [Now](#now) · [Open acceptance](#open-acceptance) · [Milestones](#milestones) · [Measured limits](#measured-limits) · [Open limits and blockers](#open-limits-and-blockers)

## Now

- **Next:** Level Editor LE1a [#122](https://github.com/bongohorse/rider/issues/122). **No task is active; LE1a starts only with Claudio's GO.** The editor tasks run strictly in order and each stops for a drive test and a new GO ([plan](docs/PLAN.md#stop-points), [contract](docs/contracts/level-editor.md)). No editor implementation or evidence exists yet.
- Remaining M4 issues (A19b–d, A20, A21) are paused until after the Level Editor (Claudio, 2026-10-18).
- **Preview:** https://bongohorse.github.io/rider/ — [build.json](https://bongohorse.github.io/rider/build.json) names the deployed SHA and run.

## Open acceptance

| Item | State |
| --- | --- |
| A19 gaps and landings ([PR #117](https://github.com/bongohorse/rider/pull/117)) | Merged; Claudio's drive feedback pending |
| M4 final drive test | After the remaining M4 stations |
| M4 stations on the real phone | NOT RUN |
| Engine sound by ear (A10) | NOT RUN |

Received: A15a rider reaction "works, subtle, OK for now"; A18 "hull strip drives noticeably badly", consistent with the measurement.

## Milestones

| Milestone | State | Evidence |
| --- | --- | --- |
| M1 – It drives | Complete | PRs #41–#44; reachability in [#19](https://github.com/bongohorse/rider/issues/19) |
| M2 – It is measurable | Complete, plus feedback round [#61](https://github.com/bongohorse/rider/issues/61) | PRs #47–#54, #62 |
| M3 – Mobile | Accepted by Claudio 2026-10-16 (browser and phone; tilt kept opt-in, default off) with a measurement exception, see [platform matrix](docs/PLATFORM_MATRIX.md) | PRs #63, #64, #67, #72–#74 |
| M4 – Stations | 6 of 11 merged: A15 [#76](https://github.com/bongohorse/rider/pull/76), A16 [#77](https://github.com/bongohorse/rider/pull/77), A17 [#78](https://github.com/bongohorse/rider/pull/78), A18 [#113](https://github.com/bongohorse/rider/pull/113), A15a [#115](https://github.com/bongohorse/rider/pull/115), A19 [#117](https://github.com/bongohorse/rider/pull/117); paused for the Level Editor | PR descriptions and CI runs |
| Level Editor | Prepared ([epic #118](https://github.com/bongohorse/rider/issues/118)); awaits GO | — |
| M5 – Lock in | Not authorized | — |

## Measured limits

Preset A under the declared automated protocols; not player limits or tuning targets. Protocols: [gym notes](main/gym/README.md), [A18 protocol](docs/A18_SEAM_PROTOCOL.md).

| Station | Result | Source |
| --- | --- | --- |
| Coasting | 5 m/s to standstill in 11.53 m; brake tap settles at 0 | [PR #73](https://github.com/bongohorse/rider/pull/73) |
| Ramps, 8 m/s start, full throttle | 1 m kick ramps: 5–45° climbed; 4 m climbs: 5–35° climbed; 60° and wall fail. Neutral descents are not held by the motor brake | [PR #77](https://github.com/bongohorse/rider/pull/77) |
| Steps, 5 m/s | Up 0.05–0.15 m climbed, 0.20–0.50 m stuck; all descents landed | [PR #78](https://github.com/bongohorse/rider/pull/78) |
| Seams, free roll 5/7/9 m/s | Chain 0 ghost bumps; abutting hulls 20 of 20 seams, losing 1.8–3.6 m/s. D8 confirmed | [PR #113](https://github.com/bongohorse/rider/pull/113) |
| Gaps | Widest cleared: 3 m at 7 m/s, 4 m at 9 m/s; 2 m flat/down/upslope landings cleared | [PR #117](https://github.com/bongohorse/rider/pull/117) |
| Top rolling speed | About 10 m/s: Box2D's rotation cap (0.25π per step) limits wheel spin; motor of preset A reaches about 7 m/s | [#114](https://github.com/bongohorse/rider/issues/114) |

## Open limits and blockers

- **Debug listeners:** the native debug engine/Bridge binds on all IPv4 interfaces; not a security PASS. Run only owned, short-lived debug tests; never publish them ([#112](https://github.com/bongohorse/rider/issues/112), [bridge](docs/contracts/bridge.md#network-boundary)). Normal HTML5 work is unaffected.
- **Phase B release work:** remove the Bridge from release binaries; split debug test resources out of release builds (currently packaged but inactive); Bridge license provenance is unresolved under the maintainer's implementation authorization.
- **Phone performance:** unmeasured (Chrome version, refresh modes, frame times, DPI cost). Keep the 60 FPS target and no physics budget; run the [phone trial](docs/MOBILE_TRIAL.md) before Phase B.
- **Android:** APK build, signature and manifest are CI-checked; no device installation yet.
- **Review enforcement:** `required` is the only protected check; zero approving reviews are required, so independent review is a workflow rule, not technically enforced.
- **Follow-ups:** npm audit/upgrade [#101](https://github.com/bongohorse/rider/issues/101); CI nightly/timing [#95](https://github.com/bongohorse/rider/issues/95).
