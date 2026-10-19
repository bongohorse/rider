# Rider status

Updated 2026-10-19. The only source for current progress, open acceptance and blockers. Evidence details (SHAs, CI runs, screenshots) live in the linked PRs and issues; the earlier detailed log is in the [git history of this file](https://github.com/bongohorse/rider/blob/764cc01dc94d56448921191405c7f5c601ba42b6/STATUS.md).

**Contents:** [Now](#now) · [Open acceptance](#open-acceptance) · [Milestones](#milestones) · [Measured limits](#measured-limits) · [Open limits and blockers](#open-limits-and-blockers)

## Now

- **CI acceleration (GO 2026-10-19):** [PR #148](https://github.com/bongohorse/rider/pull/148) merged. All selected full PR CI checks passed. Measured first-job start → `required`: **17:55 → 5:50** (1075.279 → 350.299 s, 67.4% shorter); release critical path **6:14 → 3:45**. Five debug Gym groups and three release groups reuse builds within the same run; all regression assertions remain required. The public deployment checks identity and live runtime in both viewports instead of repeating the regression suite. These are individual runs, not a guarantee; evidence and deployment results are in the PR. Follow-up [PR #150](https://github.com/bongohorse/rider/pull/150) merged. It splits seams and sizes into two parts each, merged back into the full reports, splits terrain into three jobs and release phone into phone/touch, with no assertion removed. PR CI **5:50 → 4:44** (350.299 → 284 s, run [39249242942](https://github.com/bongohorse/rider/actions/runs/39249242942)). [Main run 39249959111](https://github.com/bongohorse/rider/actions/runs/39249959111): `required` passed after 4:06; Pages deploy and public verification PASS. `build.json` returned `085b92d` / `39249959111-1`. The longest remaining paths are `Release (desktop)` and `Gym (seams-1)` plus the part merge. [#95](https://github.com/bongohorse/rider/issues/95) retains its separate scheduled-nightly acceptance. No new Level Editor task started.

- **Next:** Level Editor LE3 [#125](https://github.com/bongohorse/rider/issues/125). **No task is active; LE3 starts only with Claudio's new GO** after his LE2 drive test. LE2 merged (GO 2026-10-19): LE1b decisions 1–3 in [PR #144](https://github.com/bongohorse/rider/pull/144), editor shell in [PR #145](https://github.com/bongohorse/rider/pull/145) ([contract](docs/contracts/level-editor.md#editor-shell-le2), debug case `le2`). The editor tasks run strictly in order and each stops for a drive test and a new GO ([plan](docs/PLAN.md#stop-points)).
- Remaining M4 issues (A19b–d, A20, A21) are paused until after the Level Editor (Claudio, 2026-10-18).
- **Preview:** https://bongohorse.github.io/rider/ — [build.json](https://bongohorse.github.io/rider/build.json) names the deployed SHA and run.

## Open acceptance

| Item | State |
| --- | --- |
| A19 gaps and landings ([PR #117](https://github.com/bongohorse/rider/pull/117)) | Merged; Claudio's drive feedback pending |
| LE1a custom levels ([PR #136](https://github.com/bongohorse/rider/pull/136)) | Drive test 2026-10-18: both sample levels imported and drove; the invalid sample was rejected; after a browser reload (F5) the same level was playable. Accepted. Review fixes (id/name byte limit, stale file reads, stuck sync status) in [PR #140](https://github.com/bongohorse/rider/pull/140) |
| LE1b size and performance report ([PR #139](https://github.com/bongohorse/rider/pull/139)) | Merged; desktop values from CI. Touch **Import level** entry for the phone procedure merged in [PR #142](https://github.com/bongohorse/rider/pull/142) (GO 2026-10-18). Claudio's [phone procedure](docs/LE1B_REPORT.md#phone-procedure) and drive test on `seg-800`: NOT RUN |
| LE2 editor shell ([PR #145](https://github.com/bongohorse/rider/pull/145)) | Merged; Claudio's drive test NOT RUN: open `ramps`, press E, move START, place FINISH, drive through it and test from several points (F / Shift+F). Desktop only; phone editing NOT RUN |
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
| Level Editor | 3 of 8 merged: LE1a [#136](https://github.com/bongohorse/rider/pull/136), LE1b [#139](https://github.com/bongohorse/rider/pull/139), LE2 [#144](https://github.com/bongohorse/rider/pull/144) + [#145](https://github.com/bongohorse/rider/pull/145); LE3 awaits GO ([epic #118](https://github.com/bongohorse/rider/issues/118)) | PR description and CI runs |
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
- **Custom level start distance (LE2):**
  - Imports are saved only after the vehicle is drive-ready; a placement failure leaves a safe error state and the previous save (tested in `le1a`).
  - The provisional start limit was **tightened from ±1 km to ±500 m in x and y**: a dense reset sweep failed for 257 of 4000 starts within ±1 km in x and y (from 724 m in x, at 1000 m in y) and for none of 6000 within ±500 m ([decisions after LE1b](docs/contracts/level-editor.md#decisions-after-le1b-claudio-2026-10-18)). ±500 m passes the placement guard; driving far from the origin is unmeasured.
  - Text fields: all at their 64-byte limits plus the speed note give a 1348-byte measurements message (2048-byte cap).
- **Follow-ups:** npm audit/upgrade [#101](https://github.com/bongohorse/rider/issues/101); CI nightly/timing [#95](https://github.com/bongohorse/rider/issues/95).
