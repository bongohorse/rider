# Vehicle commands and gameplay constraints

Input sources (keyboard, touch, later gamepad) produce normalized per-tick commands and do not know vehicle internals:

```text
throttle: 0..1
brake_reverse: 0..1
lean: -1..1
```

A6 adds `allow_reverse` (boolean) to resolve simultaneous pedals: false while throttle is physically held, even though brake priority normalizes throttle to zero. Other input sources must supply the same intent. Throttle, brake/reverse and left/right lean remain distinct actions. Default simultaneous throttle/brake behavior: brake wins; any intentional alternative must be documented and tested. Brake down to near standstill before controlled reverse; tune threshold/hysteresis explicitly.

Assign a touch ID once to a zone; release outside, focus loss, cancellation, orientation change and scenario switch must clear held input. Overlay interaction must not leak hidden vehicle commands. Multi-touch tests become required as touch is introduced, with broader challenge acceptance in Phase B.

Centralize motor target angular speed/torque cap, allowed speed/limiter, braking torque, assist/body torque, spring hertz/damping and camera parameters in A6's feel layer with its verified unit adapter. Target wheel speed is not vehicle speed. Check response as mass/friction, incline and airborne conditions change.

Gym crash handling uses a head sensor: default off displays contact; switched on triggers reset. Challenges default on. Define additional failure bounds explicitly; do not assume every rotation is a loss. In-world retry restores vehicle, dynamic obstacles, input, timer, effects, camera and attempt data. Follow the recovery proposal in GAME_DESIGN.md: manual Retry (R or the touch Retry button), current station safe start, generous authored safety bounds with a visible reset reason, and no automatic stuck/inactivity reset. Camera exit alone is not out-of-bounds. All recovery uses the same canonical in-world reset path. Start without checkpoints; trial a safe authored section checkpoint only if playtests show full restarts obstruct learning. These defaults remain subject to Claudio's feedback.

Camera: smooth following, look-ahead, readable landing zones, speed-based zoom; check reverse, leftward motion, high speed and differing aspect ratios. Gameplay remains platform-neutral.

The gym has no time limit or prescribed session duration. Later finished-level lengths are unsettled (60 s–5 min is exploratory); elapsed time is not automatically a deadline. Phase B starts with a short, roughly one-minute challenge, adjusted through playtesting, with throttle/braking, a controlled jump and a timing/lean obstacle. Held full throttle must demonstrably fail at least one passage and skilled play must pass. Human acceptance is separate from automatic checks: controllability, repeatable suspension/landing, readable/fair failures, a reliably solvable challenge, prompt retry (duration measured), simultaneous real touch without accidental commands, and motivation to try again. Record each observation/problem/decision, tester count and device. One person's approval is not general player validation; a small extra test group is optional.

Touch offers mirrored four-zone layouts (A13). Tilt lean is an opt-in input, default off, kept after Claudio's phone test (A14). Preset strength and head-contact fairness are judged by driving the experiments, not decided upfront.

M2 feedback (#61) enables A/D ground pitch assistance as well as air control. Both use raw chassis torque, separate tunable strengths and soft same-direction angular-rate thresholds; opposite lean can always counter-steer. Either wheel contact selects ground assistance. This is a gameplay aid, not a simulated moving centre of mass; setting ground torque to zero disables it. Airborne playability/flip acceptance waits for the air station (A19c).

Air pitch damping (#211) is a candidate aid in preset F only: optional preset key `air_pitch_damping` (N m s, 0–20; absent = 0 = off, so A–E are unchanged). In flight only (no wheel and no chassis contact) and with lean exactly 0, the vehicle tick adds raw chassis torque −k·ω. Any lean switches it off, including air control, so full-lean rotation is unchanged. Tilt lean (A14) is 0 only inside its dead zone, so with tilt the damping acts only while the phone is held inside the dead zone; any tilt beyond it turns damping off. It is a gameplay aid against the neutral nose-dive after a lip, not aerodynamics; Claudio judges whether it feels natural or assisted.
