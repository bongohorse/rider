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

## VS Code Rider profile (WSL, CLI agents)

The repository contains [`profiles/Rider.code-profile`](../profiles/Rider.code-profile) (importable VS Code profile) and [`.vscode/settings.json`](../.vscode/settings.json) (Rider-specific yellow window chrome and no built-in Copilot/Chat panel). These are configuration templates, not evidence that a user profile was installed on the Windows machine. Codex CLI and Claude Code CLI run in the WSL terminal; no agent extensions are required.

1. Install VS Code on Windows and its **WSL** extension (`ms-vscode-remote.remote-wsl`). Open **File > Preferences > Profiles > Import Profile...** and select `profiles/Rider.code-profile`. Create the profile named **Rider**. You only need to import once.
2. Open the WSL distro **Ubuntu-26.04**, clone this repository at `~/rider` (or update your existing clone), then open Rider in its profile: `cd ~/rider && code --new-window --profile Rider .`.
3. Alternatively, launch from Windows PowerShell with `tools/open-rider.ps1`; it targets `Ubuntu-26.04` and `~/rider`. Use `-Distro <name>` if your installed WSL distro has another name. This launcher does not install WSL or tooling.
4. VS Code remembers the selected profile for the opened folder. Switch project profiles via **Profiles: Switch Profile** or **File > New Window with Profile**. Built-in AI is disabled **only for the Rider workspace/profile**, not globally for Goblin or MGD.
5. Run `codex` or `claude` in the integrated WSL terminal after their respective standalone CLIs are installed. Authenticate interactively; do not commit credentials or API keys.

VS Code's WSL extension is separate from AI extensions. The actual WSL/toolchain setup and required build/verification commands are described above. The profile files do not install pinned JDK/Bob/Playwright themselves.
