# G2 acceptance — technical PASS (native CLI/Bridge)

G1 was merged in [PR #7](https://github.com/bongohorse/rider/pull/7) as `23250a1078fc45b6e69419a91697a58dfad9b26f`. Final functional source `9596b69b9013a39cd77475bb82dd20d3d5d1457e` passed all G1 platform jobs in [run 38698703886](https://github.com/bongohorse/rider/actions/runs/38698703886) and required bootstrap/Renovate jobs in [run 38698703754](https://github.com/bongohorse/rider/actions/runs/38698703754).

The user authorized the autonomous review/fix/complete/next loop and explicitly instructed Bridge implementation on 2026-10-15 after the missing-license finding was reported. This supersedes the earlier implementation stop. The provenance finding remains unresolved; user authorization is not an upstream license grant. Runtime approval still requires the full technical matrix.

| Required evidence | State |
|---|---|
| Shared build/verify commands; same G1 physics runner | PASS; native and HTML5 CI |
| JSON v1 + JUnit, complete inventory, nonzero failure/BLOCKED exits | PASS on Linux/Windows; four CLI regression tests |
| Real isolated build-error rejection and restored clean build | PASS; isolated syntax failure and restored build |
| Android debug APK | PASS through shared CLI; apksigner and aapt2 PASS; installation/device behavior NOT RUN |
| Editor HTTP connection | NOT RUN; no editor session provided |
| Bridge 2.5.0 + matching wrapper/native clean build | PASS, exact source installed; license evidence remains unresolved |
| Engine/project identity, capability, input change, screenshot | PASS on native Linux graphics |
| Started release with debug routes/Lua absent | PASS; ready run-ID, no module and no TCP listeners |
| Community MCP | Optional DEFERRED; official CLI/HTTP route selected |

## Bridge blocker, checked 2026-10-15

Pinned source: `defold/extension-automation-bridge` 2.5.0, commit `567c7efb2f72626af71967984bd33dde856f0d36`.

- The complete pinned tag tree has no LICENSE/NOTICE-named file.
- The current master tree also has no LICENSE/NOTICE-named file; GitHub repository metadata reports `license: null`.
- The reviewed native entry source starts with implementation/includes, without a license grant; its README gives installation instructions but no license terms.
- The official [Asset Portal entry](https://defold.com/assets/automation-bridge/) lists `License: N/A`.
- Reviewed [upstream issues](https://github.com/defold/extension-automation-bridge/issues) did not supply a license clarification.

This is a missing provenance/permission record, not proof of a license prohibition. The plan explicitly requires a license record from the concrete source/release before integration. Do not guess MIT/Defold License or silently mark the mandatory Bridge DEFERRED. The user has explicitly authorized installing the pinned extension and its matching wrapper despite this recorded finding. No upstream message was sent. Any eventual license classification must come from authoritative upstream terms; do not describe this user instruction as resolving the license. The installed CLI and G1 engine proof remain useful independently.

Continue the full G2 Bridge implementation and technical validation under the explicit user instruction. Do not start G3 until mandatory technical G2 checks pass. This report keeps NOT RUN, BLOCKED and PASS distinct; `results.json` tooling PASS always states `whole_gate_approval: false`.

## Completed independent increment

Functional source `d8199f47eeebef7914e89799b56ada81338e5ef4` passed:

- [Required CI 38699767084](https://github.com/bongohorse/rider/actions/runs/38699767084): Linux/Windows shared bootstrap wrappers, CLI regressions and Renovate validation/scan.
- [Physics CI 38699767109](https://github.com/bongohorse/rider/actions/runs/38699767109): both native platforms and HTML5 through the shared verification CLI, preserving all G1 cases and comparisons.
- [G2 tooling CI 38699767176](https://github.com/bongohorse/rider/actions/runs/38699767176): intended Lua error rejected, exact source restored, restored build passed, original working tree unchanged; shared CLI Android build, Android build-tools 37.0.0 signature verification and manifest parsing passed.

The isolated source restoration hash was `3158b5e6563d933c0271747a858faeee3beb5652597b8db0ca712686b3c1f4e2`. Reports explicitly retain `installability: NOT VERIFIED` and `device_tests: NOT RUN`. [PR #8](https://github.com/bongohorse/rider/pull/8) is the completed CLI increment, not whole-G2 approval. Bridge-dependent work was subsequently explicitly authorized and now has passing technical baseline evidence below.

## Bridge implementation provenance

Native dependency and wrapper come from immutable commit `567c7efb2f72626af71967984bd33dde856f0d36`; source archive SHA-256 `94807c707dd2814f5038fc26a9a20bcb4428a18b5e6d581d031507926a003958`. `tools/setup_bridge.py` uses the official installer and verifies every installed file against that archive. The managed wrapper is generated/ignored, never hand-edited. The tag's Python package reports 3.0.0, native constant 2.0.0, API version 2. These are distinct version fields; acceptance requires the actual matching-source API/capability checks. Upstream health also advertises legacy min/max metadata 1..1; record this inconsistency rather than inventing identical release/package version numbers.

The native extension is omitted from HTML5 through a verified Bob settings override (`project.dependencies =` clears the array). HTML5 retains its own browser physics test; it does not claim native Bridge capability. The normal native debug/release smoke includes the exact dependency.

## Bridge technical baseline and review

- Native debug and started-release cases passed at `3716f152ba03c004fe70a8e505f58212f74ed96c`, [run 38701899289](https://github.com/bongohorse/rider/actions/runs/38701899289).
- Common `verify --suite bridge` JSON/JUnit path passed at `d0872a569bfaaed3b4c294969650b87418314cad`, [run 38702661582](https://github.com/bongohorse/rider/actions/runs/38702661582).
- Windows ordinary debug engine + Mesa software OpenGL, Linux headless, HTML5 and Android build all passed [physics matrix 38702661637](https://github.com/bongohorse/rider/actions/runs/38702661637) at that same source. The initial Windows runner lacked an OpenGL driver; the pinned per-process software driver fixes that environment prerequisite without replacing the engine or physics.
- Shared Android/isolated-negative-build checks passed [run 38702661674](https://github.com/bongohorse/rider/actions/runs/38702661674); required bootstrap/Renovate checks passed [run 38702661633](https://github.com/bongohorse/rider/actions/runs/38702661633).

Observed debug input ID 1 reached released state and changed count 0→1. The inspected screenshot showed the green button and `Count: 1`; source identity and engine SDK matched. A live release initialized the GUI fixture, atomically wrote current-run readiness with absent Lua module, and owned no TCP listening sockets. The release test was changed from stripped print output to file readiness, not bypassed. Exact version fields/commands and platform boundaries are in [BRIDGE.md](BRIDGE.md).

The updated read-only G2 doctor additionally validates exact toolchain and wrapper integrity. Local five bootstrap, seven G1 protocol/toolchain and five G2 CLI/wrapper tests pass; a controlled stale/missing-wrapper test verifies rejection without writes. PR #9 requires final CI for the read-only doctor/installer review refinements before merge. Editor-frontend connectivity and real Android/device switching remain NOT RUN; no such evidence is inferred.
