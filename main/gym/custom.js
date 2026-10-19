(() => {
  if (window.riderCustom) return;
  // Web file/paste helper only (D-E1). Lua owns parsing, validation, loading and saving.
  const limit = 256 * 1024;
  const api = window.riderCustom = {visible:false,request:0,pending:null,state:'',message:'',syncFailed:false,syncStopped:false};
  let panel;
  function status(text, error) {
    const node = panel?.querySelector(error ? '#rider-custom-error' : '#rider-custom-status');
    if (node) node.textContent = text;
    if (error && panel) panel.querySelector('#rider-custom-status').textContent = '';
    if (!error && panel) panel.querySelector('#rider-custom-error').textContent = '';
  }
  function reject(message) {api.state = 'error';api.message = message + ' The current level and its save are unchanged.';status(api.message, true);}
  // Each import takes its request number when it starts, so a slower older file read cannot win.
  function submit(text, request = ++api.request) {
    if (request !== api.request) return;
    if (text.length > limit) {reject('The level file is larger than 256 KiB.');return;}
    // editor: opened by the level editor's Import (LE4); Lua routes it by this flag, not by the mode.
    api.pending = {request, text, editor: api.editorImport};
    api.state = 'reading';api.message = 'Checking level...';status(api.message);
  }
  api.importFile = async chosen => {
    const request = ++api.request;
    if (chosen.size > limit) {reject('The level file is larger than 256 KiB.');return;}
    let text;
    try {text = await chosen.text();}
    catch (error) {if (request === api.request) reject('The level file could not be read.');return;}
    submit(text, request);
  };
  api.open = (message, editor) => {
    // A page import replaces the level; it is not offered while the level editor is open (R15 input
    // gating). The editor's own Import button opens the panel with editor=true (LE4: opens as a copy).
    if (window.riderEditing && !editor) return;
    closeExport();
    api.editorImport = !!editor;
    if (!panel) {
      panel = document.createElement('section');panel.id = 'rider-custom-panel';
      panel.setAttribute('aria-label', 'Import custom level');
      panel.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:99999;box-sizing:border-box;width:min(520px,calc(100vw - 32px));padding:14px;background:#18313b;color:#dceee6;border:1px solid #68cdbc;border-radius:6px;font:14px system-ui';
      const heading = document.createElement('h2');heading.textContent = 'Import custom level';heading.style.cssText = 'margin:0 0 8px;font-size:16px';
      const note = document.createElement('p');note.id = 'rider-custom-note';note.style.margin = '0 0 8px';
      const file = document.createElement('input');file.type = 'file';file.id = 'rider-custom-file';file.accept = '.json,application/json';
      file.setAttribute('aria-label', 'Level file');
      file.onchange = () => {
        const chosen = file.files?.[0];file.value = '';
        if (chosen) api.importFile(chosen);
      };
      const field = document.createElement('textarea');field.id = 'rider-custom-text';field.placeholder = 'Or paste level JSON here';
      field.setAttribute('aria-label', 'Level JSON');
      field.style.cssText = 'display:block;box-sizing:border-box;width:100%;height:160px;margin:8px 0;font:12px monospace';
      const row = document.createElement('div');row.style.cssText = 'display:flex;gap:6px';
      const load = document.createElement('button');load.type = 'button';load.textContent = 'Import text';load.onclick = () => submit(field.value);
      const close = document.createElement('button');close.type = 'button';close.textContent = 'Close import';close.onclick = api.close;
      row.append(load, close);
      const error = document.createElement('p');error.id = 'rider-custom-error';error.setAttribute('role', 'alert');error.style.cssText = 'margin:8px 0 0;color:#ff9b8a';
      const state = document.createElement('p');state.id = 'rider-custom-status';state.setAttribute('aria-live', 'polite');state.style.margin = '8px 0 0';
      panel.append(heading, note, file, field, row, error, state);
      panel.addEventListener('keydown', event => {if (event.key === 'Escape') api.close();});
      document.body.append(panel);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    }
    panel.querySelector('#rider-custom-note').textContent = message || 'Choose a level file (.json) or paste its JSON. The last valid level is saved in this browser.';
    api.visible = true;panel.querySelector('#rider-custom-file').focus();
  };
  // Export (LE4): download the compiled level file; the panel also shows its text as a copy fallback.
  let exported;
  function closeExport() {
    if (!exported) return;
    exported.remove();exported = null;api.visible = false;
    document.querySelector('canvas')?.focus();
  }
  api.exportLevel = ({name, text}) => {
    if (panel) api.close();
    closeExport();
    const url = URL.createObjectURL(new Blob([text], {type:'application/json'}));
    const link = document.createElement('a');link.href = url;link.download = name;
    document.body.append(link);link.click();link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    api.lastExport = {name, bytes:new TextEncoder().encode(text).length};
    exported = document.createElement('section');exported.id = 'rider-export-panel';
    exported.setAttribute('aria-label', 'Export level');
    exported.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:99999;box-sizing:border-box;width:min(520px,calc(100vw - 32px));padding:14px;background:#18313b;color:#dceee6;border:1px solid #68cdbc;border-radius:6px;font:14px system-ui';
    const heading = document.createElement('h2');heading.textContent = 'Export level';heading.style.cssText = 'margin:0 0 8px;font-size:16px';
    const note = document.createElement('p');note.style.margin = '0 0 8px';
    note.textContent = `Downloaded ${name}. If no file appeared, copy the text below and save it as a .json file.`;
    const field = document.createElement('textarea');field.id = 'rider-export-text';field.readOnly = true;field.value = text;
    field.setAttribute('aria-label', 'Level JSON');
    field.style.cssText = 'display:block;box-sizing:border-box;width:100%;height:160px;margin:8px 0;font:12px monospace';
    const close = document.createElement('button');close.type = 'button';close.textContent = 'Close export';close.onclick = closeExport;
    exported.append(heading, note, field, close);
    exported.addEventListener('keydown', event => {if (event.key === 'Escape') closeExport();});
    document.body.append(exported);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    api.visible = true;field.focus();field.select();
  };
  api.closeExport = closeExport;
  // Leaving the editor closes its panels: an editor import must not land in Play (LE4).
  api.closeEditor = () => {closeExport();if (panel && api.editorImport) api.close();};
  api.close = () => {
    api.visible = false;
    if (panel) panel.remove();panel = null;
    document.querySelector('canvas')?.focus();
  };
  api.take = () => {
    const pending = api.pending;api.pending = null;
    return pending ? JSON.stringify(pending) : '';
  };
  api.result = result => {
    if (result.request !== api.request) return; // a newer import superseded this one
    api.state = result.state;api.message = result.message;
    if (result.state === 'loaded') api.close();
    else status(result.message, result.state === 'error');
  };
  // The pinned dmloader syncs MEM->IndexedDB after each file close and only logs errors.
  // Once its retries are exhausted, _startSyncFS leaves _syncInProgress set for good and never
  // syncs again in this page, so that call is recorded as a terminal failure.
  if (typeof Module !== 'undefined' && typeof Module._startSyncFS === 'function') {
    const start = Module._startSyncFS;
    Module._startSyncFS = function () {
      if (!(Module._syncMaxTries > Module._syncTries)) api.syncStopped = true;
      return start.apply(this, arguments);
    };
  }
  api.syncState = () => {
    if (typeof Module === 'undefined' || Module.persistentStorage !== true) return 'session';
    if (api.syncStopped) return 'failed';
    if (Module._syncTries > 0) api.syncFailed = true;
    if (Module._syncInProgress || Module._syncNeeded) return 'syncing';
    return api.syncFailed ? 'failed' : 'saved';
  };
  api.watchSync = () => {api.syncFailed = false;};
  const tools = document.getElementById('page-tools');
  if (tools && !document.getElementById('custom-import')) {
    const button = document.createElement('button');button.id = 'custom-import';button.type = 'button';button.textContent = 'Import level';
    button.onclick = () => api.open();
    tools.prepend(button);
  }
  document.addEventListener('keydown', event => {
    if (event.code !== 'KeyI' || event.repeat || window.riderEditing || event.ctrlKey || event.metaKey || event.altKey || api.visible || /^(INPUT|TEXTAREA|BUTTON|SELECT)$/.test(event.target?.tagName) || event.target?.isContentEditable) return;
    event.preventDefault();api.open();
  });
  // Level editor: Alt is the 0.1 m grid modifier (R6). While editing, keep the browser from treating a
  // lone Alt press as a menu shortcut; the engine still receives the key.
  for (const type of ['keydown', 'keyup']) document.addEventListener(type, event => {
    if (window.riderEditing && event.key === 'Alt') event.preventDefault();
  });
})();
