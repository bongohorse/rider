# Course progress (#296)

**Contents:** [Route definition and limits](#route-definition-and-limits) · [Lifecycle and display](#lifecycle-and-display) · [Verification](#verification) · [Preview and stop point](#preview-and-stop-point) · [Engine evidence](#engine-evidence)

## Route definition and limits

Claudio accepted #279's drive test and authorized #295 completion/merge, then granted GO for this small #262 slice (2026-10-26). Independent review found/fixed unreadable alternate best-slot protection in #295; follow-up through `a80e57d` found no blockers, exact-head required 40407994187 passed and #295 merged as `8757c09`. Searches found no separate progress task, so [#296](https://github.com/bongohorse/rider/issues/296) was created and linked in #262. No medals, coins, fuel or further task GO.

The reference is the actual compiled **terrain polyline**, in metres, trimmed from projected START to the directed FINISH-line intersection. It is not rendered mesh depth, screen/camera position, an X fraction or accumulated chassis travel. Each segment contributes its Euclidean length; existing sampled curves are therefore measured on the same polyline used by physics. The accepted First run course/geometry/rules identity is unchanged: 168 m horizontal span, approximately **168.60154 m route length**. Best times stay compatible.

Initial topology: a horizontally directed, unbranched corridor with X-monotone terrain chains. Chains are ordered/oriented by their X spans solely to establish this supported topology; **position and length use 2D segment projection and arc length**. Internal vertical sections, climbs, descents and left-directed courses are supported. The live marker is the current projected route position and moves back on reverse. Repeating a position yields the same route distance, regardless of prior driving.

A clear gap has non-overlapping endpoint spans. Its reference is the straight chord between lip and landing; while the vehicle is horizontally inside that gap, projection onto the chord owns the airborne corridor. This is a declared flight convention, not a measurement of the vehicle's parabolic flight distance. The same immutable route descriptor survives Retry; cosmetic Terrain Look changes neither geometry nor reference.

**Explicit limits:** switchbacks/loops, overlapping or stacked chain spans/branches, vertical-only runs and retraced vertical sections, sectioned stations, unresolved START/FINISH and routes above the conservative 2048-segment admission limit are unavailable. START and the vehicle must be within 20 m of the reference; outside it the value is unavailable until the vehicle returns. FINISH must intersect the reference once in its declared direction after START. A course without FINISH has no progress HUD. Other unsupported finish-bearing courses show **Progress unavailable: reason** and hide the marker/percentage. No alternate hull-platform/branch routing or general route engine is inferred; the reference is the terrain corridor, not obstacle detours.

## Lifecycle and display

`course_progress.lua` is a pure immutable reference/projector. `progress_runtime.lua` is called from the existing controller tick owner: it observes the already-read chassis pose, using the existing metres conversion once. The existing update publishes a small separate message at up to 10 Hz (state changes immediately); it never changes physics, simulation time, inputs, source documents, the run authority, finish acceptance or storage. Worlds without FINISH publish their disabled status once. No second loop or manual stepping.

The First run HUD follows the existing ready/running/paused/failed/finished state. Ready/Retry force zero; pause/failure hold the value; a valid existing FINISH alone sets 100%. Projection at/beyond the end during an unfinished attempt is capped below 100% (display 99%). This never calls finish, creates a result or writes a best. Legacy custom courses with FINISH use their existing pause/finish/reset state and retain their previous timer behavior. Generation/attempt checks reject stale display messages after world switches/Retry.

Desktop uses a fixed ten-node native strip with Start, Finish, a cyan vehicle marker and an integer percentage below the run clock/best. Phone uses the same data in a compact strip within the existing mobile readout, below the toolbar. Pause/Retry, Terrain Look and the central result card stay accessible. The phone strip is hidden under the result modal or captured UI; underlying completion data still records 100%. No world sprite, physical body, terrain upload, pool or resource-cap changes. Route allocations are bounded and instance-owned; world teardown releases them with the existing owner.

## Verification

```sh
.cache/g1/luajit -joff tests/gameplay/progress.lua
node tools/gameplay/check_progress.cjs <release-url> <runtime-sha> <output>
```

Focused production geometry/adapter checks cover analytic ascent/descent arc length (different from raw X), internal vertical segments, left-directed routes, reverse/no-odometer behavior, flight chords, bounds/non-finite poses, topology/admission refusal, source immutability, ready/pause/finished states, end-of-bar without finish, unchanged timer, stale-attempt metadata and same-descriptor Retry.

`check_progress.cjs` is integrated in the existing desktop release verification after the unchanged complete-loop checks. It uses real keyboard input for forward/reverse and pause/Retry, checks actual native marker geometry, drives the existing LE3 ramp/gap/landing shape through FINISH, and imports an unsupported switchback to inspect its visible warning. It never teleports or sets progress, timers or physics. The existing phone loop additionally verifies visible progress, portrait/landscape bounds, frozen pause and zero after toolbar Retry. Existing complete-loop, saved-best, practice, cosmetic and injected persistence-failure assertions remain intact.

Initial pinned release `f5184c1`: four desktop progress workflows and three synthetic-touch workflows PASS, with no observed runtime errors. Actual gap sample 16.59077 / 40.21579 m (41%) is airborne; valid directed finish produces 100% once. Reverse moves the real marker from 10.62535 m to 9.74111 m; Retry keeps generation 1 and returns to zero. Screenshots of reverse, flight, unavailable and mobile ready were inspected. An initial helper read telemetry before its first publication and failed; the wait now checks its presence and that pilot is excluded from PASS evidence. Release `b735b33` additionally passed [four desktop progress workflows](gameplay-g2/desktop.json) and [three synthetic-touch workflows](gameplay-g2/mobile.json), including portrait/landscape readout bounds. Inspected [reverse](gameplay-g2/reverse.png), [gap flight](gameplay-g2/jump.png) and [portrait](gameplay-g2/portrait.png) captures. Final runtime/CI evidence is tracked in [PR #297](https://github.com/bongohorse/rider/pull/297) and STATUS.md.

Baseline check, 55 bootstrap, 31 Python CI, 79 Node CI/mobile, 39 G1 and 8 G2 tooling tests PASS. The final required inventory also retains the existing physics, editor, replay and release assertions. Synthetic browser touch/focus/resize does not establish real touch, phone performance, app switching or general human fun acceptance.

## Preview and stop point

Direct preview: http://127.0.0.1:8802/index.html?station=first-run . The exact tested release artifact, final CI and hosted build identity are recorded in PR #297 and STATUS.md. Test First run forward/reverse, Pause/Resume, Retry returning to Start, valid finish, best after reopen and Terrain Look. A short normal imported ramp/gap example is used for flight verification without changing the accepted official course or records.

**STOP before merge for Claudio's test; keep the progress PR draft. No next task starts automatically.**

## Engine evidence

Consulted official stable Defold 1.14.0 [GUI positions](https://defold.com/ref/gui/#gui.set_position), [GUI sizes](https://defold.com/ref/gui/#gui.set_size) and the existing screen-coordinate/layout helpers. The strip reuses the current native GUI/fonts and the existing mobile DOM surface. No new physics API or projection/renderer integration. Lifecycle/reset/units remain under the existing [physics contract](contracts/physics.md#lifecycle-and-tick-owner), with the same single owner and canonical reset path. Source and compiled formats stay unchanged under the [editor contract](contracts/level-editor.md#data-model).
