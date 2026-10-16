# Gym implementation notes

A1 boots `/main/gym/boot.collection`, whose proxy owns the `gym` world. The controller is the sole gym physics owner. G1 remains `/main/main.collection` and is selected explicitly by the physics runner / `build --fixture physics`.

All geometry/camera lengths are engine units; at the existing `physics.scale=0.01`, 100 units correspond to one metre. The pinned chain binding scales vertices and ghost vertices itself: do not scale twice. The right-to-left flat chain has its front face above the floor. A falling radius-15 probe must rest at y=95 ±2 on y=80 before the A1 smoke passes. A follow-target move is checked separately; this is not a gameplay acceptance.

A collision resource must contain a shape (`resources/box2d/res_collision_object_box2d.cpp`). During the safe initial update the owner removes the sole seed shape at index 1, verifies the borrowed body remains valid, then creates the chain; it asserts that the resulting shape is the chain segment. Shape indices are not stable across creation: a first smoke caught deletion of the chain when index 1 was used after creation. Defold owns the static body/chain lifetime; session references are discarded on finalization. Geometry creation is not performed in contacts.

Sources actually consulted: Defold 1.14.0 / `a81dbb0478e8b73931dc2d671563204f6ac0ef82`, `script_box2d_chain_v3.cpp` (scaled vertices, open ghosts, world-lock checks), `script_box2d_body_v3.cpp` (shape indices/ownership), collision resource loader above, `camera_ddf.proto`, `sprite_ddf.proto`, `atlas_ddf.proto`, collection-proxy and camera manuals. The camera uses orthographic Auto Fit; the proxy is initialized only after `proxy_loaded`. This keeps the world compatible with later proxy time scaling without implementing A20 early.

`python tools/gym/smoke.py --output artifacts/gym/a1 --case a1` builds the HTML5 default gym with a unique run ID/source SHA and requires a complete matching runtime result plus a browser screenshot. Synthetic browser evidence does not prove physical-phone input or performance. Checkerboard pixels are original procedural test art, not production assets.

## A2 vehicle baseline

The controller creates three Defold-owned bodies, waits one update, then creates two wheel joints in the same gym world. Keyboard input only records held actions; the sole fixed owner normalizes throttle/brake commands and applies motors. Brake wins if both are held. Up/W throttle; Down/S brake. Coasting disables the motors. Reverse/air lean and camera feel are M2, not silently included in A2.

Source consulted at the same pinned engine commit: `script_box2d_joint_v3.cpp`, `Joint_CreateWheel`, `Joint_SetMotorSpeed`, `Joint_SetMaxMotorTorque`; `script_box2d_body_v3.cpp`, body position/angle/velocity/contact data. Anchors remain engine units, wheel speed rad/s, spring hertz Hz and damping dimensionless. Torque caps are explicitly named binding-input values (1800 drive / 3000 brake), scaled once by the binding; no claim that the final feel is approved. Body masses are 40 kg / two 4 kg wheels in their resources.

`--case a2` uses actual browser keyboard events after 60 settle ticks: throttle for 180 ticks, then brake while throttle stays held for the first 60 braking ticks. Predeclared checks: forward distance >150 units and speed >100 units/s; max chassis angle <0.6 rad throughout; after 120 braking ticks |vx|<12 units/s; both wheels have actual contacts; camera x follows within 12 units. Input actions go through normal on_input/normalized-command handling, not direct pose writes. The A1 probe remains independently runnable with `--case a1`.

## A3 retry lifecycle

R queues one generation-tagged request; duplicates coalesce. The sole fixed owner consumes it outside contacts, clears held commands, retains three validated bodies, destroys both tracked joints (old handles must become invalid), restores canonical pose/zero linear and angular velocity, wakes bodies and recreates disabled-motor joints. The static chain remains unchanged. Any assertion failure leaves retry paused with a script diagnostic. There are no async retry timers/listeners or collection reloads. Fresh key presses resume control; still-held keys do not. UI reason and camera return to the canonical start. The boot loader counts actual proxy loads.

Trial bounds: x outside [-3900,7900] or y below -500 engine units. These margins sit inside the authored floor ends. There is no upper-y, camera-exit, inactivity, stuck or elapsed-time rule. Retry always returns to the gym spawn; stations and touch Retry arrive in their planned issues.

Pinned source additionally consulted: `script_box2d_body_v3.cpp` set_transform/set_linear_velocity (binding scales once), angular velocity (rad/s), set_awake and get_joints; `script_box2d_joint_v3.cpp` destroy (tracked joints only, world-lock rejection, handle invalidation); LuaSocket `timeout.c` and HTML5 module registration (`socket.gettime`, wall-clock seconds). Body transforms are only for explicit retry or the test's disclosed out-of-bounds fault injection.

`--case a3` retains A2 checks, presses R while throttle is held, then executes 100 total resets through the same request/consume path. Reset 50 is actual configured bounds recovery after a test-only below-floor injection. Every reset validates poses/velocities, retained bodies, replaced joint invalidity, new joints and unchanged terrain. It checks one proxy load, the GUI bounds label acknowledgement, no resumed held command during 120 settle ticks, and fresh keyboard drive over 120 ticks. Reports min/p50/max synchronous operation time and max request-to-READY latency in wall-clock milliseconds; these are not rendered-frame latency, phone performance, or a preapproved budget. Timing samples are retained only in test mode.

Reset source follow-up: pinned `engine/engine/src/engine.cpp` defaults `physics.allow_dynamic_transforms` to 1. `engine/physics/src/physics/box2d/box2d_physics.cpp`, StepWorld2D, copies GO transforms to dynamic bodies before stepping. Retry therefore synchronizes both owning GO pose and body pose, preserving sprite z, and the smoke checks persistence on the next tick. Initial body-only reset/fault injection was rejected by the runtime test. The bounds fault injection likewise moves both representations.

Browser input synchronization: the smoke holds R until the controller confirms manual retry, and waits for the engine-observed throttle release before a fresh press. Same-frame down/up pulses are not treated as reliable sampled engine input. The first retry must be manual; an incidental bounds reset cannot substitute for it.

The re-drive interval begins only after the engine observes the fresh throttle press, so browser/runner input delivery delay is excluded from the declared 120 driving ticks.

Sleep follow-up: Box2D 3.1.0 `src/wheel_joint.c` motor enable/speed/torque setters do not wake sleeping bodies. Pinned Defold `script_box2d_joint_v3.cpp` forwards those setters and exposes `wake_bodies`. Active throttle/brake now wakes the connected bodies before applying motors; coasting still permits sleep. The post-reset smoke explicitly requires all three bodies asleep before the fresh press, then requires actual travel over 120 commanded ticks. Initial warm-spawn driving alone missed this behavior.

## A4 public preview

CI's `preview` job builds the exact PR-head/main SHA as an HTML5 release with the native Bridge dependency cleared. It packages all bundle files inside `builds/<full-sha>/<run-id>-<attempt>/`, tests the release loader/runtime on desktop and a 20:9 phone viewport, and uploads the deployable Pages artifact. `required` now includes this preview job. Only `main`, after `required` succeeds, can call the deployment workflow with Pages/OIDC write permissions. Other jobs retain contents-read. A manual run of **CI** on `main` follows the same checks and deployment. Pages must use GitHub Actions as its source.

The public root loader fetches a cache-busted `build.json` with `cache: no-store`, validates its SHA/path, then redirects to the per-build directory (including manual rebuilds of the same source) while preserving query and fragment. Engine, scripts and archive files inherit that unique full path. The current commit's first 12 characters appear in-game. Existing versioned tabs remain that build; reopen the root URL for the current build. The page exposes only read-only build/READY diagnostics for the release smoke, no world mutation/debug service. Keyboard remains the M1 interface; actual phone loading/visibility awaits Claudio, and touch driving is A13.

Sources consulted: official `actions/starter-workflows/pages/static.yml`; configure-pages v5 `action.yml`/`src/api-client.js` (existing Pages site; no enablement token requested), upload-pages-artifact v4 and deploy-pages v5 `action.yml`; action tag refs resolved to the committed SHAs. Pinned Defold `engine/script/src/script_html5_js.cpp` confirms HTML5-only `html5.run`, synchronous string JS evaluation; only JSON-encoded build/READY data is assigned. Existing GUI text/font API retained. Public post-deploy verification checks the actual SHA and READY on both viewport configurations and stores screenshots/browser version. Browser emulation is not physical-phone evidence.

## Pre-M2 wheel art correction (#45)

`python tools/art/wheel.py` reads the circle radius from `wheel.convexshape`, constructs centred circle/rectangle SVG primitives, and exports `assets/wheel.svg`, a 3× RGBA `wheel.png`, and `wheel.sprite`. The same SVG primitives are rasterized by the deliberately small circle/rectangle renderer using Pillow 12.3.0 (developer/CI dependency only). No external SVG engine or runtime drawing dependency is introduced. At radius 22, the solid visual diameter is 44 engine units, with a 48-unit transparent canvas. The texture is 144×144; manual sprite size stays 48×48, preserving the body's scale, mass, joints, spring and motor parameters. Spokes and hub are mirror-symmetric, allowing rotation/slip inspection. High-resolution subpixel coverage is reduced with BOX filtering to avoid ringing halos.

The old 48×48 inclusive ellipse occupied pixel indices 2..46, centring alpha at (24,24) instead of (23.5,23.5), and a 45-pixel silhouette exceeded the collision diameter by one unit. Pixel-boundary SVG coordinates plus an inclusive-end correction in the rasterizer remove both errors.

Bootstrap CI measures the actual committed alpha centroid (≤0.25 source pixels from canvas centre), the 50%-coverage silhouette diameter against the collision radius (≤0.25 engine units), interior mirror symmetry, and centroids after sample rotations. It also rejects the former off-centre asset and a centred oversized negative fixture. `--check` verifies regenerated SVG/sprite bytes and decoded PNG pixels; PNG compression bytes can differ across OS/zlib versions. Add future circular vehicle graphics to `ROUND_ASSETS` to apply the same contract. These are pixel/geometry checks, not a claim of physical-device appearance.

Official references consulted: Defold sprite manual (manual size and centred display), pinned 1.14.0 `sprite_ddf.proto` SizeMode/size, and `comp_sprite.cpp` component creation: pivot defaults to (0.5,0.5), manual mode uses resource size; Slice9 is disabled when its margins are zero. This allows a 3× texture without scaling the physics GO. Pillow 12.3.0 distribution metadata/version was verified from PyPI. Existing physics contracts are unchanged.

## A5 measurements

The controller remains the only fixed-tick owner. `scenarios.lua` contains the A1/A2/A3 fixture orchestration, all original predicates, input acknowledgements and A3 fault injection. It is loaded only for an explicitly configured debug scenario. Release packaging still contains its compiled module through Defold's static require discovery, but cannot activate it; physical exclusion needs a build-time resource split and is deferred rather than silently dropping smoke coverage.

`telemetry.lua` is read-only: actual linear speed magnitude and signed vx (engine units/s), touching wheel contacts, signed spring translation on the chassis-local Y axis (engine units), average update FPS/frame interval over 0.25 seconds, and the last completed world's `profile.step` in milliseconds. This is engine profile time, not Lua callback time or a device benchmark. No hard suspension stop exists yet; travel is displacement from the authored zero-length spring anchor, positive in compression, not a percentage of an invented limit.

`budget.json` is a bundled custom resource. Initial target is 60 FPS / 16.666667 ms mean frame interval; physics budget is unset until A13 device measurements. Budget breaches show red. Means can conceal individual stutters; A13 must measure actual pacing separately. The GUI acknowledges displayed measurements to the smoke, which checks both floor contacts, finite plausible spring travel, profile availability and the loaded budget classification in addition to all A3 predicates.

Sources read: pinned Defold 1.14.0 `script_box2d_body_v3.cpp` (`get_local_point`, `get_position`, velocity, contacts and world); `script_box2d_joint_v3.cpp` (`get_joint_translation` rejects wheel joints, hence geometric projection); `script_box2d_world_v3.cpp` (`get_profile.step`, no scaling); upstream Box2D v3.1.0 `include/box2d/types.h` (`b2Profile` times in ms). Positions are converted by the binding once; telemetry performs no second physics conversion.

Bundling follow-up: pinned Bob 1.14.0 `com/dynamo/bob/meta.properties` declares `custom_resources` in `[project]`; an initial `[resource]` entry compiled but omitted the JSON and correctly failed both browser suites. The bootstrap regression checks the real section/path. Pinned `script_sys.cpp` verifies `get_engine_info().is_debug`; `script_json.cpp` documents JSON null decoding to nil by default.

## A6 feel trial

`feel.lua` owns all drive/spring/camera values; authored shape/mass resources and recovery bounds are geometry/safety, not hidden tuning. The initial A6 16 rad/s wheel target is superseded by the #61 candidates below; A retains the 1800/3000 binding motor caps and 5 Hz/0.8 spring baseline. Engine-unit positions/velocities and joint cap inputs pass unchanged through the named adapter; body lean torque is raw N m (the pinned body binding does not scale it). Display conversion to metres uses physics.scale once, outside the physics setters.

Down/S brakes first. With throttle released, speed below 8 units/s for 0.25 seconds latches reverse at 8 rad/s until brake release; simultaneous pedals remain brake-only. Reverse latch clears on retry. A/D applies the separate ground or airborne pitch assistance described under #61 below. Soft rate thresholds stop adding same-direction torque; counter-steering remains possible. These are trial values, not accepted feel.

Camera uses render-dt exponential following, signed velocity look-ahead (0.22 s, capped at 130 u), and zoom from 1 to 0.82 with speed. Retry restores position and zoom. The A1 direct focus probe remains separate. A3 still tests full braking and brake priority by keeping both pedals held through its stop observation, then retry while throttle is held. A6 separately releases throttle while brake remains held and requires actual reverse distance/speed; its disclosed debug-only +400 u lift then checks rotation under real keyboard lean during flight. It checks camera direction/symmetric zoom and applied camera property, not 60/144 Hz visual smoothness acceptance.

Additional pinned sources actually read: body `apply_torque` forwards unscaled torque and wakes; joint `set_max_motor_torque` scales its binding input, wheel spring setters are supported. Pinned `comp_camera.cpp` exposes `orthographic_zoom` as a writable camera property. No new simulation owner or manual step.

## A7 head-contact trial

A geometric original placeholder rider is attached visually to the chassis (reproducible `tools/art/rider.py`). Its head circle at local (0,56), radius 12 u is a script-created zero-density sensor; no extra rigid body/ragdoll or solid head collider is added. Creation verifies unchanged chassis mass. Own wheels/chassis are excluded from overlaps by their borrowed body handles. C or the clickable overlay toggles the rule, default OFF. Off displays contact/red rider; on queues the same reason-labelled in-world retry as R/bounds. Retry retains the sensor on its retained body, asserts exactly two chassis shapes, clears contact and skips two completed-step overlap reads to avoid stale pre-reset data.

Pinned 1.14.0 sources read: body `create_shape` returns a shape-info table including shape_id; shape `CheckShapeDef`, `CheckShapeCreateDef`, `enable_sensor_events`, `get_sensor_overlaps`, `get_body`, `is_valid`. Circle positions/radii are scaled inside the binding. The owner reads overlaps in fixed_update outside callbacks, and consumes resets there; rendering only tints the sprite. No mutation in contact callbacks.

A7 smoke uses a disclosed debug-only inverted canonical pose held with test-only zero gravity to create head/floor overlap until the GUI acknowledges its display (gravity restored after recovery): requires off to detect without resetting, actual C input to enable a reason-labelled reset with retained sensor/no shape leak, and an actual overlay mouse click to disable. A3's 100 resets now also check sensor validity/shape count. Fairness, real touch and final art remain Claudio's later drive test; the synthetic probe is not challenge acceptance.

Sensor binding follow-up: `CheckFilterData` requires all three numeric fields, including `group_index=0`; unlike the terrain chain definition it does not default this field when a filter table is supplied. CI rejected the omitted field before any sensor acceptance.

Tint follow-up: the pinned sprite module has no `sprite.set_constant`; use `go.set(sprite_url,"tint",value)`. Pinned `CompSpriteSetProperty` routes material constants via `SetConstant`. CI rejected the obsolete call; no failure was waived.

Release verification now requires two further owner-to-GUI telemetry sequences after initial READY. Release engines can suppress diagnostics, so READY plus a static screenshot alone did not establish a continuing controller; the new progress assertion closes that observed verification gap.

Sensor participation follow-up: pinned Defold chain creation forwards `enable_sensor_events`; upstream Box2D 3.1.0 `src/sensor.c` excludes visitor shapes with sensor events disabled. The authored terrain chain now explicitly enables this flag and asserts it on returned segment handles. Enabling the sensor alone was insufficient and the focused test timed out as intended. Physics geometry/contact assertions are unchanged. Failed browser runs now retain a screenshot and last GUI telemetry for diagnosis.

A7 input follow-up: the browser now holds overlay mouse-down until the engine acknowledges the switch, then releases at completion. An immediate same-frame down/up pulse was not a reliable sampled Defold action (the same boundary already applies to keyboard retry). The observer no longer reinjects the inverted pose after the normal owner has already consumed the C-triggered reset; the one-reset assertion stays intact.

## A8 live tuning

Nine sliders edit spring Hz, damping ratio, wheel target rad/s, motor cap (binding units), air lean N m, air rate rad/s, ground lean N m, camera response 1/s and look-ahead seconds. Bounds/labels live with tuning in `feel.lua`; geometry and unknown/invalid/non-finite values cannot be edited through the command. GUI sends messages, the sole fixed owner validates/applies them and acknowledges current values. Changed spring settings wake bodies once and update existing wheel joints; no reset/reload is needed.

During a captured drag, gameplay commands are zeroed and held input clears on both capture/release. Release outside the track is handled by the captured pointer path. Layout uses the existing 960×540 fit GUI; reference-phone touch and lifecycle testing remain M3. Required A8 smoke holds real mouse input, changes spring Hz to 12, checks the actual joint getter without reset/reload, attempts throttle during capture and requires neutral release. Test routing now lives entirely in `scenarios.fixed`, still called only by the sole physics owner.

Pinned source consulted: wheel spring hertz/damping setters/getter and `wake_bodies` in `script_box2d_joint_v3.cpp`; existing GUI pick/text/box APIs used. No custom world/tick owner.

## A9 candidate presets

All drive/camera values now live in `presets/a.json`, `b.json`, `c.json` (schema 1); geometry stays authored separately. A preserves the prior baseline, B and C progressively increase wheel target/torque, spring/lean strength and camera anticipation. These are comparison candidates without an assumed winner. Keys 1/2/3 or overlay buttons select a complete replacement and canonical in-world retry, clearing held input and preserving one world. Live edits show Modified; reselecting any preset restores its data.

`?preset=b` opens B; only a/b/c are valid file selectors. An invalid query visibly falls back to A. The loader validates schema, numeric/finite values and the complete field inventory. GUI receives only flat numeric slider snapshots. Pinned `script_html5_js.cpp` was read: html5.run returns the evaluated result as a string and throws on JavaScript errors. URLSearchParams is used only on HTML5; native launch defaults to A or explicit rider.preset settings.

Required A9 browser runs select B by URL and test invalid fallback separately. Each then uses actual 1/2/3 key events to drive all three candidates for 120 observed throttle ticks, checks travel/angle and actual spring replacement, and requires exactly three retries with one world load. Existing A3/A6/A7/A8 cases remain mandatory. Real-device feel and winning values remain Claudio's test.

## A10 engine audio

`engine.wav` is an original seamless 0.4 s mono PCM placeholder generated from integer-cycle sine harmonics by `tools/art/engine_loop.py`; CC0-1.0 provenance is beside the file. No external sample/dependency. One sound voice starts after the first gameplay input, stays across retries/preset switches, and stops explicitly on final. Actual average absolute wheel angular speed sets playback ratio from 0.65 to 2.2, including reverse/airborne wheel spin. M or the overlay mutes it; it never autoplays at page load.

Pinned Defold sources read: `script_sound.cpp` sound.play/stop; `comp_sound.cpp` writable gain/speed and their getters (there is no sound.set_speed); `sound_ddf.proto` looping; `engine/sound/src/js/library_sound.js` shared AudioContext resume/state. Required A10 browser smoke checks silence before input, one voice, increased wheel-dependent speed property, and a running AudioContext after initial throttle without waiting for key release. Browser errors remain fatal. Headless automated playback is not a human listening/device-audio acceptance; Claudio's M2 test includes that check.

## A11 feedback copy

F (a real browser key handler) or Copy feedback uses the latest acknowledged measurements to format Markdown with source SHA, preset/Modified, flat-gym station, signed velocity/speed, contacts, signed travel, FPS/mean frame/profile step, crash rule and nine live tuning values. The action clears held gameplay input; opening the fallback captures commands until close. It never creates/sends an issue.

HTML5 calls navigator.clipboard.writeText only after the action. Success is shown only after its promise resolves. Missing API/insecure context/permission denial shows a selectable, read-only report plus retry/close; fullscreen is exited if necessary to expose this DOM fallback. Native builds explicitly show the report rather than claiming OS clipboard support. Pending requests are generation-guarded against stale dialog updates. The small helper is bundled as a custom resource, with no external script.

Read sources: pinned Defold `script_html5_js.cpp` run's result/error behavior; W3C Clipboard API working draft (2026-06-24), writeText and permission model, https://www.w3.org/TR/clipboard-apis/ . Browser policy support is established separately by runtime. Required A11 smoke uses an actual F gesture and the isolated CI browser clipboard, reads back/verifies all fields and current SHA, then injects a rejected write to verify the visible selectable fallback. It does not claim every browser permission policy or native clipboard support.

## A12 five-second graphs

A fixed-capacity ring observes actual speed and both signed spring translations once per owner tick. It retains at most 301 samples at pinned 60 Hz. Fifty 100-ms min/max buckets preserve short excursions instead of dropping them between GUI updates. Empty history is hidden, displayed values are quantized to 0.1 u, both spring plots share a symmetric scale, and every retry/preset clears history with a generation tag. Each series is a separate payload below the message budget; there is no graph framework, new tick callback or world step.

The production baseline still has no authored hard suspension stop; the plot is signed travel, not an invented bottoming percentage. A12's focused debug-only probe enables wheel limits [-20,+18] u and gives the wheels an upward 1000 u/s pulse. It requires an actual positive compression peak in [16,20] u and a GUI acknowledgement that this spike was drawn, then disables the test limits. At eight seconds it requires bounded history and expiry of the old spike in both data and GUI. `suspension-spike.png` records the short stop event. This proves the graph can expose bottoming before A17's authored step station; it does not approve production stops or claim final device performance.

Pinned sources read: wheel `set_limits`, `enable_limit`, `get_upper_limit` (engine-unit scaling in the binding) and body set_linear_velocity (one conversion). All probe changes live in debug scenarios called by the sole owner. Existing A3/A6/A7/A8/A9/A10/A11 tests remain required. Feedback F now respects browser Ctrl/Meta/Alt shortcuts; no clipboard behavior is broadened.

M2 final review: the graph panel is narrowed to leave the velocity-look-ahead vehicle clear, with explicit zero baselines. The probe additionally verifies disabled test limits, zero retries and one world load, so reset cannot masquerade as normal history expiry.

## M2 feedback follow-up (#61)

Claudio authorized expanded feel controls on 2026-10-16, leaving ramps and human airborne/flip testing in M4. Candidate A/B/C wheel targets are 32/64/96 rad/s (negative sign for forward), corresponding to theoretical no-slip 7.04/14.08/21.12 m/s at radius 0.22 m. The live range is 8–140 rad/s (up to 30.8 m/s theoretical); these are targets, not promised chassis speeds. Existing torque caps, braking and geometry remain unchanged. M4 #33 must report measured speed at seams, not assume launch speed stays constant under a lower motor target. Gap ladders deliberately include unreachable sections.

Air torque is 48/72/96 N m with soft rate thresholds 8/10/12 rad/s. Live ranges: 0–200 N m and 1–16 rad/s. Ground assistance is separate chassis pitch torque 120/180/240 N m, live 0–400, with a 2.5 rad/s soft threshold. A/D use the existing normalized lean command; either wheel's contact data selects ground assistance, otherwise air assistance. This does not move the centre of mass. Zero ground torque disables the assistance. Thresholds stop adding same-direction torque rather than clamping existing spin; counter-steering stays available. Final strength/fairness awaits human testing.

All writes remain in vehicle.apply via the sole fixed owner. Pinned Defold 1.14.0 `a81dbb0478e8b73931dc2d671563204f6ac0ef82`, `engine/gamesys/src/gamesys/scripts/box2d/v3/script_box2d_body_v3.cpp` was read: Body_ApplyTorque passes raw N m to Box2D with wake=true; GetAngularVelocity returns rad/s; GetContactData returns the current body's contact table. No new engine API or dependency.

HUD/report speed is m/s and km/h; report retains signed vx in m/s. Graph labels use m/s while history/message values retain engine units and existing scale. Nine sliders fit the existing panel; coordinates and input mapping remain tied to the fixed-fit GUI until #58, which must adapt drawing, picking and drag normalization together. Compiled test resources in release remain the documented Phase B exclusion task.

Required `m2feedback` smoke uses real keyboard A/D on the flat floor, checks disabled assistance leaves the chassis neutral, signed chassis pitch both ways, two neutral resets and one world, new control limits/preset restore, then selects C and verifies upright actual chassis speed above 8 m/s (old target ceiling 7.92). Existing A6 controlled airborne probe remains a technical response regression, not a ramp/flip playtest. Clipboard smoke checks readable speed units and the added tuning fields.


## A12b browser presentation

The HTML5 page uses the full viewport. Its CSS size and back buffer are separate: High DPI ON uses the current device pixel ratio, OFF uses one buffer pixel per CSS pixel. `?dpi=0` / `?dpi=1` and the quality button select the comparison mode (page reload required). Resizing/rotation/fullscreen preserve the running world. Browser zoom/DPR changes invalidate the buffer even if the CSS dimensions stay equal. The orthographic Auto Fit camera preserves world proportions; the scene covers the viewport. GUI panels use edge anchors and safe-area adjustment; slider dragging converts `action.screen_x/y` with `gui.screen_to_local`, so picking and values share the adjusted track space.

The release preview verifier records 1280×720, 1920×1080, 2560×1440, 20:9 landscape and portrait screenshots, exercises all nine slider endpoints and releases outside, then records two seconds of browser callback and engine telemetry samples per quality mode. CI software-browser timings are not phone performance evidence. Actual desktop browser zoom/fullscreen behavior, Xiaomi high-DPI cost and readability still need human verification. The default ON follows #58's requested trial setting; it is not a measured phone-performance verdict.

Sources read: Defold HTML5 manual (scale modes, template interface, DPI); GUI 1.14.0 API (`screen_to_local`, anchors, safe areas); pinned engine `a81dbb0478e8b73931dc2d671563204f6ac0ef82`: `engine/engine/content/builtins/manifests/web/engine_template.html`, `com.dynamo.cr/com.dynamo.cr.bob/src/com/dynamo/bob/bundle/resources/web/dmloader.js` (resize callback and DPI invalidation), `engine/gui/src/gui_script.cpp` / `gui.cpp` (screen coordinate conversion), and `engine/render/src/render/camera.cpp` (Auto Fit uses uniform minimum axis zoom). Runtime compatibility awaits required CI; no physics behavior was changed.

A12b review correction: disabled endpoint probes retained cached pre-resize transforms. Invalidate their positions before exporting screen geometry; visible tracks already re-rendered correctly. The preview verifier also checks the actual camera projection against the viewport aspect, so a stretched world cannot pass on CSS size alone. Consulted the Defold 1.14.0 camera API (`camera.get_projection`) and pinned GUI transform invalidation.

The responsive runner also waits for GUI drag and owner input-capture release acknowledgements before pressing again. Immediate mouse-up/down or mouse-up/key-down can collapse inside one engine input sample, particularly in mobile emulation (the existing browser input handshake pitfall). This tests release explicitly rather than treating a browser dispatch as engine evidence.

A12b visual review correction: panel roots own edge anchoring; all child positions and sizes share their root's uniform FIT space (legacy child adjustment). Independent child anchors distorted slider knob ranges and graph bar spacing at non-16:9 ratios. Slider conversion remains screen_to_local, now into the correct shared panel space.

## A13 browser touch trial

`mobile.js` owns DOM pointer capture, four simultaneous zones, layout mirroring, compact HUD and the optional 30-second capture. `mobile.lua` polls its normalized state; the existing controller merges it with keyboard input and writes only through the fixed owner. Retry uses the existing generation-aware request path. Resets and UI capture clear browser pointers too; abort/blur/rotation clears keyboard state on the next owner update. DOM controls unlock the existing Defold-owned audio context in the trusted pointer gesture; no second context is created. The detailed GUI is hidden with `gui.set_visible`, preserving graph enable states, and its picking is skipped in compact mode.

The release `tools/preview/mobile.cjs` runner dispatches real browser touch events into the release engine and observes owner telemetry: combined drive/lean, pedal priority, cancellation/outside release, Retry, mirrored direction, rotation without reload, audio, a real 30-second capture and report fallback. Synthetic browser events do not establish physical-phone acceptance.

Sources read: Defold 1.14.0 HTML5 API (`html5.run` string result), mouse/touch manual (single-touch mouse mapping and distinct multi-touch binding), GUI API (`set_visible`), MDN Pointer Events / `setPointerCapture`. The browser adapter avoids mixing DOM controls with canvas mouse emulation. Pinned `external/glfw/js/library_glfw.js` resumes audio only for canvas input; pinned `engine/sound/src/js/library_sound.js` exposes the one shared context through `_dmJSDeviceShared`, used here only for trusted-gesture resume and verified by the runtime audio-state assertion. Input semantics remain platform neutral; native builds retain keyboard controls. See docs/MOBILE_TRIAL.md for real-device evidence.

## A14 tilt trial

`tilt.js` listens only after the user enables motion, checks HTTPS/API support and invokes `requestPermission()` when exposed. Finite beta/gamma samples become a screen-horizontal gravity angle using the W3C Z-X-Y rotation matrix; no compass/yaw permission is needed. Calibration, adjustable full-lean angle/dead zone and inversion map to [-1,1]. The controller uses that same existing lean command only when no touch/keyboard lean buttons are held. Retry, UI capture, focus loss and view changes require calibration again. The adapter disables its sensor listener on world finalization and invalidates pending permission callbacks; native builds keep their existing keyboard path.

Permission denial/API absence, missing first data (3 seconds) and invalid active samples produce visible touch fallback. A quiet but valid orientation has no artificial inactivity timeout because W3C permits events only on significant change. The trial is OFF by default; no product retention is selected. Source/build, orientation mode/calibration/settings and initial/final tilt state are included in the feedback/capture. Detailed editor capture also releases when feedback clears input.

Sources read: W3C Device Orientation and Motion, sections 3.1, 6.1 and worked rotation matrix (Z-X-Y), permission transient activation, secure context/null values and significant-change event model; MDN DeviceOrientationEvent and requestPermission documentation/support limits; Defold 1.14.0 HTML5 string bridge and GUI/input sources already recorded above. This is a browser input adapter, not a physics binding.

Verification: `node --test tests/mobile/tilt.test.cjs` covers all four screen orientations, neutral/dead zone/proportional/clamped/inverted mapping and invalid data. The release injected-orientation runner proves permission/unsupported/no-data/invalid fallbacks, calibration, actual body response through the owner, touch override, Retry, live sensitivity/dead zone, inversion and rotation without reload. Those events do not prove physical sensors; Claudio's mandatory phone keep/tune/drop comparison remains open. See docs/MOBILE_TRIAL.md.
