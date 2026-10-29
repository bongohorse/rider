# Wonder Gems (#314)

**Contents:** [Behavior and authoring](#behavior-and-authoring) · [Settlement and compatibility](#settlement-and-compatibility) · [Presentation and resources](#presentation-and-resources) · [Verification and stop](#verification-and-stop)

## Behavior and authoring

Claudio's GO on 2026-10-30 supersedes the former one-special-coin plan. **Wonder Gems** are purple, faceted, larger non-round special coins. Multiple gems may be authored with Gameplay → Gem. The live Gameplay counters show gold and gem placements, including hidden/locked objects. Existing selection, drag, copy/paste, Delete, Undo/Redo, Drop/Along, Save/Reload and Export/Import apply. Copies receive fresh pickup IDs. The existing 128 combined pickup and 256 source-object/resource caps remain; no artificial one-gem limit. Auto Add Coins remains gold-only and preserves gems while counting them towards capacity/spacing.

Attempts count gold and gems separately. Retry restores all pickups, initial sprite poses/scales/tints and transient feedback. First-run adds two provisional optional gems at x60/x120 above the existing gold line; physical course, medal targets and competition identity are unchanged. Their reachability/readability requires Claudio's drive test.

## Settlement and compatibility

The existing fixed-tick sweep collects both kinds once per stable pickup ID. Gem radius .36 m versus gold .25 m matches the larger art. Only valid official finishes bank rewards; failed/abandoned/retried attempts and editor/practice grant no permanent progress. Gold still earns on repeated valid finishes. Each previously unearned gem adds one to a separate permanent gem balance. Identity is shipped course ID plus pickup ID: moving a gem, changing optional art/medals or revising a course retains its claim; deliberately new pickup IDs represent new rewards. Removal does not erase earned balance. No level-selection UI or shop is introduced.

The loader decodes a maximum-128-character finish bitmap against trusted shipped pickup IDs. The existing sender/world-generation/attempt cursor rejects duplicate, stale or reclassified finishes. Bank version 2 extends the same alternating absolute-snapshot store with gem total and per-pickup claims. Gold and gem settlement acknowledge together; queued results and retries cannot apply a delta twice. HUD shows current-attempt gems, previously earned count on this course, and global gem bank. Values update only after storage acknowledgement. Old version-1 gold banks migrate without losing balance; corrupt/unknown alternates stay protected. Claim storage is bounded to 4096 identities; admission failure does not publish credit.

Source editor/compiler 10 explicitly protects `kind="gem"`. Coin-data version 2 / station schema 3 protects compiled gems; ordinary-only compiled levels retain version 1 / schema 2. Source versions 1–9 upgrade through the existing path; older files need no gems. Authored Terrain Look accepts the new source version without changing its format or geometry.

## Presentation and resources

Original Rider art in `tools/art/coins.py` generates transparent SVG/PNG gold coins and purple faceted Wonder Gems. The playful bright palette, rim highlights and upward pickup motion take general platformer inspiration; no external game assets are used. Gems are 1.44 times the ordinary 0.5 m sprite size. Both use the existing atlas/factory and exactly one Sprite/GameObject per pickup, with no body, shape or per-pickup script.

Collected sprites rise .95 m, briefly expand and fade over .48 seconds, then disable. The controller's render update owns presentation only; fixed-tick pickup authority is unchanged. Concurrent effects are bounded by the existing pickup cap and reuse the existing instances. Retry cancels effects and restores the same sprites. Editor GUI pools stay fixed.

Pinned Defold 1.14.0 [sprite API source](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/gamesys/src/gamesys/scripts/script_sprite.cpp) supplies `sprite.play_flipbook` for the existing Sprite component. Existing `go.set_position`, `go.set_scale`, tint and enable/disable patterns are reused. No physics API or tick ownership change.

## Verification and stop

Production checks cover multiple gems, larger swept radius, counters, stable IDs/paste, old/new schema protection, roundtrip and ordinary-only Auto replacement; actual presentation adapter rise/fade/disable/Retry; bank version-1 migration, queued gold/gems, per-course claims, duplicate/practice/failure/retry/reopen. Real-input editor and release evidence is recorded in STATUS.md and the PR as it completes. A build alone is not runtime or device evidence.

Stop at a playable release preview for Claudio's drive test before merge. No subsequent gameplay task is authorized. Physical-device tests are not claimed.
