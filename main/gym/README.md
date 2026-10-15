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
