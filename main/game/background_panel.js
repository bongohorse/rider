(() => {
  if (window.riderBackgroundPanel) return;
  // DOM presents a draft; Lua validates and owns source, preview, commit, Undo and storage.
  // #706: presets, ON/OFF, layer visibility, Depth and Auto are in the library's Background tab
  // (main/editor/web/chrome.js); this panel keeps each layer's image and vertical settings until #686.
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
  function render() {
    if (!panel) return;
    AUTO.forEach((value, i) => {
      const row = panel.querySelector(`[data-layer="${i + 1}"]`), layer = draft?.layers[i];
      row.querySelector('.image').value = layer?.image?.preset || '';
      row.querySelectorAll('input,select').forEach(input => input.disabled = !draft);
      if (i < 5) {
        for (const [field, value] of [['vertical_position', layer?.vertical_position ?? 0], ['vertical_parallax', layer?.vertical_parallax ?? 1 - AUTO[i]]]) {
          row.querySelector(`.${field}`).value = value;
          row.querySelector(`.${field}-output`).textContent = Number(value).toFixed(2);
        }
      }
    });
    panel.querySelector('#rider-background-note').textContent = api.message || (!draft ? 'Choose a background in the library first.' : '');
  }
  function changed() { send({type: 'commit', backgrounds: copy(draft)}); render(); }
  function preview() { send({type: 'draft', backgrounds: copy(draft)}); render(); }
  function button(label, action) {
    const node = document.createElement('button');node.type = 'button';node.textContent = label;
    node.style.cssText = 'padding:6px 10px;cursor:pointer';node.onclick = action;return node;
  }
  function build() {
    panel = document.createElement('section');panel.id = 'rider-background-panel';panel.setAttribute('aria-label', 'Background');
    panel.style.cssText = 'position:fixed;right:16px;top:64px;z-index:99998;box-sizing:border-box;width:min(560px,calc(100vw - 32px));max-height:calc(100vh - 96px);overflow:auto;padding:12px;background:#17272f;color:#eef;border:1px solid #4a6a78;border-radius:6px;font:14px sans-serif';
    const heading = document.createElement('h2');heading.textContent = 'Background layers';heading.style.cssText = 'margin:0 0 10px;font-size:17px';panel.append(heading);
    AUTO.forEach((_, i) => {
      const row = document.createElement('fieldset');row.dataset.layer = i + 1;row.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 8px;padding:6px;border:1px solid #4a6a78';
      const title = i === 5 ? 'Foreground' : `Layer ${i + 1}`;
      const legend = document.createElement('legend');legend.textContent = title;row.append(legend);
      const label = (text, input) => { const node = document.createElement('label');node.style.cssText = 'display:flex;align-items:center;gap:4px';node.append(input, text);row.append(node); };
      const image = document.createElement('select');image.className = 'image';image.setAttribute('aria-label', `${title} image`);
      for (const [id, name] of [['', 'Preset image'], ...presets.map(p => [p.id, p.name])]) { const option = document.createElement('option');option.value = id;option.textContent = name;image.append(option); }
      image.onchange = () => { if (image.value) draft.layers[i].image = {preset: image.value};else delete draft.layers[i].image;changed(); };row.append(image);
      if (i < 5) {
        for (const [field, name, min, max, step, help] of [
          ['vertical_position', 'Vertical position', -4, 4, '.05', 'Metres: positive moves the image up.'],
          ['vertical_parallax', 'Vertical parallax', 0, 1, '.01', 'Camera-height motion: 0 is fixed, 1 travels 0.75 metres each way. Independent of Depth and Auto.']
        ]) {
          const input = document.createElement('input');input.type = 'range';input.className = field;
          input.min = min;input.max = max;input.step = step;input.style.width = '120px';input.setAttribute('aria-label', `${title} ${name}`);input.title = help;
          const update = commit => { draft.version = 2;draft.layers[i][field] = Number(input.value);if (commit) changed();else preview(); };
          input.oninput = () => update(false);input.onchange = () => update(true);input.onpointercancel = () => { if (draft) changed(); };
          label(name, input);const output = document.createElement('output');output.className = `${field}-output`;row.append(output);
        }
      }
      panel.append(row);
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
  api.suspend = blocked => { api.suspended = !!blocked;if (blocked) api.queue.length = 0;if (panel) panel.hidden = !api.visible || api.suspended; };
  api.take = () => JSON.stringify(api.queue.splice(0, api.queue.length));
})();
