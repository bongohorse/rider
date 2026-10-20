# Rider — game design brief v0

**Purpose:** a 2D mobile driving game about mastering a lively buggy on readable obstacle tracks. Precise control, adjustable arcade assists and quick retries matter more than realism. Claudio read v0 and supplied the direction below on 2026-10-15. Feel and fairness are decided through playable tests, not an upfront questionnaire.

**Contents:** [Core loop and duration](#core-loop-and-duration) · [Controls and feel trials](#controls-and-feel-trials) · [Crash, recovery and checkpoints](#crash-recovery-and-checkpoints) · [Identity and fun acceptance](#identity-and-fun-acceptance)

## Core loop and duration

Observe → accelerate/brake and adjust attitude → land or fail → retry → improve. The Driving Gym is unrestricted practice with stations, live parameters and presets: **no time limit, countdown, inactivity deadline or fixed session length**. Optional measurement timers never end practice.

Finished levels may vary; **60 seconds to 5 minutes is an exploratory range**, not an agreed target or time limit. Start Phase B with a short, roughly one-minute prototype and tune its length through playtests. Its elapsed-time/best-time display measures a run; any future timed challenge needs its own explicit design. No fixed overall play-session duration is prescribed.

## Controls and feel trials

Keyboard first; mobile has four simultaneous actions: throttle, brake/reverse, lean left/right. Brake wins over simultaneous throttle; reverse engages near standstill. All sources use the same tick commands. Touch offers mirrored four-zone layouts; no placement winner has been chosen yet.

**Tilt lean (A14)** passed Claudio's phone test and stays opt-in, default off; whether it remains in the finished game is decided later. Keep touch available; permission denial or unsupported sensors must have a visible fallback and cannot count as a successful tilt test.

Presets (A baseline, B/C, candidates D/E/F) and adjustable assists exist for comparison by driving. No winning preset, assist strength or final crash-fairness verdict is required before implementation. Centralize driving/camera values with explicit units. Camera look-ahead/zoom should make obstacles and landings readable, including reverse and 20:9 layouts. No realistic tire model or ragdoll is needed for the gym.

## Crash, recovery and checkpoints

A chassis-attached head sensor provides the first crash candidate. Gym crash-reset defaults **off** (display only); a switch enables reset. Challenges initially enable it. Claudio tests whether head contact alone is fair; do not treat that rule or every rotation as a proven final failure condition.

**Recovery (implemented, still a playtest default):** R and the on-screen touch Retry restart at the current station's safe start. Author generous per-track safety bounds: leaving the visible camera is not out-of-bounds. Falling below/leaving those bounds resets through the same safe in-world path, even with head-crash reset off, and displays the reason. Do not auto-reset slow, stationary or stuck-looking experiments. Offer manual Retry instead; tune bounds from actual failures.

Retry restores canonical vehicle/world/input/camera/attempt state without collection reload (verified in A3); proxy reload is for track changes. Start the first challenge **without checkpoints**; if full restarts obstruct learning later sections, trial an authored checkpoint and compare feedback. A later checkpoint restores a defined safe section start and obstacle/input state, rather than an arbitrary physics snapshot. These are testable defaults, not claimed playtest results.

## Identity and fun acceptance

Trials contributes attitude/landing mastery; early TrackMania contributes routes that can be understood, solved and improved. Rider combines a springy buggy, physics obstacles and mobile retries, later in one illustrated 2D toy style with parallax. Differentiation is a design intention, not validated market evidence.

The first challenge combines braking, a controlled jump and timing/lean. Held throttle must fail a passage while skilled input succeeds reliably. Claudio judges control, landing consistency, readable/fair failure, challenge, retry, real simultaneous touch and motivation to try again. Technical checks cannot approve fun; iterate feel before adding features. Budgets/interpolation: see [platform matrix](PLATFORM_MATRIX.md); iOS follows the Play Store launch.
