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
3. **Torque numbers are not interchangeable · the joint motor-cap binding scales by `physics.scale`, body torque does not · preserve separate unit adapters.** [PR #48](https://github.com/bongohorse/rider/pull/48); [A6 binding evidence](../../main/gym/README.md#a6-feel-trial).
4. **A cached shape index can delete the new chain · indices can change on creation · remove the known resource seed before creating the chain; re-query shapes before later indexed operations.** [PR #41](https://github.com/bongohorse/rider/pull/41); [a1: `M.probe_tick`](../../main/gym/scenarios.lua) checks chain support.
5. **Browser down/up pulses can disappear · engine input is sampled across frames · hold until the game acknowledges, then release.** [PR #43](https://github.com/bongohorse/rider/pull/43), [PR #49](https://github.com/bongohorse/rider/pull/49); [a3/a7 browser input handshake](../../tools/gym/browser.cjs).
