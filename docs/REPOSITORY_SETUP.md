# Repository operations

[Current status](../STATUS.md) · [Plan](PLAN.md) · [Tooling](TOOLING.md)

## CI and branch protection

S1 introduces one `required` job in CI. It depends on Bootstrap (all OS matrix entries), Renovate validation/extraction and reusable physics, tooling/Android and native Bridge workflows. CI runs for pull requests and pushes to main; reusable workflows also support manual dispatch. `required` uses `always()` and accepts only success from every dependency, so failure, cancellation or skip cannot pass.

After the check has appeared, Claudio must select **only `required`** as the required status check for main, keeping force-push/deletion protections and the other saved settings. Do not bypass protection to merge. A red physics-to-required probe proves propagation; GitHub enforcement is a separate acceptance item until Claudio saves the new protection. Managed integration administration reads/writes are unavailable (the protection endpoint returns 403).

A produced APK alone is not installation evidence. Android build failure now exits nonzero; the tooling workflow additionally verifies APK signature/manifest. Never weaken assertions, suppress failure or treat BLOCKED as green.

## Issues and milestones

PLAN.md defines M1–M5 and A1–A22, one issue per PR with 1–3 testable acceptance criteria. The task issue template records goal, scope, exclusions, criteria, drive-test need, dependencies and contract/API risks. Use actual issue-number links for dependencies; milestone approval is an additional dependency even when technical predecessors are complete.

Milestone/label creation is not exposed by the installed connector. Its issue create/update functions can assign existing milestone numbers and labels, but cannot create them. Record incomplete setup honestly in STATUS.md and do not claim 22 issues are assigned to five milestones before verifying that state.

## Renovate and pins

Hosted Renovate activity is evidenced by [dashboard #4](https://github.com/bongohorse/rider/issues/4). Keep no automerge and separate major/runner/engine updates. `npm run renovate:validate` checks config; `npm run renovate:scan` performs local extraction with the pinned Renovate engine. Retain extraction logs for github-actions/npm/pip. Local extraction/config validity is not proof of hosted installation, available-version lookup or Defold update coverage.

## Preview and distribution

Public HTML5 preview at https://bongohorse.github.io/rider/ is permanently authorized for main-merge auto deployment and manual dispatch. A4 implements it with visible source SHA and unique per-build filenames. Do not claim a deployed build before observing it. Android release is Phase F; iOS builds wait until Phase G. The native Bridge must be excluded from distributed apps before Phase B sideload/distribution.

## Evidence retention

Generated logs/reports/builds stay ignored; CI retains artifacts for 14 days. Commit small summaries and immutable source/run links, not binary evidence dumps. Keep current status only in STATUS.md; historical acceptance records remain under docs/history.
