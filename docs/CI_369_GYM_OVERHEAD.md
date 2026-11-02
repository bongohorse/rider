# CI #369 — bounded Gym setup experiment

Base: `4a4a315fe97d18abcf20bb61ae2fe463eb9b9c8e`. Status: DRAFT; no whole-workflow speedup claimed.

| Successful baseline run | HEAD | Created → required | Sum 27 Gym setup (start → Chromium ready) | Sum Gym queue | Late dependency |
| --- | --- | ---: | ---: | ---: | --- |
| [41351314747](https://github.com/bongohorse/rider/actions/runs/41351314747) | `5f832d98` | 505 s | 945 s | 1812 s | Release verification |
| [41361277348](https://github.com/bongohorse/rider/actions/runs/41361277348) | `6fb6e80b` | 758 s | 959 s | 1433 s | Release verification |
| [41340272255](https://github.com/bongohorse/rider/actions/runs/41340272255) | `a771eb2f` | 739 s | 939 s | 2473 s | Gym merge |

**Not controlled A/B:** these three completed workflows use different source/workflow revisions. Setup and queue are summed parallel job seconds, **not** wall-time savings. A previous #364 release-sharding draft was slower end-to-end (739 s vs 517 s).

Experiment: group only the independent `path/le5c` and `regress/a22` cases, keeping their **unchanged** two smoke commands, report paths, assertions, physics and timeout policies. In the three runs, path case bodies were 32–47 s, regression 45–47 s; their separate runner setup was about 30–39 s each. This grouping eliminates one runner but may lengthen that group's critical path.

The existing merge job now downloads all 26 Gym job artifacts and fails closed on exactly **42 reports** (38 original distinct smoke commands, four additional split parts), unique run IDs, exact source SHA, PASS, split identity and preserved path/regression counts. Existing four part merges, native Linux/Windows and HTML5 checks remain. The new negative tests exercise missing/extra reports, source/part mismatch and reused identities.

Integration: FPS #368's validated `--rates=60` A20 hook is **not yet in main**. When integrating branches, preserve it via normal non-force merge/rebase; do not replace it or claim Android device evidence.

Acceptance: require exact-head full CI, independent QA and at least three comparable complete A/B runs with created→required wall, queue/setup and critical path. If slower/ambiguous, keep draft or revert; never claim an unmeasured improvement.
