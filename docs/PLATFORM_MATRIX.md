# Platform evidence matrix

Evidence per platform and the reference phone. Status values: [evidence policy](contracts/evidence.md); phone procedure: [MOBILE_TRIAL.md](MOBILE_TRIAL.md).

| Target | Environment / identity | Evidence and limits |
| --- | --- | --- |
| Windows native CI | windows-2025, Defold 1.14.0 ordinary debug, pinned Mesa software OpenGL | G2 core physics; software rendering is not GPU performance evidence |
| Linux native CI | Historical G2 Ubuntu 24.04, Xvfb/Mesa, native debug/release | Bridge identity, input effect, screenshots and running-release negative check; not device evidence |
| Desktop HTML5 CI | Historical G2 Playwright 1.64.1 / Chromium 156.0.8078.4 | Browser physics/reset/scale suite; no native Bridge |
| User desktop browser | Windows 11, Microsoft Edge 155 (user supplied) | M3 browser adjustments accepted by Claudio on 2026-10-16; no browser version recheck claimed |
| Android APK | arm64 debug APK; historical G2 build-tools 37.0.0 | Build/signature/manifest evidence; installation/touch/lifecycle NOT RUN |
| Reference Android device | Xiaomi Mi 10T Pro; Android 12; Snapdragon 865; 6.67-inch LCD, 2400×1080 (20:9), adaptive 30–144 Hz (user supplied through revised plan) | Claudio reports successful M3 phone testing and good tilt on 2026-10-16; qualitative acceptance, no numerical performance report |
| Android Chrome | Same reference phone; installed Chrome version not yet recorded | M3 phone driving/tilt accepted by Claudio; full version, actual 60/144-Hz modes, frame times and DPI cost not supplied |
| iOS | Phase G, after Play Store launch | No builds before then; device and Apple membership needed |

G2 tested source: `10ed9c8fd56cd8d5cfd436ed1d4366ab85053270`. [Physics CI](https://github.com/bongohorse/rider/actions/runs/38705035422), [Bridge CI](https://github.com/bongohorse/rider/actions/runs/38705035408), [Android/build-error CI](https://github.com/bongohorse/rider/actions/runs/38705035437). These are historical records, not new tests of the gym. Runner image versions are recorded in each run's logs.

M3 qualitative acceptance — 2026-10-16: Claudio tested in the browser and on his phone, is satisfied with the adjustments, says tilt works well and explicitly authorizes complete M3 closure. Tested public implementation: `6df34ecf4c0f79f7003bce96670cf6aec5a05125`, build `38962932203-1`; [main/public CI 38962932203](https://github.com/bongohorse/rider/actions/runs/38962932203) PASS, including twelve synthetic touch and twelve tilt cases. Human device evidence is user-reported, not agent-host physical access.

Closure exception owned by Claudio: accept M3 without the originally required full Chrome version, actual refresh settings/captures, phone DPI cost, concrete physics budget or measured interpolation decision. These remain NOT RUN / not supplied. Performance margins are unquantified; keep the initial 60 FPS / 16.666667 ms target, physics budget unset, High DPI ON and existing presentation without interpolation changes. Use the capture procedure if pacing problems arise; sustained representative-load testing remains Phase E. No specific mirrored-layout preference, detailed rotation/lifecycle result, audio listening or APK installation is inferred. APK sideload remains Phase B.

M3 presentation source `ceacf4d` passed required [38883421693](https://github.com/bongohorse/rider/actions/runs/38883421693). Chromium 156.0.8078.4 software browser: full-window DPR2 desktop sizes, 20:9 ↔ portrait emulation, all nine slider endpoint pairs/release, and projection proportions. Callback means at the comparison viewport: desktop DPR2 ON 37.736 ms / OFF 16.667 ms; phone emulation DPR1 ON 16.666 ms / OFF 16.667 ms. These are CI observations, not reference-phone budgets or human readability approval.

[Mobile trial procedure](MOBILE_TRIAL.md) records missing phone data. Capture JSON labels the refresh setting as user selected; browser callbacks do not prove the panel's physical refresh. Box2D profile samples of zero can be below timer resolution and cannot justify a zero-cost physics budget.

A13 final source `ce41b60` passed [required 38885765551](https://github.com/bongohorse/rider/actions/runs/38885765551): eleven synthetic release touch cases including fullscreen driving/editor release, a real 30-second browser capture and reviewed compact landscape/portrait views. This does not establish physical touch or phone performance. A14 local orientation mapping/normalization tests cover 0/90/180/270 degrees; injected browser orientation runtime results are tracked in its PR, separate from the subsequent qualitative phone acceptance above.
