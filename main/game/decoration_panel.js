(() => {
  if (window.riderDecorationPanel) return;
  // DOM presents; Lua validates and owns source, Undo and storage.
  const api = window.riderDecorationPanel = {visible: false, queue: []};
  let panel, state = null;
  const send = message => { if (api.queue.length < 16) api.queue.push(message); };
  function render() {
    if (!panel || !state) return;
    const item = state.selected || null;
    panel.querySelectorAll('[data-decoration-asset]').forEach(node => {
      const on = node.dataset.decorationAsset === state.asset;
      node.setAttribute('aria-pressed', String(on));node.style.outline = on ? '3px solid #8fe0c0' : 'none';
    });
    const placement = item ? item.placement : state.placement;
    panel.querySelectorAll('[data-decoration-placement]').forEach(node => {
      const on = node.dataset.decorationPlacement === placement;
      node.setAttribute('aria-pressed', String(on));node.style.outline = on ? '3px solid #8fe0c0' : 'none';
    });
    panel.querySelector('#rider-decoration-tilt').checked = item ? item.tilt : state.tilt;
    const offset = item ? item.offset : state.offset;
    const slider = panel.querySelector('#rider-decoration-offset');
    if (!slider.dataset.live) { slider.value = offset;panel.querySelector('#rider-decoration-offset-output').textContent = Number(offset).toFixed(2) + ' m'; }
    panel.querySelector('#rider-decoration-selected').textContent = item ? `Selected ${item.id}: ${item.fence ? 'fence' : item.asset}` : 'Click the track to place. Click an object to select or drag it.';
    panel.querySelector('#rider-decoration-hidden').checked = !!item?.hidden;
    panel.querySelector('#rider-decoration-locked').checked = !!item?.locked;
    for (const id of ['copy', 'delete', 'hidden', 'locked']) panel.querySelector(`#rider-decoration-${id}`).disabled = !item;
    const s = state.stretch || {};
    panel.querySelector('#rider-populate-stretch').textContent = state.arming ? 'Click the track for this end.' : s.a !== false && s.b !== false ? `Stretch x ${Number(s.a).toFixed(1)} to ${Number(s.b).toFixed(1)} m` : s.a !== false || s.b !== false ? 'Stretch: set the other end' : 'Stretch: whole track';
    panel.querySelector('#rider-decoration-note').textContent = state.message || '';
    renderBar();
  }
  // Quick bar: the selected object's own controls, drawn just above it.
  let bar;
  function slide(id, label, min, max, step, unit, field) {
    const wrap = document.createElement('label');wrap.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:12px';
    const input = document.createElement('input');input.type = 'range';input.id = id;input.min = min;input.max = max;input.step = step;input.style.width = '90px';
    const out = document.createElement('output');out.id = id + '-output';out.style.cssText = 'min-width:44px;text-align:right';
    const show = () => { out.textContent = Number(input.value).toFixed(2) + unit; };
    input.oninput = () => { input.dataset.live = '1';show();send({type: 'preview', field, value: Number(input.value)}); };
    input.onchange = () => { delete input.dataset.live;send({type: field, value: Number(input.value)}); };
    wrap.append(label, input, out);return wrap;
  }
  function buildBar() {
    bar = document.createElement('div');bar.id = 'rider-decoration-bar';bar.hidden = true;bar.setAttribute('role', 'toolbar');bar.setAttribute('aria-label', 'Selected decoration');
    bar.style.cssText = 'position:fixed;z-index:99997;display:flex;flex-direction:column;gap:4px;padding:6px;background:rgba(23,39,47,.94);color:#f1f5f2;border:2px solid #8fe0c0;border-radius:8px;font:13px sans-serif;transform:translate(-50%,-100%)';
    const small = (label, title, action) => { const b = button(label, action);b.title = title;b.setAttribute('aria-label', title);b.style.padding = '4px 7px';b.style.margin = '0';return b; };
    const top = document.createElement('div');top.style.cssText = 'display:flex;gap:3px;flex-wrap:nowrap';
    for (const [id, label] of [['behind', 'Behind'], ['front', 'Front'], ['body', 'Body']]) {
      const b = small(label, 'Placement ' + label, () => send({type: 'placement', value: id}));b.dataset.barPlacement = id;top.append(b);
    }
    const tilt = small('Tilt', 'Tilt with slope', () => send({type: 'tilt', value: !(state?.selected?.tilt)}));tilt.id = 'rider-bar-tilt';
    const lock = small('Lock', 'Lock', () => send({type: 'locked', value: !(state?.selected?.locked)}));lock.id = 'rider-bar-lock';
    const hide = small('Hide', 'Hide', () => send({type: 'hidden', value: !(state?.selected?.hidden)}));hide.id = 'rider-bar-hide';
    const copy = small('Copy', 'Copy', () => send({type: 'copy'}));copy.id = 'rider-bar-copy';
    const del = small('Delete', 'Delete', () => send({type: 'delete'}));del.id = 'rider-bar-delete';
    top.append(tilt, lock, hide, copy, del);bar.append(top);
    const rows = document.createElement('div');rows.style.cssText = 'display:flex;gap:10px';
    rows.append(slide('rider-bar-scale', 'Size', .25, 3, .05, '×', 'scale'), slide('rider-bar-offset', 'Offset', -8, 8, .05, ' m', 'offset'));bar.append(rows);
    bar.addEventListener('pointerup', () => send({type: 'release'}));
    document.body.append(bar);
  }
  function renderBar() {
    const item = state && state.selected, at = state && state.anchor, canvas = document.querySelector('canvas');
    if (!bar || !item || !at || !canvas || !api.visible || api.blocked) { if (bar) bar.hidden = true;return; }
    const r = canvas.getBoundingClientRect();
    const x = Math.max(8, Math.min(innerWidth - 8, r.left + at.x * r.width)), y = Math.max(110, Math.min(innerHeight - 8, r.top + (1 - at.y) * r.height - 10));
    bar.style.left = x + 'px';bar.style.top = y + 'px';bar.hidden = false;
    const on = (node, value) => { node.setAttribute('aria-pressed', String(!!value));node.style.outline = value ? '3px solid #8fe0c0' : 'none'; };
    bar.querySelectorAll('[data-bar-placement]').forEach(n => { on(n, n.dataset.barPlacement === item.placement);n.hidden = !!item.fence && n.dataset.barPlacement === 'body'; });
    on(bar.querySelector('#rider-bar-tilt'), item.tilt);bar.querySelector('#rider-bar-tilt').hidden = !!item.fence;
    on(bar.querySelector('#rider-bar-lock'), item.locked);on(bar.querySelector('#rider-bar-hide'), item.hidden);
    bar.querySelector('#rider-bar-copy').hidden = !!item.fence;
    const scale = bar.querySelector('#rider-bar-scale');scale.parentNode.hidden = !!item.fence;
    for (const [node, value, unit] of [[scale, item.scale, '×'], [bar.querySelector('#rider-bar-offset'), item.offset, ' m']]) {
      if (!node.dataset.live) { node.value = value;node.nextSibling.textContent = Number(value).toFixed(2) + unit; }
      node.disabled = !!item.locked;
    }
  }
  function button(label, action) {
    const node = document.createElement('button');node.type = 'button';node.textContent = label;
    node.style.cssText = 'padding:6px 10px;cursor:pointer;margin:2px';node.onclick = action;return node;
  }
  function check(id, label, action) {
    const wrap = document.createElement('label');wrap.style.cssText = 'display:inline-flex;gap:6px;align-items:center;margin-right:12px';
    const box = document.createElement('input');box.type = 'checkbox';box.id = id;box.onchange = () => action(box.checked);wrap.append(box, label);return wrap;
  }
  // Same top and bottom margin: a compositor can mirror a panel's rectangle over the WebGL canvas, seen as a blank block in Chromium.
  function build(list) {
    panel = document.createElement('section');panel.id = 'rider-decoration-panel';panel.setAttribute('aria-label', 'Decorations');
    panel.style.cssText = 'position:fixed;right:16px;top:64px;bottom:64px;z-index:99998;box-sizing:border-box;width:min(330px,calc(100vw - 32px));overflow:auto;padding:10px;background:#17272f;color:#f1f5f2;border:2px solid #8fe0c0;font:14px sans-serif';
    const grid = document.createElement('div');grid.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-bottom:8px';
    for (const a of list) {
      const b = document.createElement('button');b.type = 'button';b.dataset.decorationAsset = a.id;b.title = a.name;b.setAttribute('aria-label', a.name);
      b.style.cssText = 'padding:2px;cursor:pointer;background:#2c4450;border:0';
      const img = document.createElement('img');img.src = a.thumb;img.alt = '';img.width = 56;img.height = 56;b.append(img);
      b.onclick = () => { state.asset = a.id;render();send({type: 'asset', value: a.id}); };grid.append(b);
    }
    panel.append(grid);
    const places = document.createElement('div');
    for (const [id, label] of [['behind', 'Behind'], ['front', 'Front'], ['body', 'Body']]) {
      const b = button(label, () => send({type: 'placement', value: id}));b.dataset.decorationPlacement = id;places.append(b);
    }
    panel.append(places);
    const row = document.createElement('div');row.style.margin = '6px 0';
    row.append(check('rider-decoration-tilt', 'Tilt with slope', v => send({type: 'tilt', value: v})));panel.append(row);
    const off = document.createElement('label');off.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:6px';
    const slider = document.createElement('input');slider.type = 'range';slider.id = 'rider-decoration-offset';slider.min = -8;slider.max = 8;slider.step = .05;slider.style.flex = '1';
    // One Undo step on release.
    slider.onchange = () => { delete slider.dataset.live;send({type: 'offset', value: Number(slider.value)}); };
    // Live while dragging: the object moves and the number follows; release is the Undo step.
    slider.oninput = () => { slider.dataset.live = '1';panel.querySelector('#rider-decoration-offset-output').textContent = Number(slider.value).toFixed(2) + ' m';send({type: 'preview', field: 'offset', value: Number(slider.value)}); };
    const out = document.createElement('output');out.id = 'rider-decoration-offset-output';off.append('Offset', slider, out);panel.append(off);
    const sel = document.createElement('div');sel.id = 'rider-decoration-selected';sel.style.margin = '6px 0';panel.append(sel);
    const actions = document.createElement('div');
    const copy = button('Copy', () => send({type: 'copy'}));copy.id = 'rider-decoration-copy';
    const del = button('Delete', () => send({type: 'delete'}));del.id = 'rider-decoration-delete';
    const fence = button('Fence', () => send({type: 'fence'}));fence.id = 'rider-decoration-fence';actions.append(fence);
    actions.append(copy, del);panel.append(actions);
    const flags = document.createElement('div');flags.style.marginTop = '6px';
    flags.append(check('rider-decoration-hidden', 'Hide', v => send({type: 'hidden', value: v})), check('rider-decoration-locked', 'Lock', v => send({type: 'locked', value: v})));panel.append(flags);
    const pop = document.createElement('details');pop.id = 'rider-populate';pop.open = true;pop.style.cssText = 'margin-top:8px;border-top:1px solid #4d6b70;padding-top:6px';
    const head = document.createElement('summary');head.textContent = 'Populate';pop.append(head);
    const set = document.createElement('div');set.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;font-size:12px';
    for (const a of list) {
      const wrap = document.createElement('label');const box = document.createElement('input');box.type = 'checkbox';box.dataset.populateAsset = a.id;wrap.append(box, ' ' + a.name);set.append(wrap);
    }
    pop.append(set);
    const fields = [['density', 'Per 10 m', 4, .1, 40, .1], ['spacing', 'Spacing m', 1.5, .25, 50, .25], ['size_min', 'Size min', .8, .25, 3, .05], ['size_max', 'Size max', 1.2, .25, 3, .05], ['slope', 'Max slope°', 35, 0, 90, 1], ['seed', 'Seed', 1, 0, 2147483646, 1]];
    for (const [id, label, value, min, max, step] of fields) {
      const wrap = document.createElement('label');wrap.style.cssText = 'display:flex;justify-content:space-between;margin:2px 0';
      const input = document.createElement('input');input.type = 'number';input.id = 'rider-populate-' + id;input.value = value;input.min = min;input.max = max;input.step = step;input.style.width = '110px';wrap.append(label, input);pop.append(wrap);
    }
    const stretch = document.createElement('div');stretch.id = 'rider-populate-stretch';stretch.style.margin = '4px 0';pop.append(stretch);
    const a = button('Stretch start', () => send({type: 'arm', value: 'a'}));a.id = 'rider-populate-a';
    const b = button('Stretch end', () => send({type: 'arm', value: 'b'}));b.id = 'rider-populate-b';
    const whole = button('Whole track', () => send({type: 'clear_stretch'}));whole.id = 'rider-populate-whole';
    pop.append(a, b, whole);
    const run = button('Populate', () => {
      const value = id => Number(panel.querySelector('#rider-populate-' + id).value);
      const assets = [...panel.querySelectorAll('[data-populate-asset]')].filter(n => n.checked).map(n => n.dataset.populateAsset);
      send({type: 'populate', settings: {assets, density: value('density'), spacing: value('spacing'), size_min: value('size_min'), size_max: value('size_max'), slope: value('slope'), seed: value('seed')}});
    });run.id = 'rider-populate-run';pop.append(run);panel.append(pop);
    const note = document.createElement('div');note.id = 'rider-decoration-note';note.setAttribute('role', 'status');note.style.cssText = 'margin-top:6px;color:#ffd27f';panel.append(note);
    // Close sits alone at the bottom left, away from the object actions.
    const foot = document.createElement('div');foot.style.cssText = 'position:sticky;bottom:-10px;margin:10px -10px -10px;padding:8px 10px;background:#17272f;border-top:1px solid #4d6b70';
    const close = button('Close', () => send({type: 'close'}));close.id = 'rider-decoration-close';close.style.margin = '0';foot.append(close);panel.append(foot);
    // A drag released over the panel never reaches the canvas.
    panel.addEventListener('pointerup', () => send({type: 'release'}));
    document.body.append(panel);
    buildBar();
  }
  api.open = list => { if (!panel) build(list);api.queue.length = 0;panel.hidden = false;api.visible = true;render(); };
  const settle = () => document.querySelectorAll('#rider-decoration-panel [data-live],#rider-decoration-bar [data-live]').forEach(n => delete n.dataset.live);
  api.close = () => { settle();if (bar) bar.hidden = true;if (panel) panel.hidden = true;api.visible = false;api.queue.length = 0;document.querySelector('canvas')?.focus(); };
  api.show = next => { state = next;render(); };
  api.suspend = blocked => { if (blocked) settle();api.blocked = !!blocked;if (blocked) api.queue.length = 0;if (panel) panel.hidden = !api.visible || !!blocked;renderBar(); };
  api.take = () => JSON.stringify(api.queue.splice(0, api.queue.length));
})();
