# Platform matrix — G3 entry preflight

[Documentation index](README.md) · [G3 acceptance](G3_ACCEPTANCE.md)

The binding [platform policy, section 4.1](plan/platforms.md) requires concrete Android device/OS/browser identities before G3. Do not infer these from emulation, a desktop user agent or an APK build target.

| Target | Observed environment | Verified evidence | G3 state |
|---|---|---|---|
| Windows native | GitHub windows-2025, Defold 1.14.0 ordinary debug, pinned Mesa 26.2.4 software OpenGL | Full core physics in both configurations | Sandbox/UI checks NOT RUN |
| Linux graphics | Ubuntu 24.04, Xvfb/Mesa, native debug/release | Bridge identity, input effect, screenshots and started-release absence | Sandbox checks NOT RUN |
| Desktop HTML5 | Playwright 1.64.1 / Chromium 156.0.8078.4 | Browser physics/reset/scale suite; no native Bridge | G3 scene/resize/visibility checks NOT RUN |
| Android APK | arm64-capable debug APK; Android build-tools 37.0.0 | Build, signature, manifest PASS | Installation/touch/lifecycle NOT RUN |
| Real Android device | Model: NOT PROVIDED; Android version: NOT PROVIDED | Agent host has no adb on PATH and no /dev/bus/usb; this does not establish whether the user owns a device | Required baseline pending |
| Real Android Chrome | Device and Chrome version: NOT PROVIDED | Synthetic desktop touch is not real-device evidence | Required baseline pending |

Final G2 tested source: 10ed9c8fd56cd8d5cfd436ed1d4366ab85053270. [Platform CI](https://github.com/bongohorse/rider/actions/runs/38705035422), [Bridge CI](https://github.com/bongohorse/rider/actions/runs/38705035408), [Android/build-error CI](https://github.com/bongohorse/rider/actions/runs/38705035437). Runner labels identify image families; exact images are in the logs. Software graphics does not prove hardware performance.

## Required baseline

Record the physical test device model, installed Android version and Chrome version. Also establish whether the user can install the debug APK and perform a manual smoke, or later provide authorized ADB access. These values are not observable from this host. No external device address is probed or guessed.

Device installation, actual touch, rotation/Back, app/tab switching and frame-time measurements must be observed on the real target. This preflight neither passes those tests nor silently waives them.
