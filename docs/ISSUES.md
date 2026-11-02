# Issue guide

How Rider issues are structured, labelled, ordered and kept short. Applies to humans and agents. [PLAN.md](PLAN.md#work-order) holds the current work order; [STATUS.md](../STATUS.md) holds progress and recorded GOs.

**Contents:** [Kinds and hierarchy](#kinds-and-hierarchy) · [Required sections](#required-sections) · [Length](#length) · [Labels](#labels) · [Milestones and order](#milestones-and-order) · [GO, owner and status](#go-owner-and-status) · [Titles](#titles) · [Updating and closing](#updating-and-closing) · [Checklist](#checklist)

## Kinds and hierarchy

| Kind | Purpose | Delivered by | Template |
| --- | --- | --- | --- |
| Epic | Outcome that needs several PRs | Its sub-issues; never a PR of its own | [epic](../.github/ISSUE_TEMPLATE/epic.md) |
| Task | One reviewable change | Exactly one PR (`Closes #n`) | [task](../.github/ISSUE_TEMPLATE/task.md) |
| Bug | Observed or source-proven defect | One PR with a failing-before test | [bug](../.github/ISSUE_TEMPLATE/bug.md) |
| Experiment | Measure or compare before deciding; keep/drop result | One PR or report; ends with a decision | [experiment](../.github/ISSUE_TEMPLATE/experiment.md) |
| Decision | Question only the maintainer can answer | A recorded answer, then close | — (label `decision`) |

- Use GitHub **sub-issues**: every task, bug or experiment that belongs to an outcome is a sub-issue of its epic. Two levels at most (epic → task); a task that needs its own children is an epic.
- Do not keep checkbox task lists of issue numbers in epic bodies; the sub-issue panel shows progress. Order sub-issues in the panel in the intended work order.
- Audits and reviews produce findings; each actionable finding becomes a bug or task under the epic it belongs to, not a long comment thread.
- Standalone tasks without an epic are fine for small chores.

## Required sections

**Task / bug / experiment** (missing sections make an issue not ready for a GO):

1. **Goal** — one or two sentences: what becomes playable, measurable or safer, and why now.
2. **Scope** — what changes; name the files/modules or contracts touched.
3. **Out of scope** — what a worker must not do, with the issue that owns it.
4. **Acceptance** — 1–3 checkboxes, each observable and testable (named Gym case, unit test, CI job or drive step).
5. **Verification** — exact local commands and CI jobs; what remains NOT RUN (device, human). See the [evidence policy](contracts/evidence.md).
6. **Drive test** — `no`, or the exact steps Claudio performs.
7. **Depends on** — issue numbers that must be closed first, or `none`.
8. **Size** — S (≤ ½ day), M (≤ 2 days), L (split it).

Bugs add **Reproduction** (minimal steps or source lines on a pinned SHA) and **Impact**. Experiments add the **Hypothesis**, the **measurement protocol** and the **keep/drop rule**.

**Epic**: Outcome · Why · Sub-issue order (one line per step, referencing the dependency chain) · Out of scope · Done when · Links to contracts/reports. No implementation details; those belong to tasks or docs.

## Length

| Kind | Target | Too short | Too long |
| --- | --- | --- | --- |
| Task / bug | 25–80 lines (≈1.5–5k chars) | No acceptance, no out-of-scope, no verification | Contains evidence logs, design essays or several deliverables |
| Epic | ≤ 50 lines (≈4k chars) | No done-when | Repeats sub-issue specs or history |

Long research, design or evidence goes into a doc under `docs/` (link it) or the PR. History stays in the issue edit history and comments; the body is the **current** spec only.

## Labels

Every open issue has exactly one **type**, at least one **area**, one **priority** and one **status** label.

| Group | Labels |
| --- | --- |
| Type | `epic` · `feature` · `bug` · `chore` (tooling, CI, docs, refactor) · `experiment` · `decision` |
| Area | `gameplay` · `editor` · `physics` · `rendering` · `mobile` · `camera` · `persistence` · `ci` · `tooling` · `security` · `dependencies` · `docs` |
| Priority | `P0` broken main/data loss · `P1` next · `P2` soon · `P3` later/backlog |
| Status | `status: needs go` · `status: ready` (GO recorded, dependencies done) · `status: in progress` · `status: blocked` · `status: needs drive test` |

Area `docs` covers documentation, process and acceptance planning. `tooling` is also used by the nightly CI alert; `dependencies`/`major-update` by Renovate, whose Dependency Dashboard (#4) is exempt from priority/status/milestone. `duplicate` marks duplicates; `driving-gym` marks historical phase-A issues only.

## Milestones and order

Milestones are ordered **waves**, named `W1 …`, `W2 …`. Work the lowest open wave first; inside a wave follow priority and the dependency chain. Backlog epics without a GO stay in `Backlog`. The authoritative order and its reasons are in [PLAN.md — Work order](PLAN.md#work-order).

## GO, owner and status

- A GO is recorded as a comment on the issue (`GO: Claudio YYYY-MM-DD — <quote or link>`), mirrored in STATUS.md as AGENTS.md requires, and the label becomes `status: ready`.
- When work starts the owner comments `Owner: <agent> · branch <name> · PR #n`, and the label becomes `status: in progress`. One writing owner per issue.
- After merge, an issue that needs a drive test stays open with `status: needs drive test` and the steps in its Drive test section; otherwise the PR closes it.
- Blocked: label `status: blocked` plus one comment with the blocker and the issue that resolves it.
- A coordinator appointed by Claudio (currently the studio Director, [#333](https://github.com/bongohorse/rider/issues/333)) maintains these labels and owners; its former `RIDER-STUDIO` body footer is replaced by them.
- `P0` interrupts the wave order: the next free writer takes it.

## Titles

`[Area] Imperative outcome` in ≤ 80 characters, for example `[CI] Run persistence regressions in the pinned Defold engine`. Epics: `[Area] … (epic)`. No priority, status, wave, owner or agent names in titles; labels carry them.

## Updating and closing

- When scope changes, edit the body and add one dated line under **Notes** (`2026-11-02: split X into #n`); do not append the whole discussion.
- Close as **completed** by the PR, or as **not planned** with one sentence why and, if superseded, the replacing issue. Duplicates: label `duplicate`, link the original.
- Watch issues (flaky observations) close after 14 days without recurrence; reopen with the new CI link if it recurs.

## Checklist

Before creating or GO-requesting an issue: search for duplicates · pick the kind and template · attach it as a sub-issue of its epic · add type/area/priority/status labels and a milestone · acceptance is 1–3 testable checkboxes · verification and drive-test sections are filled · dependencies are issue numbers · the body fits the length targets.
