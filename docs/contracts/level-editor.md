# Level editor contract

Binding rules for the developer level editor ([epic #118](https://github.com/bongohorse/rider/issues/118), milestone **Level Editor**, tasks LE1a–LE6: #122–#129). The epic holds goal, decisions D-E1…D-E13, user flow, task order, out-of-scope items, later candidates and research. **This file is the single source for the rules below**; change them only by PR. Gameplay objects (#120) and visual authoring (#121) are outside this contract.

Rules apply from the task named in them; a task issue lists the rules it implements. Where engine behaviour is assumed, verify it against the pinned engine ([engine references](../ENGINE_REFERENCES.md)) and record the sources in the PR.

**Contents:** [Rules (R1–R18)](#rules-r1r18) · [Screen layout (desktop, Defold GUI)](#screen-layout-desktop-defold-gui) · [Controls (Edit mode only; game keys keep working in Play)](#controls-edit-mode-only-game-keys-keep-working-in-play) · [Editing basics (part of the first usable version)](#editing-basics-part-of-the-first-usable-version) · [Data model](#data-model) · [Prefab library v1 (static, parametric, each with handles)](#prefab-library-v1-static-parametric-each-with-handles) · [Storage](#storage) · [Additional implementation and acceptance checks](#additional-implementation-and-acceptance-checks) · [Technical constraints](#technical-constraints)

## Rules (R1–R18)
**R1 Source vs. compiled data.** In the editor the **source objects** (lines, curves, prefabs, connections) are authoritative. Play and Export always **recompile** `chains`/`hulls`/`labels`/`spawn`/`start_speed`/`finish`/`bounds` from them (full field contract in "Data model"). The `editor` block carries its own `editor_version` and `compiler_version` **from the first saved draft (LE2)**. Opening never silently overwrites geometry:
- **Known/supported editor and compiler versions, unexpectedly different compiled data for the same source revision:** show the difference; the user deliberately chooses "keep compiled geometry (open as lines)" or "recompile from source".
- Track source revision and the revision/version used to compile the cached geometry. An autosaved edit may intentionally have stale or absent compiled data; reopening it must not report an unexpected mismatch merely because Play has not been pressed.
- **Unknown/newer editor or compiler version:** never automatically recompile using unsupported semantics. Either open supported existing compiled data as an editable line copy or refuse to open. The original file and unknown source data are preserved unchanged. Until full compatibility UI arrives in LE4, LE2 must safely reject unsupported versions.

**R2 Old stations are not decomposed.** Stations without an editor block open as **editable polylines and hulls**. No automatic recovery of parametric prefabs is promised. (Later option: replace a selected point run by a prefab.)

**R3 Templates drop station-specific measurement data.** "Open as template" creates a generic custom level (**`kind` omitted**, new custom id/name) and **removes `sections`, `markers` and other kind-specific measurement data** by a fixed, tested rule. The built-in original stays untouched and read-only. **LE2** provides minimal access (open a built-in station as a template copy); full template browsing is LE4.

**R4 Explicit connection model.** Pieces are connected by an explicit **connection record** (end A ↔ end B), never inferred from coincident coordinates. v1 supports **simple linear terrain runs** (each end has at most one connection); branches are deferred. Edit rule for v1:
- On a parameter/shape change of a piece, its **entry stays fixed**; the **whole downstream run is translated** by the displacement of the piece's exit. **No automatic rotation or deformation** of other pieces.
- Upstream pieces never move on a parameter change.
- **Dragging** any piece translates the **whole connected run**. To move only part of a run, disconnect first.
- An edit that cannot keep all connections (e.g. a closed loop, a downstream piece pinned by another connection) shows a **visible conflict** and is not applied silently.
- The user can deliberately **disconnect**. The edit including all moved pieces is **one undo step**. A connected run compiles into **one chain** (A18/D8: abutting pieces cause ghost bumps).

**R5 Snapping ≠ connecting.** Snapping only positions and shows the target. A connection exists only when confirmed or via explicit **Connect / Disconnect** actions. **Deliberately placing a prefab at a free end** (with a visible connect preview) counts as confirmation and connects automatically; mere proximity or hover never connects. Two coincident points may stay unconnected (e.g. stacked paths).

**R6 Snapping rules.**
| Input | Effect |
|---|---|
| Default | 0.5 m grid + anchor snap |
| Alt held | 0.1 m grid |
| Shift held | 15° angle steps |
| Ctrl held while dragging | all snapping temporarily off |
| G | toggle grid snap persistently |

Precedence: anchor snap > angle snap > grid snap. With Shift, the point lies on the 15° ray and the grid applies to the length along that ray. Alt/Ctrl behaviour is verified in the target desktop browsers (e.g. Alt opening the browser menu, Alt+drag moving the window on some Linux window managers); if a key is unusable, a replacement key is defined in the PR. Wheel and middle button must not scroll the page. The active snap is always visible (indicator + status bar). Grid drawn at a readable density for the current zoom.

**R7 Size limits are measured per layer.** Today every chain segment creates its own line sprite (`stations.lua`), the validator caps render objects at 800, a chain at 2048 points and a level at 32 chains; the **current project setting** (`game.project`) is `max_count` 1024 for sprites and labels. GUI nodes have their own per-scene limit. Sprite, label and GUI budgets are recorded separately. LE1b measures rendering, physics and geometry cost separately **only within the unchanged validation limits** and reserves headroom for editor overlays (handles, grid, selection); a render-budget failure is not evidence of a physics limit. Cases above the limits are documented as rejected; their physics cost is reported as **unknown** (no extra measurement harness beyond the limits). The real editor cost is **re-checked in LE3** (lines, handles, snapping) and **again in LE5a/LE5b** (prefabs, curves). The sprite budget is a known limiting factor, but whether build time, memory or physics also matter is an LE1b **measurement result**, not an assumption. **Release-capable rendering:** debug `draw_line` does not render in release builds, and the editor ships in the release build (D-E4), so grid, lines and handles use sprites, GUI nodes or a mesh and count against these budgets. Hiding sprites does not free component budget (to be verified against the pinned Defold version). Changing the terrain rendering is allowed if measurement shows it is the bottleneck (see "Terrain rendering optimisation" in the later candidates of #118).

**R8 Adaptive curve sampling.** Redundant collinear source points are simplified first; curves are then sampled adaptively with a maximum shape deviation and a deliberately chosen maximum segment length. Simplification must not invalidate the final sampling constraints or remove intentional corners. The actual reduction on real courses is measured, not assumed. Sampling depends only on the source data and compiler settings, **never on zoom**.

**R9 Unplayable drafts can be saved.** Drafts may be open, incomplete or invalid (e.g. a fresh "New" level with no terrain, which the validator rejects as empty). Structurally valid drafts can be saved/restored even when their terrain is not playable, subject to explicit storage limits and reported save failures (R12, R14). **Play** and **Export as playable station** require valid compiled data and show the validation errors otherwise.

**R10 Test start is precise and temporary.** Two explicit modes:
- **Start on surface:** vehicle preview placed **upright** on the surface below the cursor with the correct clearance; default 0 m/s. (Aligning to the slope is a later option if drive tests need it.)
- **Drop here:** exact position in the air; default 0 m/s.

A start speed is an explicit option. Invalid positions (inside geometry, no surface below for "Start on surface", **outside the level bounds**) are shown and refused. A test start never changes the persistent START marker and is **never exported**. Permanent START placement also checks clearance for the complete upright vehicle, not only its centre; overlap with terrain/hulls blocks Play with a useful error. Temporary and permanent spawn previews use the same placement rules.

**R11 Edit ↔ Play.** **E in the editor does exactly what Play does**: compile, validate, and start a **new** test run from the start marker (or show the errors and stay in the editor). **E while driving** returns to the editor at the **last editor camera view** (not the driving camera), with nothing lost. **Play** / Enter = same as E in the editor. **R works only while driving** and repeats the last test start (retry); R is disabled in the editor. There is never a continuation with old contacts or velocities.

**R12 Autosave and recovery.** Autosave after **completed actions** (a whole drag, not every mouse move), briefly debounced. Status shows **Saved / Unsaved / Save failed**. The last working state is kept. Import is validated first and opens as a **copy**; no existing level is silently overwritten.

**R13 Automatic bounds.** Safety bounds are computed automatically **from every geometry compile, from LE2 on**, from terrain, hulls, START and FINISH plus a margin. These bounds are used for test runs, saving and export alike. **Temporary test starts never change the bounds**; a test start outside them is refused (R10). There are no stale hand-set bounds in custom levels. LE6 only adds bounds display/comfort.


**R14 Safe custom loading and storage (LE1a onward).** Custom-level replacement is serialized through the existing world-switch owner (`boot.script`: the collection proxy is the only world-switch owner; confirmed unload → load with generations) or an equivalently verified lifecycle. The level document is **not** sent as a message payload: Lua `msg.post` data is limited to **2048 bytes** in the pinned engine ([`script_msg.cpp:88`](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/script/src/script_msg.cpp#L88), `MAX_MESSAGE_DATA_SIZE`). **Handover contract:** when Play/import is triggered, the loader freezes an **immutable snapshot** of the validated compiled document under a new **snapshot id** + generation. The snapshot id is per load and is **not** the persistent level id: the saved level keeps its identity through ordinary saving and testing, and Play/autosave never create another saved level. The new world loads exactly that snapshot; edits, autosaves or imports during loading create a newer snapshot but never replace the one being loaded. The snapshot id is the reference; the generation rejects stale loads, messages and actions. A snapshot is released only when **no in-flight load still reads it**: after the world reports ready, or, for a superseded load, after that load has actually finished or been confirmed unloaded. Discarding a generation rejects stale results but does not by itself end an in-flight access. Do not simply call the current one-shot terrain builder repeatedly on a live world: old shapes, decorations and pending messages must not survive. Read and validate before replacing the active/saved custom slot. Invalid JSON or a read failure preserves the previous valid level/save. A build failure leaves a safe error state with an explicit retry/import recovery. With no saved custom level, the custom entry point shows Import rather than silently claiming a built-in fallback is the custom course. Use explicit generations/snapshots for async work.
- Determine save organisation before implementing storage. The pinned Defold `sys.save` serializes into a 512 KiB static buffer and heap-allocates larger tables (verified in LE1a, see [Storage](#storage)); do not assume one unbounded table can hold all levels, editor sources and backups. Evaluate a small index plus separate level saves; document actual limits, file sizes and error handling. Catch save errors and retain the last known-good save.
- Verify HTML5 persistence in the pinned engine, including its virtual-filesystem/IndexedDB synchronization. A successful in-memory write is not by itself proof of persistence after reload. Test failure and recovery; UI save status must reflect the completion/error signal actually available.
- Sources: [pinned serializer](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/script/src/script_sys.cpp), [sys API](https://defold.com/ref/sys-lua/), [HTML5 file operations](https://defold.com/manuals/html5/). Runtime verification is still required.

**R15 Edit-mode ownership and input isolation (LE2).** Edit mode is a defined runtime state, not merely a hidden vehicle or zero throttle. Safely suspend/deactivate vehicle gameplay, bounds/crash resets, follow camera and FINISH evaluation while editing; check the chosen mechanism against the pinned engine. This does not pull the complete M4 pause/slow-motion feature into scope. Entering Play builds/restores a canonical attempt through the existing owner/reset path.
- **State ownership:** editor document, Undo history, selection and editor camera live **outside** the proxied world (loader side), so a world reload for Play or a level switch cannot lose them.
- **Loop latency:** LE1b measures custom-level world-switch time **from the Play/import trigger until the vehicle is drive-ready** (not only individual load steps). **LE2 uses the world reload as the baseline.** An in-world rebuild path (second lifecycle, verified teardown per R14) is pursued only if the measured switch time actually disturbs Claudio's build–test loop in his drive test.
- Input gating includes Lua owner, existing GUI messages and HTML/JavaScript listeners (notably the document-level F feedback shortcut), plus browser-fed mobile/tilt commands where applicable. Do not let these bypass Edit mode or a focused field/dialog.
- On mode changes, import dialogs and focus loss, clear held commands, cancel active gestures and cancel/generation-guard pending gameplay actions. Returning focus must not accidentally place an object.

**R16 Two validation layers and stable identity (LE2 onward).** Validate source-document structure separately from gameplay validity: supported versions, finite/bounded input, unique stable object IDs, existing references, legal connection topology, curve/prefab data and explicit document-size/complexity limits. Incomplete authoring states are saveable; malformed structures cannot crash or run unbounded compiler work. The existing station validator remains the authority for compiled station rules. Never silently reduce accuracy or drop geometry to meet a budget.
- Document IDs are independent of Defold object IDs, pointers and physics handles; selection, connections, Undo and future decoration anchors refer to stable document IDs.
- Define the supported v1 terrain domain in LE3, including treatment of self-intersections, reversed segments, loops and one-sided collision orientation. Unsupported forms receive useful errors; arbitrary geometry support is not implied. Logical entry/exit order is separate from engine vertex orientation.

**R17 Undo and selection semantics (LE2–LE5b).** Choose Undo implementation from measured needs; commands are not mandatory. Evaluate bounded source-document snapshots or a hybrid before a complex command framework. Store authoring data, never live physics handles/state or copied textures. One completed action, including connected changes, is one history entry; a new edit after Undo clears the redo branch. View-only navigation is separate from geometry history. Selection is restored/resolved through stable IDs.
- Multi-select drag translates each connected run at most once, even when several selected pieces belong to it.
- Copy/paste allocates new IDs, preserves internal connections, and drops connections to objects outside the copied selection. START/FINISH uniqueness is explicit; ordinary passage duplication must not duplicate singleton markers.
- Prefab preview is a visual/geometry description; it must not require running full gameplay behavior. This boundary is especially important for future dynamic objects.

**R18 Tool scope and usability.** Keep the in-game Defold/Lua/GUI direction and the small HTML file helper. The editor research in #118 is not approval for Qt/Electron, a universal editor, plugins, multiplayer editing or a framework rewrite. Test the actual build → drive → change → Undo → save → reopen workflow with Claudio. Good navigation, readable controls/units, clear selection, cancellable previews and actionable warnings take precedence over a larger asset library. Reusable custom templates later need an explicit independent-copy versus linked-instance policy; no implicit retroactive changes to old courses.

## Screen layout (desktop, Defold GUI)
- **Top bar:** level name · save status · New · Open (my levels / templates) · Export · Import · Undo · Redo · **Play ▶**
- **Left tool palette:** Select (S) · Draw (D) · Curve (C) · Prefab (P) · START · FINISH · Label · Pan
- **Right panel:** properties of the selection (numeric fields: x, y, angle, length, height…), or level properties (name, start speed) when nothing is selected
- **Bottom status:** cursor x/y in metres · active snaps · zoom · warning count (click to list)

## Controls (Edit mode only; game keys keep working in Play)
- **Mouse:** left click selects/places. Left drag moves a selection or handle. Middle drag or Space+left drag pans. The wheel zooms around the cursor.
- **Keys:** E = Play from the editor / back to the editor while driving (R11) · Enter Play · F test start at mouse · S/D/C/P tools · Delete · Ctrl+Z / Ctrl+Y · G grid snap toggle · Shift/Alt/Ctrl as in R6.
- **Esc:** first cancels the current action (drag, polyline), then clears the selection.
- **Text/number input focus:** Defold GUI has no built-in text fields and the project has no text input trigger yet, so name and numeric fields are an **explicit implementation item** (engine behaviour checked against the pinned version). While a field is focused, E, F, Delete, Enter and tool keys act on the field only, never as editor/game actions.
- **All game actions are intercepted centrally while editing** (not a list of individual clashing keys; today the game binds e.g. W/S/A/D, arrows, R, C, F, P, T, H, M, V). Only editor actions are processed in Edit mode; R is disabled. Browser shortcuts (Ctrl+S, Ctrl+W) are not used.

## Editing basics (part of the first usable version)
- **Undo/redo per completed action:** a whole drag is one step; a prefab change including its connected pieces is one step. Undo history survives a test run.
- **Hover highlight:** before clicking it is visible whether an anchor, line, prefab or prefab handle will be picked; overlapping elements can be cycled.
- **Split segment / disconnect / delete point** with a preview of whether deleting a point joins its neighbours.

## Data model
- **Playable export = the existing station JSON** (schema 1, metres) **plus an optional `editor` block** that the game ignores. A **local draft** may have incomplete/invalid or absent compiled station data; its structurally valid editor sources remain recoverable. Draft storage is not advertised as a playable station. Document validation and playable-station validation are separate (R16). The block holds the source objects (polylines, curve anchors with tangents, prefab parameters, connections), settings (grid, sampling tolerances) and versions (R1). The compiled fields are regenerated on Play/Export (R1), so an exported level is directly a valid station file.
- **START / FINISH / checkpoints:** START maps to the existing `spawn` + `start_speed`. FINISH is an optional `finish` object (position + finish line segment + finish direction). **Trigger rule:** FINISH fires when the **chassis centre crosses the finish segment in the finish direction**, detected by a segment test between consecutive physics positions so fast crossings are not missed; "Finish reached" is shown **once per attempt** and re-armed on retry/new test start. Crossing against the direction does nothing. A `checkpoints` list (ordered; position, direction, respawn position) is reserved in the format; v1 writes it empty and the runtime ignores it. Exact field names are fixed in LE2 and validated by `station_data.validate`.
- **Compiler contract:** the compiler writes every field the validator requires: `schema` 1, `units` "metres", a new custom `id` matching `^[a-z][a-z0-9-]*$` (never starting with a built-in station id; e.g. `straight…` would trigger the checker background), `name`, `spawn`, `start_speed`, `run_in`/`run_out` (0 unless set), `bounds` (R13), `chains`, optional `hulls`, `labels`, `finish`, `checkpoints` (empty). No `kind`, `sections` or `markers` in custom levels.
- **No seams in terrain:** a connected run compiles into **one chain** (R4). Hull boxes are only for separate obstacles/platforms.
- **Chain orientation and ghost vertices** are handled by the compiler (solid side below the drawn line, matching the existing stations). Users never see this.
- **Validation** of compiled data for Play/Export reuses the game's own `station_data.validate` (no duplicated station rules); editor structures and references are checked by the separate source-document validator (R16). Station rules today: id and name ≤ 64 bytes each (they travel in every telemetry message, R14 message cap), points ≥ 1 cm apart, ≤ 32 chains, ≤ 2048 points per chain, non-empty terrain, ≤ 64 convex CCW hulls, ≤ 800 render objects (subject to R7), bounds, finite numbers. Bounds are computed automatically with a margin. Drafts may be invalid (R9).

## Prefab library v1 (static, parametric, each with handles)
| Prefab | Parameters | Notes |
|---|---|---|
| Flat | length | — |
| Ramp | input mode **angle + horizontal length** or **height + horizontal length**; slope length and the other value are shown | up or down; vertical drops use Step |
| Step | height | up or down |
| Gap with pit | width, pit depth | pit floor spans the gap (a bottomless gap is a later variant) |
| Kicker + landing | kicker angle, lip height, gap, landing type (flat/down/up) | like A19 |
| Bump / wave | height, wavelength, count | sampled per R8 |
| Platform | width, height (hull box) | separate obstacle |

## Storage
- **Locally in the game save** (browser storage on web, app storage later): a list of named levels with last-modified time. Autosave and recovery per R12.
- **Export / Import** a `.json` file (web: download / file picker via the HTML helper). Copy/paste the JSON as text as a fallback. Import opens as a copy (R12).
- **Templates:** all built-in stations are read-only and open as a copy (R2, R3).

### Custom level runtime and save (LE1a)

Implemented in `main/gym/custom.lua` (loader side), `custom.js` (HTML helper), `stations.lua` and `boot.script`. Pinned sources are Defold 1.14.0 `a81dbb0`.

- **Entry and import:** `?station=custom` restores the saved level; with none it shows the Import panel and an error world without a vehicle, never a built-in station. **I** or the **Import level** page button opens the panel: file picker (`.json`) or pasted text. Lua reads it, checks the 256 KiB text cap, decodes, runs `station_data.validate` and rejects a `kind` (station measurement data). An invalid import shows `Import failed: <reason>. The current level and its save are unchanged.` and does not touch the world.
- **Handover (R14):** a valid import is frozen as a loader-owned snapshot (`s<n>`, not the level id) and loaded through the existing `boot.script` unload → load sequence. `configure_station` carries only the snapshot id and generation; the world reads a deep copy. An import during a load is queued and runs after the current load reports ready; snapshots are released once the ready world has read them. Defold 1.14 runs every script and GUI script in one Lua context ([engine.cpp L1409](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/engine/src/engine.cpp#L1409), [L1498](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/engine/src/engine.cpp#L1498)), so the loader module survives world reloads.
- **Build failure:** terrain/decoration creation is guarded; a failure leaves a world without a vehicle, reports `Custom level could not be built`, reopens Import and keeps the previous save. Example: a hull that passes validation but whose vertices Box2D welds (`b2ComputeHull` < 3 points, [shape binding](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/gamesys/src/gamesys/scripts/box2d/v3/script_box2d_shape_v3.cpp#L261)).
- **Save organisation:** two alternating files `sys.get_save_file("rider", "custom-level-a" | "custom-level-b")` (HTML5: `/data/.rider/…`), each `{format=1, seq, text}` with the imported JSON text unchanged. Restore picks the valid slot (format, decode, validation) with the higher `seq`. A save writes the other slot, reads it back and only then counts. An import is saved only after its world reported ready. No index yet; LE4's level list adds a small index plus per-level slot pairs.
- **Limits:** import text ≤ 256 KiB, checked before decoding. `sys.save` uses a 512 KiB static buffer and heap-allocates beyond it ([script_sys.cpp L59, L142](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/script/src/script_sys.cpp#L142)); the cap keeps every custom save on the static path. Sample sizes: 0.5–3.7 KiB; a level at the 800-object budget stays far below the cap.
- **Failure handling:** native `sys.save` writes a temp file and renames it; HTML5 truncates the target and unlinks it on a write error ([L262](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/script/src/script_sys.cpp#L262)). The slot pair never overwrites the last good level. A failed save keeps the loaded level and shows `Save failed; the previous saved level is kept (…)`.
- **HTML5 persistence:** `sys.save` only writes the in-memory file system. The pinned dmloader syncs it to IndexedDB asynchronously after every file close and only logs sync errors ([dmloader.js L1342, L1384, L1452](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/com.dynamo.cr/com.dynamo.cr.bob/src/com/dynamo/bob/bundle/resources/web/dmloader.js#L1342)). The station line shows `Saving...` until that sync is idle, then `Saved`; a sync error shows `Browser storage sync failed…`, missing IndexedDB `Saved for this session only…`. When the retries are exhausted, dmloader leaves `_syncInProgress` set and never syncs again in that page; the helper wraps `Module._startSyncFS` to record that call and reports it as failed instead of `Saving...` forever. These read and wrap dmloader's internal `Module._sync*` fields, which must be rechecked on an engine update. A file import takes its request number when the file is chosen, so an older, slower read never replaces a newer import. The preview builds share one origin, so the save survives deployments; clearing site data removes it.
- **Input:** the open panel captures game input like the feedback fallback (held commands cleared). Browser keys reach the engine only while the canvas is focused ([library_glfw.js L190](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/external/glfw/js/library_glfw.js#L190)), so typing in the panel never drives. `html5.run` returns the helper's text through `eval` and `lua_pushstring` ([script_html5_js.cpp L91](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/script/src/script_html5_js.cpp#L91)).
- **Evidence:** debug case `le1a` ([gym notes](../../main/gym/README.md#custom-levels)): import A → invalid → B → A with identical shape/sprite/label counts, queued import during a load, retry and bounds reset, real page reloads, an injected Emscripten write error and a build failure. Samples: `main/gym/samples/`.

### Custom level measurement (LE1b)

Report, protocol and phone procedure: [LE1b report](../LE1B_REPORT.md) (debug case `le1b`, generator `tools/gym/levels.cjs`). Desktop results in CI, within the unchanged limits:
- Import → drive-ready takes 55–68 ms (median).
- The longest switch frame reaches 21–26 ms at 612–800 render objects.
- Physics steps stay at the 0.1 ms clock resolution.
- Length up to 99 km costs nothing measurable; Box2D memory grows by about 1 KiB per terrain shape.
- A full level uses 804 of the 1024 sprites (220 left for editor overlays).

Open for later tasks:
- A start 1.5 km or more from the origin fails vehicle placement, and the level is still saved.
- Unbounded text fields versus the 2 KiB `msg.post` cap.
- No import entry in touch mode once a level is saved.

Phone values are NOT RUN until Claudio supplies them. `Level load` in the feedback report shows switch/parse/terrain/decoration times on any device.

## Additional implementation and acceptance checks

Evidence each task must provide in addition to its issue's acceptance criteria. These refine the tasks; they are not additional feature packages.

| Task | Required evidence / contract |
|---|---|
| **LE1a** | Custom A → B → A and invalid import between valid imports; previous valid save survives failure; no leaked terrain/decorations or stale async mutations. Implement R14, document storage use/limits, and show the import/recovery entry point. |
| **LE1b** | Vary physical length and geometry complexity independently, including several accepted complexity steps and rejected limits. Fix and report sample duration/repeats, build/source/browser identity, viewport/DPR and preset. Separate build time, observed frame times (including tail/spikes) and available physics profile samples; values below timer resolution are not zero-cost evidence. Record save size and memory observations when measurable; mark unavailable metrics NOT RUN/unknown. No bypass of existing validation limits. |
| **LE2** | R15–R17 foundation: explicit Edit state, minimal source validator, revision-aware draft persistence, stable IDs, bounded Undo and safe version rejection. Repeat Edit ↔ Play enough times to demonstrate stable shape/sprite/joint counts. Save/reload an unfinished draft and continue editing. Held throttle → Edit → release → Play must be neutral. |
| **LE3** | Connected edit → Undo → Redo restores geometry and references. Multi-selection moves a run once. Define supported topology and screen-space selection/snap behavior; re-check editor budget. |
| **LE4** | Save failures preserve a usable backup; reload recovery is tested. Export → import keeps **lines, hulls, markers (START/FINISH), connections and level settings** equal; only explicitly defined identity fields may change, no byte equality. Copy/paste obeys identity/connection/marker rules. Known versus unsupported versions and expected stale compiled data are distinguished. |
| **LE5a** | Prefab parameters survive save/reload and export/import. Invalid parameters produce useful errors without silently changing the intended shape. Editor budget re-check with prefabs. |
| **LE5b** | Curve/tangent data and sampling settings survive save/reload and export/import. Sampling over budget produces an error, not a silent shape change. A defined smooth-hill reference trial tests the compiled path under stated conditions; one chain is not a universal guarantee of smooth driving. |
| **LE6** | Claudio's existing complete construction task remains the final practical acceptance. Judge time lost finding/selecting/editing/testing, not merely whether buttons exist. |

## Technical constraints
Single tick owner, once-only unit conversion, Defold-owned bodies/worlds, unchanged reset contract and vehicle tuning, no custom physics or manual stepping. The terrain is rebuilt only through the existing station build path. Editor handles/lines count against the sprite/label limits (1024 each).
