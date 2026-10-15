# Rider status

Updated 2026-10-15. This is the sole current progress/blocker source; linked acceptance records describe only their tested historical commits.

## Current work

Preparation S1–S3 for the [Driving Gym plan](docs/PLAN.md). M1 has not started. G0–G2 are complete at their documented historical sources, not a gameplay acceptance.

| Step | State | Evidence / remaining acceptance |
| --- | --- | --- |
| S1 required CI aggregation | In review | [PR #15](https://github.com/bongohorse/rider/pull/15); negative propagation probe running; final restored head must pass. Claudio must select only `required` in main protection. Full enforcement acceptance remains pending until saved. |
| S2 issue/document migration | In preparation | English plan, contracts/history split and 22 issues A1–A22 (#16–#37) prepared/created. Five milestone objects and label setup are BLOCKED by missing connector creation functions; issues are not yet assigned to milestones. |
| S3 design brief v0 | NOT RUN | Prepare one-page brief and obtain Claudio's read/confirmation before M1. |

## Preview and platform evidence

Authorized preview URL: https://bongohorse.github.io/rider/. A4 (#19) implements deployment; no gym preview/deployed SHA is claimed yet.

Reference phone: Xiaomi Mi 10T Pro / Android 12 / Snapdragon 865 / 2400×1080 / adaptive 30–144 Hz. Installed Android Chrome version and all actual gym device observations remain NOT RUN/unrecorded; collect in A13 (#28). This does not block independent browser gym work. [Platform matrix](docs/PLATFORM_MATRIX.md).

## Decisions / capability limits

- Await Claudio's branch-protection update after the green S1 run; administration endpoint returns 403 for the integration. Do not bypass existing protection.
- The installed GitHub connector creates/updates issues but exposes no milestone/label creation operations. Complete these through an authorized alternative before marking S2 accepted.
- Bridge license provenance remains unresolved under explicit user implementation authorization; before Phase B app distribution remove the extension from release binaries and verify exclusion. [Contract](docs/contracts/automation/release.md).
- S3 confirmation and then milestone drive-test approvals remain human acceptance; never infer them from CI or a merge.

## Next authorized action

Finish S1–S3 preparation and report the concrete design brief for confirmation. Do not begin A1/M1 until approved. After each milestone, report preview URL, request the drive test and wait for next-milestone approval.
