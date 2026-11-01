# Project tooling

Setup, build, test and CI operations. Versions: [TOOLCHAIN_LOCK.md](TOOLCHAIN_LOCK.md) and [toolchain-lock.json](../tools/toolchain-lock.json). Test/result rules: [automation contract](contracts/automation.md).

**Contents:** [Prerequisites](#prerequisites) · [Commands](#commands) · [Gym tests](#gym-tests) · [Local environment (WSL, VS Code)](#local-environment-wsl-vs-code) · [Worktrees](#worktrees) · [CI and required check](#ci-and-required-check) · [Agent CI completion watch](#agent-ci-completion-watch) · [Dependencies and Renovate](#dependencies-and-renovate) · [Preview deployment](#preview-deployment) · [Gemini read-only reviewer setup](#gemini-read-only-reviewer-setup)

## Prerequisites

Eclipse Temurin 25.0.4.1+1 on PATH, Python >=3.12 (CI 3.14.8) with `requirements-dev.txt`, Git. HTML5 runtime tests additionally need `npm ci --ignore-scripts` and `npx playwright install --with-deps chromium`. Builds enforce the exact JDK build and Bob SHA-256. `python tools/local_parity.py` records local versions against the CI pins (`--require-ci-parity` fails on deviation).

## Commands

Run from the repository root. Bash and PowerShell (`./tools/*.ps1`) wrappers call the same Python implementation:

```sh
bash tools/doctor.sh --json                      # environment inventory; --require-g2 checks JDK/Bob/wrapper
bash tools/verify.sh --suite bootstrap --output artifacts/g2/bootstrap
bash tools/verify.sh --suite physics --target desktop --output artifacts/g2/physics
bash tools/verify.sh --suite physics --target html5 --output artifacts/g2/html5
bash tools/build.sh --target desktop --configuration debug --fixture gym
bash tools/build.sh --target html5 --configuration release
bash tools/build.sh --target android --configuration debug
python tools/g2/negative_build.py --output artifacts/g2/negative-build
```

- Every Bob build ends with an engine guard: each bundled engine (both HTML5 Wasm variants, each Android ABI, native executables) must be byte-identical to this build's fresh extender result in `build/<arch>/`, must not be a stock engine from the verified Bob, and needs a non-empty extender log; HTML5 also needs one `Using extender binary` line per variant. The evidence is `engines.json` next to `build.log`. Before Bob runs, cached extender results in `.internal/cache` that are not a readable zip with an engine and a non-empty `log.txt` are removed (an unreadable index or unknown layout clears the whole cache); after a guard failure the platform's `.internal/cache/<arch>` and `build/<arch>` are removed. Each removal is logged as `RIDER CACHE INVALIDATED` in `build.log` and in `engines.json` ([#209](https://github.com/bongohorse/rider/issues/209)).
- `build` defaults to the gym; `--fixture physics` selects the G1 boot, `--fixture bridge` the native automation fixture ([bridge](contracts/bridge.md)). A build does not prove runtime, installation or game readiness.
- `verify --suite physics` runs the G1 runner on two configurations plus the scale/render comparison. On HTML5 each configuration's bundle runs twice: cross-origin isolated (COOP/COEP, the pthread engine) and as GitHub Pages serves it to players (no COOP/COEP, `wasm-web`), with the same assertions including Box2D v3. Each run records the engine it loaded in `engine-load.json` and fails if it is not the expected one; the players cases are reported as `<config>.wasm-web.<case>`. `verify --suite bridge` runs the native Bridge suite under Xvfb.
- Every invocation writes `results.json` (schema 1), `junit.xml` and logs to `artifacts/g2/<uuid>/` by default. Exit 0 PASS, 1 FAIL, 2 BLOCKED (never green).
- `negative_build.py` injects a Lua error into a temporary copy, requires the named build error, restores the bytes and rebuilds; the working tree stays unchanged. The Android job also verifies the APK with `apksigner`/`aapt2` (not a device install).

Baseline checks for any change: `python tools/bootstrap_check.py`, `python -m unittest discover -s tests/bootstrap -v`, plus affected `tests/g1`, `tests/g2`, `tests/ci` (Python and `node --test tests/ci/*.cjs`) and `node --test tests/mobile/*.cjs`.

## Gym tests

```sh
python tools/gym/bundle.py --output artifacts/gym-bundle                     # build the debug gym once
python tools/gym/smoke.py --bundle artifacts/gym-bundle --output artifacts/gym/a15 --case a15
```

**LE6 CI partition (#329):** The 23 real-input Editor/Gameplay authoring cases are run as two isolated Playwright processes, each using the same verified shared debug Gym bundle. `polish-1` covers navigation, selection, Editor A UI and medals (16 cases); `polish-2` starts from a fresh built-in course and covers zoom, coins, Drop/Along/Auto, gems and fuel (7 cases). Each uses `--case le6 --part 1/2` or `--part 2/2`. The existing `gym-reports` job merges `--case le6 --merge <part1> <part2>` only after verifying exact case names/order, unique run IDs, identical source SHA and browser identity, and non-overlapping measurements; missing or failed reports are blocking. Local `--case le6` still runs all 23 in sequence for debugging. No assertion, human-input gesture, or 360-second process deadline is relaxed.

Cases include `a1`–`a3`, `a6`–`a12`, `a15`–`a22`, `a19b`, `a19c`, `a19d`, `a15a`, `le1a`, `le1b`, `le2`, `le3`, `le4`, `le5a`, `le5b`, `le5c`, `le5d`, `le6`, `ea2`, `ea3`, `cf3`, `coast`, `hud`, `m2feedback` and `a9invalid`; the full list is in `.github/workflows/g1.yml`. Without `--bundle` a case builds its own bundle. Reuse requires matching source/platform/debug identity and an unchanged SHA-256 inventory. Each case gets a fresh browser and its own `rider.run_id`/`rider.gym_test` via engine startup arguments injected only by the local test server. Release preview tests live in `tools/preview/` (`verify.cjs`, `mobile.cjs`, `tilt.cjs` and per-station runners). Behavior notes per station and feature: [gym notes](../main/gym/README.md). The local test server's index.html fetch for each Gym page load (`tools/gym/launch.cjs`) retries only a connection reset (ECONNRESET before any response; the runners' static servers close idle keep-alive sockets after Node's default 5 s + 1 s) up to three times, logging each retry with its URL; any other failure aborts the page load inside the runner ([#221](https://github.com/bongohorse/rider/issues/221)).

**Regression traces (A22, [#37](https://github.com/bongohorse/rider/issues/37)):** `a22` replays the stored preset A traces in `tests/regress/` against frozen tolerances. Only for an intended tuning or physics change, regenerate them deliberately with `python tools/gym/smoke.py --bundle <debug-bundle> --output <dir> --case a22 --record` (records, rewrites `tests/regress/`, prints old → new outcomes, then checks the new files). The PR names the intended change and pastes that table, and the reviewer confirms every changed outcome; tolerances in `tools/gym/regress_spec.cjs` never change in the same PR ([gym notes](../main/gym/README.md#regression-traces-a22)).

**Preset comparison (Car Feel 2, [#200](https://github.com/bongohorse/rider/issues/200)):** the station cases `a16` ramps, `a17` steps, `a18` seams, `a19` gaps, `a19b` bumps, `a19c` air and `a19d` balance take `--preset <key>` (full runs only, not `--part`). Without it nothing changes: preset A, no URL parameter, the same assertions, and CI `required` runs only the default. With it every station URL gets `&preset=<key>`, and each measured trial must report that preset in telemetry and in the station report, unmodified and comparable. Ramps reports have no `comparable` flag, so there the trial must be unmodified and time-comparable. A seams free-roll `comparable` is a measurement (the speed window), so seams trials require only the time factor and the table shows the flag. An unknown key falls back to A in the game, so it fails this check. The seams powered controls check preset A's motor limit, so they stay on preset A and are flagged `preset: 'a'` (`powered_controls_preset`). Station assertions that hold only for preset A still apply and can stop a candidate run; the tables then show that run as FAIL.

`presets_compare.cjs` runs the selected stations (default: all supported) for the baseline and each candidate on one bundle. It writes `presets-compare.json` and `presets-compare.md`: baseline | candidate | delta per metric, plus the tuning differences the station reports measured with. A failed run does not stop the others: its cells read FAIL, the tables are still written, and the tool exits non-zero. Each result must carry one preset check per measured trial. A candidate equal to the baseline is a repeat check: statuses must match and every declared repeat tolerance must hold, otherwise the tool fails. Keys are arguments, so new presets need no tool change. A new station is one `STATIONS` entry there plus one `PRESET_CASES` entry in `smoke.py`. `--tables-only` rebuilds the tables from an existing output. The tool runs locally only and is not part of `required`. Allow about 20 minutes per preset for all stations (measured locally, one runner at a time).

```sh
PYTHON=.venv/bin/python node tools/gym/presets_compare.cjs --bundle artifacts/gym-bundle --output artifacts/presets --candidates a,b   # A vs A and A vs B
python tools/gym/smoke.py --bundle artifacts/gym-bundle --output artifacts/gym/a17-c --case a17 --preset c                          # one station, one preset
```

Gym, G1 HTML5 and release-preview CI install the lockfile-pinned Chromium binaries, then `node tools/ci/setup_playwright.cjs <evidence-directory>` validates both Chromium variants and their host libraries before using the runner as provisioned. The helper removes Playwright’s transferable `DEPENDENCIES_VALIDATED` cache markers so a browser cache hit cannot stand in for this host’s library check. Only a missing-library diagnostic triggers `playwright install-deps chromium`, followed by another mandatory probe; other failures remain failures. Each job uploads setup timings, image/cache identity and command logs with its usual evidence. Manual CI/G1 dispatch accepts `cold_browser_cache=true` to validate one isolated struts runner with an empty temporary browser cache and deliberately removed `libxcomposite1`. The helper must reinstall the missing library, pass both browser probes, and record the fallback before all normal tests continue; the other groups keep their normal cache and installed libraries. Gym uses headless Chromium and the game’s own fonts; additional CJK/X11 font packs are not required by these English, canvas-based protocols. Debug Gym, HTML5 physics and release-preview builds, runners, identities and artifacts remain separate. See [Playwright browser dependencies](https://playwright.dev/docs/browsers#install-system-dependencies).

Remove `build/` and `.internal/` before a debug bundle if the checkout produced release builds: a stale release engine once replaced the debug gym.

## Local environment (WSL, VS Code)

The prepared T3 Code workflow, local Extender provisioning, fast/focused commands and activation/rollback checklist are in [LOCAL_T3_SETUP.md](LOCAL_T3_SETUP.md). Host activation is separate from repository preparation. `python tools/local.py check` runs fast checks; `python tools/local.py gym --case le6` uses an explicit loopback Extender and only reuses a source-verified debug bundle. Existing commands opt into loopback builds with `RIDER_BUILD_SERVER=http://127.0.0.1:9000`; absent that override, CI/legacy commands retain the locked public server. No CI coverage or merge gate is changed.

The existing editor remains available: development runs in WSL2 Ubuntu (`~/rider`) with Windows VS Code and the **Rider** profile ([`profiles/Rider.code-profile`](../profiles/Rider.code-profile), [`.vscode/settings.json`](../.vscode/settings.json): dark petrol window chrome, built-in AI chat disabled). AI CLIs (Codex, Claude) run in WSL terminals; no editor extensions are required.

1. Install VS Code and its WSL extension (`ms-vscode-remote.remote-wsl`) on Windows. Import `profiles/Rider.code-profile` via **Profiles: Import Profile...** before using `--profile Rider` (an unknown name silently creates an empty profile).
2. In WSL: `cd ~/rider && code --new-window --profile Rider .`. The optional `tools/open-rider.ps1` launcher (`-Distro <name>`) lives inside the Linux checkout.
3. Never commit or print credentials, tokens or API keys.

Native debug builds need the CI-documented OpenAL/Mesa packages; Bob builds need `build.defold.com` reachable, and the first Bob fetch needs `d.defold.com` (network failures are BLOCKED, not a reason to switch toolchains).

## Worktrees

A worktree separates source trees, not credentials (`~/.config/gh`, `~/.codex`, `~/.claude`). It does not inherit ignored `.venv/`, `node_modules/`, `.cache/g1/bob.jar`, `automation-bridge-python/` or `artifacts/`; reuse the main checkout's `.venv` or set `RIDER_BOB_JAR` to a verified Bob. One writing agent per worktree and feature branch.

```sh
git -C ~/rider worktree add -b <branch> ~/rider-worktrees/<name> origin/main
git -C ~/rider worktree remove ~/rider-worktrees/<name>   # after merge
```

## CI and required check

- `required` (in `ci.yml`) is the only required status check on `main`. It aggregates bootstrap, Renovate, physics (native + HTML5), tooling/Android, Bridge and release preview, and fails on any failed, cancelled or unexpectedly skipped dependency. Never bypass it or use whole-workflow `paths-ignore`; keep the force-push/deletion protections on `main`.
- PR jobs test GitHub's merge commit; preview manifests identify that SHA.
- **Fast path:** `tools/ci/classify_changes.py` classifies the diff. Non-bundled Markdown and plain `.txt` under `docs/` are docs-only: workflow lint, CI regression tests and Markdown link/anchor checks run, without rebuilding the game. Text files elsewhere, JSON/CSV/YAML fixtures, scripts, configuration and anything in `game.project` `custom_resources` retain full selection. Changes limited to `main/gym/` plus the same non-runtime documentation skip the Windows native entry, Bridge and negative build. Unknown diffs and manual dispatch fail closed to the full suite. The PR summary records the selection reason.
- **Parallel browser suites:** build the debug Gym once per run, then run its cases in independent jobs: seams and sizes in two parts each, ramps, steps, gaps, air, struts, editor, draw, library, prefab, curve, path and controls. A part keeps whole measurement units (a seam speed pair, a custom level) on one runner; `Merge Gym part reports` checks that the parts share source, browser and machine identity, cover every case exactly once, and writes the same `seams-result.json`, `sizes-result.json` and `sizes-report.md` as a single run (`smoke.py --part` / `--merge`). Build/package the release once, then verify desktop, phone emulation, touch/tilt and stations in four independent jobs. Transfer artifacts are attempt-scoped, so after a failure use **Re-run all jobs**; re-running only failed jobs cannot find the earlier attempt's bundle or parts. All existing regression cases run before `required`; a failed matrix member fails the reusable workflow. SHA/run/attempt-scoped artifacts are transferred only within that run, never used as a build cache.
- **Nightly:** 02:17 UTC full suite; a failing `required` opens or updates one tooling issue, recovery closes it.
- Caches: pip by requirements, npm and Playwright by lockfile, Bob by lock with SHA-256 check, actionlint from a verified archive. Compiled game output is never reused across runs. CI artifacts are kept 14 days; commit summaries and run links, not binary dumps.

## Agent CI completion watch

Watch your own PR instead of asking the maintainer whether CI finished:

```bash
gh pr checks <PR> --repo bongohorse/rider --watch --fail-fast --interval 10
gh pr view <PR> --repo bongohorse/rider --json headRefOid,mergeStateStatus
gh pr checks <PR> --repo bongohorse/rider --required
```

A failed/cancelled run, missing checks, a changed head, `BEHIND`/blocked merge state or missing current-head `required` PASS means no merge. On failure read the job logs, fix within scope and watch the new head. When green, merge only with existing authorization and stop at PLAN.md stop points. The watch only resumes a running terminal command; it does not notify a paused chat.

## Dependencies and Renovate

Keep exact pins; Renovate never automerges and keeps major/runner/engine updates separate ([dashboard #4](https://github.com/bongohorse/rider/issues/4)). `npm run renovate:validate` checks the config, `npm run renovate:scan` runs local extraction. New dependencies need purpose, version/commit, source, license, update/removal path and platform evidence; no floating URLs. Version changes follow [TOOLCHAIN_LOCK.md](TOOLCHAIN_LOCK.md).

## Preview deployment

The `preview` job builds an HTML5 release of the tested SHA (native Bridge cleared) into `builds/<sha>/<run-id>-<attempt>/` and verifies desktop and 20:9 phone viewports. Only `main`, after `required` passes, deploys to GitHub Pages; docs-only merges keep the existing build. The root loader reads `build.json` (no-store) and redirects to the current build; [build.json](https://bongohorse.github.io/rider/build.json) identifies the deployed SHA. After deployment, `verify.cjs ... deployment` checks loader redirection, exact SHA/build ID, continuing controller telemetry and runtime errors on desktop and phone emulation. The full regression inventory already ran against the same packaged release before deployment; the live check no longer repeats it. `verify.cjs` without a mode still runs the full inventory. Do not claim a deployed build before observing it.

Artifact transfer uses [actions/download-artifact v8.0.2](https://github.com/actions/download-artifact/tree/9000827ccba6bdab643e8b6fd33ac0654aef8333) (GitHub, MIT, Node 24), pinned by SHA. Renovate tracks updates; removing parallel consumers removes this dependency. Platform evidence belongs in the implementation PR (Ubuntu CI artifact upload/download plus full regression result).

## Gemini read-only reviewer setup

Gemini / Antigravity may only review or suggest ideas. A prompt rule cannot protect files or credentials from a process running as the same OS user, so Gemini runs in a separate identity:

- unprivileged account `rider-gemini` (no sudo/Docker, own home and Google login, no GitHub token);
- root-owned, read-only, tracked-files-only snapshot at `/opt/rider-gemini-review/<SHA>`;
- [deny rules](../tools/security/gemini-readonly-settings.json) for writes, commands, MCP and URL execution, plus reads of `/home/mega/` and `/mnt/`; terminal sandbox enabled.

Setup on the maintainer host (inspect the sudo-using script first; rerun after updating `main`):

```bash
cd ~/rider && git pull --ff-only && git status --short --branch
less tools/security/setup_gemini_reviewer.sh
bash tools/security/setup_gemini_reviewer.sh
sudo -iu rider-gemini          # install the official CLI here, sign in to Google only
cd /opt/rider-gemini-review/<SHA> && agy
```

The script refuses dirty state, symlinks, privileged reviewer groups, unsafe settings and reviewer write/credential access, and migrates existing settings without dropping unrelated keys. Verify after a session: a write request inside Gemini is DENIED, then `sudo -u rider-gemini test ! -w /opt/rider-gemini-review/<SHA>/AGENTS.md` and `sudo -u rider-gemini test ! -r "$HOME/.config/gh/hosts.yml"`. Never run `sudo agy` or Rider reviews with the maintainer's own `agy`; never paste tokens or login codes into logs.
