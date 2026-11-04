# Scenery generation and feasibility experiments

**Status:** worked-out concept; **not approved for implementation**. Historical source: [Issue #230](https://github.com/bongohorse/rider/issues/230) (backlog, needs GO). Current issues/child tasks and code contracts take precedence.

Visual helpers must be budgeted and separate from unsupported endless or physics experiments.

## Group 5 — Presentation and production helpers

**Ownership remains with #121 and relevant asset systems.** These are integration opportunities, not duplicate implementations.

| Helper | Potential benefit / boundary |
|---|---|
| Decoration placement | Place props beside accepted driving geometry using clearance/exclusion regions |
| Biome palettes and backgrounds | Give course families a consistent identity and readable silhouette |
| Scenery profiles | Add distant hills/trees without changing collision terrain |
| Material appearance | Vary dirt/wood/plastic appearance; physical grip changes require explicit gameplay support |
| Atmosphere variants | Lighting/weather ambience while keeping hazards and landings readable |
| Vehicle cosmetic variants | Approved colours/patterns through #198; no random mass, grip or motor tuning |
| Arcade sound variants | Optional offline SFX authoring with controlled loudness and consistent identity |

Generate gameplay structure first and decorate afterward. Decorative props must not unexpectedly become colliders. Separate cosmetic random streams from gameplay; visual quality tiers must preserve the same course and physics.

## Group 7 — Separate feasibility experiments

| Experiment | Question to answer before expanding |
|---|---|
| Endless runtime courses | Does this mode improve Rider enough to justify streaming, pooling, visibility and recovery complexity? |
| Search-based candidate selection | Can a small bounded search reduce author corrections compared with simple authored rules? |
| Simulation-assisted reachability | Does a repeatable test catch useful failures without wrongly claiming general playability? |
| Vehicle-aware generation | Can declared stock vehicle profiles select suitable courses without secretly changing physics? |
| Adaptive difficulty | Can explicit, understandable options help players without changing an active attempt or invalidating comparisons? |
| Grammar/graph-based challenge sequences | Do more structured interaction templates produce useful variety with manageable validation? |
| WFC-style pattern generation | Is there a concrete tile/decor use under #121 beyond simpler placement rules? |
| Diagnostic course generation | Can a narrow generator reproduce a specific slope, seam or landing bug faster than a handmade fixture? |

No broad test framework, AI driver, cloud generation service or procedural vehicle-physics system is authorized by this catalogue.

