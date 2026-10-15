# Physics units

[G1_CONTRACT.md](G1_CONTRACT.md) is the verified conversion matrix; [historical source observations](../../history/G1_PROGRESS.md) distinguish body torque from motor torque. Source observations alone do not validate a new adapter.

For every used API record the units of position, velocity, acceleration, force, impulse, torque, angle and angular velocity. Determine whether `physics.scale` applies or whether the binding accepts internal world/Box2D units. Convert exactly once at a defined adapter boundary; do not merely assert a pixels-per-metre ratio.

Specify units for camera, GUI, terrain generation, debug drawing and contact points. Internal angles are radians; UI angles may be degrees. Label displayed speed units explicitly. A6 centralizes driving/camera values with the unit adapter; distinguish motor target angular speed from achieved vehicle speed.

Validate gravity/fall distance and joint distance with a deliberate scale change to detect double conversion. Define numeric tolerances before running. Preserve existing Windows/HTML5 unit regressions and add real Android evidence when available. No claim of new API compatibility follows from the old tests.
