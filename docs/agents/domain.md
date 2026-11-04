# Domain docs

Use a single-context layout. Existing Rider documentation remains authoritative: start with [the documentation index](../README.md), then read the relevant sections of [PLAN.md](../PLAN.md) and the contracts it routes to.

Before exploring a domain:

- Read the root `GLOSSARY.md`, if present.
- Read relevant decisions in `docs/adr/`, if present.
- Read the existing documentation relevant to the task.

If the glossary or ADR directory is absent, proceed silently. Create them only when a task genuinely needs to record resolved terminology or a new decision. Do not scaffold empty files or duplicate existing decisions.

Use established project terms in issues, proposals, code and tests. If a glossary exists, use its definitions. Raise unresolved terminology through the domain-modeling workflow.

Surface conflicts with existing decisions explicitly and follow Rider's decision authority before changing them. A glossary or ADR does not grant a GO or override existing contracts.

Keep live progress, owners, GOs, blockers and acceptance state on GitHub, following AGENTS.md and the issue guide.
