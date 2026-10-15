# Approved G1 toolchain

Canonical machine record: [toolchain-lock.json](../tools/toolchain-lock.json).

Defold/Bob **1.14.0**, engine `a81dbb0478e8b73931dc2d671563204f6ac0ef82`, integrated **Box2D 3.1.0**, JDK **Eclipse Temurin 25.0.4.1+1**. Bob is independently hashed on every build. CI's setup-java selector accommodates its version parser; `build.py` verifies the exact effective Temurin build and fails if that selector resolves differently. Such a failure requires a reviewed toolchain update, not automatic acceptance of another JDK.

The [G1 baseline run](https://github.com/bongohorse/rider/actions/runs/38697533465) passed all eight physics cases in both configurations on Linux headless, Windows headless and HTML5 debug. Browser: Playwright 1.64.1, Chromium 156.0.8078.4. Native graphics/input and Android install/device behavior are not approved by this evidence. Automation Bridge is not part of this lock yet.

The manifest selects only integrated Defold physics libraries. Extender already rebuilds the engine in G1. Its returned source/version and platform logs are retained with each build; no custom physics SDK is substituted. Runner labels fix the OS family, while each CI run records the actual image.

Version changes require review and rerunning affected platform cases. G2 extends this record only after Bridge/native-wrapper and release-boundary evidence passes.
