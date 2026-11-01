# Gym CI critical path and fixture coverage — 2026-11-01

**Contents:** [Evidence and comparability](#evidence-and-comparability) · [Timing and critical path](#timing-and-critical-path) · [Six-group regression map](#six-group-regression-map) · [Safe follow-up candidates](#safe-follow-up-candidates) · [Preservation and verification](#preservation-and-verification)

Issue: [#336](https://github.com/bongohorse/rider/issues/336). **Read-only analysis**: no tests, thresholds, fixtures, CI configuration or engine code changed. All times are **observed GitHub Actions durations**, not hypothetical performance gains or device FPS.

## Evidence and comparability

Two completed, successful **full** `CI` workflows on `main`, 2026-11-01 (UTC):

| Run | Exact source SHA | Event | `required` |
| --- | --- | --- | --- |
| [41292377572](https://github.com/bongohorse/rider/actions/runs/41292377572) | `07fdca441d935c38e5571c3d28596bb7e161ac1c` | schedule, 09:16:06 | PASS, 09:26:43 |
| [41299556879](https://github.com/bongohorse/rider/actions/runs/41299556879) | `73e7b238a1f644b1e1080f52e912611e3c1dd421` | push, 10:55:09 | PASS, 11:08:57 |

The [exact commit comparison](https://github.com/bongohorse/rider/compare/07fdca441d935c38e5571c3d28596bb7e161ac1c...73e7b238a1f644b1e1080f52e912611e3c1dd421) changes only `docs/README.md`, `docs/feel/buggy-baseline.md`, `tests/g1/test_comparison.py` and `tools/g1/run.py`. **No Gym driver, station geometry or workflow changed** between these two SHAs. Both runs have 48 jobs and the same 27 `physics / Gym (...)` matrix entries. Runner contention, load and startup timing can still vary; this is a two-run comparison, not a statistical benchmark.

Timing source: GitHub Actions job `started_at/completed_at` and each successful step's `started_at/completed_at` from the run jobs API (`?per_page=100`; the default first page of 30 omits most Gym jobs). Rounded to whole seconds. A step's duration includes browser startup, page navigations, world loads, simulation, assertions and file writes within that step; those **cannot be separately measured from these step summaries**. `npm ci`, setup and artifact transfers are separate steps. Some cases additionally emit finer checkpoints, noted below.

## Timing and critical path

Ranked by the **mean of the two Gym job wall times**, not by summing parallel runner minutes. Columns are seconds, ordered as older run / newer run:

| Rank / group | Job wall 07fd / 73e7 | Test-step time 07fd / 73e7 | Measured setup-step sum 07fd / 73e7 | Primary test |
| --- | ---: | ---: | ---: | --- |
| 1. `balance` | 221 / 237 | 186 / 190 | 28 / 38 | A19d skill, replay, seesaw reset |
| 2. `bumps-2` | 226 / 224 | 183 / 183 | 34 / 34 | A19b crest lift-off sweep |
| 3. `polish-2` | 217 / 223 | 171 / 180 | 39 / 35 | LE6 seven UI authoring modules |
| 4. `bumps-1` | 235 / 202 | 166 / 166 | 60 / 31 | A19b editor geometry, ladders and retry |
| 5. `editor` | 187 / 189 | 150 / 148 | 31 / 34 | A15, LE1a and LE2 |
| 6. `seams-1` | 179 / 177 | 130 / 131 | 41 / 37 | A18 5/7 m/s chain/hull |

The setup sum includes matching checkout, Python/Node setup, `npm ci`, Chromium cache/install and shared-bundle download steps; it is **not** the entire difference between wall and test time. Artifact uploads for these jobs were 1–2 s each. The six jobs consumed 1,265 / 1,252 **summed runner seconds**, but run concurrently, so these sums are **not elapsed workflow time**.

The actual `required` wall-clock gates were **637 s** (09:16:06→09:26:43) and **828 s** (10:55:09→11:08:57), from workflow creation to `required` completion. This does not include post-gate deployment/notification completion. The `physics / Build shared debug Gym` job took **69 / 69 s**, the final `physics / Merge Gym part reports` job **22 / 21 s**, ending at **09:24:09 / 11:03:03**. The Gym matrix therefore was **not the final gate** in either run.

The **observed workflow gate bottleneck** was instead `preview / Release (desktop)`: **546 / 634 s** wall, finishing **09:26:34 / 11:08:48** just before `required`. Its single `Verify release loader and gym on desktop and phone viewport` step, implemented by `tools/preview/verify.cjs`, took **516 / 590 s**. It exercises multiple release/UI/level/gameplay checks beyond Gym. Shortening a Gym group alone cannot be claimed to shorten these two `required` paths. The `required` job also depends on bootstrap, renovate, tooling and bridge checks, which must remain intact.

CI dependency/inventory: `.github/workflows/ci.yml` calls `g1.yml` via `physics`, while `preview` runs independently after change classification. All Gym jobs require the one `gym-build` artifact and run `tools/gym/smoke.py --bundle ...`. `gym-reports` merges A18, LE1b, A19b and LE6 split reports; `tools/gym/seam_report.cjs`, `bump_report.cjs`, and the LE6 inventory in `smoke.py` enforce part identity and exact case coverage. Do not drop the merge gate or replace real UI input with direct state injection.

## Six-group regression map

| Group | Driver, fixture/source | Distinct assertions and protected regressions | Apparent overlap / why not delete |
| --- | --- | --- | --- |
| `balance` | `tools/gym/balance.cjs`, `balance_geometry.cjs`, `main/gym/stations/balance.json`; seven beam/ramp/seesaw sections | Skill trace and replay match, full-throttle misses, repeatable plank tip/settle, mid-tip Retry recreates joint and body counts, 60-tick history-independent plank reset (**#217**), section switch and touch navigation | Multiple attempts are **not duplicate tests**: different pre-reset awake/asleep and angular-velocity histories intentionally expose Box2D sleep-timer bugs. Keep all seven geometries and histories until an equivalent reproducer is proven. |
| `bumps-2` | `tools/gym/bumps.cjs`, `bump_report.cjs`, `bumps_geometry.cjs`, `main/gym/stations/bumps.json` | Ten speeds 2.5–7 m/s and up to three bisections per crest; four different crest wavelengths, per-crest lift state/apex speed and at least one bracketed lift-off | Same course as `bumps-1` but **different velocity sweep**, not duplicated coverage. The 73e7 log reports `crest-3` `monotonic:false` and `crest-8` no lift-off in the sampled range; these are **observations, not automatically a test failure**. Do not discard speeds or assert monotonicity without physics analysis. |
| `polish-2` | `tools/gym/polish.cjs` plus `tools/gameplay/check_{zoom,coin,drop,along,auto,gem,fuel}_editor.cjs`; an independent editable `straight` document | Exact zoom/viewport and source invariance; coin stable IDs; Drop to Track; shared along-track arcs; deterministic auto-coin placement; gems/medals; fuel persistence, retry and real UI actions. `smoke.py` requires all seven exact case IDs | Similar editor commands appear elsewhere, but these verify **different schema, persistence and authoring features**. Source has per-module `RIDER_LE6_CHECKPOINT` instrumentation. Newer log: along-track **37.629 s**, auto-coins **36.016 s**, fuel **28.289 s**, zoom **25.668 s**; the seven modules together take about 178 s. |
| `bumps-1` | `tools/gym/bumps.cjs`, `bumps_station.cjs`, `bumps-source.json` and generated `bumps.json` | Fresh editor compilation equals committed geometry; 800-object budget; URL and in-world R; five long and five short wave heights at default/7 m/s; per-wheel contact-loss share, compression, pitch, repeat and Retry tolerances | Its geometry validation, ladder and retry are distinct from the `bumps-2` threshold sweep. `bump_report.cjs` explicitly merges four cases from part 1 and one from part 2. |
| `editor` | `tools/gym/smoke.py` dispatches `stations.cjs` (A15), `custom.cjs` (LE1a), `editor.cjs` (LE2), all against the shared Gym | Station start/switch/invalid data; custom import/persistence/recovery; actual mouse/keyboard Edit/Play, START/FINISH, Undo/Redo, test starts, bounds, reload and source identity | Three **separate protocols in one job**, not duplicate assertions. Newer step times 8 + 55 + 85 s; source-level fixed waits exist in `editor.cjs`, some intentionally protect input release or whole-second save timestamps. |
| `seams-1` | `tools/gym/seams.cjs`, `seam_analysis.cjs`, `seam_report.cjs`, `main/gym/stations/seams-{chain,hull}.json` | 20 seams per chain/hull run, 5 and 7 m/s, first run and Retry; speed window ±5%, 60-Hz step, wheel spin cap, per-seam contact/vertical/longitudinal spikes and repeat tolerances | `seams-2` covers 9 m/s plus powered controls, not the same speed pairs. Part merge recomputes D8 chain-vs-hull verdict; shorter strips risk losing all 20 seam samples and stable speed windows. |

**Fixture conclusion:** No assertion-equivalent, safely removable Gym track or whole test group was demonstrated in these six. The apparent repeats are mainly controlled velocity, geometry, reset-history and UI-state variants. Redesigning tracks before preserving their input/output invariants would weaken regression evidence.

## Safe follow-up candidates

These are **proposals, not measured speedups**. Implement only via separate, scoped, independently reviewed PRs, using before/after exact-SHA runs and unchanged inventories.

1. **P0 — instrument the actual critical path first** (`tools/preview/verify.cjs`, its directly called `tools/preview/*.cjs` and `tools/gameplay/check_*.cjs`). Add per-subcase elapsed checkpoints to the 516/590-s release-verification step, then replace *only proven unnecessary* polling/repeated initialization with equivalent state-driven waits. Preserve every desktop/phone-viewport, release-loader, persistence and real-input check. Expected effect: **unknown until subcase profiling**; this is the only candidate here directly on both observed `required` paths.
2. **P1 — reduce verified LE6 part-2 UI waiting, not case count** (`tools/gym/polish.cjs` and specifically `tools/gameplay/check_along_editor.cjs`, `check_auto_editor.cjs`). Start with the existing 37.629/36.016-s checkpoints. Profile page load, save/reload, pointer interactions and waits; substitute explicit revision/saved-state predicates where they are equivalent. **Keep** any delay required to distinguish whole-second save timestamps and all seven `LE6_EXPECTED['2/2']` IDs. Expected effect: unknown; measure test-step time on unchanged fixtures.
3. **P2 — targeted LE2 input-wait audit** (`tools/gym/editor.cjs` and only its helper calls). The 85/86-s LE2 step uses fixed 60/90/150-ms waits and some longer finish/save waits. Identify waits that can be replaced by actual tick/revision/finish acknowledgments; keep frame-edge key-release semantics, 1.1-s timestamp disambiguation and the existing 19-case inventory. Expected effect: modest/unknown; a shortened test must fail the same deliberate negative controls.

**Not recommended now:** merging the two Bumps jobs, shortening the A18 20-seam strips, deleting balance retries or lowering timeouts. Bumps sweep has a non-monotonic observed crest; the balance histories exercise a specific fixed regression. `npm ci`/Chromium setup is shared in design but executes independently per matrix runner; runner-minute reduction is not automatically workflow critical-path reduction.

## Preservation and verification

For any follow-up: (1) record original SHA, exact fixture source/geometry, case IDs, per-test results and job-step timings; (2) change one isolated runner or instrumentation point; (3) run cheapest relevant static/unit checks and affected **real-input** browser tests, with original and candidate geometry/trace identities; (4) verify unchanged part inventories, source SHA, thresholds, retry/sleep behavior and fail-closed negative cases; (5) compare at least two comparable full current-head runs **only when CI is naturally required**, without starting extra full workflows for curiosity; (6) require independent QA and current-head `required` PASS before merge. Do not claim Android FPS or hardware acceptance from these CI measurements.

No local Python, Node, Playwright, Defold or physical-device tests were executed for this documentation-only analysis. Data came from the two existing successful GitHub workflow runs, their job/step metadata, the newer LE6/Bumps log checkpoints and repository sources. No full workflow was triggered by this report.
