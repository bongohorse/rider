# G2 acceptance — BLOCKED, independent tooling in progress

G1 was merged in [PR #7](https://github.com/bongohorse/rider/pull/7) as `23250a1078fc45b6e69419a91697a58dfad9b26f`. Final functional source `9596b69b9013a39cd77475bb82dd20d3d5d1457e` passed all G1 platform jobs in [run 38698703886](https://github.com/bongohorse/rider/actions/runs/38698703886) and required bootstrap/Renovate jobs in [run 38698703754](https://github.com/bongohorse/rider/actions/runs/38698703754).

The user authorized the autonomous review/fix/complete/next loop. This G2 increment implements independent tooling. It does not approve the whole gate or authorize bypassing missing prerequisites.

| Required evidence | State |
|---|---|
| Shared build/verify commands; same G1 physics runner | Implemented; CI pending |
| JSON v1 + JUnit, complete inventory, nonzero failure/BLOCKED exits | Local tests PASS; platform CI pending |
| Real isolated build-error rejection and restored clean build | Implemented; CI pending |
| Android debug APK | G1 build PASS; shared-CLI signature/manifest checks pending; install/device behavior NOT RUN |
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
