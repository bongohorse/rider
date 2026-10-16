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

Gym crash handling uses a head sensor: default off displays contact; switched on triggers reset. Challenges default on. Define additional failure bounds explicitly; do not assume every rotation is a loss. In-world retry restores vehicle, dynamic obstacles, input, timer, effects, camera and attempt data. Follow the recovery proposal in GAME_DESIGN.md: manual Retry (R, plus touch button when touch arrives), current station safe start, generous authored safety bounds with a visible reset reason, and no automatic stuck/inactivity reset. Camera exit alone is not out-of-bounds. All recovery uses the same canonical in-world reset path. Start without checkpoints; trial a safe authored section checkpoint only if playtests show full restarts obstruct learning. These defaults remain subject to Claudio's feedback.

Camera: smooth following, look-ahead, readable landing zones, speed-based zoom; check reverse, leftward motion, high speed and differing aspect ratios. Gameplay remains platform-neutral.

The gym has no time limit or prescribed session duration. Later finished-level lengths are unsettled (60 s–5 min is exploratory); elapsed time is not automatically a deadline. Phase B starts with a short, roughly one-minute challenge, adjusted through playtesting, with throttle/braking, a controlled jump and a timing/lean obstacle. Held full throttle must demonstrably fail at least one passage and skilled play must pass. Human acceptance is separate from automatic checks: controllability, repeatable suspension/landing, readable/fair failures, a reliably solvable challenge, prompt retry (duration measured), simultaneous real touch without accidental commands, and motivation to try again. Record each observation/problem/decision, tester count and device. One person's approval is not general player validation; a small extra test group is optional.

A13 compares mirrored touch layouts. A14 must implement/test tilt lean before a keep/drop decision; only final retention is optional. Preset strength and head-contact fairness are judged after Claudio can drive the experiments, not before implementation.
