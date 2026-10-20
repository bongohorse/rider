# Engine pitfalls

**Add an entry only if all three are true:**

1. It cost significant time or produced a wrong result that tests/CI did not catch at first.
2. It can recur elsewhere (other vehicles, objects, stations, platforms).
3. It is not obvious from the code or the official docs.

Prefer a regression test, then a comment at the code spot, then an entry here. If a test already enforces it, keep only one line with the test name. Entry format: **what happens · why · how to avoid** · PR/test link; at most three lines. No logs, narratives or routine bugs (typos, a first red test, flaky CI). Review at every milestone end and remove obsolete or redundant entries.

Short list for pinned Defold 1.14.0 / Box2D 3.1.0. Recheck on engine updates; historical evidence is not a promise about other versions.

## Entries

1. **Reset snaps back · dynamic GO transforms default on and can overwrite a body-only reset next step · synchronize both GO/body poses.** [PR #43](https://github.com/bongohorse/rider/pull/43); [a3: `M.check_pose`](../../main/gym/scenarios.lua) checks next-tick persistence.
2. **Sleeping vehicle ignores drive · wheel motor setters do not wake connected bodies · call `wake_bodies` before drive/brake.** [PR #43](https://github.com/bongohorse/rider/pull/43); [a3: `M.reset`](../../main/gym/scenarios.lua) verifies fresh-input re-drive from sleep.
3. **Torque numbers are not interchangeable · the joint motor-cap binding scales by `physics.scale`, body torque does not · preserve separate unit adapters.** [PR #48](https://github.com/bongohorse/rider/pull/48); [gym vehicle notes](../../main/gym/README.md#vehicle-and-controls).
4. **A cached shape index can delete the new chain · indices can change on creation · remove the known resource seed before creating the chain; re-query shapes before later indexed operations.** [PR #41](https://github.com/bongohorse/rider/pull/41); [a1: `M.probe_tick`](../../main/gym/scenarios.lua) checks chain support.
5. **Browser down/up pulses can disappear · engine input is sampled across frames · hold until the game acknowledges, then release.** [PR #43](https://github.com/bongohorse/rider/pull/43), [PR #49](https://github.com/bongohorse/rider/pull/49); [a3/a7 browser input handshake](../../tools/gym/browser.cjs).
6. **Authored launch speed does not guarantee rolling speed · pinned Box2D caps normal angular speed at 0.25π/full dt; Defold exposes no fast-rotation flag · qualify actual vx windows before comparing terrain.** [A18 / PR #113](https://github.com/bongohorse/rider/pull/113); [trace qualification regressions](../../tests/ci/seams.test.cjs).
7. **A non-zero reset angle reads back about 0.002 rad off · pinned Box2D 3.1 `b2MakeRot` (used by `set_transform`) approximates cos/sin · compare reset angles with a tolerance (0.005 rad), never exactly.** A19d; [`seesaw.reset`](../../main/gym/seesaw.lua) and the `a19d` mid-tip retry.
8. **A bundle can silently ship the stock Box2D v2 engine · Bob falls back to the stock engine for any architecture whose extender result is missing from `build/<arch>/` (seen once for `wasm_pthread-web` after a "successful" extender job) · `tools/g1/build.py` fails every build unless each bundled engine is that build's extender result. If Bob starts modifying the engine while bundling (a `[windows] app_icon`, Android executable stripping), that guard fails too and needs an explicit rule.** [#208](https://github.com/bongohorse/rider/issues/208); [`tests/g1/test_engine_guard.py`](../../tests/g1/test_engine_guard.py).
9. **A retry can inherit a part-used sleep timer · pinned Box2D 3.1 keeps `body->sleepTime` through `b2Body_Disable`/`Enable`, `SetTransform`, the velocity setters and `SetAwake(true)` on an awake body; only `b2WakeSolverSet` ([solver_set.c L56–57](https://github.com/erincatto/box2d/blob/v3.1.0/src/solver_set.c#L56-L57)) or a non-sleepy step ([solver.c L617–651](https://github.com/erincatto/box2d/blob/v3.1.0/src/solver.c#L617-L651)) clears it, so a slow body reset while awake can fall asleep within a tick · force a sleep→wake cycle (`set_awake(false)` then `true`) on a fresh island in the reset window.** [#217](https://github.com/bongohorse/rider/issues/217); [`seesaw.reset`](../../main/gym/seesaw.lua) and `a19d` `seesaw_retry_history_independent`. The vehicle reset has the same latent timer, but its 0.38 m drop makes it non-sleepy from the first step; it is unchanged.
