# G1 acceptance — specification only, implementation NOT AUTHORIZED

Scope: minimal Defold / integrated Box2D 3 PoC, not a complete vehicle or sandbox UI. Run against the exact candidate engine and effective app manifest. No separate physics extension.

## Required cases

| ID | Assertion | Windows native | Linux runtime | Desktop Chrome HTML5 | Android |
|---|---|---|---|---|---|
| backend | Active Box2D major 3 from runtime | NOT RUN | NOT RUN | NOT RUN | G3 required |
| body_collision | Static floor and dynamic collision behave within declared tolerances | NOT RUN | NOT RUN | NOT RUN | G3 required |
| wheel_motor | Measured wheel angular acceleration/speed changes under motor command | NOT RUN | NOT RUN | NOT RUN | G3 required |
| wheel_spring | Defined load causes measurable deflection and damped return | NOT RUN | NOT RUN | NOT RUN | G3 required |
| units | Fall distance, joint distance and changed-scale probe reject double conversion | NOT RUN | NOT RUN | NOT RUN | G3 required |
| fixed_ticks | 60 Hz independent of render rate, configured solver substeps separate | NOT RUN | NOT RUN | NOT RUN | G3 required |
| cleanup_reset | 100 resets; explicit joint removal and body/collection autoremoval; no stale handles | NOT RUN | NOT RUN | NOT RUN | G3 core smoke |
| protocol | Current run-ID completion accepted, foreign/stale results rejected | NOT RUN | NOT RUN | NOT RUN | documented route |

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
