# Drive-test sessions

The open maintainer acceptance items from [STATUS.md](../STATUS.md#open-acceptance), grouped into four sessions so they can be cleared in a few sittings instead of one by one ([#404](https://github.com/bongohorse/rider/issues/404)). Every row names its original item. Steps are copied from STATUS.md; where STATUS records no procedure, the row starts with *Suggested:* and gives a minimal check that Claudio may replace. Nothing here is accepted until Claudio records a result. Only he can mark an item accepted, failed or obsolete; agents never fill in the result column.

**Contents:** [How to run a session](#how-to-run-a-session) · [Session 1: desktop editor](#session-1-desktop-editor) · [Session 2: desktop driving and stations](#session-2-desktop-driving-and-stations) · [Session 3: phone](#session-3-phone) · [Session 4: vehicle feel (deferred)](#session-4-vehicle-feel-deferred) · [Recording results](#recording-results)

## How to run a session

- Use the [deployed HTML5 preview](https://bongohorse.github.io/rider/) and note its source SHA from [build.json](https://bongohorse.github.io/rider/build.json). Sessions 1, 2 and 4 are desktop browser only. Session 3 needs the real phone.
- Run the steps in order. A failing step does not stop the session: note it and continue.
- Per item, answer with one of: **OK**, **FAIL: what happened**, or **obsolete** (no longer relevant). A short German sentence is fine.

## Session 1: desktop editor

About 30–40 minutes. Covers the level-editor drive tests LE2–LE5 and the editor parts of #236.

| # | Item | Steps | Result |
| --- | --- | --- | --- |
| 1.1 | LE2 editor shell ([PR #145](https://github.com/bongohorse/rider/pull/145)) | Open `ramps`, press E, move START, place FINISH, drive through it and test from several points (F / Shift+F). | |
| 1.2 | LE3 draw tool and connections ([PR #152](https://github.com/bongohorse/rider/pull/152)) | Open Straight, press E, delete its line, draw a run-up, a ramp from its end (green ring), a gap and a landing, place FINISH, drive; drag the joint (the ramp follows), Undo/Redo, drive again. Also check Alt (0.1 m grid). | |
| 1.3 | LE3 follow-up ([PR #155](https://github.com/bongohorse/rider/pull/155), [#156](https://github.com/bongohorse/rider/pull/156), [#158](https://github.com/bongohorse/rider/pull/158)) | Draw a ramp whose top bends back to the left and drive into it; Shift+click two separated line ends and press J; open a template while drawing (the piece is discarded); box-select across a line. | |
| 1.4 | LE5b curves, Bump/wave, sampling ([PR #166](https://github.com/bongohorse/rider/pull/166)) | Build and drive a smooth hill (Bump/wave) and a valley (Curve [C]), change their values and tangents, Undo/Redo, reopen the saved course; try the new Step. | |
| 1.5 | LE5c editable paths ([PR #187](https://github.com/bongohorse/rider/pull/187)) | Draw a triangular hill, Make smooth at its peak and shape it with the tangents, Make corner; round a joint between two lines; convert a ramp (confirm) and smooth its joint; Undo/Redo, reload and drive. | |
| 1.6 | LE5d several points and whole objects ([PR #196](https://github.com/bongohorse/rider/pull/196)) | Select a whole object and several points (box, Shift+click) and smooth them, Make corner, drag several points, convert a Bump/wave (a curve through its crests), Undo/Redo, reload and drive. | |
| 1.7 | Drive-test fixes, editor part ([#236](https://github.com/bongohorse/rider/issues/236)) | Draw a longer six-anchor curve and play it; type a label and watch it change. | |

## Session 2: desktop driving and stations

About 30 minutes. Covers the M4 and M5 milestone drive tests, gaps, camera and sound.

| # | Item | Steps | Result |
| --- | --- | --- | --- |
| 2.1 | M4 final drive test | Bumps, air, balance (seesaw), pause/slow motion (Space/X), record/replay (B, P, G). | |
| 2.2 | A19 gaps and landings ([PR #117](https://github.com/bongohorse/rider/pull/117)) | *Suggested:* drive `?station=gaps`; gaps and landings feel fair. The PR notes a strong nose-down pitch in flight (about −57° at touchdown) that still settles. | |
| 2.3 | Drive-test fixes, driving part ([#236](https://github.com/bongohorse/rider/issues/236)) | Drive a course that climbs, drops 10–20 m and jumps: the camera stays calm on waves and follows climbs, descents and falls. Open `?station=balance` and press V until SEESAW. | |
| 2.4 | Camera look-ahead ([#239](https://github.com/bongohorse/rider/issues/239)) | Accelerate, brake, reverse and turn round on a flat course: the view looks ahead in the direction of motion. | |
| 2.5 | M5 final drive test (A22, [PR #216](https://github.com/bongohorse/rider/pull/216)) | *Suggested:* drive Straight, ramps and gaps with preset A; handling matches the earlier milestones (A22 locks it with regression traces). | |
| 2.6 | Engine sound by ear (A10) | *Suggested:* listen while accelerating, coasting and braking; the engine sound follows throttle and wheel speed and is silent while paused. | |

## Session 3: phone

About 20 minutes on the reference phone. Synthetic touch in CI does not replace this session.

| # | Item | Steps | Result |
| --- | --- | --- | --- |
| 3.1 | M4 stations on the real phone | *Suggested:* drive bumps, air, balance and gaps with touch controls; pause and Retry. | |
| 3.2 | LE1b phone procedure ([PR #139](https://github.com/bongohorse/rider/pull/139), [#142](https://github.com/bongohorse/rider/pull/142)) | Follow the [phone procedure](LE1B_REPORT.md#phone-procedure) and drive `seg-800`. | |
| 3.3 | Phone performance (STATUS open limit) | Optional, needed before Phase B: run the [phone trial](MOBILE_TRIAL.md). | |

## Session 4: vehicle feel (deferred)

Vehicle feel and tuning are deferred until after the current mobile/FPS/CI priorities ([maintainer priority recorded on #363](https://github.com/bongohorse/rider/issues/363#issuecomment-6563781561)). Run this session only when Claudio reopens vehicle feel.

| # | Item | Steps | Result |
| --- | --- | --- | --- |
| 4.1 | Car Feel 1 presets D/E ([#199](https://github.com/bongohorse/rider/issues/199)) | Drive A, D and E (P or `?preset=d` / `?preset=e`) on Straight, ramps, steps, gaps and bumps; pick one. | |
| 4.2 | Car Feel 4 preset F ([#211](https://github.com/bongohorse/rider/issues/211)) | Compare D and F on `?station=air` (`?preset=d` / `?preset=f`) with neutral flights and full lean: does neutral flight feel natural or "assisted"? | |
| 4.3 | Car Feel 3 struts ([PR #205](https://github.com/bongohorse/rider/pull/205)) | Are the struts readable? (`?struts=0` or the tuning panel turns them off.) | |

## Recording results

Claudio's answers go into a comment on [#404](https://github.com/bongohorse/rider/issues/404) (or the original item's issue). An agent then moves the items out of [STATUS.md's open acceptance](../STATUS.md#open-acceptance), links the comment and opens follow-up issues for every FAIL. A FAIL is a new bug report, not a reason to reopen merged work silently.
