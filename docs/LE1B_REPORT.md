# LE1b custom level size and performance report

Measurement report for [#123](https://github.com/bongohorse/rider/issues/123) (level-editor contract [R7 and R15](contracts/level-editor.md#rules-r1r18)). It measures custom levels through the unchanged LE1a import path and only within the unchanged validation limits. Automated desktop values and Claudio's phone values are reported separately; phone values stay NOT RUN until he supplies them.

**Contents:** [Summary](#summary) · [Protocol](#protocol) · [Desktop results](#desktop-results) · [Phone results](#phone-results) · [Phone procedure](#phone-procedure) · [Findings for later tasks](#findings-for-later-tasks) · [Reproduction](#reproduction) · [Engine sources](#engine-sources)

## Summary

Automated desktop results from CI (headless Chromium, SwiftShader software GL, 1280×720, DPR 1). Phone results: NOT RUN.

- **World switch (R15):** Import → drive-ready takes a median of 55–58 ms up to 400 render objects and 62–68 ms at 612–800 objects; the worst of 5 repeats is 56–83 ms. About 50 ms is a fixed floor of frame-paced proxy unload/load; the level-dependent part (parse, terrain, decoration) is at most 19 ms at 800 objects. On desktop the reload baseline does not slow the build–test loop; phone values decide whether it stays the LE2 baseline.
- **Switch frame:** the longest frame during a switch grows with complexity, from 6–9 ms at 100–200 objects to 21–26 ms at 612–800 objects. That is one dropped 60 Hz frame during the switch, not while driving.
- **Driving:** frame interval p95 is 16.8–17.2 ms for every level, with 0–2 intervals above 25 ms per 6 s window and no trend with size. Engine callback work p95 is 4.2–6.3 ms (highest at 800 objects). Box2D's step p95/max is 0.1–0.2 ms, at the 0.1 ms clock step: physics cost within the limits is below resolution, which is not zero-cost evidence.
- **Length** (100 m → 99 km at 100 segments, start at 0) changes nothing measurable: switch, frames, physics and Box2D memory stay the same.
- **Complexity** drives the cost: Box2D world memory grows by about 1 KiB per terrain shape (117 KiB at 100 shapes, 803 KiB at 800). The level-dependent switch part grows from 4 ms to 19 ms. 64 box hulls (356 render objects in all) cost about as much as 400 chain segments: 175 KiB Box2D memory and a 14 ms switch frame.
- **Size:** each save is the level text plus 66 bytes. The largest accepted save is 13.7 KiB, so the 256 KiB cap is only reachable with padding.
- **Limits:** all 7 rejected cases fail with the validator or helper message and leave the running level and its save unchanged; their physics cost is unknown. **Start distance is a real limit far below the 100 km coordinate cap:** a start at 1.0 km works, but at 1.5, 2, 4 and 98.8 km the vehicle cannot be placed ([finding 1](#findings-for-later-tasks)).
- **Budgets (R7):** a full level uses 800 decoration sprites plus 4 vehicle sprites, i.e. 804 of the 1024 sprite slots, leaving 220 for editor overlays. These levels use no labels (station labels and distance markers would). GUI nodes do not depend on the level and are not measured. Whether hidden sprites free budget: NOT RUN. Within the limits, the sprite/render-object budget and the switch-frame spike grow with complexity, while physics stays below clock resolution and build time stays at or below 19 ms.

## Protocol

- **Levels:** `tools/gym/levels.cjs` generates every case deterministically. All terrain is a 0.4 m sine (25 m wavelength) on a 0.8 m base, chains right to left, start 0.9 m above the chain at 5 m/s, preset A. One factor changes per series:
  - **Length:** 100 segments, 1 chain, 100 m / 1 km / 10 km / 99 km (start at 0 m); segment length grows with the course (1 m to 990 m).
  - **Start distance:** the 99 km course with the start at 1 / 1.5 / 2 / 4 / 98.8 km.
  - **Segments:** 400 m, 1 chain, 100 / 200 / 400 / 800 segments (800 is the render budget).
  - **Chains:** 400 m, 32 chains × 25 segments.
  - **Hulls:** 400 m, 100 segments plus 16 / 32 / 64 boxes or 64 octagons (612 render objects). Hulls lie 0.2 m below the lowest ground point: they add static shapes and render objects but no vehicle contacts, so hull **contact** cost is not part of this report.
  - **Corner:** 99 km with 800 segments.
  - **Rejected:** one case per limit (coordinates ≥ 100 km, 801 render objects, 2049-point chain, 33 chains, 65 hulls, 9-vertex hull, text above 256 KiB).
- **World switch:** trigger = the **Import text** click (pasted JSON, the LE1a path), timed with `performance.now()` in the same page task; drive-ready = the world's `riderReady` write in the frame that attaches the vehicle. Each level is imported once from the previous level, then re-imported 5 times; median and worst are over these 5 repeats. Every switch includes parse and validation, the proxy unload/load, terrain and decoration build, vehicle spawn and the save write; the IndexedDB sync finishes before the next repeat. The Lua side reports its own trigger → drive-ready time (from the moment Lua picks up the import, one frame after the click; a queued import includes its wait) and the parse, terrain and decoration parts (`socket.gettime`, whole milliseconds on HTML5: values below 1 ms are shown as `<1`).
- **Drive window:** after the last repeat, ArrowUp is held; 1 s warm-up, then 6 s sampled. Per world update the page records the update interval, the engine dt and Box2D's step profile (the same values as the phone **Measure** capture) and the main-thread time of each engine `requestAnimationFrame` callback that ran a world update ("callback work": Lua, physics and render submission; GPU time is not visible to the page). The "longest frame in switch" counts every callback between trigger and drive-ready, including the setup frame that builds the terrain. Box2D counters and profile parts come every 0.25 s in the debug `le1b` case only.
- **Resolution:** `performance.now()` advances in 0.1 ms steps in this headless Chromium (no cross-origin isolation), and Box2D's step profile uses the same clock. Step values below 0.1 ms are shown as `<0.1`; the zero-sample count says how often a step was below resolution. These are not zero-cost evidence.
- **Memory:** Box2D world bytes (`b2d.world.get_counters`), Lua heap (`collectgarbage("count")`, a snapshot that depends on garbage collection timing) and the WASM linear memory size. The JS heap is unknown (Chrome reports bucketed values).
- **Assertions:** identical shape/sprite/label counts across the 6 imports of a level, terrain shapes = segments + hulls, decoration sprites = render objects, exact validator messages for rejected cases, unchanged world after a rejection. Timing values have no pass/fail thresholds.

## Desktop results

CI [run 39161996251](https://github.com/bongohorse/rider/actions/runs/39161996251) (G1 HTML5, artifact `g1-html5-39161996251`, `sizes/`), source `24fc95f` = CI merge of PR head `50700f9` into main `74f0f11`, run `3f07c92b-1a7a-47f5-ab10-458cfd6cfe6d`, Chromium 156.0.8078.4 headless, ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver), viewport 1280x720 DPR 1, preset A. Repeats 5; 1 s warm-up, then 6 s full throttle. performance.now() step 0.100 ms (cross-origin isolated: false).

### Levels and sizes

| Level | Dimension | Length m | Start m | Segments | Chains | Hulls | Render objects | Text KiB | Save KiB | Terrain shapes | Decoration sprites |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| len-100m | length | 100 | 0 | 100 | 1 | 0 | 100 | 1.5 | 1.6 | 100 | 100 |
| len-1km | length | 1000 | 0 | 100 | 1 | 0 | 100 | 1.6 | 1.6 | 100 | 100 |
| len-10km | length | 10000 | 0 | 100 | 1 | 0 | 100 | 1.7 | 1.7 | 100 | 100 |
| len-99km | length | 99000 | 0 | 100 | 1 | 0 | 100 | 1.8 | 1.8 | 100 | 100 |
| start-1000m | start | 99000 | 1000 | 100 | 1 | 0 | 100 | 1.8 | 1.9 | 100 | 100 |
| seg-100 | segments | 400 | 0 | 100 | 1 | 0 | 100 | 1.6 | 1.6 | 100 | 100 |
| seg-200 | segments | 400 | 0 | 200 | 1 | 0 | 200 | 3.0 | 3.0 | 200 | 200 |
| seg-400 | segments | 400 | 0 | 400 | 1 | 0 | 400 | 5.8 | 5.9 | 400 | 400 |
| seg-800 | segments | 400 | 0 | 800 | 1 | 0 | 800 | 11.9 | 12.0 | 800 | 800 |
| chains-32 | chains | 400 | 0 | 800 | 32 | 0 | 800 | 12.4 | 12.5 | 800 | 800 |
| hulls-16 | hulls | 400 | 0 | 100 | 1 | 16 | 164 | 2.6 | 2.7 | 116 | 164 |
| hulls-32 | hulls | 400 | 0 | 100 | 1 | 32 | 228 | 3.7 | 3.8 | 132 | 228 |
| hulls-64 | hulls | 400 | 0 | 100 | 1 | 64 | 356 | 6.1 | 6.2 | 164 | 356 |
| hulls-64x8 | hulls | 400 | 0 | 100 | 1 | 64 | 612 | 10.3 | 10.4 | 164 | 612 |
| corner-99km-800 | corner | 99000 | 0 | 800 | 1 | 0 | 800 | 13.6 | 13.7 | 800 | 800 |
| start-1500m | start | 99000 | 1500 | 100 | 1 | 0 | 100 | 1.8 | n/a | n/a | n/a |
| start-2000m | start | 99000 | 2000 | 100 | 1 | 0 | 100 | 1.8 | n/a | n/a | n/a |
| start-4000m | start | 99000 | 4000 | 100 | 1 | 0 | 100 | 1.8 | n/a | n/a | n/a |
| start-98800m | start | 99000 | 98800 | 100 | 1 | 0 | 100 | 1.8 | n/a | n/a | n/a |

### World switch (Import text click to drive-ready)

| Level | Median ms | Worst ms | First import ms | Longest frame in switch ms | Lua parse ms | Lua terrain ms | Lua decoration ms | Lua switch ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| len-100m | 55.5 | 56.5 | 54.7 | 8.2 | <1 | <1 | 2 | 49 |
| len-1km | 55.5 | 70.6 | 59.9 | 6.8 | <1 | <1 | <1 | 50 |
| len-10km | 56.3 | 71.0 | 59.3 | 7.0 | <1 | <1 | 2 | 49 |
| len-99km | 56.6 | 57.1 | 60.8 | 6.0 | <1 | <1 | 1 | 49 |
| start-1000m | 56.6 | 57.3 | 56.5 | 6.4 | <1 | <1 | 1 | 49 |
| seg-100 | 56.4 | 57.1 | 59.7 | 6.9 | <1 | <1 | <1 | 49 |
| seg-200 | 55.4 | 72.1 | 55.7 | 8.7 | 2 | <1 | 2 | 49 |
| seg-400 | 57.4 | 74.6 | 58.2 | 13.8 | 2 | 3 | 4 | 50 |
| seg-800 | 67.7 | 82.9 | 79.6 | 25.5 | 3 | 6 | 8 | 61 |
| chains-32 | 64.4 | 65.1 | 62.8 | 23.6 | 3 | 6 | 7 | 59 |
| hulls-16 | 56.3 | 57.0 | 53.6 | 8.3 | <1 | <1 | 1 | 49 |
| hulls-32 | 56.0 | 56.4 | 61.9 | 10.4 | 1 | <1 | 3 | 49 |
| hulls-64 | 56.7 | 58.4 | 54.2 | 13.9 | 2 | 2 | 4 | 49 |
| hulls-64x8 | 62.2 | 77.1 | 58.6 | 21.1 | 4 | 2 | 7 | 55 |
| corner-99km-800 | 67.9 | 69.1 | 72.1 | 26.1 | 3 | 7 | 7 | 61 |
| start-1500m | placement failed: `vehicle.lua:68: Noncanonical reset pose` |  |  |  |  |  |  |  |
| start-2000m | placement failed: `vehicle.lua:68: Noncanonical reset pose` |  |  |  |  |  |  |  |
| start-4000m | placement failed: `vehicle.lua:68: Noncanonical reset pose` |  |  |  |  |  |  |  |
| start-98800m | placement failed: `vehicle.lua:68: Noncanonical reset pose` |  |  |  |  |  |  |  |

### Frames and physics during the drive window

| Level | Interval p50/p95/p99/max ms | Over 25 ms | Engine callback work p50/p95/max ms | Physics step p50/p95/max ms | Zero step samples | Contacts max | Static tree height | Distance m | Resets |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| len-100m | 16.7 / 16.9 / 17.1 / 33.2 | 1 of 359 | 1.8 / 4.9 / 6.7 | 0.1 / 0.2 / 0.2 | 156 of 360 | 5 | 8 | 49.3 | 0 |
| len-1km | 16.7 / 17.0 / 17.1 / 33.2 | 1 of 358 | 1.8 / 4.9 / 6.6 | 0.1 / 0.1 / 0.2 | 173 of 359 | 5 | 8 | 48.6 | 0 |
| len-10km | 16.7 / 16.9 / 17.1 / 32.9 | 1 of 359 | 1.5 / 4.3 / 5.6 | <0.1 / 0.1 / 0.2 | 196 of 360 | 2 | 8 | 50.5 | 0 |
| len-99km | 16.7 / 16.9 / 17.1 / 33.3 | 1 of 359 | 1.4 / 4.4 / 5.7 | <0.1 / 0.1 / 0.2 | 209 of 360 | 3 | 8 | 50.5 | 0 |
| start-1000m | 16.7 / 16.9 / 17.0 / 17.6 | 0 of 359 | 1.5 / 4.2 / 7.9 | <0.1 / 0.1 / 0.2 | 200 of 360 | 2 | 8 | 50.6 | 0 |
| seg-100 | 16.7 / 16.8 / 17.1 / 17.2 | 0 of 360 | 1.4 / 4.2 / 5.7 | <0.1 / 0.1 / 0.2 | 206 of 361 | 4 | 8 | 49.4 | 0 |
| seg-200 | 16.7 / 16.9 / 17.2 / 33.1 | 1 of 359 | 1.6 / 4.8 / 6.5 | 0.1 / 0.1 / 0.2 | 176 of 360 | 4 | 9 | 49.5 | 0 |
| seg-400 | 16.7 / 16.9 / 17.2 / 19.9 | 0 of 360 | 1.6 / 4.9 / 13.6 | 0.1 / 0.1 / 0.2 | 174 of 361 | 4 | 10 | 49.4 | 0 |
| seg-800 | 16.7 / 16.9 / 17.6 / 30.6 | 1 of 359 | 1.7 / 6.1 / 9.2 | 0.1 / 0.1 / 0.2 | 164 of 360 | 5 | 11 | 49.4 | 0 |
| chains-32 | 16.7 / 17.2 / 20.0 / 33.4 | 2 of 357 | 1.7 / 5.5 / 8.8 | <0.1 / 0.1 / 0.2 | 180 of 358 | 5 | 11 | 47.8 | 0 |
| hulls-16 | 16.7 / 16.9 / 17.2 / 17.3 | 0 of 360 | 1.5 / 4.2 / 6.3 | <0.1 / 0.1 / 0.2 | 213 of 361 | 4 | 8 | 49.5 | 0 |
| hulls-32 | 16.7 / 16.9 / 17.2 / 33.3 | 1 of 359 | 1.5 / 4.4 / 6.2 | <0.1 / 0.1 / 0.2 | 198 of 360 | 4 | 9 | 49.5 | 0 |
| hulls-64 | 16.7 / 16.9 / 17.3 / 33.2 | 1 of 359 | 1.6 / 4.6 / 6.7 | <0.1 / 0.1 / 0.2 | 189 of 360 | 4 | 9 | 49.5 | 0 |
| hulls-64x8 | 16.7 / 16.9 / 17.4 / 18.1 | 0 of 360 | 1.7 / 4.6 / 9.5 | <0.1 / 0.1 / 0.2 | 184 of 361 | 4 | 9 | 49.4 | 0 |
| corner-99km-800 | 16.7 / 17.1 / 17.5 / 17.8 | 0 of 360 | 2.1 / 6.3 / 10.0 | 0.1 / 0.2 / 0.2 | 133 of 361 | 2 | 12 | 50.5 | 0 |

### Memory observations (end of drive window)

| Level | Box2D world KiB | Lua heap KiB | WASM linear memory MiB | JS heap |
| --- | --- | --- | --- | --- |
| len-100m | 117.0 | 1483.4 | 256 | unknown |
| len-1km | 117.0 | 1032.9 | 256 | unknown |
| len-10km | 116.3 | 1246.1 | 256 | unknown |
| len-99km | 116.7 | 1240.1 | 256 | unknown |
| start-1000m | 116.3 | 1175.1 | 256 | unknown |
| seg-100 | 116.8 | 1347.7 | 256 | unknown |
| seg-200 | 225.0 | 1440.4 | 256 | unknown |
| seg-400 | 384.6 | 1283.2 | 256 | unknown |
| seg-800 | 803.0 | 2730.6 | 256 | unknown |
| chains-32 | 804.9 | 3650.4 | 256 | unknown |
| hulls-16 | 122.9 | 1290.5 | 256 | unknown |
| hulls-32 | 157.2 | 895.1 | 256 | unknown |
| hulls-64 | 174.6 | 1434.5 | 256 | unknown |
| hulls-64x8 | 174.6 | 1869.0 | 256 | unknown |
| corner-99km-800 | 802.0 | 2106.1 | 256 | unknown |

### Rejected limit cases

| Case | Dimension | Render objects | Text KiB | Message | Physics cost |
| --- | --- | --- | --- | --- | --- |
| reject-length-100km | length | 100 | 1.8 | `Import failed: Non-finite bounds. The current level and its save are unchanged.` | unknown (rejected before build) |
| reject-render-801 | segments | 801 | 12.3 | `Import failed: Station render budget exceeds 800 objects. The current level and its save are unchanged.` | unknown (rejected before build) |
| reject-chain-2049 | segments | 2048 | 31.0 | `Import failed: Invalid chain length. The current level and its save are unchanged.` | unknown (rejected before build) |
| reject-chains-33 | chains | 33 | 1.2 | `Import failed: Missing/too many chains. The current level and its save are unchanged.` | unknown (rejected before build) |
| reject-hulls-65 | hulls | 360 | 6.1 | `Import failed: Invalid hulls. The current level and its save are unchanged.` | unknown (rejected before build) |
| reject-hull-9 | hulls | 109 | 1.7 | `Import failed: Invalid hull vertices. The current level and its save are unchanged.` | unknown (rejected before build) |
| reject-text-256k | text | 100 | 257.6 | `The level file is larger than 256 KiB. The current level and its save are unchanged.` | unknown (rejected before build) |

## Phone results

NOT RUN. Claudio's values from the [phone procedure](#phone-procedure) go here, kept apart from the desktop results.

| Item | Value |
| --- | --- |
| Phone, Chrome version, refresh mode, High DPI | NOT RUN |
| `seg-800` world switch (3 imports) | NOT RUN |
| `seg-800` 30 s capture: callback interval mean/p95/max, over 25 ms, physics step | NOT RUN |
| `len-99km` world switch and 30 s capture | NOT RUN |
| Visible stutter and feel on `seg-800` | NOT RUN |

## Phone procedure

Touch mode hides the page tools; its toolbar has its own **Import level** button, which opens the same Import panel.

1. On the phone, download [`seg-800.json`](https://github.com/bongohorse/rider/raw/main/main/gym/samples/seg-800.json) (400 m, 800 segments: the largest accepted level) and [`len-99km.json`](https://github.com/bongohorse/rider/raw/main/main/gym/samples/len-99km.json) (99 km, 100 segments).
2. Note the Chrome version (Chrome → About), set the phone to 60 Hz, keep High DPI ON and preset A.
3. Open <https://bongohorse.github.io/rider/?station=custom>. Without a saved level the Import panel opens by itself; otherwise tap **Import level** in the toolbar. Choose `seg-800.json` and wait until it drives. Opening Import leaves fullscreen and the file picker may hide the page; both cancel a running capture, so start the capture only after the import.
4. Tap **Measure**, select the refresh mode, tap **Record 30 s** and drive the level with Throttle (Retry as needed). After 30 s tap **Copy report** and paste it into #123. The report contains the line `Level load: switch … ms; parse …; terrain …; decoration …` and the capture values.
5. Repeat steps 3–4 twice more with `seg-800.json` (three switch times; **Import level** → the same file), then once with `len-99km.json`.
6. Drive `seg-800` to its end and add visible stutter (none / occasional / frequent) and anything that felt different from the built-in stations.

## Findings for later tasks

1. **Start distance from the origin (LE2/LE3, decision for Claudio).**
   - **What happens:** a level that passes validation, with its start 1.5 km or more from x = 0, fails when the vehicle is placed: `vehicle.lua:68: Noncanonical reset pose`. The world shows no station error and the vehicle stays inert.
   - **The broken level is still saved:** the save status was `Saved` after every placement failure. LE1a saves when the world reports ready, which is before vehicle placement, so a reload should restore the same broken level; this is inferred, not tested. Importing another level recovers.
   - **Cause:** the reset guard allows 0.01 engine units (0.1 mm). Engine positions are float32, and between about 655 m and 2.6 km one float32 step is 1/128–1/64 unit, so whether a value passes depends on the exact coordinate. This is the tolerance of that guard, not evidence that the physics itself breaks down.
   - **Options:**
     - (a) The LE2 source validator limits starts (and later checkpoints) to 1 km from the origin.
     - (b) The editor's compile step shifts each level so its start lies near x = 0.
     - (c) Make the guard's tolerance scale with coordinate size. This is a vehicle/physics contract change.
     - Independent of a–c: save an import only after the vehicle is drive-ready.
   - **Not measured:** driving more than about 50 m away from the start, so precision effects far from the origin are unknown.
2. **Switch-frame spike at full budget:** 21–26 ms at 612–800 objects on desktop. It matters for LE3/LE5 re-checks with editor overlays, and for phone values.
3. **Validator wording (R16):** coordinates at or beyond 100 km report `Non-finite bounds` although the values are finite but out of range. The source validator should name the range.
4. **Text fields are unbounded:** the level `name` reaches the measurements message as `station_name`, and `msg.post` caps payloads at 2048 bytes. A very long name could exceed that (not tested). LE2's source validator should bound text fields.
5. **Touch import entry:** found here and fixed in [PR #142](https://github.com/bongohorse/rider/pull/142): the touch toolbar has its own **Import level** button. The release preview case `touch_import_entry_with_saved_level` covers it in Chromium touch emulation: imports from a built-in station, with a saved level, and after reloading `?station=custom`; held throttle goes neutral; portrait layout. On a real phone: NOT RUN.
6. **Not covered:** hull contact cost (the generated hulls do not touch the vehicle), GPU/render time, the JS heap and phone devices.

## Reproduction

```sh
python tools/gym/smoke.py --output artifacts/le1b --case le1b      # builds a debug bundle, or reuse one with --bundle
node tools/gym/levels.cjs artifacts/le1b-levels                      # writes every case as JSON plus index.json
```

The run writes `sizes-result.json` (all raw statistics) and `sizes-report.md` (the tables above). CI runs the case in the G1 HTML5 job (`artifacts/g1/sizes`). `LE1B_REPEATS` and `LE1B_SAMPLE_MS` change repeats and window for local experiments; reported values use the defaults.

## Engine sources

Pinned Defold 1.14.0 `a81dbb0`:

- HTML5 runs the engine from `emscripten_set_main_loop_arg(…, 0, 1)`, i.e. one `requestAnimationFrame` callback per browser frame ([engine_loop.cpp L95](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/engine/src/engine_loop.cpp#L95)); the engine does not pace or sleep on Emscripten ([L27–L35](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/engine/src/engine_loop.cpp#L27-L35)). With `update_frequency = 60` a slower callback runs one longer step ([engine.cpp L2387–L2412](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/engine/src/engine.cpp#L2387-L2412)).
- `b2d.world.get_profile` and `b2d.world.get_counters` fields ([script_box2d_world_v3.cpp L479–L550](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/gamesys/src/gamesys/scripts/box2d/v3/script_box2d_world_v3.cpp#L479-L550)); Box2D times its profile with `clock_gettime(CLOCK_MONOTONIC)` ([timer.c L68–L76](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/external/box2d/Box2D/src/timer.c#L68-L76)), which Emscripten maps to `performance.now()`; `CLOCK_REALTIME` behind `socket.gettime` maps to `Date.now()` (generated `_clock_time_get` in the engine JavaScript).
- `msg.post` payloads are limited to 2048 bytes ([script_msg.cpp L88](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/script/src/script_msg.cpp#L88)); the Box2D counters therefore go to the page directly instead of growing the measurements message.
