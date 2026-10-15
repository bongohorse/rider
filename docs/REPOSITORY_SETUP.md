# Repository operations and evidence

## Setup scope

G0 only. Repository initialization is a minimal README on main; implementation is reviewed in a bootstrap PR. No gameplay and no deployment. The user authorized repository setup and integration; stop before G1 regardless of merge.

## Renovate

`renovate.json` configures the hosted Renovate app with dashboard, conservative PR limits, no automerge and manual major approval. `npm run renovate:validate` checks configuration. `npm run renovate:scan` runs the real pinned Renovate engine in local extraction mode against this checkout. Save JSON debug logs to artifacts; they must show github-actions, npm and pip dependency extraction. This is a real extraction scan, not a hosted installation or available-version lookup claim.

Hosted installation/repository access and dashboard/PR activity are separate proofs. A valid config or local scan never proves hosted activation. Hosted defaults read main/onboarding config; do not claim a PR-only config is active. Once merged, inspect actual Renovate bot activity. If app access cannot be inspected/installed through available capabilities, report BLOCKED with the user-facing action: grant Rider access in the existing Renovate app installation.

Defold candidates in tools/toolchain-candidates.json are intentionally not auto-upgraded. At first real G1/G2 dependency introduction, add a verified manager/custom manager and demonstrate extraction before claiming Defold update coverage. No floating dependencies.

## Administration capability boundary

Check actual connector operations, not only the reported admin role. If branch-protection, repository settings, Pages or app installation cannot be changed through available authenticated tools, report that limitation explicitly. Never weaken checks to avoid missing privileges. Recommended main protection after first green run: require Bootstrap (ubuntu-24.04), Bootstrap (windows-2025), Renovate validation and scan; disallow force pushes/deletion. Do not require an unattainable second human reviewer for a solo repo without an explicit decision.

## Verified setup status — 2026-10-15

- Hosted Renovate is active: [Dependency Dashboard #4](https://github.com/bongohorse/rider/issues/4) lists the actual detected dependencies. No app-installation action is outstanding.
- The user saved main protection. A fresh branch metadata read confirms `protected=true`, all three expected required checks, GitHub Actions source app ID 15368 and enforcement level `everyone`.
- Full branch-protection endpoint access remains denied to this integration. PR requirement, up-to-date requirement, conversation resolution and force-push/deletion options rely on the user's saved settings and preceding screenshot; they are not separately asserted as API-verified.
- [G0 completion evidence](G0_COMPLETION.md). No G1 implementation or deployment has started.

## Evidence retention

Generated logs/reports/builds stay out of Git; CI artifacts retain bootstrap evidence for 14 days. Commit only small acceptance references and provenance. Reports link exact run and tested SHA. Long-lived gate sign-off summaries belong in docs with immutable source links, not giant binary commits.
