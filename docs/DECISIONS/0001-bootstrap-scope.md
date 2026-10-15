# ADR 0001 — Rider G0 scope and review clarifications

Date: 2026-10-15. Decision: fresh repository bootstrap, no migrated game components. User supplied bongohorse/rider and authorized all repository operations for setup. Later gates remain separately authorized.

Use the supplied v1.4.1 plan as background. The following clarifications resolve review findings without broadening G0:

- G0 documents the G1 smoke-runner contract only. No runner implementation, game.project or app manifest now.
- Actual engine binaries must match manifest/backend/variant; generic headless binaries are not automatically equivalent.
- Commands and vehicle updates must not depend on the unspecified order of different script instances. One explicit tick owner selects and applies commands.
- G1 initializes and measures a canonical start before releasing input; any settling uses a defined tick count.
- G3 Android APK and browser both prove backend, motor/spring behavior and reset, in addition to touch/lifecycle. Linux belongs in the API matrix.
- Engine messages lacking a session generation require state/sender/object validation; generation tags alone are not sufficient.
- Pause must leave the outer control UI able to resume/reset. Profile and implement only necessary worlds/components.
- Test setup/cleanup errors and crashes through controlled shutdown fail the suite. Results identify source SHA, effective config and binary variant.
- Test playback does not replace actual touch/keyboard input-chain tests. Exclude all application-specific test entry points from public release, not just Bridge routes.
- English UI and an early browser preview are explicit requirements. Preview deployment is a separate authorized action; no empty placeholder site is deployed in G0.
- G5 requires both APK and Android browser performance within predeclared bounds: maximum frame times, minimum simulation progress excluding pause/background time.
- In G4a read “P0 mechanics” as the actual gate's listed mandatory mechanics; no undefined priority inventory.

Rejected alternatives: import legacy code; build a speculative engine abstraction; start G1 before G0 review. Consequence: repository CI checks bootstrap correctness only, never physics or gameplay readiness.
