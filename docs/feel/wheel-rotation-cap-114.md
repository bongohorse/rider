# Wheel rotation cap: Box2D 3.1.0 findings and Codex 6.1 review (#114)

**Purpose:** a research-only, reviewable handoff to **Codex 6.1** for [issue #114](https://github.com/bongohorse/rider/issues/114). This document proposes NO engine/physics change. Current runtime validation at this PR HEAD: **NOT RUN**. Historic measurements are clearly marked.

**Contents:** [Decision summary](#decision-summary) · [Source-backed mechanism](#source-backed-mechanism) · [Rider calculations and evidence](#rider-calculations-and-evidence) · [Solutions and tradeoffs](#solutions-and-tradeoffs) · [Codex 6.1 investigation order](#codex-61-investigation-order) · [Reproducible test protocol](#reproducible-test-protocol) · [Acceptance and stop points](#acceptance-and-stop-points) · [References and evidence status](#references-and-evidence-status)

## Decision summary

- **Not a 10 m/s vehicle speed limit.** Box2D clamps the **angular velocity of an ordinary dynamic body**. The car chassis can travel faster; a wheel may then be unable to roll without slip at the chassis's ground-relative speed, affecting traction and feel. The wheel limit and the motor's requested speed are separate controls.
- **Not set by Rider.** The cap comes from the pinned Box2D solver. Rider does set per-preset wheel-joint motor targets, but it does not set `B2_MAX_ROTATION`.
- **Upstream offers a wheel-specific escape hatch:** `b2BodyDef.allowFastRotation`, documented for circular shapes such as wheels. In pinned Defold 1.14.0 the native body-creation path takes `b2DefaultBodyDef()` and does **not** assign this field; the current `b2d.body` Lua binding does not expose a corresponding toggle. Do **not** claim this is already available to Rider without an exact-version engine/binding proof.
- **Preferred direction to investigate, not yet approved:** find a supported **Defold-side, wheel-only** way to set the creation-time field. If unavailable, prepare an upstream API proposal and a separately approved, isolated experimental build. Avoid global solver changes, a second physics world, a third-party Box2D implementation or per-frame angular-velocity overrides.
- **Codex stop point:** produce a feasibility verdict and one strictly gated A/B plan. No engine patch, wheel resizing, production motor retune or gameplay-default switch without an explicit maintainer GO and real Defold/phone evidence.

## Source-backed mechanism

1. Box2D 3.1.0 `src/constants.h` defines `B2_MAX_ROTATION = 0.25 * pi` radians per **full physics step** (45 degrees), with a warning that raising the global constant can break continuous collision detection. This is a solver stability protection, not Rider tuning.
2. `src/solver.c` derives `maxAngularSpeed = B2_MAX_ROTATION * context->inv_dt` and applies the clamp only where `sim->allowFastRotation == false`. Thus a fast-rotation **body definition** can bypass this *particular* clamp; it does not remove other physical limits (motor force, friction, joints, CCD, contacts, or engine safety).
3. `src/world.c` sets `context.inv_dt = 1 / timeStep` and `context.h = timeStep / subStepCount`. Therefore Rider's four Box2D solver substeps **do not quadruple the angular-speed cap**. At full fixed step `dt = 1/60 s` the cap is `0.25 pi * 60 = 47.1238898 rad/s` (7.5 rotations/s, 450 rpm).
4. Box2D `include/box2d/types.h` specifically says `allowFastRotation` bypasses rotational speed limits and **should only be used for circular objects, like wheels**. `b2DefaultBodyDef()` initializes a zeroed structure, so this flag is initially false.
5. The pinned Defold 1.14.0 physics backend `engine/physics/src/physics/box2d/box2d_physics.cpp` creates bodies via `b2DefaultBodyDef()`, populates fields such as type, damping, fixed rotation, bullet and enabled, then calls `b2CreateBody`. It **does not** populate `def.allowFastRotation` in that path. The pinned `b2d.body` Lua methods expose angular-velocity getters/setters, which are **not** a fast-rotation capability toggle. A Lua call to set angular velocity does not make the solver's cap disappear on subsequent steps.
6. Rider's `game.project` uses `engine.fixed_update_frequency=60`, `physics.use_fixed_timestep=1`, `physics.scale=0.01` and `box2d.sub_step_count=4`. Defold owns the body/world/tick. Any solution must preserve this ownership and the deterministic reset/replay contract.

**Scope caveat:** The above proves the code path of the pinned engine. It does **not** prove what any unpublished future Defold fork or a native-extension experiment could expose. Codex must verify current pinned capabilities before proposing implementation.

## Rider calculations and evidence

The actual authored wheel shape is `main/gym/wheel.convexshape`: `TYPE_SPHERE` with radius **22 engine units**. With `physics.scale = 0.01` this is **0.22 m**, and the wheel is a dynamic collision object (`main/gym/wheel.collisionobject`). No-slip linear speed is `v = abs(omega) * r`, evaluated **along the contact tangent**, not simply using horizontal chassis velocity on a slope.

| Setting | Angular speed | No-slip speed with 0.22 m radius | Status |
| --- | ---: | ---: | --- |
| Preset A motor target | 32 rad/s | 7.04 m/s = 25.34 km/h | **Source setting; not a hard chassis speed limit** |
| Preset D/F motor target | 44 rad/s | 9.68 m/s = 34.85 km/h | **Source setting; not a hard chassis speed limit** |
| Preset B motor target | 64 rad/s | 14.08 m/s = 50.69 km/h | **Requested speed exceeds ordinary-body cap** |
| Preset C motor target | 96 rad/s | 21.12 m/s = 76.03 km/h | **Requested speed exceeds ordinary-body cap** |
| Ordinary Box2D body cap (60 Hz) | 47.1239 rad/s | 10.3673 m/s = 37.32 km/h | **Source-calculated theoretical rolling ceiling** |
| A18 v2 free-roll observed plateau | — | approximately **9.95 m/s** | **Historic engine measurement referenced by #114 / PR #113; NOT rerun for this PR** |

In `main/gym/vehicle.lua`, the wheel joint's requested motor speed is set with `b2d.joint.set_motor_speed`. The requested motor speed and maximum motor torque do not bypass a separate body angular-velocity clamp. More drive torque, better throttle UI or render FPS alone cannot lift this limit.

**Important distinction:** ≈10.37 m/s is not an absolute forward-speed limiter. A downhill vehicle may have chassis speed greater than this, and tires may slip relative to the surface because wheel angular velocity cannot keep up. Whether this produces measurable, objectionable behavior on real Rider tracks still requires a controlled test. The 9.95 m/s figure is a historic observation, **not a fresh CI result or an exact law of motion**.

## Solutions and tradeoffs

| Option | Potential benefit | Implementation/technical cost | Recommendation |
| --- | --- | --- | --- |
| **A. Leave the cap in place** | No new instability or maintenance burden; fine if the desired game speed stays below the rolling ceiling | High-speed downhill contact/traction may remain artificial | **Valid product choice** if measured driving feel is acceptable |
| **B. Wheel-only `allowFastRotation` via a supported Defold API** | Uses the upstream intended escape hatch; keeps ordinary chassis cap and 60-Hz timing | No such public Lua setter is established for the pinned integration; property likely must be provided when bodies are created | **First feasibility investigation**; ask Defold upstream if an official solution is available |
| **C. Small, explicit upstream/engine integration experiment** | Enables an instrumented A/B of normal vs fast wheels without changing wheel geometry | Modifies/extends the pinned native backend or build; per-platform risk, upgrades and QA; requires separate owner and explicit GO | **Experimental only after B is unavailable and maintainer approves**; no unreviewed engine patch |
| **D. Increase the actual physical wheel radius** | Higher no-slip speed at the same angular cap (e.g. 0.30 m → ~14.14 m/s) | Changes collision shape, suspension travel, ride height, torque-to-force mapping, slope handling, art alignment, handling and presets | **A full vehicle-design change**, not a transparent fix; separate A/B and approval |
| **E. Constrain gameplay speeds** | Avoids operating in the capped-slip regime with minimal engine work | Limits downhill excitement/top-end handling; does not solve the underlying mechanics | Fallback only if the player experience supports it |
| **F. Change global `B2_MAX_ROTATION` / physics tick / manual angular velocity overrides** | Can appear to move the threshold | Risks CCD, joint/contact stability, determinism, ownership, replay and platform parity; substeps do not raise the full-step clamp | **Not recommended; out of scope** |

A purely visual wheel-spin animation can hide visible mismatch but does **not** restore physical rolling traction. `isBullet` and generic CCD settings are not a substitute for `allowFastRotation`.

## Codex 6.1 investigation order

**Codex 6.1 is the requested technical reviewer for this PR**. This is a research handoff, not an authorization to edit production physics.

1. **Reproduce the source proof on pinned versions.** Confirm Rider's lock (`docs/TOOLCHAIN_LOCK.md` / `tools/toolchain-lock.json`), exact Defold 1.14.0 `box2d_physics.cpp` body constructor, `b2d.body` Lua binding surface, Box2D 3.1.0 `constants.h` / `solver.c` / `world.c` and `types.h`. Explicitly distinguish 60-Hz outer timestep from 4 solver substeps. List any version discrepancies.
2. **Determine API feasibility before coding.** Check whether Defold supports a creation-time fast-rotation property on the collision object, a sanctioned physics extension point, a public C API surface for these existing Defold-owned bodies, or an upstream feature request. If **not supported**, say so and stop at an upstream interface/design proposal; do not invent a Lua method or use private handles.
3. **Recommend the smallest safe interface**, if possible: opt-in **per dynamic circular wheel**, false for chassis, terrain, rider limbs and other objects; no implicit global switch. State when the flag must be set (body creation) and whether it survives spawn/reset/reload. Verify any changes against the Defold engine's component lifecycle and save/replay ownership.
4. **Prepare an isolated real-engine A/B experiment, pending separate GO.** Compare unchanged Rider baseline (all normal bodies) against a build with **only both physical wheels** flagged. Match source SHA/build, seeded station, preset, initial pose/velocity, input sequence, 60-Hz fixed-tick trace, four substeps and contact qualification. Do not retune motor, wheel radius, gravity, mass or friction at the same time.
5. **Make a decision, not a blind patch:** present exact feasibility, performance, high-speed rolling/traction benefit, risk and minimal changes; let maintainer choose A/B/C/D/E. If the accepted path requires an engine change, use a **separate implementation PR** and exact-head CI. This documentation PR should remain research-only.

## Reproducible test protocol

**NOT RUN in this documentation PR.** Proposed for a future authorized implementation experiment:

- Use real Defold debug HTML5/Gym at fixed 60-Hz physics, current pinned Box2D and identical test code in both A/B builds. Explicitly record `physics.scale`, source/build hash, preset, station/section, time factor (1.0), fixed ticks and outer/substep counts. Include native Android only when a real APK/device test is actually available.
- Include: flat powered acceleration, an 8→10→12→15 m/s downhill/launcher speed sweep, coast with motor disconnected, braking/reverse, rough-ground landing, jumps, wheels on/off contact, restart/retry, pause/resume and ghost/replay comparison. Do not assert scripted launch speed equals measured rolling speed.
- Per fixed tick report wheel `omega` (rad/s), tangent ground-relative contact speed (m/s), `abs(v_tangent - omega*r)` **with correct sign**, chassis linear/rotational speed, motor target/cap, both-wheel support, slip/contact impulses where available, joint validity and solver timings. Count ticks at/near 47.124 rad/s. Qualify comparisons for the same contact fixture and geometry. On slopes, use contact tangent rather than `abs(vx)`.
- Define before test: acceptable contact jitter, normal vs fast wheel peak/angular-rate difference, expected reduction in slip above 10.37 m/s, stability on landings, braking distance, reproducibility/float tolerances and fail-closed criteria. Show **negative controls**: ordinary chassis still capped and a baseline wheel demonstrably remains capped.
- Minimum pass: unchanged fixed-60-Hz tick identity and render independence; no handle leaks or reset-history dependence; no explosions/tunneling on seams/landings, no contact-stability regressions, and no silent changes to saved times/medals/coins. Preserve all existing Gym and real-input regression assertions.

## Acceptance and stop points

- [ ] Codex 6.1 independently confirms each pinned-source finding; marks any unsupported assertion **UNRESOLVED**, not PASS.
- [ ] A supported-wheel-only path is found **or** an explicit "unavailable without Defold native change" verdict is documented.
- [ ] Clearly ranked options, risk/cost, a bounded experiment proposal and maintainer decision are supplied.
- [ ] The PR changes **documentation and index only**. No engine patch, Defold extension, gameplay code, motor preset, 60-Hz settings, shader, art, UI or CI test is changed.
- [ ] Documentation links/formulas/contents headings checked. **No runtime proof claimed** by this PR.
- [ ] No downstream implementation begins until explicit maintainer GO, isolation from other Rider Studio writers, source-backed review and test plan. A future implementation must receive independent QA, exact-head required CI and real-player driving acceptance before enabling by default.

## References and evidence status

**PINNED SOURCE VERIFIED (read directly):**
- [Defold 1.14.0 physics body creation: `b2DefaultBodyDef` and `b2CreateBody`](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/physics/src/physics/box2d/box2d_physics.cpp#L1478-L1558)
- [Pinned Defold Lua body binding](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/gamesys/src/gamesys/scripts/box2d/v3/script_box2d_body_v3.cpp)
- [Box2D 3.1.0 rotation constant/warning](https://github.com/erincatto/box2d/blob/v3.1.0/src/constants.h#L30-L33)
- [Box2D 3.1.0 angular-velocity clamp and flag check](https://github.com/erincatto/box2d/blob/v3.1.0/src/solver.c#L71-L118)
- [Box2D 3.1.0 full timestep versus solver substeps](https://github.com/erincatto/box2d/blob/v3.1.0/src/world.c#L700-L756)
- [Box2D 3.1.0 `allowFastRotation` documentation](https://github.com/erincatto/box2d/blob/v3.1.0/include/box2d/types.h#L236-L241)
- [Box2D 3.1.0 default body definition](https://github.com/erincatto/box2d/blob/v3.1.0/src/types.c)
- [Rider `game.project`](../../game.project), [wheel shape](../../main/gym/wheel.convexshape), [wheel collision object](../../main/gym/wheel.collisionobject), [vehicle motor behavior](../../main/gym/vehicle.lua), [preset loader](../../main/gym/feel.lua), [A–F JSON](../../main/gym/presets/)

**HISTORICAL RUNTIME EVIDENCE (not repeated):**
- [Rider issue #114](https://github.com/bongohorse/rider/issues/114), [A18/PR #113](https://github.com/bongohorse/rider/pull/113): free-roll approx. 9.95 m/s.
- [Existing buggy baseline and limitations](buggy-baseline.md): earlier fixed-tick station outcomes; current PR engine run **NOT RUN**.

**OPEN / NOT RUN:** exact current-main A/B, supported Defold API route, real HTML5/Android measurement, high-speed contact stability and player feel acceptance.
