# G3 acceptance — entry preparation, Android baseline pending

G2 was merged in [PR #9](https://github.com/bongohorse/rider/pull/9) as eaefa19eff6a9f536df30379a4f6923030775b6a. Final source 10ed9c8fd56cd8d5cfd436ed1d4366ab85053270 passed required CI [38705035452](https://github.com/bongohorse/rider/actions/runs/38705035452), physics [38705035422](https://github.com/bongohorse/rider/actions/runs/38705035422), Android/negative build [38705035437](https://github.com/bongohorse/rider/actions/runs/38705035437), and Bridge/debug/release/doctor [38705035408](https://github.com/bongohorse/rider/actions/runs/38705035408). Post-merge main CI [38705580152](https://github.com/bongohorse/rider/actions/runs/38705580152) is green.

**G3 entry status: BLOCKED — the required physical device/OS/Chrome baseline is missing.** Device test execution remains NOT RUN. The user supplies device identity and manual observations; the agent records the tested commit, steps, logs and limitations.

The authorized loop has started G3 entry preflight. The [platform matrix](PLATFORM_MATRIX.md) distinguishes actual evidence from missing physical Android identities. The [binding platform policy](plan/platforms.md) requires concrete device/OS/browser values before G3. This is missing external information, not a renewed repo/merge permission request. No G3 implementation or platform waiver is claimed.

After the baseline is established, keep implementation small: two scenarios (free-body/floor and one-wheel spring/motor), English scenario/reset/pause controls, bounded camera controls, explicit sessions/generations and serialized proxy cleanup. Reuse validated new repo resources; no full vehicle or inspector. Single step/slow motion require the real lifecycle proof or explicit DEFERRED status.

| ID | Required observation | Status |
|---|---|---|
| scenario_start | Both scenarios reach confirmed READY | NOT RUN |
| switch_reset | Repeated A→B→A/reset restore canonical state | NOT RUN |
| state_isolation | Settings/input/listeners/references do not leak | NOT RUN |
| pause | Measured physics/input stop and resume | NOT RUN |
| browser_ui | Start, resize, visibility, controls and clean console | NOT RUN |
| android_install | APK installed/launched on identified real device | NOT RUN |
| android_touch | Actual press/release behavior | NOT RUN |
| android_lifecycle | Pause/resume, rotation and Back, with logs | NOT RUN |
| android_chrome | Physical Chrome HTML5 start and touch smoke | NOT RUN |
| performance_baseline | Short frame-time sample, load/method/debug state/limits | NOT RUN |

Next needed: device model, Android version and Chrome version. Start implementation after that entry baseline or an explicit change to that platform-entry requirement. Do not fabricate device results or skip to G4a/G5.
