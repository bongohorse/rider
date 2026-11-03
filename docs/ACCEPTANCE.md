# Drive-test sessions

Record of the drive-test sessions of 2026-11-02 ([#404](https://github.com/bongohorse/rider/issues/404)): the maintainer acceptance items open at that time, grouped into four sessions, with Claudio's reported results. Where no procedure existed, the row starts with *Suggested:*. Agents copied his reported results with date and quote and never set a result on their own. Items still open after these sessions are issues labelled [`status: needs drive test`](https://github.com/bongohorse/rider/issues?q=is%3Aissue+is%3Aopen+label%3A%22status%3A+needs+drive+test%22): row 1.7 is [#431](https://github.com/bongohorse/rider/issues/431), session 4 is [#432](https://github.com/bongohorse/rider/issues/432). New drive tests are written into their own issue, not into this file.

**Contents:** [How to run a session](#how-to-run-a-session) · [Results 2026-11-02](#results-2026-11-02) · [Session 1: desktop editor](#session-1-desktop-editor) · [Session 2: desktop driving and stations](#session-2-desktop-driving-and-stations) · [Session 3: phone](#session-3-phone) · [Session 4: vehicle feel (deferred)](#session-4-vehicle-feel-deferred) · [Recording results](#recording-results)

## How to run a session

- Use the [deployed HTML5 preview](https://bongohorse.github.io/rider/) and note its source SHA from [build.json](https://bongohorse.github.io/rider/build.json). Sessions 1, 2 and 4 are desktop browser only. Session 3 needs the real phone.
- Run the steps in order. A failing step does not stop the session: note it and continue.
- Per item, answer with one of: **OK**, **FAIL: what happened**, or **obsolete** (no longer relevant). A short German sentence is fine.

## Results 2026-11-02

Claudio ran the desktop editor and desktop driving sessions on the public preview of 2026-11-02 (build not recorded) and reported ([transcript on #404](https://github.com/bongohorse/rider/issues/404#issuecomment-6590570867)): "session 1+2 fertig", with one finding, and "session 3 brauchen wir nicht".

- Sessions 1 and 2: done with no remark other than the Drop to Track finding; recorded in the result columns below. Row 1.7 (six-anchor curve, live label) was not among the editor steps given in chat and stays NOT RUN. In chat the sessions were numbered the other way round (chat 1 = driving, chat 2 = editor). The questions asked in chat for the downhill stations (camera on 10–20 m drops — OK — and whether the ~10 m/s rolling cap feels limiting, [#114](https://github.com/bongohorse/rider/issues/114)) got no remark; #114 stayed open for an explicit answer (answered 2026-11-03 on #114).
- New finding: Drop to Track does nothing on a coin that was dropped once and then moved → bug [#427](https://github.com/bongohorse/rider/issues/427).
- Session 3 (phone): declared obsolete by Claudio; phone performance stays tracked in [#416](https://github.com/bongohorse/rider/issues/416).
- Session 4 (vehicle feel): still deferred, NOT RUN; open as [#432](https://github.com/bongohorse/rider/issues/432).
- Not on the public preview and therefore not part of these sessions: camera B A/B ([#370](https://github.com/bongohorse/rider/issues/370), debug build only) and the landscape guard ([#359](https://github.com/bongohorse/rider/issues/359), unmerged PR #365).

## Session 1: desktop editor

About 30–40 minutes. Covers the level-editor drive tests LE2–LE5 and the editor parts of #236.

| # | Item | Steps | Result |
| --- | --- | --- | --- |
| 1.1 | LE2 editor shell ([PR #145](https://github.com/bongohorse/rider/pull/145)) | Open `ramps`, press E, move START, place FINISH, drive through it and test from several points (F / Shift+F). | OK — Claudio 2026-11-02 ("session 1+2 fertig") |
| 1.2 | LE3 draw tool and connections ([PR #152](https://github.com/bongohorse/rider/pull/152)) | Open Straight, press E, delete its line, draw a run-up, a ramp from its end (green ring), a gap and a landing, place FINISH, drive; drag the joint (the ramp follows), Undo/Redo, drive again. Also check Alt (0.1 m grid). | OK — Claudio 2026-11-02 ("session 1+2 fertig") |
| 1.3 | LE3 follow-up ([PR #155](https://github.com/bongohorse/rider/pull/155), [#156](https://github.com/bongohorse/rider/pull/156), [#158](https://github.com/bongohorse/rider/pull/158)) | Draw a ramp whose top bends back to the left and drive into it; Shift+click two separated line ends and press J; open a template while drawing (the piece is discarded); box-select across a line. | OK — Claudio 2026-11-02 ("session 1+2 fertig") |
| 1.4 | LE5b curves, Bump/wave, sampling ([PR #166](https://github.com/bongohorse/rider/pull/166)) | Build and drive a smooth hill (Bump/wave) and a valley (Curve [C]), change their values and tangents, Undo/Redo, reopen the saved course; try the new Step. | OK — Claudio 2026-11-02 ("session 1+2 fertig") |
| 1.5 | LE5c editable paths ([PR #187](https://github.com/bongohorse/rider/pull/187)) | Draw a triangular hill, Make smooth at its peak and shape it with the tangents, Make corner; round a joint between two lines; convert a ramp (confirm) and smooth its joint; Undo/Redo, reload and drive. | OK — Claudio 2026-11-02 ("session 1+2 fertig") |
| 1.6 | LE5d several points and whole objects ([PR #196](https://github.com/bongohorse/rider/pull/196)) | Select a whole object and several points (box, Shift+click) and smooth them, Make corner, drag several points, convert a Bump/wave (a curve through its crests), Undo/Redo, reload and drive. | OK — Claudio 2026-11-02 ("session 1+2 fertig") |
| 1.7 | Drive-test fixes, editor part ([#236](https://github.com/bongohorse/rider/issues/236)) | Draw a longer six-anchor curve and play it; type a label and watch it change. | NOT RUN — not part of the editor steps given in chat on 2026-11-02; open as [#431](https://github.com/bongohorse/rider/issues/431) |

## Session 2: desktop driving and stations

About 30 minutes. Covers the M4 and M5 milestone drive tests, gaps, camera and sound.

| # | Item | Steps | Result |
| --- | --- | --- | --- |
| 2.1 | M4 final drive test | Bumps, air, balance (seesaw), pause/slow motion (Space/X), record/replay (B, P, G). | OK — Claudio 2026-11-02 ("session 1+2 fertig") |
| 2.2 | A19 gaps and landings ([PR #117](https://github.com/bongohorse/rider/pull/117)) | *Suggested:* drive `?station=gaps`; gaps and landings feel fair. The PR notes a strong nose-down pitch in flight (about −57° at touchdown) that still settles. | OK — Claudio 2026-11-02 ("session 1+2 fertig") |
| 2.3 | Drive-test fixes, driving part ([#236](https://github.com/bongohorse/rider/issues/236)) | Drive a course that climbs, drops 10–20 m and jumps: the camera stays calm on waves and follows climbs, descents and falls. Open `?station=balance` and press V until SEESAW. | OK — Claudio 2026-11-02 ("session 1+2 fertig") |
| 2.4 | Camera look-ahead ([#239](https://github.com/bongohorse/rider/issues/239)) | Accelerate, brake, reverse and turn round on a flat course: the view looks ahead in the direction of motion. | OK — Claudio 2026-11-02 ("session 1+2 fertig") |
| 2.5 | M5 final drive test (A22, [PR #216](https://github.com/bongohorse/rider/pull/216)) | *Suggested:* drive Straight, ramps and gaps with preset A; handling matches the earlier milestones (A22 locks it with regression traces). | OK — Claudio 2026-11-02 ("session 1+2 fertig") |
| 2.6 | Engine sound by ear (A10) | *Suggested:* listen while accelerating, coasting and braking; the engine sound follows throttle and wheel speed and is silent while paused. | OK — Claudio 2026-11-02 ("session 1+2 fertig") |

## Session 3: phone

About 20 minutes on the reference phone. Synthetic touch in CI does not replace this session.

| # | Item | Steps | Result |
| --- | --- | --- | --- |
| 3.1 | M4 stations on the real phone | *Suggested:* drive bumps, air, balance and gaps with touch controls; pause and Retry. | Obsolete — Claudio 2026-11-02 ("session 3 brauchen wir nicht") |
| 3.2 | LE1b phone procedure ([PR #139](https://github.com/bongohorse/rider/pull/139), [#142](https://github.com/bongohorse/rider/pull/142)) | Follow the [phone procedure](reports/LE1B_REPORT.md#phone-procedure) and drive `seg-800`. | Obsolete — Claudio 2026-11-02 ("session 3 brauchen wir nicht") |
| 3.3 | Phone performance (open limit at the time) | Optional, needed before Phase B: run the [phone trial](MOBILE_TRIAL.md). | Deferred: tracked as phone frame-time experiment [#416](https://github.com/bongohorse/rider/issues/416) |

## Session 4: vehicle feel (deferred)

Vehicle feel and tuning are deferred until after the current mobile/FPS/CI priorities ([maintainer priority recorded on #363](https://github.com/bongohorse/rider/issues/363#issuecomment-6563781561)). Run this session only when Claudio reopens vehicle feel.

| # | Item | Steps | Result |
| --- | --- | --- | --- |
| 4.1 | Car Feel 1 presets D/E ([#199](https://github.com/bongohorse/rider/issues/199)) | Drive A, D and E (P or `?preset=d` / `?preset=e`) on Straight, ramps, steps, gaps and bumps; pick one. | NOT RUN — open as [#432](https://github.com/bongohorse/rider/issues/432) |
| 4.2 | Car Feel 4 preset F ([#211](https://github.com/bongohorse/rider/issues/211)) | Compare D and F on `?station=air` (`?preset=d` / `?preset=f`) with neutral flights and full lean: does neutral flight feel natural or "assisted"? | NOT RUN — open as [#432](https://github.com/bongohorse/rider/issues/432) |
| 4.3 | Car Feel 3 struts ([PR #205](https://github.com/bongohorse/rider/pull/205)) | Are the struts readable? (`?struts=0` or the tuning panel turns them off.) | NOT RUN — open as [#432](https://github.com/bongohorse/rider/issues/432) |

## Recording results

Claudio answers in a comment on the drive-test issue (for these sessions: [#404](https://github.com/bongohorse/rider/issues/404)). An agent quotes the answer with its date on the issue and closes it for OK or obsolete; every FAIL becomes a new bug issue linked from there. A FAIL is a new bug report, not a reason to reopen merged work silently.
