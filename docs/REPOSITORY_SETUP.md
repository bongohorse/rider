# Repository operations

[Current status](../STATUS.md) · [Plan](PLAN.md) · [Tooling](TOOLING.md)

## CI and branch protection

S1 introduces one `required` job in CI. It depends on Bootstrap (all OS matrix entries), Renovate validation/extraction and reusable physics, tooling/Android and native Bridge workflows. CI runs for pull requests and pushes to main; reusable workflows also support manual dispatch. `required` uses `always()` and accepts only success from every dependency, so failure, cancellation or skip cannot pass.

Use **only `required`** as the required status check for main; preserve force-push/deletion protections and the other saved settings. Do not bypass protection to merge. The negative physics-to-required run is [38743590528](https://github.com/bongohorse/rider/actions/runs/38743590528). Claudio saved the protection update on 2026-10-15; branch metadata readback confirms context `required`, Actions app 15368 and enforcement `everyone`. Full administration endpoint access remains unavailable (403); the remaining settings rely on Claudio's saved configuration.

A produced APK alone is not installation evidence. Android build failure now exits nonzero; the tooling workflow additionally verifies APK signature/manifest. Never weaken assertions, suppress failure or treat BLOCKED as green.

## Issues and milestones

PLAN.md defines M1–M5 and A1–A22, one issue per PR with 1–3 testable acceptance criteria. The task issue template records goal, scope, exclusions, criteria, drive-test need, dependencies and contract/API risks. Use actual issue-number links for dependencies; milestone approval is an additional dependency even when technical predecessors are complete.

The installed connector has no direct milestone/label creation operation. A reviewed one-time repository Action with `issues: write` created five milestones and labels, assigned the 22 known issues and verified their identities/assignments. [Setup run](https://github.com/bongohorse/rider/actions/runs/38745300299): milestone issue counts 4/8/2/7/1; labels `driving-gym`, `physics`, `mobile`, `tooling`, `experiment`. The temporary workflow is removed from the final tree. No account permission change or extra personal token was required.

## Renovate and pins

Hosted Renovate activity is evidenced by [dashboard #4](https://github.com/bongohorse/rider/issues/4). Keep no automerge and separate major/runner/engine updates. `npm run renovate:validate` checks config; `npm run renovate:scan` performs local extraction with the pinned Renovate engine. Retain extraction logs for github-actions/npm/pip. Local extraction/config validity is not proof of hosted installation, available-version lookup or Defold update coverage.

## Preview and distribution

Public HTML5 preview at https://bongohorse.github.io/rider/ is permanently authorized for main-merge auto deployment and manual dispatch. A4 implements it with visible source SHA and unique per-build filenames. Do not claim a deployed build before observing it. Android release is Phase F; iOS builds wait until Phase G. The native Bridge must be excluded from distributed apps before Phase B sideload/distribution.

## Evidence retention

Generated logs/reports/builds stay ignored; CI retains artifacts for 14 days. Commit small summaries and immutable source/run links, not binary evidence dumps. Keep current status only in STATUS.md; historical acceptance records remain under docs/history.
