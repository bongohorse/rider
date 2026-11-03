# Preset comparison: A vs W26 vs W30

Source `23b8696a196cec19b204363d786d067c0008ec0f`, 156.0.8078.4, one debug Gym bundle; synthetic desktop runs, not device evidence (real device: NOT RUN). Status: **FAIL**.

Every trial asserted its preset in telemetry and the station report, unmodified and comparable (seams: the station's own `comparable` is a measurement and shown as a row). Statuses: C climbed/cleared/completed, D done, F failed, L landed, S stuck/stalled, M missed. Δ is candidate − baseline. Tuning: values the station reports measured with.

## Failed runs

| Station | Run | Exit | Reason | Output |
| --- | --- | --- | --- | --- |
| ramps | 1-w26 | 1 | runner failed | `artifacts/presets114/runs/1-w26/ramps` |
| ramps | 2-w30 | 1 | runner failed | `artifacts/presets114/runs/2-w30/ramps` |

## ramps (`a16`)

Declared repeat tolerances: none declared; statuses must match.

**FAILED run(s): W26, W30** (see Failed runs); their cells read FAIL.

| Metric | A | W26 | Δ W26 | W30 | Δ W30 |
| --- | --- | --- | --- | --- | --- |
| ramps highest climbed (°) | 45 | FAIL | n/a | FAIL | n/a |
| ramps per-angle status | 5 C, 10 C, 15 C, 20 C, 25 C, 30 C, 35 C, 40 C, 45 C, 60 F, 90 F | FAIL | n/a | FAIL | n/a |
| ramps-long highest climbed (°) | 35 | FAIL | n/a | FAIL | n/a |
| ramps-long per-angle status | 5 C, 10 C, 15 C, 20 C, 25 C, 30 C, 35 C, 40 F, 45 F, 60 F, 90 F | FAIL | n/a | FAIL | n/a |
| descent down-10 speed gain (m/s) | 1.168 | FAIL | n/a | FAIL | n/a |
| descent down-20 speed gain (m/s) | 2.526 | FAIL | n/a | FAIL | n/a |
| descent down-30 speed gain (m/s) | 3.103 | FAIL | n/a | FAIL | n/a |

## gaps (`a19`)

Declared repeat tolerances: jump 0.05 m, takeoff 0.02 m/s, compression 0.005 m.

| Metric | A | W26 | Δ W26 | W30 | Δ W30 |
| --- | --- | --- | --- | --- | --- |
| widest cleared at 7 m/s (m) | 3 | 4 | +1 | 4 | +1 |
| 7 m/s ladder status | 1 C, 1.5 C, 2 C, 2.5 C, 3 C, 4 M, 5 M, 6 M, 8 M, 10 M | 1 C, 1.5 C, 2 C, 2.5 C, 3 C, 4 C, 5 M, 6 M, 8 M, 10 M | ≠ | 1 C, 1.5 C, 2 C, 2.5 C, 3 C, 4 C, 5 M, 6 M, 8 M, 10 M | ≠ |
| 7 m/s takeoff speed (m/s) | 6.015 | 6.633 | +0.618 | 6.746 | +0.731 |
| widest cleared at 9 m/s (m) | 4 | 4 | 0 | 5 | +1 |
| 9 m/s ladder status | 1 C, 1.5 C, 2 C, 2.5 C, 3 C, 4 C, 5 M, 6 M, 8 M, 10 M | 1 C, 1.5 C, 2 C, 2.5 C, 3 C, 4 C, 5 M, 6 M, 8 M, 10 M | = | 1 C, 1.5 C, 2 C, 2.5 C, 3 C, 4 C, 5 C, 6 M, 8 M, 10 M | ≠ |
| 9 m/s takeoff speed (m/s) | 6.372 | 7.243 | +0.871 | 7.722 | +1.350 |
| landing flat status | CLEARED | CLEARED | = | CLEARED | = |
| landing flat touchdown vy (m/s) | -3.900 | -4.016 | -0.116 | -4.261 | -0.361 |
| landing flat peak compression (m) | 0.273 | 0.278 | +0.004 | 0.300 | +0.027 |
| landing flat landing angle (rad) | -0.995 | -0.654 | +0.342 | -0.573 | +0.422 |
| landing down status | CLEARED | CLEARED | = | CLEARED | = |
| landing down touchdown vy (m/s) | -1.733 | -3.188 | -1.455 | -3.600 | -1.867 |
| landing down peak compression (m) | 0.176 | 0.211 | +0.035 | 0.236 | +0.060 |
| landing down landing angle (rad) | -0.484 | -0.516 | -0.031 | -0.473 | +0.012 |
| landing up status | CLEARED | CLEARED | = | CLEARED | = |
| landing up touchdown vy (m/s) | -3.235 | -3.188 | +0.047 | -3.104 | +0.132 |
| landing up peak compression (m) | 0.295 | 0.334 | +0.039 | 0.321 | +0.025 |
| landing up landing angle (rad) | -0.853 | -0.534 | +0.319 | -0.414 | +0.439 |

## air (`a19c`)

Declared repeat tolerances: takeoff 0.02 m/s, airtime 0.034 s, rotation 5°, landing angle 5°, compression 0.005 m.

| Metric | A | W26 | Δ W26 | W30 | Δ W30 |
| --- | --- | --- | --- | --- | --- |
| big lean 0 status | CRASHED | CRASHED | = | CRASHED | = |
| big lean 0 takeoff speed (m/s) | 5.593 | 6.797 | +1.204 | 7.272 | +1.679 |
| big lean 0 airtime (s) | 1.733 | 1.983 | +0.250 | 2.050 | +0.317 |
| big lean 0 rotation (°) | -151.187 | -179.651 | -28.464 | -216.990 | -65.803 |
| big lean 0 landing angle (°) | -94.440 | -136.353 | -41.913 | 175.298 | +269.739 |
| big lean 0 impact normal speed (m/s) | 7.356 | 12.456 | +5.100 | 14.980 | +7.625 |
| big lean +1 (back) status | CRASHED | CRASHED | = | CRASHED | = |
| big lean +1 (back) airtime (s) | 1.750 | 1.983 | +0.233 | 2.050 | +0.300 |
| big lean +1 (back) rotation (°) | 422.225 | 517.767 | +95.542 | 507.600 | +85.375 |
| big lean +1 (back) landing angle (°) | 116.472 | -158.935 | -275.407 | -175.112 | -291.584 |
| big lean +1 (back) impact normal speed (m/s) | 8.366 | 12.054 | +3.687 | 13.557 | +5.191 |
| big lean -1 (front) status | CRASHED | LANDED | ≠ | LANDED | ≠ |
| big lean -1 (front) airtime (s) | 1.750 | 1.967 | +0.217 | 2.017 | +0.267 |
| big lean -1 (front) rotation (°) | -639.003 | -729.715 | -90.713 | -760.045 | -121.042 |
| big lean -1 (front) landing angle (°) | 135.244 | 33.583 | -101.661 | -2.756 | -138.000 |
| big lean -1 (front) impact normal speed (m/s) | 7.796 | 11.891 | +4.095 | 13.482 | +5.686 |
| mid lean 0 status | CRASHED | LANDED | ≠ | CRASHED | = |
| mid lean 0 takeoff speed (m/s) | 5.593 | 6.797 | +1.204 | 7.272 | +1.679 |
| mid lean 0 airtime (s) | 1.267 | 1.483 | +0.217 | 1.550 | +0.283 |
| mid lean 0 rotation (°) | -113.178 | -128.868 | -15.690 | -161.400 | -48.223 |
| mid lean 0 landing angle (°) | -68.930 | -95.568 | -26.638 | -129.110 | -60.180 |
| mid lean 0 impact normal speed (m/s) | 6.539 | 9.969 | +3.430 | 10.374 | +3.835 |
| mid lean +1 (back) status | CRASHED | LANDED | ≠ | LANDED | ≠ |
| mid lean +1 (back) airtime (s) | 1.283 | 1.483 | +0.200 | 1.517 | +0.233 |
| mid lean +1 (back) rotation (°) | 221.998 | 315.491 | +93.493 | 290.211 | +68.214 |
| mid lean +1 (back) landing angle (°) | -93.754 | -11.209 | +82.545 | -42.498 | +51.256 |
| mid lean +1 (back) impact normal speed (m/s) | 6.203 | 9.724 | +3.521 | 10.382 | +4.179 |
| mid lean -1 (front) status | LANDED | CRASHED | ≠ | CRASHED | ≠ |
| mid lean -1 (front) airtime (s) | 1.300 | 1.483 | +0.183 | 1.550 | +0.250 |
| mid lean -1 (front) rotation (°) | -429.556 | -502.897 | -73.340 | -548.342 | -118.786 |
| mid lean -1 (front) landing angle (°) | -30.308 | -104.597 | -74.289 | -161.052 | -130.743 |
| mid lean -1 (front) impact normal speed (m/s) | 7.811 | 9.497 | +1.685 | 11.473 | +3.662 |

## Follow-ups

- throttle 0 to 5 m/s time and braking distance from 7 m/s: telemetry samples every 0.25 s and the straight station records no brake entry speed, so both need a small game-side read
