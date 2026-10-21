# Editor A2 runtime captures

Actual pinned Defold 1.14.0 HTML5 / Chromium 156.0.8078.4 captures for [#172](https://github.com/bongohorse/rider/issues/172), from runtime source `8d5bc06a3e8a815fd501e0827a4d79d72fea6129`. The subsequent test/gallery/status commit does not change runtime source. Desktop mouse/keyboard input is synthetic; these captures do not establish human or device acceptance.

| Capture | What it establishes |
| --- | --- |
| [Named, hidden and locked ramp, 1280×720](objects-named-locked-1280x720.png) | Object names/type/id and eye/padlock states in the compact list |
| [Same list, 1920×1080](objects-named-locked-1920x1080.png) | Constant control size at the larger review viewport |
| [Hidden ramp and label](objects-hidden-ramp-label.png) | Both disappear from Edit rendering while remaining listed; the normal export checks preserve their compiled geometry/text |
| [Seven parameters plus Prefabs and Objects](objects-seven-fields-1920x1080.png) | All seven fields, seven prefab cards and four object rows visible together; 121/128 active boxes, 75/128 active texts |
| [256-object list at 1280×480](objects-1280x480.png) | Outer scrollbar reveals the final object row; the independent object scrollbar reaches rows 253–256 |
| [Release: hidden and locked line](release-objects-hidden-locked.png) | Same controls and rendering in release; normal export confirms retained source/terrain after refused deletion |

`ea2` passed all seven named cases: selection/search/naming, hide/Undo/export, direct and connected locks (including drag and locked label/name fields), copy/Mirror defaults, save/reload/import/drive, bounded list/viewports and invalid metadata handling. It also tests both scrollbar drags, object-list wheel scrolling, delete/Undo and the seven-field combination. The retained `le6` passed all 14 cases, including DPR 2 and the 800-segment fixture: 628/640 allocated GUI nodes, Edit/Play/replay 804/806/810 sprites of 1024. No cap is raised.

Local debug evidence: `artifacts/172-objects-complete/objects-result.json` and `artifacts/172-le6-reviewed/polish-result.json`. Local release evidence: `artifacts/172-release-check/result.json`; this check exercises direct icon controls, refused locked deletion, export, unlock/show and Edit→Play→Edit at both desktop review sizes, with no debug inspection globals or observed runtime errors. Earlier interrupted/failed attempts are not counted as passes. CI and public delivery evidence belong in [PR #258](https://github.com/bongohorse/rider/pull/258).

For reproduction, build a fresh debug bundle with `python tools/gym/bundle.py --output artifacts/a2-bundle`, then run `python tools/gym/smoke.py --bundle artifacts/a2-bundle --output artifacts/a2 --case ea2` and the retained `--case le6` separately. The release build uses `python tools/project.py build --target html5 --configuration release --fixture gym --output artifacts/a2-release`.
