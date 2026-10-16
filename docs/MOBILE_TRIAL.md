# M3 reference-phone trial

Device: Xiaomi Mi 10T Pro, Android 12. Use Android Chrome and the [public gym](https://bongohorse.github.io/rider/). Actual-device results remain open in STATUS.md; browser automation is synthetic evidence only.

## Touch and layout

- Open the preview in landscape. Touch mode is automatic; `?touch=1` forces it and `?touch=0` opens the full editor.
- Hold Throttle and either Lean button with two fingers. Hold both pedals to check braking priority. Brake near standstill to reverse.
- Try **Layout A · mirror** and **Layout B · mirror**. Compare comfort, accidental presses and readable space; neither layout is preselected as the winner.
- Retry while holding a zone; the vehicle must reset and wait for a fresh press. Drag a finger outside a zone and release. Rotate, switch tabs/apps and return; no stuck pedal or lean is allowed.
- **Tuning** opens the existing editor and hides driving zones. Close tuning to return. The compact HUD shows speed, frame metrics, preset and source SHA. Landscape is recommended for the detailed editor.

## Comparable phone captures

1. Record the installed full Chrome version from Chrome's About page. The report also requests browser client hints where available; reduced user-agent text alone may omit the full version.
2. Select 60 Hz in the phone settings. Use preset A and High DPI ON. In **Measure**, label the actual selected mode and press **Record 30 s**. Drive normally, retrying as needed. Copy the report after completion.
3. Repeat at 144 Hz with the same preset/quality. Confirm what the phone actually permits; an adaptive setting is not a verified locked rate.
4. Repeat 60 Hz with **High DPI OFF** for a cost comparison. The quality switch reloads the page; it does not change vehicle tuning.
5. Add visible stutter (none / occasional / frequent), responsiveness, layout preference, text readability and any audio issues. Compare both layouts; extra captures are useful only if they answer a concrete question.

Capture time is a measurement window, never a gym deadline. Rotation, focus loss, long frame interruption or opening tuning cancels an active capture. The report retains engine callback intervals (mean/p95/max), engine dt, physics profile, zero-profile counts, over-25-ms intervals, browser/source, viewport/DPR/quality, layout, preset/tuning and reset counts. It does not assert physical refresh, touch quality or fun. Zero profile samples may be below timing resolution.

The source/build report and actual observations determine concrete phone frame/physics budgets and whether interpolation is needed. No numeric physics budget or keep/drop decision is invented before this trial. The tilt trial below is required; finished-game retention is decided after Claudio tries it. Do not proceed to M4 without his approval.

## Tilt comparison (A14)

1. Open **Tilt → Enable tilt**. Allow motion access if Chrome requests it. If the page reports unavailable, denied or no data, use touch and report the exact outcome; that is not a successful tilt trial.
2. Hold the phone in a comfortable neutral position and tap **Calibrate neutral**. The panel closes; drive with Throttle and tilt gently left/right. The HUD shows normalized tilt input.
3. Adjust **Full lean angle** (smaller angle = more sensitive) and **Dead zone** if needed; **Invert** reverses the direction. Opening settings suppresses tilt commands while editing; close it to try the change. Touch lean buttons and keyboard lean take priority, including two opposing buttons giving neutral input.
4. Retry, rotation, focus loss or app/tab switching pauses tilt. Calibrate again before it resumes. Disable tilt to compare directly with touch under the same preset and DPI setting.
5. Copy the report and add: tilt direction correct, comfortable full-lean angle/dead zone, accidental leaning, touch vs tilt preference, and **keep / tune / drop** recommendation. The report includes sensor mode, calibration and candidate settings. Default settings are trial values, not a retention decision.

Only initial sensor acquisition times out. Valid orientation may remain unchanged without new events (the W3C event model fires on significant changes), so sample age alone does not prove a failure. The flat gym tests input/comfort and ground assistance; ramps and actual airborne feel remain M4. No sensor, actual-device or keep/drop acceptance is inferred from synthetic CI.
