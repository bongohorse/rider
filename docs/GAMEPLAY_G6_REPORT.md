# Complete fuel system (#318)

**Contents:** [Rules and authoring](#rules-and-authoring) · [Tick and vehicle boundary](#tick-and-vehicle-boundary) · [Compatibility and records](#compatibility-and-records) · [Verification and stop](#verification-and-stop)

## Rules and authoring

Claudio explicitly combined G6a/G6b/G6c on 2026-10-30. Level Properties → FUEL configures enabled state, starting tank %, time consumption %/s, additional powered-input consumption %/s, low warning % and **one shared refill percentage** for every canister in the course. The later clarification removes individual canister contents. All values use percentage points, capacity is 100%; start/warning/rates/refill allow 0–100. New-course defaults are start100/time1/drive1/warning20/refill35; both rates may independently be zero. Disabling fuel retains authored settings without affecting ordinary driving.

Gameplay → Fuel places sprite-only canisters using existing source object/pickup IDs, selection, dragging, copy/paste/mirror, locks, Drop/Along, Delete, Undo/Redo, draft/My levels and Export/Import. Copies get fresh IDs. All canisters use the single course-wide refill value, including locked objects: object locks protect edits to that object, not shared gameplay rules. Each touched canister is consumed once per attempt **even at full tank**, with refill capped at 100%. Retry restores the configured starting tank, canisters and transient feedback. The existing combined 128 pickup and source/resource caps remain. Auto Add Coins preserves gems and canisters.

Numeric fuel HUD/bar, explicit LOW FUEL/EMPTY text and pickup rise/fade/refill acknowledgement use existing UI/Sprite resources. No colour-only warning. Empty fuel disables powered motion in both directions while coasting, braking and lean remain available. A refill restores powered motion; reverse still follows its existing delay. There is no automatic failure for empty/stopped vehicles. Manual Retry and a valid coasting finish remain possible. Editor Play remains practice; fuel never grants coins or gems.

First-run provisionally uses start60, time1, drive2, warning20 and shared refill35, with two canisters at x50/x110 above the unchanged surface. This makes a missed refill recoverable and offers margin for slower runs; actual fairness evidence and human observations must be distinguished below/in the PR. No physical terrain, medal targets, vehicle coefficients or banked gem identity changed.

## Tick and vehicle boundary

The existing controller fixed callback owns fuel. It consumes the previously applied tick's simulation dt and the actual powered-input ratio after `vehicle.apply` distinguishes forward drive, braking and delayed reverse. Time cost applies throughout an active attempt, including idle/coasting/braking/air; drive cost is additive and excludes pure braking. No consumption at READY, pause/loading/Edit or after terminal state. Custom practice attempts start fuel on their first drive/brake/lean command. Refills use the existing multipart observed-position sweep, before finish evaluation; the same-tick pickup can supply fuel before the next applied command. Collection still deduplicates stable IDs. No physics sensor, body, manual step, contact mutation or extra simulation owner.

At empty, the existing vehicle adapter suppresses drive/reverse motor speeds and uses existing brake/coast torque branches. It does not disable wheel joints or the world. Steering/lean remains unchanged. Fuel-free courses use the same prior command and motor decisions. Canonical Retry clears fuel step/power/started state as well as pickup state and sprite effects.

Pinned Defold 1.14.0 [joint source](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/gamesys/src/gamesys/scripts/box2d/v3/script_box2d_joint_v3.cpp) confirms wheel motor speed in rad/s and the existing physics-scale conversion for maximum motor torque. Existing setters remain inside the unlocked fixed owner. This change reuses those setters/units, not a new physics API. Original canister art is reproducible via `tools/art/fuel.py` and uses the existing shared atlas/factory.

## Compatibility and records

Editor/compiler 11 explicitly versions fuel settings and `kind="fuel"` on existing pickup objects. Fuel-bearing compiled stations require schema4; lists containing canisters require coin-data3. Ordinary-only and gem-only compiled versions remain 2/1 and 3/2; legacy source 1–10 upgrades without adding fuel. Unknown settings/versions, duplicate IDs, per-item contents and nonfinite/out-of-range input are refused/protected. Authored Terrain Look accepts source11 without geometry or look-format changes. Disabled fuel is represented explicitly; canisters on a disabled course have no tank effect or currency reward.

Official fuel rules change competition identity. First-run increments authored race revision to2, preserving old best/medal files; the record namespace also includes exact starting/time/drive/refill values. Warning threshold is presentation-only. Future shipped course/canister-layout changes must bump `race_revision`, as geometry already requires. Gold bank and per-course/pickup gem claims remain independent and retain previous earnings. No attempt-resume/tank persistence is introduced; durable data is the authored course/settings and the existing legitimate results.

## Verification and stop

Production checks exercise the real `vehicle.apply` boundary (forward/reverse cutoff, reverse delay, braking/coast torque and lean), exact prior-step consumption, READY/pause/terminal/custom-start/Retry, bounds, shared/full/capped refill, collection deduplication, source IDs/paste/roundtrip/schema protection, ordinary/gem separation, Auto preservation and record identity. Existing production gameplay/bank checks remain required. Real-input editor/release tests, captures, exact build identity and CI/review evidence are recorded in STATUS.md and the PR as completed. An interrupted probe during the shared-refill correction is not a PASS.

Stop with a normal playable release for Claudio's final practical acceptance before merge. No subsequent gameplay task is authorized. Browser touch emulation does not prove reference-phone input, interruptions or performance; physical-device acceptance is NOT RUN unless separately observed.
