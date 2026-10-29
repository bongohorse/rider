# Local Rider development with T3 Code

Preparation for [#315](https://github.com/bongohorse/rider/issues/315). This runbook supplies host activation steps; it does not claim that Claudio's PC or Oracle server has been configured. Keep GitHub's current-head `required` and review before merging.

**Contents:** [Target setup](#target-setup) · [Install and connect T3 Code](#install-and-connect-t3-code) · [Provision local Extender](#provision-local-extender) · [Daily commands](#daily-commands) · [Cache and worktree rules](#cache-and-worktree-rules) · [Agent handoff](#agent-handoff) · [Host acceptance](#host-acceptance) · [Rollback](#rollback) · [Sources and maintenance](#sources-and-maintenance)

## Target setup

| Component | Primary host / role |
| --- | --- |
| Windows PC | Browser or optional T3 desktop client; human drive tests |
| WSL Ubuntu x86-64 | Rider checkout at `~/rider`, existing Codex, pinned Bob/Java/Python/Node and Playwright |
| Docker with WSL integration | Extender frontend and only the required platform builders |
| Extender endpoint | `http://127.0.0.1:9000`, reachable by Bob in WSL, bound to host loopback |
| GitHub | Remote source, review, final integration CI, deployment and nightly regression |
| Oracle Ubuntu ARM64 | Optional T3 environment for source work/fast tests; build and browser acceptance pending |

Use the existing [toolchain pins](TOOLCHAIN_LOCK.md). T3 is a user-managed agent interface, not a new game/npm dependency. Do not replace Rider's Node/Python/Java to build T3 from source. Each provider and checkout must be installed on the environment that actually executes the work.

On the intended build host, inventory first:

```bash
cd ~/rider
git status --short --branch
uname -m
free -h
df -h .
python3 tools/local.py doctor
```

The doctor checks exact Python/Node/Playwright parity, Java, Bob bytes and tool presence. It returns 2 for missing/deviating prerequisites; even `READY_FOR_HOST_CHECKS` is not runtime approval. It does not probe accounts, devices or ports, install packages, or start Docker. Existing `tools/doctor.py` and `tools/local_parity.py` remain available.

## Install and connect T3 Code

Pilot version: **v0.1.5**, source `6d450a4284852af137b2f3407fddd89eb76e7644`, MIT. Use the complete release archive; its adjacent client/native-library files are required. The published SHA256SUMS entries read on 2026-10-29 are:

| Archive | SHA-256 |
| --- | --- |
| `t3-0.1.5-linux-x64.tar.gz` | `21d50dcc9c634221b11b58d6a94350d2c6ee36905737b054b11fa4eba295a98b` |
| `t3-0.1.5-linux-arm64.tar.gz` | `389362e2a349ea62b38d9bc708f4fca2381936cccb2d326b5fc5d074b072aef1` |

For the primary **WSL x86-64** host, run in a new user-owned download directory, without sudo. Stop if download/checksum/extraction fails:

```bash
set -euo pipefail
mkdir -p "$HOME/.cache/rider-t3/0.1.5" "$HOME/.local/opt/t3-code"
cd "$HOME/.cache/rider-t3/0.1.5"
curl -fL https://github.com/pingdotgg/t3code/releases/download/v0.1.5/t3-0.1.5-linux-x64.tar.gz -o t3-0.1.5-linux-x64.tar.gz
echo '21d50dcc9c634221b11b58d6a94350d2c6ee36905737b054b11fa4eba295a98b  t3-0.1.5-linux-x64.tar.gz' | sha256sum -c -
tar --no-same-owner -xzf t3-0.1.5-linux-x64.tar.gz -C "$HOME/.local/opt/t3-code"
export PATH="$HOME/.local/opt/t3-code/t3-0.1.5-linux-x64:$PATH"
t3 --version
cd ~/rider
t3 serve --host 127.0.0.1
```

Open the local URL printed by T3. Add `~/rider` as the project and select the existing Codex provider in that WSL environment. Complete any login interactively; do not paste credentials into a task, commit or evidence file. Add the versioned directory to the user shell's PATH only after the pilot succeeds. Keep the previous editor available through acceptance. A background T3 service is optional after foreground operation is verified.

Alternatively, install the same release's Windows desktop client and select the WSL environment (the release's documentation calls this **Settings → Sharing & access**). Confirm the agent reports Linux and the intended checkout before permitting edits. Merely opening a Windows client does not select WSL.

For Oracle, use the ARM64 archive and corresponding hash above. Connect with desktop-managed SSH using the existing SSH alias. Provider setup and Rider checkout belong on Oracle. Keep access through SSH; no new public application or Extender port is needed. Do not reuse the research container/checkout or alter its services. The prepared local build profile deliberately blocks ARM builds until matching Bob host tools, Extender builders and browser/WebGL tests are verified. An ARM64 Android *target* does not imply an ARM64 Android *build host*: the documented Android and x86-64 Linux toolchains need x86-64 execution/emulation.

## Provision local Extender

Provisioning is a host activation task. This preparation does not guess image digests or claim an untested server compatible. Place the installation outside the game checkout, for example `~/rider-tools/extender`. Use the official [local setup manual](https://defold.com/manuals/extender-local-setup/) and record:

| Required identity | Required value/evidence |
| --- | --- |
| Engine | `a81dbb0478e8b73931dc2d671563204f6ac0ef82`, unchanged Rider pin |
| SDK mappings | From that engine's `share/platform.sdks.json`, not a current default |
| HTML5 builders | `emsdk-406`, both `wasm-web` and `wasm_pthread-web` |
| Android builder, when enabled | `android-ndk25_sdk36` |
| Linux desktop, when enabled | `linux-latest` mapping, resolved to an immutable image digest |
| Extender application + manifest merger | Explicit versions/commits and verified JAR checksums, compatibility established by host builds |
| Container environments | Immutable digest per image and host architecture; keep the resolved Compose configuration |
| Endpoint | Loopback only on host port 9000, including Docker's published-port binding |

The official prebuilt-artifact route requires Docker and Google Cloud CLI/account access to download images/JARs. This is provisioning, not a requirement to compile on Google's or Defold's servers. Download with interactive host login; never place registry credentials in Rider. Upstream Compose uses floating `latest` images and a wildcard published port: create a host-owned pinned configuration with image digests and `127.0.0.1:9000:9000` **before starting**. Preserve Docker's internal service network. Do not execute the upstream all-platform profile unchanged.

Start only the web frontend/builder initially. Add Linux and Android when their acceptance is needed. In the selected Extender checkout the documented start shape is:

```bash
docker compose -p rider-extender -f server/docker/docker-compose.yml --profile web up -d --pull never
```

Run this only after the host-owned configuration above is in place and the selected images/JARs are present. Verify the fully rendered Compose configuration contains no wildcard published port and no floating image before starting. Keep SDK storage persistent; distinguish Docker environment images from the engine-specific Defold SDK downloads. Record failures as BLOCKED/FAIL, never change Rider's pinned engine to make provisioning succeed.

Local Rider commands always pass a loopback server explicitly. `RIDER_BUILD_SERVER` also opts existing build/test wrappers into that server:

```bash
export RIDER_BUILD_SERVER=http://127.0.0.1:9000
bash tools/verify.sh --suite physics --target html5
```

An invalid explicit value blocks. A stopped local server does not cause our wrapper to retry publicly. Existing engine guards still reject a fallback stock engine. Without the variable, legacy commands/CI retain the locked public server; use `tools/local.py` for the local-only development loop. A cached engine may avoid a new server request, so prove local server usage with an initially empty engine cache in a separate worktree.

## Daily commands

Prepare dependencies once per checkout using its virtual environment and the existing pins:

```bash
cd ~/rider
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
npm ci --ignore-scripts --no-audit --no-fund
npx playwright install --with-deps chromium
```

These are explicit setup commands, not part of each test. Check the exact pinned JDK/Python/Node separately; the commands do not install them. The first verified build obtains Bob; before that doctor reports Bob missing. Existing native/Bridge prerequisites are in [TOOLING.md](TOOLING.md).

```bash
python tools/local.py check                     # fast checks, no builds/browser suite
python tools/local.py build                     # HTML5 debug via loopback Extender
python tools/local.py gym --case le6             # one real-input editor suite
python tools/local.py gym --case le2             # reuse the same unchanged debug bundle
python tools/local.py gym --case le6 --fresh     # force a new game bundle
python tools/local.py physics --target html5    # full G1 physics, both browser engine modes
```

Global options go before the command, for example `python tools/local.py --server http://127.0.0.1:9000 gym --case le6`. Each invocation uses a unique evidence directory under `artifacts/local/runs/`; JSON/JUnit/logs retain failures with short terminal output. Exit 0 PASS, 1 FAIL, 2 BLOCKED. Doctor has its own inventory JSON. A targeted PASS establishes only the named suite, not complete regression. The fast check includes bootstrap, Python G1/G2/CI and Node CI/mobile unit checks. It is intentionally not an automatic file-to-test classifier.

Choose tests according to changed behavior and adjacent consumers; preserve real gestures, fixed millisecond measurements, assertions and timeout limits. Use existing Gym case names in [TOOLING.md](TOOLING.md#gym-tests). Broaden local verification before pushing shared physics/storage/input changes. Commit checkpoints locally; push a coherent verified state, not every correction. Opening a draft PR still triggers the current CI. Host outages/missing prerequisites are not passes.

For release builds use a **separate checkout/worktree** and its own dependencies/cache. There run `python tools/local.py build --configuration release`. Android is `python tools/local.py build --target android` after Android provisioning; this proves a build only, not installation/device behavior. Keep pinned release-preview regression separate from debug Gym evidence.

## Cache and worktree rules

- Keep source in WSL's Linux filesystem. One writing agent per worktree. T3 does not change the existing issue/GO/branch rules.
- A checkout shares mutable Bob `build/` and `.internal/` directories. `tools/local.py` serializes its commands with an OS file lock, released when the process exits; do not run legacy builds or another agent in that same checkout concurrently. Leave the lock file in place; its presence alone does not mean a command is running.
- Keep debug and release in different worktrees. If an existing checkout mixed them, follow the deliberate cleanup guidance in [TOOLING.md](TOOLING.md#gym-tests) before building; this helper never silently deletes those directories.
- Gym reuse requires the same HEAD, actual Git-listed working files (tracked plus nonignored new files), debug/HTML5 identity and exact output inventory. Staged/unstaged edits and deletions invalidate reuse. Changes during the build/test fail. Old manifests without a fingerprint fail. Symlink inputs are refused.
- Generated outputs stay under ignored `artifacts/`, `build/`, `.internal/` and `.cache/`. Do not keep actual build sources in ignored paths. Nonignored local notes conservatively invalidate a bundle; keep machine-specific notes outside the checkout.
- Only verified tools/SDKs are shared. Do not share writable `node_modules`, `.internal`, `build/` or mutable bundle output across working trees. Never restore arbitrary prior CI game binaries as current evidence.

## Agent handoff

Use this instruction for the first T3 thread after the preparation branch is merged and host setup is complete:

> Read AGENTS.md, STATUS.md and docs/LOCAL_T3_SETUP.md. Report the environment, architecture, checkout, branch and HEAD. Work only on the selected issue with its GO, in one worktree. Run the local doctor, then the fast check and affected real-input tests. Use the loopback Extender and rebuild after changed inputs. Correct failures locally before pushing a coherent reviewed change. Keep required CI and toolchain pins. Report named PASS/FAIL/BLOCKED results and evidence paths; never infer a device, offline or full-suite pass. Do not install/update tools, expose services or copy credentials as part of the coding task.

## Host acceptance

Record progress in STATUS.md and evidence in the implementation PR. Host observations are NOT RUN until performed; repository unit tests are not substitutes.

1. Confirm intended WSL x86-64 environment, free CPU/RAM/disk, pinned dependencies and selected Codex account interactively. T3 edits a disposable file in the intended checkout; discard it. Keep credentials out of evidence.
2. Record Extender/JAR/image/SDK identities and loopback binding. From a new separate worktree with no Bob engine cache, build HTML5 through the local server. Confirm actual local request logs, `engines.json` PASS for both engines and G1 HTML5 runtime/Box2D v3 PASS in both isolated and players modes.
3. Measure cold and warm game builds and representative `le6`/physics tests in milliseconds. Re-run unchanged input, edit a Lua file without committing, and prove the next Gym run builds fresh. Restore the edit, then verify output tampering and source changes are refused.
4. Build release in its separate worktree, run its existing preview regression, and have Claudio drive it. Retain startup/retry/editor/persistence behavior. Device checks remain separate.
5. Stop the local Extender and use an empty-cache worktree: build must fail or block with no public-server retry. For an **offline** claim, additionally pre-provision every artifact/metadata/dependency and repeat with external egress blocked; allow loopback. A local server URL alone does not establish offline operation.
6. Exercise T3 disconnect/reconnect and safe host restart, then optionally enable its background service. Record Oracle separately if used: current resource inventory, native tool availability and emulation overhead; no automatic equivalence to WSL evidence.

## Rollback

Stop the foreground T3 process, or stop its service using the selected version's documented service commands if one was installed. Keep the Rider working tree, worktrees and local commits. Reopen the same checkout in the existing editor. Stop only the `rider-extender` Compose project; keep its verified cache for later use. Remove `RIDER_BUILD_SERVER` from that shell only when deliberately returning to the legacy public-server path. No GitHub configuration needs restoring; no CI policy was changed. Keep the previous T3 release directory when testing an update.

## Sources and maintenance

- [T3 v0.1.5 release/checksums](https://github.com/pingdotgg/t3code/releases/tag/v0.1.5), [installation](https://github.com/pingdotgg/t3code/blob/v0.1.5/docs/user/install.md), [remote access](https://github.com/pingdotgg/t3code/blob/v0.1.5/docs/user/remote-access.md), [MIT license](https://github.com/pingdotgg/t3code/blob/v0.1.5/LICENSE). Upgrade deliberately, verify archive hash, record provider compatibility and repeat connection/checkout/agent-command checks. Remove this optional dependency by reverting to the existing editor/CLI workflow.
- [Defold local Extender](https://defold.com/manuals/extender-local-setup/) documents the loopback Bob `--build-server` option, profiles and provisioning. [Engine-pinned SDK mapping](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/share/platform.sdks.json) fixes Rider's required builder families. The current upstream Extender release inspected during preparation was [2.16.4](https://github.com/defold/extender/releases/tag/extender-v2.16.4); it is **not** a runtime-approved Rider server pin. [Its Compose source](https://github.com/defold/extender/blob/extender-v2.16.4/server/docker/docker-compose.yml) shows the floating images/published-port defaults requiring host preparation. Capture licenses/provenance and immutable identities for the selected server/images on the host before acceptance.
- Keep [TOOLCHAIN_LOCK.md](TOOLCHAIN_LOCK.md), the engine guards and [automation contract](contracts/automation.md). No new physics API or simulation path is introduced. No dependency upgrade, new public endpoint, nightly-only required coverage or guaranteed timing/credit reduction follows from this preparation.
