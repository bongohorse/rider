# Rider plan (2026-10-15)

Authoritative plan, adopted from the approved English handoff. [STATUS.md](../STATUS.md) is the sole current status source. Historical gate documents do not govern current work.

## Context

- Rider is a 2D mobile driving game: Defold 1.14.0 (engine commit `a81dbb0478e8b73931dc2d671563204f6ac0ef82`), integrated Box2D 3.1.0, Trials- and early-TrackMania-inspired.
- G0–G2 are complete (see `docs/history/G2_ACCEPTANCE.md`). There is no gameplay code yet.
- New direction: a **Driving Gym** replaces the old G3 and most of G4a. Work is organised as GitHub issues in milestones M1–M5 instead of gate documents.

## Decisions (binding)

- **D1** Driving Gym instead of an abstract sandbox: checkerboard test level, drivable buggy, test stations.
- **D2** Rider with a head sensor; crash detection has an on/off switch (key + overlay). Off by default in the gym (crash is only displayed), on in challenges.
- **D3** GitHub issues + milestones replace gate documents. One issue = one PR, 1–3 testable acceptance criteria.
- **D4** The browser (HTML5) is the main test platform; Claudio runs the milestone drive tests.
- **D5** Public HTML5 preview on GitHub Pages at `bongohorse.github.io/rider`, deployed automatically on every merge to `main` and manually via `workflow_dispatch`. This deployment authorisation is permanent for the preview.
- **D6** Android first; iOS only after the Play Store launch. No iOS builds until then. Keep desktop/web/other exports possible (no platform-specific gameplay logic).
- **D7** Keep Defold 1.14.0 + integrated Box2D 3.1.0; no custom physics extension, no manual world stepping.
- **D8** Terrain = chain shapes (`b2d.body.create_chain`) built from polyline data; obstacles = hull collision objects. Subject to the seam measurement in A18.
- **D9** Retry resets the running world without a collection reload; proxy reload only for track switches. Subject to measurement in A3.
- **D10** Feel before infrastructure: tests, docs and tooling grow only with what the gym actually needs.
- **D11** All agent-facing documents in English. Game UI stays English.
- **D12** Reference device: Xiaomi Mi 10T Pro, Android 12, Snapdragon 865, 6.67" LCD 2400×1080 (20:9), 30–144 Hz adaptive refresh. Chrome version still to be recorded.
- **D13** Start budget 60 FPS shown in the overlay (A5); concrete frame-time and physics-step limits are set after the first device measurement (A13).
- **D14** Preview URL: `bongohorse.github.io/rider`.
- **D15** The repository agent implements S1–S3 and creates all issues below.

## Rules that stay unchanged

- G1 physics contracts remain binding: single tick owner, unit conversion once at the boundary, Defold-owned bodies, handle validity on reset.
- Status values PASS / FAIL / BLOCKED / NOT RUN stay distinct. Never invent test results, screenshots or device evidence.
- Merge only with a green `required` check (after S1).
- At the end of each milestone: stop, report the preview URL and ask Claudio for a drive test. Do not start the next milestone until he approves.
- A structural blocker (missing API, platform limit) stops only the affected issue; independent issues continue.
- Keep the pinned toolchain; Renovate without automerge.
- The Automation Bridge stays as a debug tool; it must be removed from release builds before any app is distributed (Phase B).

## First tasks, in order

1. **S1 – Complete required checks.** Add one aggregated job `required` that depends on bootstrap, physics (native + HTML5), Bridge and Android jobs. Run the physics workflows also on `push: main`. Ask Claudio to make `required` the only required check in branch protection. Acceptance: an intentionally failing physics run blocks the merge.
2. **S2 – Switch to issues.** Add the issue template below, labels, milestones M1–M5. Create `STATUS.md` as the single status source. Commit this plan as `docs/PLAN.md`. Fix contradictory status statements, the iOS scope and the deployment restriction in `docs/`. Mark old G3/G4a gate files as superseded by `docs/PLAN.md`. Move G0–G2 records and the v1.4.1 masterplan to `docs/history/`; keep physics/automation contracts in `docs/contracts/`. Create all 22 issues below. Acceptance: no contradictory status statements remain (`grep`); 22 issues exist in five milestones.
3. **S3 – Game design brief v0.** One page in `docs/GAME_DESIGN.md`: core loop, duration policy (unrestricted gym; level lengths decided by playtests), control concept, fail rules, how Rider differs from Trials and TrackMania, open design questions. Acceptance: Claudio has read the brief and supplied written design direction; comfort/feel/fairness choices are assigned to playable trials rather than required upfront.

## Issue template

```markdown
## Goal
One sentence: what becomes playable or measurable.

## Scope
- …

## Out of scope
- …

## Acceptance (1–3 testable criteria)
- [ ] …

## Drive test by Claudio needed?
yes / no

## Depends on
#…

## Notes
Affected contracts (units, lifecycle, ownership), relevant APIs, known risks.
```

## Issues to create

### M1 – It drives

| # | Title and scope | Acceptance | Depends on |
| --- | --- | --- | --- |
| A1 | **Gym skeleton:** own boot collection (G1 tests still reachable via settings override), flat chain floor, checkerboard tiled sprites, follow camera | Game boots into the gym; G1 physics suite stays green | S1 |
| A2 | **Buggy v0:** chassis, two wheels, wheel joints with spring and motor; throttle and brake on keyboard through the tick owner | Buggy drives and brakes; does not flip on launch | A1 |
| A3 | **In-world reset** (key R) | No collection reload; 100 resets without invalid handles; reset duration measured | A2 |
| A4 | **HTML5 preview on GitHub Pages:** auto-deploy on merge to `main`, manual `workflow_dispatch`; commit SHA visible in game; per-build unique file names against stale cache | Current build reachable at `bongohorse.github.io/rider` on desktop and phone | A1 |

### M2 – It is measurable

| # | Title and scope | Acceptance | Depends on |
| --- | --- | --- | --- |
| A5 | **Debug overlay with budget:** speed, wheel contact, suspension travel, FPS, frame time, physics step time (`b2d.world.get_profile`); values over budget shown red; start budget 60 FPS | Values visible and plausible; budget limits read from a config file | A2 |
| A6 | **Feel layer:** all driving and camera parameters in one place with a unit adapter; air lean, reverse; camera look-ahead and speed-based zoom | Lean works in the air; no tuning values scattered in code | A2 |
| A7 | **Rider with head sensor and crash switch** (key + overlay) | Head contact detected; switch on → reset; off → display only | A3, A5 |
| A8 | **Live sliders** for 5–8 feel parameters in the overlay | Changes apply without restart | A5, A6 |
| A9 | **Presets A/B/C** as data files, switchable by key and URL (`?preset=b`) | Three presets drivable back to back; URL opens the chosen preset | A6, A4 |
| A10 | **Placeholder engine sound:** one loop, pitch follows wheel speed; starts after the first input | Pitch audibly tied to speed; no audio errors in the browser | A2 |
| A11 | **Feedback key:** copies commit, preset, station and latest measurements to the clipboard, formatted as issue text | Pasted text contains all fields | A5, A9 |
| A12 | **Mini graph in the overlay:** speed and suspension travel over the last 5 s | Suspension bottoming is visible as a spike | A5 |

### M3 – Mobile

| # | Title and scope | Acceptance | Depends on |
| --- | --- | --- | --- |
| A13 | **Touch controls v0** (four zones) and **device test** in Android Chrome on the Xiaomi Mi 10T Pro: drivability, frame time, visible stutter at 60 Hz and 144 Hz, 20:9 layout | Drivable on the device; measurements and Chrome version in the platform matrix; concrete budget values set; decision whether visual interpolation is needed | A4, A6 |
| A14 | **Experiment: tilt steering** for lean (implementation and trial required; final retention decided after testing) | Tilt lean implemented and tested on the reference phone; comparison with touch buttons documented; Claudio-informed keep/drop decision recorded | A13 |

### M4 – Stations

| # | Title and scope | Acceptance | Depends on |
| --- | --- | --- | --- |
| A15 | **Straight with distance markers** (1 m / 10 m) | Top speed and braking distance readable | A5 |
| A16 | **Track format** (polyline JSON with version field) and **ramps** at 10°, 20°, 30° | Ramps are built from data, not code | A15 |
| A17 | **Steps** of 0.1 m, 0.25 m, 0.5 m | Suspension bottoming is reproducible | A16 |
| A18 | **Seam strip, chain vs hull** | Ghost-bump measurement at 5, 15, 30 m/s; D8 confirmed or revised | A16 |
| A19 | **Gaps and landing zones** | Same input gives a reproducible jump | A16 |
| A20 | **Station teleport, pause and slow motion** (`set_time_step`); station selectable by URL (`?station=ramps`) | Every station reachable by key and URL | A15, A9 |
| A21 | **Record inputs and replay them with another preset**, with a translucent ghost of the recording | The same run with two presets visible side by side | A9, A20 |

### M5 – Lock in

| # | Title and scope | Acceptance | Depends on |
| --- | --- | --- | --- |
| A22 | **Regression tests from tick traces** for 2–3 stations | CI detects unintended changes of jump distance or top speed | M4 + approved feel values |

**Head sensor approach (plausible, verify in A7):** a sensor shape on the chassis via `b2d.body.create_shape` with `sensor = true`, queried with `get_sensor_overlaps`. Both exist in the 1.14.0 bindings; the lifecycle of script-created shapes on reset is not yet proven. No ragdoll needed for the gym.

## Later phases (do not create issues yet)

- **B – First challenge and fun acceptance:** finalise the design brief; initial short track around 60 s, adjusted through playtesting; elapsed timer and best time, no implicit deadline; crash detection on; juice (landing dust, light screen shake, visible suspension); multi-touch cases; APK sideload on the device; Bridge debug-only; short performance check.
- **C – Three challenges:** jump/landing, balance, small physics puzzle; optional labs as gym stations.
- **D – Art, audio, content.**
- **E – Full stability and performance acceptance** with representative art, plus a weaker Android device.
- **F – Android release (Play Store).**
- **G – iOS** after the Play Store launch.


## Implementation clarifications

- Milestone approval remains mandatory even if an issue's technical dependencies are already complete. Claudio has read v0 and supplied the design direction below; comfort, feel and fairness choices are settled through their planned tests, not demanded upfront.
- A11 and A12 may use the current flat gym and a focused controlled suspension probe before the full M4 stations exist; no extra station dependency is implied.
- A13 collects the missing phone Chrome version and actual refresh/frame data; device identity is supplied but no device runtime is claimed.
- A20 uses collection-proxy time scaling. A1 must keep the gym world arrangement compatible with that mechanism; single-step is optional and is not part of A20.
- A21 compares a candidate replay using the same tick commands against a translucent reference drawn from recorded transforms. Cross-platform bit-exact re-simulation and a separate split-screen renderer are not required.
- The German feedback and original review explain the decisions; where they differ from the later approved English handoff, D1–D15 and S1–S3 above govern. In particular, the revised plan schedules mobile HTML5 testing in M3, APK sideload/Bridge binary exclusion in Phase B, and full stability testing after representative art in Phase E.

## Claudio's design feedback — 2026-10-15

This later feedback updates the initial handoff wherever duration or optionality differs. The detailed brief and recovery proposal are in [GAME_DESIGN.md](GAME_DESIGN.md).

- Gym: unrestricted practice, no time limit or prescribed session length. Measurement timers do not end a run.
- Finished level duration is unsettled and may vary; 60 s–5 min is exploratory. The first challenge is a short prototype around one minute, with actual duration decided through playtesting; elapsed time is not a deadline.
- A13 compares mirrored four-zone layouts on the phone. A14 must implement a tilt trial; only retention in the finished product remains optional. Unsupported hardware/permission limits block the affected test rather than silently dropping the requested experiment.
- Build presets/assists and the switchable head-contact rule, then let Claudio compare feel/fairness. No preferred values or final crash verdict are required before building the trials.
- Recovery proposal for A3 and later station/touch integration: manual Retry to the current station's safe start (initial gym spawn until stations exist), generous authored safety bounds with reason-labelled automatic recovery, and no timeout/stuck auto-reset during practice. Camera visibility alone is not a boundary. Reuse the same reset path and validate all paths.
- First challenge starts without checkpoints; trial an authored safe checkpoint only if full restarts hinder learning later sections. Recovery/bounds/checkpoint defaults are proposals to test, not user-approved or measured final behavior.

## GitHub issue index

| Milestone | Issue | Task |
| --- | --- | --- |
| M1 | [A1 / #16](https://github.com/bongohorse/rider/issues/16) | Gym skeleton |
| M1 | [A2 / #17](https://github.com/bongohorse/rider/issues/17) | Buggy v0 |
| M1 | [A3 / #18](https://github.com/bongohorse/rider/issues/18) | In-world reset |
| M1 | [A4 / #19](https://github.com/bongohorse/rider/issues/19) | HTML5 preview on GitHub Pages |
| M2 | [A5 / #20](https://github.com/bongohorse/rider/issues/20) | Debug overlay with budget |
| M2 | [A6 / #21](https://github.com/bongohorse/rider/issues/21) | Feel layer |
| M2 | [A7 / #22](https://github.com/bongohorse/rider/issues/22) | Rider with head sensor and crash switch |
| M2 | [A8 / #23](https://github.com/bongohorse/rider/issues/23) | Live sliders |
| M2 | [A9 / #24](https://github.com/bongohorse/rider/issues/24) | Presets A/B/C |
| M2 | [A10 / #25](https://github.com/bongohorse/rider/issues/25) | Placeholder engine sound |
| M2 | [A11 / #26](https://github.com/bongohorse/rider/issues/26) | Feedback key |
| M2 | [A12 / #27](https://github.com/bongohorse/rider/issues/27) | Mini graph in the overlay |
| M3 | [A13 / #28](https://github.com/bongohorse/rider/issues/28) | Touch controls v0 |
| M3 | [A14 / #29](https://github.com/bongohorse/rider/issues/29) | Experiment: tilt steering |
| M4 | [A15 / #30](https://github.com/bongohorse/rider/issues/30) | Straight with distance markers |
| M4 | [A16 / #31](https://github.com/bongohorse/rider/issues/31) | Track format |
| M4 | [A17 / #32](https://github.com/bongohorse/rider/issues/32) | Steps |
| M4 | [A18 / #33](https://github.com/bongohorse/rider/issues/33) | Seam strip, chain vs hull |
| M4 | [A19 / #34](https://github.com/bongohorse/rider/issues/34) | Gaps and landing zones |
| M4 | [A20 / #35](https://github.com/bongohorse/rider/issues/35) | Station teleport, pause and slow motion |
| M4 | [A21 / #36](https://github.com/bongohorse/rider/issues/36) | Record inputs and replay them with another preset |
| M5 | [A22 / #37](https://github.com/bongohorse/rider/issues/37) | Regression tests from tick traces |
