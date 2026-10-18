# A18 seam comparison protocol v3

Each protocol version was declared before its corresponding runs. Defold 1.14.0 / integrated Box2D 3.1.0, existing buggy and preset A, no tuning changes. Technical browser trials are separate from Claudio's phone/drive acceptance. The engine owns simulation and all bodies; the existing fixed owner applies normalized commands.

Two selectable JSON stations: `seams-chain` (key 6) and `seams-hull` (key 7). URLs accept `?station=seams-chain&speed=5`, likewise hull and speeds 7/9 (station default 9). R retries at the same start without reloading the world; Next station switches through A15. Normal play uses player commands; the debug test alone supplies the fixed protocol commands. Player commands outside the protocol explicitly invalidate a comparison.

Geometry is flat at y=0.8 m with 20 internal vertices/abutments at x=40,42,...78 m. Chain has 21 connected segments and ghost vertices; hull has 21 flush, neighboring CCW rectangles, bottom y=-0.2 m (1 m thick). Both use the existing friction 0.8, restitution 0, category/mask 1 and the same static terrain body. Chain is one sided with zero thickness; hull is solid and two sided. Only loaded contact from above is compared; neither underside nor end contacts are part of this experiment. Initial chassis (0,1.7) and rolling wheel velocities use A15's canonical start.

## Revision history

- **v1** powered protocol at 5/15/30 m/s: preset A's motor (-32 rad/s, theoretical no-slip 7.04 m/s) cannot hold 15/30 m/s.
- **v2** debug free roll at 5/15/30 m/s: wheel spin hits the engine rotation cap (below), so 15/30 m/s windows cannot exist for this vehicle. Hull lost speed in every free-roll run while chain held speed; v2 classified that loss as invalid and measured only vertical response.
- **v3** (maintainer decision 2026-10-18 on #33): nominal speeds **5/7/9 m/s**, all below the rotation cap; free-roll validity is judged on baseline and entry speed, and seam speed loss becomes a declared longitudinal metric. The v3 rule and the 0.02 m/s floor were defined after inspecting v2 raw traces (seam-localized one-step vx drops on hull, none on chain) and fixed before any v3 run. Disclosed here because the metric was motivated by observed data.

## Fixed commands and qualification

Powered control (v1 commands): every step throttle `clamp(nominal / (abs(preset.motor_speed) * 0.22), 0, 1)`, brake=0, lean=0, reverse disallowed. This sets the existing normal motor's theoretical no-slip target; it does not guarantee chassis speed. No feedback, per-step velocity correction, extra force or changed motor/spring values.

Comparison runs use **debug-only free roll** (v2 commands): throttle=brake=lean=0, reverse disallowed, both joint motors disabled and passive coasting/rolling moments absent. The wheel joints, masses, springs, materials and geometry are unchanged, with no altered preset coefficients. The production vehicle input path has no freewheel control; a runtime guard accepts it only in the debug `a18` trial. Nominal speeds 5, 7, 9 m/s are independent runs, each followed by a retained-world Retry.

Baseline chassis window x=30..38 m (seamless in both variants), after the settling run-in. Measurement x=39..79 m includes both wheels across all 20 seams. Both modes require: nominal speed 5, 7 or 9 m/s; **every baseline sample and the entry sample within ±5% of nominal**; wheel angular speed below the engine rotation cap minus 0.01 rad/s on every retained sample; at least ten baseline samples with loaded wheel contact, correct dt, complete entry/exit and two or more samples plus both wheel crossings in each seam window; complete traversal within 30 s observation; unchanged commands and tuning. Additionally:

- **Powered control:** every completed-step chassis vx through the first exit sample within ±5% of nominal.
- **Free roll:** no window sample above +5% of nominal. Speed loss inside the window is the measured seam response, not a rejection reason.

Record entry, minimum, maximum, exit and signed exit-minus-entry drift, plus the peak wheel spin. Any failed condition makes the result **INVALID / NOT COMPARABLE**. The observation cap never resets or ends practice. Compare a nominal condition only when both variants qualify; invalid results have no comparative bump verdict. Never change the physics/tolerance to obtain green results.

## Sampling and bump definition

The sole owner observes completed 1/60 s steps (four engine solver substeps; substep transitions are unobserved). Wheel support requires a manifold point with separation <=0 or positive normal/total normal impulse; a speculative manifold alone does not prove loaded contact. Retain each sample from baseline through exit: elapsed seconds, dt, chassis x/y/vx/vy, both wheel x, two support booleans, throttle/brake/lean, both motor-enabled booleans and both wheel angular velocities (rad/s). Free-roll qualification also requires both motors observed disabled. JSON numbers are not rounded. Raw columns are in that order. `delta vy`/`delta vx` compare adjacent samples, not derivatives in m/s².

Each seam has a chassis window ±1 m containing front and rear wheel crossings. Adjacent windows share only their boundary. Record sample counts, absolute chassis vy peak, absolute consecutive-step delta-vy peak, positive chassis rise relative to baseline mean, peak one-step chassis vx drop, window speed loss (first minus last window sample), each wheel's support-loss transitions and lost-contact duration, and both-wheels-airborne samples. Fixed thresholds:

- **Vertical bump:** vy peak > max(0.10 m/s, 3 × baseline absolute vy peak), delta-vy peak > max(0.10 m/s, 3 × baseline delta-vy peak) or rise > max(0.005 m, 3 × baseline y range).
- **Longitudinal hit:** one-step vx drop > max(0.02 m/s, 3 × baseline absolute delta-vx peak).

A seam with either is counted once as an operational **ghost bump**; vertical and longitudinal counts are reported separately. Locations/metrics remain available even for invalid trials, but are excluded from comparisons. Sampled seam coincidence does not prove a causal collision defect. Baseline thresholds and raw traces allow reanalysis; contact loss is reported separately and need not imply a bump.

Repeat limits declared before runs: entry speed, each seam's vy peak, vx-drop peak and window speed loss within 0.02 m/s, rise within 0.002 m, contact-loss/airborne counts within one tick; identical validity/reasons and bump count. Repeat failure is a failed verification, not an invalid-speed exemption.

## Reproduction and artifacts

Use the pinned toolchain and local `.venv`. Bundle into an empty directory. A stale local `build/` left by an earlier release bundle produced a release engine for the debug Gym once (the debug-only trial then never starts); remove `build/` and `.internal/` first if the checkout was used for release builds.

```sh
.venv/bin/python tools/gym/bundle.py --output artifacts/a18/bundle
.venv/bin/python tools/gym/smoke.py --bundle artifacts/a18/bundle --output artifacts/a18/measurement --case a18
node --test tests/ci/seams.test.cjs
```

`seams-result.json` contains exact source/run/browser identity, six free-roll runs, six retries, two qualified 5 m/s powered controls and two rejected 9 m/s powered controls, a rejected unsupported-speed trial, per-speed comparison qualification and the computed D8 verdict. Per-condition JSON and screenshots are retained separately. CI uploads these under its G1 HTML5 artifact. The release verifier additionally checks URL selection, normal input, keyboard station switches, retained-world Retry and mobile-emulation station selection/screenshots. No real-phone behavior or performance follows from these tests.

The JSON `status` describes verification of the measurement machinery; `acceptance` is PASS only when all three free-roll pairs qualify, otherwise BLOCKED. `d8` is derived from qualified pairs only (CONFIRMED when chain has no more ghost bumps than hull at every speed; REVISE otherwise; PROVISIONAL when pairs are missing) and is never asserted by the test.

Current outcome and evidence links live solely in [STATUS.md](../STATUS.md).

## Engine boundary found during the experiment

Pinned Defold source actually read: `external/box2d/Box2D/src/constants.h` defines `B2_MAX_ROTATION = 0.25*pi`; `src/solver.c` uses this times the inverse **full** world dt as an angular-speed cap when `allowFastRotation` is false. Four solver substeps do not multiply this cap. At 60 Hz this is about 47.124 rad/s, or a theoretical 10.367 m/s rolling surface speed for the authored 0.22 m wheels (observed v2 free-roll plateau about 9.95 m/s). v3's 9 m/s needs about 40.9 rad/s.

The pinned Defold `engine/physics/src/physics/box2d/box2d_physics.cpp` creates the body from `b2DefaultBodyDef()` and copies damping, fixed rotation and bullet fields; it does not set `allowFastRotation`. The pinned Lua body binding exposes no fast-rotation setter. This is evidence of an engine boundary, not permission to patch the dependency or change tick frequency, scale, wheel radius or inertia. Its game-wide consequence (wheels cannot roll faster than about 10 m/s) is a separate design question tracked in [#114](https://github.com/bongohorse/rider/issues/114).
