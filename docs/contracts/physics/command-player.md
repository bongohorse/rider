# Tick-command playback and visual ghosts

Use the smallest test adapter the active issue needs. A21 records commands and compares presets; A22 adds regressions for 2–3 stations after approved feel values. Do not build a separate general replay product.

- Record canonical configuration, creation order, initial poses/velocities and first active command tick. Tick zero follows confirmed initialization/READY, without unmeasured preroll.
- Apply exactly one normalized command per tick through the same vehicle path as live play. Disable live input during playback; direct pose writes are not a substitute for vehicle control.
- Explicitly define missing-tick, duplicate and out-of-order command policy; reject invalid traces. Do not silently vary hold behavior.
- Define checkpoints, outcome conditions and tolerances before running; repeat from fully reset state. Compare identical commands under at least two measured render rates (e.g. 30/60 FPS), keeping 60 Hz physics. Frames are not command indices. Record stalls, overload, pause and discarded time separately; compare equal physics ticks only under comparable execution and do not hide slowdown.
- A successful trace and a deliberately unsuitable trace must each produce their expected outcome. Expected challenge failure is a passing negative test, not an infrastructure failure.
- Keep test playback, gameplay replay and visual ghosts distinct. A21's translucent ghost uses recorded transforms as a visual reference, without requiring cross-platform bit-exact re-simulation. The candidate vehicle can run the recorded commands under a different preset alongside the ghost; same-run comparison does not require a split-screen renderer.
