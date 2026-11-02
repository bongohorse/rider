# Issue #356 archived planning text

Full body of [#356 [RIDER-STUDIO][FPS P1] Implement measured Display FPS control with fixed 60-Hz physics and platform gating](https://github.com/bongohorse/rider/issues/356) as of 2026-11-02, moved here unchanged so the issue can stay a short current spec ([issue guide](../ISSUES.md#length)). The issue and its sub-issues decide scope, order and GO; this text is background, not an implementation GO.

**Contents:** [Maintainer clarification — 2026-11-01: dynamic refresh and FPS indicator](#maintainer-clarification--2026-11-01-dynamic-refresh-and-fps-indicator) · [User requirement and dependency](#user-requirement-and-dependency) · [Bounded two-stage implementation, with a real technical stop between stages](#bounded-two-stage-implementation-with-a-real-technical-stop-between-stages) · [Acceptance / safeguards](#acceptance--safeguards) · [RIDER-STUDIO — Director Stage-A readiness (2026-11-01)](#rider-studio--director-stage-a-readiness-2026-11-01)

## Maintainer clarification — 2026-11-01: dynamic refresh and FPS indicator

- **Auto should track the device's active usable refresh rate**, not simply default to 60 FPS: validate Android 90/120 Hz and desktop ~142–144 Hz. Actual delivered FPS must be measured; refresh Hz alone proves nothing.
- Keep Defold-owned fixed physics at 60 Hz even if display/update rate is above 60. Verify no speed, input, pause, replay or physics drift when requesting higher cadence; report unsupported behavior instead of promising it.
- Manual FPS options: offer only proven supported rates (candidate Auto, 30, 60, 90, 120, 144). Report requested target, current refresh and actual measured FPS separately.
- **Actual FPS HUD indicator:** red below 30; amber when materially below the requested/Auto refresh target; green only when near the active target. For example, 60 FPS on a 144 Hz Auto setting is *not* green. Rolling average/hysteresis to avoid flashing. Never label requestAnimationFrame callback count as confirmed presented frames.
- Include refresh-rate changes, variable refresh, foreground/background, power saving, orientation, pause/Retry, real Android device evidence and desktop/HTML5 comparison.
- Stage A is measurement and gated experimental runtime control; Stage B user-facing FPS options only on proven targets, with phone visual acceptance. No physics engine, 60-Hz fixed tick, Box2D substep or replay timing changes.

## User requirement and dependency

Maintainer (2026-11-01): "Ich will auch FPS einstellen können. Aber Physik Berechnung sollte weiterhin bei 60 laufen." The source/API feasibility audit [#340](https://github.com/bongohorse/rider/issues/340) is **delivered/closed** via [PR #354](https://github.com/bongohorse/rider/pull/354), with reference [docs/ci/fps-feasibility-2026-11-01.md](https://github.com/bongohorse/rider/blob/main/docs/ci/fps-feasibility-2026-11-01.md). This issue is the **actual runtime implementation path**, not another docs-only analysis.

Current Defold 1.14.0 `game.project`: `display.update_frequency=60`, `engine.fixed_update_frequency=60`, `physics.use_fixed_timestep=1`, `box2d.sub_step_count=4`. `sys.set_update_frequency` exists for a requested game-update cap. HTML5 browser-owned frame loop may ignore or limit it; Android must be measured on actual hardware. Do **not** treat `mobile.js`'s existing `60 Hz/144 Hz` Measure dropdown as an engine FPS setter (that records the phone hardware mode declared by the user).

## Bounded two-stage implementation, with a real technical stop between stages

**Stage A — actual debug build cadence evidence (one small PR, no gameplay default change):**

1. Reuse Defold's single application owner (boot) and the current controller's update/fixed-update counts; instrument a **read-only** cadence probe with a monotonic wall-clock 10–30 s window. Report real elapsed time, `update(dt)` callbacks, `fixed_update(dt)` count/distribution and time factor, current source SHA, run ID, requested update cap, device/browser refresh declaration, tab visibility/focus, and game-world elapsed time. HTML5 `requestAnimationFrame` is only a browser callback proxy, **not proof of a presented frame**.
2. Verify requesting `Auto (0)`, `30`, `60` through the pinned Defold API on a genuine debug HTML5 build, using one real keyboard/touch driving scenario rather than direct DOM edits of game state. Fixed game physics must remain Defold-owned and tick at `dt=1/60`; if changing cap alters physics timeline, replay identity, pause/Retry or time factor, mark **BLOCKED** and revert the experiment. Do not tamper with `game.project`, Box2D, engine source or physical-device reports.
3. Produce JSON evidence with actual vs requested **callback** rates, run dates, source/build SHA, platform, 30/60/Auto labels, fixed-tick count, drift and per-tick replay/regression verdict. Mark unsupported/unmet render cap honestly. Test pause, Retry, background/foreground and one replay on the same exact build. Never pass by injecting scripted game state.

**Stop/go:** Stage B starts only for targets where measurements show usable runtime control and unchanged physics. If HTML5 does not honor cap, do **not** ship a misleading HTML5 "30 FPS" setting.

**Stage B — product FPS preference in approved supported targets (separate PR / user acceptance):**

1. Add **Display FPS** in player settings (not editor, slow-motion or Measure refresh dropdown). Offer only proven options e.g. Auto/60/30 and label actual measured *update* FPS separately; show "Platform controlled"/unsupported when the request isn't effective. Default remains the existing 60 request and existing saves untouched.
2. One app-level owner applies settings at startup and when player changes the preference. Use a separate, validated, versioned settings save and existing sync confirmation rules. No per-frame setter, no second clock, no new manual Box2D stepping.
3. Native Android 60/144-Hz target must have actual APK device evidence before advertising support or accepting phone UX. Preserve game progress/best/coin saves, input/replay, background/restore and pause/Retry.

## Acceptance / safeguards

- [ ] Exact current source and pinned Defold API evidence; render/requested FPS / browser rAF / fixed 60-Hz tick **clearly separate**.
- [ ] Real HTML5 debug build test for normal play, pause, Retry, tab hide/return, replay; screenshot + machine-readable counters and explicit supported/limited decision.
- [ ] `engine.fixed_update_frequency=60`, `physics.use_fixed_timestep=1`, Box2D 4 solver substeps, no manual stepping, simulation/replay unchanged.
- [ ] B gated after real A evidence; no fake FPS option on unsupported platforms. Real native Android device acceptance NOT RUN until measured.
- [ ] One writer/branch per PR and no edits to Codex #281, active camera #352 or touch-HUD #353 branches. Independent QA and current-head `required` CI; UX/phone acceptance prior to production-facing merge.

## RIDER-STUDIO — Director Stage-A readiness (2026-11-01)

RIDER-STUDIO
Studio status: **ready** — Stage A ONLY; claim on a **later** worker run, after rechecking main, open PR heads and ownership. Stage B remains **proposed / blocked on evidence and human approval**.
Agent role: **implementation — Driving & Camera** (fixed-tick engine observer, no car-feel or camera retune).
Owner: **unclaimed**, reserved exclusively for Driving & Camera when claimed on branch `agent/implementation/issue-356-fps-cadence-stage-a`.
GO: **autonomous-scoped for one reversible debug-only Stage-A PR**; the maintainer requested adjustable FPS without altering fixed 60-Hz Box2D physics. No production default, settings UI, Android capability claim or stage B GO.
Priority: **P1**, after merged camera #355, independent of active HUD #362 and CI #364.

**Verified dependencies and strict write fence:** Camera #352 / PR #355 merged into main `4a4a315fe97d18abcf20bb61ae2fe463eb9b9c8e`, its five-file writer released. Touch #353 / PR #357 merged; visual HUD #360 / PR #362 is still exclusively Tools-owned (`main/gym/mobile.js`, `tools/gameplay/check_mobile.cjs`, license). Performance #363 / PR #364 owns `.github/workflows/preview.yml` and `tools/preview/**` release gate/plan files. Codex exclusively owns editor #281. Stage-A writer may touch only `main/gym/boot.script`, narrowly scoped **read-only counters/observer hookup** in `main/gym/controller.script`, a dedicated new FPS probe and dedicated standalone test harness; document exact file list before writing. **Do not touch** HUD, camera `feel.lua`/probe/ramps, shared preview/CI gate, editor, `game.project`, physics settings or save data. No more than two simultaneous gameplay/UI writers plus the separate Perf writer.

**Bounded acceptance (Stage A only):**
1. Freeze main source SHA, Defold 1.14.0 API behavior and current 60-Hz tick/replay baseline. Real debug HTML5/Defold run compares requested `30`, `60`, `Auto(0)`, and candidate `90/120/144` **only where supported**; distinguish request, actual `update(dt)` callback cadence, browser rAF proxy, confirmed presented frames (unknown unless instrumented), and actual `fixed_update(dt=1/60)` counts over monotonic 10–30 s windows.
2. Use real keyboard/touch play, pause, Retry, replay, tab hide/restore; fail closed on physics/contact/replay drift or changed tick ownership. No manual Box2D step, extra tick owner, test skips, weaker thresholds or synthetic phone claims. Android 90/120 and desktop 142–144 remain **NOT VERIFIED** until real platform/device evidence.
3. Machine-readable source/build/run-ID JSON and clear supported/limited verdict per tested cap. If HTML5 ignores a cap, record unsupported instead of promising FPS or changing defaults. Fast checks: Defold source/API inspection, isolated probe unit/negative tests and affected real-input Gym. Full gate: exact-HEAD `required` CI, independent QA, no merge of any default-facing behavior without maintainer phone/visual approval. **Stage B requires a separate Director GO/PR after evidence and HUD file handoff.**

Director coordination and any STATUS.md GO entry must use a separate properly reviewed PR; **no direct main writes**.
