# G1 physics baseline

Measured API/unit matrix and fixture of the G1 baseline ([run 38697533465](https://github.com/bongohorse/rider/actions/runs/38697533465)). Rules: [physics contract](physics.md).

**Contents:** [API and units](#api-and-units) · [Start state, assertions and callback order](#start-state-assertions-and-callback-order) · [Ownership and cleanup](#ownership-and-cleanup) · [Running and protocol](#running-and-protocol)

## API and units

Engine candidate: Defold 1.14.0 (`a81dbb0478e8b73931dc2d671563204f6ac0ef82`), integrated Box2D 3.1.0. The original G1 native baseline used the headless engine. G2 extends Windows to ordinary debug with per-process Mesa software OpenGL; Linux Bridge graphics/input are tested separately. See [Bridge](bridge.md). HTML5 uses the debug WebAssembly engine in Playwright Chromium; its exact browser version is an artifact.

| Used API/resource | Input/output convention | Evidence/case |
|---|---|---|
| Collision Object / factory | Game Object owns body; shape coordinates in engine units, mass in kg | `body_collision`, `cleanup_reset` |
| `b2d.get_body(url)` | Borrowed handle; lookup restricted to the script's collection | Runtime finding and collection-local `proxy.script` |
| `b2d.body.get_position(body)` | Engine coordinates; binding divides Box2D position by `physics.scale` | `units`, changed-scale comparison |
| `b2d.body.set_transform(body, position, angle)` | Engine coordinates multiplied by scale; angle radians | Tick-zero reset, velocity probe |
| `b2d.body.set_linear_velocity(body, vector)` | Engine units/s multiplied by scale | 120 units/s → 60 units in 30 fixed ticks |
| `b2d.body.get_linear_velocity(body)` | Engine units/s | Release-state diagnostic |
| `b2d.body.set_gravity_scale(body, ratio)` | Dimensionless multiplier | Chassis supported via gravity=0; wheel loaded/unloaded |
| `b2d.body.set_fixed_rotation(body, boolean)` | Boolean; holds fixture chassis rotation | Motor isolation |
| `b2d.body.get_angular_velocity(body)` | Radians/s | Target 20, tolerance ±2 |
| `b2d.joint.create_wheel(a,b,definition)` | Both borrowed bodies in one Defold-owned world | Motor/spring, collection cleanup |
| Wheel local anchors | Engine units, multiplied by scale | Chassis anchor (0,-50), wheel anchor (0,0) |
| Wheel local axis | Unit direction; no length conversion | (0,1) |
| Wheel spring hertz / damping ratio | Hz / dimensionless | 3 / 0.7 |
| Wheel motor speed | Radians/s | 20 |
| Wheel max motor torque | Defold binding input multiplied by scale; raw configured 10000 | Source semantics; torque cap is a fixture input, not an independently calibrated vehicle torque |
| `b2d.body.is_valid` / `b2d.joint.is_valid` | Safe validity query on retained stale handles | All 100 resets and confirmed collection unload |
| `b2d.joint.destroy(joint)` | Explicit removal, only while valid | 50 explicit-reset cases |
| `b2d.joint.create_revolute(a,b,definition)` (A19d) | Anchors in engine units, multiplied by scale; `reference_angle`, `lower_angle`/`upper_angle` in radians, unscaled; `max_motor_torque` would be scaled (unused). `collide_connected=true`: the static terrain body holds every chain | `a19d` seesaw (terrain ↔ plank), recreated on every reset; source `Joint_CreateRevolute` |
| `b2d.joint.get_joint_angle(joint)` (A19d) | Revolute only; radians (plank angle minus terrain angle minus reference) | `a19d` seesaw limit and tip/settle observation |
| `b2d.body.get_mass(body)` (A19d) | kg, unscaled; equals the collision object's mass | `a19d` plank mass check (20 kg) |

The fixture speaks engine units at the binding boundary; it does not additionally scale coordinates/velocities. Configured gravity is -981 engine units/s². Two runs use scale 0.01 and 0.02. Force, body torque and impulse are not used by this fixture; their binding conversions are listed in the [physics contract](physics.md#units).

Sources: official [body binding](https://github.com/defold/defold/blob/1.14.0/engine/gamesys/src/gamesys/scripts/box2d/v3/script_box2d_body_v3.cpp), [joint binding](https://github.com/defold/defold/blob/1.14.0/engine/gamesys/src/gamesys/scripts/box2d/v3/script_box2d_joint_v3.cpp), [physics step](https://github.com/defold/defold/blob/1.14.0/engine/physics/src/physics/box2d/box2d_physics.cpp). The latter calls `b2World_Step` with `step_context.m_Box2DSubStepCount`; the effective config is asserted as 4. Four solver substeps are not four Lua callbacks.

## Start state, assertions and callback order

The dynamic chassis has mass 10000 kg, no gravity and fixed rotation. The dynamic wheel has mass 1 kg and radius 15 engine units. This deliberately constrained fixture isolates joint behavior; it is not a balanced or driveable vehicle. Bodies start at (300,300) and (300,250). Connected-body collision is disabled. A separate dynamic wheel drops at x=-300 onto a static floor centered at (0,-20), half-height 10. All collision groups/masks are `g1`; friction and restitution are zero.

`init` requests factory objects; the next `update` obtains valid bodies and creates the joint. Tick zero is established inside the sole `fixed_update` owner by resetting the drop to y=500 with zero linear velocity, eliminating render-dependent startup steps. Defold performs simulation; there is no manual world step. Commands written in one fixed callback must yield one step of movement at the next fixed callback. No ordering between independent script instances is assumed.

Bounds were specified before acceptance runs:

| Tick/case | Required observation |
|---|---|
| 30, fall | 110 < fall < 136 engine units |
| 120, collision | Body center y=5 ±1.5 |
| 120, motor | Initial angular speed <0.001; 18 < angular speed < 22 rad/s after command |
| 120, loaded spring | Deflection between 1.5 and 4.0 engine units |
| 240, unloaded spring | Relative anchor error <0.2 |
| 240→241, command order | 120 units/s moves body 2 ±0.05 units |
| 240→270, velocity conversion | Displacement 60 ±0.1 units |
| All fixed callbacks | dt=1/60 ±0.00001 s |
| Changed scale | Fall difference ≤0.5 engine units |
| Render separation | Ticks/frame 0.8..1.3 at 60 target; 1.6..2.5 at 30 target |

Render frequency and scale change together in the second run, while initial state, fixed dt, solver substeps and core assertions remain identical. Both free-fall and commanded movement are measured; callback counts alone cannot pass.

## Ownership and cleanup

| Resource | Owner/create | Cleanup/confirmation |
|---|---|---|
| Main-world factory objects | Controller session, factory resources | Request deletion in `update`, wait until `go.exists` is false, then require stale body/joint handles invalid |
| Main-world wheel joint | Controller | Alternate explicit destruction (50) with attached-body automatic removal (50) |
| Proxy-world bodies/joint | Proxy script obtains local handles and creates joint after initialization | Root requests disable/final/unload; require final callback and real `proxy_unloaded`, then query old handles |
| Shared Lua session entry | Root creates a run-ID-keyed entry before load | Root releases entry after successful unload; proxy drops its reference in `final` |
| Runner process/page | External runner | Native and browser process groups are terminated on timeout and after completion; browser closes context and HTTP server |

Proxy setup notifies the root by a message carrying the active generation. Unexpected/stale phase messages fail the suite. Body creation/destruction occurs in `update` or lifecycle handlers, never a contact callback. No contact listener or deferred contact mutation is needed by this PoC. State is local to explicit sessions, with no globals persisting scenario parameters. Gym reset, touch and station-switch recovery are tested by the gym suites.

## Running and protocol

From the repo root with JDK 25 and Python:

```sh
python tools/g1/run.py --platform x86_64-linux --output artifacts/g1/linux
python tools/g1/run.py --platform x86_64-win32 --output artifacts/g1/windows
npm ci --ignore-scripts
npx playwright install --with-deps chromium
python tools/g1/run.py --platform wasm-web --output artifacts/g1/html5
python -m unittest discover -s tests/g1 -v
```

Use the platform appropriate for the host. Each command builds/runs two configurations. The runner generates a unique ID, embeds it in settings and overrides it through the native command line. HTML5 reads the embedded runner-generated ID from its freshly built config in a fresh browser context. `RIDER_G1` JSON events identify the exact Git source, effective config hash, expected inventory, measurements and unique completion. Foreign completion is rejected as evidence for the current run. Missing, duplicate, failed or inconsistent results fail. Native suite timeout is 60 s, browser 60 s, outer browser process 100 s, each Bob build 900 s. Logs, toolchain versions, results, comparison and browser version/screenshot are retained in CI artifacts.

Protocol negative tests cover zero/partial inventory, stale completion, duplicate start/case/end, script errors and mismatched source identity. Build success does not imply runtime success. Android build results are separately recorded; no device/touch/install claim follows from a produced APK.
