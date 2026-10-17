# VS Code / WSL migration — independent review dossier

> **Status: proposal for independent technical review (2026-10-17). Not proof of local installation or acceptance.** This document describes the developer-environment change only; it is not a new gameplay plan, toolchain approval, or instruction to start A18. See [STATUS.md](../STATUS.md) for current project status and stop gates.

**Tracking:** [Review issue #81](https://github.com/bongohorse/rider/issues/81) · [VS Code profile PR #80](https://github.com/bongohorse/rider/pull/80) (merged on 2026-10-17; no Windows/WSL host acceptance implied).

## 1. Goal and hard constraints

Enable a repeatable, low-friction **Windows 11 → VS Code → Linux WSL2 → Rider** workflow, with **Codex CLI** primarily implementing changes and **Claude Code CLI** performing independent focused reviews; both run in the VS Code integrated terminal, **not** via their VS Code extensions.

The Windows VS Code **Rider** profile should be one-click/reopenable like Goblin's: **yellow title/status bars**, legible dark text, no visible GitHub Copilot/VS Code AI chat panel, and minimal project-specific settings. Keep profiles for Goblin and Monster Girl Delivery independent.

**Non-negotiable:** Rider remains a Defold project. Preserve the pinned engine and integrated Box2D, the physics contracts, all existing CI, protected `main` and required checks. One authorized task per PR. **STOP after A17; do not start A18/#33 until a new user GO.** The profile/migration audit is not device or gameplay acceptance.

## 2. Snapshot: implemented, proposed, unverified

| Component | Verified repository fact | Proposed target / still unverified |
| --- | --- | --- |
| Rider source | [GitHub repository](https://github.com/bongohorse/rider); [AGENTS.md](../AGENTS.md), [docs index](README.md) and [tooling](TOOLING.md) exist | Clone at `~/rider` **inside the Ubuntu WSL filesystem**; local install NOT RUN |
| VS Code | Rider profile, `.vscode/settings.json`, and launcher are merged via [PR #80](https://github.com/bongohorse/rider/pull/80) | Import the merged profile on Windows; profile persistence, WSL extension placement and real yellow window NOT RUN |
| Profile PR | [#80](https://github.com/bongohorse/rider/pull/80) adds `profiles/Rider.code-profile`, `.vscode/settings.json`, `tools/open-rider.ps1`, and a tooling guide extension | PR CI run [39000249857](https://github.com/bongohorse/rider/actions/runs/39000249857) succeeded; this does **not** test the profile in Windows VS Code or WSL |
| OS | CI uses Ubuntu 26.04 for its main HTML5, preview, Linux native, Bridge and Android-build jobs; bootstrap also checks Ubuntu 24.04 and Windows | **Ubuntu 26.04 LTS on WSL2**, if the distro name is available locally. Do not assert it was installed |
| Agents | Repository has common [AGENTS.md](../AGENTS.md), no verified `CLAUDE.md` on main | Codex CLI + Claude Code CLI; short Claude entry point referencing the same rules; installations/authentication NOT RUN |
| Tests | [preview workflow](../.github/workflows/preview.yml) builds release HTML5, packages exact commit/build identity, then runs `tools/preview/verify.cjs` | Repeat **that exact local pipeline**, including `steps.cjs`; no successful local WSL execution claimed |
| Setup automation | [tools/doctor.py](../tools/doctor.py), `doctor.sh`, `verify.sh`, `build.sh` already exist | Add only minimal WSL bootstrap if approved; do not duplicate doctor, tests, locks, or documentation |

**Accuracy rule:** WSL software version (for example 3.0.1) is **not** the same as WSL2 execution architecture. WSLC means *WSL Containers*, a separate container feature; do not equate it with plain WSL2. Verify up-to-date feature support from Microsoft rather than assuming WSLC is required or unsupported.

## 3. Decision under review: execution environment

| Option | Benefits | Costs / uncertainties | Recommendation to evaluate |
| --- | --- | --- | --- |
| **A. Native WSL2 distro + VS Code WSL** | Repository stays in Linux filesystem; simple Linux terminal, CLI agents and native builds; no Docker/WSLC runtime required | Pinned tools need an installer; distro state is machine-specific; editor/browser/USB tools may cross Windows/WSL boundaries | **Proposed default** |
| B. WSLC + Dev Containers | Repeatable image and per-project isolation; similar to MGD container model; Docker Desktop not necessarily needed | WSL-file mounts, VS Code extension/runtime compatibility, file-watch and performance must be demonstrated on this host | Keep as candidate, not mandatory |
| C. Docker-backed Dev Containers / Codespaces | Familiar reproducible container specification, potentially suitable remote workflow | Extra runtime/cloud dependencies, possible cost/network or cross-OS/device limitations | Optional fallback, not a prerequisite |

**Review questions:** Does the current Microsoft WSL/WSLC and VS Code documentation support our chosen host/workspace layout? Is there recent evidence that B is faster/safer **for this specific repository**? Are isolation benefits worth the additional moving parts? Test file-watch, terminal startup, Git, buildserver traffic, large generated files and Playwright—not just `hello-world`. Keep `~/rider` away from `/mnt/c` for Linux-heavy work unless measurement justifies otherwise.

Official references to check at review time: [Microsoft WSL file systems](https://learn.microsoft.com/en-us/windows/wsl/filesystems), [VS Code WSL](https://code.visualstudio.com/docs/remote/wsl), [VS Code profiles](https://code.visualstudio.com/docs/configure/profiles), [Dev Containers](https://code.visualstudio.com/docs/devcontainers/containers), [Ubuntu on WSL](https://documentation.ubuntu.com/wsl/).

## 4. Pinned tools and ownership

**Canonical versions and policy:** [machine-readable lock](../tools/toolchain-lock.json) · [toolchain lock document](TOOLCHAIN_LOCK.md) · [CI workflow](../.github/workflows/ci.yml) · [preview workflow](../.github/workflows/preview.yml). Pins below are a review snapshot; these files are authoritative if they change.

| Tool | Rider baseline | Required audit |
| --- | --- | --- |
| Defold/Bob | 1.14.0; Bob SHA-256 in lock | Exact binary hash, source/version and release vs debug build; no unreviewed change |
| Defold engine / physics | Engine commit `a81dbb0478e8b73931dc2d671563204f6ac0ef82`, integrated Box2D 3.1.0 | Do not install a second Box2D library, alternate physics engine, or modify update tick |
| JDK | **Eclipse Temurin 25.0.4.1+1 effective build** | `java -version` must satisfy existing strict verifier; CI selector alone is insufficient |
| Python | 3.14.8 in current CI; existing project minimum >=3.12 | Make WSL setup agree with CI; requirements from `requirements-dev.txt`; avoid global pip pollution |
| Node | 24.21.0 in CI (`package.json` range >=24.11 <25) | Exact interpreter verified; `npm ci --ignore-scripts` matches CI |
| Playwright | 1.64.1 in `package-lock.json` | Browser installation + system dependencies; run actual desktop and touch-emulated release tests |
| Git / GitHub CLI | Version for CLI to be selected/pinned in setup | `git`, `gh auth status`; `gh pr checks --watch` should wait for checks rather than poll |
| Bridge / rendering | [existing Bridge contract](contracts/automation/bridge.md); Xvfb/Mesa used in Linux CI | Debug/native Bridge only, verify network and native runtime; never leak it into public releases |
| Android test tools | `adb`, signing/manifest tools where relevant | APK creation/signature ≠ Android device install or touchscreen behavior |
| Codex CLI / Claude Code CLI | Separate signed-in CLI tools, not VS Code AI extensions | Source and installation provenance, auth mode, model/cost selection, update policy and permission boundaries |

**Important:** `build.defold.com` / the Defold build service must be reachable when a build requires an engine/extension build. A successful DNS request is not sufficient; run the actual required build and capture the failure class. Avoid storing binaries or credentials in Git.

## 5. Editor/profile UX review: PR #80

Inspect the **diff**, not just the PR description. In particular:

- The importable `.code-profile` schema works in the current Windows VS Code version; the imported profile can be named **Rider** and selected again after restart.
- The WSL extension (`ms-vscode-remote.remote-wsl`) remains available; no AI agent extension is required.
- The repo-only yellow chrome provides clear visual distinction and readable focused/unfocused text; does not recolor Goblin or MGD.
- Built-in Copilot Chat / secondary sidebar is **really hidden** on startup and reopened workspaces, without disabling terminal CLIs, other GitHub features or global settings.
- Confirm that `code --new-window --profile Rider .` works **from inside WSL**; confirm `tools/open-rider.ps1` uses the actual installed distro name (not the hard-coded default), correct `~/rider` path and appropriate Windows/WSL VS Code behavior. The PowerShell script lives in the Linux checkout; it is not automatically available as a Windows-relative `tools/open-rider.ps1` path.
- Prefer **minimal** workspace config; personal theme/editor keybindings belong to the profile/user. `.vscode/tasks.json`, if added later, should expose only bootstrap, physics, HTML5 release and preview verification.
- Re-import should not silently overwrite other profiles. Document the one-time import and explicit profile switching.

**Verified upstream caveats (2026-10-17):** The [VS Code CLI contract](https://code.visualstudio.com/docs/configure/command-line) says an unknown `--profile Rider` name **creates an empty profile**. Verify that the Rider profile was *imported* in the Windows **Profiles** UI before launching with that flag; yellow workspace colors alone do not prove import. The [VS Code profiles reference](https://code.visualstudio.com/docs/configure/profiles) says extensions do **not** synchronize between local and WSL remote windows; check the Windows WSL extension and any remote extensions in their respective environments. [Microsoft WSL commands](https://learn.microsoft.com/en-us/windows/wsl/basic-commands) distinguish installed distros (`wsl --list --verbose`) from installable distros (`wsl --list --online`).

**PR #80 CI success is not proof of any of the interactive bullets above.** These remain **NOT RUN** until confirmed on the Windows host.

## 6. CLI agents, security and multi-agent Git workflow

- **Codex** implements one approved issue in its own branch/worktree. **Claude** performs a separate **read-only** diff/test-evidence audit by default; optional third agent can challenge both. Use `git worktree` if two agents must work concurrently. Never let both edit the same worktree.
- Before implementation: `git status --short`, `git branch --show-current`, `git rev-parse HEAD`. Before PR: targeted local checks, review and correct findings; then green current-head `required` check and authorized merge.
- Keep `~/.codex`, `~/.claude` and `~/.config/gh` private and out of source control. In **plain WSL2**, home-directory storage is already persistent; **extra container volumes are unnecessary**. Do not paste API keys into prompts/logs.
- Verify Claude's active billing/auth path before use; **`ANTHROPIC_API_KEY` can select API billing instead of subscription billing**. Report whether a key variable exists, **never its value**. Do not assume an active subscription.
- Avoid blanket bypass flags / unrestricted shell permissions. Agents may read untrusted repo text; review executable install scripts, network access, credential scopes and destructive commands.
- Local token saving is a hypothesis, not a guarantee: compare repeated context reads, local test cycles, API/subscription usage and GitHub CI reruns using the same task.

## 7. Minimum local acceptance gates (all currently NOT RUN on user's WSL Rider instance)

1. **Windows/WSL integration:** check available Ubuntu distros using `wsl --list --online`, then identify the *actually installed* distro and its **VERSION 2** using `wsl --list --verbose`; confirm clean clone under `~/rider`, `code .` connected to WSL and acceptable file watch/reload. Do not assume the installed distro is named `Ubuntu-26.04`. No mandatory Docker/WSLC.
2. **Identity/tools:** `git status --short`; `python --version`, `node --version`, `java -version`, `npx playwright --version`, correct Bob SHA; `bash tools/doctor.sh --json --require-g2` (understand that requiring G2 also checks the matching Bridge wrapper). Capture machine and effective versions.
3. **Dependencies/network:** `python -m pip install -r requirements-dev.txt` in a virtual environment; `npm ci --ignore-scripts`; `npx playwright install --with-deps chromium`; verify real Defold buildserver path by building, not only DNS.
4. **Tests:** `bash tools/verify.sh --suite bootstrap` and affected native/HTML5 physics; ensure explicit PASS/FAIL/BLOCKED and complete test inventory.
5. **Release parity:** follow the exact **build → package → verify** sequence below. Ensure the combined `verify.cjs` includes `mobile.cjs`, `tilt.cjs`, `ramps.cjs`, and **`steps.cjs`** (A17 regression); save screenshots, error logs and result JSON. This is the primary goal for reducing repeated GitHub CI attempts.
6. **UI/profile:** Windows VS Code can import/switch/relaunch Rider with yellow frame, no Copilot chat, functioning two WSL CLI terminals. Confirm this on real host, not via CI.
7. **GitHub workflow:** `gh auth status` and `gh pr checks --watch` work; branch protection remains effective; do not auto-merge without green `required`.
8. **Boundaries:** document anything NOT RUN (real Android input/device test, visible Windows editor, GUI debugging) separately from synthetic browser touch and headless Linux observations.

### Read-only Windows / WSL host preflight — NOT RUN

From **Windows PowerShell**, before any profile launch, collect:

```powershell
wsl.exe --status
wsl.exe --list --online     # downloadable distro names (not installed inventory)
wsl.exe --list --verbose    # installed name, state, WSL 1 vs 2
code --version
```

Open VS Code **Profiles: Switch Profile** and confirm that the imported **Rider** profile is selectable. After confirming import, from Windows PowerShell use `code --list-extensions --profile Rider` to inspect the local profile. From the *selected installed* WSL distro, check `cd ~/rider && git status --short && command -v code && command -v node && command -v python && command -v java`; require a WSL VS Code window and independently inspect extensions shown under **Local** and **WSL**. Record the actual distro, VS Code version and effective tool versions; report missing prerequisites as BLOCKED. None of this has been run on the user's machine.

### Exact local preview-release verification recipe

Prerequisites: pinned Java/Bob, Python dependencies, Node/npm dependencies and Playwright Chromium are installed. Run at repository root after checking `git status --short`; use a **fresh** output directory per execution because `package.py` deliberately refuses to mix previews:

```bash
set -euo pipefail
SOURCE_SHA="$(git rev-parse HEAD)"
BUILD_ID="$(date +%s)-1"
BUNDLE="artifacts/preview/bundle-$BUILD_ID"
SITE="artifacts/preview/site-$BUILD_ID"
EVIDENCE="artifacts/preview/verification-$BUILD_ID"

# Also executed by .github/workflows/preview.yml before its release build.
node --test tests/mobile/tilt.test.cjs
python tools/project.py build --target html5 --configuration release --fixture gym --output "$BUNDLE"
python tools/preview/package.py --bundle "$BUNDLE" --output "$SITE" --sha "$SOURCE_SHA" --build-id "$BUILD_ID"
node tools/preview/verify.cjs "$SITE" "$SOURCE_SHA" "$BUILD_ID" "$EVIDENCE"
```

This reproduces the preview job's tilt unit test followed by its **build → package → verify** sequence, **not a claimed passing local run**. A local checkout's `SOURCE_SHA=HEAD` can differ from GitHub's synthetic **PR merge commit** tested by CI; record both SHA values and do not claim identical source if they differ. The release verifier must produce `result.json` plus `mobile`, `tilt`, `ramps` and `steps` result evidence. Local parity does not include CI artifact upload, Linux native/Bridge, APK checks, deployment, or physical Android input. Report network/toolchain failures as BLOCKED; do not weaken tests to obtain green.

**R0 findings:** See [independent repository audit](https://github.com/bongohorse/rider/issues/81#issuecomment-6234804959). R81-01/02 remain **host-required** (profile identity and installed distro/launcher), R81-03 has a documentation recipe correction above, R81-04/05/06 remain **host-required** (exact pins, Bridge/Android prerequisites and Linux Chromium), and R81-07 is a future profile/workspace drift risk. A different independent agent review is still required; this documentation update is not that review.

## 8. Suggested implementation sequence — only after review

| Gate | Deliverable | Pass condition |
| --- | --- | --- |
| R0 — independent audit | At least two separate agent reviews; reproduce conflicts rather than vote | Each material finding resolved/accepted with evidence in [issue #81](https://github.com/bongohorse/rider/issues/81) |
| R1 — VS Code UX | Review and refine [PR #80](https://github.com/bongohorse/rider/pull/80) | Valid import schema/settings plus actual Windows profile/WSL launch evidence; `required` green |
| R2 — WSL setup | Minimal reproducible setup/install script, pinned tools, existing `doctor` | Fresh Ubuntu 26.04 WSL install passes actual inventory; no duplicate verification framework |
| R3 — local test parity | Minimal VS Code tasks or wrapper for existing tests + release preview | Full local release `verify.cjs` passes, logs/screenshots archived under ignored artifacts |
| R4 — multi-agent dry run | Review-only issue/diff in isolated branches/worktrees, CLI credentials safe | Git unaffected outside approved changes; CI watch and stop gates observed |

**Do not implement R1–R4 as part of this review-only issue unless separately approved. Do not start gameplay A18.**

## 9. Copy/paste brief for independent AI reviewers

```text
ROLE: Independent technical auditor. READ-ONLY: do not edit files, install
software, open/merge PRs, or begin A18. Avoid relying on another agent's opinion.

REPOSITORY: https://github.com/bongohorse/rider
READ FIRST: docs/VSCODE_MIGRATION_REVIEW.md
Then inspect only relevant evidence: docs/TOOLING.md, docs/TOOLCHAIN_LOCK.md,
tools/toolchain-lock.json, AGENTS.md, tools/doctor.py,
.github/workflows/preview.yml, tools/preview/{package.py,verify.cjs,steps.cjs},
and the real diff of PR #80. Check current PR state and upstream vendor docs.

GOAL: Critically evaluate the move to Windows VS Code with a dedicated yellow
Rider profile, native Ubuntu 26.04 WSL2 checkout ~/rider, terminal-based Codex
CLI and Claude Code CLI, local Defold/Box2D/Playwright/HTML5 verification,
secure separate agent worktrees, and GitHub required CI.

Check: feasibility, outdated assumptions, exact tool pin installability,
Windows<->WSL profile and file/terminal behavior, security, costs, missing
dependencies, test parity, CI protection, unnecessary complexity, alternatives.

OUTPUT (concise and actionable):
1) Overall verdict: APPROVE / APPROVE WITH CHANGES / BLOCK.
2) Findings ranked BLOCKER / HIGH / MEDIUM / LOW: exact file/line, observed
   fact or official source/date, consequence, suggested concrete fix.
3) Explicitly separate VERIFIED, INFERRED and NOT TESTED.
4) Compare native WSL2 vs WSLC Dev Containers vs alternative, with rationale.
5) Give an improved minimal rollout plan and precise acceptance tests.
6) List contradictions or uncertainties. No invented test results.
Do not treat passing GitHub CI as proof of a local Windows setup.
```

## 10. Recording and resolving review findings

Reviewers should post findings to [issue #81](https://github.com/bongohorse/rider/issues/81) or their own audit notes and attach links. Suggested table format:

| ID / severity | Evidence (source/version/line/test) | Failure or risk | Proposed correction | Disposition |
| --- | --- | --- | --- | --- |
| Example: R-01 / HIGH | PR #80 Windows launcher (unverified) | Wrong WSL distro label on a particular PC | Discover label or provide safe override and test | OPEN |

**No majority voting:** conflicting independent conclusions require reproduction or documented uncertainty. The maintainer accepts the reviewed plan before real setup changes, and Rider's existing PR/CI/STOP policies continue to apply.
