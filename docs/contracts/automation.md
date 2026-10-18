# Automation and test contract

Rules for the test CLI, engine/runner protocol and automation interfaces. Native Bridge specifics are in [bridge.md](bridge.md); commands in [TOOLING.md](../TOOLING.md).

**Contents:** [Interfaces](#interfaces) · [Test CLI and results](#test-cli-and-results) · [Engine/runner protocol](#enginerunner-protocol) · [Release boundary](#release-boundary)

## Interfaces

1. **Editor HTTP API:** resources, builds and editor tasks for an open project; the running editor's `/openapi.json` is authoritative. Experimental; no editor session is assumed.
2. **Engine service:** a dynamic port per running debug engine (`/ping`, `/info`); not the editor API. Release must not expose debug services.
3. **Automation Bridge:** pinned debug native extension with versioned inspection/input/screenshot routes. Negotiate actual capabilities; it is neither HTML5 browser automation nor a physics binding.

Official Bob/HTTP automation is the standard path; community MCP is optional. Observe the owned process's port instead of hardcoding or scanning. Keep debug services private to the trusted development host; never publish them.

## Test CLI and results

`doctor`, `verify` and `build` ([TOOLING.md](../TOOLING.md#commands)) share Bash and PowerShell wrappers.

- Exit 0 PASS, 1 FAIL, 2 BLOCKED. BLOCKED is never green.
- Finite timeouts per case and suite, including child processes; partial results stay incomplete.
- Save stdout/stderr, config, exact SHA/engine/backend and failure screenshots in ignored artifacts. Emit JSON v1 and JUnit with relative paths.
- Define the mandatory inventory before running. Zero cases, missing results, invalid files or early exit cannot pass. Check JSON, JUnit, exit code and expected IDs together.
- Intentional source-error tests run in isolated copies, restore exact bytes, rebuild and verify the original tree is unchanged.

JSON includes schema version, suite, source commit, platform, Defold/backend identity, status and tests with ID/status/duration/assertions/artifacts. Mark unmeasured values explicitly.

## Engine/runner protocol

The G1 and gym runners transport newline JSON events prefixed `RIDER_G1` through native logs and the HTML5 console (a Rider convention, not an engine API).

1. The runner creates a unique run ID and fresh process/page/log context and passes it via a supported path.
2. `suite_start` carries protocol version, run ID, suite, build identity and expected case IDs/count.
3. Each `case` carries run ID, unique test ID, status, assertions, measurements and errors.
4. Exactly one `suite_end` confirms run ID, completed count and totals.
5. Success requires every mandatory case and no runtime errors; missing completion, timeout, duplicates or contradictions fail.
6. Stale/foreign run IDs are diagnosed and cannot create success.
7. Completion is event-based, never a fixed wait; the runner then shuts down its process/context/server, also on timeout.

Keep the negative collector tests (old IDs, absent/duplicate completion, zero/partial cases, source mismatch).

## Release boundary

- Install the Bridge wrapper only from the exact pinned source; never run uncontrolled "Latest" updates.
- Before any app distribution (Phase B): move the Bridge dependency to debug-only settings and prove it is absent from release dependencies and binaries (no Lua module, debug IDs or listeners). The started-release negative test alone does not prove binary exclusion. HTML5 already clears the native dependency.
- Missing upstream license metadata is neither a grant nor a prohibition; the maintainer's implementation authorization is recorded in [bridge.md](bridge.md#limits-and-license).
- Minimum GitHub permissions; no production secrets for untrusted PRs; redact CI output.
