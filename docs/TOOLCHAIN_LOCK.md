# Approved toolchain and native Bridge baseline

Canonical machine record: [toolchain-lock.json](../tools/toolchain-lock.json).

Defold/Bob **1.14.0**, engine `a81dbb0478e8b73931dc2d671563204f6ac0ef82`, integrated **Box2D 3.1.0**, JDK **Eclipse Temurin 25.0.4.1+1**. Bob is independently hashed on every build. CI's setup-java selector accommodates its version parser; `build.py` verifies the exact effective Temurin build and fails if that selector resolves differently. Such a failure requires a reviewed toolchain update, not automatic acceptance of another JDK.

The [G1 baseline run](https://github.com/bongohorse/rider/actions/runs/38697533465) passed all eight physics cases in both configurations on Linux headless, Windows headless and HTML5 debug. Browser: Playwright 1.64.1, Chromium 156.0.8078.4. Native graphics/input and Android install/device behavior are not approved by this evidence. Native Bridge baseline is now recorded below.

The manifest selects only integrated Defold physics libraries. Extender already rebuilds the engine in G1. Its returned source/version and platform logs are retained with each build; no custom physics SDK is substituted. Runner labels fix the OS family, while each CI run records the actual image.

Version changes require review and rerunning affected platform cases. G2 extends this record only after Bridge/native-wrapper and release-boundary evidence passes.

## Native Bridge / matching wrapper

Source release 2.5.0, immutable commit `567c7efb2f72626af71967984bd33dde856f0d36`, source archive SHA-256 `94807c707dd2814f5038fc26a9a20bcb4428a18b5e6d581d031507926a003958`. That exact tag supplies Python package 3.0.0, native-reported 2.0.0, actual API 2. Baseline native input/state/screenshot and started-release-negative evidence: [38701899289](https://github.com/bongohorse/rider/actions/runs/38701899289); shared CLI confirmation [38702661582](https://github.com/bongohorse/rider/actions/runs/38702661582). [Bridge details](BRIDGE.md) record version metadata inconsistency, the explicit user implementation instruction and unresolved license provenance.

Windows CI graphics uses independently pinned [Mesa source asset identity](../tools/ci-graphics-lock.json), only in disposable per-process copies. The engine remains the pinned Defold build; this adds no physics engine or production rendering dependency.
