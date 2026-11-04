# Issue tracker: GitHub

Issues and specs live in GitHub Issues in `bongohorse/rider`. Use the `gh` CLI and explicitly target this repository.

Before creating, updating, ordering or closing issues, read [the issue guide](../ISSUES.md). It is authoritative for templates, hierarchy, labels, milestones, dependencies, GO records, ownership and closure. [PLAN.md](../PLAN.md) defines work order and stop points. [AGENTS.md](../../AGENTS.md) defines the shared agent workflow.

Useful read operations:

- Verify the target: `gh repo view bongohorse/rider --json nameWithOwner`.
- Read an issue: `gh issue view <number> --repo bongohorse/rider --json number,title,body,labels,comments,assignees,milestone`.
- List issues: `gh issue list --repo bongohorse/rider --state open`.

When a skill says “publish to the issue tracker”, create or update a GitHub issue following the issue guide. When it says “fetch the relevant ticket”, read the issue, its comments and its owning epic, if any.

Live state belongs on GitHub. Repository documents hold rules, contracts and decisions, as defined in AGENTS.md.

**PRs as a request surface: no.** GitHub Issues remain the authoritative task tracker. PRs remain valid for implementation, code review, verification evidence and merge coordination.
