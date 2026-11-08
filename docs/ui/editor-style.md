# Editor UI style

Tokens, components and rules for the rebuilt level editor ([#659](https://github.com/bongohorse/rider/issues/659)). Claudio accepted the mobile-gaming layout and its clickable prototype on 2026-11-08 ([#699](https://github.com/bongohorse/rider/issues/699), `tools/ui_prototype/editor/`); the editor chrome is HTML over the canvas ([level-editor contract](../contracts/level-editor.md#editor-chrome-technology-682)). The kit lives in `main/editor/web/ui_kit.js` and is loaded by `main/editor/editor_ui_kit.lua`; debug builds open the component sheet with `?uikit=1`.

**Contents:** [Layout](#layout) · [Tokens](#tokens) · [Components](#components) · [Rules](#rules) · [Fonts](#fonts)

## Layout

- Floating top tool bar: select, line, curve, terrain brush, pan · undo, redo · icon-only Play.
- Top left: level chip with save state, counters for coins, gems and fuel. Top right: versions, save, share, help.
- Left: collapsible library. Icon tab rail (gameplay, track parts, decor, background, texture, objects) and a pane with search, world tiles, icon categories, favourites and an asset grid.
- Right: collapsible inspector. Rail with the selection, level, track look and test drive; pane with icon tabs per selection type.
- Bottom centre: minimap with the visible window and view controls (fit, start, grid, zoom, minimap).
- Docks are only as tall as their content and scroll inside at the screen limit.

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| `--ink` | `#0d0f13` | Outlines and button depth |
| `--panel` / `--panel2` / `--btn` / `--field` / `--line` | `#22252c` / `#2c3039` / `#393e4a` / `#181a20` / `#4a505e` | Neutral graphite surfaces |
| `--text` / `--muted` | `#f6f3ee` / `#a4a9b6` | Text |
| `--accent` / `--go` / `--danger` / `--info` | `#ffd23f` / `#4fe08a` / `#ff4f7b` / `#4cc9ff` | Active tool, Play, delete, hints |
| Area colours | gameplay `#ff7b54`, track `#4cc9ff`, decor `#6fd36b`, background `#b48cff`, texture `#ffb03f`, objects `#ff6fae` | Tab icons, panel headers, active states of that area |
| Fonts | Baloo 2 700–800 (headings, buttons), Nunito 800–900 (labels, numbers with tabular figures) | |
| Sizes | buttons 44 px (rails 46, segmented 50, play 50×64); compact layout 38 px | Targets stay ≥ 38 px on phones |
| Spacing / radius | 4 · 6 · 8 · 10 px gaps; 12 px controls, 18 px docks | |

## Components

Button (default, on, area colour, badge, disabled, danger, wide, primary), Play/Stop, segmented control with icons, slider with icon and value, search field with clear, tab rail with collapse, dock header, category button, chip, toast. All helpers escape text and render ARIA state (`aria-pressed`, `aria-checked`).

## Rules

- One icon family (24 px grid, 2.2 px round stroke); an icon replaces text wherever it explains the action, with the name as tooltip and accessible label.
- Every button has depth (dark bottom edge) and sinks when active. Active uses the area colour; the active tool uses the accent.
- One colour per area, applied consistently: tab icon, panel header, selected tile, sliders of that panel.
- All styles are scoped under `.rider-ui`; the kit never restyles the game page.
- The kit only renders and reports clicks. Lua owns the level document and Undo.

## Fonts

`main/editor/web/fonts/` holds the latin subsets of Baloo 2 and Nunito (SIL Open Font License 1.1, licences beside them), downloaded 2026-11-08 unchanged from the Google Fonts css2 API: `fonts.gstatic.com/s/baloo2/v23/wXKrE3kTposypRyd51jcAA.woff2` (sha256 `26fb4610…dfe59c1`) and `fonts.gstatic.com/s/nunito/v32/XRXV3I6Li01BKofINeaB.woff2` (sha256 `ba344451…cac793`); licence texts from `github.com/google/fonts` `ofl/baloo2` and `ofl/nunito`. HTML5 custom resources are not served as files, so `tools/ui/build_ui_fonts.py` embeds them as data URIs in `main/editor/web/ui_fonts.js`; `--check` fails when the file is stale.
