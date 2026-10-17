# A18 seam comparison protocol v2

Each protocol version was declared before its corresponding runs. Defold 1.14.0 / integrated Box2D 3.1.0, existing buggy and preset A, no tuning changes. Technical browser trials are separate from Claudio's phone/drive acceptance. The engine owns simulation and all bodies; the existing fixed owner applies normalized commands.

Two selectable JSON stations: `seams-chain` (key 6) and `seams-hull` (key 7). URLs accept `?station=seams-chain&speed=5`, likewise hull and speeds 15/30. R retries at the same start without reloading the world; Next station switches through A15. Normal play uses player commands; the debug test alone supplies the fixed protocol commands. Player commands outside the protocol explicitly invalidate a comparison.

Geometry is flat at y=0.8 m with 20 internal vertices/abutments at x=40,42,...78 m. Chain has 21 connected segments and ghost vertices; hull has 21 flush, neighboring CCW rectangles, bottom y=-0.2 m (1 m thick). Both use the existing friction 0.8, restitution 0, category/mask 1 and the same static terrain body. Chain is one sided with zero thickness; hull is solid and two sided. Only loaded contact from above is compared; neither underside nor end contacts are part of this experiment. Initial chassis (0,1.7) and rolling wheel velocities use A15's canonical start.

## Fixed commands and qualification

Powered control v1: every step throttle `clamp(nominal / (abs(preset.motor_speed) * 0.22), 0, 1)`, brake=0, lean=0, reverse disallowed. This sets the existing normal motor's theoretical no-slip target; it does not guarantee chassis speed. No feedback, per-step velocity correction, extra force or changed motor/spring values.

Revision v2 isolates seam response in **debug-only free roll**: throttle=brake=lean=0, reverse disallowed, both joint motors disabled and passive coasting/rolling moments absent. The wheel joints, masses, springs, materials and geometry are unchanged, with no altered preset coefficients. The production vehicle input path has no freewheel control; a runtime guard accepts it only in the debug `a18` trial. The original powered protocol cannot maintain the high nominal targets with preset A (motor -32 rad/s, theoretical no-slip 7.04 m/s). It is not evidence for 15/30 m/s seams. Retain its rejected records; the runner repeats both 15 m/s powered controls as a physical invalid-speed regression. V2 is a controlled drivetrain-open experiment, not a claim about powered driving at those speeds. Nominal speeds 5,15,30 m/s are independent runs, each followed by a retained-world Retry.

Baseline chassis window x=30..38 m, after the settling run-in. Measurement x=39..79 m includes both wheels across all 20 seams. Entry and **every completed-step horizontal chassis velocity**, including the first exit sample, must be within **±5% of nominal**. Record entry, minimum, maximum, exit and signed exit-minus-entry drift. At least ten baseline samples with loaded wheel contact, correct dt, complete entry/exit and two or more samples plus both wheel crossings in each seam window are required. Unsupported speeds, protocol-command changes, tuning changes, incomplete traversal (30 s observation), or any off-target speed make the result **INVALID / NOT COMPARABLE**. The observation cap never resets or ends practice. Compare a nominal condition only when both variants qualify; invalid results have no comparative bump verdict. Never change the physics/tolerance to obtain green results.

## Sampling and bump definition

The sole owner observes completed 1/60 s steps (four engine solver substeps; substep transitions are unobserved). Wheel support requires a manifold point with separation <=0 or positive normal/total normal impulse; a speculative manifold alone does not prove loaded contact. Retain each sample from baseline through exit: elapsed seconds, dt, chassis x/y/vx/vy, both wheel x, two support booleans and throttle/brake/lean. JSON numbers are not rounded. Raw columns are in that order. `delta vy` compares adjacent samples, not a derivative in m/s².

Each seam has a chassis window ±1 m containing front and rear wheel crossings including up to one 30 m/s sampling step of overshoot. Adjacent windows share only their boundary. Record sample counts, absolute chassis vy peak, absolute consecutive-step delta-vy peak, positive chassis rise relative to baseline mean, each wheel's support-loss transitions and lost-contact duration, and both-wheels-airborne samples. Thresholds are fixed rules: max(0.10 m/s, 3 × baseline absolute vy peak), max(0.10 m/s, 3 × baseline delta-vy peak), max(0.005 m, 3 × baseline y range). A seam exceeding any threshold is counted once as an operational **ghost bump**. Locations/metrics remain available even for invalid trials, but are excluded from comparisons. Sampled seam coincidence does not prove a causal collision defect. Baseline thresholds and raw traces allow reanalysis; contact loss is reported separately and need not imply a bump.

Repeat limits declared before runs: entry speed and each seam's vy peak within 0.02 m/s, rise within 0.002 m, contact-loss/airborne counts within one tick; identical validity/reasons and bump count. Repeat failure is a failed verification, not an invalid-speed exemption.

## Reproduction and artifacts

Use the pinned toolchain and local `.venv`:

```sh
.venv/bin/python tools/gym/bundle.py --output artifacts/a18/bundle
.venv/bin/python tools/gym/smoke.py --bundle artifacts/a18/bundle --output artifacts/a18/measurement --case a18
node --test tests/ci/seams.test.cjs
```

`seams-result.json` contains exact source/run/browser identity, six runs, six retries, two rejected powered controls, rejected unsupported-speed trial and per-speed comparison qualification. Per-condition JSON and screenshots are retained separately. CI uploads these under its G1 HTML5 artifact. The release verifier additionally checks URL selection, normal input, keyboard station switches, retained-world Retry and mobile-emulation station selection/screenshots. No real-phone behavior or performance follows from these tests.

D8 remains chain terrain by default. Confirm or revise it only using qualified pairs and disclose any missing nominal comparisons. Current outcome and evidence links live solely in [STATUS.md](../STATUS.md).
