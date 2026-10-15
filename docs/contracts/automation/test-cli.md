# Common test CLI and results

Implemented entry points are documented in [TOOLING.md](../../TOOLING.md): doctor, verify and build, shared across Bash and PowerShell. Do not mistake their historical design contract for a claim they remain unimplemented.

- Exit 0 for PASS, nonzero for errors; missing/configuration prerequisites produce clear BLOCKED evidence. BLOCKED cannot be green mandatory CI.
- Set finite timeouts for each case and suite, including child processes; preserve partial results as incomplete.
- Save stdout/stderr, config, exact SHA/engine/backend and available failure screenshots in ignored artifacts. Emit JSON v1 and JUnit with relative artifact paths.
- Define mandatory test inventory before running. Zero discovered cases, missing mandatory results, invalid result files or early process exit cannot pass.
- Check JSON/JUnit, process exit and expected test IDs together. Do not suppress errors or print PASS without assertions.
- Intentional source-error tests run in isolated copies/worktrees; restore exact bytes and rebuild successfully, verifying the original tree is unchanged. A temporary PR CI-failure probe must be removed and the final head green before merge.

JSON includes schema version, suite, source commit, platform, Defold/backend identity, status and tests with ID/status/duration/assertion count/artifacts. Mark unmeasured values explicitly; collector verdict counts are not Lua predicate counts. [test-protocol.md](test-protocol.md) defines engine events.
