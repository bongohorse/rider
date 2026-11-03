# Pinned Defold persistence harness (#385)

**Contents:** [Purpose](#purpose) · [Run](#run) · [CI](#ci) · [Evidence and limits](#evidence-and-limits)

## Purpose

`tests/engine/persistence/` is a **test-only** bootstrap collection, not a gameplay feature. The regular `game.project` and production boot collection are unchanged; `persistence.settings` overrides only `bootstrap.main_collection`. The runner loads one `tests/gameplay/*.lua` persistence suite per **new Defold engine process** (no leaked `sys`, `json`, `package.loaded` or `require` state between suites):

| Case | PASS lines | Storage under test |
| --- | ---: | --- |
| `best` | 4 | production `custom.slot_store`, injected `sys`/`json` |
| `coin_bank` | 3 | production `custom.slot_store`, injected `sys`/`json` |
| `level_progress` | 1 | production `custom.slot_store`, injected `sys`/`json` |
| `run_best_pending` | 16 | stubbed `main.game.custom` slot store with injected EIO |
| `coin_bank_recovery` | 3 | stubbed `main.game.custom` slot store with injected EIO |
| `coin_bank_late_restore` | 7 | production `custom.slot_store`, injected `sys`/`json`, late IndexedDB restore |
| `my_levels_storage` | 8 | production My levels (`custom.library`), injected `sys`/`json`/`io.open`/`os.remove` failures |
| `slot_protection` | 5 | production `custom.slot_store`/`custom.save`, injected `sys`/`json`, newer-version slots |

The bootstrap prints exactly one `RIDER_PERSISTENCE` JSON completion marker (source commit, run ID, Defold engine version and SHA, case, PASS-line count, status) and exits non-zero on failure.

**Engine rule:** Defold 1.14.0's `require` ignores `package.preload` (one Defold loader). A suite that stubs a module must install it through `package.loaded[...]`; otherwise it silently exercises the real module inside the engine while still passing under plain LuaJIT. `tests/engine/persistence/test_protocol.py` enforces this for every harness suite.

Keep non-resource files such as this document **outside** `tests/engine/persistence/`: a `README.md` there made Bob 1.14.0 fail with `The files' relative path conflict` (`ExtenderUtil.checkProjectForDuplicates`).

## Run

From a **clean** checkout with the locked Temurin 25.0.4.1+1 on `PATH`:

```sh
python tools/g2/persistence_385.py --output artifacts/persistence-385
python -m unittest discover -s tests/engine/persistence -v   # protocol checks, no engine
```

Use a fresh, empty output path. Optional: `--cases best level_progress …`, `--timeout 45`. The launcher calls `tools/g1/build.py:build("x86_64-linux", …, variant="headless")` (pinned JDK, Bob SHA-256, extender engine guard, `main/physics.appmanifest`; no stock-engine fallback). It fails closed on a dirty tree, a missing or duplicate completion marker, wrong source/engine/run identity, an unexpected PASS count, a non-zero exit, a timeout, invalid JSON or a source change during the build. Inspect `result.json`, `<case>.log`, `toolchain.json`, `engines.json` and `build.log`; a successful build alone is not a test run.

## CI

The Linux `G1 native` job runs the protocol checks and then the harness for all eight suites, so `required` gates genuine pinned-engine execution. Output is uploaded with the job's `g1-x86_64-linux-<run>` artifact under `persistence/`.

## Evidence and limits

2026-11-02, local WSL x86-64, Temurin-25.0.4.1+1, Bob `90da8341…`, Defold 1.14.0 engine `a81dbb04`: with the P2 fixes (#390, #380, #381, #393) all six suites PASS; against the unpatched modules `level_progress`, `run_best_pending`, `coin_bank_recovery` and `coin_bank_late_restore` FAIL at their regression assertions while `best`/`coin_bank` PASS (PR #389/#391 comments).

These suites inject file/slot-store failures. They do **not** prove native disk EIO, browser IndexedDB durability or Android persistence. `tools/gameplay/lua_tests.py` (#395) runs the same suites under Bob's LuaJIT; that is cheaper but not the engine.

Official references: [Defold automated testing](https://defold.com/manuals/automated-testing/), [Bob project builder](https://defold.com/manuals/bob/), [Defold 1.14.0 System API](https://defold.com/ref/sys-lua/).
