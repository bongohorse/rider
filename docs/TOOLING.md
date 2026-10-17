# Project tooling

[Documentation index](README.md) · [G2 state](history/G2_ACCEPTANCE.md)

Use the repository root. Bash and PowerShell wrappers forward to the same Python implementation:

```sh
bash tools/doctor.sh --json
bash tools/verify.sh --suite bootstrap --output artifacts/g2/bootstrap
bash tools/verify.sh --suite physics --target desktop --output artifacts/g2/physics
bash tools/verify.sh --suite physics --target html5 --output artifacts/g2/html5
bash tools/build.sh --target desktop --configuration debug --fixture gym
bash tools/build.sh --target html5 --configuration release
bash tools/build.sh --target android --configuration debug
```

Windows equivalents: `./tools/doctor.ps1`, `./tools/verify.ps1`, `./tools/build.ps1` with the same arguments. The default doctor remains an explicit environment inventory; use `--require-g2` for exact JDK/Bob and read-only wrapper-source verification. `--require-g1` requires JDK/Bob presence and never claims a Bridge connection or runtime approval. Builds additionally enforce the exact approved JDK build and Bob hash. Set PATH to Eclipse Temurin 25.0.4.1+1; Python >=3.12, Git and installed bootstrap requirements are needed. HTML5 runtime verification additionally needs `npm ci --ignore-scripts` and `npx playwright install --with-deps chromium`.

`verify --suite physics` delegates to the existing G1 runner, then requires the two complete physics inventories and their scale/render comparison. It does not create another simulation loop. `verify --suite bootstrap` requires the project contract and actual nonzero bootstrap/protocol test counts. `build` defaults to the gym. Use `--fixture physics` for the retained G1 boot or `--fixture bridge` for native automation. `build` produces debug/release bundles, with source/run identity settings; it does not assert successful runtime, installation or game readiness.

Every invocation writes `results.json` (schema 1) and `junit.xml` alongside logs. Default output is `artifacts/g2/<uuid>/`. Exit 0=PASS, 1=FAIL, 2=BLOCKED. BLOCKED is a failing CI result, never green. Missing or duplicate expected IDs and zero inventory fail. JSON contains exact Git source, test IDs, status, measurements where available and relative artifact paths. Per-case physics timing is `null` (not measured); the overall runner duration is measured. `assertions: 1` counts the collector verdict for each reported case, not the number of internal Lua predicates. Timeouts kill process trees; incomplete physics cases are represented as failures. JSON/JUnit PASS is tooling evidence, not whole-G2 approval.

A real build regression is separate:

```sh
python tools/g2/negative_build.py --output artifacts/g2/negative-build
```

It copies the current project into a temporary directory, injects an invalid Lua statement, requires a build error naming that script, restores the exact original bytes, builds the restored copy successfully, and verifies the original working tree is unchanged. The broken copy is never committed. CI uploads both logs and the restoration report. Its Linux APK job also builds through the shared CLI, verifies the signature with Android `apksigner`, and parses the package with `aapt2`; these checks do not claim an actual device installation. The four CLI unit tests separately cover nonzero subprocess exits, zero-test rejection, timeout and incomplete inventory.

G1 baseline: native headless physics and HTML5 debug. G2 extends Windows to the normal debug engine with CI software OpenGL and proves Linux native Bridge graphics/input plus release-negative behavior. Android APK build success does not prove installation or real device/touch behavior. No editor launch or local port/session is assumed by these commands.

Native Bridge verification uses the same result CLI: `verify --suite bridge` under Linux graphics/Xvfb. Install the pinned wrapper with `python tools/setup_bridge.py`; use `build --target desktop --configuration debug --fixture bridge` for the interactive native fixture. See [BRIDGE.md](contracts/automation/bridge.md) for explicit commands and verified debug/release behavior. HTML5 does not load the native extension.

Gym runtime smoke: `python tools/gym/smoke.py --output artifacts/gym/a1 --case a1`. It checks chain support and camera following in HTML5; CI retains its screenshot and logs.

## CI build reuse

All PR jobs check out GitHub's synthetic merge commit (the default checkout ref), so `required` covers the integration source consistently. Preview manifests identify that tested merge SHA. The parent CI owns cancellation; reusable G1/G2/Bridge calls use run-specific concurrency groups, while standalone manual runs have separate branch-scoped groups.

`python tools/gym/bundle.py --output artifacts/gym-bundle` builds the debug Gym once. Run each case with `python tools/gym/smoke.py --bundle artifacts/gym-bundle --output artifacts/gym/a15 --case a15`. Reuse requires matching source/platform/debug identity and an unchanged SHA-256 file inventory. Each case opens a fresh browser and receives its own `rider.run_id` and `rider.gym_test` through Defold's engine startup arguments, injected only in the local test server response. The archived bundle and production template are unchanged. Standalone smoke commands still build their own bundle when `--bundle` is omitted. All existing case assertions and screenshots remain separate.

CI builds Android debug once through the G2 shared CLI and requires APK signature/manifest inspection. The historical G1 Android-attempt script remains available for diagnosis; CI no longer repeats that equivalent build. Native, physics-fixture, Bridge debug/release and release-preview builds retain their distinct coverage.

The npm download cache follows `package-lock.json`; Bob's cache follows the toolchain lock and its SHA-256 is checked on every use. Compiled game output is never restored from a cross-run cache. Workflow classification also runs actionlint 1.7.12 from a SHA-256-verified archive (`tools/ci/actionlint-lock.json`); optional shellcheck/pyflakes integrations are disabled for consistent syntax/expression validation.

## VS Code Rider profile (WSL, CLI agents)

The repository contains [`profiles/Rider.code-profile`](../profiles/Rider.code-profile) (importable VS Code profile) and [`.vscode/settings.json`](../.vscode/settings.json) (Rider-specific yellow window chrome and no built-in Copilot/Chat panel). These are configuration templates, not evidence that a user profile was installed on the Windows machine. Codex CLI and Claude Code CLI run in the WSL terminal; no agent extensions are required.

1. In **Windows PowerShell**, use `wsl.exe --list --online` to see installable distros and **`wsl.exe --list --verbose`** to identify the *installed* distro and require WSL **VERSION 2**. `Ubuntu-26.04` is a proposed name, not an observed local install.
2. Install VS Code on Windows and its **WSL** extension (`ms-vscode-remote.remote-wsl`). In Windows VS Code import `profiles/Rider.code-profile` with **Profiles: Import Profile...** and confirm **Rider** exists in **Profiles: Switch Profile**. Import **before** using `--profile Rider`: an unknown name otherwise silently creates an empty profile. Extensions installed locally are not automatically synchronized into WSL.
3. In the **actual installed** WSL distro, clone the repository at `~/rider` (or update the clone) and open `cd ~/rider && code --new-window --profile Rider .`. Check that the window is attached to WSL, the correct profile persists after reopening, and the yellow title/status bar and hidden AI chat behave as requested.
4. The optional `tools/open-rider.ps1` launcher defaults to `Ubuntu-26.04`, supports `-Distro <installed-name>`, and assumes `~/rider`. It resides **inside the Linux checkout**, so an arbitrary Windows PowerShell session cannot run it by a simple relative path; use the WSL command in step 3 until a Windows-side launcher path is set up and tested. The script does not install tooling.
5. VS Code remembers the selected profile for the opened folder. Switch via **Profiles: Switch Profile** or **File > New Window with Profile**; workspace chat disabling affects Rider, not Goblin/MGD. Use standalone `codex` and `claude` commands in separate integrated WSL terminals only after installation/authentication; never commit credentials or API keys. For precise host acceptance and preview parity see [migration review §7](VSCODE_MIGRATION_REVIEW.md#7-minimum-local-acceptance-gates-all-currently-not-run-on-users-wsl-rider-instance).

VS Code's WSL extension is separate from AI extensions. The actual WSL/toolchain setup and required build/verification commands are described above. The profile files do not install pinned JDK/Bob/Playwright themselves.

## CI fast path and dependency downloads

The required PR check always runs workflow/schema and CI-regression checks. Markdown-only changes additionally validate relative link targets in changed Markdown, so a broken local link fails the fast path. Changes to tooling or workflow configuration trigger the full suite. The HTML5 tests reuse a single debug Gym bundle with fresh browser contexts; release preview has separate build and test evidence.

Bootstrap pip downloads are cached by requirements; npm uses the lockfile, and Playwright Chromium uses a lockfile-keyed browser cache. The cached actionlint archive is SHA-256 verified before use; Bob hash verification remains mandatory. No compiled game is reused between runs.

## Selective CI and scheduled full regression

Changes limited to main/gym/ and Markdown docs skip the Windows native matrix entry, Bridge workflow, and the deliberate negative-build step. Linux native physics, HTML5 coverage, Android APK/signature validation, and release preview remain selected. Any shared, unknown, toolchain, or workflow change runs the complete suite. Every PR shows the classification reason. The required gate rejects unexpected missing, failed, cancelled, or skipped dependencies.

The nightly schedule always runs the entire suite at 02:17 UTC regardless of the previous diff. If required fails, a single tooling issue is opened or updated with the run link; recovery closes it. Manual CI dispatch is always conservative and full, including when its full_run switch is set. The existing post-merge run and Pages behavior remain intact.
