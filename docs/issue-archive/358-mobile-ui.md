# Issue #358 archived planning text

Full body of [#358 [RIDER-STUDIO][UI P1] Modern, consistent mobile-first UI and coherent icons](https://github.com/bongohorse/rider/issues/358) as of 2026-11-02, moved here (unchanged except repo-relative links made absolute) during the issue cleanup ([issue guide](../ISSUES.md#length)). Current scope, binding rules and GOs live in the issue body, its sub-issues and STATUS.md; superseded parts of this text are history.

**Contents:** [Binding maintainer HUD specification — 2026-11-01 (supersedes earlier proposals)](#binding-maintainer-hud-specification--2026-11-01-supersedes-earlier-proposals) · [Binding product decision — 2026-11-01: MOBILE LANDSCAPE ONLY](#binding-product-decision--2026-11-01-mobile-landscape-only) · [Maintainer feedback — 2026-11-01](#maintainer-feedback--2026-11-01) · [Outcome](#outcome) · [Phase 0 — audit and visual proposal (before broad changes)](#phase-0--audit-and-visual-proposal-before-broad-changes) · [Bounded implementation after approval](#bounded-implementation-after-approval) · [Acceptance](#acceptance) · [Rider studio](#rider-studio)

## Binding maintainer HUD specification — 2026-11-01 (supersedes earlier proposals)

User reviewed the landscape concept and chose a **slightly playful**, colorful direction. **Do NOT keep turquoise/green as the default primary color.** Prefer a restrained warm orange/amber/gold or warm-neutral vehicle-inspired palette, with sparing secondary accents. The generated concept image is *visual inspiration only*, not proof of implementation or an asset for distribution. Keep HUD readable, lightweight, and **not prominent over gameplay**.

### Accepted layout and semantics (mobile LANDSCAPE only)
1. **Top right:** a **tiny FPS number only**, colored by sustained actual performance (red <30, amber when well below target, green near target); hide verbose 'FPS Auto 120Hz' settings from gameplay. Separate requested FPS, reported callback FPS and true presented FPS if measurable under #356. Small coin icon + current collected coin count nearby (not a large banner).
2. **Top center:** a thin level progress line. Left endpoint = START icon; right = checkered FINISH flag. **Small car-shaped marker** moves on the line with backward motion when applicable. **Single percent label centered** over/within the bar, not offset. Do not invent progress for unsupported non-linear levels; preserve existing fallback/hint semantics.
3. **Left edge:** slim **vertical fuel gauge** with a fuel-pump icon and clear low-fuel/warning state, with safe-area inset and visible height. Keep accurate fuel state, pickups and reset.
4. **Top-left/near progress:** compact race **time** and exactly **one current medal status**, not three target times simultaneously. During a run, show the currently *achievable* Gold/Silver/Bronze tier according to elapsed time and level targets; if none remains, indicate none unobtrusively. At finish, display only the **medal actually awarded**, not a predicted award. Preserve official vs practice distinction and existing best-time/medal save logic; no new scoring.
5. **Top actions:** **icon-only** Pause/Resume, Retry, Menu. Semantic aria-label / accessibility text remains mandatory. Use consistent icon stroke/weights and >=44×44 CSS-px touch rectangles (aim ~48 where layout permits); no text labels always visible. Additional actions and **control-mode switch** live inside Menu, **never as a permanent on-screen toggle**.
6. **Bottom center:** compact **round automotive speedometer** with dial/ticks/needle and km/h, fed from actual current chassis velocity (m/s × 3.6). Dial range should reflect real Rider vehicle speed (Box2D wheel cap exists) rather than showing an impressive fictional 140 km/h. Decorative gauge only: not a physics control or input/clock.
7. **Bottom controls:** default **Simple** has **only left Brake/Reverse and right Throttle/Gas**, and those same buttons also control pitch/lean (verify signed mapping in real engine; throttle = nose-up/back and brake = nose-down/forward in air unless tests show engine sign reversed). **Advanced** retains *independent* lean-left/lean-right plus gas/brake, like existing controls. Switch via Menu → Controls → Simple/Advanced. Keep multi-touch, pointercancel, background/pause/Retry/reset, tilt calibration semantics, keyboard and safe-area. Avoid fighting with optional tilt; make explicit mode arbitration and preserve 60-Hz tick owner. This is input behavior change, **separate from visual-only PR** with its own deterministic and human drive acceptance.

### Icon library / assets
- Prefer **Phosphor Icons** (MIT; cohesive `bold` and selectively `duotone` weights) for a slightly playful feel: https://github.com/phosphor-icons/core/blob/main/README.md . The catalog exports named SVGs as static assets. Alternative Lucide (ISC): https://lucide.dev/license . **Pick only one family**, vendor/compile a minimal pinned subset into project assets with required license notices, no CDN or runtime npm dependency in Defold HTML5 release. Defold GUI may require atlas/raster equivalent. Use existing toy-buggy art or a lightweight original car progress marker rather than generic truck emoji. Do not copy third-party game artwork.

### Priority, acceptance and release sequencing
- First **unblock and QA #353 / draft PR #357**; do not add HUD redesign to that occupied branch.
- Slice A (small new PR after #357 writer releases mobile.js): **visual-only HUD hierarchy**: fps number, coins, fuel vertical, progress center + marker/endpoints, only one medal-time indicator, round dial, icon-only top actions, one icon family. Keep existing output data/engine clocks. Screenshot comparisons at 960×540, 1080×486, notched landscape; include render/GPU budgets where measurable.
- Slice B (separate new PR, user-authorized behavior experiment): menu-controlled **Simple vs Advanced** modes and input coupling; specify sign and grounded/airborne behavior from engine tests, persist choice in a versioned player settings key without altering progression data, test simultaneous presses, reverse, mid-air landing, tilt and pause. **Never retune vehicle physics solely to accommodate the UI.** Human driving acceptance mandatory before default behavior changes.
- Slice C: extend same tokens/icons to level selection, results, settings; editor only with Codex #281 coordination. Maintain keyboard/desktop support.
- Do not show all three medal targets at once or make labels large. UI is informative, subordinate to game art. Portrait = unsupported / rotate-device prompt only (#359).
- No portrait gameplay tests. Save/test baseline vs new UI visual changes, all real-input tests and unchanged 60-Hz Defold physics/replays. Initial concept acceptance is **directional**; maintainer visual/phone approval required before production-facing merge.

## Binding product decision — 2026-11-01: MOBILE LANDSCAPE ONLY

**The maintainer explicitly excludes portrait mobile gameplay/UI.** This overrides any older portrait viewport proposals, acceptance checks or examples below.
- Design, screenshots, actual gameplay and acceptance on **mobile landscape only** (e.g., compact 960×540 / 1080×486 plus representative wide phones). Desktop layout remains supported.
- Portrait is **unsupported**; at most a lightweight **Rotate your device** blocker/fallback (no gameplay HUD, no driving controls, no editable portrait UI). Android APK/package screen-orientation lock must be checked in the correct platform repository before claiming it is enforced.
- Keep landscape left/right orientation, safe-area insets, notch regions, multitouch, tilt sensor normalization and rotation/focus transitions. Do not confuse 0/90/180/270 tilt tests with portrait gameplay support.
- Real input and geometry tests should primarily target landscape; replace obsolete portrait gameplay/layout validations with focused unsupported-orientation guard checks **only after the guard exists**. Do not weaken unrelated collision, physics or desktop tests.
## Maintainer feedback — 2026-11-01
The Rider UI is inconsistent, cluttered and dated; maintainer wants **simple, modern, consistent, mobile-first** design and better **coherent icons**. No flashy redesign. This is broader than the already-in-progress touch-target/readout geometry fix #353 / draft PR #357.

## Outcome
Define **one lightweight design system** and apply it progressively across driving HUD, toolbar, menus, settings, level select, results and editor. Prioritize legibility, recognizable controls and visual consistency over effects. Do not add new gameplay objects.

## Phase 0 — audit and visual proposal (before broad changes)
1. Inventory all existing UI surfaces and differing icons/buttons/spacing. Capture screenshots from real current build at representative **mobile landscape** and desktop viewports with exact source/build identity.
2. Propose a restrained shared style: font sizes/weights, spacing, color and contrast, button heights, corner radius, clear primary/secondary actions, and **one coherent icon family** with labels for ambiguous controls. Prefer existing licensed assets when appropriate; avoid heavy UI dependencies.
3. Produce small side-by-side visual references/mockups and get maintainer aesthetic approval before rolling the style across screens. Keep proposals short and show changes, not just documentation.

## Bounded implementation after approval
- Coordinate with #353 / PR #357; do not edit that owner's branch. Preserve >=44x44 CSS-px touch targets, safe-area support and unobstructed accelerate/brake.
- Slice 1: driving HUD and mobile primary/secondary toolbar; a coherent layout in supported landscape orientations.
- Slice 2: settings, level selection, result and menus use the same shared visual tokens and icon rules.
- Slice 3: editor toolbars/properties only after coordination with Codex-owned #281. Avoid competing owners and giant PRs.
- Keep recognizable semantic icons, label unusual actions, consistent selected/disabled/pressed states, touch and keyboard affordances.

## Acceptance
- [ ] Before/after screenshots of actual player at compact/wide mobile landscape and desktop; maintainer visual approval.
- [ ] Clear shared visual language; no mismatched icons, mixed radius/font/button scales without purpose.
- [ ] Real tap / keyboard testing preserves all current controls; touch sizes and no overlap with driving zones, safe areas, readout or results.
- [ ] Readability and contrast good at mobile sizes; no unnecessary visual effects or performance-heavy overlays.
- [ ] Physics stays fixed 60 Hz; no changes to camera default, gameplay economics, save schemas or test tolerances.
- [ ] Each bounded code PR independent QA + exact-head required CI, with physical-device UX marked NOT RUN until tested.

## Rider studio
RIDER-STUDIO
Studio status: proposed — Phase 0 visual audit/planning only until design acceptance and #353 writers are released.
Agent role: graphics (audit/design), then tools/implementation by independent small PR.
Owner: unassigned
GO: autonomous-scoped for read-only audit and visual design proposal; **human visual acceptance** before broad production redesign.
Priority: P1 after active HUD correctness #353; before any new objects.
