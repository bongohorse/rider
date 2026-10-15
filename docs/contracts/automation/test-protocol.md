# Engine/runner protocol

The existing G1 runner transports newline JSON events prefixed `RIDER_G1` through native logs and HTML5 console. This is a Rider convention, not a built-in engine test API. The [G1 verified contract](../physics/G1_CONTRACT.md) records actual run-ID injection per target.

1. The runner creates a unique run ID, fresh process/page/log context and passes identity via a supported documented path.
2. `suite_start` carries protocol version, run ID, suite, build/config identity and expected case IDs/count.
3. Each `case` carries run ID, unique test ID, status, assertions, measurements and errors.
4. Exactly one `suite_end` confirms run ID, completed count and totals matching the mandatory inventory.
5. Success requires every mandatory case, consistent completion and no crash/runtime errors. Missing completion, timeout, early exit, duplicates or contradictions fail/invalidate the run.
6. Ignore and diagnose stale/foreign run IDs; they cannot create success. A second end event is a protocol error.
7. Completion is event-based, never a fixed wait. Exit zero cannot compensate for a missing completion. After confirmation the runner shuts down its process/context/server, also on timeout.

Preserve negative collector tests for old IDs, absent/duplicate completion, zero/partial cases and source mismatch. The common CLI translates these into JSON/JUnit; avoid a larger bespoke framework. Target-specific ID transport is allowed, but event semantics stay identical.
