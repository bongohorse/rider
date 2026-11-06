(() => {
  if (window.riderTrackPanel) return;
  // Track textures panel (#543). HTML only: Lua owns the document, validation, preview and Apply.
  const OVERRIDES = [['surface', 'Surface'], ['band', 'Band'], ['fill', 'Fill']];
  const api = window.riderTrackPanel = {visible: false, queue: [], message: ''};
  let panel, presets = [], draft = null;
  const send = message => { if (api.queue.length < 16) api.queue.push(message); };
  function render() {
    if (!panel) return;
    panel.querySelectorAll('[data-preset]').forEach(b => {
      const on = draft && b.dataset.preset === draft.preset;
      b.setAttribute('aria-pressed', String(!!on));
      b.style.outline = on ? '3px solid #8fe0c0' : 'none';
    });
    for (const [key] of OVERRIDES) { const s = panel.querySelector('#rider-track-' + key);s.value = (draft && draft[key]) || '';s.disabled = !draft; }
    panel.querySelector('#rider-track-note').textContent = api.message;
  }
  function changed() { send({type: 'draft', material: draft}); render(); }
  function build() {
    panel = document.createElement('section');panel.id = 'rider-track-panel';
    panel.setAttribute('aria-label', 'Track textures');
    panel.style.cssText = 'position:fixed;right:16px;top:64px;z-index:99998;box-sizing:border-box;width:min(340px,calc(100vw - 32px));max-height:calc(100vh - 96px);overflow:auto;padding:12px;background:#17272f;color:#eef;border:1px solid #4a6a78;border-radius:6px;font:14px sans-serif';
    const tabs = document.createElement('div');tabs.setAttribute('role','tablist');tabs.style.cssText='display:flex;gap:6px;margin-bottom:8px';
    for (const [name,selected] of [['Track textures',true],['Background',false]]) { const tab=document.createElement('button');tab.type='button';tab.textContent=name;tab.setAttribute('role','tab');tab.setAttribute('aria-selected',String(selected));tab.onclick=()=>{if(!selected)send({type:'background'});};tabs.append(tab); }
    panel.append(tabs);
    const h = document.createElement('h2');h.textContent = 'Track textures';h.style.cssText = 'margin:0 0 8px;font-size:17px';panel.append(h);
    const grid = document.createElement('div');grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:6px';
    for (const p of presets) {
      const b = document.createElement('button');b.type = 'button';b.dataset.preset = p.id;
      b.style.cssText = 'padding:2px;background:#22363f;color:#eef;border:1px solid #4a6a78;border-radius:4px;font:12px sans-serif;cursor:pointer';
      const i = document.createElement('img');i.src = p.thumb;i.alt = '';i.style.cssText = 'display:block;width:100%';
      b.append(i, p.name);
      b.onclick = () => { draft = Object.assign({version: 1, surface: null, band: null, fill: null}, draft || {}, {preset: p.id}); changed(); };
      grid.append(b);
    }
    panel.append(grid);
    for (const [key, label] of OVERRIDES) {
      const row = document.createElement('label');row.style.cssText = 'display:flex;justify-content:space-between;margin-top:8px';row.textContent = label;
      const s = document.createElement('select');s.id = 'rider-track-' + key;s.setAttribute('aria-label', label + ' override');
      const inherit = document.createElement('option');inherit.value = '';inherit.textContent = 'Inherit';s.append(inherit);
      for (const p of presets) { const o = document.createElement('option');o.value = p.id;o.textContent = p.name;s.append(o); }
      s.onchange = () => { if (!draft) return;draft[key] = s.value || null;changed(); };
      row.append(s);panel.append(row);
    }
    const note = document.createElement('p');note.id = 'rider-track-note';note.setAttribute('aria-live', 'polite');note.style.cssText = 'min-height:1.3em;margin:8px 0;color:#ffd08a';panel.append(note);
    const row = document.createElement('div');row.style.cssText = 'display:flex;gap:6px';
    for (const [id, label] of [['apply', 'Apply'], ['discard', 'Discard'], ['close', 'Close']]) {
      const b = document.createElement('button');b.type = 'button';b.id = 'rider-track-' + id;b.textContent = label;b.style.padding = '6px 12px';
      b.onclick = () => send({type: id});row.append(b);
    }
    panel.append(row);
    // Panel input never reaches the game's keys.
    for (const name of ['keydown', 'keyup', 'keypress']) panel.addEventListener(name, e => e.stopPropagation());
    document.body.append(panel);
  }
  api.open = (list, material) => {
    presets = list;if (!panel) build();
    draft = material ? Object.assign({surface: null, band: null, fill: null}, material) : null;
    api.message = '';panel.hidden = false;api.visible = true;render();
  };
  api.close = () => { if (panel) panel.hidden = true;api.visible = false;api.queue.length = 0;document.querySelector('canvas')?.focus(); };
  api.show = (material, message) => {
    draft = material ? Object.assign({surface: null, band: null, fill: null}, material) : null;
    api.message = message || '';render();
  };
  api.take = () => JSON.stringify(api.queue.splice(0, api.queue.length));
})();
