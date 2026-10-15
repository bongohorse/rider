# Rider — game design brief v0

**Purpose:** a 2D mobile driving game about mastering a lively buggy on short, readable obstacle tracks. Precise control, forgiving arcade assists and quick retries matter more than physical realism. This v0 proposes the product details below for Claudio's confirmation; the approved plan remains authoritative.

## Core loop and session

Observe the next obstacle → accelerate/brake and adjust attitude → land or fail → retry immediately → improve the run. Target challenge length is **30–60 seconds**. Suggested session length is **2–5 minutes**, with several attempts and no energy/wait system. The first deliverable is a free Driving Gym: a checkerboard level with test stations, live feel parameters and comparable presets. Challenge timer/best time arrive in Phase B; the gym has no countdown pressure.

## Controls and camera

Keyboard first; mobile uses four simultaneous zones: throttle, brake/reverse, lean left and lean right. Brake wins over simultaneous throttle; reverse engages only after braking near standstill. Keyboard and touch feed the same normalized tick commands. Left/right mobile zone placement is a testable proposal, to be settled with Claudio on the phone; tilt lean is an optional M3 experiment.

Air lean gives deliberate landing control. Motor/spring/assist values and camera look-ahead/zoom live in one feel configuration with explicit units. The follow camera keeps upcoming obstacles and landings readable, including reverse and 20:9 layouts. No realistic tire model, ragdoll or checkpoints are needed for the gym.

## Failure and retry

A chassis-attached head sensor detects rider contact. In the gym, crash-reset defaults **off**: show the crash and allow experimentation; a key/overlay switch enables reset. Challenges default **on**. Do not make every rotation a failure. Track bounds/stuck behavior must be explicit before the first challenge is finalized.

Retry restores the canonical vehicle/world/input/camera/attempt state **without collection reload**, subject to A3's measured correctness/latency. Proxy reload is reserved for track changes. The gym measures retry duration rather than inventing a performance claim.

## Distinct identity and first fun test

Trials contributes throttle, attitude and landing mastery; early TrackMania contributes compact routes that can be understood, solved and improved. Rider's proposed focus is a springy buggy, readable physics obstacles and short mobile attempts, later presented in one consistent illustrated 2D toy style with parallax depth. This is a design intention, not a claim of validated differentiation.

Phase B's first track combines a braking point, controlled jump and balance/timing obstacle. Holding throttle must fail at least one passage; skilled input must succeed reliably. Claudio separately judges control, suspension/landing consistency, readable/fair failure, challenge, prompt retry, simultaneous real touch and desire to try again. Technical checks cannot approve fun. If feel fails, iterate the vehicle before adding features.

## Open choices for confirmation and tests

- Is the proposed **2–5-minute session** right for Rider?
- Which four-zone placement is most comfortable, and should optional tilt survive M3?
- Which preset/assist strength feels best; is head contact alone a fair challenge crash rule?
- How should out-of-bounds/stuck recovery work, and does the first short challenge need checkpoints?

Claudio's reading/confirmation is required before M1. Concrete frame/physics budgets and visual-interpolation needs follow real measurements in A13; iOS waits until after the Android Play Store launch.
