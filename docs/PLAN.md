# Rider plan

Binding goal, decisions, work order, roadmap and stop points. Live state (progress, GOs, blockers, open drive tests) is on GitHub only ([current-state links](README.md#current-state)); GitHub issues hold each task's scope and acceptance; [AGENTS.md](../AGENTS.md) holds the working rules. Historical gate documents do not govern current work.

**Contents:** [Goal](#goal) · [Decisions](#decisions) · [Work order](#work-order) · [Roadmap](#roadmap) · [Stop points](#stop-points) · [Later phases (no issues yet)](#later-phases-no-issues-yet)

## Goal

Rider is a 2D mobile driving game inspired by Trials and early TrackMania, built with Defold and its integrated Box2D. A **Driving Gym** with test stations comes first: feel before infrastructure. Design intent and open design choices are in [GAME_DESIGN.md](GAME_DESIGN.md).

## Decisions

- **D1** Driving Gym instead of an abstract sandbox: checkerboard test level, drivable buggy, test stations.
- **D2** Rider with a head sensor; crash detection has an on/off switch (key + overlay). Off by default in the gym (crash is only displayed), on in challenges.
- **D3** GitHub issues + milestones replace gate documents. One issue = one PR, 1–3 testable acceptance criteria; epics group tasks as GitHub sub-issues, labels carry type/area/priority/status and milestones are ordered waves ([issue guide](ISSUES.md), [templates](../.github/ISSUE_TEMPLATE/)).
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

## Work order

Set 2026-11-02 from Claudio's latest priorities: **repo restructure and workflow first** (2026-11-02: "erstmal räumen wir das komplette repo um und verbessern unseren workflow"), then the studio order CI → FPS → camera → audit with physics fixed at 60 Hz and mobile landscape only (#333, 2026-11-01/02, which superseded the 2026-10-30 "O2 then graphics" order and deferred new objects); the terrain-materials GO of 2026-11-02 (#392). New claims take the lowest wave that has a `status: ready` issue, then priority (`P0` → `P3`), then the order inside the epic; if nothing is ready in a wave (blocked, needs GO or drive test), continue with the next. Work already in progress in any wave continues. GOs and the claim rules are in the [issue guide](ISSUES.md#go-owner-and-status).

| Wave | Epics | Why here |
| --- | --- | --- |
| **W1 · Data safety and fast feedback** | Data integrity [#418](https://github.com/bongohorse/rider/issues/418) · CI and local verification [#419](https://github.com/bongohorse/rider/issues/419) · Repo restructure [#420](https://github.com/bongohorse/rider/issues/420) | Restructure and workflow first (Claudio 2026-11-02), with CI and the audit's data-loss findings (data-integrity GO 2026-11-02); slow or unstrict feedback costs every later task. The validation fixes touch O2's files, so they merge before O2's PR, coordinated with the #281 owner. |
| **W2 · Mobile play, FPS and feel** | Display FPS [#356](https://github.com/bongohorse/rider/issues/356) · landscape guard [#359](https://github.com/bongohorse/rider/issues/359) · handling and camera feel [#421](https://github.com/bongohorse/rider/issues/421) · mobile UI [#358](https://github.com/bongohorse/rider/issues/358) | Claudio's order after CI: FPS, then camera. The decisions here need Claudio's phone/drive tests or, for the UI, a new visual proposal. |
| **W3 · Objects in the editor and terrain materials** | Terrain materials [#392](https://github.com/bongohorse/rider/issues/392) under visual authoring [#121](https://github.com/bongohorse/rider/issues/121) (stage C after O2) | #392 has a GO and its renderer stage is independent, so it is usually the next ready work once W1/W2 wait on Claudio. |
| **Backlog** | Objects [#120](https://github.com/bongohorse/rider/issues/120) incl. O2 #281 (deferred by Claudio 2026-11-02 until the restructure is done) · Editor B [#168](https://github.com/bongohorse/rider/issues/168), Editor C [#169](https://github.com/bongohorse/rider/issues/169), future editor [#170](https://github.com/bongohorse/rider/issues/170), vehicle editor [#198](https://github.com/bongohorse/rider/issues/198), procedural content [#230](https://github.com/bongohorse/rider/issues/230), release readiness [#422](https://github.com/bongohorse/rider/issues/422) | No GO yet. A task moves to a wave only with Claudio's GO; release readiness becomes W4 before Phase B. |

The task order inside an epic is its sub-issue panel order; which tasks are ready, running or done is shown by labels and milestones, not here.

Independent tracks run in parallel (one writer per issue). Waves are queue order, not roadmap milestones: a wave end is not a stop point, and waiting for a drive test never blocks other waves.

## Roadmap

| Milestone | Goal | Issues |
| --- | --- | --- |
| M1 – It drives | Gym, buggy, in-world reset, HTML5 preview | [#16](https://github.com/bongohorse/rider/issues/16)–[#19](https://github.com/bongohorse/rider/issues/19) |
| M2 – It is measurable | Overlay/budget, feel layer, head sensor, sliders, presets, sound, feedback key, graph | [#20](https://github.com/bongohorse/rider/issues/20)–[#27](https://github.com/bongohorse/rider/issues/27) |
| M3 – Mobile | Full-window/HiDPI, touch, coasting fix, compact HUD, tilt trial | [#58](https://github.com/bongohorse/rider/issues/58), [#28](https://github.com/bongohorse/rider/issues/28), [#68](https://github.com/bongohorse/rider/issues/68), [#69](https://github.com/bongohorse/rider/issues/69), [#29](https://github.com/bongohorse/rider/issues/29) |
| M4 – Stations | Directly selectable measurement stations | A15–A19, A15a ([#30](https://github.com/bongohorse/rider/issues/30)–[#34](https://github.com/bongohorse/rider/issues/34), [#70](https://github.com/bongohorse/rider/issues/70)); in parallel with the editor and with each other since 2026-10-20: A19b–d ([#55](https://github.com/bongohorse/rider/issues/55)–[#57](https://github.com/bongohorse/rider/issues/57)), A20 [#35](https://github.com/bongohorse/rider/issues/35), A21 [#36](https://github.com/bongohorse/rider/issues/36) |
| Level Editor | In-game developer level editor ([epic #118](https://github.com/bongohorse/rider/issues/118), [contract](contracts/level-editor.md)) | Strictly sequential: LE1a [#122](https://github.com/bongohorse/rider/issues/122), LE1b [#123](https://github.com/bongohorse/rider/issues/123), LE2 [#124](https://github.com/bongohorse/rider/issues/124), LE3 [#125](https://github.com/bongohorse/rider/issues/125), LE4 [#126](https://github.com/bongohorse/rider/issues/126), LE5a [#127](https://github.com/bongohorse/rider/issues/127), LE5b [#128](https://github.com/bongohorse/rider/issues/128), LE5c [#186](https://github.com/bongohorse/rider/issues/186) (added on Claudio's request, 2026-10-20), LE5d [#192](https://github.com/bongohorse/rider/issues/192) (multi-point selection and whole-object Smooth/Corner; added on Claudio's request after his LE5c drive test, 2026-10-20), LE6 [#129](https://github.com/bongohorse/rider/issues/129) |
| Editor A – UI & Recovery | Readable editor UI, object list with hide/lock, recoverable versions ([epic #167](https://github.com/bongohorse/rider/issues/167)) | A1a [#183](https://github.com/bongohorse/rider/issues/183) previews → A1b [#171](https://github.com/bongohorse/rider/issues/171) → A2 [#172](https://github.com/bongohorse/rider/issues/172); A3 [#173](https://github.com/bongohorse/rider/issues/173) after A1b |
| Editor B – Construction Tools | Groups, passage library, precise transforms, batch properties ([epic #168](https://github.com/bongohorse/rider/issues/168)) After A2: B1 [#174](https://github.com/bongohorse/rider/issues/174) → B2 [#175](https://github.com/bongohorse/rider/issues/175) → B3 [#176](https://github.com/bongohorse/rider/issues/176) → B4 [#177](https://github.com/bongohorse/rider/issues/177) |
| Editor C – Testing Tools | Named test starts, last driven path, variant series, measurement, view bookmarks ([epic #169](https://github.com/bongohorse/rider/issues/169)) | C1 [#178](https://github.com/bongohorse/rider/issues/178) (may follow Editor A directly), C2 [#179](https://github.com/bongohorse/rider/issues/179), C3 [#180](https://github.com/bongohorse/rider/issues/180), C4 [#181](https://github.com/bongohorse/rider/issues/181), C5 [#184](https://github.com/bongohorse/rider/issues/184) |
| Editor – Future Features | Deferred catalogue: layers, challenge/gameplay/art integration, mobile editor, sharing ([epic #170](https://github.com/bongohorse/rider/issues/170)) | No tasks yet; concrete issues only when prerequisites exist |
| M5 – Lock in | Regression tests from tick traces | A22 [#37](https://github.com/bongohorse/rider/issues/37), after M4 and approved feel values |

**Product priority (Claudio, 2026-10-30):** after accepted gameplay G7, build the bounded interactive-object slice (#280 runtime, then #281 editor authoring, with existing per-task acceptance stops), then start graphics and atmosphere under #121. Defer the playable introduction until mechanics, content and their adjustments have settled near the end. This is not implementation GO for the full object catalogue or the entire graphics epic; scope each following task from accepted results.

**Roadmap vs queue:** the roadmap table above holds historical milestone definitions (M1–M5, editor tracks); the current queue is the [work order](#work-order). Open backlog epics are **not implicit GOs**. Milestone outcomes and per-task logs up to the retirement of STATUS.md (#430): [final STATUS.md](https://github.com/bongohorse/rider/blob/965b41cc9a4c7fbfdea5a66f2558648a73f06b44/STATUS.md), [pre-cleanup snapshot](https://github.com/bongohorse/rider/blob/4bef309b3b30b7662d6ca9efe66f417d1a1001ca/STATUS.md).

**Historical scheduling record:** Claudio decided on 2026-10-18 to run the Level Editor before the remaining M4 issues; on 2026-10-20 he decided to run the editor and the remaining M4 stations in parallel, and then to let the M4 stations themselves run in parallel (one writing agent per task) to finish M4 sooner. The editor track stays sequential with its per-task stops. A21 follows A20 because both change the tick-command and input path. M4 stops at the milestone end. Shared areas need coordination between parallel tasks: the station registry and validation (`stations.lua`, `station_data.lua`, also used by the editor's templates), CI Gym groups, and the runtime state that A20's pause/slow-motion and the editor's Edit mode (R15) both touch. Gameplay objects ([#120](https://github.com/bongohorse/rider/issues/120)) and visual authoring ([#121](https://github.com/bongohorse/rider/issues/121)) are later, separate epics. The editor expansion milestones (Editor A–C, Future; planned 2026-10-20) are backlog, not a GO: each task needs Claudio's GO; they continue the editor track after LE6.

M4 notes: report measured limits separately from Claudio's drive test; keep station logic outside the controller; measure downhill neutral motor braking at ramps; run [MOBILE_TRIAL](MOBILE_TRIAL.md) before Phase B.

## Stop points

- **Milestone end:** stop, report the preview URL and ask Claudio for a drive test. Do not start the next milestone until he approves, even if technical dependencies are complete. This applies to roadmap milestones (M1–M5, editor tracks), not to the W1–W3 queue waves.
- **A19b [#55](https://github.com/bongohorse/rider/issues/55):** Claudio's GO adds a drive test after its merge; the other M4 tasks continue.
- **Level Editor:** additionally stop after **each** task's merge for Claudio's drive test and a new GO. Creating issues authorizes none of them; later tasks are sharpened from preceding results.
- Explicit GOs are recorded on the issue ([GO protocol](ISSUES.md#go-owner-and-status)).

## Later phases (no issues yet)

- **B – First challenge and fun acceptance:** finalise the design brief; short first track around 60 s, tuned through playtests; elapsed and best time without deadline; crash detection on; juice (landing dust, light screen shake, visible suspension); multi-touch cases; APK sideload on the device; Bridge and debug test resources excluded from release builds; short performance check.
- **C – Three challenges:** jump/landing, balance, small physics puzzle; optional labs as gym stations.
- **D – Art, audio, content.**
- **E – Full stability and performance acceptance** with representative art, plus a weaker Android device.
- **F – Android release (Play Store).**
- **G – iOS** after the Play Store launch.
