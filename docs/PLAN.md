# Rider plan

Binding goal, decisions, roadmap and stop points. [STATUS.md](../STATUS.md) holds current progress; GitHub issues hold each task's scope and acceptance; [AGENTS.md](../AGENTS.md) holds the working rules. Historical gate documents do not govern current work.

## Goal

Rider is a 2D mobile driving game inspired by Trials and early TrackMania, built with Defold and its integrated Box2D. A **Driving Gym** with test stations comes first: feel before infrastructure. Design intent and open design choices are in [GAME_DESIGN.md](GAME_DESIGN.md).

## Decisions

- **D1** Driving Gym instead of an abstract sandbox: checkerboard test level, drivable buggy, test stations.
- **D2** Rider with a head sensor; crash detection has an on/off switch (key + overlay). Off by default in the gym (crash is only displayed), on in challenges.
- **D3** GitHub issues + milestones replace gate documents. One issue = one PR, 1–3 testable acceptance criteria ([issue template](../.github/ISSUE_TEMPLATE/task.md)).
- **D4** The browser (HTML5) is the main test platform; Claudio runs the drive tests.
- **D5** Public HTML5 preview at `bongohorse.github.io/rider`, deployed automatically on every game/tooling-affecting merge to `main` and manually via `workflow_dispatch`; documentation-only merges keep the deployed build. This deployment authorisation is permanent. (Former D14 merged here.)
- **D6** Android first; iOS only after the Play Store launch, no iOS builds until then. Keep other exports possible; no platform-specific gameplay logic.
- **D7** Keep the pinned Defold 1.14.0 + integrated Box2D 3.1.0 ([toolchain lock](TOOLCHAIN_LOCK.md)); no custom physics extension, no manual world stepping.
- **D8** Terrain = chain shapes built from polyline data; obstacles = hull collision objects. Confirmed by A18: do not build drivable terrain from abutting hulls.
- **D9** Retry resets the running world without a collection reload; proxy reload only for track switches.
- **D10** Feel before infrastructure: tests, docs and tooling grow only with what the gym actually needs.
- **D11** All agent-facing documents and the game UI are English.
- **D12** Reference device: Xiaomi Mi 10T Pro ([platform matrix](PLATFORM_MATRIX.md)).
- **D13** Frame target 60 FPS (16.67 ms); physics budget stays unset until representative-load measurement in Phase E.

## Roadmap

| Milestone | Goal | Issues |
| --- | --- | --- |
| M1 – It drives | Gym, buggy, in-world reset, HTML5 preview | [#16](https://github.com/bongohorse/rider/issues/16)–[#19](https://github.com/bongohorse/rider/issues/19) |
| M2 – It is measurable | Overlay/budget, feel layer, head sensor, sliders, presets, sound, feedback key, graph | [#20](https://github.com/bongohorse/rider/issues/20)–[#27](https://github.com/bongohorse/rider/issues/27) |
| M3 – Mobile | Full-window/HiDPI, touch, coasting fix, compact HUD, tilt trial | [#58](https://github.com/bongohorse/rider/issues/58), [#28](https://github.com/bongohorse/rider/issues/28), [#68](https://github.com/bongohorse/rider/issues/68), [#69](https://github.com/bongohorse/rider/issues/69), [#29](https://github.com/bongohorse/rider/issues/29) |
| M4 – Stations | Directly selectable measurement stations | A15–A19, A15a ([#30](https://github.com/bongohorse/rider/issues/30)–[#34](https://github.com/bongohorse/rider/issues/34), [#70](https://github.com/bongohorse/rider/issues/70)); after the Level Editor: A19b–d ([#55](https://github.com/bongohorse/rider/issues/55)–[#57](https://github.com/bongohorse/rider/issues/57)), A20 [#35](https://github.com/bongohorse/rider/issues/35), A21 [#36](https://github.com/bongohorse/rider/issues/36) |
| Level Editor | In-game developer level editor ([epic #118](https://github.com/bongohorse/rider/issues/118), [contract](contracts/level-editor.md)) | Strictly sequential: LE1a [#122](https://github.com/bongohorse/rider/issues/122), LE1b [#123](https://github.com/bongohorse/rider/issues/123), LE2 [#124](https://github.com/bongohorse/rider/issues/124), LE3 [#125](https://github.com/bongohorse/rider/issues/125), LE4 [#126](https://github.com/bongohorse/rider/issues/126), LE5a [#127](https://github.com/bongohorse/rider/issues/127), LE5b [#128](https://github.com/bongohorse/rider/issues/128), LE6 [#129](https://github.com/bongohorse/rider/issues/129) |
| M5 – Lock in | Regression tests from tick traces | A22 [#37](https://github.com/bongohorse/rider/issues/37), after M4 and approved feel values |

Progress and open drive acceptance are tracked in STATUS.md. Claudio decided on 2026-10-18 to run the Level Editor before the remaining M4 issues. Gameplay objects ([#120](https://github.com/bongohorse/rider/issues/120)) and visual authoring ([#121](https://github.com/bongohorse/rider/issues/121)) are later, separate epics.

M4 notes: report measured limits separately from Claudio's drive test; keep station logic outside the controller; measure downhill neutral motor braking at ramps; run [MOBILE_TRIAL](MOBILE_TRIAL.md) before Phase B.

## Stop points

- **Milestone end:** stop, report the preview URL and ask Claudio for a drive test. Do not start the next milestone until he approves, even if technical dependencies are complete.
- **Level Editor:** additionally stop after **each** task's merge for Claudio's drive test and a new GO. Creating issues authorizes none of them; later tasks are sharpened from preceding results.
- Explicit GOs are recorded in STATUS.md.

## Later phases (no issues yet)

- **B – First challenge and fun acceptance:** finalise the design brief; short first track around 60 s, tuned through playtests; elapsed and best time without deadline; crash detection on; juice (landing dust, light screen shake, visible suspension); multi-touch cases; APK sideload on the device; Bridge and debug test resources excluded from release builds; short performance check.
- **C – Three challenges:** jump/landing, balance, small physics puzzle; optional labs as gym stations.
- **D – Art, audio, content.**
- **E – Full stability and performance acceptance** with representative art, plus a weaker Android device.
- **F – Android release (Play Store).**
- **G – iOS** after the Play Store launch.
