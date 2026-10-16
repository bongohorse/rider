# Engine pitfalls

Short, curated list of Defold 1.14.0 / Box2D 3.1.0 traps that cost real time and can recur. Not an error log.

**Add an entry only if all three are true:**

1. It cost significant time or produced a wrong result that tests/CI did not catch at first.
2. It can recur elsewhere (other vehicles, objects, stations, platforms).
3. It is not obvious from the code or the official docs.

Prefer, in this order: a regression test → a comment at the code spot → an entry here. Format: what happens · why · how to avoid · PR/test, at most three lines. No logs, narratives or routine bugs (typos, a first red test, flaky CI). Review at every milestone end and remove obsolete entries.

## Entries

1. **Reset snaps back to the old pose.** Dynamic transforms are on by default (`physics.allow_dynamic_transforms`), so the next step copies the game-object pose into the body. Set both GO pose and body transform. · PR #43, `tools/gym/smoke.py --case a3` (pose checked on the next tick)
2. **A sleeping buggy ignores throttle.** Wheel-joint motor enable/speed/torque setters do not wake bodies. Call `b2d.joint.wake_bodies` before applying drive/brake. · PR #43, `smoke.py --case a3` (re-drive from sleep)
3. **Torque units differ.** `b2d.joint.set_max_motor_torque` scales its input by `physics.scale`; `b2d.body.apply_torque` does not. Route every value through the feel/unit adapter, never mix raw values. · PR #48, `main/gym/README.md` (A6)
4. **Do not scale chain vertices.** `b2d.body.create_chain` already applies `physics.scale` to vertices and ghost vertices; converting again doubles it. Pass engine units. · PR #41
5. **Shape indices shift.** A collision object needs a seed shape; remove it (index 1) before `create_chain`. Indices are not stable after creation, so never delete by index afterwards. · PR #41
6. **Filter tables need every field.** With an explicit filter, `create_shape` requires `category_bits`, `mask_bits` and `group_index` (no default, unlike chains). · PR #49
7. **Same-frame input pulses are lost.** A key or mouse down/up within one frame is not reliably sampled by the engine in browser tests. Hold until the game acknowledges, then release. · PR #43, PR #49, `tools/gym/browser.cjs`
