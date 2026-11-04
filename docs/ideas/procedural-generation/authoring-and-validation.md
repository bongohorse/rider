# Editor workflow, engine boundaries and verification

**Status:** worked-out concept; **not approved for implementation**. Historical source: [Issue #230](https://github.com/bongohorse/rider/issues/230) (backlog, needs GO). Current issues/child tasks and code contracts take precedence.

Generation must preserve locked work, undo/redo, determinism and standard level validation.

## Generator methods and Box2D boundaries

| Method / building block | Suitable role | Limitation |
|---|---|---|
| Authored module assembly | Initial course structure | Requires tested modules and connection rules |
| Bounded parametric curves | Waves, grades and transitions | Parameter validity does not prove driving quality |
| Weighted selection and repetition limits | Variety and pacing | Random choice alone does not create good progression |
| Small rule/state sequence | Introduction, challenge and recovery | Keep rules scoped to actual content |
| Noise | Scenery and restrained terrain modulation | Not a complete driving-level designer |
| WFC | Optional local visual/tile patterns | Does not establish vehicle reachability |
| Box2D shapes, joints and forces | Simulate supported generated terrain/objects through existing runtime | Box2D is the physics engine, not a course generator |
| Physics queries where exposed | Candidate clearance/overlap checks | Check pinned Defold API; local checks are not playability proof |

Use the pinned engine and existing collider construction. Reuse accepted mechanisms from #120 rather than generating arbitrary joint graphs. Respect geometry/body/joint/contact budgets and safe initial placement.

## Editor workflow and generation controls

Proposed author workflow:

1. Select a section or choose a finite draft template.
2. Choose a small set of relevant controls.
3. Generate and inspect a bounded preview.
4. Accept a candidate as a normal editable level operation.
5. Drive-test, correct and save.

Candidate controls, narrowed per selected slice:

| Control | Meaning |
|---|---|
| Seed | Reproducible generation within pinned versions |
| Scope | Selected passage or finite course |
| Target vehicle/preset | Explicit assumptions for clearance and driving |
| Length | Approximate distance or estimated duration |
| Emphasis | Supported flow/jump/precision focus |
| Difficulty range | Validated constraints, not an unsupported universal score |
| Locked content | Geometry/objects the generator must preserve |
| Environment | Optional #121 presentation preset |

Keep explanations short and results editable. Repeated generation must not overwrite accepted work or pollute Undo with partial intermediate candidates. A failed generation leaves the document intact and returns a useful reason. Cancellation must discard obsolete results if generation is asynchronous.

## Validation and quality evaluation

Separate three kinds of evidence:

| Evidence | What it can establish |
|---|---|
| Structural checks | Valid schema, finite geometry, legal connections, bounds, budgets and object references |
| Focused physics/drive checks | Specific clearance, contact, reset or successful-run observations under declared conditions |
| Human drive feedback | Flow, readability, challenge, repetition, fairness and desire to retry |

Measure representative seeds against a declared vehicle/preset and reference phone. Record rejected candidates and correction effort, not only successful screenshots.

Useful evaluation questions:

- Can the next hazard and landing be read with the normal gameplay camera?
- Are there meaningful differences between generated courses?
- Do errors come from a bad module, bad connection or bad sequence?
- How often does the author need to repair a draft?
- Is generating and correcting faster than manual authoring?
- Do generation time, loading, memory and runtime cost fit measured budgets?
- Does Retry and Edit ↔ Play preserve the same course and intended initial state?

Use a small reproducible sample appropriate to the experiment; agree it when scoping. Do not invent acceptance percentages or launch a large automated benchmark upfront.

## Shared acceptance requirements

1. **Reuse:** use existing level documents/runtime, passage/variant owners and implemented object mechanics.
2. **Editable result:** accepted output is normal level data; no hidden generator-only physics.
3. **Reproducibility:** preserve configuration, seed and versions; save concrete accepted content according to the chosen policy.
4. **Safe edits:** preserve locked/manual content, valid references and coherent Undo; failures leave the source document intact.
5. **Driving validity:** validate geometry and initial placement; document assumptions and human drive-test evidence rather than claiming guaranteed fun.
6. **Reset and fairness:** Retry does not regenerate; object phases, randomness and checkpoint policy are explicit.
7. **Bounded work:** cap candidates/retries, geometry and object counts; handle unsatisfiable constraints without an unbounded search.
8. **Mobile quality:** check readability, generation/loading cost and runtime performance on the reference phone.
9. **Cosmetic separation:** decoration streams and quality tiers do not alter gameplay.
10. **Scoped delivery:** each selected task has 1–3 concrete acceptance criteria, explicit dependencies and Claudio's drive-feedback gate.

## Suggested first experiment

**One short selected passage, one declared stock vehicle/preset, a few proven modules or bounded curve variants.**

- Preserve both boundary conditions and locked neighbouring content.
- Generate one candidate at a time from a saved seed.
- Preview → accept as one Undo operation → Drive → edit/save normally.
- Reject invalid or over-budget candidates with a clear reason.
- Compare correction effort and driving quality with manually creating the same passage.

**Exclude initially:** whole-course objective graphs, endless streaming, adaptive difficulty, cloud services, sharing infrastructure and new physics mechanics.

Stop after the experiment and Claudio's drive feedback before expanding. No implementation or extra automation is authorized by this planning update.

