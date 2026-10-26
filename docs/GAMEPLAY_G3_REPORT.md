# Authored medal times (#298)

**Contents:** [Behavior and authoring](#behavior-and-authoring) · [Competition and revision policy](#competition-and-revision-policy) · [Verification](#verification) · [Preview and stop point](#preview-and-stop-point) · [Engine evidence](#engine-evidence)

## Behavior and authoring

Three optional target times per level: Gold < Silver < Bronze, positive finite seconds below 86400. Compare the completed authoritative attempt's unrounded simulation time with inclusive `<=`, highest medal first. No deadline: a slower valid finish still completes and saves its time. The result card shows time, medal (or completed without medal), personal best/save state and next target plus the required improvement. Gold shows that all targets were beaten. The displayed clock/targets use two decimals; scoring never rounds. The displayed improvement rounds upward to 0.01 s so a narrowly missed boundary never reads as zero. The compact best readout includes the acknowledged highest saved medal; the result's medal describes this attempt only. A practice attempt is explicitly labeled and never updates official achievements.

Level Properties → MEDAL TARGETS expands three existing numeric controls. Enter commits, Esc cancels, Tab/Shift+Tab cycles, +/- uses the existing modifier pattern; every completed edit and Remove is one normal Undo step and autosaves through the existing draft/My levels system. First explicit edit on an untargeted level enables 26/30/40 s provisional defaults. Invalid input leaves all old targets intact. When increasing all times, edit Bronze → Silver → Gold; when decreasing, use Gold → Silver → Bronze. Save/Export/Play copy the versioned triple into compiled data. Legacy levels stay untargeted until explicitly edited. Editor/compiler version 8 prevents older editors silently discarding the new data; versions 1–7 migrate without changing geometry or Terrain Look. Future target fields/versions stay protected.

The first-run course uses provisional **Gold 26 s, Silver 30 s, Bronze 40 s**. The earlier release straight-throttle reference was approximately 25.83 s, providing a reproducible initial Gold pace; these are playtest values, not final balancing.

## Competition and revision policy

Official records remain reserved for shipped resources, using the same buggy, unmodified preset A, crash enabled, zero launch speed, time factor 1 and no replay/debug/test start. The same run adapter supports shipped finish-bearing levels with target times. Imported/editor/template copies keep their practice boundary, regardless of their id or copied metadata; authoring never grants official status. Existing practice workflows retain their finish toast and do not create a second scoring authority.

A shipped level's `race_revision` is a positive integer, default 1 for legacy resources. Record identity is `<level-id>-course<race_revision>-rules1-buggy-a-crash`. Maintainers must increment it when changing physical geometry, spawn/launch, finish or level gameplay rules; changes to vehicle/physics/rule implementation must increment the shared `rules1` part before release. The previous namespace remains intact. Editor copies cannot alter official namespaces. Terrain Look, labels, name and target times are cosmetic/balancing metadata for this identity and do **not** increment either revision. This is an explicit resource-maintenance rule, not automatic detection of geometry edits.

Target changes preserve both fastest time and highest historical medal in the same competition. Harder targets never remove an earned medal. A new valid finish is evaluated against the current targets and can improve either stored value independently; easier targets do not award a medal merely on opening an old record. The result shows today's earned medal and next target even when the historical highest is better. No retroactive reinterpretation of old bests is needed.

Record format 2 adds integer `medal` (0–3) to the existing version-1 key/time record in the same alternating files. Legacy fastest times load unchanged with no invented historical medal; the next valid medal can upgrade the save even on a slower finish. Merge slot minima/maxima defensively. A save commits the minimum time and maximum medal and publishes them only after the existing IndexedDB acknowledgement. Unreadable/corrupt/future slots stay protected, retaining any usable survivor; write/sync failures show unsaved status without claiming durable improvement. A valid finish without a medal is still persisted (best existence also records completion). No account, unlock or reward framework is introduced.

## Verification

Focused production Lua checks cover exact and just-missed boundaries, invalid/future targets, source/compiled comparison, legacy migration, next target, practice/revision/cosmetic isolation, canonical result/Retry, record-version upgrade, independent monotonic time/medal, slower no-medal completion, corrupt alternate protection and failed acknowledgements. Runtime/browser verification is recorded with exact source/build identity in the PR; synthetic input does not establish real-device behavior. No physics, camera, terrain geometry, driving resources or pool-cap changes are intended; two fixed result text nodes reuse the existing GUI lifecycle.

## Preview and stop point

Issue #298 is a child of #262, with Claudio GO after accepted #296 / merged #297. Deliver a verified normal release preview; **stop before merge for Claudio's drive test**. No next task is authorized. Test provisional difficulty, result/next-target readability, Retry and reopen, and the editor's targets/Undo/save workflow.

## Engine evidence

Pinned Defold 1.14.0. The existing alternating `sys.save`/`sys.load` wrapper and HTML5 sync acknowledgement remain the durability boundary: [pinned sys bindings](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/script/src/script_sys.cpp). Existing `gui.set_text`, visibility and node creation/layout patterns render two additional fixed labels: [pinned GUI bindings](https://github.com/defold/defold/blob/a81dbb0478e8b73931dc2d671563204f6ac0ef82/engine/gui/src/gui_script.cpp). No new engine API, physics owner, fixed callback or timer is introduced. Actual builds/runtime checks, not these references alone, establish support.
