(() => {
  if (window.riderBackgroundPanel) return;
  // DOM presents a draft; Lua validates and owns source, preview, Apply, Undo and storage.
  const AUTO = [.9, .75, .55, .35, .15, -.1];
  const api = window.riderBackgroundPanel = {visible: false, queue: [], message: ''};
  let panel, presets = [], draft = null;
  const copy = value => value ? structuredClone(value) : null;
  function send(message) {
    // Slider input coalesces; its release commits the newest value.
    if (message.type === 'draft') {
      const last = api.queue.at(-1);
      if (last?.type === 'draft') { api.queue[api.queue.length - 1] = message; return; }
    }
    if (api.queue.length < 16) api.queue.push(message);
  }
  function defaults(preset) {
    return {version: 1, preset, enabled: true, layers: AUTO.map(depth => ({visible: true, auto: true, depth}))};
  }
  function render() {
    if (!panel) return;
    panel.querySelectorAll('[data-background-preset]').forEach(button => {
      const selected = !!draft && button.dataset.backgroundPreset === draft.preset;
      button.setAttribute('aria-pressed', String(selected));
      button.style.outline = selected ? '3px solid #8fe0c0' : 'none';
    });
    const master = panel.querySelector('#rider-background-enabled');
    master.checked = !!draft?.enabled; master.disabled = !draft;
    AUTO.forEach((value, i) => {
      const row = panel.querySelector(`[data-layer="${i + 1}"]`), layer = draft?.layers[i];
      row.querySelector('.visible').checked = !!layer?.visible;
      row.querySelector('.auto').checked = !!layer?.auto;
      row.querySelector('.image').value = layer?.image?.preset || '';
      row.querySelector('.depth').value = layer?.auto ? value : layer?.depth ?? value;
      row.querySelector('output').textContent = Number(layer?.auto ? value : layer?.depth ?? value).toFixed(2);
      row.querySelectorAll('input,select').forEach(input => input.disabled = !draft);
      row.querySelector('.depth').disabled = !draft || layer.auto;
    });
    panel.querySelector('#rider-background-note').textContent = api.message || (!draft ? 'Choose a preset.' : '');
  }
  function changed() { send({type: 'commit', backgrounds: copy(draft)}); render(); }
  function preview() { send({type: 'draft', backgrounds: copy(draft)}); render(); }
  function button(label, action) {
    const node = document.createElement('button');node.type = 'button';node.textContent = label;
    node.style.cssText = 'padding:6px 10px;cursor:pointer';node.onclick = action;return node;
  }
  function build() {
    panel = document.createElement('section');panel.id = 'rider-background-panel';panel.setAttribute('aria-label', 'Background');
    panel.style.cssText = 'position:fixed;right:16px;top:64px;z-index:99998;box-sizing:border-box;width:min(700px,calc(100vw - 32px));max-height:calc(100vh - 96px);overflow:auto;padding:12px;background:#17272f;color:#eef;border:1px solid #4a6a78;border-radius:6px;font:14px sans-serif';
    const tabs = document.createElement('div');tabs.setAttribute('role', 'tablist');tabs.style.cssText = 'display:flex;gap:6px;margin-bottom:10px';
    const track = button('Texture', () => send({type: 'track'}));track.setAttribute('role', 'tab');track.setAttribute('aria-selected', 'false');
    const background = button('Background', () => {});background.setAttribute('role', 'tab');background.setAttribute('aria-selected', 'true');tabs.append(track, background);panel.append(tabs);
    const masterLabel = document.createElement('label');masterLabel.style.cssText = 'display:flex;gap:8px;align-items:center;font-size:17px;margin-bottom:10px';
    const master = document.createElement('input');master.type = 'checkbox';master.id = 'rider-background-enabled';master.onchange = () => { if (draft) { draft.enabled = master.checked;changed(); } };
    masterLabel.append(master, 'Background ON/OFF');panel.append(masterLabel);
    const grid = document.createElement('div');grid.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px';
    for (const preset of presets) {
      const pick = button(preset.name, () => { draft = draft || defaults(preset.id);draft.preset = preset.id;changed(); });
      pick.dataset.backgroundPreset = preset.id;pick.style.cssText += ';padding:2px;background:#22363f;color:#eef;border:1px solid #4a6a78;border-radius:4px;font:12px sans-serif';
      const img = document.createElement('img');img.src = preset.thumb;img.alt = '';img.style.cssText = 'display:block;width:100%;aspect-ratio:2';pick.prepend(img);grid.append(pick);
    }
    panel.append(grid);
    AUTO.forEach((_, i) => {
      const row = document.createElement('fieldset');row.dataset.layer = i + 1;row.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 8px;padding:6px;border:1px solid #4a6a78';
      const title = i === 5 ? 'Foreground' : `Layer ${i + 1}`;
      const legend = document.createElement('legend');legend.textContent = title;row.append(legend);
      const label = (text, input) => { const node = document.createElement('label');node.style.cssText = 'display:flex;align-items:center;gap:4px';node.append(input, text);row.append(node); };
      const visible = document.createElement('input');visible.type = 'checkbox';visible.className = 'visible';visible.setAttribute('aria-label', `${title} ON/OFF`);
      visible.onchange = () => { draft.layers[i].visible = visible.checked;changed(); };label('ON/OFF', visible);
      const image = document.createElement('select');image.className = 'image';image.setAttribute('aria-label', `${title} image`);
      for (const [id, name] of [['', 'Preset image'], ...presets.map(p => [p.id, p.name])]) { const option = document.createElement('option');option.value = id;option.textContent = name;image.append(option); }
      image.onchange = () => { if (image.value) draft.layers[i].image = {preset: image.value};else delete draft.layers[i].image;changed(); };row.append(image);
      const depth = document.createElement('input');depth.type = 'range';depth.className = 'depth';depth.min = '-0.25';depth.max = '1';depth.step = '.01';depth.style.width = '120px';depth.setAttribute('aria-label', `${title} Depth`);depth.title = 'Higher Depth moves more slowly. Turn Auto off to use your manual value.';
      depth.oninput = () => { draft.layers[i].depth = Number(depth.value);preview(); };depth.onchange = () => { draft.layers[i].depth = Number(depth.value);changed(); };label('Depth', depth);
      row.append(document.createElement('output'));
      const auto = document.createElement('input');auto.type = 'checkbox';auto.className = 'auto';auto.setAttribute('aria-label', `${title} Auto`);auto.title = 'Use automatic Depth; your manual value is kept.';
      auto.onchange = () => { draft.layers[i].auto = auto.checked;changed(); };label('Auto', auto);panel.append(row);
    });
    const footer = document.createElement('div');footer.style.cssText = 'position:sticky;bottom:-12px;background:#17272f;padding:8px 0 4px';
    const note = document.createElement('p');note.id = 'rider-background-note';note.setAttribute('aria-live', 'polite');note.style.cssText = 'min-height:1.3em;margin:0 0 8px;color:#ffd08a';footer.append(note);
    for (const [id, text] of [['close', 'Close']]) {
      const action = button(text, () => send({type: id}));action.id = `rider-background-${id}`;action.style.marginRight = '6px';footer.append(action);
    }
    panel.append(footer);
    for (const event of ['keydown', 'keyup', 'keypress']) panel.addEventListener(event, e => e.stopPropagation());
    document.body.append(panel);
  }
  api.open = (list, backgrounds) => { presets = list;if (!panel) build();draft = copy(backgrounds);api.message = '';api.queue.length = 0;api.suspended = false;panel.hidden = false;api.visible = true;render(); };
  api.close = () => { if (panel) panel.hidden = true;api.visible = false;api.suspended = false;api.queue.length = 0;document.querySelector('canvas')?.focus(); };
  api.show = (backgrounds, message) => { draft = copy(backgrounds);api.message = message || '';render(); };
  api.suspend = blocked => { api.suspended = !!blocked;if (panel) panel.hidden = !api.visible || api.suspended; };
  api.take = () => JSON.stringify(api.queue.splice(0, api.queue.length));
})();
