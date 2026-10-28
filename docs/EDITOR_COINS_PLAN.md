# Editor coin authoring plan

Approved by Claudio on 2026-10-27, parent #262. Six small issues implement the approved five-step design, splitting layout and zoom for reviewability. Existing #176/#177 retain general transforms and shared-property editing; #174 retains persistent groups; #230 retains future course generation. None is implicitly started here.

**Contents:** [Sequence](#sequence) · [Interaction contract](#interaction-contract) · [Verification and stops](#verification-and-stops)

## Sequence

1. [#302](https://github.com/bongohorse/rider/issues/302): world-sized coin sprites; accepted #300 implementation is the base.
2. [#303](https://github.com/bongohorse/rider/issues/303): categories and centered commands.
3. [#304](https://github.com/bongohorse/rider/issues/304): editable stepped zoom, distinct from layout.
4. [#305](https://github.com/bongohorse/rider/issues/305): vertical Drop to Track.
5. [#306](https://github.com/bongohorse/rider/issues/306): temporary shared along-track adjustment.
6. [#307](https://github.com/bongohorse/rider/issues/307): bounded Auto Add Coins preview/apply.

## Interaction contract

- Visible coins scale with the world. Invisible picking may be larger. Selection indicators must not look like enlarged coins.
- Collapsible left categories: Tools → Gameplay → Prefabs → Objects. Gameplay contains Start, Finish and Coin; Objects lists placed items. Undo, Redo and Play together at top center, Coin removed there. Preserve existing controls and support narrow windows.
- Zoom: [-] [100%] [+], directly editable; Enter accepts, Escape cancels, invalid input changes nothing. Define 100% against the existing camera transform after verifying it; viewport size still determines visible world area. Verify sensible bounds and explicit steps including 100%. Fit may produce intermediate values; +/- chooses the next step. Preserve cursor-anchored wheel zoom and Fit.
- Track alignment in Properties: Height, Drop to Track, Along track. Drop preserves X and projects vertically to the first valid drivable surface below. Height is a vertical distance from the coin center or a type's explicitly defined support anchor. Coin default 0.7 m is provisional and editable. Leave terrain, locks and no-hit elements unchanged; report skipped elements. Support other types only with unambiguous anchors/behavior; no automatic rotation or simulation.
- Preserve selection after Drop/Auto Add. Along track applies the same signed arc length to every element on its assigned continuous route, retaining individual height offsets. The first route end/gap clamps the whole displacement. Height changes the common offset; show Mixed for different initial offsets. Retain ordinary X/Y. Route references are temporary and checked/recomputed after terrain edits, free movement or document changes. No stored grouping or new source format. One completed input or drag, not every intermediate value, is one Undo entry.
- Auto Add Coin Properties: Range (selected track section or whole track), Count/Spacing, derived density, Randomness, Height, Re-roll, Preview and Apply. Count/Spacing are alternative coupled specifications; last edited controls. Distribute along actual arc length separately per valid connected section. Do not bridge gaps; jump arcs remain manual. Randomness initially varies only along-track spacing, bounded to avoid clumps. Reject ambiguous unsupported route forms clearly.
- Account for existing coins and minimum spacing; display desired and feasible new counts and do not force coins into insufficient space. Default adds. Explicit Replace coins in range previews removal of unlocked coins; locked coins survive and constrain spacing.
- Preview never edits the document. Identical settings and seed reproduce it; Re-roll changes the seed. Apply exactly the visible preview atomically as one complete Undo action; failure must not partially delete or add. New coins get stable IDs, remain selected and individually editable. Reuse existing resource validation, storage and pickup rules.

## Verification and stops

Use existing selection, Properties, Undo and save systems. Preserve timer, route progress, medals, bests, Terrain Look, driving, physics and resource limits. No general generator, group or editor framework. One issue per PR in its own branch/worktree; existing changes preserved. Verify each implementation with affected existing suites and actual build interaction; add only meaningful missing checks. Publish a playable preview and stop before merge for Claudio's practical acceptance. Approval of this plan does not authorize merging PR #301 or later implementations without their required review, checks and acceptance.
