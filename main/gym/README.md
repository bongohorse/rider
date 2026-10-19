# Gym implementation notes

How the Driving Gym works and how each feature is tested. Binding rules: [physics contract](../../docs/contracts/physics.md), [vehicle contract](../../docs/contracts/vehicle.md), [engine pitfalls](../../docs/contracts/engine-pitfalls.md). Results and evidence: [STATUS.md](../../STATUS.md) and the linked PRs. Test commands: [TOOLING.md](../../docs/TOOLING.md#gym-tests).

**Contents:** [World and terrain](#world-and-terrain) · [Vehicle and controls](#vehicle-and-controls) · [Retry and recovery](#retry-and-recovery) · [Head sensor](#head-sensor) · [Rider visual reaction](#rider-visual-reaction) · [Telemetry, budget and graphs](#telemetry-budget-and-graphs) · [Tuning and presets](#tuning-and-presets) · [Audio](#audio) · [Feedback copy](#feedback-copy) · [Browser presentation](#browser-presentation) · [Touch and tilt](#touch-and-tilt) · [Public preview](#public-preview) · [Generated art](#generated-art) · [Stations](#stations) · [Ramps](#ramps) · [Steps](#steps) · [Seams](#seams) · [Gaps and landings](#gaps-and-landings) · [Custom levels](#custom-levels) · [Level editor](#level-editor) · [Test cases](#test-cases)

## World and terrain

- `/main/gym/boot.collection` boots; its proxy owns the `gym` world, initialized only after `proxy_loaded` (compatible with A20 proxy time scaling). `controller.script` is the sole physics owner. G1 stays `/main/main.collection` (`build --fixture physics`).
- Lengths are engine units; `physics.scale = 0.01` (100 units = 1 m). The chain binding scales vertices and ghost vertices itself: do not scale twice.
- A collision resource must contain a shape. In the safe initial update the owner removes the seed shape (index 1), verifies the body, then creates the chain and asserts the new shape is a chain segment. Shape indices change on creation (pitfall 4).
- Terrain chains enable `enable_sensor_events`; Box2D excludes shapes without it from sensor overlaps.
- Camera: orthographic Auto Fit; render-dt exponential following, signed velocity look-ahead (0.22 s, max 130 u), zoom 1 → 0.82 with speed. Checkerboard art is procedural test art.

## Vehicle and controls

- Three Defold-owned bodies (40 kg chassis, two 4 kg wheels, radius 22 u) and two wheel joints in the gym world. `vehicle.lua` applies all writes via the sole owner; input only records held actions.
- Commands are normalized throttle/brake/lean plus `allow_reverse`. Brake wins over throttle. With throttle released, speed below 8 u/s for 0.25 s latches reverse (8 rad/s) until brake release; retry clears the latch.
- Motors: active throttle/brake call `wake_bodies` first (setters do not wake, pitfall 2). Torque caps are binding-input units (1800 drive / 3000 brake), scaled once by the binding.
- Lean: A/D apply raw chassis torque (body torque is not scaled, pitfall 3): air assistance 48/72/96 N m (presets A/B/C, soft rate threshold 8/10/12 rad/s) and separate ground pitch assistance 120/180/240 N m (2.5 rad/s); either wheel contact selects ground. Thresholds stop adding same-direction torque; counter-steering stays possible. Not a moving centre of mass.
- Wheel targets A/B/C: 32/64/96 rad/s (7.04/14.08/21.12 m/s theoretical); slider range 8–140 rad/s. Actual top rolling speed is capped near 10 m/s by Box2D's rotation limit ([#114](https://github.com/bongohorse/rider/issues/114)).
- Coasting (A13a): neutral grounded wheels keep zero-speed motors with `coast_torque` (default 400) plus wheel-only `rolling_resistance` (0.15 N m s). Target: 5 m/s to below 0.1 m/s within 6–15 m; a brake tap settles within two seconds.
- HUD/report speeds are m/s and km/h; history keeps engine units.

## Retry and recovery

- R queues one generation-tagged request; duplicates coalesce. The owner consumes it outside contacts: clears held commands, keeps the three bodies, destroys both joints (old handles invalid), disables/re-enables the bodies to clear old contacts, restores canonical pose and zero velocities on **both** GO and body (dynamic GO transforms overwrite body-only resets, pitfall 1), wakes bodies and recreates the joints. Terrain is unchanged; no collection reload.
- Still-held keys do not resume driving; a fresh press does. Camera, history, metrics and UI reason reset.
- Safety bounds come from each station file. Leaving them uses the same reset path with a reason label. No camera-exit, inactivity, stuck or timer reset.
- The first station start after attach calls the same `vehicle.reset` before applying the authored speed.

## Head sensor

A placeholder rider (`tools/art/rider.py`) has a script-created zero-density sensor circle at chassis-local (0, 56), radius 12 u; no ragdoll or solid head. Own bodies are excluded from overlaps. C or the overlay toggles the crash rule (default off: display only, red rider; on: reason-labelled retry). Overlaps are read in `fixed_update`; after a retry two completed-step reads are skipped. The filter table needs all three fields including `group_index = 0`.

## Rider visual reaction

The rider sprite is a child GO of the chassis pivoting at the hip (A15a). The owner only reads chassis velocity/spin changes in chassis space; each frame applies them as kicks to a damped spring per axis (`feel.rider`: 3 Hz, damping 0.55): acceleration leans back, braking leans forward, vertical changes bob/squash, airborne lean input biases the angle. Clamped to ±5/±8 u and ±0.25 rad; retry resets it. No physics writes; the head sensor stays on the chassis.

## Telemetry, budget and graphs

- `telemetry.lua` is read-only: speed and signed vx, wheel contacts, signed spring travel along chassis Y (positive = compression; no hard stop exists), FPS/frame interval over 0.25 s and `profile.step` (engine ms, not a device benchmark).
- `budget.json` (custom resource): 60 FPS / 16.666667 ms target; physics budget unset until Phase E. Breaches show red. Means can hide stutter.
- `history.lua` keeps at most 301 samples (5 s at 60 Hz) in 50 min/max buckets per signal; retry/preset clears it. Graphs render every bucket spike; FPS colours ≥55 green, 30–54 orange, <30 red.
- Compact HUD (A13b): FPS, speed, contact dots, spring travel and a 200×80 graph; tuning (T) and help (H) start closed; retry reasons are 1.5 s toasts. In narrow portrait tuning hides the graph.
- Debug scenarios (`scenarios.lua`) load only for a configured test; the module is still packaged in release (exclusion is Phase B work).

## Tuning and presets

- `feel.lua` owns all drive/spring/camera values and slider bounds; geometry and bounds are not tuning. Eleven sliders: spring Hz, damping, wheel target, motor cap, air lean, air rate, ground lean, camera response, look-ahead, coast torque, rolling resistance. The owner validates and applies changes live (spring changes wake bodies once).
- During a slider drag gameplay commands are zeroed; held input clears on capture and release.
- `presets/a.json`, `b.json`, `c.json` (schema 1) hold complete value sets; A is the baseline, B/C progressively stronger. P cycles; chips select; selection performs a canonical retry. `?preset=b` opens B; invalid values fall back visibly to A. Live edits show Modified.

## Audio

`engine.wav` is an original 0.4 s loop (`tools/art/engine_loop.py`, CC0). One voice starts after the first gameplay input, follows average wheel speed (playback 0.65–2.2) and survives retries; M mutes. Never autoplays. Gain/speed are component properties (`go.set`), not `sound.set_speed`.

## Feedback copy

F or Copy feedback formats Markdown with source SHA, preset, station, velocity, contacts, travel, FPS/profile, crash rule, tuning and station results. HTML5 uses `navigator.clipboard.writeText` after the gesture and reports success only when it resolves; otherwise a selectable read-only fallback appears. Native builds show the report. F respects Ctrl/Meta/Alt shortcuts.

## Browser presentation

The page fills the viewport. High DPI ON uses the device pixel ratio, OFF one buffer pixel per CSS pixel (`?dpi=0|1`, reload). Resize, rotation and fullscreen keep the world. Auto Fit keeps world proportions. GUI panel roots own edge anchors and safe-area adjustment; children share their root's FIT space. Slider picking converts `action.screen_x/y` with `gui.screen_to_local`.

## Touch and tilt

- `mobile.js` owns DOM pointer capture, four simultaneous zones, mirrored layouts A/B, the compact touch toolbar and the 30 s capture; `mobile.lua` polls its normalized state into the same commands. Resets, UI capture, blur and rotation clear pointers and keys. Touch unlocks Defold's shared audio context in the trusted gesture. `?touch=1|0` forces the mode.
- `tilt.js` (opt-in, default off) listens after the user enables it, requests permission when needed and maps beta/gamma to a screen-horizontal angle (W3C Z-X-Y). Calibration, full-lean angle, dead zone and inversion map to [-1, 1]; touch/keyboard lean take priority. Retry, UI capture, focus loss and view changes require recalibration. Denial, missing first data (3 s) or invalid samples fall back visibly to touch.
- Browser runners wait for engine acknowledgements before the next press (pitfall 5), including two fresh telemetry updates after fullscreen changes. Phone procedure: [MOBILE_TRIAL.md](../../docs/MOBILE_TRIAL.md).

## Public preview

The CI `preview` job builds an HTML5 release (Bridge cleared) into `builds/<sha>/<run-id>-<attempt>/`. The root loader fetches `build.json` (no-store), validates SHA/path and redirects with query and fragment. The first 12 SHA characters show in-game. The page exposes only read-only build/READY diagnostics. Deployment: [TOOLING.md](../../docs/TOOLING.md#preview-deployment).

## Generated art

`tools/art/wheel.py` builds `assets/wheel.svg`, a 3× `wheel.png` (144×144) and `wheel.sprite` (48×48) from the collision radius; Bootstrap CI checks centroid, silhouette diameter against the collision radius and mirror symmetry (`--check` verifies regenerated bytes). Add circular vehicle graphics to `ROUND_ASSETS`. Rider art: `tools/art/rider.py`.

## Stations

- `stations/*.json` (schema 1) in world metres: id and name (at most 64 bytes each, as are section ids and names; they travel in every telemetry message), spawn [x, y], `start_speed` (-30..30 m/s), run-in/run-out, safety bounds, right-to-left chain polylines, optional convex CCW hulls (3–8 vertices), `labels` and `sections` (id, spawn, start speed, mode, measurement extents). The whole file validates before terrain creation; unknown ids fall back visibly; bad files fail without replacing the world. Keep segments at least 1 cm.
- `stations.lua` owns selection, data, terrain, markers and unit conversion; the controller starts and retries the vehicle. Start translates all three bodies with the authored speed and matches wheel spin.
- Switching serializes disable/final/unload → `proxy_unloaded` → load → `proxy_loaded` → init → `gym_ready` (15 s failure diagnostic). Preset identity survives; modified sliders reset.
- Selection: keys 1–9, Next station, `?station=<id>&speed=<m/s>&section=<id>`; V / Next section switches sections in the same world; R retries the current section. Test-only stations exist only in the debug runner.
- Release rendering uses ordinary sprites for edges, hulls and ticks (debug lines are absent in release); at most 800 render objects per station; sprite/label pools are 1024.
- Metric observers (`ramp_metrics`, `step_metrics`, `seam_metrics`, `gap_metrics`) are read-only and called by the owner. Measurement never stops or resets practice. Results persist across section retries only with matching full tuning and start speed; a live tuning change makes a run non-comparable.

## Ramps

`ramps` (1 m kick ramps) and `ramps-long` (4 m climbs): 5–45° in 5° steps, 60° and a 12 m wall. Up sections start at 8 m/s; `down-<angle>` sections start neutral at 1 m/s. Climb = chassis clears the crest by 0.46 m and stays 0.3 m above the surface; failure after a 1 s stall or 6 s without clearance. Descents report contact share and speed change. Debug `ramp_trial.lua` supplies constant commands from the first step (up: full throttle; down: neutral).

## Steps

`steps` / `steps-down`: 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5 m, each followed by 12 m flat; independent starts 4 m before the edge at 5 m/s. Results: approach/entry speed, input ranges, peak compression per wheel (window from 0.8 m before the edge), chassis and underside contact (impulse at local y ≤ -13 u). CLIMBED/LANDED needs rear wheel past the edge, chassis above the surface, pitch < 0.8 rad and 0.25 s wheel contact; otherwise STUCK. `section=stop-probe` repeats 0.2 m with disclosed wheel limits [-0.20, +0.18] m; normal sections keep limits disabled.

## Seams

`seams-chain` (key 6) and `seams-hull` (key 7): 20 seams on flat ground, speeds 5/7/9 m/s. Protocol, thresholds and reproduction: [A18 protocol](../../docs/A18_SEAM_PROTOCOL.md).

## Gaps and landings

`gaps` (key 8): 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10 m; `gaps-landing` (key 9): 2 m with flat, 15° downslope and 15° upslope landings. Each section starts 2 m before a 15° chain ramp to a 1 m lip over a pit 3 m below ground; default 7 m/s, `&speed=9` for comparison. Protocol (debug `a19`): full throttle, no brake/lean. Takeoff = both wheels past the lip and unloaded; jump distance = first loaded wheel x minus lip x; cleared = both wheels loaded on the landing side with |pitch| < 0.8 rad for 0.25 s; missed = chassis 0.6 m below the deck, 1 s stall or 8 s; a touchdown up to one wheel radius short is `edge_strike`. Repeat tolerances: takeoff 0.02 m/s, distance 0.05 m, compression 5 mm, same status.

## Custom levels

- `?station=custom` loads the last valid imported level, or shows the Import panel. **I** or **Import level** (page button; in touch mode the toolbar button) imports a station JSON file or pasted JSON (schema 1, no `kind`). Rules, save files and limits: [level-editor contract](../../docs/contracts/level-editor.md#custom-level-runtime-and-save-le1a).
- The loader (`boot.script` + `custom.lua`) validates, freezes a snapshot and reloads the world; the world reads the snapshot by id. Retry, bounds reset, keys 1–9 and presets behave as for built-in stations. Custom levels never get the Straight checker background.
- Samples for drive tests in `samples/`: `rolling-hills` (chain-only, seven 1.2 m hills), `kicker-platform` (15° kicker, 2 m pit gap, landing on a hull platform, start 7 m/s) and `invalid-bounds`, which must fail with `Import failed: Invalid safety bounds. The current level and its save are unchanged.` `seg-800` and `len-99km` are the largest LE1b levels (generated by `tools/gym/levels.cjs`, checked by `tests/ci/levels.test.cjs`).
- The feedback report (F / **Copy report**) has a `Level load` line: trigger → drive-ready switch, parse, terrain and decoration times in whole milliseconds (`<1 ms` below the HTML5 clock step, `n/a` without a trigger such as a page load) plus terrain shapes and decoration sprites/labels. Measurements: [LE1b report](../../docs/LE1B_REPORT.md).

## Level editor

- **E** on any station opens the editor: a built-in station as a template copy (`my-<id>`), a custom level as itself. **E**, **Enter** or **Play** compiles and drives from START; **E** while driving returns to the editor view; **R** only works while driving. Rules and controls: [level-editor contract](../../docs/contracts/level-editor.md#editor-shell-le2).
- Drive test: open `ramps`, press **E**, drag START, choose **FINISH** and click on the ground, press **E** and drive through the flag (`Finish reached` once per attempt). Back in the editor, point at the terrain and press **F** for a temporary test start (Shift+F drops at the cursor).
- **Draw [D]** places snapped points (0.5 m grid, Alt 0.1 m, Shift 15°, Ctrl off, G grid on/off); click the last point or press Enter to finish. Starting or ending on a free line end (green ring) connects the pieces; a connected run becomes one chain. Drag a line to move its run, drag a point to reshape; a moved exit point carries the downstream run along. Double-click inserts a point, K splits, J connects/disconnects (Shift+click a second free end to bridge a gap with a new piece), Tab cycles what is under the cursor. Overhangs and curls are allowed: a run that turns back in x collides on both sides. Rules: [draw tool and connections](../../docs/contracts/level-editor.md#draw-tool-and-connections-le3).
- LE3 drive test: draw a run-up, a ramp starting at its end, a gap and a landing; place FINISH; drive it. Then drag the joint between run-up and ramp (the ramp follows), Undo/Redo, and drive again.
- **My levels (LE4):** **New** starts an empty level, **Open** lists My levels (newest first; Delete asks once more) and the built-in templates, **Rename level** (right panel, nothing selected) edits the name. Every edited level is saved in the browser; a template or file copy joins My levels at its first edit. **Export** downloads the playable level as JSON (Play-blocking errors block it too); **Import** opens a file as a copy. **Ctrl+C / Ctrl+V** copy a selection and paste it at the cursor (connections inside the copy are kept); **Duplicate** places a copy to the right. Rules: [document management](../../docs/contracts/level-editor.md#document-management-le4).

## Test cases

`python tools/gym/smoke.py --case <id>` (HTML5 debug gym):

| Case | Checks |
| --- | --- |
| `a1` | Chain support (probe rests at y = 95 ±2 on y = 80), camera follow |
| `a2` | Real keyboard drive and braking with brake priority |
| `a3` | 100 resets incl. bounds recovery, joint invalidation, sleep re-drive, timing |
| `a6` | Reverse, airborne lean, camera direction/zoom |
| `a7` | Head contact off/on via C and overlay click |
| `a8` | Live spring change without reset, neutral release |
| `a9`, `a9invalid` | Preset by URL and chips; invalid fallback |
| `a10` | Silent before input, one voice, wheel-dependent speed |
| `a11` | Clipboard readback and denial fallback |
| `a12` | Graph spike with disclosed test wheel limits, expiry |
| `m2feedback` | Ground/air assistance, preset C above 8 m/s |
| `coast` | Coasting distance and brake-tap settle |
| `hud` | FPS colour boundaries (55/54/30/29) |
| `a15` | Speed start (8 ±0.2 m/s), retry, A → B → A, invalid station/URL |
| `a15a` | Rider lean/bob bounds and return to rest |
| `a16`, `a17`, `a18`, `a19` | Ramp, step, seam and gap protocols above |
| `le1a` | Custom import A → invalid → B → A (equal shape/sprite/label counts), held input, queued import, retry/bounds, reload restore, injected save failure, build failure, 64-byte id/name limit, ±500 m start limit (placements with Retry, 6000-start reset sweep, validator and load-path rejection), real placement failure (no save, no vehicle bodies, re-import), all text fields at their byte limits in one telemetry message, exhausted storage-sync retries |
| `le1b` | Custom level size/performance: generated length, start-distance, segment, chain and hull series; 1 + 5 imports each (switch time), 6 s full-throttle window (frame intervals, callback work, Box2D profile/counters, memory), rejected limit messages. Writes `sizes-result.json` and `sizes-report.md` ([report](../../docs/LE1B_REPORT.md)) |
| `le3` | Draw tool: blank template, ramp–gap–landing course on the grid with a connected ramp, drive to FINISH (one chain per run), joint drag with Undo/Redo, run and multi-select moves (each run once), insert/split/disconnect/Tab cycle/connect/delete point, Alt/Shift/Ctrl/G snapping, crossing and doubling-back errors, box selection (crossing/contained/outside), bridging two separated ends with Undo/Redo, template change while drawing, draft reload with connections, a two-sided curl driven past its turn-back point (one-sided control falls through), editor budget at the 800-segment sample, drafts above the sprite budget (1101 and 7245 points) open, edit and restore |
| `le4` | My levels and documents: New, name field (editor and game keys only type), copy/paste of a connected passage (new ids, internal connection kept, none outside, no START/FINISH) and Duplicate with Undo/Redo, change → reload → drive, template copy joins My levels at its first edit, open/Undo/Redo between levels, Export blocked without terrain, export → import round trip (equal source, same compiled fields on Play), stale compiled data opens the source, changed compiled data offers the R1 choice (both ways), an unknown editor version opens as lines and an unsupported My levels slot stays unchanged, failed My levels and draft saves keep the previous copies (retry before switching, reload restores), Delete confirmation, GUI node budget, no editor input behind the Export panel, Esc cancels a rename, an unreadable index stays unchanged and blocks writes (switch refused, repeat continues), a failed draft write or storage sync refuses switching until the retried save or a good sync |
| `le2` | Editor shell: template copy, Edit-mode input gating, START drag with Undo/Redo, focus loss, FINISH once per attempt/direction/high speed, test starts and refusals, Edit/Play loop counts, draft reload (also of another level), bounds with left-to-right lines, all templates, unsupported version |

Release behavior (keyboard, touch, tilt, stations, screenshots) is verified by `tools/preview/*.cjs` in CI.
