# Rider — game design brief v0

**Purpose:** a 2D mobile driving game about mastering a lively buggy on readable obstacle tracks. Precise control, adjustable arcade assists and quick retries matter more than realism. Claudio read v0 and supplied the direction below on 2026-10-15. Feel and fairness are decided through playable tests, not an upfront questionnaire.

## Core loop and duration

Observe → accelerate/brake and adjust attitude → land or fail → retry → improve. The Driving Gym is unrestricted practice with stations, live parameters and presets: **no time limit, countdown, inactivity deadline or fixed session length**. Optional measurement timers never end practice.

Finished levels may vary; **60 seconds to 5 minutes is an exploratory range**, not an agreed target or time limit. Start Phase B with a short, roughly one-minute prototype and tune its length through playtests. Its elapsed-time/best-time display measures a run; any future timed challenge needs its own explicit design. No fixed overall play-session duration is prescribed.

## Controls and feel trials

Keyboard first; mobile has four simultaneous actions: throttle, brake/reverse, lean left/right. Brake wins over simultaneous throttle; reverse engages near standstill. All sources use the same tick commands. Compare mirrored four-zone arrangements on the phone before choosing placement.

**Build and test tilt lean in M3 (A14)** alongside touch controls. The experiment is required; whether tilt remains in the finished game is decided after Claudio tries it. Keep touch available; permission denial or unsupported sensors must have a visible fallback and cannot count as a successful tilt test.

Build presets A/B/C and adjustable assists, then compare them with Claudio. No winning preset, assist strength or final crash-fairness verdict is required before implementation. Centralize driving/camera values with explicit units. Camera look-ahead/zoom should make obstacles and landings readable, including reverse and 20:9 layouts. No realistic tire model or ragdoll is needed for the gym.

## Crash, recovery and checkpoints

A chassis-attached head sensor provides the first crash candidate. Gym crash-reset defaults **off** (display only); a switch enables reset. Challenges initially enable it. Claudio tests whether head contact alone is fair; do not treat that rule or every rotation as a proven final failure condition.

**Recovery proposal to implement and playtest:** R always retries from the current station's safe start (the gym spawn before stations exist); add an on-screen Retry with touch controls. Author generous per-track safety bounds: leaving the visible camera is not out-of-bounds. Falling below/leaving those bounds resets through the same safe in-world path, even with head-crash reset off, and displays the reason. Do not auto-reset slow, stationary or stuck-looking experiments. Offer manual Retry instead; tune bounds from actual failures.

Retry restores canonical vehicle/world/input/camera/attempt state without collection reload, subject to A3 correctness/latency measurements. Proxy reload is for track changes. Start the first challenge **without checkpoints**; if full restarts obstruct learning later sections, trial an authored checkpoint and compare feedback. A later checkpoint restores a defined safe section start and obstacle/input state, rather than an arbitrary physics snapshot. These are testable defaults, not claimed playtest results.

## Identity and fun acceptance

Trials contributes attitude/landing mastery; early TrackMania contributes routes that can be understood, solved and improved. Rider combines a springy buggy, physics obstacles and mobile retries, later in one illustrated 2D toy style with parallax. Differentiation is a design intention, not validated market evidence.

The first challenge combines braking, a controlled jump and timing/lean. Held throttle must fail a passage while skilled input succeeds reliably. Claudio judges control, landing consistency, readable/fair failure, challenge, retry, real simultaneous touch and motivation to try again. Technical checks cannot approve fun; iterate feel before adding features. Budgets/interpolation: see [platform matrix](PLATFORM_MATRIX.md); iOS follows the Play Store launch.
