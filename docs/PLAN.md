# Rider plan

Binding goal, decisions, roadmap and stop points. [STATUS.md](../STATUS.md) holds current progress; GitHub issues hold each task's scope and acceptance; [AGENTS.md](../AGENTS.md) holds the working rules. Historical gate documents do not govern current work.

**Contents:** [Goal](#goal) · [Decisions](#decisions) · [Roadmap](#roadmap) · [Stop points](#stop-points) · [Later phases (no issues yet)](#later-phases-no-issues-yet)

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
| M4 – Stations | Directly selectable measurement stations | A15–A19, A15a ([#30](https://github.com/bongohorse/rider/issues/30)–[#34](https://github.com/bongohorse/rider/issues/34), [#70](https://github.com/bongohorse/rider/issues/70)); in parallel with the editor and with each other since 2026-10-20: A19b–d ([#55](https://github.com/bongohorse/rider/issues/55)–[#57](https://github.com/bongohorse/rider/issues/57)), A20 [#35](https://github.com/bongohorse/rider/issues/35), A21 [#36](https://github.com/bongohorse/rider/issues/36) |
| Level Editor | In-game developer level editor ([epic #118](https://github.com/bongohorse/rider/issues/118), [contract](contracts/level-editor.md)) | Strictly sequential: LE1a [#122](https://github.com/bongohorse/rider/issues/122), LE1b [#123](https://github.com/bongohorse/rider/issues/123), LE2 [#124](https://github.com/bongohorse/rider/issues/124), LE3 [#125](https://github.com/bongohorse/rider/issues/125), LE4 [#126](https://github.com/bongohorse/rider/issues/126), LE5a [#127](https://github.com/bongohorse/rider/issues/127), LE5b [#128](https://github.com/bongohorse/rider/issues/128), LE5c [#186](https://github.com/bongohorse/rider/issues/186) (added on Claudio's request, 2026-10-20), LE6 [#129](https://github.com/bongohorse/rider/issues/129) |
| Editor A – UI & Recovery | Readable editor UI, object list with hide/lock, recoverable versions ([epic #167](https://github.com/bongohorse/rider/issues/167)) | A1a [#183](https://github.com/bongohorse/rider/issues/183) previews → A1b [#171](https://github.com/bongohorse/rider/issues/171) → A2 [#172](https://github.com/bongohorse/rider/issues/172); A3 [#173](https://github.com/bongohorse/rider/issues/173) after A1b |
| Editor B – Construction Tools | Groups, passage library, precise transforms, batch properties ([epic #168](https://github.com/bongohorse/rider/issues/168)) After A2: B1 [#174](https://github.com/bongohorse/rider/issues/174) → B2 [#175](https://github.com/bongohorse/rider/issues/175) → B3 [#176](https://github.com/bongohorse/rider/issues/176) → B4 [#177](https://github.com/bongohorse/rider/issues/177) |
| Editor C – Testing Tools | Named test starts, last driven path, variant series, measurement, view bookmarks ([epic #169](https://github.com/bongohorse/rider/issues/169)) | C1 [#178](https://github.com/bongohorse/rider/issues/178) (may follow Editor A directly), C2 [#179](https://github.com/bongohorse/rider/issues/179), C3 [#180](https://github.com/bongohorse/rider/issues/180), C4 [#181](https://github.com/bongohorse/rider/issues/181), C5 [#184](https://github.com/bongohorse/rider/issues/184) |
| Editor – Future Features | Deferred catalogue: layers, challenge/gameplay/art integration, mobile editor, sharing ([epic #170](https://github.com/bongohorse/rider/issues/170)) | No tasks yet; concrete issues only when prerequisites exist |
| M5 – Lock in | Regression tests from tick traces | A22 [#37](https://github.com/bongohorse/rider/issues/37), after M4 and approved feel values |

Progress and open drive acceptance are tracked in STATUS.md. Claudio decided on 2026-10-18 to run the Level Editor before the remaining M4 issues; on 2026-10-20 he decided to run the editor and the remaining M4 stations in parallel, and then to let the M4 stations themselves run in parallel (one writing agent per station) to finish M4 sooner. The editor track stays sequential with its per-task stops; A21 follows A20; M4 stops at the milestone end. Shared areas need coordination between parallel tasks: the station registry and validation (`stations.lua`, `station_data.lua`, also used by the editor's templates), CI Gym groups, STATUS.md, and the runtime state that A20's pause/slow-motion and the editor's Edit mode (R15) both touch. Gameplay objects ([#120](https://github.com/bongohorse/rider/issues/120)) and visual authoring ([#121](https://github.com/bongohorse/rider/issues/121)) are later, separate epics. The editor expansion milestones (Editor A–C, Future; planned 2026-10-20) are backlog, not a GO: each task needs Claudio's GO; they continue the editor track after LE6.

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
