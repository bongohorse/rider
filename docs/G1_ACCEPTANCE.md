# G1 acceptance — PASS

Scope: minimal Defold / integrated Box2D 3 PoC, not a complete vehicle or sandbox UI. Run against the exact candidate engine and effective app manifest. No separate physics extension.

## Required cases

| ID | Assertion | Windows native | Linux runtime | Desktop Chrome HTML5 | Android |
|---|---|---|---|---|---|
| backend | Active Box2D major 3 from runtime | PASS | PASS | PASS | G3 required |
| body_collision | Static floor and dynamic collision behave within declared tolerances | PASS | PASS | PASS | G3 required |
| wheel_motor | Measured wheel angular acceleration/speed changes under motor command | PASS | PASS | PASS | G3 required |
| wheel_spring | Defined load causes measurable deflection and damped return | PASS | PASS | PASS | G3 required |
| units | Fall distance, joint distance and changed-scale probe reject double conversion | PASS | PASS | PASS | G3 required |
| fixed_ticks | 60 Hz independent of render rate, configured solver substeps separate | PASS | PASS | PASS | G3 required |
| cleanup_reset | 100 resets; explicit joint removal and body/collection autoremoval; no stale handles | PASS | PASS | PASS | G3 core smoke |
| protocol | Current run-ID completion accepted, foreign/stale results rejected | PASS | PASS | PASS | documented route |

Before running, define numeric tolerances, initial positions/velocities, body creation order, test duration and expected IDs. A chassis, one wheel, wheel joint and floor suffice. Declare fixture constraints and load; fixtures do not claim full-vehicle dynamics. Start tick zero only after initialization and a specified settling policy. Release input after start-state measurement.

## Contracts to implement in G1

- Collision Objects own bodies; b2d.get_body yields borrowed handles. Record joint owner, validity checks and autoremoval. Keep bodies in the same physics world.
- Set and verify physics.use_fixed_timestep=true, engine.fixed_update_frequency=60 and documented Box2D 3 Sub Step Count=4 as the initial candidate. Do not confuse solver substeps with callbacks or legacy iterations.
- Define unit conversion once at the boundary for every used physics API. Validate, do not guess from upstream Box2D units.
- One tick owner selects/applies commands without relying on script instance execution order. No second world-step loop.
- Implement a minimal external smoke runner with timeout, child-process cleanup, nonzero failure exit and structured suite_start/case/suite_end events. Runner-generated run ID must reach each platform through a proven route. Zero/missing/duplicate results, setup/cleanup errors, crash or missing completion cannot pass.
- Record source SHA, engine/variant/backend, config hash, expected inventory, full logs and actual measured values.
- Try an Android debug bundle and record exact prerequisite failures; a real installable debug APK is mandatory by G2. Device touch/physics checks follow in G3, not implied by build success.
- Define session ownership, safe mutation queue, reset completion, Lua-state isolation and valid generation boundaries; implement only what the PoC needs.

G1 creates the minimal runtime project and runner. G2 unifies tooling/JSON/JUnit and integrates Bridge. G3 adds sandbox and Android tests. Missing required APIs stop dependent work for a decision. Human device tests cannot be invented by a cloud agent.

## Evidence

Baseline source: `7594e500fafa074b65150dd45a3224369dea5033`. [G1 run 38697533465](https://github.com/bongohorse/rider/actions/runs/38697533465) passed Linux/Windows headless and HTML5 debug in both configurations (scale 0.01 at 60 render target, scale 0.02 at 30). Each platform emitted all eight engine cases plus matching completion, ignored one foreign completion, and passed changed-scale/render comparisons. Six collector tests passed; final hardening adds one exact-JDK-build regression. [Implemented contract](physics/G1_CONTRACT.md) defines fixtures, ownership, units and tolerances.

| Measurement | Scale 0.01 / 60 target | Scale 0.02 / 30 target |
|---|---|---|
| Fall after 30 ticks | 123.817108 | 124.259888 |
| Motor angular speed | 20 rad/s | 20 rad/s |
| Loaded spring deflection | 2.761017 | 2.761017 |
| Return anchor error | -0.0000763 | -0.00000763 |
| Velocity displacement, 30 ticks | 59.999939 | 59.999939 |
| One-tick command movement | 2 | 2 |
| Linux / HTML5 ticks per frame | 1 | 2 |
| Reset cycles per run | 100 (50 explicit / 50 automatic) | 100 (50 explicit / 50 automatic) |

Windows matched the physical values; its 30-target run measured 270 ticks in 137 rendered updates, within declared bounds. The changed-scale fall difference is 0.442780, below the predeclared 0.5 limit. No tolerance was expanded. This is an invariance probe within tolerance, not a claim of bit-identical scale behavior.

Android: Bob produced `RiderG1.apk` for arm64 with the debug engine. APK installation, real hardware, touch and tab/app switching remain NOT RUN. [Toolchain lock](TOOLCHAIN_LOCK.md) identifies approved engine/Bob/JDK only. CI artifacts retain logs, structured results, toolchain reports and browser evidence for 14 days; numeric results and source/run identities remain in git. The final PR also asserts the engine source SHA and motor speed from rest. Its check suite must pass before merge; PR #7 retains the exact final head and merge identity.
