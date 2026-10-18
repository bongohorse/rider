# Reference-phone trial

Device: Xiaomi Mi 10T Pro, Android 12, Android Chrome, [public gym](https://bongohorse.github.io/rider/). Reusable procedure for phone diagnostics and the performance capture due before Phase B. M3 was accepted on 2026-10-16 without these measurements ([platform matrix](PLATFORM_MATRIX.md)). Browser automation is synthetic evidence only.

**Contents:** [Touch and layout](#touch-and-layout) · [Coasting and HUD](#coasting-and-hud) · [Comparable phone captures](#comparable-phone-captures) · [Tilt comparison](#tilt-comparison)

## Touch and layout

- Open the preview in landscape. Touch mode is automatic; `?touch=1` forces it and `?touch=0` opens the full editor.
- Hold Throttle and either Lean button with two fingers. Hold both pedals to check braking priority. Brake near standstill to reverse.
- Try **Layout A · mirror** and **Layout B · mirror**. Compare comfort, accidental presses and readable space; neither layout is preselected as the winner.
- Retry while holding a zone; the vehicle must reset and wait for a fresh press. Drag a finger outside a zone and release. Rotate, switch tabs/apps and return; no stuck pedal or lean is allowed.
- **Tuning** opens the existing editor and hides driving zones. Close tuning to return. The compact HUD shows FPS/frame interval, speed, contact dots, spring travel and a small graph; the build SHA is dim at the bottom. Tuning contains A/B/C chips, crash/sound/copy actions and eleven sliders. P cycles presets; 1–9 select stations. Landscape is recommended for the detailed editor.

## Coasting and HUD

- Accelerate on flat ground and release Throttle. The buggy should slow down naturally; a short brake tap followed by no input must not leave it rolling indefinitely. Automated baseline: 5 m/s to below 0.1 m/s in 11.53 m; phone feel is still your observation.
- Confirm the default HUD leaves the vehicle/centre clear and text is readable. Open/close Tuning, adjust a slider, release outside it, then drive again. On short views the expanded editor scales to fit; extra toolbar buttons hide while editing.
- Report clipping, overlap, unreadable values or uncomfortable coast strength.

## Comparable phone captures

1. Record the installed full Chrome version from Chrome's About page. The report also requests browser client hints where available; reduced user-agent text alone may omit the full version.
2. Select 60 Hz in the phone settings. Use preset A and High DPI ON. In **Measure**, label the actual selected mode and press **Record 30 s**. Drive normally, retrying as needed. Copy the report after completion.
3. Repeat at 144 Hz with the same preset/quality. Confirm what the phone actually permits; an adaptive setting is not a verified locked rate.
4. Repeat 60 Hz with **High DPI OFF** for a cost comparison. The quality switch reloads the page; it does not change vehicle tuning.
5. Add visible stutter (none / occasional / frequent), responsiveness, layout preference, text readability and any audio issues. Compare both layouts; extra captures are useful only if they answer a concrete question.

Capture time is a measurement window, never a gym deadline. Rotation, focus loss, long frame interruption or opening tuning cancels an active capture. The report retains engine callback intervals (mean/p95/max), engine dt, physics profile, zero-profile counts, over-25-ms intervals, browser/source, viewport/DPR/quality, layout, preset/tuning and reset counts. It does not assert physical refresh, touch quality or fun. Zero profile samples may be below timing resolution.

The source/build report and actual observations determine concrete phone frame/physics budgets and whether interpolation is needed. No numeric physics budget is inferred from qualitative acceptance.

## Tilt comparison

1. Open **Tilt → Enable tilt**. Allow motion access if Chrome requests it. If the page reports unavailable, denied or no data, use touch and report the exact outcome; that is not a successful tilt trial.
2. Hold the phone in a comfortable neutral position and tap **Calibrate neutral**. The panel closes; drive with Throttle and tilt gently left/right. The HUD shows normalized tilt input.
3. Adjust **Full lean angle** (smaller angle = more sensitive) and **Dead zone** if needed; **Invert** reverses the direction. Opening settings suppresses tilt commands while editing; close it to try the change. Touch lean buttons and keyboard lean take priority, including two opposing buttons giving neutral input.
4. Retry, rotation, focus loss or app/tab switching pauses tilt. Calibrate again before it resumes. Disable tilt to compare directly with touch under the same preset and DPI setting.
5. Copy the report and add: tilt direction correct, comfortable full-lean angle/dead zone, accidental leaning, touch vs tilt preference, and **keep / tune / drop** recommendation. The report includes sensor mode, calibration and candidate settings. Default settings are trial values, not a retention decision.

Only initial sensor acquisition times out. Valid orientation may remain unchanged without new events (the W3C event model fires on significant changes), so sample age alone does not prove a failure. Use the stations (1–9, Next station) for ramps and air control. No sensor, actual-device or keep/drop acceptance is inferred from synthetic CI.
