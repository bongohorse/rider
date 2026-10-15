# Rider status

Updated 2026-10-15. This is the sole current progress/blocker source; linked acceptance records describe only their tested historical commits.

## Current work

S1–S2 are complete. Claudio has read S3's [brief](docs/GAME_DESIGN.md) and provided the design direction recorded in the [plan](docs/PLAN.md). The feedback is incorporated; feel/comfort/fairness decisions await the planned playable trials. Claudio authorized M1 on 2026-10-15. A1 is complete (PR #41; chain contact/camera smoke and retained G1 suites PASS). A2 is complete (PR #42; keyboard drive/brake, contact and camera smoke PASS). A3 is complete (PR #43; 100 retries, bounds/input/handle checks and waking from sleep PASS). A4 implements the release preview pipeline in PR #44; its public deployment evidence is tracked in #19; no human drive acceptance is claimed. G0–G2 are complete at their documented historical sources, not a gameplay acceptance.

| Step | State | Evidence / remaining acceptance |
| --- | --- | --- |
| S1 required CI aggregation | PASS; merged | [PR #15](https://github.com/bongohorse/rider/pull/15), merge `82c70b19d2ef2e893eafa8770e5182cba15b96d2`; [clean CI](https://github.com/bongohorse/rider/actions/runs/38745075743) at `dbb8ffaf5f9ecdab369453ea9dd3b6194de87e4d` PASS. Negative propagation and sole-required protection verified. |
| S2 issue/document migration | PASS; merged | [PR #38](https://github.com/bongohorse/rider/pull/38), merge `67703b24d8d642fcfebc80c27f840a535b48a0d0`; [clean CI](https://github.com/bongohorse/rider/actions/runs/38746136550) at `2cba36d542e8cc7b27dfb2de7dd50a96e68088dd` PASS. Plan/contracts/history and all 22 issues (#16–#37) verified in five milestones (4/8/2/7/1) with five labels; [setup evidence](https://github.com/bongohorse/rider/actions/runs/38745300299). |
| M1 A1–A3 | PASS; merged | PRs #41–#43. A3 [required CI](https://github.com/bongohorse/rider/actions/runs/38765487417) at `56dac450fa7ef63f48e550308e25005d044db8a3`: 100 resets, canonical transforms/velocities, joint invalidation/recreation, static chain, one proxy load, input clearing and fresh drive from sleep PASS. Reset operation min/p50/max 0/0/1.000 ms; request-to-READY max 19.000 ms in CI Chrome; no phone/frame-latency claim. |
| M1 A4 and drive acceptance | Preview pipeline implemented; human acceptance pending | [PR #44](https://github.com/bongohorse/rider/pull/44), [deployment evidence / remaining phone criterion](https://github.com/bongohorse/rider/issues/19). Release and public runtime verification cover desktop and phone emulation; actual phone opening and Claudio's drive test are separate, NOT RUN. |
| S3 design brief v0 | User direction recorded; playtests pending | [v0 / PR #39](https://github.com/bongohorse/rider/pull/39) and its [merged-main CI](https://github.com/bongohorse/rider/actions/runs/38748316650) passed; Claudio read [v0](docs/GAME_DESIGN.md) and answered its questions on 2026-10-15: unrestricted gym, variable level lengths, required tilt trial, test presets/crash fairness, agent-proposed recovery/checkpoint defaults. No device/fun results claimed. |

## Preview and platform evidence

Preview URL: https://bongohorse.github.io/rider/. A4 (#19 / PR #44) builds a release gym, verifies desktop and 20:9 phone emulation, then deploys main only after green required. The root loader reads [build.json](https://bongohorse.github.io/rider/build.json) for the exact deployed source SHA and run/attempt ID; public runtime/deployment evidence is recorded in [#19](https://github.com/bongohorse/rider/issues/19). Real-phone loading and Claudio's drive acceptance remain NOT RUN. A4 remains open until the phone criterion is confirmed.

Reference phone: Xiaomi Mi 10T Pro / Android 12 / Snapdragon 865 / 2400×1080 / adaptive 30–144 Hz. Installed Android Chrome version and all actual gym device observations remain NOT RUN/unrecorded; collect in A13 (#28). This does not block independent browser gym work. [Platform matrix](docs/PLATFORM_MATRIX.md).

## Decisions / capability limits

- Branch protection update confirmed by Claudio and readable branch metadata: `required` is the sole required context, enforced for everyone. The full administration endpoint remains inaccessible; other settings rely on Claudio's saved configuration. No bypass used.
- Milestone/label connector limitation resolved through a one-time, least-privilege repository Action; its workflow is removed from the final tree. No account setting or extra token was needed.
- Bridge license provenance remains unresolved under explicit user implementation authorization; before Phase B app distribution remove the extension from release binaries and verify exclusion. [Contract](docs/contracts/automation/release.md).
- Claudio's design feedback is recorded; comfort, presets, crash fairness and the agent-proposed recovery defaults still require playable evaluation. Milestone drive-test approvals remain separate from CI or a merge.

## Next implementation step

M1 implementation: A1 (#16 / PR #41), A2 (#17 / PR #42), A3 (#18 / PR #43), A4 (#19 / PR #44). Finish any failing required/deployment checks, then stop for Claudio's drive test and actual phone loading check. M2 is not authorized. Build the planned trials before asking Claudio to choose touch layout, assist values or crash fairness. M3 includes the required tilt experiment; final retention follows the actual phone comparison. At each milestone end, report the preview URL, request Claudio's drive test and wait for next-milestone approval.
