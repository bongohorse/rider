# Issue #333 archived planning text

Full body of [#333 [RIDER-STUDIO] Autonomous Director, roles, work queue and merge gates](https://github.com/bongohorse/rider/issues/333) as of 2026-11-02, moved here (unchanged except repo-relative links made absolute) during the issue cleanup ([issue guide](../ISSUES.md#length)). Current scope, binding rules and GOs live in the issue body, its sub-issues and `status:` labels; superseded parts of this text are history.

**Contents:** [MAINTAINER DIRECTIVE — RIDER STUDIO DEPARTMENTS (2026-11-01)](#maintainer-directive--rider-studio-departments-2026-11-01) · [Binding product decision — 2026-11-01: MOBILE LANDSCAPE ONLY](#binding-product-decision--2026-11-01-mobile-landscape-only) · [Mission and limits](#mission-and-limits) · [Roles / ownership](#roles--ownership) · [Studio queue protocol](#studio-queue-protocol) · [Fast validation policy](#fast-validation-policy) · [Current maintainer priorities (GO 2026-11-01; supersedes earlier O2-first ordering)](#current-maintainer-priorities-go-2026-11-01-supersedes-earlier-o2-first-ordering) · [Human gates](#human-gates)

## MAINTAINER DIRECTIVE — RIDER STUDIO DEPARTMENTS (2026-11-01)

**The previous two-PR stop-the-queue instruction is REVOKED by the maintainer.** Resume bounded, high-value work with five durable work areas, not five agents rewriting the same feature. PR #357 merged; PR #355 currently merged with new `main` on its own branch, and the protected-branch CI is pending. Complete #355 safely first without interfering with its five owned files.

| Existing agent slot | Department | Write ownership / first tasks |
|---|---|---|
| Rider Studio Director | Planning, coordination, decisions | Issues/PR queue only; prioritize measurable driving feel, camera, mobile UX, high-refresh FPS and faster CI. No gameplay code. |
| Rider Feature Worker → **Driving & Camera** | Box2D buggy feel, grip/brake/suspension/air control, camera framing | Engine feel/vehicle/camera only; start with current #355 integration gate, then baseline and measured, reversible feel experiments (#114 reference). Never silently replace production A camera or user-approved feel. |
| Rider Tools Worker → **Mobile UI & Controls** | Landscape-only phone HUD and consistent icon language | `main/game/mobile.js`/HTML5 UI ownership. Next #360 in small visual-only PR, then #359 rotate prompt and #361 Simple/Advanced *separate* behavior experiment; user visual/drive signoff for defaults. |
| Rider QA Review → **Performance & CI** | Real measured FPS / rendering cadence and CI speed/quality | #356 first: measured refresh feasibility + fixed 60Hz physics; independent CI infrastructure/test optimization as small source-preserving PRs. No UI/feel file overlaps. |
| Rider Integration Lead → **Independent QA & Release** | Read-only independent PR review, regression gate, green-head squash merge, linked issue bookkeeping | No feature implementation. First finish #355 after CI required check actually succeeds and source review; then inspect other PRs. Never bypass branch protection or invent physical phone results. |

**Product rules:** mobile play **LANDSCAPE ONLY**; playful, cohesive warm or varied color palette (not forced teal), one icon family. FPS Auto may track actual device 90/120/144Hz only where platform proven, but physics always fixed **60Hz**; do not infer screen presentation cadence from JS callbacks. Default car feel is the primary game feature; prefer measurable A/B comparisons. Camera debug B stays opt-in until actual downhill/jump/reverse human feedback. UI target controls are >=44 CSS px, safe-area inset, multitouch, input cancellation, responsive compact HUD. HUD hierarchy is specified in #358/#360; Simple/Advanced only in the Menu (#361); no always-on mode switch. Coin/medal/fuel/progress/tacho all read actual state; no fake counters.

**Scheduling and safety:** exactly one writer for each file/branch; declare ownership in #333 and the issue before editing, no cross-branch squashes/reverts, no work in Codex-owned #281 or editor files. Run cheapest targeted test first, then exact-head required CI, independent QA and physical-phone/human gate where a default-facing visual/handling choice requires it. CI tests must remain meaningful: no disabling, weakening thresholds, invented passes or unnecessary repeated full CI. The five hourly automations are **separate scheduled runs**, not a guarantee of five continuously active coding processes. Each run ends with concise evidence-based German Erledigt / Anders / Als Nächstes; don't post repetitive no-change messages.

**Initial staged queue after #355:** (1) Mobile visual-only #360 (Tools; #358 design); (2) verified FPS prototype #356 (Performance; render 90/120 where possible with 60Hz fixed physics); (3) read-only driving baseline then reversible feel tuning A/B (Driving; coordinate motor cap #114); (4) orientation guard #359 and menu-controlled Simple/Advanced #361 after #360, with real play approval; (5) CI critical path and redundant track-test cost without deleting coverage. Director maintains priority and ownership based on evidence, not FIFO. No new objects or speculative features.

---
## Binding product decision — 2026-11-01: MOBILE LANDSCAPE ONLY

**The maintainer explicitly excludes portrait mobile gameplay/UI.** This overrides any older portrait viewport proposals, acceptance checks or examples below.
- Design, screenshots, actual gameplay and acceptance on **mobile landscape only** (e.g., compact 960×540 / 1080×486 plus representative wide phones). Desktop layout remains supported.
- Portrait is **unsupported**; at most a lightweight **Rotate your device** blocker/fallback (no gameplay HUD, no driving controls, no editable portrait UI). Android APK/package screen-orientation lock must be checked in the correct platform repository before claiming it is enforced.
- Keep landscape left/right orientation, safe-area insets, notch regions, multitouch, tilt sensor normalization and rotation/focus transitions. Do not confuse 0/90/180/270 tilt tests with portrait gameplay support.
- Real input and geometry tests should primarily target landscape; replace obsolete portrait gameplay/layout validations with focused unsupported-orientation guard checks **only after the guard exists**. Do not weaken unrelated collision, physics or desktop tests.
# Rider Autonomous Studio — operating contract

**Marker:** RIDER-STUDIO
**Studio status:** active
**Authorized by maintainer:** 2026-11-01 ("OK Go ... richte einen Agent ein ... Nutze alle vorhandenen Agent Slots ... selbstständig an Rider gearbeitet werden").

## Mission and limits

Operate a small autonomous development/review pipeline for **bongohorse/rider**, preserving the game's established Defold 1.14.0, integrated Box2D 3.1.0, deterministic physics, level-editor source contracts, exact toolchain pins and tested player experience. **Rider Director** is the central coordinator and single authority for assigning *new studio work*, not a second game/runtime authority. Codex remains the intended implementer of the large O2 [#281](https://github.com/bongohorse/rider/issues/281) editor feature. Studio agents must not edit its branch or claim it.

Issue tracker and per-PR comments are the handoff channel for agents; no agent can directly force a Codex/T3 terminal or another ChatGPT instance to act. Scheduled specialists should act on verified GitHub state and write durable decisions there rather than relying on previous chat context.

## Roles / ownership

- **Rider Director / Producer:** prioritize verified blockers, maintain a small pipeline, assign issue roles and ownership, mark readiness, deduplicate tasks, record explicit GO and dependents. **No production code or merges.** Consult architecture and existing design before proposing changes. Read-only analysis and tightly bounded issue edits are permitted.
- **Implementation Worker:** one small, well-scoped, dependency-safe issue per run from the Director's ready queue, excluding current Codex-owned #281 and any high-risk physics/engine/toolchain change. Work on an isolated `agent/<role>/issue-<number>-<slug>` branch, open a **draft PR** and keep source/acceptance evidence. No merges.
- **QA / Code Review:** independent of implementer. Inspect PR diff, tests, evidence, failing CI logs and adjacent regression risk; approve only when entitled, otherwise leave explicit `Rider studio review: passed` or `Rider studio review: changes requested` PR comments. No code edits or merges.
- **Integration / Release:** check exact current head, source diff, completed independent review, `required` check, branch protection and stop point; merge only authorized and fully green PRs via expected head SHA. Close linked issue only after confirmation; don't change failed tests to green.
- **Performance / CI:** inspect reproducible render/Gym budgets, mobile GPU gaps, load times and test cost. Prefer measured read-only findings and bounded experiments; no speculative refactors, timeout increases, skipped tests or claims of physical-device performance.
- **Graphics / Game Design:** research existing approved art and gameplay direction; produce testable small-scoped issues, references and acceptance plans. Do not approve new monetization, major economy, story, gameplay direction or visual redesign without human approval.
- **Security / Dependencies:** read-only risk audit of Defold debug endpoints, WSL/Oracle server, dependency locks and supply chain. Never change firewall, kernels, secrets, network exposure, auto-install scripts or pinned toolchain unilaterally.

## Studio queue protocol

Every studio-managed **implementation** issue must have a section with:
```
RIDER-STUDIO
Studio status: proposed | ready | working | review | changes-requested | review-passed | blocked | needs-human-decision | delivered
Agent role: <implementation | qa | performance | graphics | tools>
Owner: <unique role/branch or unassigned>
GO: autonomous-scoped | explicit-human | pending
```

1. **Proposed -> ready** only if the Director/review agent verifies no duplicate, completed dependencies, small independent acceptance, no conflict with Codex/current PRs, no undocumented decision, and safe GO. Keep at most **six** ready/proposed implementation issues, at most **two** new issue proposals per Director run. Do not turn broad existing epics into automatic GOs.
2. **Claim** only if issue was `ready` on an earlier run. Recheck current `main`, PRs, branches and worktree owners. Write one issue comment with role, branch, scope, current base SHA and planned checks; set `working`. Do not claim a second task until the first is handed off.
3. **Implement** minimal diff and necessary tests on dedicated branch; open draft PR and mark `review`. If implementation cannot be executed using connected capabilities, leave an actionable task for a connected Codex worker; never imply the local Codex/T3 session was started.
4. **Review** against task-specific acceptance, engine locks, regression gates, browser real-input evidence, cross-task interactions and current CI. If blocked, annotate concrete finding; do not rubber-stamp or weaken checks.
5. **Merge** only after required current-head status success and completed independent review. Changes requiring phone/device drive acceptance must stop and request that from the maintainer; no synthetic substitute. No force merges, no branch protection bypass. The repo's normal `main` CI must remain authoritative.
6. **Reporting:** update issues/PRs with verified results and blockers. Short German user updates only on material progress, new PR, confirmed merge, or a decision needed; do not create repeated no-change comments.

## Fast validation policy

Use the cheapest **valid** checks first: issue/PR SHA and diff, isolated lint/unit tests, only affected real-input Gym/station cases, compile/build if runtime changed. Cache verified artifacts when correct. Then one complete immutable-current-head CI for merge. Never rerun full CI for unchanged code just to poll; never skip required checks, alter tolerances, fabricate metrics or treat green checks from old SHA as current. If an unrelated run is still active, inspect status without restarting it. Failed CI -> specific job/log -> minimal justified correction -> new current-head CI.

## Current maintainer priorities (GO 2026-11-01; supersedes earlier O2-first ordering)

**Verified Director checkpoint 2026-11-01, main `b9874eea2650ea7ef733573c2614fd8ef03125d5`.** [#349](https://github.com/bongohorse/rider/issues/349) / [PR #350](https://github.com/bongohorse/rider/pull/350) are **merged/closed** after exact-head independent QA and required CI. The original [workflow 41306245180](https://github.com/bongohorse/rider/actions/runs/41306245180) measured **625.950 s** desktop verification (gameplay/check_run 174.572 s, desktop levels 102.117 s, three slider viewports 189.481 s). The new five-group release verifier preserves desktop layout, seven gameplay modules, phone/touch/stations and fail-closed artifacts. One workflow gate comparison was **~778 s before vs ~612 s after** (~166 s improvement, one sample only; not a guaranteed repeatable benchmark). No test or physics case was removed.

1. **P0: quality, source regressions, lean complete CI.** Tools #349 is delivered and its branch ownership released. Existing [#241](https://github.com/bongohorse/rider/issues/241) flake is not solved by diagnostic PR #338. Keep deterministic real-input, HiDPI, representative terrain/physics and complete current-head `required` gating. Any future Gym fixture consolidation needs an instrumented baseline and equivalent or stronger coverage; no speculative deletions.
2. **P1: measured car feel before retuning.** [#345](https://github.com/bongohorse/rider/issues/345) and [PR #351](https://github.com/bongohorse/rider/pull/351) are **merged/closed** after exact-head independent QA and **49/49 CI checks**; implementation writer/branch is released. Stock A's 60-Hz real-Gym grounded 5 m/s coast/brake measurement is a baseline, **not** an approved car-feel retune or a human drive acceptance. Preserve the single Defold fixed-tick owner and record any future A/B tuning separately.
3. **P1: camera and touch UI — two independent, occupied branches.** Camera [#352](https://github.com/bongohorse/rider/issues/352) is **changes-requested**, exclusively owned by Implementation Worker on `agent/implementation/issue-352-downhill-camera-lead`, draft [PR #355](https://github.com/bongohorse/rider/pull/355), current head `da3ed81a88d94751ccd6c7c288d5d1d855ed31ed`. Independent QA found a real a16 Straight readiness timeout and insufficient downhill fixed-tick coverage at the prior head; the owner pushed a focused fix, but **new-head real Defold a16 artifacts, required CI and re-review remain unverified**. Keep A as default; B opt-in only. Real 1280×720/portrait projection, authored-slope visibility, matched loaded downhill ticks, flat/Retry, jump/reverse and human phone drive remain gates. Short 1 m/s `ramps-long/down-30` may be fixture-limited; never infer a pass from the synthetic 45°/3 m/s estimate. Separate touch [#353](https://github.com/bongohorse/rider/issues/353) is **review**, exclusively owned by Tools/Browser-UI Worker on `agent/tools/issue-353-mobile-hud-targets`, draft [PR #357](https://github.com/bongohorse/rider/pull/357) head `2ca54195f617bdcc286098066bf37753d848f764`. It changes only `main/game/mobile.js` and `tools/gameplay/check_mobile.cjs`, not camera files; source/isolated DOM geometry is **not** game/device proof. Real-input mobile CI, independent QA, exact-head required CI and maintainer visual/Android acceptance gate merge. No second writing branch for either worker; Codex #281 remains exclusive.
4. **P1/P2: FPS feasibility delivered, implementation not approved.** [#340](https://github.com/bongohorse/rider/issues/340) / docs-only [PR #354](https://github.com/bongohorse/rider/pull/354) are **merged/closed** on current main after independent exact-head QA and required CI. Report `docs/ci/fps-feasibility-2026-11-01.md` covers API/platform limits; actual HTML5/Android cadence **NOT RUN** and **no selectable render FPS shipped**. Any runtime FPS preference needs a separate measured GO, must not change the single Defold-owned 60-Hz fixed physics tick or Box2D substeps, and needs device evidence for claims of support.

5. **Deferred/exclusive work and specialists.** Codex owns [#281](https://github.com/bongohorse/rider/issues/281) exclusively; O2 and new objects are deferred *in studio priority*, not cancelled or taken over. [#263](https://github.com/bongohorse/rider/issues/263) physical GPU measurements and [#121](https://github.com/bongohorse/rider/issues/121) rendering/atmosphere remain read-only specialist planning, no invented device FPS or new art direction. [#112](https://github.com/bongohorse/rider/issues/112) security and [#101](https://github.com/bongohorse/rider/issues/101) Node maintenance remain read-only watch.

**Single-writer queue / gates:** Implementation #352 **changes-requested / draft #355**; Tools/Browser-UI #353 **review / draft #357**; Tools #340 and feel #345 **delivered**. **Zero unclaimed ready/proposed implementation issues** in this narrow active queue; do not create another overlapping task while these branches await exact-head evidence. QA re-reviews only the current immutable head; Integration alone merges after required CI and all human stops. Specialists may do short read-only #263 mobile GPU evidence planning or #121 approved-style research while CI runs, without claiming measured phone performance or approving art. No new gameplay objects, production edits, direct main writes or merges by Director. STATUS.md task-specific GO amendment, if necessary, must be included in a reviewed PR.

## Human gates

Need human decision for changed core feel/game economics, art direction, monetization, legal/branding, server changes, hardware tests and external spending; when absent, continue independent safer work. Default to minimal-risk reversible work. All scheduled tasks can be paused by the user. A task's execution is not proof of concurrent independently running Codex sessions.
