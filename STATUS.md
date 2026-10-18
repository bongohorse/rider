# Rider status

Updated 2026-10-18. The only source for current progress, open acceptance and blockers. Evidence details (SHAs, CI runs, screenshots) live in the linked PRs and issues; the earlier detailed log is in the [git history of this file](https://github.com/bongohorse/rider/blob/764cc01dc94d56448921191405c7f5c601ba42b6/STATUS.md).

**Contents:** [Now](#now) · [Open acceptance](#open-acceptance) · [Milestones](#milestones) · [Measured limits](#measured-limits) · [Open limits and blockers](#open-limits-and-blockers)

## Now

- **Next:** Level Editor LE2 [#124](https://github.com/bongohorse/rider/issues/124). **No task is active; LE2 starts only with Claudio's new GO** after his LE1b phone measurement and drive test. LE1b merged in [PR #139](https://github.com/bongohorse/rider/pull/139) (GO 2026-10-18); report: [LE1b report](docs/LE1B_REPORT.md). The editor tasks run strictly in order and each stops for a drive test and a new GO ([plan](docs/PLAN.md#stop-points), [contract](docs/contracts/level-editor.md)).
- Remaining M4 issues (A19b–d, A20, A21) are paused until after the Level Editor (Claudio, 2026-10-18).
- **Preview:** https://bongohorse.github.io/rider/ — [build.json](https://bongohorse.github.io/rider/build.json) names the deployed SHA and run.

## Open acceptance

| Item | State |
| --- | --- |
| A19 gaps and landings ([PR #117](https://github.com/bongohorse/rider/pull/117)) | Merged; Claudio's drive feedback pending |
| LE1a custom levels ([PR #136](https://github.com/bongohorse/rider/pull/136)) | Drive test 2026-10-18: both sample levels imported and drove; the invalid sample was rejected; after a browser reload (F5) the same level was playable. Accepted |
| LE1b size and performance report ([PR #139](https://github.com/bongohorse/rider/pull/139)) | Merged; desktop values from CI. Touch **Import level** entry for the phone procedure merged in [PR #142](https://github.com/bongohorse/rider/pull/142) (GO 2026-10-18). Claudio's [phone procedure](docs/LE1B_REPORT.md#phone-procedure) and drive test on `seg-800`: NOT RUN |
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
| Level Editor | 2 of 8 merged: LE1a [#136](https://github.com/bongohorse/rider/pull/136), LE1b [#139](https://github.com/bongohorse/rider/pull/139); LE2 awaits GO ([epic #118](https://github.com/bongohorse/rider/issues/118)) | PR description and CI runs |
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
| Custom levels (LE1b, desktop CI) | Import → drive-ready median 55–68 ms; longest switch frame 21–26 ms at 612–800 render objects; physics step at the 0.1 ms clock step; a full level uses 804 of 1024 sprites | [LE1b report](docs/LE1B_REPORT.md) |
| Top rolling speed | About 10 m/s: Box2D's rotation cap (0.25π per step) limits wheel spin; motor of preset A reaches about 7 m/s | [#114](https://github.com/bongohorse/rider/issues/114) |

## Open limits and blockers

- **Debug listeners:** the native debug engine/Bridge binds on all IPv4 interfaces; not a security PASS. Run only owned, short-lived debug tests; never publish them ([#112](https://github.com/bongohorse/rider/issues/112), [bridge](docs/contracts/bridge.md#network-boundary)). Normal HTML5 work is unaffected.
- **Phase B release work:** remove the Bridge from release binaries; split debug test resources out of release builds (currently packaged but inactive); Bridge license provenance is unresolved under the maintainer's implementation authorization.
- **Phone performance:** unmeasured (Chrome version, refresh modes, frame times, DPI cost). Keep the 60 FPS target and no physics budget; run the [phone trial](docs/MOBILE_TRIAL.md) before Phase B.
- **Android:** APK build, signature and manifest are CI-checked; no device installation yet.
- **Review enforcement:** `required` is the only protected check; zero approving reviews are required, so independent review is a workflow rule, not technically enforced.
- **Custom level start distance (LE1b finding, decision for LE2/LE3):**
  - A validated start 1.5 km or more from x = 0 fails vehicle placement (`Noncanonical reset pose`).
  - The broken level is still saved (recorded); that a reload restores it is inferred, not tested.
  - Also open: unbounded level text fields against the 2 KiB `msg.post` cap.
  - Decided 2026-10-18 for LE2: save only drive-ready levels, a provisional start limit of ±1 km with placement tests, byte-based text field tests ([decisions after LE1b](docs/contracts/level-editor.md#decisions-after-le1b-claudio-2026-10-18)). ±1 km is not a proven safe zone.
- **Follow-ups:** npm audit/upgrade [#101](https://github.com/bongohorse/rider/issues/101); CI nightly/timing [#95](https://github.com/bongohorse/rider/issues/95).
