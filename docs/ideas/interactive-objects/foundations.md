# Purpose, ownership and delivery guidance

Status: **worked out** (idea catalogue; not implementation authorization)

These are speculative gameplay proposals and historical design notes. **Do not implement from this folder.** Current scope, issue ownership, milestones and any GO are controlled by [#120](https://github.com/bongohorse/rider/issues/120) and its sub-issues; vehicle architecture lives under [#198](https://github.com/bongohorse/rider/issues/198).

Historical planning context from #120; its past wording does not supersede GitHub issues or [the ideas policy](../README.md).

**Contents:** [Goal and status](#goal-and-status) · [Research basis and approved delivery plan](#research-basis-and-approved-delivery-plan) · [Scope and ownership](#scope-and-ownership) · [Delivery order](#delivery-order) · [Suggested first playable slice](#suggested-first-playable-slice)

## Goal and status

Build a reusable catalogue of interactive gameplay objects and simple event/action connections for Rider. Objects must work in normal courses and editor Play tests through the same runtime.

**Status: future planning epic.** This update expands and organizes the idea backlog; it does not start implementation or assign a milestone. Each selected mechanic needs a scoped task, an API check against the pinned engine, a playable example and Claudio's GO/acceptance.

Originally extracted from #118 on 2026-10-18; expanded and reorganized on 2026-10-22.

## Research basis and approved delivery plan

Plan approved by Claudio on 2026-10-24: prioritize **long, visually substantial 2D courses that are fast to author and smooth to play**. Issue creation approves backlog organisation, not runtime implementation or a new milestone. Preserve the existing per-task scope/GO/drive-test process.

Primary references: [HCR2 technical reference](https://github.com/bongohorse/rider/blob/main/docs/research/HCR2_Technical_Reference_for_Rider.md), [asset/graphics findings](https://github.com/bongohorse/rider/blob/main/docs/research/assets_findings.md), [native findings and limitations](https://github.com/bongohorse/rider/blob/main/docs/research/native_findings.md). Original shader math supports terrain-body extension, depth/UV changes and authored lighting; some original models have depth coordinates. HCR2's full CPU mesh generator, projection, chunk/culling policy, physics laws and numerical tuning are not recovered. Treat our architecture as independent Rider work, using Rider-owned art/code.

### Small shared runtime before catalogue breadth

- [ ] #280 — one crate, one occupancy plate and one gate through a small shared runtime, with canonical Retry and measured cost.
- [ ] #281 — editor placement, supported properties, safe previews and typed plate→gate wiring; depends on #280.

Keep the catalogue below as later choices. These two tasks establish only the identity/events/reset/authoring machinery needed by one playable interaction. Initial plate detection is explicitly occupancy, not a claimed weight measurement. No general scripting graph, exhaustive gadget system or second seesaw/checkpoint implementation is required.

Gameplay activation is independent of #263 render visibility: offscreen mechanisms may still affect the run. Use stable source/actor IDs, typed events, once/repeat/rearm rules, generation isolation and bounded spawn/body/joint/fragment cost. HUD/audio/particles observe presentation events; authoritative pickups, fuel/rewards and finish rules stay with #262. Vehicle attachment construction belongs to #198.

The first interaction can use a short existing course; it does not depend on finishing the full terrain renderer. Schedule it after the chosen long-course/editor priorities unless separately selected. Original text supports event-linked effects and breakable/detachable concepts, not exact HCR2 mechanics, load thresholds or native algorithms.

## Scope and ownership

- This epic owns the gameplay catalogue, runtime behaviour, event semantics, reset/performance requirements and example interactions.
- #118 owns the editor MVP: static terrain, START/optional FINISH, test loop, editing and document handling. It does not depend on this catalogue.
- Implement and verify each selected runtime mechanic before or alongside its editor integration. Placement, parameters, previews and wiring expose that same implementation.
- Reuse existing M4 mechanics and separately planned checkpoint/object work. The seesaw/balance plank must reuse the runtime associated with #57; check its current implementation before scoping work. No second seesaw or checkpoint system.
- Editor authoring of interactive mechanics is also referenced in #170.
- Visual textures, procedural decoration and environment/mood belong to #121. Decorative instances stay non-colliding. Cosmetic generation/quality settings must not insert, remove or retune gameplay objects.
- Keep the pinned engine, Defold-owned worlds/bodies, one physics owner, existing units and fixed-tick/reset lifecycle. No additional physics engine, binding or custom stepping.
- Prefer interactions operated through throttle, brake, tilt, vehicle contact or object weight. Extra mobile controls need a concrete gameplay reason.

## Delivery order

These are planning groups, not seven large implementation tasks or a fixed schedule. Select small useful slices; only build the shared infrastructure they actually require.

| Order | Group | Main dependency / useful outcome |
|---|---|---|
| 1 | Basic physics objects and balance | Reusable object identity, material presets and reliable reset; push and balance objects |
| 2 | Triggers and simple reactions | Group 1 where physical actors are needed; one source event opens a gate or releases a prepared ball |
| 3 | Guided and rotating movement | Verified motion/joint behaviour and blocked-motion policy; timing and transport |
| 4 | Driving surfaces and force effects | Explicit contact/zone rules and bounded forces; new driving situations |
| 5 | Yielding and breakable structures | Relevant joints, load/impact rules and bounded debris; reactive terrain |
| 6 | Objectives and combined challenges | Reuse selected mechanics from earlier groups; progression and small physics puzzles |
| 7 | Separate feasibility experiments | Individual stability, control-feel and mobile-cost trials |

For every selected object: **runtime behaviour → Retry/reset verification → editor placement and persistence → small playable example**. Existing editor/runtime infrastructure should be reused.

## Suggested first playable slice

**Core:** push one crate onto a pressure plate → one gate opens → drive to the finish.

**Follow-up:** add one yielding platform after its spring/motion behaviour is verified. It is an extension, not a prerequisite for validating the core interaction.

This exercises reusable objects, a single event/action connection and reset with a small course. Other high-interest follow-ups are the one-way flap, delayed falling track pieces, roller track, precision landing and hold-position target.

Before implementation: check existing work, choose the slice, verify the pinned APIs, agree acceptance/budget and obtain Claudio's implementation GO. This entire catalogue is not one delivery package.
