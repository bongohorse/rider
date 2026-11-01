# Buggy feel: evidence baseline and bounded A/B plan (#339)

**Source inspected:** `main` at `07fdca441d935c38e5571c3d28596bb7e161ac1c` (2026-11-01). **Scope:** static audit of source, protocols and committed historical measurements only. **Engine execution on this SHA: NOT RUN.** No car tuning, game logic, trace, physics or preset file was changed. [Issue #339](https://github.com/bongohorse/rider/issues/339) is an evidence task, not authorization to retune the game.

**Contents:** [System and preset inventory](#system-and-preset-inventory) · [Evidence and gaps](#evidence-and-gaps) · [Two reproducible protocols](#two-reproducible-protocols) · [Candidate hypotheses and stop points](#candidate-hypotheses-and-stop-points) · [Verification and limitations](#verification-and-limitations)

## System and preset inventory

- [`game.project`](../../game.project): display `update_frequency=60`; `engine.fixed_update_frequency=60`, `physics.use_fixed_timestep=1`, `physics.scale=0.01` (100 engine units = 1 m), four Box2D solver substeps. Four substeps are **not** four player-command ticks. The Defold-owned world and the controller's sole `fixed_update` apply one normalized command per tick. At normal time factor 1.0, dt = 1/60 s; slow-motion 0.5/0.25 scales physics dt and is **not comparable**. See [physics contract](../contracts/physics.md) and [Gym notes](../../main/gym/README.md#record-and-replay).
- [`vehicle.lua`](../../main/gym/vehicle.lua): two wheel joints, configurable spring Hz and damping; brake wins over throttle; reverse is latched below `reverse_threshold` for `reverse_delay`. Grounded neutral input engages zero-speed wheel motors with `coast_torque` plus raw wheel torque `-omega * rolling_resistance`. Airborne lean uses raw chassis torque; optional neutral-flight pitch damping acts only with no body/wheel contact, lean exactly zero, awake chassis and not on reset tick. The joint motor torque cap is in **binding input units**, not raw chassis N m.
- [`feel.lua`](../../main/gym/feel.lua) loads schema-1 [preset JSON](../../main/gym/presets/) and validates the registry A–F. A is the frozen measurement baseline; B/C are stronger historic variants, D/E candidates and F is D plus neutral-air damping. These values are **source-verified settings**, not measured behavior:

| Preset | Spring Hz / damping ratio | Motor target rad/s | Drive / coast cap (binding units) | Air lean torque (N m) | Neutral air damping (N m s) | Engine outcome at current SHA |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| A | 5 / 0.8 | -32 | 1800 / 400 | 48 | 0 (optional default) | **NOT RUN** |
| B | 6 / 0.9 | -64 | 2400 / 400 | 72 | 0 | **NOT RUN** |
| C | 8 / 1.1 | -96 | 3000 / 400 | 96 | 0 | **NOT RUN** |
| D | 6 / 1.0 | -44 | 2600 / 400 | 72 | 0 | **NOT RUN** |
| E | 4.5 / 1.0 | -32 | 1800 / 900 | 44 | 0 | **NOT RUN** |
| F | 6 / 1.0 | -44 | 2600 / 400 | 72 | 8 | **NOT RUN** |

The source JSON for D and F is identical except for F's `air_pitch_damping=8` (D omits it and the loader supplies zero). Comparing **D vs F** is therefore an isolated coefficient test. Comparing **A vs E** is **not** an isolated coast test: E also changes spring, damping, lean, ground assistance and camera.

**Known mechanical ceiling, not a tuning bug:** [#114](https://github.com/bongohorse/rider/issues/114) documents Box2D's per-full-step rotation limit `0.25π × 60 ≈ 47.124 rad/s`, about `10.37 m/s` theoretical no-slip rolling for 0.22 m wheels, and an observed historical free-roll plateau around `9.95 m/s` (A18 v2). Preset B/C wheel targets exceed that cap; target angular speed is not achieved rolling speed. Do not change wheel radius, fixed step, Defold binding, `allowFastRotation` or the engine in this issue.

## Evidence and gaps

Evidence categories: **historically measured** = recorded engine result at its stated old SHA, **source-verified** = code or protocol only, **not measured** = no current-run result. Historical values must not be represented as current results.

| Driving situation | Existing evidence and source | A at current SHA | B–F at current SHA | Gap / caveat |
| --- | --- | --- | --- | --- |
| Throttle-from-rest and top speed | **Historically measured:** [A22 expected](../../tests/regress/expected.json) `straight-top`: maximum chassis speed `6.9569810456712 m/s`, 600 ticks; recording SHA `c2dad9f3b91ebb219f3ba6d99a571eb35c3777d9`, HTML5 debug, headless Chromium 156.0.8078.4, physics 60 Hz, render 60 FPS, time factor 1.0. [Trace definition](../../tools/gym/regress_spec.cjs) | **NOT RUN**; historic A value only | **NOT RUN**; [preset comparison runner](../../tools/gym/presets_compare.cjs) does not include A22 | Current acceleration curve/time-to-speed is **not measured** by the committed outcome; max speed is not acceleration |
| Neutral coasting, braking and reverse | **Source-verified:** [vehicle apply](../../main/gym/vehicle.lua), [Gym targets](../../main/gym/README.md#vehicle-and-controls) (5 m/s → below 0.1 m/s within 6–15 m is a **target**, not an observation); A6/other Gym cases exercise brake/reverse | **NOT RUN** | **NOT RUN** | No comparable per-preset coast distance or brake stop distance table identified; no actual touch feel |
| Climbs and descents / traction | **Protocol exists:** [ramps](../../tools/gym/ramps.cjs), `a16`, 8 m/s uphill full throttle; 1 m/s neutral downhill; `--preset` supported | **NOT RUN** | **NOT RUN** | Current climb thresholds, wheel slip/contact and descent outcomes not fetched or measured |
| Suspension, rough terrain and landing | **Historically measured:** A22 `gaps-3` peak compression `0.27324715003564 m`, 180 ticks; A22 `air-big-back` compression `0.099115941693277 m`, 420 ticks; same old SHA/platform as above. [A17](../../tools/gym/steps.cjs) and [A19b](../../tools/gym/bumps.cjs) have broader compression/contact protocols | **NOT RUN** | **NOT RUN** | Different stations are not interchangeable; do not interpret compression alone as comfort or damping quality |
| Air rotation and neutral nose-dive | **Historically measured:** A22 `air-big-back`: `422.22519790029°` backward rotation, `1.7500000912696 s` airtime, `116.47180579203°` landing angle, status `CRASHED` at old SHA. [A19c](../../tools/gym/air.cjs) records neutral/full-lean jumps and `damped_ticks` | **NOT RUN** | **NOT RUN** | No current D/F neutral comparison, no user judgment of naturalness; full-lean metrics must remain intact |
| High-speed wheel rolling | **Historically measured:** [#114](https://github.com/bongohorse/rider/issues/114) A18 v2 free-roll plateau ≈9.95 m/s, mechanical cap ≈10.37 m/s; [A18 protocol](../A18_SEAM_PROTOCOL.md) | **NOT RUN** | **NOT RUN** | A18 diagnostic disables motors and passive coast, so it is **not** production coasting; wheel spin above the cap cannot be inferred from motor target |

Existing `a22` regression is especially valuable: [Gym notes](../../main/gym/README.md#regression-traces-a22) specify frozen pose (0.05 m / 0.05 rad), speed (0.02 m/s), landing and air tolerances; the runner deliberately checks that perturbed commands/tuning fail. Never regenerate traces to make a candidate green or loosen tolerances in the same PR.

## Two reproducible protocols

These are **proposed reruns**, not results. Execute from a clean worktree at the exact SHA being evaluated with the pinned Defold/Bob, Node and Playwright setup in [TOOLING](../TOOLING.md#gym-tests). Verify `source_sha`, bundle SHA-256 inventory, `run_id`, browser, preset, `modified=false`, `time_factor=1`, 60 fixed ticks/s and no scaled ticks in output. Keep HTML5 results distinct from physical-device acceptance.

### P1 — Baseline A: from rest to speed (existing A22)

```sh
python tools/gym/bundle.py --output artifacts/gym-bundle
python tools/gym/smoke.py --bundle artifacts/gym-bundle --output artifacts/feel/a22 --case a22
```

Read `artifacts/feel/a22/regress-result.json`, the `straight-top` row and `tests/regress/expected.json`. The existing [trace spec](../../tools/gym/regress_spec.cjs) starts `?station=straight` at **0 m/s**, runs full throttle (brake=0, reverse=false, lean=0) for **600 fixed ticks / 10 s** on unmodified preset A, and compares all recorded poses and maximum chassis vx against the frozen historical baseline. Capture status, actual `top_speed_mps`, exact SHA/browser and any failed assertion; do not call a 10 s maximum an acceleration time. To measure time-to-5 m/s or neutral coast distance later, authorize a **separate** deterministic tick-observer/command protocol rather than inferring it from this summary. **Expected result at current SHA: unknown until run.**

### P2 — D vs F: one-variable neutral-air damping (existing A19c)

```sh
PYTHON=.venv/bin/python node tools/gym/presets_compare.cjs \
  --bundle artifacts/gym-bundle --output artifacts/feel/d-vs-f \
  --baseline d --candidates f --stations air
```

This invokes the existing [`a19c` runner](../../tools/gym/air.cjs) separately for D and F, without modifying JSON. On `?station=air&section=big`, start at **7 m/s**; debug driver holds full throttle until lip takeoff, then throttle=brake=0 and `lean=0` throughout the flight. Compare neutral jump's `takeoff_speed_mps`, `airtime_s`, `rotation_deg`, `landing_angle_deg`, `impact_normal_mps`, `peak_compression_m`, status and `damped_ticks`. Also retain `lean=+1/-1` full-flight cases as control: F's neutral damping must be absent with nonzero lean. The full A19c runner covers all sections, repeat trials and other speeds; a failing case is **FAIL**, not grounds to skip it. Existing repeat tolerances are takeoff 0.02 m/s, airtime 0.034 s, rotation 5°, landing angle 5°, compression 0.005 m. `impact_normal_mps` is diagnostic only (no repeat tolerance). Capture `presets-compare.json`, `presets-compare.md` and raw `air-result.json` for each preset. **Current comparison: NOT RUN.**

## Candidate hypotheses and stop points

1. **H1 — Neutral-flight pitch damping:** D vs F (the isolated `air_pitch_damping: 0 → 8 N m s`) may reduce neutral nose-down rotation and improve landing orientation without taking away held-lean flips. *Test first with P2.* Predeclare desired direction before a tuning PR: lower absolute neutral landing-angle error relative to slope and/or lower neutral rotation, with no worse landing status, no extra chassis contact and no regression outside the established A19c repeat bounds for held-lean trials. A failed repeat or changed full-lean outcome is a stop, not an invitation to widen tolerances. F already exists; **do not** alter D, F or default A here. User drive comparison of D/F on the same jumps is mandatory to decide whether reduced rotation feels natural; restoring D is the immediate rollback.
2. **H2 — Coasting deceleration:** A's grounded neutral `coast_torque=400` may be too weak/strong for satisfying speed bleed; a *future* bounded trial could compare A with an otherwise identical temporary `coast_torque=600` while keeping `rolling_resistance=0.15`, suspension, brakes, motor target and geometry fixed. This is **hypothesis only**, not a source edit or observed problem. First authorize a reproducible from-5-m/s neutral input trace (e.g. Straight), measure first tick at 5 m/s, coast distance/time to <0.1 m/s, stop/reverse handoff and wheel support over at least two same-SHA repeats; preserve a separate full-brake control. Do not use E as the control (multiple differences) or A18 debug freewheel (different drivetrain). Compare to the **design target** 6–15 m without claiming it has already been met. A worse or nonrepeatable result stops the trial; rollback is unchanged A. Human drive on flat and slopes before any accepted default change.

Neither hypothesis authorizes production physics, new mechanics, trace regeneration, engine patches, unit changes or automatic deployment. Any later implementation needs its **own** GO/issue, a one-variable diff, independent QA, exact-head `required` CI, regression review and the maintainer's actual drive test on the intended device. Camera #337 and Codex-owned editor #281 remain separate.

## Verification and limitations

- **PASS (read-only source audit):** inspected current `feel.lua`, `vehicle.lua`, all six preset JSONs, `game.project`, A22 expected/spec, A19c runner, preset comparison CLI and physics/Gym contracts. D and F differ only in the optional damping value; no motor/physics file edited.
- **NOT RUN:** Defold build, Playwright, Gym P1/P2, CI and device tests. Connected GitHub source reads do not execute a local game. Historic recorded values belong to `c2dad9f3b91ebb219f3ba6d99a571eb35c3777d9`, **not** `07fdca4`.
- **NOT CLAIMED:** user drive approval, Android/phone evidence, current preset outcomes, current frame performance, current acceleration/coast curves or a successful tuning recommendation.
