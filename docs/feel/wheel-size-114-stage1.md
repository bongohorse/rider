# Wheel size A/B: stage 1 of #114

**Purpose:** stage 1 of [issue #114](https://github.com/bongohorse/rider/issues/114) (option D in [wheel-rotation-cap-114](wheel-rotation-cap-114.md)). Box2D 3.1.0 caps the angular speed of an ordinary body at 0.25π per full 1/60 s step (47.12 rad/s). A larger wheel rolls faster at the same angular speed. This report covers the debug-only 0.26 m and 0.30 m wheel candidates, how they are gated, a real-engine Gym A/B against preset A, the caveats, and Claudio's drive test. **Claudio picks the wheel.** Preset A, the default, is unchanged. Stage 2 (upstream `allowFastRotation`) is not part of this report.

**Contents:** [Result in short](#result-in-short) · [Design](#design) · [Method](#method) · [Wheel A/B (w114)](#wheel-ab-w114) · [Existing station runners](#existing-station-runners) · [Preset A unchanged](#preset-a-unchanged) · [Caveats](#caveats) · [Drive test](#drive-test) · [Engine sources](#engine-sources) · [Verification](#verification)

## Result in short

Measured 2026-11-03 at source `23b8696` (debug HTML5, headless Chromium 156.0.8078.4, 60 Hz, factor 1.0, 4 substeps). These are synthetic runs, not drive or device evidence.

- **The cap measured in the engine:** the shape radius read back from the wheel body is 22 / 26 / 30 u. At 47.12 rad/s that gives a no-slip ceiling of **10.37 / 12.25 / 14.14 m/s**. The wheel mass stays 4 kg; wheel inertia grows with r² (0.0968 → 0.1352 → 0.1800).
- **Flat top speed (Straight, full throttle, 8 s):** A **6.96**, W26 **8.25**, W30 **9.53 m/s**. This gain comes from the motor target, not from the cap. The candidates keep A's 32 rad/s wheel target, which is 7.04 / 8.32 / 9.60 m/s linear. No wheel came near the cap on flat ground (≤ 71 %).
- **Only the air station reaches the cap.** On A, a wheel reached the cap on the big and mid landing slopes: peak 47.12 and **54.45 rad/s** read back (100 % and 116 %, 1 and 3 ticks). W26 peaked at 96 % / 91 % and W30 at 73 % / 73 %. No other section exceeded 93 % (A, gaps-landing down). The authored `ramps-long` down sections are 4 m long and peak at 2.6–5.2 m/s, far below every cap.
- **Landings:** gaps 3 m CLEARED for all three, with a longer jump on the larger wheels (3.32 / 3.99 / 4.28 m, from a faster takeoff). Gaps 6 m MISSED for all three. Gaps-landing down CLEARED for all three (2.24 / 3.49 / 3.86 m). The air jumps use neutral lean (no player input), and every one CRASHED except W26 on mid (LANDED). This protocol has no lean, so it does not judge landability.
- **Station protocols (`presets_compare`):** the candidates climbed steeper `ramps-long` slopes (A 35°, W26 40°, W30 45°) and cleared wider gaps (A 3 m, W26 4 m, W30 4 m at 7 m/s). Every preset cleared every landing variant. With fixed lean, the air outcomes shift between presets ([details](#existing-station-runners)). The ramps runner for W26 and W30 stopped after all its trials, at the opt-in #352 camera B Retry-framing check. A sits 0.2 u inside that check's limit, and the candidate's higher camera rest exceeds it. The shipped camera is not involved.
- **Retry/replay determinism:** every preset and section ran three attempts: page load, R1 and R2. Every compared pair (R1 vs R2, and the page load aligned by its one-tick probe phase vs R1) was bit-identical except one W26 gaps-landing/down pair, which differed by 0.0001 m (MATCH). The station outcome was the same in all three attempts everywhere.
- **Preset A unchanged:** `a22` PASS, and its measured results are identical to main's CI artifact. Production (release) refuses the candidates.

## Design

- **Candidates are debug presets:** `main/game/presets/w26.json` and `w30.json` contain preset A's values with another key. Tuning is unchanged, so the comparison varies only the wheel. `feel.debug_order={"w26","w30"}` keeps them out of `feel.order`, so they are not in the P cycle, the chips, `riderHud.presets`, `a9` or the release preview's preset checks.
- **Gating:** `feel.preset` accepts a candidate only when `sys.get_engine_info().is_debug` is true, so URL `?preset=w26` and `rider.preset` work only in a debug engine. A release engine treats the key like any unknown one: preset A, flagged invalid ("Invalid URL: A"), with no candidate geometry. This follows the existing debug-only pattern (`is_debug` asserts for the Gym trials, the `?camera352=` debug probe). Tests: `tests/gameplay/wheel_candidates.lua` loads the real `feel.lua` and preset files with `is_debug` false and true. It checks the release fallback to A, the candidate values and geometry, and that A–F keep the default geometry. A local release build confirms it ([verification](#verification)).
- **Geometry:** `feel.geometry` holds one entry per wheel, and every key not listed (A–F) uses `default`. The default is exactly the shipped vehicle: radius 22 u / 0.22 m, joint anchor −30 u, factory `#wheel`, art scale 1, camera rest 46 u. Each candidate has authored resources: `wheel26/30.convexshape` (sphere radius 26/30), `wheel26/30.collisionobject` (byte-identical to the shipped wheel apart from the shape: 4 kg, friction 0.9, same group/mask), and `wheel26/30.go`. The game objects use the same wheel sprite scaled by r/22, and the factories are `load_dynamically`, so a world that never spawns a candidate does not load its resources. The `tests/bootstrap/test_presets.py` guard pins all of this.
- **Ride height, clearance, travel:** the anchor scales with the radius (−30 × r/22, rounded: −35 / −41 u). Ride height (anchor + radius) grows from 52 u to 61 / 71 u, and chassis clearance at spring rest from 38 u to 47 / 57 u. The wheel joints have no travel stop, so free suspension travel before the underbody touches flat ground grows with that clearance. Spring Hz and damping stay A's, so static sag is unchanged. The camera's rest height follows: 46 → 55 / 65 u.
- **Spawning:** `vehicle.spawn` uses the preset's wheel factory and remembers it. `vehicle.reset` asserts the active preset still has that factory. The controller refuses an in-world preset switch that would change the wheel (P key or chip from a candidate) and shows "reload to change"; such a switch needs a new world (reload the page). A–F share one geometry, so their switching is unchanged.
- **Radius readers:** these follow the active geometry and produce the same values for A–F. The speed-start wheel spin is `-speed/feel.values.wheel_radius` (was `/22`), the air metrics' slope lookup and lip window use `wheel_radius_m` (was `M.WHEEL_RADIUS=0.22`), and so do the coin/fuel pickup circles (was `.22`). The ghost wheel art scales with the candidate.
- **Probe and runner:** `main/gym/wheel_probe114.lua` is a debug HTML5 observer that is read-only and opt-in (`?wheel114=1`). Once per Defold-owned fixed tick it publishes the chassis pose and velocity, both wheels' ω, loaded support (A18/A19 rule) and contact-point slip. Slip is the tangential velocity of the wheel's material point at its loaded contact against static ground, from `get_linear_velocity_from_world_point` and the manifold normal. `?wheel114=throttle` adds a constant full-throttle command on Straight, consulted after every station driver and before live input. The probe never writes bodies, joints, tuning or saves, and it adds no physics loop. The runner is `tools/gym/wheel114.cjs` (`smoke.py --case w114 --preset <key>`). It is opt-in and report-only: it is not in `g1.yml`, so CI `required` and its inventory are unchanged, and its `local_affected.json` rule only runs its unit tests. `tools/gym/wheel114_report.cjs` builds the tables, and `tests/ci/wheel114.test.cjs` covers its statistics and integrity checks.
- **Physics contract kept:** Defold-owned bodies, one tick owner, fixed 60 Hz, 4 substeps, `B2_MAX_ROTATION` untouched, no angular-velocity forcing, no extension. The only new angular-velocity write is the station speed start, which already set rolling spin and now divides by the authored radius.

## Method

1. Build one debug Gym bundle at `23b8696` (`tools/local.py gym --case a22`; the engine guard passed).
2. For each preset (`a`, `w26`, `w30`), run `smoke.py --case w114 --preset <key>` on that bundle, one Gym process at a time. Each of 9 sections loads in a fresh page with the station's own debug driver: Straight full throttle from rest (probe driver); `ramps-long` down-10/20/30 neutral from 1 m/s (a16); gaps 3 m and 6 m and gaps-landing down, full throttle from 7 m/s (a19); air big and mid, full throttle to the lip, then neutral with lean 0 (a19c). After the page load the runner presses **R twice** on the real keyboard path. It keeps the same fixed-tick window from all three attempts and reads the station's own outcome after each attempt. The windows were declared before the candidate runs: 480 ticks on Straight, 210 on ramps, 300 on gaps and air. The runner fails on a missing or repeated tick, a non-1/60 s step, a reset other than its two R presses, or a preset or geometry mismatch.
3. Statistics come from the second Retry attempt. Top speed is |v| of the chassis, so it includes falling. Peak ω is the larger wheel's |ω|. "At cap" means within 0.01 rad/s of 47.124. Slip covers supported wheels only.
4. Determinism: the two Retry attempts are compared tick by tick, and so are the page-load attempt (shifted by one tick, [why](#caveats)) and the first Retry. Tolerances are A21's, 0.05 m / 0.05 rad, and the tables also report whether the attempts are fully identical.
5. The existing station runners ran through `presets_compare.cjs --candidates w26,w30 --stations ramps,gaps,air` on the same bundle, with all existing assertions active.

## Wheel A/B (w114)

Per section, one row per preset. The values come from the second Retry attempt. Peak ω is the larger wheel's |ω|, shown as a share of the 47.12 rad/s cap. Slip is mean / max over supported wheel ticks. The outcome was identical in all three attempts. "Retry" compares R1 with R2, and "Load" compares the page load (one-tick phase) with R1: = means bit-identical. Full generated tables: [wheel114-ab.md](../reports/wheel-size-114/wheel114-ab.md), data: [wheel114-ab.json](../reports/wheel-size-114/wheel114-ab.json).

| Section | Preset | Top speed (m/s) | Top vx (m/s) | Peak ω (rad/s, % cap) | Ticks at cap | Slip mean / max (m/s) | Outcome | Retry / Load |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| straight | A | 6.96 | 6.96 | 33.62 (71 %) | 0 | 0.087 / 2.61 | n/a | = / = |
|  | W26 | 8.25 | 8.25 | 32.94 (70 %) | 0 | 0.086 / 5.04 | n/a | = / = |
|  | W30 | 9.53 | 9.53 | 32.26 (68 %) | 0 | 0.091 / 1.81 | n/a | = / = |
| ramps-long/down-10 | A | 2.95 | 2.29 | 10.74 (23 %) | 0 | 0.030 / 0.09 | ACCELERATED +1.17 | = / = |
|  | W26 | 2.57 | 2.50 | 10.08 (21 %) | 0 | 0.025 / 0.08 | ACCELERATED +1.42 | = / = |
|  | W30 | 2.68 | 2.64 | 9.47 (20 %) | 0 | 0.020 / 0.07 | ACCELERATED +1.56 | = / = |
| ramps-long/down-20 | A | 3.86 | 3.63 | 19.14 (41 %) | 0 | 0.080 / 0.32 | ACCELERATED +2.53 | = / = |
|  | W26 | 4.04 | 3.80 | 17.49 (37 %) | 0 | 0.068 / 0.41 | ACCELERATED +2.71 | = / = |
|  | W30 | 4.16 | 3.92 | 16.16 (34 %) | 0 | 0.056 / 0.55 | ACCELERATED +2.80 | = / = |
| ramps-long/down-30 | A | 4.92 | 4.27 | 25.77 (55 %) | 0 | 0.135 / 1.34 | ACCELERATED +3.10 | = / = |
|  | W26 | 5.07 | 4.41 | 22.95 (49 %) | 0 | 0.094 / 1.76 | ACCELERATED +3.24 | = / = |
|  | W30 | 5.17 | 4.53 | 20.98 (45 %) | 0 | 0.073 / 1.41 | ACCELERATED +3.33 | = / = |
| gaps/3 | A | 7.64 | 7.00 | 40.78 (87 %) | 0 | 0.235 / 1.93 | CLEARED 3.32 m | = / = |
|  | W26 | 8.39 | 8.24 | 37.92 (80 %) | 0 | 0.298 / 1.86 | CLEARED 3.99 m | = / = |
|  | W30 | 9.53 | 9.53 | 34.19 (73 %) | 0 | 0.364 / 2.84 | CLEARED 4.28 m | = / = |
| gaps/6 | A | 10.10 | 7.00 | 34.60 (73 %) | 0 | 0.198 / 4.87 | MISSED | = / = |
|  | W26 | 9.64 | 6.99 | 34.65 (74 %) | 0 | 1.642 / 8.34 | MISSED | = / = |
|  | W30 | 9.41 | 7.14 | 33.91 (72 %) | 0 | 0.275 / 7.87 | MISSED | = / = |
| gaps-landing/down | A | 7.42 | 7.00 | 43.91 (93 %) | 0 | 0.208 / 1.93 | CLEARED 2.24 m | = / = |
|  | W26 | 8.22 | 8.22 | 38.01 (81 %) | 0 | 0.260 / 1.90 | CLEARED 3.49 m | = / MATCH Δ0.0001 m |
|  | W30 | 9.54 | 9.54 | 34.56 (73 %) | 0 | 0.353 / 3.83 | CLEARED 3.86 m | = / = |
| air/big | A | 16.61 | 11.91 | 47.12 (100 %) | 1 | 0.428 / 4.75 | CRASHED -94° | = / = |
|  | W26 | 18.45 | 8.79 | 45.04 (96 %) | 0 | 0.287 / 4.32 | CRASHED -136° | = / = |
|  | W30 | 19.03 | 7.83 | 34.24 (73 %) | 0 | 0.319 / 4.59 | CRASHED 175° | = / = |
| air/mid | A | 12.40 | 9.27 | 54.45 (116 %) | 3 | 0.157 / 3.03 | CRASHED -69° | = / = |
|  | W26 | 13.99 | 8.71 | 43.10 (91 %) | 0 | 0.186 / 4.92 | LANDED -96° | = / = |
|  | W30 | 14.64 | 7.83 | 34.24 (73 %) | 0 | 0.143 / 3.51 | CRASHED -129° | = / = |

## Existing station runners

`PYTHON=.venv/bin/python node tools/gym/presets_compare.cjs --bundle <23b8696 bundle> --output artifacts/presets114 --candidates w26,w30 --stations ramps,gaps,air`. The existing a16, a19 and a19c runners ran unchanged with `--preset`, and every trial asserted its preset, unmodified and comparable. Tables: [presets-compare.md](../reports/wheel-size-114/presets-compare.md), [presets-compare.json](../reports/wheel-size-114/presets-compare.json). Overall status **FAIL**: gaps and air PASSed for all three presets, while ramps PASSed for A and FAILed for W26 and W30, as explained next.

**Ramps (a16):** for W26 and W30 the runner completed all 25 ramp trials, then stopped at the #352 debug camera experiment's Retry-framing check. That check runs only in the opt-in `camera352=b` render-only camera, which is not the shipped camera. The check requires the first frame after R to be within 30 u of the page-load frame. Diagnosed with an ad-hoc probe on the same bundle: A reached **29.8 u** (load 456.0 → Retry 485.8), only 0.2 u inside the limit, and W26 reached **32.3 u** (465.0 → 497.3). The 9 u higher start framing is the candidate's camera rest height. The assertion was not changed. The trials before the stop come from the runner's failed-state file ([ramps-ladder.json](../reports/wheel-size-114/ramps-ladder.json)):

| Ramps (8 m/s start, full throttle) | A | W26 | W30 |
| --- | --- | --- | --- |
| `ramps` (1 m kick ramps): highest climbed | 45° | 45° | 45° |
| `ramps-long` (4 m climbs): highest climbed | 35° | **40°** | **45°** |
| `ramps-long` 40° / 45° | FAILED / FAILED | CLIMBED / FAILED | CLIMBED / CLIMBED |
| `ramps` 45° peak launch | 0.18 m | 0.49 m | 0.58 m |
| Downhill speed gain down-10 / 20 / 30 (m/s) | 1.17 / 2.53 / 3.10 | 1.42 / 2.71 / 3.24 | 1.56 / 2.80 / 3.33 |

**Gaps (a19):** widest gap cleared at 7 m/s: A 3 m, W26 **4 m**, W30 **4 m**. At 9 m/s: 4 / 4 / **5 m**. Takeoff at 7 m/s: 6.02 / 6.63 / 6.75 m/s. All three landing variants (flat, 15° down, 15° up) were CLEARED by every preset. Peak landing compression grew by 0.004–0.060 m (flat 0.273 / 0.278 / 0.300 m).

**Air (a19c, 7 m/s, full lean held through the flight):**

| Jump | A | W26 | W30 |
| --- | --- | --- | --- |
| big lean 0 / +1 back / −1 front | CRASHED / CRASHED / CRASHED | CRASHED / CRASHED / **LANDED** | CRASHED / CRASHED / **LANDED** |
| mid lean 0 / +1 back / −1 front | CRASHED / CRASHED / **LANDED** | **LANDED** / **LANDED** / CRASHED | CRASHED / **LANDED** / CRASHED |
| takeoff speed / big airtime | 5.59 m/s / 1.73 s | 6.80 m/s / 1.98 s | 7.27 m/s / 2.05 s |
| big lean 0 impact normal speed | 7.36 m/s | 12.46 m/s | 14.98 m/s |

The larger wheels take off faster (more motor-target speed on the run-up), fly longer and rotate further. Which lean lands therefore shifts, and impacts are harder. With fixed full-flight lean this says nothing about how landable the jumps are for a player who times the lean; Claudio's drive decides that.

## Preset A unchanged

- `a22` (the stored preset A traces) PASSed at `dd6f993`, `fcb9ed9` and `23b8696`. At `23b8696` every measured field of every case (verdicts, per-tick maximum deltas, outcomes, perturbed and refused controls) equals main's CI artifact `g1-gym-regress-41589835678-1` (source `f3f793b`, same Chromium 156.0.8078.4). The only exception is the render-cadence field `frames_per_tick` (0.994 vs 1 etc.), which depends on the machine.
- Code paths for A–F evaluate to the previous constants: factory `#wheel`, `-speed/22`, radius `0.22` (the default entry stores the literal `.22`, not `22*scale`), anchor −30, camera rest 46. The preset message to the HUD carries no `candidate` field for A–F. `tests/bootstrap/test_presets.py` still pins A/B/C byte for byte.
- The w114 runner's preset A Straight top vx (6.9569810456712 m/s) equals `a22`'s frozen `straight-top` value to every digit. Same protocol: full throttle from rest on Straight.
- CI `required` is unchanged: no workflow, no Gym matrix entry, and no existing assertion was changed.

## Caveats

- **The motor target is A's, so flat speed rises with the radius.** 32 rad/s × r = 7.04 / 8.32 / 9.60 m/s. The joint torque cap is unchanged, so the drive force at the contact falls by 22/r. Straight and gaps speed gains are therefore a motor-target effect. Climbing nevertheless improved ([station runners](#existing-station-runners)); this was not separated into higher clearance, higher entry momentum and lower force. This isolates the wheel as one variable; matching linear target speed or force would be a separate tuning step.
- **The authored protocols barely touch the cap.** Only the air landing slopes (16 m and 8 m drops) drive a wheel to the cap, and there every preset is mostly crashing under neutral lean. The stations have no long rideable downhill. The 2026-10-18 idea of an editor-built downhill is still the way to judge sustained >10 m/s rolling; it is listed in the [drive test](#drive-test), not measured here.
- **Read-back ω above the cap:** A on air/mid read 54.45 rad/s, 116 % of 47.12. Box2D 3.1.0 clamps angular speed in its velocity integration ([solver.c](https://github.com/erincatto/box2d/blob/v3.1.0/src/solver.c#L71-L118)), and contact and joint solving and restitution run after that within each substep. This is consistent with a post-solve value above the cap, but that ordering is from source reading and is **not separately verified**. "At cap" therefore counts ≥ cap − 0.01.
- **Max slip includes the spawn drop.** On Straight the driver holds throttle from tick 1 while the vehicle drops 0.38 / 0.29 / 0.19 m to the ground. The wheels spin up in the air and slip at touchdown (W26 max 5.04 m/s). Mean slip and the support share are the steadier figures; per-tick traces are in the local evidence.
- **Page-load phase:** the page-load start resets in `update()`, so the probe's first sample is the unstepped start pose. A Retry resets inside `fixed_update` after the probe has read. Unaligned, load vs Retry differed by 0.04–0.29 m on every preset, including A. Shifted by one tick, all 27 traces (9 sections × 3 presets) were identical at `fcb9ed9`, and the tool now compares with that phase. This is a sampling phase of the probe, not a physics difference.
- **One 0.0001 m repeat difference:** in both full runs (`fcb9ed9` and `23b8696`), one of the three W26 gaps-landing/down attempts differed from the others by 0.0001 m. That is within tolerance, the outcome was the same, and which attempt differed changed between runs. Cause not investigated. Every other attempt pair was bit-identical, and all table values are identical between the two runs.
- **A21 ghost replay (B/G) was not exercised for the candidates.** Retry with identical per-tick driver commands is the re-simulation measured here.
- **Not adapted to the candidate wheel (A-only protocols, unchanged):**
  - the a18 powered seam and a19b bump throttle formulas (`nominal/(motor×0.22)` in `seam_trial.lua`, `seam_metrics.lua`, `bump_metrics.lua`, `bumps.cjs`);
  - a19b's 0.38 m clearance reference;
  - the a15 first-tick ω check (`8/.22`);
  - the coast probes' `-500/22` seeds;
  - the a17 stop-probe limits [−0.20, +0.18] m;
  - `gaps.cjs`'s 0.25 m edge-strike allowance.

  The candidates were not run on a17, a18, a19b or a19d.
- **Evidence type:** desktop headless Chromium, debug HTML5 only. There is no Android or phone run, and no human drive. Synthetic input does not prove touch or device behaviour.

## Drive test

The candidates exist only in a **debug** build. The public preview is a release build, where `?preset=w26` falls back to A by design. Drive on desktop from a local debug bundle of this branch:

1. In WSL, on a checkout of this branch (PR head) with the local Extender running:
   ```sh
   RIDER_BUILD_SERVER=http://127.0.0.1:9000 .venv/bin/python tools/gym/bundle.py --output artifacts/drive114
   python3 -m http.server 8790 --bind 127.0.0.1 --directory artifacts/drive114/RiderG1
   ```
2. In the Windows browser, open each URL in turn. For every preset, change only `preset=` in the address bar and reload. P and the chips do not leave a candidate; the HUD says "reload to change".
   - A: `http://127.0.0.1:8790/index.html?station=ramps-long&section=down-30&preset=a`
   - 0.26 m: `…&preset=w26`
   - 0.30 m: `…&preset=w30`
3. Check the candidate is active: press **T**. The tuning panel note reads "Debug W26: A + 0.26 m wheels" (W30: 0.30 m). A shows "Presets [P]". The wheels look visibly larger and the buggy sits higher.
4. Drive the same list with each preset, using **R** to retry. Keys: W/Up throttle, S/Down brake/reverse, A/D lean.
   1. `?station=ramps-long&section=down-30`, then `section=down-20` and `section=down-10`: roll down neutral, then throttle on the run-out.
   2. `?station=straight`: full throttle; the HUD shows speed and top speed.
   3. `?station=ramps-long&section=30` and `section=40`: uphill from 8 m/s at full throttle. The candidates have less drive force.
   4. `?station=gaps&section=3`, `section=6` and `?station=gaps-landing&section=down`: jumps and landings at full throttle.
   5. `?station=air&section=big` and `section=mid`: the long landing slopes, the only existing place a wheel reaches the cap. Try leaning back and forward.
   6. Optional, for sustained high speed: press E, draw a long constant slope (e.g. 15° over 100+ m) with a flat run-out, place START at the top, Play, and coast or throttle down. The loader passes the current preset to the Play world (from source reading, not exercised in this run).
5. Pick one: **A (keep)**, **W26** or **W30**, and record it on #114. Making it the default is a follow-up PR with regenerated `a22` traces ([TOOLING](../TOOLING.md#gym-tests)). If the choice depends on speed or force, say so; matching the motor target to the wheel would be a separate tuning step.

## Engine sources

This work added new Defold API uses: the read-only debug probe and dynamic factories. Each was checked against the pinned 1.14.0 source (`a81dbb0`):

- [`FactoryDesc.load_dynamically`](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/gamesys/proto/gamesys/gamesys_ddf.proto#L24-L29). [`factory.create` on an unloaded dynamic factory loads synchronously](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/gamesys/src/gamesys/scripts/script_factory.cpp#L196-L197).
- [`b2d.body.get_linear_velocity_from_world_point`](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/gamesys/src/gamesys/scripts/box2d/v3/script_box2d_body_v3.cpp#L988-L995) scales the point in and the velocity out once. [`get_contact_data`](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/gamesys/src/gamesys/scripts/box2d/v3/script_box2d_body_v3.cpp#L322-L347) returns the manifold `normal` (unscaled unit vector) and per-point `point` and `separation`. [`get_mass`](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/gamesys/src/gamesys/scripts/box2d/v3/script_box2d_body_v3.cpp#L485-L491), [`get_rotational_inertia`](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/gamesys/src/gamesys/scripts/box2d/v3/script_box2d_body_v3.cpp#L502), [`get_shapes`](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/gamesys/src/gamesys/scripts/box2d/v3/script_box2d_body_v3.cpp#L577).
- [`b2d.shape.get_shape`](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/gamesys/src/gamesys/scripts/box2d/v3/script_box2d_shape_v3.cpp#L390-L406) returns a circle's `radius` in engine units. It read back 22 / 26 / 30.
- The cap and solver order are from the sources cited in [wheel-rotation-cap-114](wheel-rotation-cap-114.md#references-and-evidence-status).

## Verification

VERIFICATION_PLACEHOLDER
