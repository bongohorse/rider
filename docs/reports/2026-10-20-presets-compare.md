> Car Feel 2 ([#200](https://github.com/bongohorse/rider/issues/200), PR [#207](https://github.com/bongohorse/rider/pull/207)): full A vs B/C/D/E comparison on merged main `a594495`. All seven stations ran in two parallel processes on one debug bundle; the tables were then combined (`--tables-only`). Preset F (#211, PR #213) was not merged when the run started and is not included. The A-vs-A repeat check (identical in every row) is in PR #207.
>
> **One failed run: C on steps.** A runner assertion that holds only for preset A stopped it, not the preset check. The steps `stop-probe` asserts "diagnostic stop must actually bottom" (compression 0.175–0.20 m). With C's 8 Hz spring the probe stayed STUCK and did not bottom (compression 0.134 m), so C's steps column reads FAIL. Balance under B ran after the #204 fix (#206). Synthetic desktop runs (Playwright Chromium, WSL2), not device evidence.

# Preset comparison: A vs B vs C vs D vs E

Source `a594495b9effe129266ca2066f6f80f088f294be`, 156.0.8078.4, one debug Gym bundle; synthetic desktop runs, not device evidence (real device: NOT RUN). Status: **FAIL**.

Every trial asserted its preset in telemetry and the station report, unmodified and comparable (seams: the station's own `comparable` is a measurement and shown as a row). Statuses: C climbed/cleared/completed, D done, F failed, L landed, S stuck/stalled, M missed. Δ is candidate − baseline. Tuning: values the station reports measured with.

## Failed runs

| Station | Run | Exit | Reason | Output |
| --- | --- | --- | --- | --- |
| steps | 2-c | 1 | runner failed | `artifacts/final/runs/2-c/steps` |

## Tuning

| Key | A | B | C | D | E |
| --- | --- | --- | --- | --- | --- |
| damping | 0.800 | 0.900 | 1.100 | 1 | 1 |
| lean_rate_max | 8 | 10 | 12 | 8 | 7 |
| motor_speed | -32 | -64 | -96 | -44 | -32 |
| camera_look_seconds | 0.220 | 0.280 | 0.320 | 0.260 | 0.220 |
| lean_torque | 48 | 72 | 96 | 72 | 44 |
| camera_response | 6 | 7 | 8 | 7 | 5 |
| drive_torque | 1800 | 2400 | 3000 | 2600 | 1800 |
| coast_torque | 400 | 400 | 400 | 400 | 900 |
| spring_hz | 5 | 6 | 8 | 6 | 4.500 |
| ground_lean_torque | 120 | 180 | 240 | 170 | 140 |
| brake_torque | 3000 | 3400 | 4000 | 3400 | 3000 |
| camera_zoom_min | 0.820 | 0.780 | 0.740 | 0.800 | 0.820 |

## ramps (`a16`)

Declared repeat tolerances: none declared; statuses must match.

| Metric | A | B | Δ B | C | Δ C | D | Δ D | E | Δ E |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ramps highest climbed (°) | 45 | 45 | 0 | 45 | 0 | 60 | +15 | 35 | -10 |
| ramps per-angle status | 5 C, 10 C, 15 C, 20 C, 25 C, 30 C, 35 C, 40 C, 45 C, 60 F, 90 F | 5 C, 10 C, 15 C, 20 C, 25 C, 30 C, 35 C, 40 C, 45 C, 60 F, 90 F | = | 5 C, 10 C, 15 C, 20 C, 25 C, 30 C, 35 C, 40 C, 45 C, 60 F, 90 F | = | 5 C, 10 C, 15 C, 20 C, 25 C, 30 C, 35 C, 40 C, 45 C, 60 C, 90 F | ≠ | 5 C, 10 C, 15 C, 20 C, 25 C, 30 C, 35 C, 40 F, 45 F, 60 F, 90 F | ≠ |
| ramps-long highest climbed (°) | 35 | 45 | +10 | 45 | +10 | 45 | +10 | 35 | 0 |
| ramps-long per-angle status | 5 C, 10 C, 15 C, 20 C, 25 C, 30 C, 35 C, 40 F, 45 F, 60 F, 90 F | 5 C, 10 C, 15 C, 20 C, 25 C, 30 C, 35 C, 40 C, 45 C, 60 F, 90 F | ≠ | 5 C, 10 C, 15 C, 20 C, 25 C, 30 C, 35 C, 40 C, 45 C, 60 F, 90 F | ≠ | 5 C, 10 C, 15 C, 20 C, 25 C, 30 C, 35 C, 40 C, 45 C, 60 F, 90 F | ≠ | 5 C, 10 C, 15 C, 20 C, 25 C, 30 C, 35 C, 40 F, 45 F, 60 F, 90 F | = |
| descent down-10 speed gain (m/s) | 1.168 | 1.164 | -0.004 | 1.149 | -0.019 | 1.162 | -0.006 | -1.042 | -2.210 |
| descent down-20 speed gain (m/s) | 2.526 | 2.512 | -0.014 | 2.499 | -0.028 | 2.516 | -0.011 | 1.717 | -0.810 |
| descent down-30 speed gain (m/s) | 3.103 | 3.120 | +0.017 | 3.084 | -0.019 | 3.126 | +0.023 | 2.565 | -0.538 |

## steps (`a17`)

Declared repeat tolerances: compression 0.005 m, entry speed 0.02 m/s.

**FAILED run(s): C** (see Failed runs); their cells read FAIL.

| Metric | A | B | Δ B | C | Δ C | D | Δ D | E | Δ E |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| highest climbed (m) | 0.150 | 0.150 | 0 | FAIL | n/a | 0.150 | 0 | 0.150 | 0 |
| steps status | 0.05 C, 0.1 C, 0.15 C, 0.2 S, 0.25 S, 0.3 S, 0.4 S, 0.5 S | 0.05 C, 0.1 C, 0.15 C, 0.2 S, 0.25 S, 0.3 S, 0.4 S, 0.5 S | = | FAIL | n/a | 0.05 C, 0.1 C, 0.15 C, 0.2 S, 0.25 S, 0.3 S, 0.4 S, 0.5 S | = | 0.05 C, 0.1 C, 0.15 C, 0.2 S, 0.25 S, 0.3 S, 0.4 S, 0.5 S | = |
| steps underbody contact | none | none | = | FAIL | n/a | none | = | none | = |
| steps 0.05 m compression (m) | 0.113 | 0.112 | 0.000 | FAIL | n/a | 0.113 | +0.000 | 0.128 | +0.015 |
| steps 0.1 m compression (m) | 0.139 | 0.131 | -0.009 | FAIL | n/a | 0.124 | -0.015 | 0.171 | +0.031 |
| steps 0.15 m compression (m) | 0.184 | 0.165 | -0.019 | FAIL | n/a | 0.165 | -0.019 | 0.213 | +0.029 |
| steps 0.2 m compression (m) | 0.224 | 0.200 | -0.023 | FAIL | n/a | 0.199 | -0.025 | 0.238 | +0.014 |
| steps 0.25 m compression (m) | 0.221 | 0.194 | -0.028 | FAIL | n/a | 0.200 | -0.021 | 0.237 | +0.016 |
| steps 0.3 m compression (m) | 0.221 | 0.194 | -0.028 | FAIL | n/a | 0.200 | -0.021 | 0.237 | +0.016 |
| steps 0.4 m compression (m) | 0.221 | 0.194 | -0.028 | FAIL | n/a | 0.200 | -0.021 | 0.237 | +0.016 |
| steps 0.5 m compression (m) | 0.221 | 0.194 | -0.028 | FAIL | n/a | 0.200 | -0.021 | 0.237 | +0.016 |
| steps-down status | 0.05 L, 0.1 L, 0.15 L, 0.2 L, 0.25 L, 0.3 L, 0.4 L, 0.5 L | 0.05 L, 0.1 L, 0.15 L, 0.2 L, 0.25 L, 0.3 L, 0.4 L, 0.5 L | = | FAIL | n/a | 0.05 L, 0.1 L, 0.15 L, 0.2 L, 0.25 L, 0.3 L, 0.4 L, 0.5 L | = | 0.05 L, 0.1 L, 0.15 L, 0.2 L, 0.25 L, 0.3 L, 0.4 L, 0.5 L | = |
| steps-down underbody contact | none | none | = | FAIL | n/a | none | = | none | = |
| steps-down 0.05 m compression (m) | 0.102 | 0.071 | -0.031 | FAIL | n/a | 0.069 | -0.033 | 0.118 | +0.016 |
| steps-down 0.1 m compression (m) | 0.118 | 0.084 | -0.034 | FAIL | n/a | 0.081 | -0.037 | 0.133 | +0.016 |
| steps-down 0.15 m compression (m) | 0.131 | 0.095 | -0.035 | FAIL | n/a | 0.093 | -0.038 | 0.148 | +0.017 |
| steps-down 0.2 m compression (m) | 0.141 | 0.105 | -0.037 | FAIL | n/a | 0.100 | -0.041 | 0.157 | +0.016 |
| steps-down 0.25 m compression (m) | 0.155 | 0.118 | -0.037 | FAIL | n/a | 0.110 | -0.045 | 0.170 | +0.015 |
| steps-down 0.3 m compression (m) | 0.162 | 0.122 | -0.040 | FAIL | n/a | 0.117 | -0.045 | 0.176 | +0.014 |
| steps-down 0.4 m compression (m) | 0.181 | 0.138 | -0.043 | FAIL | n/a | 0.132 | -0.049 | 0.192 | +0.011 |
| steps-down 0.5 m compression (m) | 0.198 | 0.153 | -0.045 | FAIL | n/a | 0.155 | -0.043 | 0.208 | +0.010 |

## gaps (`a19`)

Declared repeat tolerances: jump 0.05 m, takeoff 0.02 m/s, compression 0.005 m.

| Metric | A | B | Δ B | C | Δ C | D | Δ D | E | Δ E |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| widest cleared at 7 m/s (m) | 3 | 5 | +2 | 5 | +2 | 4 | +1 | 3 | 0 |
| 7 m/s ladder status | 1 C, 1.5 C, 2 C, 2.5 C, 3 C, 4 M, 5 M, 6 M, 8 M, 10 M | 1 C, 1.5 C, 2 C, 2.5 C, 3 C, 4 C, 5 C, 6 M, 8 M, 10 M | ≠ | 1 M, 1.5 M, 2 M, 2.5 M, 3 M, 4 M, 5 C, 6 M, 8 M, 10 M | ≠ | 1 C, 1.5 C, 2 C, 2.5 C, 3 C, 4 C, 5 M, 6 M, 8 M, 10 M | ≠ | 1 C, 1.5 C, 2 C, 2.5 C, 3 C, 4 M, 5 M, 6 M, 8 M, 10 M | = |
| 7 m/s takeoff speed (m/s) | 6.015 | 7.251 | +1.236 | 7.609 | +1.594 | 7.267 | +1.252 | 6.131 | +0.116 |
| widest cleared at 9 m/s (m) | 4 | 0 | -4 | 0 | -4 | 5 | +1 | 4 | 0 |
| 9 m/s ladder status | 1 C, 1.5 C, 2 C, 2.5 C, 3 C, 4 C, 5 M, 6 M, 8 M, 10 M | 1 M, 1.5 M, 2 M, 2.5 M, 3 M, 4 M, 5 M, 6 M, 8 M, 10 M | ≠ | 1 M, 1.5 M, 2 M, 2.5 M, 3 M, 4 M, 5 M, 6 M, 8 M, 10 M | ≠ | 1 C, 1.5 C, 2 C, 2.5 C, 3 C, 4 C, 5 C, 6 M, 8 M, 10 M | ≠ | 1 C, 1.5 C, 2 C, 2.5 C, 3 C, 4 C, 5 M, 6 M, 8 M, 10 M | = |
| 9 m/s takeoff speed (m/s) | 6.372 | 8.323 | +1.952 | 8.642 | +2.270 | 7.814 | +1.443 | 6.378 | +0.007 |
| landing flat status | CLEARED | CLEARED | = | MISSED | ≠ | CLEARED | = | CLEARED | = |
| landing flat touchdown vy (m/s) | -3.900 | -4.344 | -0.444 | – | ≠ | -4.257 | -0.356 | -4.052 | -0.151 |
| landing flat peak compression (m) | 0.273 | 0.230 | -0.043 | – | ≠ | 0.237 | -0.036 | 0.297 | +0.023 |
| landing flat landing angle (rad) | -0.995 | 0.426 | +1.421 | – | ≠ | -0.708 | +0.287 | -0.718 | +0.277 |
| landing down status | CLEARED | CLEARED | = | MISSED | ≠ | CLEARED | = | CLEARED | = |
| landing down touchdown vy (m/s) | -1.733 | -3.835 | -2.102 | – | ≠ | -4.092 | -2.358 | -2.727 | -0.993 |
| landing down peak compression (m) | 0.176 | 0.174 | -0.002 | – | ≠ | 0.202 | +0.026 | 0.204 | +0.028 |
| landing down landing angle (rad) | -0.484 | 0.313 | +0.797 | – | ≠ | -0.664 | -0.180 | -0.471 | +0.013 |
| landing up status | CLEARED | MISSED | ≠ | MISSED | ≠ | CLEARED | = | CLEARED | = |
| landing up touchdown vy (m/s) | -3.235 | – | ≠ | – | ≠ | -2.936 | +0.300 | -3.224 | +0.011 |
| landing up peak compression (m) | 0.295 | – | ≠ | – | ≠ | 0.230 | -0.066 | 0.313 | +0.018 |
| landing up landing angle (rad) | -0.853 | – | ≠ | – | ≠ | -0.492 | +0.361 | -0.572 | +0.281 |

## seams (`a18`)

Declared repeat tolerances: ghost bumps equal, 0.02 m/s speed loss per seam.

| Metric | A | B | Δ B | C | Δ C | D | Δ D | E | Δ E |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seams-chain 5 m/s comparable | true | true | = | true | = | true | = | true | = |
| seams-chain 5 m/s ghost bumps (of 20) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| seams-chain 5 m/s speed loss over the strip (m/s) | 0.000 | -0.001 | 0.000 | -0.001 | 0.000 | 0.000 | 0.000 | 0.000 | +0.000 |
| seams-chain 5 m/s per-seam speed loss (m/s) | max 0 | max 0.000 | max Δ 0.000 | max 0.000 | max Δ 0.000 | max 0.000 | max Δ 0.000 | max 0.000 | max Δ 0.000 |
| seams-hull 5 m/s comparable | true | true | = | true | = | true | = | true | = |
| seams-hull 5 m/s ghost bumps (of 20) | 20 | 20 | 0 | 20 | 0 | 20 | 0 | 20 | 0 |
| seams-hull 5 m/s speed loss over the strip (m/s) | 1.807 | 2.075 | +0.268 | 2.118 | +0.310 | 1.976 | +0.169 | 1.867 | +0.060 |
| seams-hull 5 m/s per-seam speed loss (m/s) | max 0.131 | max 0.155 | max Δ 0.078 | max 0.176 | max Δ 0.084 | max 0.142 | max Δ 0.048 | max 0.138 | max Δ 0.035 |
| seams-chain 7 m/s comparable | true | true | = | true | = | true | = | true | = |
| seams-chain 7 m/s ghost bumps (of 20) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| seams-chain 7 m/s speed loss over the strip (m/s) | 0.000 | 0.000 | +0.000 | 0.000 | +0.001 | 0.000 | +0.000 | 0.000 | +0.000 |
| seams-chain 7 m/s per-seam speed loss (m/s) | max 0.000 | max 0.000 | max Δ 0.000 | max 0.000 | max Δ 0.000 | max 0.000 | max Δ 0.000 | max 0.000 | max Δ 0.000 |
| seams-hull 7 m/s comparable | true | true | = | true | = | true | = | true | = |
| seams-hull 7 m/s ghost bumps (of 20) | 20 | 20 | 0 | 20 | 0 | 20 | 0 | 20 | 0 |
| seams-hull 7 m/s speed loss over the strip (m/s) | 2.759 | 2.935 | +0.176 | 2.936 | +0.177 | 3.098 | +0.339 | 2.882 | +0.123 |
| seams-hull 7 m/s per-seam speed loss (m/s) | max 0.238 | max 0.231 | max Δ 0.066 | max 0.249 | max Δ 0.077 | max 0.247 | max Δ 0.092 | max 0.254 | max Δ 0.080 |
| seams-chain 9 m/s comparable | true | true | = | true | = | true | = | true | = |
| seams-chain 9 m/s ghost bumps (of 20) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| seams-chain 9 m/s speed loss over the strip (m/s) | 0.000 | 0.000 | +0.000 | 0.000 | 0.000 | 0.000 | +0.000 | 0.000 | 0.000 |
| seams-chain 9 m/s per-seam speed loss (m/s) | max 0.000 | max 0.000 | max Δ 0.000 | max 0.000 | max Δ 0.000 | max 0.000 | max Δ 0.000 | max 0.000 | max Δ 0.000 |
| seams-hull 9 m/s comparable | true | true | = | true | = | true | = | true | = |
| seams-hull 9 m/s ghost bumps (of 20) | 20 | 20 | 0 | 20 | 0 | 20 | 0 | 20 | 0 |
| seams-hull 9 m/s speed loss over the strip (m/s) | 3.412 | 3.571 | +0.159 | 4.152 | +0.739 | 3.742 | +0.330 | 3.409 | -0.004 |
| seams-hull 9 m/s per-seam speed loss (m/s) | max 0.279 | max 0.282 | max Δ 0.097 | max 0.294 | max Δ 0.157 | max 0.269 | max Δ 0.138 | max 0.255 | max Δ 0.140 |

## bumps (`a19b`)

Declared repeat tolerances: contact-loss share 0.02, compression 0.005 m, pitch 0.01 rad, apex speed 0.02 m/s.

| Metric | A | B | Δ B | C | Δ C | D | Δ D | E | Δ E |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 5 m/s section status | long-0.05 D, long-0.1 D, long-0.15 D, long-0.2 D, long-0.3 D, short-0.05 D, short-0.1 D, short-0.15 D, short-0.2 D, short-0.3 S, crest-dip D | long-0.05 D, long-0.1 D, long-0.15 D, long-0.2 D, long-0.3 D, short-0.05 D, short-0.1 D, short-0.15 D, short-0.2 D, short-0.3 S, crest-dip D | = | long-0.05 D, long-0.1 D, long-0.15 D, long-0.2 D, long-0.3 D, short-0.05 D, short-0.1 D, short-0.15 D, short-0.2 D, short-0.3 D, crest-dip D | ≠ | long-0.05 D, long-0.1 D, long-0.15 D, long-0.2 D, long-0.3 D, short-0.05 D, short-0.1 D, short-0.15 D, short-0.2 D, short-0.3 S, crest-dip D | = | long-0.05 D, long-0.1 D, long-0.15 D, long-0.2 D, long-0.3 D, short-0.05 D, short-0.1 D, short-0.15 D, short-0.2 D, short-0.3 S, crest-dip D | = |
| 7 m/s section status | long-0.05 D, long-0.1 D, long-0.15 D, long-0.2 D, long-0.3 D, short-0.05 D, short-0.1 D, short-0.15 D, short-0.2 D, short-0.3 S, crest-dip D | long-0.05 D, long-0.1 D, long-0.15 D, long-0.2 D, long-0.3 D, short-0.05 D, short-0.1 D, short-0.15 D, short-0.2 D, short-0.3 S, crest-dip D | = | long-0.05 D, long-0.1 D, long-0.15 D, long-0.2 D, long-0.3 D, short-0.05 D, short-0.1 D, short-0.15 D, short-0.2 D, short-0.3 S, crest-dip D | = | long-0.05 D, long-0.1 D, long-0.15 D, long-0.2 D, long-0.3 D, short-0.05 D, short-0.1 D, short-0.15 D, short-0.2 D, short-0.3 S, crest-dip D | = | long-0.05 D, long-0.1 D, long-0.15 D, long-0.2 D, long-0.3 D, short-0.05 D, short-0.1 D, short-0.15 D, short-0.2 D, short-0.3 S, crest-dip D | = |
| 5 m/s long-0.05 wheel contact lost (any) (share) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 5 m/s long-0.1 wheel contact lost (any) (share) | 0 | 0.022 | +0.022 | 0 | 0 | 0 | 0 | 0 | 0 |
| 5 m/s long-0.15 wheel contact lost (any) (share) | 0.014 | 0.057 | +0.043 | 0.007 | -0.007 | 0.029 | +0.014 | 0.014 | +0.000 |
| 5 m/s long-0.2 wheel contact lost (any) (share) | 0.144 | 0.179 | +0.035 | 0.077 | -0.067 | 0.207 | +0.063 | 0.083 | -0.061 |
| 5 m/s long-0.3 wheel contact lost (any) (share) | 0.344 | 0.384 | +0.040 | 0.340 | -0.004 | 0.396 | +0.052 | 0.285 | -0.059 |
| 5 m/s short-0.05 wheel contact lost (any) (share) | 0 | 0.061 | +0.061 | 0.364 | +0.364 | 0.092 | +0.092 | 0 | 0 |
| 5 m/s short-0.1 wheel contact lost (any) (share) | 0.400 | 0.514 | +0.114 | 0.607 | +0.207 | 0.500 | +0.100 | 0.429 | +0.029 |
| 5 m/s short-0.15 wheel contact lost (any) (share) | 0.481 | 0.575 | +0.094 | 0.644 | +0.164 | 0.575 | +0.094 | 0.477 | -0.004 |
| 5 m/s short-0.2 wheel contact lost (any) (share) | 0.424 | 0.526 | +0.102 | 0.667 | +0.242 | 0.532 | +0.107 | 0.391 | -0.034 |
| 5 m/s short-0.3 wheel contact lost (any) (share) | 0.306 | 0.281 | -0.025 | 0.254 | -0.052 | 0.213 | -0.093 | 0.264 | -0.042 |
| 7 m/s long-0.05 wheel contact lost (any) (share) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 7 m/s long-0.1 wheel contact lost (any) (share) | 0 | 0.150 | +0.150 | 0.270 | +0.270 | 0.081 | +0.081 | 0 | 0 |
| 7 m/s long-0.15 wheel contact lost (any) (share) | 0.369 | 0.543 | +0.174 | 0.552 | +0.183 | 0.552 | +0.183 | 0.225 | -0.143 |
| 7 m/s long-0.2 wheel contact lost (any) (share) | 0.631 | 0.625 | -0.006 | 0.631 | 0 | 0.649 | +0.018 | 0.519 | -0.112 |
| 7 m/s long-0.3 wheel contact lost (any) (share) | 0.742 | 0.713 | -0.029 | 0.727 | -0.016 | 0.742 | 0 | 0.702 | -0.041 |
| 7 m/s short-0.05 wheel contact lost (any) (share) | 0.042 | 0.127 | +0.085 | 0.338 | +0.296 | 0.197 | +0.155 | 0.099 | +0.056 |
| 7 m/s short-0.1 wheel contact lost (any) (share) | 0.461 | 0.613 | +0.153 | 0.675 | +0.215 | 0.613 | +0.153 | 0.566 | +0.105 |
| 7 m/s short-0.15 wheel contact lost (any) (share) | 0.540 | 0.674 | +0.134 | 0.778 | +0.238 | 0.671 | +0.130 | 0.575 | +0.034 |
| 7 m/s short-0.2 wheel contact lost (any) (share) | 0.637 | 0.717 | +0.080 | 0.774 | +0.137 | 0.730 | +0.093 | 0.663 | +0.026 |
| 7 m/s short-0.3 wheel contact lost (any) (share) | 0.305 | 0.953 | +0.647 | 0.324 | +0.019 | 0.951 | +0.646 | 0.246 | -0.059 |
| 5 m/s long-0.05 peak compression (m) | 0.104 | 0.076 | -0.028 | 0.043 | -0.061 | 0.075 | -0.029 | 0.117 | +0.013 |
| 5 m/s long-0.1 peak compression (m) | 0.127 | 0.095 | -0.032 | 0.056 | -0.071 | 0.094 | -0.033 | 0.143 | +0.016 |
| 5 m/s long-0.15 peak compression (m) | 0.145 | 0.110 | -0.034 | 0.066 | -0.078 | 0.109 | -0.035 | 0.161 | +0.016 |
| 5 m/s long-0.2 peak compression (m) | 0.158 | 0.118 | -0.040 | 0.071 | -0.087 | 0.117 | -0.041 | 0.175 | +0.017 |
| 5 m/s long-0.3 peak compression (m) | 0.184 | 0.138 | -0.046 | 0.084 | -0.100 | 0.137 | -0.047 | 0.196 | +0.012 |
| 5 m/s short-0.05 peak compression (m) | 0.111 | 0.078 | -0.033 | 0.056 | -0.055 | 0.077 | -0.034 | 0.119 | +0.008 |
| 5 m/s short-0.1 peak compression (m) | 0.140 | 0.103 | -0.037 | 0.075 | -0.065 | 0.102 | -0.039 | 0.148 | +0.008 |
| 5 m/s short-0.15 peak compression (m) | 0.171 | 0.129 | -0.042 | 0.105 | -0.066 | 0.127 | -0.044 | 0.178 | +0.008 |
| 5 m/s short-0.2 peak compression (m) | 0.193 | 0.164 | -0.029 | 0.128 | -0.065 | 0.156 | -0.037 | 0.202 | +0.009 |
| 5 m/s short-0.3 peak compression (m) | 0.228 | 0.194 | -0.034 | 0.124 | -0.104 | 0.175 | -0.053 | 0.237 | +0.010 |
| crest-8 lowest apex speed with lift-off (m/s) | not bracketed | not bracketed | = | not bracketed | = | not bracketed | = | not bracketed | = |
| crest-8 highest apex speed without lift-off (m/s) | not bracketed | not bracketed | = | not bracketed | = | not bracketed | = | not bracketed | = |
| crest-6 lowest apex speed with lift-off (m/s) | 5.473 | 5.279 | -0.195 | 5.264 | -0.209 | 5.247 | -0.226 | 5.160 | -0.313 |
| crest-6 highest apex speed without lift-off (m/s) | 5.449 | 5.231 | -0.218 | 5.690 | +0.241 | 5.596 | +0.147 | 5.115 | -0.334 |
| crest-4 lowest apex speed with lift-off (m/s) | 3.661 | 3.636 | -0.025 | 3.339 | -0.322 | 3.749 | +0.088 | 3.772 | +0.111 |
| crest-4 highest apex speed without lift-off (m/s) | 3.606 | 3.599 | -0.007 | 3.260 | -0.347 | 3.718 | +0.111 | 3.781 | +0.175 |
| crest-3 lowest apex speed with lift-off (m/s) | 2.495 | not bracketed | ≠ | not bracketed | ≠ | not bracketed | ≠ | 2.481 | -0.014 |
| crest-3 highest apex speed without lift-off (m/s) | 2.696 | not bracketed | ≠ | not bracketed | ≠ | not bracketed | ≠ | 2.710 | +0.015 |

## air (`a19c`)

Declared repeat tolerances: takeoff 0.02 m/s, airtime 0.034 s, rotation 5°, landing angle 5°, compression 0.005 m.

| Metric | A | B | Δ B | C | Δ C | D | Δ D | E | Δ E |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| big lean 0 status | CRASHED | CRASHED | = | LANDED | ≠ | CRASHED | = | CRASHED | = |
| big lean 0 takeoff speed (m/s) | 5.593 | 8.036 | +2.443 | 8.315 | +2.722 | 7.747 | +2.154 | 5.643 | +0.050 |
| big lean 0 airtime (s) | 1.733 | 2.100 | +0.367 | 2.117 | +0.383 | 2.083 | +0.350 | 1.750 | +0.017 |
| big lean 0 rotation (°) | -151.187 | -171.813 | -20.626 | -72.410 | +78.776 | -178.032 | -26.845 | -148.299 | +2.888 |
| big lean 0 landing angle (°) | -94.440 | -143.112 | -48.672 | -47.173 | +47.267 | -144.272 | -49.831 | -93.749 | +0.691 |
| big lean 0 impact normal speed (m/s) | 7.356 | 15.932 | +8.576 | 16.860 | +9.504 | 14.903 | +7.548 | 8.042 | +0.686 |
| big lean +1 (back) status | CRASHED | CRASHED | = | LANDED | ≠ | LANDED | ≠ | LANDED | ≠ |
| big lean +1 (back) airtime (s) | 1.750 | 2.133 | +0.383 | 2.117 | +0.367 | 2.083 | +0.333 | 1.733 | -0.017 |
| big lean +1 (back) rotation (°) | 422.225 | 872.810 | +450.584 | 1141.637 | +719.412 | 720.104 | +297.879 | 390.829 | -31.396 |
| big lean +1 (back) landing angle (°) | 116.472 | -178.490 | -294.962 | 86.874 | -29.597 | 33.865 | -82.607 | 85.379 | -31.093 |
| big lean +1 (back) impact normal speed (m/s) | 8.366 | 16.138 | +7.772 | 17.469 | +9.103 | 15.078 | +6.712 | 8.215 | -0.151 |
| big lean -1 (front) status | CRASHED | CRASHED | = | LANDED | ≠ | LANDED | ≠ | CRASHED | = |
| big lean -1 (front) airtime (s) | 1.750 | 2.100 | +0.350 | 2.117 | +0.367 | 2.067 | +0.317 | 1.783 | +0.033 |
| big lean -1 (front) rotation (°) | -639.003 | -1007.844 | -368.842 | -1195.841 | -556.839 | -846.168 | -207.166 | -588.658 | +50.344 |
| big lean -1 (front) landing angle (°) | 135.244 | 100.856 | -34.388 | -85.604 | -220.848 | -92.408 | -227.652 | -179.109 | -314.353 |
| big lean -1 (front) impact normal speed (m/s) | 7.796 | 15.392 | +7.596 | 16.512 | +8.716 | 15.108 | +7.312 | 9.562 | +1.766 |
| mid lean 0 status | CRASHED | LANDED | ≠ | LANDED | ≠ | LANDED | ≠ | LANDED | ≠ |
| mid lean 0 takeoff speed (m/s) | 5.593 | 8.035 | +2.443 | 8.315 | +2.722 | 7.747 | +2.154 | 5.643 | +0.050 |
| mid lean 0 airtime (s) | 1.267 | 1.600 | +0.333 | 1.617 | +0.350 | 1.567 | +0.300 | 1.283 | +0.017 |
| mid lean 0 rotation (°) | -113.178 | -125.615 | -12.438 | -54.164 | +59.013 | -127.181 | -14.003 | -111.514 | +1.663 |
| mid lean 0 landing angle (°) | -68.930 | -101.913 | -32.984 | -33.926 | +35.003 | -98.416 | -29.487 | -71.964 | -3.035 |
| mid lean 0 impact normal speed (m/s) | 6.539 | 12.001 | +5.462 | 12.775 | +6.236 | 10.984 | +4.445 | 7.500 | +0.961 |
| mid lean +1 (back) status | CRASHED | CRASHED | = | CRASHED | = | CRASHED | = | CRASHED | = |
| mid lean +1 (back) airtime (s) | 1.283 | 1.600 | +0.317 | 1.617 | +0.333 | 1.600 | +0.317 | 1.300 | +0.017 |
| mid lean +1 (back) rotation (°) | 221.998 | 559.638 | +337.640 | 788.920 | +566.922 | 507.130 | +285.132 | 199.665 | -22.333 |
| mid lean +1 (back) landing angle (°) | -93.754 | -136.659 | -42.905 | 89.158 | +182.912 | 175.894 | +269.648 | -120.785 | -27.031 |
| mid lean +1 (back) impact normal speed (m/s) | 6.203 | 11.500 | +5.298 | 13.400 | +7.197 | 11.350 | +5.147 | 7.240 | +1.037 |
| mid lean -1 (front) status | LANDED | LANDED | = | CRASHED | ≠ | LANDED | = | LANDED | = |
| mid lean -1 (front) airtime (s) | 1.300 | 1.583 | +0.283 | 1.617 | +0.317 | 1.600 | +0.300 | 1.300 | 0 |
| mid lean -1 (front) rotation (°) | -429.556 | -704.016 | -274.460 | -852.850 | -423.294 | -612.600 | -183.044 | -389.529 | +40.028 |
| mid lean -1 (front) landing angle (°) | -30.308 | 39.686 | +69.994 | -107.612 | -77.304 | 131.164 | +161.472 | 15.022 | +45.330 |
| mid lean -1 (front) impact normal speed (m/s) | 7.811 | 11.371 | +3.560 | 12.615 | +4.803 | 11.738 | +3.926 | 6.524 | -1.288 |

## balance (`a19d`)

Declared repeat tolerances: stop x 0.05 m, time 0.1 s, tip/settle time 0.05 s, angles 0.01 rad.

| Metric | A | B | Δ B | C | Δ C | D | Δ D | E | Δ E |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| skill driver status | beam-2 C, beam-1.5 C, beam-1.2 C, beam-1.05 C, up C, down C, seesaw C | beam-2 C, beam-1.5 C, beam-1.2 C, beam-1.05 C, up C, down C, seesaw C | = | beam-2 C, beam-1.5 C, beam-1.2 C, beam-1.05 C, up C, down C, seesaw C | = | beam-2 C, beam-1.5 C, beam-1.2 C, beam-1.05 C, up C, down C, seesaw C | = | beam-2 C, beam-1.5 C, beam-1.2 C, beam-1.05 C, up C, down C, seesaw C | = |
| skill beam-2 time (s) | 5.883 | 5.183 | -0.700 | 5.350 | -0.533 | 5.333 | -0.550 | 5.833 | -0.050 |
| skill beam-1.5 time (s) | 5.667 | 4.950 | -0.717 | 5.150 | -0.517 | 5.217 | -0.450 | 5.200 | -0.467 |
| skill beam-1.2 time (s) | 5.833 | 4.950 | -0.883 | 4.933 | -0.900 | 4.900 | -0.933 | 5.400 | -0.433 |
| skill beam-1.05 time (s) | 5.500 | 5.567 | +0.067 | 4.483 | -1.017 | 4.983 | -0.517 | 5.100 | -0.400 |
| skill up time (s) | 6.783 | 5.917 | -0.867 | 5.733 | -1.050 | 6.033 | -0.750 | 6.633 | -0.150 |
| skill down time (s) | 5.533 | 5.533 | 0 | 5.267 | -0.267 | 5.400 | -0.133 | 5.800 | +0.267 |
| skill seesaw time (s) | 9.500 | 9.383 | -0.117 | 8.483 | -1.017 | 9.117 | -0.383 | 9.833 | +0.333 |
| full throttle status | beam-2 M, beam-1.5 M, beam-1.2 M, beam-1.05 M, up M, down M, seesaw M | beam-2 M, beam-1.5 M, beam-1.2 M, beam-1.05 M, up M, down M, seesaw M | = | beam-2 M, beam-1.5 M, beam-1.2 M, beam-1.05 M, up M, down M, seesaw M | = | beam-2 M, beam-1.5 M, beam-1.2 M, beam-1.05 M, up M, down M, seesaw M | = | beam-2 M, beam-1.5 M, beam-1.2 M, beam-1.05 M, up M, down M, seesaw M | = |
| seesaw tip at (s) | 4.900 | 4.950 | +0.050 | 4.567 | -0.333 | 4.717 | -0.183 | 5.183 | +0.283 |
| seesaw settled at (s) | 5.117 | 5.100 | -0.017 | 4.717 | -0.400 | 4.867 | -0.250 | 5.383 | +0.267 |
| seesaw settled angle (rad) | -0.253 | -0.252 | +0.001 | -0.253 | +0.000 | -0.253 | +0.000 | -0.253 | +0.000 |

## Follow-ups

- throttle 0 to 5 m/s time and braking distance from 7 m/s: telemetry samples every 0.25 s and the straight station records no brake entry speed, so both need a small game-side read
