# Vehicle commands and gameplay constraints

Input sources (keyboard, touch, later gamepad) produce normalized per-tick commands and do not know vehicle internals:

```text
throttle: 0..1
brake_reverse: 0..1
lean: -1..1
```

Lua field names may differ if documented. Throttle, brake/reverse and left/right lean remain distinct actions. Default simultaneous throttle/brake behavior: brake wins; any intentional alternative must be documented and tested. Brake down to near standstill before controlled reverse; tune threshold/hysteresis explicitly.

Assign a touch ID once to a zone; release outside, focus loss, cancellation, orientation change and scenario switch must clear held input. Overlay interaction must not leak hidden vehicle commands. Multi-touch tests become required as touch is introduced, with broader challenge acceptance in Phase B.

Centralize motor target angular speed/torque cap, allowed speed/limiter, braking torque, assist/body torque, spring hertz/damping and camera parameters in A6's feel layer with its verified unit adapter. Target wheel speed is not vehicle speed. Check response as mass/friction, incline and airborne conditions change.

Gym crash handling uses a head sensor: default off displays contact; switched on triggers reset. Challenges default on. Define additional failure bounds explicitly; do not assume every rotation is a loss. In-world retry restores vehicle, dynamic obstacles, input, timer, effects, camera and attempt data. No checkpoints unless the first short challenge actually needs them.

Camera: smooth following, look-ahead, readable landing zones, speed-based zoom; check reverse, leftward motion, high speed and differing aspect ratios. Gameplay remains platform-neutral.

Phase B's first challenge lasts 30–60 seconds with throttle/braking, a controlled jump and a timing/lean obstacle. Held full throttle must demonstrably fail at least one passage and skilled play must pass. Human acceptance is separate from automatic checks: controllability, repeatable suspension/landing, readable/fair failures, a reliably solvable challenge, prompt retry (duration measured), simultaneous real touch without accidental commands, and motivation to try again. Record each observation/problem/decision, tester count and device. One person's approval is not general player validation; a small extra test group is optional.
