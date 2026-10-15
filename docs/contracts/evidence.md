# Evidence and reporting

- PASS: every mandatory criterion claimed for this scope was executed and passed.
- FAIL: an executed mandatory check failed.
- BLOCKED: a mandatory check/action cannot run because a prerequisite or capability is missing; this never counts as success.
- NOT RUN: not executed; no acceptance is implied.
- DEFERRED: only an explicitly optional item postponed with its reason and decision.

Never invent test results, screenshots, device evidence or approval. Identify exact source SHA, test environment, commands, CI/evidence links and limitations in the PR. Distinguish PR-head, merged-main and deployed-build evidence. Build success does not prove installation, touch, lifecycle, performance or fun. Synthetic events do not prove physical-device behavior.

Keep current progress and blockers only in STATUS.md; immutable acceptance records may state their historical outcomes. For exceptions record the affected criterion, risk, owner and follow-up; leave the original test's actual status intact. Fix routine in-scope errors autonomously; structural blockers stop only affected work under PLAN.md.
