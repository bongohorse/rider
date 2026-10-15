# Rider status

Updated 2026-10-15. This is the sole current progress/blocker source; linked acceptance records describe only their tested historical commits.

## Current work

S1–S2 are complete. S3's [game design brief](docs/GAME_DESIGN.md) is prepared for Claudio's confirmation under the [Driving Gym plan](docs/PLAN.md). M1 has not started. G0–G2 are complete at their documented historical sources, not a gameplay acceptance.

| Step | State | Evidence / remaining acceptance |
| --- | --- | --- |
| S1 required CI aggregation | PASS; merged | [PR #15](https://github.com/bongohorse/rider/pull/15), merge `82c70b19d2ef2e893eafa8770e5182cba15b96d2`; [clean CI](https://github.com/bongohorse/rider/actions/runs/38745075743) at `dbb8ffaf5f9ecdab369453ea9dd3b6194de87e4d` PASS. Negative propagation and sole-required protection verified. |
| S2 issue/document migration | PASS; merged | [PR #38](https://github.com/bongohorse/rider/pull/38), merge `67703b24d8d642fcfebc80c27f840a535b48a0d0`; [clean CI](https://github.com/bongohorse/rider/actions/runs/38746136550) at `2cba36d542e8cc7b27dfb2de7dd50a96e68088dd` PASS. Plan/contracts/history and all 22 issues (#16–#37) verified in five milestones (4/8/2/7/1) with five labels; [setup evidence](https://github.com/bongohorse/rider/actions/runs/38745300299). |
| S3 design brief v0 | Prepared; human confirmation pending | [Brief](docs/GAME_DESIGN.md), [PR #39](https://github.com/bongohorse/rider/pull/39): core loop, session, controls, fail/retry, differentiation and open choices. Claudio must read/confirm before M1; document integration does not grant this acceptance. |

## Preview and platform evidence

Authorized preview URL: https://bongohorse.github.io/rider/. A4 (#19) implements deployment; no gym preview/deployed SHA is claimed yet.

Reference phone: Xiaomi Mi 10T Pro / Android 12 / Snapdragon 865 / 2400×1080 / adaptive 30–144 Hz. Installed Android Chrome version and all actual gym device observations remain NOT RUN/unrecorded; collect in A13 (#28). This does not block independent browser gym work. [Platform matrix](docs/PLATFORM_MATRIX.md).

## Decisions / capability limits

- Branch protection update confirmed by Claudio and readable branch metadata: `required` is the sole required context, enforced for everyone. The full administration endpoint remains inaccessible; other settings rely on Claudio's saved configuration. No bypass used.
- Milestone/label connector limitation resolved through a one-time, least-privilege repository Action; its workflow is removed from the final tree. No account setting or extra token was needed.
- Bridge license provenance remains unresolved under explicit user implementation authorization; before Phase B app distribution remove the extension from release binaries and verify exclusion. [Contract](docs/contracts/automation/release.md).
- S3 confirmation and then milestone drive-test approvals remain human acceptance; never infer them from CI or a merge.

## Next authorized action

Obtain Claudio's reading/confirmation of the design brief v0. Suggested session length is 2–5 minutes; control layout and fair failure rules remain explicit test questions. Do not begin A1/M1 until approved. After each milestone, report preview URL, request the drive test and wait for next-milestone approval.
