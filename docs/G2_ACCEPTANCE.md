# G2 acceptance — BLOCKED; independent CLI increment PASS

G1 was merged in [PR #7](https://github.com/bongohorse/rider/pull/7) as `23250a1078fc45b6e69419a91697a58dfad9b26f`. Final functional source `9596b69b9013a39cd77475bb82dd20d3d5d1457e` passed all G1 platform jobs in [run 38698703886](https://github.com/bongohorse/rider/actions/runs/38698703886) and required bootstrap/Renovate jobs in [run 38698703754](https://github.com/bongohorse/rider/actions/runs/38698703754).

The user authorized the autonomous review/fix/complete/next loop. This G2 increment implements independent tooling. It does not approve the whole gate or authorize bypassing missing prerequisites.

| Required evidence | State |
|---|---|
| Shared build/verify commands; same G1 physics runner | PASS; native and HTML5 CI |
| JSON v1 + JUnit, complete inventory, nonzero failure/BLOCKED exits | PASS on Linux/Windows; four CLI regression tests |
| Real isolated build-error rejection and restored clean build | PASS; isolated syntax failure and restored build |
| Android debug APK | PASS through shared CLI; apksigner and aapt2 PASS; installation/device behavior NOT RUN |
| Editor HTTP connection | NOT RUN; no editor session provided |
| Bridge 2.5.0 + matching wrapper/native clean build | BLOCKED: license evidence unresolved |
| Engine/project identity, capability, input change, screenshot | NOT RUN; depends on Bridge integration |
| Started release with debug routes/Lua absent | NOT RUN; depends on Bridge integration |
| Community MCP | Optional DEFERRED; official CLI/HTTP route selected |

## Bridge blocker, checked 2026-10-15

Pinned source: `defold/extension-automation-bridge` 2.5.0, commit `567c7efb2f72626af71967984bd33dde856f0d36`.

- The complete pinned tag tree has no LICENSE/NOTICE-named file.
- The current master tree also has no LICENSE/NOTICE-named file; GitHub repository metadata reports `license: null`.
- The reviewed native entry source starts with implementation/includes, without a license grant; its README gives installation instructions but no license terms.
- The official [Asset Portal entry](https://defold.com/assets/automation-bridge/) lists `License: N/A`.
- Reviewed [upstream issues](https://github.com/defold/extension-automation-bridge/issues) did not supply a license clarification.

This is a missing provenance/permission record, not proof of a license prohibition. The plan explicitly requires a license record from the concrete source/release before integration. Do not guess MIT/Defold License, vendor the wrapper, or silently mark the mandatory Bridge DEFERRED. No upstream message was sent. Clarification must come from authoritative upstream terms or an explicit approved change to the G2 requirement. The installed CLI and G1 engine proof remain useful independently.

Continue independent CLI/build/Android validation within G2. Do not start G3 while mandatory G2 evidence remains blocked. This report keeps NOT RUN, BLOCKED and PASS distinct; `results.json` tooling PASS always states `whole_gate_approval: false`.

## Completed independent increment

Functional source `d8199f47eeebef7914e89799b56ada81338e5ef4` passed:

- [Required CI 38699767084](https://github.com/bongohorse/rider/actions/runs/38699767084): Linux/Windows shared bootstrap wrappers, CLI regressions and Renovate validation/scan.
- [Physics CI 38699767109](https://github.com/bongohorse/rider/actions/runs/38699767109): both native platforms and HTML5 through the shared verification CLI, preserving all G1 cases and comparisons.
- [G2 tooling CI 38699767176](https://github.com/bongohorse/rider/actions/runs/38699767176): intended Lua error rejected, exact source restored, restored build passed, original working tree unchanged; shared CLI Android build, Android build-tools 37.0.0 signature verification and manifest parsing passed.

The isolated source restoration hash was `3158b5e6563d933c0271747a858faeee3beb5652597b8db0ca712686b3c1f4e2`. Reports explicitly retain `installability: NOT VERIFIED` and `device_tests: NOT RUN`. [PR #8](https://github.com/bongohorse/rider/pull/8) is the completed CLI increment, not whole-G2 approval. Bridge-dependent work remains blocked as described above.
