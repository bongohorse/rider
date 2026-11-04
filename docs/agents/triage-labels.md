# Triage roles in Rider

[docs/ISSUES.md](../ISSUES.md) is authoritative. Use its existing type, area, priority and status labels. This mapping introduces no labels.

| Skill role | Rider handling |
| --- | --- |
| `needs-triage` | Use `status: needs go` for issues awaiting maintainer evaluation and GO. |
| `needs-info` | No exact label equivalent. Record outstanding information in the issue body or a clearly visible checklist; preserve the applicable Rider status. |
| `ready-for-agent` | Use `status: ready` only after verifying an explicitly recorded GO and resolved dependencies. |
| `ready-for-human` | No exact label equivalent. Record required human actions in the issue body or a clearly visible checklist. Use `status: needs drive test` only for actual acceptance testing. |
| `wontfix` | Close as **not planned**, with the explanation required by the issue guide. |

The role names in the first column are skill vocabulary, not labels to create or apply.

Triage does not authorize implementation or claim ownership. Preserve Rider's coordinator and approval authority. Starting work requires the GO and ownership procedure in the issue guide, including assignment, a named branch and worktree, an owner comment and `status: in progress`.

Human acceptance remains with Claudio. Triage cannot substitute for drive tests, device checks or art direction.

If a skill requires a label operation with no exact Rider equivalent, use the documented body/checklist handling above. Propose any additional workflow change before applying it.
