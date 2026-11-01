# Camera downhill framing: bounded baseline and next experiment (#337)

**Contents:** [Source and scope](#source-and-scope) · [Synthetic measurement](#synthetic-measurement) · [Mechanism](#mechanism) · [Smallest candidate](#smallest-candidate) · [Runtime reproduction and acceptance](#runtime-reproduction-and-acceptance) · [Verification and limits](#verification-and-limits)

## Source and scope

- Source main SHA: `42129e1a3d029383db0f8368cce592c5f248802b` (2026-11-01). Camera math: `main/gym/feel.lua`, `M.camera_start` and `M.camera` (around lines 142–220). Call site: `main/gym/controller.script` lines 393–402. Baseline A: `main/gym/presets/a.json`. Camera resource: `main/gym/camera.camera`.
- **Already implemented:** horizontal direction/hysteresis/look-ahead, smoothed vertical velocity, vertical signed look-ahead, ground window, safe-edge clamps and speed-dependent zoom. The report does **not** claim these are absent. No production code or preset changed.
- Preset A: `camera_height=250`, `camera_lift=70`, `camera_response=6/s`, `camera_look_seconds=.22`, `camera_look_max=130`, `camera_zoom=1`, `camera_zoom_min=.82`, `camera_zoom_speed=650 u/s`. Follow defaults: `sink_rate=1.5/s`, `vertical_deadband=40 u/s`, `vertical_full=300 u/s`, `vertical_response_scale=.6`, `margin_bottom=100 u`, `margin_top=100 u`, `margin_side=120 u`.
- `game.project`: `[engine] fixed_update_frequency=60`, `[physics] use_fixed_timestep=1`; `[display] update_frequency=60`. Camera output is used for `go.set_position` and `orthographic_zoom`, not Box2D body writes. `tools/gym/regress.cjs` already has a separate 30-FPS-render/60-Hz-replay check, but it is **not** a downhill camera-framing measurement.

## Synthetic measurement

This is an **offline numerical characterization of a source-faithful port of the camera formulas**, not a running Defold game, actual projection sample, Playwright screenshot, phone test or physical course result. Its purpose is to expose a falsifiable failure mechanism, not to satisfy the runtime/drive gate.

Deterministic inputs: `dt=1/60 s`, `camera_start(0,46,0,300,half_y)`, constant chassis velocity `(vx,vy)=(300,-300) u/s`, position `(300t,46-300t)`, `grounded=true`, with matching flat-road control `(300,0)`. This represents a 45-degree descending path at 3 m/s per axis, not a measured buggy trajectory. Initial zoom 1; the model applies the source's zoom interpolation. For the model **only**, effective projection half-extents are assumed `(480,270)/zoom` for 1280×720 and `(270,480)/zoom` for 720×1280. The latter is a *hypothetical tall projection*, **not** a verified Defold `ORTHO_MODE_AUTO_FIT` portrait result. Projection `m00/m11` must be read from the engine before claiming real aspect behavior.

Screen coordinates below are **pixels relative to viewport center**, positive Y upward; negative Y is below center. `downhill ahead` is the visible 45-degree slope distance before reaching the bottom or forward viewport edge, `min(target_y-(camera_y-half_y), camera_x+half_x-target_x)`. Seconds ahead divide that distance by `300 u/s`.

| Model viewport / case | Time | Vehicle screen X, Y | Visible downhill ahead | Time ahead |
| --- | ---: | ---: | ---: | ---: |
| 1280×720 flat control | 0.50 s | −165, −179 px | N/A (flat) | N/A |
| 1280×720 descent | 0.50 s | **−165, −229 px** | **107 u** | **0.36 s** |
| 1280×720 descent | 1.00 s | −164, −79 px | 230 u | 0.77 s |
| 1280×720 airborne drop | 0.50 s | −165, −209 px | 123 u | 0.41 s |
| 720×1280 flat control | 0.50 s | −165, −251 px | N/A (flat) | N/A |
| 720×1280 descent | 0.50 s | −165, −301 px | 276 u | 0.92 s |
| 720×1280 descent | 1.00 s | −164, −105 px | 429 u (forward edge) | 1.43 s |

Numbers rounded from 60-Hz arithmetic; these are **model outputs**, not observed game pixels. In the landscape descent at 0.5 s the buggy is only about 132 px above the bottom of a 720-px view. The horizontal forward space is about 656 u, so the *vertical* framing is the modeled bottleneck. This matches the maintainer's qualitative downhill-blindness report, but does not yet prove it occurs on an authored track.

## Mechanism

1. `s.vy` is low-pass filtered using `sink_rate=1.5/s`. A sustained raw `vy=-300 u/s` reaches only about `-158 u/s` after 0.5 s (starting from zero).
2. The downward velocity weight then uses `smoothstep((abs(s.vy)-40)/(300-40))`; at 0.5 s it is only about **0.43**. This delays replacing the high ground-based camera window with the signed downward target. The ground window itself also eases with `sink_rate=1.5/s`.
3. The camera position has an additional vertical smoothing rate `camera_response*.6=3.6/s`. The final hard-edge clamp keeps the vehicle within the frame but **does not guarantee any minimum amount of upcoming downhill terrain**. With an extreme slope, a legal vehicle position near the bottom can still leave less than half a second of terrain ahead.
4. The zoom interpolates toward about **0.917** at `vx=300 u/s`, increasing available world space somewhat. The example already includes this in the assumed projection; zoom alone does not remove the initial transition lag.

The bottleneck is therefore **transition latency and a vehicle-only edge guarantee**, not a missing signed vertical look-ahead feature. This is a source-based mechanism plus synthetic demonstration, not yet a verified runtime root cause. The actual engine's projection, authored slope, contact state and frame cadence could change the result.

## Smallest candidate

For a **separate, explicitly authorized implementation issue**, isolate a *render-only* vertical descent lead driven by raw or separately filtered downward velocity while retaining the existing ground/suspension window at rest. Preserve horizontal hysteresis, zoom, safe-edge clamps, camera reset/start behavior and physics tick ownership. Prefer a measured, direction-aware predictive vertical target over globally increasing camera speed or blindly changing `sink_rate`, which also affects landings and uphill settling.

Proposed experiment (not approved tuning): compare current A against one candidate on identical downhill and flat trajectories. Target for the 1280×720 45-degree synthetic descent at 0.5 s: **at least 0.75 s** of downhill track visible (vs modeled 0.36 s), while the buggy remains within both vertical safe margins. Also reject increased jitter on small bumps, reverse overshoot, a jump/landing snap or a large retry camera discontinuity. These are **proposed quantitative gates**, not claims of user-approved feel values.

## Runtime reproduction and acceptance

1. On an authorized x86-64 WSL checkout at the exact source SHA, run the existing documented commands: `python tools/gym/bundle.py --output artifacts/gym-bundle` then `python tools/gym/smoke.py --bundle artifacts/gym-bundle --output artifacts/gym/a19 --case a19` (and relevant `a19d`/ramps cases as available). **Not executed here.** Use existing downhill ramps (`ramps-long`, `down-30`) and a flat/straight control. No new level objects or geometry.
2. A subsequent **debug-only** read-only probe (in a separate approved PR) should capture on the same engine tick: `source_sha`, section, tick, chassis world position/velocity/contact, camera world position, `camera_follow.vy`, `camera_follow.ground`, zoom, projection `m00/m11`, and viewport pixels. Keep debug message payload below the existing 2048-byte limit; do not alter replay or physics. Avoid any write into a vehicle body.
3. For 1280×720 and a real tall/mobile viewport, derive `screen_x=(target_x-camera_x)/half_x*(pixel_width/2)` and `screen_y=(target_y-camera_y)/half_y*(pixel_height/2)` using **measured** `half_x=1/m00`, `half_y=1/m11`. Intersect the actual authored ground polyline in the travel direction with the viewport (rather than assuming a 45-degree line). Report visible forward ground distance/time, minimum safe margins, worst transient after crest, jump/landing and reverse.
4. Test baseline and candidate at 60-Hz fixed physics with 60-FPS and existing 30-FPS render replay. Keep existing A22 frozen trace assertions unchanged; compare actual physics outcomes, not just a camera screenshot. Run relevant real-input Gym and full current-head `required` CI. Maintainer drive test on steep descent and tall mobile aspect is a mandatory stop before accepting a camera behavior change.

## Verification and limits

- **Performed:** read-only audit of `feel.lua`, `controller.script`, preset A, `camera.camera`, `game.project`, existing Gym regression/ramps harness; standalone offline Python arithmetic port of the source's camera state update at 60 steps/s for flat, descent, reverse and airborne synthetic inputs. It yielded the table above.
- **Not run / not available in this task:** pinned Defold engine, Bob bundle, real browser Gym, live `camera.get_projection`, Playwright/phone screenshot, real slope intersection, native device, current-head CI. No benchmark, FPS, collision or physics result is claimed.
- **No production edits:** this document is characterization only. Its proposed future change must be independently reviewed and tested; this issue should not be treated as camera-fix acceptance without real engine evidence and human drive feedback.
