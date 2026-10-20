# Physics contract

Binding rules for all physics and gameplay-simulation work on pinned Defold 1.14.0 / integrated Box2D 3.1.0. [G1 baseline](g1-baseline.md) holds the measured API/unit matrix; [engine pitfalls](engine-pitfalls.md) the recurring traps; [engine references](../ENGINE_REFERENCES.md) the official sources.

**Contents:** [API and platform](#api-and-platform) · [Units](#units) · [Lifecycle and tick owner](#lifecycle-and-tick-owner) · [Ownership and reset](#ownership-and-reset) · [Collisions and sensors](#collisions-and-sensors) · [Scenario and result data](#scenario-and-result-data) · [Pause, slow motion and live tuning](#pause-slow-motion-and-live-tuning) · [Command playback and ghosts](#command-playback-and-ghosts)

## API and platform

- Defold game objects own bodies and worlds; no custom physics extension, second Box2D, manual world step or backend substitution. A missing required API blocks the affected issue and needs evidence and a decision.
- Extend the [G1 baseline](g1-baseline.md) API table only when a gym issue actually uses another operation: API/signature, source version, backend, native/HTML5/Android evidence, semantics, test ID, result and limitation.
- Terrain is chain shapes from polyline data; obstacles are hull collision objects (D8, confirmed by A18: abutting hulls cause seam bumps). Verify filtering, contact/sensor behavior and high-speed CCD when a feature relies on them.

## Units

- Record units of position, velocity, acceleration, force, impulse, torque, angle and angular velocity for every used API, and whether `physics.scale` applies. Convert exactly once at a named adapter boundary.
- Gym scale: `physics.scale = 0.01`, so 100 engine units are one metre. Internal angles are radians; UI may show degrees. Label displayed speed units. Camera, GUI, terrain data, debug drawing and contact points also state their units.
- Binding conversions verified at 1.14.0 (source observations; new adapters still need a runtime test):

| API group | Conversion |
| --- | --- |
| Body position, linear velocity, anchors, wheel limits, shape/chain vertices | Scaled by the binding (engine units in Lua) |
| Body torque / angular impulse | Not scaled (raw N m) |
| Wheel joint max motor torque | Scaled by the binding; differs from body torque |
| Motor speed, angular velocity | rad/s, no scaling |

- Air pitch damping (#211): torque −k·ω on the chassis with ω from `b2d.body.get_angular_velocity` (rad/s) and `b2d.body.apply_torque` (raw N m), so k is N m s with no scale factor; the single conversion point is `feel.body_torque`. Applied in `vehicle.apply` inside the owner's `fixed_update` (no extra loop): only with no wheel and no chassis contact, lean exactly 0, k > 0, an awake chassis with |ω| > 0.01 rad/s (the binding's `apply_torque` wakes the body: [`script_box2d_body_v3.cpp` L450-456](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/gamesys/src/gamesys/scripts/box2d/v3/script_box2d_body_v3.cpp#L450-L456)), and never on the reset tick (reset drops cached contacts). Pause runs no fixed step, so nothing is applied while paused.
| Joint translation getter | Prismatic only; measure wheel/chassis positions instead |

- Validate gravity/fall distance and joint distance with a deliberate scale change to catch double conversion. Define tolerances before running.

## Lifecycle and tick owner

- Baseline: 60 Hz fixed timestep (`physics.use_fixed_timestep = true`, `engine.fixed_update_frequency = 60`) and four solver substeps. Substeps are not gameplay ticks; `physics.max_fixed_timesteps` is 3D-only.
- One tick owner: capture input, apply one normalized command per physics tick, let Defold simulate, read state at the verified callback point. No second loop; never assume ordering between script instances.
- Measure render frequency, fixed callbacks and physical progress separately. A 30 FPS render fallback does not change 60 Hz physics. Changing the physics basis needs a documented comparison and approval.
- Never create/destroy bodies or joints in contact callbacks; queue mutations into a proven safe window.
- On stalls/background: no unlimited catch-up, clear held input after inactivity, resume without forced extra steps. Visual interpolation stays unchanged unless measured pacing problems require it ([platform matrix](../PLATFORM_MATRIX.md)).

## Ownership and reset

- `b2d.get_body` returns a borrowed handle; deleting its component/object invalidates it. Keep vehicle and terrain in the same proxy world; separate top-level worlds do not interact.
- Record owner/create/destroy/reset/validity for objects, bodies, shapes, chains, joints, listeners, timers, touch IDs, GUI, camera, Lua modules and test state as each is introduced. Never double-destroy or dereference invalid handles; engine cleanup and Lua reference cleanup are separate evidence.
- Defold 1.14.0 uses shared Lua state: session state lives in explicit instances, not globals or module singletons. Unloading a collection does not clear Lua state.
- Retry resets the running world in place (D9); proxy reload only for track switches. Retained bodies may be reused only with valid handles and fully restored canonical state.

Reset sequence:

1. Block input and clear touch assignments.
2. Stop pending actions; drain/cancel deferred mutations safely.
3. Restore/rebuild objects and joints in a safe window.
4. Reset UI, camera, timer, listeners and session state.
5. Invalidate replaced handles; reject stale generations.
6. Restore canonical configuration, poses and velocities; verify READY.
7. Re-enable input; old touches must not apply a new command.

Test explicit joint cleanup and deletion of a body or collection with attached joints. Confirm actual unload/load/init completion events, never fixed sleeps. Serialize reset/switch requests and coalesce duplicates explicitly. Each session has a generation checked by pending timers, callbacks, commands and messages. Async reloads follow RUNNING → STOPPING → UNLOADING → LOADING → INITIALIZING → READY → RUNNING, with ERROR on timeout/failure; ERROR stays paused with diagnostics. Test A → B → A switching and interrupted resets; stale generations must never mutate the world.

## Collisions and sensors

- Document chassis, wheel, terrain, obstacle and sensor groups/masks when a feature introduces them; decorations have no physics. Do not assume default filtering.
- The head sensor is a script-created sensor shape on the chassis (A7): gym default off displays contact, on triggers reset; challenges default on. Its reset lifecycle is covered by the A3/A7 regressions.

## Scenario and result data

- Grow schemas only as the gym needs. Versioned records include scenario/schema version, platform/build SHA/engine, canonical configuration and hash, commands indexed by physics tick, checkpoints/tolerances, result and artifacts.
- Reject NaN/Inf, missing fields, unsupported versions, out-of-range values and corrupt saves visibly. Cross-platform comparisons are tolerance-based, not bit-exact.

## Pause, slow motion and live tuning

- A20 (verified on pinned 1.14.0, test `a20`): the loader, as proxy owner, is the only writer of the world proxy's `set_time_step` (`mode = 0`, factors 1.0 / 0.5 / 0.25, 0 = pause); the controller stays the tick owner. The proxy scales its world's dt and time scale ([`comp_collection_proxy.cpp` L430-445](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/gamesys/src/gamesys/components/comp_collection_proxy.cpp#L430-L445)); the world runs no fixed step at a time scale ≤ 0.001 and otherwise steps with (1/60) × factor ([`gameobject.cpp` L3187-3206](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/gameobject/src/gameobject/gameobject.cpp#L3187-L3206)), which is the Box2D step dt ([`comp_collision_object_box2d.cpp` L691, L710](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/gamesys/src/gamesys/components/box2d/comp_collision_object_box2d.cpp#L691)). Rendering and `update` (dt 0) continue while paused.
- **Pause** stops every fixed step: no physics, `fixed_update`, bounds/crash/FINISH evaluation or queued resets. Input still reaches the world ([`OnInput`](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/gamesys/src/gamesys/components/comp_collection_proxy.cpp#L849)), so the owner drops drive, Retry, section and preset input while paused and clears held keys, touch pointers and drags on pause and on resume; a key held through the pause needs a new press. Resume sets the factor only after the owner has acknowledged and cleared its input.
- **Slow motion is a time scale with smaller steps, not a replay:** the world keeps 60 fixed callbacks per engine second, each 1/120 or 1/240 s. Per-step limits (Box2D's rotation cap of 0.25π per full step, engine pitfall 6; four solver substeps per step) therefore change with the factor, so trajectories are close to, not identical with, 1.0; `a20` reports a throttle-from-rest comparison at all three factors. Values captured at a factor other than 1.0 are not comparable with the measurement protocols: telemetry, station reports and the feedback copy record the factor and the count of ticks not at 1.0, and every automated debug case except `a20` and `a21` (whose comparable replays assert 0 scaled ticks) asserts a 1/60 s step on every tick. Every world switch (station, Edit/Play, import) starts at 1.0; Edit worlds always run at 1.0.
- Single-step is not implemented; never fake it in the UI.
- Live tuning classifies each parameter as LIVE, NEXT_RESET or REBUILD, validates finite values/ranges/units and applies changes atomically at a tick boundary.

## Command playback and ghosts

- Use the smallest adapter the issue needs (A21 preset comparison, A22 regressions); no general replay product.
- Record canonical configuration, creation order, initial poses/velocities and first command tick. Apply exactly one command per tick through the live vehicle path, with live input disabled.
- Define missing/duplicate/out-of-order tick policy and outcome tolerances before running; compare at two render rates (e.g. 30/60 FPS) with 60 Hz physics.
- A good trace and a deliberately bad trace must each produce their expected outcome. Ghosts use recorded transforms as a visual reference; no bit-exact re-simulation or split screen.
- A21 (test `a21`): the controller records from a station start (format version 1, [gym notes](../../main/gym/README.md#record-and-replay)) and replays as one more command source in the same `fixed_update`, one recorded command per tick through `vehicle.apply` with live input ignored. Tick policy: one entry per fixed tick; a missing or repeated tick invalidates the recording (replay refused), out-of-order entries cannot be stored, the player stops on a gap. Tolerances, declared before running: same preset and tuning, chassis position ≤ 0.05 m and angle ≤ 0.05 rad on every tick (MATCH, else DIVERGED); other presets report the deviation (COMPARED). Ticks at a factor other than 1.0 or live tuning make a run not comparable; pause freezes recorder, player and ghost. The ghost is sprite-only (no collision object or body). Recordings live on the controller instance and are discarded with the world (station switch, Edit/Play, import).
- A22 (test `a22`, [gym notes](../../main/gym/README.md#regression-traces-a22)): regression traces are stored A21 format-v1 recordings of preset A (unmodified) from station starts, replayed by the same player (`replay.install` validates the whole trace first; a short or malformed trace is refused). Outcomes (jump distance, top speed, air jump) and the per-tick pose MATCH are checked against tolerances frozen before the first recording; a perturbed trace and a perturbed preset value must fail. Evidence is limited to HTML5 debug Chromium, 60 Hz physics at 1.0 and 30/60 FPS render; traces change only through the documented deliberate regeneration.
