# Advanced experiments, time and portals

Status: **worked out** (idea catalogue; not implementation authorization)

These are speculative gameplay proposals and historical design notes. **Do not implement from this folder.** Current scope, issue ownership, milestones and any GO are controlled by [#120](https://github.com/bongohorse/rider/issues/120) and its sub-issues; vehicle architecture lives under [#198](https://github.com/bongohorse/rider/issues/198).

High-risk mechanics needing isolated research rather than immediate production commitments.

**Contents:** [Group 7 — Separate feasibility experiments](#group-7--separate-feasibility-experiments) · [F. Candidate order for future selection (not the work order)](#f-candidate-order-for-future-selection-not-the-work-order) · [M. Time manipulation and portals — special feasibility experiments](#m-time-manipulation-and-portals--special-feasibility-experiments)

## Group 7 — Separate feasibility experiments

| Experiment | What must be established first |
|---|---|
| Short suspension bridge | Small linked-plank count, drive feel, stable joints, reset and mobile cost |
| Counterweight lift | Supported coupling approach, force limits, blocked motion and reset; do not assume pulley/gear API support on the active backend |
| Multi-link ropes / chains | Supported joint representation, practical link count, stability and collision budget |
| Larger chain-reaction machinery | Repeatability, readable timing, body/contact budget and recovery |
| Magnet / repulsion zone | Custom bounded force law, accepted actors, range and useful control feel |
| Portal / teleporter | Safe destination, velocity/orientation policy, jointed vehicle handling and cooldown |
| Altered-gravity zone | Per-body force approach, transitions and stable vehicle handling |

No commitment to fluid simulation, soft-body machinery, arbitrary scripting or custom physics follows from this catalogue.

## F. Candidate order for future selection (not the work order)

The table ranks *potential design value* and approximate *relative implementation risk*, not measured effort or approved priorities. Scope and GO are still decided through #120 after its O1/O2 workflow.

| Candidate | Value | Relative risk | Why consider it |
|---|---|---|---|
| Spring / launch pad (existing Group 4) | High | Low–medium | Strong immediate feedback, new jump lines and vehicle-feel testing |
| Booster pad (existing Group 4) | High | Low–medium | Creates optional speed lines; must cap force and repeat activation |
| Slippery oil patch as material variant | High | Low–medium | Useful braking/traction challenge; pairs with planned surface authoring |
| Rolling tyre / bouncy ball | Medium–high | Low–medium | Low setup cost after reusable loose-body presets |
| Sliding saw | High | Medium | Strong timed obstacle; reuse saw code rather than a duplicate implementation |
| Flipper paddle | High | Medium | Memorable pinball-style interaction; depends on measured joint/impulse behavior |
| Thin ice / collapsing piece | High | Medium | Time pressure and new route choices; bounded preset breakage |
| Oscillating crusher | High | Medium | Readable rhythm challenge; explicit blocked-motion policy required |
| Cable trolley / suspended ferry | Medium | High | Distinct set piece, but vehicle contact and joint stability are unproven |
| Shallow-water buoyancy / vehicle size changes | Experimental | High | Separate physics/UX experiments; do not fold into routine object delivery |

Suggested evaluation sequence: complete the currently scoped object-authoring path first, then select **one** mechanic that strengthens driving feel and **one** that demonstrates level-editor event wiring. Prototype, measure and human-drive-test each before widening the catalogue.

## M. Time manipulation and portals — special feasibility experiments

Rider has a single fixed 60 Hz Box2D simulation owner. It is **not straightforward or physically equivalent** to run one contacted vehicle at a different clock rate from other bodies. This section describes desired player effects and candidate approximations, *not* an approved per-body time engine.

| Mode | Intended player experience | First test and honest limitation |
|---|---|---|
| Global slow motion | Dramatic slow-motion jump or crash | Explore presentation/animation and consistent global mechanics policy; preserve simulation contract and timing semantics |
| Vehicle-only slowed time | Buggy reacts slowly while machines keep moving | First approximate with reduced motor/input/thrust; physical impacts are not actually time-dilated |
| World-only slowed time | Buggy drives normally while lifts, hazards, spawners and missiles seem frozen | Scale/pause authored mechanism schedules, not free dynamic-body clocks; dynamic crates continue physically interacting |
| Freeze specific mechanisms | Stop an elevator, moving saw or conveyor temporarily | Explicit pause/resume state, blocked interactions, remaining timer and Retry |
| Fixed portal pair | Vehicle enters one portal, exits another preserving understandable orientation/speed | Atomic whole-vehicle relocation, destination clearance, momentum mapping, cooldown, camera and stable contacts |
| Cargo portal | Teleport tagged unjointed balls/crates through the same paired portals | Define supported actor types, velocity/orientation and loop prevention |
| Portal Gun | Player places entry/exit portals on valid surfaces with aim controls | Only after fixed portals pass physics tests; wall whitelist, angle and clearance rules, two active portals, mobile aiming/UI and persistence |
| Portal puzzle | Move cargo through portals to operate switches and gates | Combine proven fixed portals and typed object events, without unrestricted arbitrary teleport |

**Portal rollout gate:** fixed, aligned and stationary pair → varied orientations → stable buggy wheels/chassis → one cargo type → repeated Retry and rapid re-entry → only then investigate Portal Gun placement. Never teleport a vehicle into geometry or detach joints implicitly.

**Time rollout gate:** each experiment must specify whether only visuals, authored motors/timers, input/forces or the *entire world simulation* changes; it must not claim actual per-body local time dilation when Box2D contacts remain at a common tick. No second physics world/step or arbitrary per-body delta time is authorized.
