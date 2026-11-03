# Issue #262 archived planning text

Full body of [#262 [Gameplay] Complete game loop: timer, progress, medals, coins and fuel (epic)](https://github.com/bongohorse/rider/issues/262) as of 2026-11-02, moved here (unchanged except repo-relative links made absolute) during the issue cleanup ([issue guide](../ISSUES.md#length)). Current scope, binding rules and GOs live in the issue body, its sub-issues and `status:` labels; superseded parts of this text are history.

**Contents:** [Goal and status](#goal-and-status) · [Index](#index) · [Research basis and approved delivery plan](#research-basis-and-approved-delivery-plan) · [Ownership and dependencies](#ownership-and-dependencies) · [Logical delivery order](#logical-delivery-order) · [Run lifecycle, timer and progress](#run-lifecycle-timer-and-progress) · [Results and medals](#results-and-medals) · [Coins and special coin](#coins-and-special-coin) · [Fuel tank and refills](#fuel-tank-and-refills) · [Persistence and level selection](#persistence-and-level-selection) · [Level authoring and balancing](#level-authoring-and-balancing) · [Presentation, mobile and release](#presentation-mobile-and-release) · [Shared acceptance](#shared-acceptance) · [First slice and open decisions](#first-slice-and-open-decisions)

## Goal and status

Turn Rider's driving/editor foundation into a complete mobile game loop: select a level, drive, collect rewards, manage fuel, finish, see results and try again.

Requested by the maintainer on 2026-10-22. **Delivery status (2026-10-31): G1–G7 and coin-editor #302–#307 are delivered/closed.** G5 Wonder Gems [#314](https://github.com/bongohorse/rider/issues/314), G6 fuel/refills [#318](https://github.com/bongohorse/rider/issues/318), and G7 durable level selection/progression [#320](https://github.com/bongohorse/rider/issues/320) are also closed. The author drive-tested all three current levels on 2026-10-30; they were reported working. **This epic remains open** for content/polish, release and physical-phone acceptance, rather than for unfinished G5/G6/G7 implementation. New changes still require explicit GO.

**Explicitly requested:** run timer, course progress indicator, three target times per level (Gold/Silver/Bronze), ordinary coins, multiple harder-to-reach purple special coins (Wonder Gems), each worth +1 on successful finish, and a Hill Climb-inspired fuel tank with refills.

Other rules below are proposed defaults unless identified as a requirement. Unresolved reward/fuel decisions must be settled when their slice is scoped.

## Index

- [Research basis and approved delivery plan](#research-basis-and-approved-delivery-plan)

- [Ownership and dependencies](#ownership-and-dependencies)
- [Logical delivery order](#logical-delivery-order)
- [Run lifecycle, timer and progress](#run-lifecycle-timer-and-progress)
- [Results and medals](#results-and-medals)
- [Coins and special coin](#coins-and-special-coin)
- [Fuel tank and refills](#fuel-tank-and-refills)
- [Persistence and level selection](#persistence-and-level-selection)
- [Level authoring and balancing](#level-authoring-and-balancing)
- [Presentation, mobile and release](#presentation-mobile-and-release)
- [Shared acceptance](#shared-acceptance)
- [First slice and open decisions](#first-slice-and-open-decisions)

## Research basis and approved delivery plan

Plan approved by Claudio on 2026-10-24: prioritize **long, visually substantial 2D courses that are fast to author and smooth to play**. Issue creation approves backlog organisation, not runtime implementation or a new milestone. Preserve the existing per-task scope/GO/drive-test process.

Primary references: [HCR2 technical reference](https://github.com/bongohorse/rider/blob/main/docs/research/HCR2_Technical_Reference_for_Rider.md), [asset/graphics findings](https://github.com/bongohorse/rider/blob/main/docs/research/assets_findings.md), [native findings and limitations](https://github.com/bongohorse/rider/blob/main/docs/research/native_findings.md). Original shader math supports terrain-body extension, depth/UV changes and authored lighting; some original models have depth coordinates. HCR2's full CPU mesh generator, projection, chunk/culling policy, physics laws and numerical tuning are not recovered. Treat our architecture as independent Rider work, using Rider-owned art/code.

### Concrete first slice and dependencies

- [x] #279 — one authoritative run timer, exactly-once finish/result and persisted personal best on one short existing course.
- [x] #296 — compact current-position progress along the actual route, with reverse/Retry handling and explicit unsupported-topology limits (Claudio GO 2026-10-26; after accepted #279).

- [x] #298 — authored Gold/Silver/Bronze times, durable highest medal and next-target result; existing editor fields/save/Undo (Claudio GO 2026-10-26; after accepted #296 / merged #297).

- [x] #300 — ordinary coin authoring, once-per-attempt collection and finish-only durable credit (**PR #301 merged 2026-10-28**).
- [x] #302–#307 — world-sized editor coin rendering, tool/category layout, editable exact zoom, Drop to Track, shared Along track movement and bounded Auto Add Coins preview/Apply (**PRs #308–#313 merged 2026-10-28**).
- [x] #314 — G5: author, collect and bank multiple Wonder Gems at valid finish, with editor support and feedback (delivered).
- [x] #318 — G6: configurable fuel consumption, HUD and refill pickups (delivered).
- [x] #320 — G7: durable level selection, unlock/progression, Retry and Next Level (delivered).

This short slice does **not** require completion of #263 or the long-course renderer. Reuse current accepted driving/camera foundations and the existing #36 record/replay instead of creating another system. The larger product focus remains #263/#121 plus selected #168/#169 tools; a complete short gameplay loop stays independently deliverable.

Use stable course/run/pickup IDs, route segment + local parameter/arc length where supported, and one simulation-clock/race authority. Rendering/interpolation, HUD smoothing and visual animation cannot own rewards, fuel or finish. Reset and pause clear stale events and input. Declare topology support; world X alone cannot describe general course progress.

G1–G7 and the bounded coin-editor additions are delivered. The historical feature proposals below document original design constraints; for implementation-specific decisions, refer to [G5](https://github.com/bongohorse/rider/issues/314), [G6](https://github.com/bongohorse/rider/issues/318) and [G7](https://github.com/bongohorse/rider/issues/320) and their merged PRs. Remaining content, acceptance and device checks are not implicitly complete. #120 provides reusable trigger/event mechanisms; #262 owns scoring, collection, fuel and reward policy. #198 custom builds remain isolated from official results. Level authoring uses #170/#121 boundaries and the same runtime, not a second editor.


## Ownership and dependencies

- Reuse current vehicle/input/feel, camera, physics ownership, fixed-tick lifecycle and canonical Retry.
- Existing START/FINISH and editor work: #124, #118. Later challenge authoring: #170. Reuse these rather than creating another level editor.
- #120 remains the shared interactive-object/runtime catalogue. Reuse trigger/collectible capabilities; this epic defines the requested coin rewards and game progression integration.
- #121 owns visual/environment authoring. #198 owns custom vehicle construction. #230 owns procedural content generation.
- Official medal comparisons need a declared vehicle, preset/assist configuration, course revision and gameplay rules. Custom vehicles must not silently replace official results.
- Fuel/coins must be optional per course/mode. Existing gym experiments and physics baseline protocols must retain their declared behaviour.
- No new physics engine, manual stepping, online account, leaderboard, shop or monetization system is required.

## Logical delivery order

| Order | Work | Concrete outcome |
|---|---|---|
| 1 | Driving foundation | Accepted control, grip, suspension, air control and camera; readable approaches and landings |
| 2 | Level/run lifecycle | Safe start, directed finish, pause, declared failure rules and prompt Retry |
| 3 | Timer | One authoritative elapsed time for the active attempt |
| 4 | Course progress | Readable start-to-finish indicator based on actual route progress |
| 5 | Results and personal best | Finish screen with time, record, Retry and next-level action |
| 6 | Gold/Silver/Bronze | Three authored target times and highest earned medal |
| 7 | Ordinary coins | Authored pickups, attempt counter and declared reward settlement |
| 8 | Special coin | Multiple optional purple Wonder Gems with persistent +1 per new course/pickup ID |
| 9 | Fuel tank | Consumption, HUD, refills, warnings and empty-tank behaviour |
| 10 | Durable progress | Reliable records, rewards, settings and unlock persistence |
| 11 | Level selection | Preview, best time, medal, special-coin status and unlock state |
| 12 | Introduction | Short playable explanation of driving, rewards and fuel |
| 13 | Finished course set | Hand-authored levels balanced around all selected mechanics |
| 14 | Sound and effects | Driving, pickups, refills, warnings, finish and record feedback |
| 15 | Mobile polish | Readable HUD, touch controls, pause/settings and interruption handling |
| 16 | Android/release | Real-device quality/performance, release build and store preparation |
| 17 | Later expansion | More worlds, objects, checkpoints, car editor and generated courses under their existing owners |

Persistence must accompany the first permanent reward/record, not wait until step 10. Basic mobile readability and feedback accompany every slice; later steps complete the wider experience. Prototype levels are needed throughout; final course balancing follows fuel and reward rules.

## Run lifecycle, timer and progress

### Run state

Define one authoritative attempt identity and transitions between ready, running, paused, finished and failed. Retry clears transient state through the existing reset owner. Exactly one finish/result commit per valid attempt.

- Declare the precise start event before implementation: proposed default is an explicit start/unfreeze event, with no timer or fuel drain during loading.
- Pause and app backgrounding stop gameplay time and consumption. Clear held input and require a safe resume.
- Editor mid-course starts/debug teleports are practice attempts and cannot earn official medals, records or permanent rewards.
- Retain manual Retry; do not add an automatic inactivity/stuck reset.
- No race deadline is implied by the timer or Bronze threshold.

### Timer

- Start/reset/stop with the authoritative run lifecycle.
- Use simulation time from the existing lifecycle; rendered frames and display formatting are not the scoring clock.
- Compare medals and records using canonical unrounded values. Display precision and exact threshold behaviour must be explicit.
- A lower render frame rate must not itself change the scoring rule.
- Finish freezes the result; pause/resume and duplicate finish events cannot add time or create multiple results.

### Course progress

- Show a compact bar or marker from start to finish.
- Define a route reference and progression semantics. Raw world X is insufficient for vertical sections, reverse-direction courses or overlapping routes.
- First scope may support simple directed courses only; unsupported topology must be declared rather than displaying misleading progress.
- Decide whether the main marker shows current route position or furthest valid progress. Proposed default: current position, with optional best-progress marker later.
- Do not count repeated back-and-forth distance as forward completion.
- Reaching 100% visually does not replace valid finish crossing.

## Results and medals

Each level has **three authored target times: Gold, Silver and Bronze**.

- Validate positive finite thresholds with Gold < Silver < Bronze.
- Proposed award rule: time ≤ threshold earns that medal; award the highest qualifying medal.
- Slower valid finishes still complete the level, without a time medal.
- Show current result, personal best, earned medal and gap to the next medal.
- Store highest medal and fastest valid time without downgrading previous achievements.
- Define revision handling when course geometry, physics or medal thresholds change.
- Keep official vehicle/rules results separate from practice and custom-vehicle results.

Proposed intent: Bronze rewards a competent finish; Silver clean driving; Gold a demanding fast run. Establish actual times through drive tests, not arbitrary percentages.

## Coins and special coin

### Ordinary coins

- Place coins deliberately along useful driving lines and controlled jumps.
- Show an attempt coin counter and immediate pickup feedback.
- Stable pickup IDs; the vehicle's multiple bodies/shapes cannot collect the same pickup repeatedly.
- Retry restores attempt pickups according to the declared reward policy.
- Use lightweight pickup logic and bounded effects; decorative coin animation must not require dynamic rigid bodies.
- No shop or upgrade economy is implied by a coin balance.

### Special coin

- **Multiple Wonder Gems per level**, optional and harder to reach (Claudio 2026-10-30 supersedes the one-coin proposal). Existing combined pickup/resource caps apply.
- Distinct shape/icon and feedback, plus persistent “collected” status in level selection.
- Approved finish-only permanent +1 per newly earned course/pickup ID; repeated collection cannot duplicate that reward.
- It may require a slower detour. Gold and the special coin need not be achievable in the same run.
- Clearly distinguish previously earned status from collection during the current attempt.

### Reward settlement — decision needed

Claudio approved the ordinary-coin policy for #300 on 2026-10-27: valid official finishes bank attempt coins; failed/abandoned/retried attempts lose unbanked coins; repeated valid runs may earn again; duplicate finish/write retries must not duplicate credit; editor/practice earns no permanent credit. Special-coin banking was approved finish-only on 2026-10-30 in #314.

Approved for #300: ordinary coins are credited only on a valid official finish. Failed/abandoned/retried attempts discard unbanked coins; repeated valid finishes may earn again. Duplicate terminal events and storage retries must not double-credit; editor/practice attempts earn no permanent coins.

Wonder Gems settle only on valid official finish. Failed/abandoned/retried attempts lose unbanked gems; practice grants none. Existing IDs retain their claims across moves/revisions; new IDs can earn new +1 rewards. Avoid duplicate grants on repeated finish events, reloads or save retries.

## Fuel tank and refills

**Delivered 2026-10-30: #318 combined the previously planned G6a/G6b/G6c into one implementation issue/PR.** The three-step list below is historical planning, not open implementation work. Editor-configured start %, additive time/powered-input rates and one course-wide refill % shared by all canisters; canisters consumed even when full. Empty retains braking/coasting/lean and manual Retry; refills recover power. No individual canister contents.

Hill Climb-inspired gameplay resource, not a real fuel simulation.

**Proposed small-task order (planning only, no implementation GO):**

1. **G6a — Fuel runtime and HUD:** define the consumption model (including neutral/air/brake/reverse), fixed-tick owner, capacity/starting amount, low/empty state, motor cutoff with continued coasting/braking, pause and canonical Retry. First playable test course without canisters.
2. **G6b — Refill authoring and collection:** use existing editor source IDs, Undo/Save/Reload and the established pickup sweep for bounded canisters; choose full-tank pickup semantics and show feedback. No new trigger framework or physics body per pickup.
3. **G6c — Fairness and course balancing:** define the stopped/empty failure-recovery rule without an immediate zero-fuel failure, tune refill spacing and HUD readability on the reference phone, and verify persistence/Retry/regressions.

Create each narrowly scoped issue/PR only after rechecking the immediately preceding merged work and receiving the user’s explicit GO. The proposed order is **G5 special coin #314 → fuel G6a → G6b → G6c**, unless reprioritized. The policy questions below remain unresolved; this outline does not approve default parameters.

Required slice:

- Tank capacity, starting amount, consumption and fuel HUD.
- Authored refill canisters with stable IDs and bounded refill amounts.
- Low-fuel warning that is readable without colour alone.
- Empty fuel affects propulsion; it does not freeze the vehicle or prevent a valid coasting finish.
- Retry restores initial fuel and canisters.
- No drain while paused, loading, editing or after the run ends.

Proposed defaults to evaluate:

| Rule | Proposal |
|---|---|
| Starting tank | Full at every fresh attempt |
| Capacity and consumption | Fixed for the official vehicle/rules initially; no upgrade system |
| Refill | Fixed amount, capped at capacity; consumed once per attempt |
| Empty tank | Disable powered propulsion in both directions; retain braking and coasting |
| Recovery | Picking up a refill can restore propulsion before a failed attempt is finalized |
| Failure | Do not fail immediately at zero fuel; declare a fair rule for an unrecoverable stopped vehicle, preserving manual Retry |

Choose the consumption model during scoping: active-run time, throttle/load, or a simple combination. Specify idle, airborne, braking and reverse behaviour. Do not let display updates determine consumption.

Choose what happens to a canister touched at full capacity: consumed or left available. Tune warning timing, tank range and refill spacing through human drive tests. Fuel must create useful pacing rather than unavoidable surprises.

Checkpoints, if introduced later, need one explicit policy for fuel, pickups, elapsed time and rewards before integration.

## Persistence and level selection

- Versioned progress keyed by stable level identity and relevant rules/revision.
- Personal best, highest medal, special-coin status, ordinary coin balance/claims under the chosen policy, unlocked levels and settings.
- Idempotent reward/result updates; a repeated callback cannot grant rewards again.
- Handle failed writes without claiming durable success; preserve previous valid progress.
- Reopening the game restores the last successfully saved state. Attempt-resume support is separate work.
- Level selection shows preview/name, best time, medal, special coin and locked/unlocked status.
- Initial unlock rule remains a decision; proposed simple completion-based progression, without requiring Gold or special coins.
- Keep editor-created levels and official progression identities distinct.

## Level authoring and balancing

Extend existing level data/editor workflows only as needed:

- Medal thresholds and declared official vehicle/rules.
- Ordinary/special coin placement and stable IDs.
- Fuel enable/configuration, canister placement and refill amount.
- Progress route metadata if required by supported course topology.
- Preview pickup extents and route direction; validate missing/duplicate IDs and invalid values.
- Save/reload, duplicate and Undo preserve correct identity/reference semantics.
- Stock and custom levels use the same gameplay runtime; editing a level does not confer official scoring status.

Build a small hand-authored first-world set before relying on procedural generation. Candidate first release target: around five polished levels, subject to scope approval.

Introduce mechanics gradually. Provide readable fuel opportunities, safe recovery, optional special-coin detours and tested medal times. Final balancing must include the fuel system because it changes route/speed choices.

## Presentation, mobile and release

- HUD: time, route progress, fuel and coin count with large enough text and safe-area handling.
- Keep gameplay/landing visibility clear at supported aspect ratios.
- Pause, Retry, audio and tilt settings; no overlay input leaking into driving.
- Feedback: engine, braking, landing/impact, pickups, refill, low fuel, finish, medal and new best.
- Consistent 2D toy-style vehicle, rider, terrain and menu presentation.
- Introduction through short playable sections, not a long instruction screen.
- Real-device checks for simultaneous touch, tilt, interruption/resume, local saves and representative performance.
- Release preparation: install/update tests, signing/build pipeline, app icon, store screenshots/description and applicable release requirements checked when publishing.

## Shared acceptance

1. One coherent run lifecycle drives timer, fuel, pickups, results and reset without stale attempt events.
2. A complete level can be started, paused/resumed, finished, retried and reopened with correct saved results.
3. Exact medal boundaries, repeated pickup contacts and duplicate result events behave correctly.
4. Empty fuel permits coasting/braking and follows the declared recovery/failure policy.
5. Practice/editor/custom rules cannot silently overwrite official records or grant official rewards.
6. Meaningful focused checks cover timing, reward settlement, saves and reset; real UI tests use actual input and visible resulting state.
7. Claudio drive-tests readability, fairness, fuel spacing and medal targets on the reference phone.
8. Split implementation into small issues with 1–3 acceptance criteria, one issue/PR, and the existing drive-test gates.

## First slice and open decisions

**Delivered first slice:** one existing short course → authoritative start/finish → timer → result/Retry → persisted personal best (#279 / PR #295). It reuses accepted foundations without a new framework.

Progress (#296), medals (#298), ordinary coins (#300), editor coin tools (#302–#307), Wonder Gems (#314), fuel (#318), and progression (#320) are delivered. Keep a playable example after future slices; do not infer physical-phone acceptance from desktop/CI checks.

Implemented policy references: [#314](https://github.com/bongohorse/rider/issues/314) defines multiple Wonder Gems and finish-only claims; [#318](https://github.com/bongohorse/rider/issues/318) defines fuel, refills and empty-tank recovery; [#320](https://github.com/bongohorse/rider/issues/320) defines completion/unlocks and legacy compatibility. Future changes must retain these established contracts. Still pending: more finished content, actual phone tests and release acceptance.

Creating this issue authorizes planning only. It does not start code changes or expand the existing editor MVP.
