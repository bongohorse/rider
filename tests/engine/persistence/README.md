# Pinned Defold persistence harness (#385, Stage 1)

**Contents:** [Purpose](#purpose) · [Run](#run) · [Evidence and limits](#evidence-and-limits) · [Stage 2](#stage-2)

## Purpose

This is a **test-only** bootstrap collection, not a gameplay feature. The regular
`game.project` and production boot collection are unchanged. The runner selects
one of the existing, unmodified tests `tests/gameplay/best.lua` and
`tests/gameplay/coin_bank.lua` per **new Defold engine process**. These tests
exercise production `main.gym.custom.slot_store` with injected `sys.load`,
`sys.save` and `json` substitutes. They do **not** prove native disk EIO,
browser IndexedDB durability, or Android persistence.

Each case must execute its actual Lua module and emit the expected number of
`PASS` groups (best: 4; coin_bank: 3). The bootstrap prints exactly one
`RIDER_PERSISTENCE` JSON completion marker containing source commit, run ID,
Defold engine version and build SHA, case name, count and status, then exits
with a nonzero code on failure. A separate process avoids leaked `sys`,
`json`, `package.preload` and `require` cache state.

## Run

From a **clean Rider checkout** with the locked **Temurin 25.0.4.1+1** on
`PATH` and Bob/build dependencies available:

```sh
python tools/g2/persistence_385.py --output artifacts/persistence-385
```

Choose a fresh, empty output path for each invocation. Optional:
`--cases best` or `--cases coin_bank`, and `--timeout 45`.
This calls `tools/g1/build.py:build("x86_64-linux", ..., variant="headless")`,
which checks the pinned JDK, Bob SHA-256, extender engine identity and
`main/physics.appmanifest`; no unguarded stock-engine fallback is accepted.
The test-only `persistence.settings` overrides just `bootstrap.main_collection`.
The native executable runs with `--config=rider.persistence_case=...`,
`rider.source_sha` and `rider.run_id`.

The runner fails closed on a dirty source tree, missing/duplicate completion
marker, wrong source/engine/run identity, unexpected PASS count, nonzero exit,
timeout, invalid JSON, or changed source during build. Inspect
`result.json`, `best.log`, `coin_bank.log`, `toolchain.json`,
`engines.json`, and `build.log`. A successful build **alone** is not a
successful test run.

## Evidence and limits

At creation, this environment has **OpenJDK 21.0.12.1**, not the required
Temurin 25.0.4.1+1; it has no local Rider checkout and cannot reach
`github.com` from its container. Therefore a real pinned Bob build or Defold
runtime result has **not** been executed here. This is implementation pending
engine proof, not a claimed PASS. The production-slot-store tests are already
present on `main`, but they substitute file APIs.

The new branch-only tests `tests/gameplay/coin_bank_recovery.lua` (PR #383)
and `tests/gameplay/run_best_pending.lua` (PR #384) are **not on main** and
are intentionally **not referenced** by this build. They use a stubbed
`custom.slot_store` boundary, not the production adapter. They need separate
pinned-engine executions after a coordinated, source-identified integration;
no branch content is copied into this PR. Failing-before vs passing-after
Defold evidence is also **NOT RUN**.

Official references consulted: [Defold automated testing](https://defold.com/manuals/automated-testing/),
[Bob project builder](https://defold.com/manuals/bob/),
[Defold 1.14.0 System API](https://defold.com/ref/sys-lua/).

## Stage 2

Required-CI wiring and the two branch-only failure-injection suites are
**blocked** until #369's exclusive workflow owner explicitly hands off
`.github/workflows/g1.yml` and the relevant storage branches are coordinated.
Do not treat a generic green `required` job as proof this harness ran.
Independent QA, current-head CI, and maintainer merge authorization remain
mandatory.
