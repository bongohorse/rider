# Platform evidence matrix

[Current status](../STATUS.md) · [Platform strategy](PLAN.md)

| Target | Environment / identity | Evidence and limits |
| --- | --- | --- |
| Windows native CI | windows-2025, Defold 1.14.0 ordinary debug, pinned Mesa software OpenGL | G2 core physics; software rendering is not GPU performance evidence |
| Linux native CI | Historical G2 Ubuntu 24.04, Xvfb/Mesa, native debug/release | Bridge identity, input effect, screenshots and running-release negative check; not device evidence |
| Desktop HTML5 CI | Historical G2 Playwright 1.64.1 / Chromium 156.0.8078.4 | Browser physics/reset/scale suite; no native Bridge |
| User desktop browser | Windows 11, Microsoft Edge 155 (user supplied) | User environment identity only; gym/manual acceptance NOT RUN |
| Android APK | arm64 debug APK; historical G2 build-tools 37.0.0 | Build/signature/manifest evidence; installation/touch/lifecycle NOT RUN |
| Reference Android device | Xiaomi Mi 10T Pro; Android 12; Snapdragon 865; 6.67-inch LCD, 2400×1080 (20:9), adaptive 30–144 Hz (user supplied through revised plan) | Device identity supplied; no physical access established from agent host; runtime/performance NOT RUN |
| Android Chrome | Same reference phone; installed Chrome version not yet recorded | A13 records browser version and actual 60/144 Hz observations, frame times and interpolation decision; no emulation substitution |
| iOS | Phase G, after Play Store launch | No builds before then; device and Apple membership needed |

G2 tested source: `10ed9c8fd56cd8d5cfd436ed1d4366ab85053270`. [Physics CI](https://github.com/bongohorse/rider/actions/runs/38705035422), [Bridge CI](https://github.com/bongohorse/rider/actions/runs/38705035408), [Android/build-error CI](https://github.com/bongohorse/rider/actions/runs/38705035437). These are historical records, not new tests of the gym. Runner image versions are recorded in each run's logs.

A13 must record actual refresh mode, observed frame times/stutter and 20:9 layout, then establish concrete frame/physics budgets. The initial overlay target is 60 FPS. APK sideload is Phase B; full sustained-load testing with representative art and a weaker Android device is Phase E. Missing Chrome/version/device observations do not block independent browser gym work.

M3 presentation source `ceacf4d` passed required [38883421693](https://github.com/bongohorse/rider/actions/runs/38883421693). Chromium 156.0.8078.4 software browser: full-window DPR2 desktop sizes, 20:9 ↔ portrait emulation, all nine slider endpoint pairs/release, and projection proportions. Callback means at the comparison viewport: desktop DPR2 ON 37.736 ms / OFF 16.667 ms; phone emulation DPR1 ON 16.666 ms / OFF 16.667 ms. These are CI observations, not reference-phone budgets or human readability approval.

[Mobile trial procedure](MOBILE_TRIAL.md) records missing phone data. Capture JSON labels the refresh setting as user selected; browser callbacks do not prove the panel's physical refresh. Box2D profile samples of zero can be below timer resolution and cannot justify a zero-cost physics budget.
