# Editor A3 runtime captures

Actual Chromium 156.0.8078.4 captures of pinned Defold 1.14.0 HTML5 bundles, built from `3291d0f` plus the A3 working diff. These are runtime captures, not UI previews or device observations.

- [Release Versions dialog, 1280×720](release-versions-1280.png): named snapshot and automatic version, local timestamps and source-object counts.
- [Release after restore, 1280×720](release-restored-1280.png): after creating one line and reloading, restore the named empty design; persisted source revision 2 / one object → revision 3 / zero objects. No `window.riderEditor` debug global, no observed runtime errors. The outgoing design also remains a version.
- [Debug Versions dialog, 1280×480](versions-1280x480.png): responsive three-row page; the normal desktop page has six rows. The cap/failure protocol intentionally ends with a refused history write, displayed in the dialog.

The automated `ea3` protocol covers connected sources and prefab parameters, exact source restore after reload, one-step Undo/Redo, automatic scheduling and document switches, unplayable drafts, unsupported versions, injected version/index-write and browser-sync failures, per-level and total limits, automatic pruning and level deletion. Full commands and storage contract: [recoverable versions](../../contracts/level-editor.md#recoverable-versions-editor-a3). Local reports and logs are under `artifacts/a3/`; CI retains its own reports. Practical acceptance belongs to Claudio: save a named course, change it, reload, restore, drive, then Undo or restore the pre-restore state.
