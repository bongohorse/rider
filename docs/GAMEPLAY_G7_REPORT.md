# Level progression and selection (#320)

**Contents:** [Rules and identity](#rules-and-identity) · [Storage and ownership](#storage-and-ownership) · [Selection and switching](#selection-and-switching) · [Verification and stop](#verification-and-stop)

## Rules and identity

Claudio approved durable progression, level selection and Next Level after G6 on 2026-10-30. The bounded official catalogue is First run → Rolling Hills → Ridge Run. Successful official completion unlocks the next course without requiring any medal, coin or Wonder Gem. The two additional Rider-authored rolling courses are prototypes for this flow, not the final balanced world set. Both reuse the same vehicle, finish, medals, coins, gems and global fuel/refill rules.

Completion uses the stable shipped course ID. Record revision/rules changes retain unlocks; existing best times and medals keep their exact `medals.key` namespace. Gem claims retain their existing course/pickup IDs and bank. A valid acknowledged legacy official personal best is evidence of an earlier finish and adopts completion. Editing/importing an official course creates a custom practice identity and cannot unlock levels.

## Storage and ownership

`level_progress.lua` owns a bounded version-1 absolute completion set in `level-progress-a/b`, using existing `custom.slot_store` write/readback and HTML5 sync acknowledgement. The loader instance survives world switches. Pending completion does not expose a new unlock. Repeated finishes have no additive effect. Failed writes/sync are reported; corrupt, unreadable or future-version alternate slots protect both files. The previous acknowledged state stays visible. Unknown but syntactically valid course IDs are retained within the 128-entry bound, allowing catalogue changes without deleting claims. No cloud storage, multi-tab transaction protocol or attempt resume is introduced.

`run_runtime.finish` offers the immutable official result once. The loader accepts only the active owner's generation in an official catalogue world, outside Edit/loading. The progress store also refuses locked, unknown or practice completions. Best and coin/gem stores retain their existing separate acknowledgements; completion does not infer rewards from transient counters.

## Selection and switching

The browser's responsive selection surface shows all courses with a terrain silhouette sampled from trusted shipped geometry, name, best, highest medal, saved Wonder Gem claims and locked/completed state. It supports keyboard focus and Escape/Back. Native platforms use the same catalogue/state with a bounded GUI course browser and terrain silhouette. No image downloads or external assets are needed.

Levels is available during a run and after a result. Opening it captures gameplay and suspends the existing proxy time owner; elapsed time, physics and fuel freeze. Back resumes only a previously running world; an existing pause or terminal result stays paused. Next Level appears only after an official finish and acknowledged unlock. Retry retains the existing canonical same-world reset. The last course has no Next Level target.

All selection commands use the existing loader unload/load/configure path and clear held inputs. The loader checks locks even for direct URL/station selection. An initial non-first official URL stages the first safe course while progress is checked, then opens the requested course only if unlocked. Gym station ordering/number keys and custom/editor storage are independent. New official courses use the same finish-stop and focus-loss suspension as First run.

## Verification and stop

Evidence with exact runtime heads, checks and limitations is tracked in STATUS.md and [PR #321](https://github.com/bongohorse/rider/pull/321). Production tests cover completion acknowledgement, sequential admission, duplicates/practice, legacy adoption, reopen and protected/failing storage. Ordinary release tests drive the three-course chain, read the menu, reopen progress and select courses through actual UI; touch emulation uses Chromium touch input and is not physical-device evidence. Existing gameplay/editor/physics checks remain required.

No new Defold API or physics ownership mechanism is introduced. Reuse the pinned 1.14.0 proxy time-step/input acknowledgement described in the [physics contract](contracts/physics.md#pause-slow-motion-and-live-tuning), alternating sys.save/sys.load slots and the current GUI layout/picking/line helpers. Existing engine/API references are in [engine references](ENGINE_REFERENCES.md). No new dependency, pool or tick owner.

Stop with a directly playable preview for Claudio's menu/progression drive acceptance before merge. No following content/audio/mobile-polish task is authorized. Real phone behavior, native GUI runtime, hardware performance and final course balancing require their own evidence.
