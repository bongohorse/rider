# Interactive objects and gameplay ideas

Status: **worked out** · Source: [#120](https://github.com/bongohorse/rider/issues/120) and the 2026-11-04 brainstorming rounds · **Idea library only; not an implementation GO.**

A categorized catalogue of future Rider 2D physics interactions, challenges and vehicle modes. **Do not implement ideas from this directory directly.** Follow the [ideas policy](../README.md); actual implementation work, ordering and acceptance belong to existing issues (especially [#120](https://github.com/bongohorse/rider/issues/120), [#281](https://github.com/bongohorse/rider/issues/281) and vehicle epic [#198](https://github.com/bongohorse/rider/issues/198)). The existing #120 O1/O2 scope is separate from these unscheduled ideas.

**Contents:** [Documents](#documents) · [How to use these ideas](#how-to-use-these-ideas) · [Origin](#origin)

## Documents

| Document | Covers |
| --- | --- |
| [foundations.md](./foundations.md) | Historical scope, ownership and delivery rules |
| [physics-and-structures.md](./physics-and-structures.md) | Kisten, Kugeln, Wippen, flexible und zerstörbare Strukturen |
| [triggers-and-machinery.md](./triggers-and-machinery.md) | Schalter, Tore, Aufzüge, Förderbänder, Greifarme und Maschinen |
| [surfaces-and-hazards.md](./surfaces-and-hazards.md) | Untergründe, Gefahren, Laser, Raketen, Explosionen und Schäden |
| [objectives-and-courses.md](./objectives-and-courses.md) | Ziele, Ringe, Belohnungen, Gameplay-Challenges und Beispiellevel |
| [vehicle-modifiers-and-modes.md](./vehicle-modifiers-and-modes.md) | Fahrzeuggröße, Räder, Nitro und alternative Fahrzeugtypen |
| [advanced-experiments.md](./advanced-experiments.md) | Portale, Portal Gun, Zeitmanipulation und aufwendige Experimente |
| [runtime-and-editor-guidelines.md](./runtime-and-editor-guidelines.md) | Box2D, Events, Reset, Editor, Validierung und Performance |

## How to use these ideas

- Choose one playable mechanic and check whether the runtime/issue already owns it; do not create duplicate seesaw, checkpoint, event or vehicle systems.
- Check the [technical and authoring rules](runtime-and-editor-guidelines.md) and [design ownership](foundations.md) before writing an implementation issue.
- Specify controls, object limits, physics reset, level-editor authoring, test case, and human drive-test requirements in the resulting issue. A brainstorm item is not a feature promise.
- Keep the standard buggy and its fixed-tick physics behavior stable; advanced time and teleport mechanics require separate feasibility evidence.

## Origin

The historical text was collected in `docs/issue-archive/120-interactive-objects.md` and expanded with the November 2026 idea discussions; it has been **split by subject**, with prior concepts retained. A compatibility pointer remains at the old path for existing links.

This is an **idea pool, not Group 8 of the delivery plan and not an implementation GO**. The historical planning text above remains unchanged. Issue #120 and its sub-issues determine actual scope, ownership, order and acceptance. The extra concepts below favor short, legible 2D driving interactions, toy-like physical feedback and reuse of the existing mechanisms. They must not delay agreed vehicle-feel, camera, editor, CI or performance work.
