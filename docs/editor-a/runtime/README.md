# Implemented Editor A UI

Actual HTML5 debug screenshots for [#171](https://github.com/bongohorse/rider/issues/171), captured by the extended `le6` browser protocol. The [approved static designs](../README.md) remain separate. Behaviour and measured budgets are specified in the [editor contract](../../contracts/level-editor.md#editor-a1b-implementation-171).

**Contents:** [Desktop layouts](#desktop-layouts) · [HiDPI and scrolling](#hidpi-and-scrolling) · [Capture identity](#capture-identity)

## Desktop layouts

Build / Prefab → Ramp, then selected Ramp (8 m horizontal length, 20 deg). These images show the rendered controls; the sample courses differ from the schematic proposal.

![Build at 1280 by 720](editor-a-build-1280x720.png)

![Selected Ramp at 1280 by 720](editor-a-ramp-1280x720.png)

![Build at 1920 by 1080](editor-a-build-1920x1080.png)

![Selected Ramp at 1920 by 1080](editor-a-ramp-1920x1080.png)

## HiDPI and scrolling

1280×720 CSS viewport, DPR 2 / 2560×1440 framebuffer. The logical control sizes match the DPR 1 layout.

![HiDPI editor](editor-a-hidpi.png)

The Kicker's seventh parameter is reached by scrolling its inspector. The wheel does not zoom the canvas or change geometry/history.

![Seven-parameter inspector](editor-a-seven-parameters.png)

## Capture identity

Defold 1.14.0 (`a81dbb0478e8b73931dc2d671563204f6ac0ef82`), Playwright Chromium `156.0.8078.4` on Linux. The local debug bundle was built from base `f34666d3dacc86948542f53c657f278f685835f1fc` plus this task's working UI diff; the exact base is `f34666d3dacc8699734a653fdd686916300840ce`. Capture run `6a9a2a02-5559-4a81-bdf1-ffa381e26bc1`, `tools/gym/smoke.py --bundle artifacts/171-debug-17 --output artifacts/171-le6-17 --case le6`. Build inventory/engine guard and JSON results are retained locally in those artifact directories; PR-head CI independently rebuilds and runs the same protocol. Local working-diff captures are not claimed as committed-head or deployed-build evidence. Pointer/keyboard input is synthetic; these images do not establish physical-device behaviour or Claudio's practical acceptance.
