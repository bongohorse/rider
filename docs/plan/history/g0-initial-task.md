> Historical G0-only prompt. G0 is complete; this is not the current execution scope.

[Documentation index](../../README.md)

# 12. Verbindliche erste Arbeitsanweisung für Codex (nur G0)

```text
PROJECT: New Buggy Lab (repository: bongohorse/rider)
TASK: G0 — New repository and verifiable toolchain foundation

Do NOT edit bongohorse/buggy and do NOT import old game code.

1. Inspect actual GitHub capabilities. Create the new repository if authorized.
   If repo creation is unavailable, STOP with the exact minimum user action.
   Local bootstrap alone does NOT mean G0 passed.
2. Establish a clean default branch, development branch and draft PR.
3. Prepare repository bootstrap only: minimal documentation,
   .gitignore, .gitattributes, .editorconfig, README and AGENTS.md.
   Do NOT create game.project, an app manifest or a runnable Defold project.
   Those belong to G1.
4. Record Defold 1.14.0, compatible Bob, OpenJDK 25 and Automation
   Bridge 2.5.0 as CANDIDATES, not as verified common pins.
5. Verify candidate source tags, checksums, license and platform scope.
6. Create doctor scripts for Windows/CI and minimal real bootstrap CI.
   Separate G0 script correctness from missing tools required in later gates.
   Record native buildserver/network requirements without implementing G2.
7. Add Renovate with controlled dependency discovery and updates.
   Verify app access and at least one actual scan against existing dependencies.
   Missing app permissions or scan evidence remain BLOCKED.
   Do not approve untested major upgrades or runner migration.
8. Create one concise G1 acceptance template for Box2D v3, Wheel Joint,
   units, ownership, lifecycle, reset and early Android debug build.
   Include the 60 Hz baseline and four substeps as a candidate to verify.
   Engine/Bob/JDK pins follow G1; Bridge pin follows G2.
   Official CLI/HTTP automation is permitted; community MCP is optional.
   Document Collision Object body ownership, joint cleanup, explicit Lua
   session state and the acceptance contract for a G1 smoke runner.
   Do NOT implement that runner in G0.
   Record who can actually execute each platform test; never assume
   local Windows/editor or Android access from a cloud environment.
9. Test everything actually testable in G0 and capture real evidence.
10. Return a concise gate report with exact SHAs, PR, CI URL,
    PASS/FAIL/BLOCKED counts and reasons.

Hard rules:
- Do not begin G1.
- Do not implement vehicle gameplay, Sandbox UI or production assets.
- Do not install a custom Box2D extension.
- Never claim a test passed without execution evidence.
- Fix ordinary in-scope errors autonomously; stop dependent work for
  structural blockers requiring a scope or technology decision.
- Respect existing authorizations; do not infer permission for G1.
- Do not merge or deploy without separate authorization.

STOP after G0 and request review/merge decision.
```

---

