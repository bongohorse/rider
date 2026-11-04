# Procedural generation — catalogue and design plan

**Status:** worked-out concept; **not approved for implementation**. Historical source: [Issue #230](https://github.com/bongohorse/rider/issues/230) (backlog, needs GO). Current issues/child tasks and code contracts take precedence.

Generate a bounded editable section or course from proven modules → preview → drive-test → edit → save normally. Endless runtime generation remains a separate experiment.

## Topic index

| Topic | File |
| --- | --- |
| Reusable passages and replacement | [passages.md](passages.md) |
| Complete finite courses and rewards | [courses.md](courses.md) |
| Scenery population and high-risk research | [presentation-and-experiments.md](presentation-and-experiments.md) |
| Editor, engine constraints and QA | [authoring-and-validation.md](authoring-and-validation.md) |

## Smallest useful experiment

Pick one short passage with declared stock vehicle/preset and a few proven modules. Save the seed, respect locked neighbouring terrain, preview before committing as a single Undo step, Drive, then compare driving quality and edit time with a manually made passage. Reject impossible or over-budget drafts without changing the level.

## Goal and status

Use controlled procedural generation to create more good Rider content with less manual authoring. Prioritize enjoyable driving, readable mobile gameplay and editable results over unlimited random content.

**Status: future research / planning epic. Not an implementation GO, milestone assignment or schedule change.** Expanded and reorganized on 2026-10-22.

Recommended direction: **generate a passage or finite course draft from proven authored building blocks → drive-test → edit → save as a normal level.** Runtime endless generation is a separate later experiment.

## Scope and existing owners

This issue owns the cross-cutting procedural generation/design direction and eventual integration between selected systems. Existing issues retain ownership:

| Existing owner | Relationship |
|---|---|
| #175 — passage library | Reuse authored passages and their metadata; no second passage library |
| #180 — variant-series work | Reuse its existing variation capabilities rather than implementing duplicates |
| #121 — visual/environment generation | Owns terrain appearance, decoration, backgrounds and atmosphere |
| #120 — interactive objects and objectives | Supplies actual runtime mechanics; generation only places/configures supported objects |
| #198 — car editor | Defines supported vehicles; generation must declare the target vehicle rather than randomly retuning its physics |
| #118, #168, #169, #170 — editor work | Reuse document, selection, authoring, validation and Play workflows |

Check current scope/status before splitting implementation tasks. This epic does not expand the editor MVP or authorize unfinished mechanics.

Keep one physics owner, the existing level data/runtime path and pinned engine. No LLM, online service or general generator framework is required for the initial experiment.

## Delivery order

These are planning groups, not mandatory large delivery packages.

| Order | Group | Useful outcome / dependency |
|---|---|---|
| 1 | Passage library and connection rules | A few proven modules can connect under explicit vehicle/geometry assumptions |
| 2 | Selected-passage generation | Generate editable alternatives for one bounded section |
| 3 | Finite course drafts and pacing | Compose complete short courses with a designed challenge/recovery rhythm |
| 4 | Rewards and interactive challenges | Place supported objectives and mechanisms into suitable course contexts |
| 5 | Presentation and production helpers | Reuse visual generation after driving structure is accepted |
| 6 | Repeatable course variants and sharing | Preserve accepted courses and versioned configurations |
| 7 | Separate feasibility experiments | Endless modes, search and advanced adaptation only after evidence supports them |

Group 5 can progress independently under #121. Saving concrete generated geometry and reproducible inputs belong to the first experiment; Group 6 adds distribution and richer variant management.

## Research references

Retained from the original research list dated 2026-10-20. These inform design proposals; they do not prove Rider-specific feasibility or constitute new verification in this update.

- [Dead Cells: The Level Design — A Hybrid Approach](https://deepnight.net/tutorial/the-level-design-of-dead-cells-a-hybrid-approach/) — authored chunks, constraints and pacing.
- [Alto's Odyssey official press kit](https://altosodyssey.com/press/) — mobile reference for generated environments and physics-based movement.
- [Spelunky generator breakdown: path](https://tinysubversions.com/spelunkyGen/) and [room templates](https://tinysubversions.com/spelunkyGen2/) — structural/template generation reference.
- [Procedural Content Generation in Games](https://www.pcgbook.com/), especially [mixed-initiative creation](https://www.pcgbook.com/chapter11.pdf) and [evaluation](https://www.pcgbook.com/chapter12.pdf).
- [Jetpack Joyride: Depth in Simplicity](https://www.gdcvault.com/play/1015527/Depth-in-Simplicity-The-Making) — supplementary mobile design reference.
- [WaveFunctionCollapse](https://github.com/mxgmn/WaveFunctionCollapse) — optional local pattern generation reference, not an initial dependency.
- [Bfxr](https://www.bfxr.net/) — optional offline arcade SFX authoring.

