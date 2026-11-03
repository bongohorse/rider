# Wheel-size A/B (#114 stage 1): A vs W26 vs W30

Source `a447c06a1a2b0c6e8b7ad17e5d5c5f5af1a9b5b6`, 156.0.8078.4, debug HTML5 Gym bundle, fixed 60 Hz physics at time factor 1.0, 4 substeps; synthetic runs, not device or drive evidence.
Values are from the second Retry attempt (R pressed twice after the page load); "Retry" compares the two Retry attempts tick by tick and "Load" the page-load attempt (shifted by its 1-tick probe phase) with the first Retry (A21 tolerances 0.05 m / 0.05 rad; "identical" = every compared value equal). Cap = 47.12 rad/s; "at cap" counts ticks with a wheel within 0.01 rad/s of it, the read-back value can exceed it.

## Geometry measured in the engine

| Preset | Wheel shape radius | Wheel mass | Wheel inertia | Joint anchor | No-slip ceiling |
| --- | --- | --- | --- | --- | --- |
| A | 22.0 u (0.22 m) | 4.000 kg | 0.0968 | -30 u | 10.37 m/s |
| W26 | 26.0 u (0.26 m) | 4.000 kg | 0.1352 | -35 u | 12.25 m/s |
| W30 | 30.0 u (0.30 m) | 4.000 kg | 0.1800 | -41 u | 14.14 m/s |

## straight

Straight from rest, constant full throttle (probe driver), no brake/lean; window 480 fixed ticks (8.00 s) per attempt. Outcome: none (top speed only); a bounds reset fails the run.

| Preset | Top speed (m/s) | Top vx (m/s) | Peak wheel ω (rad/s) | ω / cap | Ticks at cap | Max slip (m/s) | Mean slip (m/s) | Wheel support | Chassis contact ticks | Outcome (load / R1 / R2) | Retry | Load |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A | 6.96 | 6.96 | 33.62 | 71 % | 0 | 2.61 | 0.087 | 96 % | 0 | n/a / n/a / n/a | MATCH (identical) | MATCH (identical) |
| W26 | 8.25 | 8.25 | 32.94 | 70 % | 0 | 5.04 | 0.086 | 97 % | 0 | n/a / n/a / n/a | MATCH (identical) | MATCH (identical) |
| W30 | 9.53 | 9.53 | 32.26 | 68 % | 0 | 1.81 | 0.091 | 98 % | 0 | n/a / n/a / n/a | MATCH (identical) | MATCH (identical) |

## ramps-long/down-10

ramps-long down-10: authored neutral start at 1 m/s (a16 driver); window 210 fixed ticks (3.50 s) per attempt. Outcome: ramp record status (ACCELERATED or HELD/SLOWED) and its speed gain.

| Preset | Top speed (m/s) | Top vx (m/s) | Peak wheel ω (rad/s) | ω / cap | Ticks at cap | Max slip (m/s) | Mean slip (m/s) | Wheel support | Chassis contact ticks | Outcome (load / R1 / R2) | Retry | Load |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A | 2.95 | 2.29 | 10.74 | 23 % | 0 | 0.09 | 0.030 | 91 % | 0 | ACCELERATED +1.17 / ACCELERATED +1.17 / ACCELERATED +1.17 | MATCH (identical) | MATCH (identical) |
| W26 | 2.57 | 2.50 | 10.08 | 21 % | 0 | 0.08 | 0.025 | 93 % | 0 | ACCELERATED +1.42 / ACCELERATED +1.42 / ACCELERATED +1.42 | MATCH (identical) | MATCH (identical) |
| W30 | 2.68 | 2.64 | 9.47 | 20 % | 0 | 0.07 | 0.020 | 94 % | 0 | ACCELERATED +1.56 / ACCELERATED +1.56 / ACCELERATED +1.56 | MATCH (identical) | MATCH (identical) |

## ramps-long/down-20

ramps-long down-20: authored neutral start at 1 m/s (a16 driver); window 210 fixed ticks (3.50 s) per attempt. Outcome: ramp record status (ACCELERATED or HELD/SLOWED) and its speed gain.

| Preset | Top speed (m/s) | Top vx (m/s) | Peak wheel ω (rad/s) | ω / cap | Ticks at cap | Max slip (m/s) | Mean slip (m/s) | Wheel support | Chassis contact ticks | Outcome (load / R1 / R2) | Retry | Load |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A | 3.86 | 3.63 | 19.14 | 41 % | 0 | 0.32 | 0.080 | 91 % | 0 | ACCELERATED +2.53 / ACCELERATED +2.53 / ACCELERATED +2.53 | MATCH (identical) | MATCH (identical) |
| W26 | 4.04 | 3.80 | 17.49 | 37 % | 0 | 0.41 | 0.068 | 92 % | 0 | ACCELERATED +2.71 / ACCELERATED +2.71 / ACCELERATED +2.71 | MATCH (identical) | MATCH (identical) |
| W30 | 4.16 | 3.92 | 16.16 | 34 % | 0 | 0.55 | 0.056 | 93 % | 0 | ACCELERATED +2.80 / ACCELERATED +2.80 / ACCELERATED +2.80 | MATCH (identical) | MATCH (identical) |

## ramps-long/down-30

ramps-long down-30: authored neutral start at 1 m/s (a16 driver); window 210 fixed ticks (3.50 s) per attempt. Outcome: ramp record status (ACCELERATED or HELD/SLOWED) and its speed gain.

| Preset | Top speed (m/s) | Top vx (m/s) | Peak wheel ω (rad/s) | ω / cap | Ticks at cap | Max slip (m/s) | Mean slip (m/s) | Wheel support | Chassis contact ticks | Outcome (load / R1 / R2) | Retry | Load |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A | 4.92 | 4.27 | 25.77 | 55 % | 0 | 1.34 | 0.135 | 90 % | 0 | ACCELERATED +3.10 / ACCELERATED +3.10 / ACCELERATED +3.10 | MATCH (identical) | MATCH (identical) |
| W26 | 5.07 | 4.41 | 22.95 | 49 % | 0 | 1.76 | 0.094 | 89 % | 0 | ACCELERATED +3.24 / ACCELERATED +3.24 / ACCELERATED +3.24 | MATCH (identical) | MATCH (identical) |
| W30 | 5.17 | 4.53 | 20.98 | 45 % | 0 | 1.41 | 0.073 | 90 % | 0 | ACCELERATED +3.33 / ACCELERATED +3.33 / ACCELERATED +3.33 | MATCH (identical) | MATCH (identical) |

## gaps/3

gaps 3 m: authored 7 m/s start, full throttle (a19 driver); window 300 fixed ticks (5.00 s) per attempt. Outcome: gap record status (CLEARED/MISSED) and jump distance.

| Preset | Top speed (m/s) | Top vx (m/s) | Peak wheel ω (rad/s) | ω / cap | Ticks at cap | Max slip (m/s) | Mean slip (m/s) | Wheel support | Chassis contact ticks | Outcome (load / R1 / R2) | Retry | Load |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A | 7.64 | 7.00 | 40.78 | 87 % | 0 | 1.93 | 0.235 | 63 % | 11 | CLEARED 3.32 m / CLEARED 3.32 m / CLEARED 3.32 m | MATCH (identical) | MATCH (identical) |
| W26 | 8.39 | 8.24 | 37.92 | 80 % | 0 | 1.86 | 0.298 | 69 % | 0 | CLEARED 3.99 m / CLEARED 3.99 m / CLEARED 3.99 m | MATCH (identical) | MATCH (identical) |
| W30 | 9.53 | 9.53 | 34.19 | 73 % | 0 | 2.84 | 0.364 | 66 % | 0 | CLEARED 4.28 m / CLEARED 4.28 m / CLEARED 4.28 m | MATCH (identical) | MATCH (identical) |

## gaps/6

gaps 6 m: authored 7 m/s start, full throttle (a19 driver); window 300 fixed ticks (5.00 s) per attempt. Outcome: gap record status (CLEARED/MISSED) and jump distance.

| Preset | Top speed (m/s) | Top vx (m/s) | Peak wheel ω (rad/s) | ω / cap | Ticks at cap | Max slip (m/s) | Mean slip (m/s) | Wheel support | Chassis contact ticks | Outcome (load / R1 / R2) | Retry | Load |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A | 10.10 | 7.00 | 34.60 | 73 % | 0 | 4.87 | 0.198 | 42 % | 176 | MISSED / MISSED / MISSED | MATCH (identical) | MATCH (identical) |
| W26 | 9.64 | 6.99 | 34.65 | 74 % | 0 | 8.34 | 1.642 | 17 % | 181 | MISSED / MISSED / MISSED | MATCH (identical) | MATCH (identical) |
| W30 | 9.41 | 7.14 | 33.91 | 72 % | 0 | 7.87 | 0.275 | 64 % | 2 | MISSED / MISSED / MISSED | MATCH (identical) | MATCH (identical) |

## gaps-landing/down

gaps-landing 15° downslope: authored 7 m/s start, full throttle (a19 driver); window 300 fixed ticks (5.00 s) per attempt. Outcome: gap record status (CLEARED/MISSED) and jump distance.

| Preset | Top speed (m/s) | Top vx (m/s) | Peak wheel ω (rad/s) | ω / cap | Ticks at cap | Max slip (m/s) | Mean slip (m/s) | Wheel support | Chassis contact ticks | Outcome (load / R1 / R2) | Retry | Load |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A | 7.42 | 7.00 | 43.91 | 93 % | 0 | 1.93 | 0.208 | 75 % | 3 | CLEARED 2.24 m / CLEARED 2.24 m / CLEARED 2.24 m | MATCH (identical) | MATCH (identical) |
| W26 | 8.22 | 8.22 | 38.01 | 81 % | 0 | 1.90 | 0.260 | 68 % | 0 | CLEARED 3.49 m / CLEARED 3.49 m / CLEARED 3.49 m | MATCH (identical) | MATCH (Δpos 0.0001 m) |
| W30 | 9.54 | 9.54 | 34.56 | 73 % | 0 | 3.83 | 0.353 | 66 % | 0 | CLEARED 3.86 m / CLEARED 3.86 m / CLEARED 3.86 m | MATCH (identical) | MATCH (identical) |

## air/big

air big: authored 7 m/s start, full throttle to the lip, then neutral (a19c driver, lean 0); window 300 fixed ticks (5.00 s) per attempt. Outcome: lip jump status (LANDED/CRASHED) with landing angle.

| Preset | Top speed (m/s) | Top vx (m/s) | Peak wheel ω (rad/s) | ω / cap | Ticks at cap | Max slip (m/s) | Mean slip (m/s) | Wheel support | Chassis contact ticks | Outcome (load / R1 / R2) | Retry | Load |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A | 16.61 | 11.91 | 47.12 | 100 % | 1 | 4.75 | 0.428 | 13 % | 66 | CRASHED -94° / CRASHED -94° / CRASHED -94° | MATCH (identical) | MATCH (identical) |
| W26 | 18.45 | 8.79 | 45.04 | 96 % | 0 | 4.32 | 0.287 | 12 % | 83 | CRASHED -136° / CRASHED -136° / CRASHED -136° | MATCH (identical) | MATCH (identical) |
| W30 | 19.03 | 7.83 | 34.24 | 73 % | 0 | 4.59 | 0.319 | 11 % | 129 | CRASHED 175° / CRASHED 175° / CRASHED 175° | MATCH (identical) | MATCH (identical) |

## air/mid

air mid: authored 7 m/s start, full throttle to the lip, then neutral (a19c driver, lean 0); window 300 fixed ticks (5.00 s) per attempt. Outcome: lip jump status (LANDED/CRASHED) with landing angle.

| Preset | Top speed (m/s) | Top vx (m/s) | Peak wheel ω (rad/s) | ω / cap | Ticks at cap | Max slip (m/s) | Mean slip (m/s) | Wheel support | Chassis contact ticks | Outcome (load / R1 / R2) | Retry | Load |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A | 12.40 | 9.27 | 54.45 | 116 % | 3 | 3.03 | 0.157 | 31 % | 128 | CRASHED -69° / CRASHED -69° / CRASHED -69° | MATCH (identical) | MATCH (identical) |
| W26 | 13.99 | 8.71 | 43.10 | 91 % | 0 | 4.92 | 0.186 | 50 % | 4 | LANDED -96° / LANDED -96° / LANDED -96° | MATCH (identical) | MATCH (identical) |
| W30 | 14.64 | 7.83 | 34.24 | 73 % | 0 | 3.51 | 0.143 | 25 % | 132 | CRASHED -129° / CRASHED -129° / CRASHED -129° | MATCH (identical) | MATCH (identical) |
