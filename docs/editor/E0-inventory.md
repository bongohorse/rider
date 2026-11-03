# Editor GUI script inventory (E0, #331)

Read-only inventory of `main/editor/editor.gui_script` for the behavior-preserving split in [#331](https://github.com/bongohorse/rider/issues/331). It records what E1–E3 must preserve; it changes no code and approves no slice. Line numbers are for main at `b2bf34c` (2026-11-03) and move with every editor change: re-run the [method](#method-and-limits) before relying on them.

**Contents:** [Method and limits](#method-and-limits) · [Size metrics](#size-metrics) · [Module-local state](#module-local-state) · [Callbacks, input and messages](#callbacks-input-and-messages) · [Dependencies and extraction hazards](#dependencies-and-extraction-hazards) · [Responsibility map](#responsibility-map) · [E1 candidates](#e1-candidates) · [Test coverage and durations](#test-coverage-and-durations) · [Appendix: every top-level function](#appendix-every-top-level-function)

## Method and limits

- Source: `git rev-parse HEAD` = `b2bf34c058235e55a19082261a6567872a38c1df` (= `origin/main` when measured).
- Sizes: `wc -l -c`; function counts: every `function` keyword outside comments (all definitions, including anonymous closures) and named definitions (`function x`, `local function x`, `x=function`, any depth).
- State, calls and dependencies: a lexical scope scan (helper kept outside the repository, `/tmp/p331/lua_inventory.py`). It tokenizes Lua 5.1, tracks `function`/`do`/`then`/`repeat` blocks, locals, parameters and `for` variables, and records per top-level function the file-scope locals it reads, assigns or field-writes, `self.<field>` and `editor.<field>` reads/writes, Defold globals and calls to other top-level functions. Cross-check: it finds the same 146 top-level functions as `grep -cE '^(local function |function |[a-z_]+=function)'`.
- Scan limits: writes through an alias (`local c=editor.camera; c.x=...`), dynamic keys (`self[key]` L2326, `self.ui[key]` L1466) and deeper chains are not attributed automatically; the ones that matter are listed by hand below. "Complexity" is an approximation: 1 + `if`/`elseif`/`for`/`while`/`repeat`/`and`/`or` tokens; Lua `a and b or c` idioms inflate it.
- Gym coverage is mapped from the runners' case names, buttons and keys (`grep` of `tools/gym/*.cjs` and `tools/gameplay/check_*_editor.cjs`), not from instrumented Lua coverage, which the HTML5 build does not provide.

## Size metrics

| File | Lines | Bytes | `function` keywords | Named definitions | Longest named definitions (lines) |
| --- | --- | --- | --- | --- | --- |
| `editor.gui_script` | 3,143 | 190,884 | 201 | 155 (146 top-level) | `on_input` 242, `on_button` 199, `render_ui` 174, `draw_overlay` 169, `describe` 141 |
| `editor_doc.lua` | 750 | 44,970 | 63 | 57 | `self_cross` 26, `from_station` 20 |
| `editor_edit.lua` | 700 | 34,884 | 57 | 56 | `reverse_run` 12 |
| `editor_ui.lua` | 603 | 42,658 | 24 | 23 | (most code is inside `M.render`) |
| `editor.lua` | 387 | 21,620 | 39 | 36 | `resolve_selection` 41, `check` 32 |
| `editor_prefab.lua` | 375 | 21,497 | 42 | 40 | `wave_samples` 16, `canonical_handles` 16 |
| `editor_lines.lua` | 294 | 15,806 | 19 | 19 | `refresh` 24 |
| `editor_versions.lua` | 200 | 12,209 | 28 | 21 | — |
| `editor_sample.lua` | 194 | 9,137 | 20 | 19 | `reach` 23, `walk` 20 |
| `editor_terrain.lua` | 187 | 10,811 | 13 | 11 | `materialize` 19 |
| `editor_view.lua` | 181 | 10,944 | 12 | 12 | `objects` 41 |
| `editor_auto_coins.lua` | 154 | 9,343 | 15 | 14 | `geometry` 21 |
| `editor_overlay.lua` | 146 | 7,064 | 13 | 13 | — |
| `editor_look.lua` | 125 | 7,341 | 16 | 15 | `candidate` 24 |
| `editor_track_align.lua` | 112 | 5,819 | 11 | 11 | — |
| `editor_coin_route.lua` | 91 | 4,940 | 9 | 8 | — |
| `editor_snap.lua` | 41 | 2,050 | 3 | 3 | — |
| `editor_zoom.lua` | 21 | 910 | 3 | 3 | — |
| **All 18 files** | **7,704** | **452,887** | | | |

In the module rows the longest-definition column covers file-scope `local function` bodies only; `function M.x` bodies are not measured separately. The issue's earlier figure (3,153 lines / 191,053 bytes at `7061496`) is now 3,143 / 190,884.

Top-level functions of `editor.gui_script` by length, with upvalue count (distinct file-scope locals referenced, including nested closures) and approximate complexity:

| Function | Lines | Length | Upvalues | Complexity |
| --- | --- | --- | --- | --- |
| `on_input` | 2158–2399 | 242 | 37 | 333 |
| `on_button` | 1414–1612 | 199 | 52 | 243 |
| `render_ui` | 2801–2974 | 174 | 32 | 362 |
| `draw_overlay` | 2630–2798 | 169 | 27 | 133 |
| `describe` | 2408–2548 | 141 | 21 | 83 |
| `canvas_press` | 1830–1964 | 135 | 31 | 104 |
| `canvas_move` | 1965–2073 | 109 | 20 | 64 |
| `confirm_name` | 1117–1203 | 87 | 11 | 48 |
| `step_focused` | 1340–1413 | 74 | 14 | 96 |
| `update` | 3059–3130 | 72 | 15 | 49 |
| `offered_buttons` | 1620–1683 | 64 | 13 | 77 |
| `readout` | 2549–2610 | 62 | 8 | 72 |
| `canvas_release` | 2097–2157 | 61 | 18 | 39 |
| `candidates` | 231–291 | 61 | 9 | 50 |
| `publish` | 3019–3058 | 40 | 16 | 120 |

Total approximate complexity of the script: 2,776. Ten functions (`on_input`, `on_button`, `render_ui`, `draw_overlay`, `describe`, `canvas_press`, `canvas_move`, `canvas_release`, `confirm_name`, `step_focused`) hold 1,391 of the 3,143 lines (44 %).

## Module-local state

The script has **181 file-scope locals**: 39 data locals (below) and 142 function locals (the [appendix](#appendix-every-top-level-function); `show_problem` and `problem_rows` are forward-declared at L472 and assigned at L1298/L1289). Four callbacks are globals (`init`, `on_input`, `update`, `on_message`). There is no `final` and no `on_reload`.

Data locals: "Written" is a later assignment to the local itself; "Field/index writes" changes the table it holds.

| Local | Line | Written (after declaration) | Field/index writes | Read by |
| --- | --- | --- | --- | --- |
| `editor` | 4 | — | 56 functions (appendix column editor = `w`); nested writes: `editor.selected[...]` L595, 619, 863, 1108, 1318, 2091; `editor.points[...]` L744, 747, 2117, 2119; `editor.camera.x/y` L1969–1970, 2817 and through the alias `c=editor.camera` in `set_zoom` L505–506 and `view_box` L1233–1235 | 98 functions (appendix column editor contains `r`) |
| `doc_lib` | 5 | — | — | 34 functions (appendix column Required modules) |
| `edit` | 6 | — | — | 31 functions (appendix column Required modules) |
| `prefab` | 7 | — | — | 18 functions (appendix column Required modules) |
| `snap_lib` | 8 | — | — | `snap`, `paste_at`, `steps`, `curve_drag`, `canvas_press`, `seg_text`, `draw_overlay` |
| `overlay` | 9 | — | — | `init`, `draw_overlay`, `update` |
| `editor_ui` | 10 | — | — | `init`, `set_zoom`, `usable`, `hit`, `on_input`, `draw_overlay`, `render_ui`, `update` |
| `zoom_policy` | 11 | — | — | `confirm_name`, `step_focused`, `on_button`, `render_ui` |
| `track_align` | 12 | — | — | `opened`, `track_context`, `adjust_track`, `drop_track`, `apply_auto`, `confirm_name`, `step_focused`, `on_button`, `render_ui`, `publish` |
| `auto_coins` | 13 | — | — | `auto_context`, `auto_value`, `set_auto`, `preview_auto`, `apply_auto`, `render_ui` |
| `terrain_look` | 14 | — | `on_input` (`terrain_look.session.drag` L2173; the session table is also changed through the alias `ls` L2194–2233) | `on_button`, `offered_buttons`, `on_input`, `render_ui`, `publish`, `update`, `on_message` |
| `stations` | 15 | — | — | `init`, `open_template`, `render_ui` |
| `custom` | 16 | — | — | `export`, `import` |
| `socket` | 17 | — | — | `init`, `show_problem`, `canvas_press`, `on_input`, `draw_overlay`, `render_ui`, `update` |
| `LOADER` | 18 | — | — | `init`, `play`, `on_input` |
| `PICK_PX` | 22 | — | — | `candidates` |
| `SNAP_PX` | 22 | — | — | `snap`, `connect_target` |
| `HANDLE_PX` | 22 | — | — | `draw_overlay` |
| `DOUBLE_S` | 22 | — | — | `canvas_press` |
| `DOUBLE_PX` | 22 | — | — | `canvas_press`, `canvas_move`, `canvas_release` |
| `MIN_ZOOM` | 25 | — | — | `set_zoom`, `view_box` |
| `MAX_ZOOM` | 25 | — | — | `set_zoom`, `view_box` |
| `ui` | 26 | `draw_overlay` L2633 | — | `tolerance`, `canvas_press`, `canvas_move`, `canvas_release`, `draw_overlay` |
| `C` | 27 | — | — | `draw_overlay` |
| `TOOLS` | 33 | — | — | `render_ui` |
| `MAX_NODES` | 35 | — | — | `publish` |
| `KIND_KEYS` | 36 | — | file scope L37 | `on_input` |
| `ROWS` | 40 | — | — | `refresh_library`, `on_button`, `offered_buttons`, `on_input`, `render_ui` |
| `TEMPLATE_ROWS` | 40 | — | — | `offered_buttons`, `on_input`, `render_ui` |
| `WARN_ROWS` | 42 | — | — | `on_button`, `offered_buttons`, `render_ui` |
| `VIEW` | 44 | — | — | `offered_buttons`, `view_rects` |
| `HELP_LEFT` | 49 | — | — | `render_ui`, `publish` |
| `HELP_RIGHT` | 76 | — | — | `render_ui`, `publish` |
| `SILHOUETTE` | 111 | — | — | `silhouette`, `show_silhouette` |
| `path` | 189 | — | — | `prefab_handles`, `curve_handles`, `candidates`, `anchors`, `connect_target`, `connect`, `placement`, `set_single`, `vertex_state`, `start_move`, `canvas_press`, `describe`, `draw_overlay`, `publish` |
| `cache` | 316 | `anchors` L337 | — | `anchors` |
| `corner_cache` | 779 | `corner_summary` L802 | — | `corner_summary` |
| `LABEL_TEXT` | 911 | — | — | `place_label` |
| `MODES` | 958 | — | — | `anchor_mode` |

Only three data locals are mutable state; everything else is a constant or a module:

- `ui` (L26): the DPR/panel scale, assigned every edit frame by `draw_overlay` (L2633: `o.s=self.ui.scale or 1;ui=o.s`) and read by `tolerance` and the canvas handlers. Pick and snap tolerances therefore use the scale of the **last drawn frame**; an extracted `tolerance` must take it as an argument.
- `cache` (L316) and `corner_cache` (L779): memo tables rebuilt by `anchors` (key: document, revision, skip set, drawn-point count/last point) and `corner_summary`.

Per-instance state lives in `self`: **89 fields**, used by 65 of 146 functions. The widest are `self.ui` (the `editor_ui` node pools and scroll state; read by 15 functions), `self.field` (focused text/number field; written by 11, read by 10), `self.drag`/`pan`/`box`/`pending` (gesture state, cleared together by `cancel` L162–167), `self.held` (modifier keys; replaced by `init`/`cancel`, its keys set by `on_input` L2182, read by 13), `self.drawing` (unfinished piece; written by 6, read by 13), dialog flags (`open_dialog`, `version_dialog`, `warnings_open`, `help_open`) and caches keyed by document revision (`library_*`, `bounds*`, `ghost_*`, `auto_*`, `track_*`, `attention_key`, `seen`, `published`). Full per-field writer/reader lists come from the same scan (helper `/tmp/p331/report.py`, not committed).

Shared state lives in the `editor` module (`main/editor/editor.lua`, "Defold 1.14 runs every script in one Lua context"): the same table is required by `main/game/boot.script` (mode, Play, import), `main/game/ui.gui_script`, `editor_view.lua`/`editor_lines.lua` (edit world; they write `editor.screen`) and `editor_look.lua`. The GUI script references it in **105 functions**, writes its fields in **56**, and touches **71 fields**; `editor.message` alone is written by 43 functions.

## Callbacks, input and messages

| Callback | Lines | Owns |
| --- | --- | --- |
| `init` | 134–155 | GUI render order 1; node pools (`overlay.init`, `editor_ui.init`, two silhouettes of 6 box nodes each); the template id list; the debug flag (HTML5 + debug engine + Gym case in `ea2, ea3, le2, le3, le4, le5a, le5b, le5c, le5d, le6`); the node count for the budget check; first `acquire_input_focus`; the **only** `window.set_listener` in `main/` (focus lost: `run_focus_lost` to the loader if the document is hidden or unfocused, then `focus_lost`/`refocus`; focus gained: a 1 s `refocus_until` window) |
| `update` | 3059–3130 | One-time focus re-acquire after every `init`; Import/Export panel polling (`html5.run`, L3066); render clear colour on mode change; focus-loss cancel; `editor.sync()`; `terrain_look.tick()`; Terrain Look capture message; 0.4 s autosave debounce (L3078, repeated inside the edit branch at L3081); Edit: panel size, label preview, hover re-pick and drawing discard on document change (key `doc:revision:tool`), auto-coin plan expiry, `draw_overlay`, `render_ui`; Play: hide overlays, overlay scale probe, play HUD (`editor_ui.play`); debug `publish` (every edit frame, else on change or every 0.25 s) |
| `on_message` | 3131–3143 | `editor_mode`: on a real mode change cancel gestures, close dialogs/field/help and drop an unfinished piece; leaving Edit closes Terrain Look and bumps `editor.look_epoch`; always re-acquire input focus |
| `on_input` | 2158–2399 | All editor input (R15). Order: Play mode only Terrain Look button and E, else `return false` (L2159–2172); focus-loss cleanup (L2173); Import/Export panel modal (L2175); held modifiers (L2179); scrollbars (L2186); Terrain Look modal (L2194–2234); help modal (L2237); focused field (L2246–2293); pointer move (L2294); press/release → `on_button` or `canvas_press`/`canvas_release` (L2299); pan (L2315); wheel (L2320); dialogs (L2340); key commands (L2344–2398). In Edit every branch returns `true` |
| `final`, `on_reload` | — | Not defined: the window listener and GUI nodes live until the component is deleted |

Input actions handled by `on_input`: `ui_pointer`, `editor_text`, `editor_ctrl`, `editor_shift`, `editor_space`, `editor_alt`, `editor_toggle`, `editor_play`, `editor_test`, `editor_cancel`, `editor_delete`, `editor_cycle`, `editor_tool_select`, `editor_tool_draw`, `editor_tool_prefab`, `editor_label`, `editor_grid`, `editor_fit`, `editor_centre`, `editor_connect`, `editor_split`, `editor_z`, `editor_y`, `editor_c`, `editor_v`, `editor_pan`, `editor_zoom_in`, `editor_zoom_out`, `help_toggle`, `lean_left` (key A: Ctrl+A selects a Terrain Look field) and `station_1`…`station_7` (`KIND_KEYS`, prefab types).

| Message | Direction | Sender (line) | Receiver |
| --- | --- | --- | --- |
| `acquire_input_focus` | sent | `init` L146, `update` L3063, `on_message` L3141 | `.` (this game object) |
| `run_focus_lost` | sent | window listener L151 | `main:/loader#script` (`boot.script` L382; also sent by `controller.script` L367) |
| `editor_play` `{test}` | sent | `play` L486 | loader (`boot.script` L402–404) |
| `editor_enter` | sent | `on_input` L2168 | loader (`boot.script` L399–403) |
| `terrain_look_open` | sent | `on_input` L2164 | loader (`boot.script` L394) |
| `clear_color` `{color}` | sent | `update` L3069 | `@render:` |
| `terrain_look_capture` `{active}` | sent | `update` L3076 | `gym:/owner#script` (`controller.script` L734) |
| `editor_mode` `{mode}` | received | `boot.script` `set_mode` L48 (to `main:/editor#gui`) | `on_message` L3132 |

JavaScript bridge (`html5.run`): reads `document.hidden`/focus (L151), `riderFeedback`/`riderCustom` visibility (L2161, L3066); calls `window.riderCustom.exportLevel` (L1019); debug only, writes `window.riderEditor` (L3026), `window.riderEditorDoc` and `window.riderEditorPaths` (L3052–3056, on document revision change). `import` opens the HTML panel through `custom.open` (L1025).

## Dependencies and extraction hazards

Required at file scope (L4–17): `main.editor.editor`, `editor_doc`, `editor_edit`, `editor_prefab`, `editor_snap`, `editor_overlay`, `editor_ui`, `editor_zoom`, `editor_track_align`, `editor_auto_coins`, `editor_look`, `main.game.stations`, `main.game.custom`, `socket`. Required inline inside functions (14 sites): `main.game.coin_data` (L269, L3025), `main.game.fuel` (L1145, L1387, L1468, L1470, L1840), `main.game.medals` (L1155, L1478, L1481), `main.terrain_perspective.projection` (L2196–2197), `main.terrain_perspective.profile` (L2945, L3116). The edit-world modules `editor_view`, `editor_lines` and `editor_terrain` are not required here (the world controller owns them); `editor_sample`, `editor_versions` and `editor_coin_route` are reached only through other modules.

| Function group (lines) | Modules used | `editor` | `self` | GUI nodes / runtime handles |
| --- | --- | --- | --- | --- |
| Constants, HELP, silhouettes (1–133) | `prefab` (KIND_KEYS), `editor_ui` (colours), `zoom_policy` | — | `silhouette` | `gui.new_box_node`, `gui.set_*` (silhouette nodes) |
| Geometry, cursor, find (156–189) | `edit` (`find`) | `map`, `find`, `cancel` | `cursor`, `cancel` | — |
| Picking, handles, snap (190–345) | `doc_lib`, `prefab`, `snap_lib`, inline `coin_data` | yes | `set_hover`, `snap` | file cache `cache` |
| Document commands, play, zoom, open/library (346–577) | `edit`, `doc_lib`, `stations`, `track_align` | yes, commits | most | `msg.post` (`play`), `editor.library()`/`versions` (storage) |
| Clipboard, prefab params, points, corners, labels, fields (578–1011) | `edit`, `doc_lib`, `prefab`, `snap_lib` | yes, commits | some | file cache `corner_cache` |
| Export/import, track, auto coins, `confirm_name` (1012–1207) | `custom`, `track_align`, `auto_coins`, `zoom_policy`, `edit`, inline `fuel`/`medals` | yes, commits | yes | `html5.run`, `json` |
| View navigation, problems, help, stepped fields (1208–1413) | `doc_lib`, `prefab`, `zoom_policy`, `track_align`, `editor_ui` | camera writes | yes | `socket.gettime` (flash) |
| `on_button`, offered buttons, hit (1414–1694) | all but `snap_lib`, `overlay`, `auto_coins` direct | yes | yes | `gui.pick_node` (`hit`), `os.date` |
| Canvas gestures (1695–2157) | `doc_lib`, `edit`, `prefab`, `snap_lib`, inline `fuel` | yes, previews and commits | yes | `socket.gettime` (double click), `ui` scale |
| `on_input` (2158–2399) | `editor_ui`, `terrain_look`, inline `projection` | yes | yes | `gui.pick_node`, `html5.run`, `msg.post`, `hash` |
| Description, readout (2400–2610) | `doc_lib`, `edit`, `prefab`, `snap_lib` | read only | `readout` | — |
| Overlay drawing (2611–2798) | `overlay`, `doc_lib`, `edit`, `snap_lib`, `editor_ui` | read only | yes | `gui.set_scale`, `window.get_size`, `ui` written |
| `render_ui` (2799–2974) | `editor_ui`, `prefab`, `zoom_policy`, `track_align`, `auto_coins`, `terrain_look`, `stations`, inline `profile` | reads; camera write L2817 | yes | `window.get_size`, `os` |
| Debug publish (2975–3058) | `doc_lib`, `track_align`, `terrain_look`, inline `coin_data` | read only | yes | `gui.get_screen_position`, `html5.run`, `json` |
| `update`, `on_message` | `overlay`, `editor_ui`, `terrain_look`, inline `profile` | yes | yes | `msg.post`, `sys.get_config_*`, `gui.get_screen_position` |

Hazards an extraction must respect:

1. **Lua limits in the pinned engine.** Defold's Lua 5.1 (`engine/lua/src/dmsdk/lua/luaconf.h` L477/L484 at `a81dbb0`) allows 200 locals and 60 upvalues per function; LuaJIT has the same `LJ_MAX_LOCVAR 200`/`LJ_MAX_UPVAL 60` (`src/lj_def.h` L68–69, v2.1 branch; the pinned 3e223cb build was not checked). The main chunk holds **181/200** locals and `on_button` references **52/60** upvalues (`on_input` 37). Each new file-scope `require` or alias costs one local; adding helpers that `on_button` calls costs it upvalues. Moving code out with `local f=M.f` aliases keeps both counts; moving `on_button` branches out lowers them.
2. **Shared `editor` singleton.** Most groups read and write `editor` fields directly (selection, vertex/anchor/points, preview, message, camera, hover). Moved code must keep reading the same module table at call time, never a cached copy, and keep the write order (for example `editor.touch()` after a preview change).
3. **Frame-order coupling through `ui`.** `tolerance` and the canvas handlers use the scale assigned in the previous `draw_overlay`.
4. **Definition order.** Locals are captured where they are declared: `play` (L473) calls `show_problem`/`problem_rows`, which only exist from L1289/L1298 via the forward declaration at L472. A moved function needs its dependencies bound before the alias line.
5. **Input ownership.** Only this GUI component consumes editor input (it re-acquires focus in `init`, the first `update` and every `editor_mode`); a second consumer or a moved `on_input` changes the input stack (R15).
6. **GUI nodes and budget.** Overlay, UI and silhouette nodes are created once in `init`; `max_nodes` is 640 in `editor.gui` and the Gym cases record 628 used. `gui.*` calls must stay in the GUI script context.
7. **Runtime handles.** The window listener closure captures `self` (L147); `html5.run` strings, `msg.post` addresses (`main:/loader#script`, `gym:/owner#script`, `@render:`) and `sys` config keys are runtime coupling, not data.
8. **Tests that read the source.** `tests/ci/test_editor_help.py` parses the text between `-- HELP BEGIN` and `-- HELP END` in this file (and `tests/ci/test_repo_tooling.py` L51 pairs the two); moving `HELP_LEFT`/`HELP_RIGHT` needs that test updated in the same PR. Several runners (`refocused()` in `curve.cjs`, `library.cjs`, `objects.cjs`) wait 1.1 s after the HTML panel closes, which appears to wait out the 1 s `refocus_until` window set in `init`.
9. **Local test selection.** `editor.gui_script` and every module it requires are in the bootstrap closure, so `tools/local.py` selects the whole Gym inventory for any change to them (`tests/g2/test_local_first.py`). A new required module joins that closure.

## Responsibility map

The issue's map with current line ranges (`/tmp/p331/groups.py`; the ranges tile the file without gaps):

| Responsibility | Lines | Size | Functions | Was (2026-11-01) | Risk (issue) |
| --- | --- | --- | --- | --- | --- |
| Header: requires, constants, colours, HELP text | 1–111 | 111 | 1 | — | Low (help test reads it) |
| Ghost silhouette nodes | 112–133 | 22 | 2 | — | Medium: GUI nodes |
| `init` and module-local state | 134–155 | 22 | 1 | `init` ~134 | High: input ownership, proxy lifecycle |
| Gesture reset, cursor/map, geometry, `find`/`path` | 156–189 | 34 | 11 | — | Low–High (see E1) |
| Pick candidates, handles, hover, snap | 190–345 | 156 | 10 | `candidates/snap` ~231–348 | High: pixel tolerance, joins, world units |
| Document commands: delete, place, draw finish, connect, split | 346–471 | 126 | 7 | — | High |
| Play and test start | 472–495 | 24 | 2 | — | High |
| Zoom | 496–508 | 13 | 2 | — | Medium |
| Document switch and My levels | 509–577 | 69 | 7 | `open_template/open_saved/new_level` ~525–579 | Medium: Undo, active document, camera |
| Clipboard and mirror | 578–623 | 46 | 4 | — | Medium |
| Prefab params and placement | 624–680 | 57 | 5 | — | Medium |
| Point selection (LE5c/LE5d) | 681–771 | 91 | 11 | — | High |
| Corner/smooth bulk, convert prefab | 772–907 | 136 | 10 | — | Medium |
| Labels | 908–944 | 37 | 3 | `edit_label` ~920 | High: save and focus |
| Property rows, anchor mode, param fields | 945–1011 | 67 | 6 | `param_click/confirm_param` ~985 | High: save and focus |
| Export/import | 1012–1026 | 15 | 2 | — | Medium |
| Text-field helper, track align, auto coins | 1027–1116 | 90 | 9 | — | Medium |
| `confirm_name` (commit of every focused field) | 1117–1203 | 87 | 1 | — | High: save and focus |
| `set_tool` | 1204–1207 | 4 | 1 | — | Low |
| View navigation (LE6) and boxes | 1208–1287 | 80 | 13 | `view_box/fit_level` ~1230–1286 | Medium: camera |
| Problems list and help | 1288–1330 | 43 | 3 | — | Medium |
| Stepped fields | 1331–1413 | 83 | 2 | — | High: save and focus |
| `on_button` | 1414–1612 | 199 | 1 | `on_button` ~1424 | High: save and focus |
| Offered/visible buttons, hit test | 1613–1694 | 82 | 4 | — | Medium |
| Canvas gestures: press/move/release, drags, box | 1695–2157 | 463 | 12 | `canvas_press/move/release` ~1840–2107 | High: pixel tolerance, joins, world units |
| `on_input` | 2158–2399 | 242 | 1 | `on_input` ~2168 | Very high: input must not leak to driving |
| Description and readout text | 2400–2610 | 211 | 4 | `describe/readout` ~2418 | Medium |
| Ghost state and overlay drawing | 2611–2798 | 188 | 2 | `draw_overlay` ~2640 | Medium: GUI node/resource budget |
| Panel rendering (`render_ui`) | 2799–2974 | 176 | 1 | — | Medium: GUI node budget |
| Debug publish (`window.riderEditor*`) | 2975–3058 | 84 | 6 | — | Low (debug only, but every Gym case reads it) |
| `update` | 3059–3130 | 72 | 1 | `update` ~3069 | Medium |
| `on_message` | 3131–3143 | 13 | 1 | — | Medium |

## E1 candidates

Ranked by how provably side-effect-free they are. Evidence for every function: the scope scan finds no `self`, no `editor`, no GUI/`msg`/`html5`/`sys`/`socket` access, and no upvalue other than the listed group members; "Std" means only `math`, `string`, `table`, `ipairs`, `pairs`, `select`, `tonumber`.

| Rank | Group | Functions (lines) | Inputs → outputs | Upvalues / globals | Callers (sites) |
| --- | --- | --- | --- | --- | --- |
| 1 | **Geometry core** | `to_px` 177, `dist` 178, `length` 179, `seg_t` 180–183, `seg_dist` 184–187, `curve_nearest` 1793–1812 | points `{x,y}`, a screen map `{ox,oy,ppm_x,ppm_y}`, a curve object's `anchors` → numbers or new tables; arguments are only read | none; `seg_dist` uses `seg_t`/`dist`, `curve_nearest` uses `seg_t`/`dist`; Std (`math`) | 13 other functions; 68 sites (63 outside the group): `to_px` 28, `dist` 25, `length` 10, `seg_t` 3, `seg_dist` 1, `curve_nearest` 1 |
| 1 | **Text formatting** | `shorten` 107, `plural` 772, `names_text` 773–776, `bulk_text` 818–827, `number_text` 946, `drop_char` 1028–1032 | strings, numbers, lists of names, a bulk-result record → new strings; arguments only read | none; `bulk_text` uses `plural`/`names_text`; Std (`string`, `table`) | 8 other functions; 35 sites (28 outside the group); `number_text` (18 sites) is an `on_button` upvalue |
| 2 | Box accumulator | `grow` 1213, `empty_box` 1214 | `grow` **mutates its caller-owned box argument** by design; `empty_box` returns a new box | none; Std | 8 functions, 15 sites |
| 2 | Keys and predicates | `anchor_key` 1753–1757, `same_params` 643–647, `editable` 685, `point_total` 686, `end_point` 223–226 | anchors/params/objects → string, boolean, number or point; read only | none; Std | 1–4 callers each |
| 3 | Pure-module wrappers | `seg_text` 2404 (`snap_lib.measure`), `wave_note` 829 (`edit.convert_deviation`), `one_sided` 2400 (`doc_lib`), `start_box` 1215 (`doc_lib.VEHICLE`, mutates its box), `prefab_handles` 191 (`prefab`, `doc_lib.path`) | read only, apart from `start_box` | one required pure module each | 1–5 callers |
| Not E1 | Anything reading `editor`, `self`, `ui` or a file cache | `map`, `tolerance` (`ui`), `find`, `cursor`, `curve_handles`, `candidates`, `anchors`, `snap`, … | — | `editor` singleton or frame state | — |

**Recommendation for E1: the geometry core**, moved verbatim into a new `main/editor/editor_geometry.lua` (pure, metres, like `editor_snap.lua`/`editor_sample.lua`), bound back with `local to_px,dist,length,seg_t,seg_dist=geometry.to_px,…` at L177–187 and `local curve_nearest=geometry.curve_nearest` at L1793. Why:

- **Provably pure**: no upvalues outside the group, Std `math` only, no argument mutation (unlike `grow`), no state, so the move cannot change evaluation order or shared state; aliases at the same lines keep every caller, the definition order and the 52/60 `on_button` upvalues unchanged (no caller is `on_button`), at a cost of one main-chunk local (181 → 182 of 200).
- **Highest value for the risk**: 63 call sites outside the group in the high-risk picking, drag, overlay and readout code (`candidates`, `canvas_press/move/release`, `connect_target`, `draw_overlay`, `describe`, …). Today these locals cannot be unit-tested; in a module they get a fast LuaJIT suite in `tests/gameplay/` (run by `tools/gameplay/lua_tests.py`, like `editor_zoom.lua`) pinning their numbers, including the 63-step Bézier search in `curve_nearest`.
- **Covered by real input**: `le3`, `le5b`, `le5c`, `le5d` and `le6` pick, snap, drag and draw handles through these helpers; `curve_nearest` runs on the double-click insert in `le5b` (Bézier branch, `insert_delete_split_anchors`) and `le5c` (straight-chord corner branch, `tools/gym/path.cjs` L145–149).
- Duplicates exist (`editor_sample.lua` L15 `length(a,b)` and L48 `dist(px,…)`, `main/game/course_progress.lua` L7 `dist`) with other signatures; merging them would be a logic change and stays out of E1.

The text group is the equally pure alternative (smaller, but its main consumer is `on_button`, the most crowded function, and its results are UI strings checked only indirectly); it fits a later slice or E1b.

## Test coverage and durations

Durations from one local run at `b2bf34c` on a clean working tree (`python tools/local.py gym --case le3,le4,le5b,le5c,le5d,le6,ea2,ea3 --jobs 1`; run `711305a2`, Chromium 156, cached bundle, no build in the wall time): **PASS, 8/8 cases, 653.1 s case time, 10 min 53 s wall time**. Single-run local figures on a WSL2 host, not CI timings; a first run minutes earlier passed every runner too but was marked FAIL by the tool's source-change guard because this document's index entry was edited during it, so it is not used.

| Case | Runner cases | Duration | Notes |
| --- | --- | --- | --- |
| `le3` | 15 | 74.9 s | |
| `le4` | 12 | 54.6 s | |
| `le5b` | 11 | 77.4 s | |
| `le5c` | 4 | 32.2 s | |
| `le5d` | 5 | 57.4 s | |
| `le6` | 23 | 257.3 s | 9 polish cases 66.5 s; Editor A UI checks and gameplay modules 190.3 s, of which medals 8.5 s, zoom 19.7 s, **coins 9.0 s**, drop to track 20.4 s, along track 27.9 s, auto coins 26.4 s, **gems 8.2 s**, **fuel 21.4 s** (`RIDER_LE6_CHECKPOINT` lines) |
| `ea2` | 7 | 45.5 s | |
| `ea3` | 7 | 53.9 s | |
| **Total** | **84** | **653.1 s** | |

The gameplay editor coins/gems/fuel checks (`tools/gameplay/check_coin_editor.cjs`, `check_gem_editor.cjs`, `check_fuel_editor.cjs`) have no case of their own: they run inside `le6` (in CI only in part 2/2). Every case that reports it records 628 of 640 GUI nodes. These timings and PASS results are the no-op baseline an E1 PR must reproduce without relaxed assertions or longer timeouts.

Function groups each case exercises through real browser input (runner, its case names, and the editor buttons/keys it uses):

| Case (runner) | Cases | Function groups exercised |
| --- | --- | --- |
| `le3` (`tools/gym/draw.cjs`) | 15: drawing, snapping Alt/Shift/Ctrl/G, insert/split/disconnect/connect/delete, bridge, box select, run move, Undo/Redo, templates, unsupported shapes, budgets, empty course, drive to finish | `finish_drawing`, picking/snap (`candidates`, `anchors`, `snap`), document commands (`connect`, `connect_target`, `split`, `delete`), canvas gestures, `box_select`, `open_template`/`opened`, `play`/`problem_rows`, warnings in `on_button`, autosave in `update`, `publish` |
| `le4` (`tools/gym/library.cjs`) | 12: My levels and templates, new level and name field, delete confirmation, export/import, changed/stale compiled data, unsupported versions, copy/paste, failed saves and syncs | Document switch and library (`refresh_library`, `library_snapshot`, `open_saved`, `delete_saved`, `new_level`), `confirm_name`/`drop_char`, `export`/`import`, conflict buttons, `copy_selection`/`paste_at`, `mirror` |
| `le5b` (`tools/gym/curve.cjs`) | 11: curve drawing, tangent/anchor drag, insert/delete/split anchors, wave fields and handles, over-budget Play, copy/paste/mirror, steps, compiler upgrade, drive, budgets | Curve handles (`curve_handles`, `start_handle`, `curve_drag`, `anchor_key`), `curve_nearest` (double-click insert), prefab placement (`placement`, `place_prefab`), property rows (`param_click`, `confirm_param`, `param_rows`) |
| `le5c` (`tools/gym/path.cjs`) | 4: smooth/corner on a hill and a joint, copy/paste/mirror, convert prefab to path | `smooth_point`, `smooth_state`, `convert_prefab`, `wave_note`, corner rows |
| `le5d` (`tools/gym/points.cjs`) | 5: box/Shift point selection, bulk smooth vs point by point, box rule, multi-point drag, convert whole prefabs, persistence and drive | Point selection (`own_point` … `box_points`, `toggle_point`, `settle_points`, `start_points`), `bulk_corner`, `bulk_text`, `corner_summary` |
| `le6` (`tools/gym/polish.cjs`, `editor_ui_checks.cjs`, `tools/gameplay/check_*_editor.cjs`) | 23: 9 polish cases (problems, view row, bounds, template pages, labels, help, ghost, readouts), 6 Editor A UI cases (layout/collapse, feedback and scroll, numeric focus steps, scrolling and modal capture, budgets, coin categories) and 8 gameplay editor modules: medals (`g3_…`), zoom, ordinary coins (`g4_coin_authoring_…`), drop to track, along track, auto coins, gems (`g5_multiple_gems_…`), fuel (`g6_configurable_fuel_…`) | View navigation (`fit_level`, `centre_selection`, `go_start`, `go_last_test`, `view_box`), `current_bounds`, ghost (`ghost_state`, silhouettes), help modal, labels, problems, `describe`/`readout`, panel layout, scroll and modal capture in `on_input`, `step_focused`/`stepped_params`, and the `on_button` branches for medals, zoom, coins, track height/along track, auto coins, gems and fuel |
| `ea2` (`tools/gym/objects.cjs`) | 7: bounded list, selection/search/naming, hide/lock, copy/mirror IDs, invalid metadata, save/reload/import/drive | `on_button` `object_*` branches, `confirm_name` (name/search fields), `mirror`, `export`/`import` |
| `ea3` (`tools/gym/versions.cjs`) | 7: automatic timing, named snapshot/restore/Undo, delete level versions, incomplete/unknown versions, limits, write/sync failure, viewports | `on_button` version branches (`versions`, `snapshot`, `restore_`, `versiondel_`), version rows in `render_ui`, `delete_saved` |

Every case drives `on_input`, `update`, `on_message` (E/Play mode changes), `render_ui`, `draw_overlay` and debug `publish`, whose `window.riderEditor` state the runners read. Gaps for the listed cases: the Terrain Look modal in `on_input` (L2194–2234; no listed runner presses a `look_*` button, it is covered by `tools/terrain_perspective/` checks) and real window focus loss (the runners only wait out the refocus window after the HTML panel). `le2` (shell, input isolation) and `le5a` (prefabs) also exercise the script but are not in the issue's list.

## Appendix: every top-level function

Upvalues: distinct file-scope locals referenced (including nested closures). `self`/`editor`: `r` read, `w` field write (alias writes listed in [Module-local state](#module-local-state) are not in this column). Required modules exclude `editor` and the inline requires listed in [Dependencies and extraction hazards](#dependencies-and-extraction-hazards).

| Function | Lines | Len | Upvalues | self | editor | Required modules | Defold/JS API | Called by |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `shorten` | 107–107 | 1 | 0 | — | — | — | — | describe |
| `silhouette` | 112–120 | 9 | 1 | rw | — | — | gui | init |
| `show_silhouette` | 122–133 | 12 | 1 | — | — | — | gui | draw_overlay, update |
| `init` | 134–155 | 22 | 6 | rw | — | overlay, editor_ui, stations, socket | gui, msg, sys, window, html5 | Defold |
| `clear_auto` | 158–161 | 4 | 1 | w | rw | — | — | apply_auto, auto_context, cancel, on_button, on_input, preview_auto, set_auto, update |
| `cancel` | 162–167 | 6 | 2 | w | rw | — | — | import, on_button, on_input, on_message, open_help, opened, play, update |
| `map` | 168–168 | 1 | 1 | — | r | — | — | canvas_move, canvas_release, cursor, draw_overlay, render_ui, set_zoom, tolerance, view_box |
| `cursor` | 169–175 | 7 | 1 | rw | — | — | — | canvas_move, canvas_press, on_input |
| `tolerance` | 176–176 | 1 | 2 | — | — | — | — | candidates, connect_target, snap |
| `to_px` | 177–177 | 1 | 0 | — | — | — | — | canvas_release, draw_overlay |
| `dist` | 178–178 | 1 | 0 | — | — | — | — | candidates, canvas_move, canvas_press, canvas_release, connect, connect_target, curve_nearest, describe, draw_overlay, prefab_handles, seg_dist, start_move |
| `length` | 179–179 | 1 | 0 | — | — | — | — | curve_drag, describe, draw_overlay, readout, start_handle |
| `seg_t` | 180–183 | 4 | 0 | — | — | — | — | canvas_press, curve_nearest, seg_dist |
| `seg_dist` | 184–187 | 4 | 2 | — | — | — | — | candidates |
| `find` | 188–188 | 1 | 2 | — | r | edit | — | anchor_mode, apply_params, bulk_corner, candidates, canvas_move, canvas_press, canvas_release, confirm_label, confirm_name, confirm_param, connect, connect_target, convert_prefab, corner_summary, delete, describe, describe_candidate, draw_overlay, edit_label, finish_drawing, has_paths, object_corner_mode, offered_buttons, on_button, on_input, own_point, param_click, placement, point_of, point_pos, published_handles, published_rows, readout, render_ui, selection_box, set_single, show_problem, single_point, smooth_state, split, start_handle, start_move, start_points, start_vertex, step_focused, vertex_state |
| `prefab_handles` | 191–199 | 9 | 4 | — | — | doc_lib, prefab | — | object_handles, prefab_end_handle |
| `curve_handles` | 203–214 | 12 | 3 | — | r | doc_lib | — | object_handles |
| `object_handles` | 215–219 | 5 | 2 | — | — | — | — | candidates, draw_overlay, published_handles |
| `drawing_tool` | 220–220 | 1 | 1 | — | r | — | — | canvas_move, canvas_press, draw_overlay, readout |
| `end_point` | 223–226 | 4 | 0 | — | — | — | — | describe, draw_overlay |
| `candidates` | 231–291 | 61 | 9 | — | r | doc_lib | — | canvas_move, canvas_press, update |
| `describe_candidate` | 292–302 | 11 | 2 | — | — | doc_lib | — | readout |
| `set_hover` | 304–313 | 10 | 1 | rw | rw | — | — | canvas_move, canvas_press, on_input, update |
| `anchors` | 317–339 | 23 | 4 | — | r | doc_lib | — | snap |
| `snap` | 340–345 | 6 | 5 | rw | r | snap_lib | — | canvas_move, canvas_press, curve_drag, place_label, placement |
| `selected_object` | 346–348 | 3 | 1 | — | r | — | — | describe |
| `delete` | 349–371 | 23 | 3 | — | rw | edit | — | on_button, on_input |
| `place` | 372–379 | 8 | 1 | — | r | — | — | canvas_press, canvas_release |
| `finish_drawing` | 383–404 | 22 | 3 | rw | rw | edit | — | canvas_press, export, on_input, play, set_tool |
| `connect_target` | 405–421 | 17 | 7 | — | r | edit | — | connect, describe, draw_overlay |
| `connect` | 422–458 | 37 | 6 | — | rw | edit | — | on_button, on_input |
| `split` | 459–471 | 13 | 3 | — | rw | edit | — | on_button, on_input |
| `play` | 473–487 | 15 | 6 | rw | rw | — | msg | on_button, on_input, test_start |
| `test_start` | 488–495 | 8 | 3 | r | rw | doc_lib | — | on_input |
| `set_zoom` | 496–507 | 12 | 5 | r | r | editor_ui | — | confirm_name, on_button, step_focused, zoom |
| `zoom` | 508–508 | 1 | 2 | r | r | — | — | on_input |
| `opened` | 511–516 | 6 | 3 | rw | w | track_align | — | new_level, on_button, open_saved, open_template |
| `open_template` | 517–527 | 11 | 4 | — | rw | doc_lib, stations | — | on_button |
| `refresh_library` | 529–535 | 7 | 2 | rw | r | — | — | delete_saved, library_snapshot, on_button |
| `library_snapshot` | 539–543 | 5 | 2 | r | r | — | — | publish, render_ui |
| `open_saved` | 544–552 | 9 | 2 | w | rw | — | — | on_button |
| `delete_saved` | 553–570 | 18 | 2 | rw | rw | — | — | on_button |
| `new_level` | 571–577 | 7 | 3 | r | rw | doc_lib | — | on_button |
| `copy_selection` | 579–589 | 11 | 2 | — | rw | edit | — | on_input |
| `paste_by` | 590–600 | 11 | 2 | — | rw | edit | — | paste_at |
| `paste_at` | 602–610 | 9 | 4 | r | rw | edit, snap_lib | — | on_button, on_input |
| `mirror` | 613–623 | 11 | 2 | — | rw | edit | — | on_button |
| `apply_params` | 626–642 | 17 | 3 | — | rw | edit | — | anchor_mode, canvas_release, confirm_param, on_button, param_click, step_focused |
| `same_params` | 643–647 | 5 | 0 | — | — | — | — | canvas_move, canvas_release |
| `steps` | 650–653 | 4 | 2 | r | r | snap_lib | — | canvas_move |
| `placement` | 657–672 | 16 | 6 | — | r | doc_lib, prefab | — | canvas_move, on_input, place_prefab, update |
| `place_prefab` | 673–680 | 8 | 4 | — | rw | edit, prefab | — | canvas_press |
| `editable` | 685–685 | 1 | 0 | — | — | — | — | box_points, has_paths, own_point, point_of |
| `point_total` | 686–686 | 1 | 0 | — | — | — | — | box_points, own_point, start_points |
| `own_point` | 687–697 | 11 | 5 | — | r | doc_lib | — | box_points, point_of, single_point |
| `point_of` | 699–706 | 8 | 3 | — | — | — | — | canvas_press, single_point |
| `point_pos` | 707–711 | 5 | 2 | — | r | — | — | draw_overlay, selection_box, start_points |
| `single_point` | 713–718 | 6 | 4 | — | r | — | — | canvas_release, toggle_point |
| `set_single` | 721–731 | 11 | 3 | — | rw | — | — | canvas_release, settle_points |
| `settle_points` | 733–739 | 7 | 2 | — | rw | — | — | canvas_release, toggle_point |
| `toggle_point` | 741–749 | 9 | 3 | — | rw | — | — | canvas_press, canvas_release |
| `has_paths` | 750–753 | 4 | 3 | — | r | — | — | canvas_press, describe, object_corner_mode |
| `box_points` | 755–771 | 17 | 4 | — | r | — | — | canvas_release |
| `plural` | 772–772 | 1 | 0 | — | — | — | — | bulk_text, describe |
| `names_text` | 773–776 | 4 | 0 | — | — | — | — | bulk_corner, bulk_text |
| `corner_summary` | 780–804 | 25 | 6 | — | r | doc_lib, edit, prefab | — | describe |
| `object_corner_mode` | 807–815 | 9 | 4 | — | r | doc_lib | — | describe, offered_buttons |
| `bulk_text` | 818–827 | 10 | 2 | — | — | — | — | bulk_corner |
| `wave_note` | 829–835 | 7 | 1 | — | — | edit | — | bulk_corner, convert_prefab |
| `bulk_corner` | 836–867 | 32 | 8 | rw | rw | doc_lib, edit, prefab | — | on_button |
| `smooth_state` | 870–882 | 13 | 3 | — | r | edit | — | offered_buttons, render_ui, smooth_point |
| `smooth_point` | 883–891 | 9 | 3 | — | rw | edit | — | on_button |
| `convert_prefab` | 893–907 | 15 | 5 | rw | rw | edit, prefab | — | on_button |
| `edit_label` | 912–918 | 7 | 3 | w | w | doc_lib | — | canvas_press, param_click, place_label |
| `place_label` | 919–929 | 11 | 4 | — | r | — | — | canvas_press |
| `confirm_label` | 930–944 | 15 | 3 | rw | rw | edit | — | confirm_name |
| `number_text` | 946–946 | 1 | 0 | — | — | — | — | on_button, param_click, render_ui, step_focused, stepped_params |
| `param_rows` | 947–955 | 9 | 2 | — | r | prefab | — | offered_buttons, on_button, on_input, param_click, published_rows, render_ui, stepped_params |
| `anchor_mode` | 959–973 | 15 | 4 | — | — | doc_lib | — | param_click |
| `remember_error` | 974–976 | 3 | 1 | w | r | — | — | confirm_name, confirm_param, on_button, step_focused |
| `param_click` | 977–992 | 16 | 8 | rw | rw | prefab | — | on_button, on_input |
| `confirm_param` | 995–1009 | 15 | 5 | rw | w | prefab | — | confirm_name |
| `export` | 1012–1021 | 10 | 3 | r | rw | custom | html5, json | on_button |
| `import` | 1022–1026 | 5 | 3 | — | w | custom | html5 | on_button |
| `drop_char` | 1028–1032 | 5 | 0 | — | — | — | — | on_input |
| `track_context` | 1034–1047 | 14 | 2 | rw | r | track_align | — | adjust_track, drop_track, on_button, render_ui |
| `adjust_track` | 1048–1057 | 10 | 3 | rw | rw | track_align | — | confirm_name, on_button, step_focused |
| `drop_track` | 1058–1068 | 11 | 3 | rw | rw | track_align | — | on_button, step_focused |
| `auto_context` | 1069–1074 | 6 | 3 | rw | r | auto_coins | — | auto_value, on_button, preview_auto, render_ui, set_auto, update |
| `auto_value` | 1075–1082 | 8 | 3 | — | r | auto_coins | — | on_button |
| `set_auto` | 1083–1089 | 7 | 4 | — | w | auto_coins | — | confirm_name, on_button, step_focused |
| `preview_auto` | 1090–1101 | 12 | 4 | w | rw | auto_coins | — | on_button |
| `apply_auto` | 1102–1116 | 15 | 4 | rw | rw | track_align, auto_coins | — | on_button |
| `confirm_name` | 1117–1203 | 87 | 11 | rw | rw | edit, zoom_policy, track_align | — | on_button, on_input, step_focused |
| `set_tool` | 1204–1207 | 4 | 2 | rw | rw | — | — | on_button, on_input |
| `usable` | 1211–1211 | 1 | 1 | r | — | editor_ui | — | draw_overlay, ghost_state, publish, render_ui, view_box |
| `grow` | 1213–1213 | 1 | 0 | — | — | — | — | describe, object_box, selection_box, show_problem, start_box |
| `empty_box` | 1214–1214 | 1 | 0 | — | — | — | — | describe, go_last_test, go_start, render_ui, selection_box, show_problem |
| `start_box` | 1215–1215 | 1 | 2 | — | — | doc_lib | — | go_last_test, go_start, render_ui, selection_box, show_problem |
| `object_box` | 1216–1216 | 1 | 2 | — | r | — | — | render_ui, selection_box, show_problem |
| `view_box` | 1220–1237 | 18 | 5 | — | r | — | — | centre_selection, fit_level, go_last_test, go_start, show_problem |
| `fit_level` | 1238–1242 | 5 | 3 | — | rw | doc_lib | — | on_button, on_input |
| `selection_box` | 1244–1257 | 14 | 8 | — | r | doc_lib | — | centre_selection |
| `centre_selection` | 1258–1263 | 6 | 3 | — | w | — | — | on_button, on_input |
| `go_start` | 1264–1267 | 4 | 4 | — | rw | — | — | on_button |
| `go_last_test` | 1268–1274 | 7 | 4 | — | rw | — | — | on_button |
| `current_bounds` | 1276–1281 | 6 | 2 | rw | r | doc_lib | — | describe, draw_overlay |
| `has_selection` | 1283–1287 | 5 | 1 | — | r | — | — | render_ui |
| `problem_rows` | 1289–1295 | 7 | 1 | — | r | — | — | play, render_ui |
| `show_problem` | 1298–1324 | 27 | 8 | w | rw | socket | — | on_button, play |
| `open_help` | 1326–1330 | 5 | 2 | w | w | — | — | on_button, on_input |
| `stepped_params` | 1331–1338 | 8 | 3 | r | — | prefab | — | on_button, step_focused |
| `step_focused` | 1340–1413 | 74 | 14 | rw | rw | prefab, zoom_policy, track_align | — | on_input |
| `on_button` | 1414–1612 | 199 | 52 | rw | rw | doc_lib, edit, prefab, zoom_policy, track_align, terrain_look | os | on_input |
| `vertex_state` | 1613–1619 | 7 | 4 | — | r | edit | — | draw_overlay, offered_buttons |
| `offered_buttons` | 1620–1683 | 64 | 13 | r | r | doc_lib, prefab, terrain_look | — | render_ui |
| `visible_buttons` | 1684–1684 | 1 | 0 | r | — | — | — | hit, publish |
| `hit` | 1685–1694 | 10 | 3 | r | r | editor_ui | gui | on_input |
| `start_move` | 1697–1707 | 11 | 6 | rw | r | doc_lib, edit | — | canvas_press |
| `start_vertex` | 1708–1719 | 12 | 3 | rw | r | edit | — | canvas_press |
| `start_handle` | 1722–1752 | 31 | 5 | rw | rw | doc_lib, edit | — | canvas_move, canvas_press |
| `anchor_key` | 1753–1757 | 5 | 0 | — | — | — | — | canvas_move, canvas_release |
| `curve_drag` | 1760–1791 | 32 | 4 | r | — | doc_lib, snap_lib | — | canvas_move |
| `curve_nearest` | 1793–1812 | 20 | 2 | — | — | — | — | canvas_press |
| `start_points` | 1815–1826 | 12 | 5 | rw | r | edit | — | canvas_press |
| `prefab_end_handle` | 1827–1829 | 3 | 1 | — | — | — | — | canvas_press |
| `canvas_press` | 1830–1964 | 135 | 31 | rw | rw | doc_lib, edit, snap_lib, socket | — | on_input |
| `canvas_move` | 1965–2073 | 109 | 20 | rw | rw | doc_lib, edit, prefab | — | on_input |
| `box_select` | 2074–2096 | 23 | 2 | — | rw | doc_lib | — | canvas_release |
| `canvas_release` | 2097–2157 | 61 | 18 | rw | rw | edit | — | on_input |
| `on_input` | 2158–2399 | 242 | 37 | rw | rw | editor_ui, terrain_look, socket | gui, msg, html5, hash | Defold |
| `one_sided` | 2400–2403 | 4 | 1 | — | — | doc_lib | — | describe |
| `seg_text` | 2404–2407 | 4 | 1 | — | — | snap_lib | — | describe, readout |
| `describe` | 2408–2548 | 141 | 21 | — | r | doc_lib, edit, prefab | — | render_ui |
| `readout` | 2549–2610 | 62 | 8 | r | r | doc_lib, prefab | — | draw_overlay |
| `ghost_state` | 2614–2627 | 14 | 3 | rw | r | doc_lib | — | draw_overlay |
| `draw_overlay` | 2630–2798 | 169 | 27 | rw | r | doc_lib, edit, snap_lib, overlay, editor_ui, socket | gui, window | update |
| `render_ui` | 2801–2974 | 174 | 32 | rw | rw | doc_lib, prefab, editor_ui, zoom_policy, track_align, auto_coins, terrain_look, stations, socket | window, os | update |
| `screen` | 2975–2975 | 1 | 0 | — | — | — | gui | publish |
| `published_handles` | 2977–2983 | 7 | 3 | — | r | — | — | publish |
| `published_rows` | 2984–3000 | 17 | 4 | r | r | prefab | — | publish |
| `view_rects` | 3002–3009 | 8 | 1 | r | — | — | window | publish |
| `published_problems` | 3011–3018 | 8 | 0 | r | — | — | — | publish |
| `publish` | 3019–3058 | 40 | 16 | rw | r | doc_lib, track_align, terrain_look | html5, json | update |
| `update` | 3059–3130 | 72 | 15 | rw | rw | overlay, editor_ui, terrain_look, socket | gui, msg, sys, html5 | Defold |
| `on_message` | 3131–3143 | 13 | 3 | rw | rw | terrain_look | msg, hash | Defold |
