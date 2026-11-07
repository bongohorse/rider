# Editor UI style proposal (#674)

Inventory of the editor UI on main 83adcb6 and two style directions for one consistent look (epic [#659](https://github.com/bongohorse/rider/issues/659)). Claudio chooses the direction on #659; the following token task turns the choice into shared values and replaces this proposal with the chosen tokens. Mockups with current screenshots are on the proposal page linked from the pull request that added this file.

**Contents:** [Inventory](#inventory) · [Shared rules](#shared-rules) · [Direction A: Workbench](#direction-a-workbench) · [Direction B: Toybox](#direction-b-toybox) · [Recommendation](#recommendation)

## Inventory

Two UI technologies are in use. Defold GUI draws the top bar, the tool rail, Properties, the bottom bar and the Versions dialog ([`editor.gui_script`](../../main/editor/editor.gui_script), [`editor_ui.lua`](../../main/editor/editor_ui.lua)). HTML panels draw Texture/Background, Decor and their controls ([`track_panel.js`](../../main/game/track_panel.js), [`background_panel.js`](../../main/game/background_panel.js), [`decoration_panel.js`](../../main/game/decoration_panel.js)).

| Area | Today | Problem |
| --- | --- | --- |
| Type | Monospace in Defold GUI; system sans in HTML panels | Two faces; cramped labels ("Start FinishCoin Fuel") |
| Controls | Flat teal Defold buttons; in HTML styled preset tiles but browser-default tabs, action buttons, number fields, checkboxes, selects and ranges | Two control families on one screen |
| Panel placement | Texture, Background, Decor and 3D all open at the right edge over Properties, with different widths (340–700 px), heights and borders; Versions is a centred modal | Panels stack over each other with no shared frame |
| Icons | Line icons for tools; letters "v", ">" and "<" for collapse; "Close", "Close [Esc]" or nothing for close | No single icon set for actions |
| States | Active is filled teal, a light border or white text depending on the panel | Selection is hard to read at a glance |
| Colour | Turquoise and green throughout | Claudio rejected green/turquoise as the automatic primary UI colour on 2026-11-01 ([#358](https://github.com/bongohorse/rider/issues/358)) |

## Shared rules

Both directions use the same structure, so only the skin differs:

- One font for UI text and one monospace face for numbers and units; both under the SIL Open Font License, bundled for Defold and the HTML panels.
- One stroke icon family (1.75 px line, round caps, 16/18 px) for every tool, collapse, close and action button.
- Spacing steps 4 · 6 · 8 · 12 · 16 px. Targets 34 px on desktop, 44 px on touch.
- Every tool panel (Texture, Background, Decor, 3D, Properties) becomes one right inspector with the same width, frame, header and close icon instead of panels stacked over Properties; Versions stays the only modal.
- Control set: icon button, text button, primary button, danger button, segmented control, switch, slider with number field, number field with unit, chip, collapsible section, toast. No browser-default control remains.
- One state language: hover = raised surface; active/selected = accent tint with accent border; primary action = filled accent; destructive = danger outline.

## Direction A: Workbench

Warm graphite surfaces, one amber accent, IBM Plex Sans with IBM Plex Mono. Calm and dense.

| Token | Value |
| --- | --- |
| canvas / surface / raised / field | `#141210` / `#1d1a16` / `#26221d` / `#171512` |
| line / text / muted | `#3a342c` / `#ece4d6` / `#9d927f` |
| accent / on accent | `#f2a93b` / `#1b1408` |
| info / warn / danger | `#7fb5e6` / `#e8c25a` / `#e8735d` |
| UI text | IBM Plex Sans 13/14 px, 500/600; section labels 11 px caps, +0.09em |
| Radius | 5 px controls, 6 px panels |

## Direction B: Toybox

Plum night surfaces, sunny yellow accent, rounded Nunito. Playful and close to the game's own look; less dense.

| Token | Value |
| --- | --- |
| canvas / surface / raised / field | `#1c1626` / `#271f35` / `#332943` / `#211a2d` |
| line / text / muted | `#463a58` / `#fbf1e4` / `#b6a7c4` |
| accent / on accent | `#ffc93c` / `#2a1c05` |
| info / warn / danger | `#7ad7f0` / `#ff9f59` / `#ff6f6f` |
| UI text | Nunito 13/14 px, 700/800; section labels 12 px, 800, sentence case; numbers IBM Plex Mono |
| Radius | 10 px controls, 14 px panels, pill primary buttons |

## Recommendation

Direction A for the editor: it stays readable in dense panels and does not compete with colourful level art on the canvas. Spacing, sizes, icons and the warm accent are shared, so the final driving HUD ([#360](https://github.com/bongohorse/rider/issues/360)) can take B's rounded font and pills as its playful skin, and the development HUD ([#678](https://github.com/bongohorse/rider/issues/678)) uses the chosen editor tokens.
