# Physics lifecycle and single tick owner

The binding baseline is 60 Hz fixed timestep (`physics.use_fixed_timestep = true`, `engine.fixed_update_frequency = 60`) and four solver substeps. [G1_CONTRACT.md](G1_CONTRACT.md) records actual configuration, step/source evidence and observed callback order. Solver substeps are not extra gameplay ticks. Legacy solver iteration settings and the 3D-only `physics.max_fixed_timesteps` are not equivalent 2D catch-up controls.

Capture input, normalize/apply one command per physics tick, let Defold simulate, read state/contact information at the verified callback point, and interpolate visuals only if measurements justify it. Never assume ordering between script instances or that a fixed callback occurs before/after the world step without evidence. One tick owner; no manual stepping or second world loop.

Measure render frequency, fixed callbacks and actual physical progress separately; callback counts alone do not prove steps/substeps. A render fallback to 30 FPS does not change 60 Hz physics. Changing the physics basis requires a documented comparison and approval.

Never create/destroy bodies or joints inside unsupported/locked contact callbacks. Queue mutations into a proven safe window, defining order, errors and returned-handle validity. Keep the queue no larger than actual gym needs.

On stalls/background: measure engine delta/catch-up behavior, do not introduce unlimited catch-up, clear held inputs after prolonged inactivity, and pause/resume safely without extra forced steps. Visual interpolation stays unchanged unless measured pacing problems require it ([platform matrix](../../PLATFORM_MATRIX.md)). Report discarded simulation time or slowdown separately from tick-state comparisons.
