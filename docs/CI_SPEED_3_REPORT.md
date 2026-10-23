# CI Speed 3: P1 evidence

**Contents:** [Scope and implementation](#scope-and-implementation) · [Measurements](#measurements) · [Failures and verification](#failures-and-verification) · [Decisions and limits](#decisions-and-limits)

## Scope and implementation

Issue [#264](https://github.com/bongohorse/rider/issues/264) authorized P1 first. [PR #267](https://github.com/bongohorse/rider/pull/267) / #266 validates the runner's actual Chromium dependencies before requesting system installation. Both pinned Chromium variants must launch, render WebGL, activate audio through a real click and capture a screenshot. Transferred host-validation markers are removed; missing-library diagnostics require installation and another successful probe. Other failures propagate. Gym, G1 HTML5 and separate release verification share this setup; case selection, grouping, required aggregation and toolchain pins remain unchanged.

The separately reproduced pre-change EA3 regression required [PR #268](https://github.com/bongohorse/rider/pull/268) / #265. Exact filesystem metadata, mutation-invalidated format protection, fresh save-pair reuse and write-turn sync batching remove redundant reads and persistence work. Retirement acknowledges both index slots before deleting files and acknowledges deletion before completion. Already-deleted IDs remain as idempotent recovery metadata until the next index mutation. Capacity reserves the exact retained registry and preserves minimal oldest-first pruning. New-source publication keeps separate acknowledgements. All original assertions, real UI input, intentional timing and 30 s request / 600 s suite limits remain.

## Measurements

Durations are seconds. Source SHA is the actual checkout, including the tested PR merge when applicable. Initial queue is run creation to run start; the Gym tail is shared-build completion to the last Gym completion, not a sum of parallel jobs. Required excludes subsequent deployment.

| Cohort / run (all PASS) | Tested SHA | Initial queue | Setup median / range | Build | Gym tail | Creation→required |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Before [39700293066](https://github.com/bongohorse/rider/actions/runs/39700293066) | `0a6a24a` | 0 | 11 / 9–23 | 40 | 298 | 373 |
| Before [39773491658](https://github.com/bongohorse/rider/actions/runs/39773491658) | `1ce499e` | 0 | 13 / 8–568 | 64 | 885 | 995 |
| Before [39775657076](https://github.com/bongohorse/rider/actions/runs/39775657076) | `471ef42` | 1146 | 16.5 / 9–461 | 41 | 608 | 1846 |
| After [39991521439](https://github.com/bongohorse/rider/actions/runs/39991521439) | `23e3d78` | 0 | 2 / 1–7 | 83 | 413 | 527 |
| After [39991511025](https://github.com/bongohorse/rider/actions/runs/39991511025) | `01d52d1` | 0 | 3 / 1–8 | 88 | 503 | 628 |
| After [40002046342](https://github.com/bongohorse/rider/actions/runs/40002046342) | `daa16c0` | 0 | 2 / 1–4 | 54 | 293 | 385 |

The three-before / three-after cohort retains the same 26 groups, 40 selected workflow steps and 37 unique top-level cases. After runs cover PR, manual full CI and main; their final gameplay/test trees are identical. Median of per-run setup medians falls from 13 to 2 s (84.6%); observed ranges are 8–568 s before and 1–8 s after. All 78 normal after Gym setups pass.

The collector retains every group, test-step inventory, raw job metadata/logs, image/cache provenance and separate setup/test/artifact/dependency timings. Reproduce with `python tools/ci/benchmark_gym.py --runs <run IDs above> --output artifacts/ci-speed/recheck` using read-only GitHub access. Dependency-ready delay includes scheduler/orchestration; it is not an exact per-job queue-entry measurement. Artifact durations overlap setup where bundle download is included.

The historical runs include Ubuntu images `20261012.163.1`, `20261018.168.1` and `20261021.171.10`; the accepted after runs use `20261012.163.1`. Playwright remains 1.64.1, with Node 24.21.0 and the pinned Defold/JDK. Browser-cache hits do not establish host-library availability: every after job independently probes the host.

A controlled cold fixture in [39962236751](https://github.com/bongohorse/rider/actions/runs/39962236751) skipped the cache, used an empty browser directory and actually removed `libxcomposite1` from its ephemeral runner. Browser download took 9.594 s; the initial probe failed on that missing library in 0.358 s; system fallback took 499.129 s; re-probing both variants passed in 1.467 s. The normal struts case then passed. This deliberate fault run is excluded from normal warm timings, and its unrelated EA3 failure is not presented as a full-run pass.

## Failures and verification

The original nightly [39918515125](https://github.com/bongohorse/rider/actions/runs/39918515125) already failed EA3 with the old installer. Intermediate storage candidates passed some runs but repeated EA3 reached 600 s, including [39973922903](https://github.com/bongohorse/rider/actions/runs/39973922903). Those passes did not establish reliability and were superseded. The final candidate defers redundant durable registry clearing and adds reload-recovery/capacity checks. A prior package transfer consumed 14m11s and exhausted a regression job's budget. A mistaken failed-job-only retry lacked attempt-scoped artifacts; the required complete retry passed. Superseded/cancelled/partial runs are never counted as passes.

Local verification: pinned debug builds; EA3 all seven cases on the final candidate and le4 all twelve on the preceding deferred-registry build passed. Baseline and 55 bootstrap, 31 Python CI, 79 Node CI/mobile tests and actionlint passed. le1a twenty and le2 nineteen cases passed on the preceding save-pair candidate. New EA3 checks cover both format-cache invalidation directions, byte preservation when the second retirement slot fails, deletion after reload, and independent disk accounting before and after recovery allocation. Full CI checks every existing Gym case, negative physics perturbation and release/mobile-emulation suite. Independent credential-free, text-only static reviews of supplied source and transaction deltas found no blockers; reviewers did not run tests or access GitHub.

## Decisions and limits

- **P2 deferred:** remaining Gym scheduling and long suites justify a separate balanced-group experiment; no rebalance has been measured or authorized.
- **P3 deferred:** dependency-aware selection and report completeness need separate positive/negative proof. No required physics coverage moved to nightly.
- **P4 generic runner refactoring deferred:** intentional waits and input semantics remain. The measured product-storage work was handled in #265 instead of a broad test framework change.

Different source SHAs, additional storage regressions and simultaneous workflows prevent attributing the entire wall-time change to browser setup. The approximately 2–3 minute target remains unproven. Browser emulation does not establish real touch, app switching or device storage behavior. Stop after P1 evidence/review as #264 requires; further phases need a new GO. Main run [40002046342](https://github.com/bongohorse/rider/actions/runs/40002046342) passed required, deployment and public verification. A direct no-cache read of [build.json](https://bongohorse.github.io/rider/build.json) returned source `daa16c0bd31be747e3c62788211624039c22a2f9`, build `40002046342-1`. EA3 passed the final PR/manual/main runs in 94 / 103 / 80 s. Later documentation-only merges keep that deployed release.
