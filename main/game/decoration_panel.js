(() => {
  if (window.riderDecorationPanel) return;
  // DOM presents; Lua validates and owns source, Undo and storage.
  const api = window.riderDecorationPanel = {visible: false, queue: []};
  // Inline display (flex) would override the hidden attribute: hidden always wins for Decor overlays.
  const rule = document.createElement('style');rule.textContent = '#rider-decoration-panel[hidden],#rider-decoration-bar[hidden],#rider-decoration-gizmo[hidden],#rider-populate-range[hidden],.rider-grip[hidden],#rider-decoration-gizmo [hidden],#rider-decoration-bar [hidden]{display:none!important}';document.head.append(rule);
  let panel, state = null;
  const send = message => { if (api.queue.length < 16) api.queue.push(message); };
  // Active: filled, not outlined.
  function mark(node, value) {
    node.setAttribute('aria-pressed', String(!!value));node.style.outline = 'none';
    node.style.background = value ? '#8fe0c0' : '';node.style.color = value ? '#10232a' : '';node.style.fontWeight = value ? '700' : '';
  }
  function render() {
    if (!panel || !state) return;
    const item = state.selected || null;
    panel.querySelectorAll('[data-decoration-asset]').forEach(node => {
      const on = state.fence_asset ? node.dataset.decorationAsset === state.fence_asset : node.dataset.decorationAsset === state.asset;
      node.setAttribute('aria-pressed', String(on));node.style.outline = 'none';node.style.background = on ? '#8fe0c0' : '#2c4450';
    });
    const placement = item ? item.placement : state.placement;
    panel.querySelectorAll('[data-decoration-placement]').forEach(node => {
      mark(node, node.dataset.decorationPlacement === placement);
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
    panel.querySelector('#rider-populate-stretch').textContent = state.arming === 'range' ? 'Click where the range starts.' : s.a !== false && s.b !== false ? `Range x ${Number(Math.min(s.a, s.b)).toFixed(1)} to ${Number(Math.max(s.a, s.b)).toFixed(1)} m${state.arming === 'range_b' ? ' · click to end' : state.live ? ' · live' : ''}` : `Range: whole track${state.live ? ' · live' : ''}`;
    panel.querySelector('#rider-decoration-note').textContent = state.message || '';
    renderBar();renderRange();renderGizmo();
  }
  // Quick bar: the selected object's own controls, drawn just above it.
  let bar, rangeBox, gizmo;
  // Transform box: corners size, top and bottom move the offset, the round knobs rotate. Live; release is one Undo step.
  function buildGizmo() {
    gizmo = document.createElement('div');gizmo.id = 'rider-decoration-gizmo';gizmo.hidden = true;
    gizmo.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;z-index:99996;pointer-events:none;transform-origin:0 0';
    const frame = document.createElement('div');frame.dataset.part = 'frame';frame.style.cssText = 'position:absolute;border:2px dashed #8fe0c0;box-sizing:border-box;pointer-events:none';gizmo.append(frame);
    const handle = (kind, id, round) => {
      const h = document.createElement('div');h.dataset.kind = kind;h.id = 'rider-gizmo-' + id;h.dataset.part = id;
      h.style.cssText = `position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;box-sizing:border-box;background:#fff;border:2px solid #17272f;pointer-events:auto;touch-action:none;border-radius:${round ? '50%' : '2px'};cursor:${kind === 'rotate' ? 'grab' : kind === 'offset' ? 'ns-resize' : 'nwse-resize'}`;
      h.addEventListener('pointerdown', e => start(e, kind));gizmo.append(h);
    };
    for (const id of ['tl', 'tr', 'bl', 'br']) handle('scale', id);
    handle('offset', 'top');handle('offset', 'bottom');handle('rotate', 'rot-l', true);handle('rotate', 'rot-r', true);
    document.body.append(gizmo);
  }
  let grab = null;
  const ROUND = {scale: .05, offset: .05, rotation: 1};
  function value(e) {
    const g = grab, px = e.clientX, py = e.clientY;
    if (g.kind === 'scale') return Math.max(.25, Math.min(3, g.scale * Math.hypot(px - g.bx, py - g.by) / Math.max(1, g.d0)));
    if (g.kind === 'offset') return Math.max(-8, Math.min(8, g.offset + ((px - g.px) * -Math.sin(g.normal) + (py - g.py) * -Math.cos(g.normal)) / g.k));
    let r = g.rotation + (Math.atan2(-(py - g.by), px - g.bx) - g.phi) * 180 / Math.PI;
    while (r > 180) r -= 360;while (r < -180) r += 360;return r;
  }
  function start(e, kind) {
    const b = state && state.box;if (!b || b.locked) return;
    e.preventDefault();e.stopPropagation();e.target.setPointerCapture(e.pointerId);
    const p = place(b);
    grab = {kind, field: kind === 'rotate' ? 'rotation' : kind, bx: p.x, by: p.y, k: p.k, px: e.clientX, py: e.clientY, d0: Math.hypot(e.clientX - p.x, e.clientY - p.y),
      phi: Math.atan2(-(e.clientY - p.y), e.clientX - p.x), scale: b.scale, offset: b.offset, rotation: b.rotation, normal: b.normal, last: null};
    if (bar) bar.dataset.hold = '1';
    const move = ev => { const step = ROUND[grab.field], v = Math.round(value(ev) / step) * step;if (v !== grab.last) { grab.last = v;send({type: 'preview', field: grab.field, value: v}); } };
    const end = () => {
      e.target.removeEventListener('pointermove', move);e.target.removeEventListener('pointerup', end);e.target.removeEventListener('pointercancel', end);
      if (grab && grab.last !== null) send({type: grab.field, value: grab.last});
      grab = null;if (bar) { delete bar.dataset.hold;renderBar(); }
    };
    e.target.addEventListener('pointermove', move);e.target.addEventListener('pointerup', end);e.target.addEventListener('pointercancel', end);
  }
  // Window fractions from the bottom left to CSS pixels on the canvas.
  function place(b) {
    const r = document.querySelector('canvas').getBoundingClientRect();
    return {x: r.left + b.x * r.width, y: r.top + (1 - b.y) * r.height, k: b.kx * r.width};
  }
  function renderGizmo() {
    const b = state && state.box, canvas = document.querySelector('canvas');
    if (!gizmo || !b || !canvas || !api.visible || api.blocked) { if (gizmo) gizmo.hidden = true;return; }
    const p = place(b), w = b.w * p.k, h = b.h * p.k, top = (b.h - b.sink) * p.k;
    gizmo.hidden = false;gizmo.style.transform = `translate(${p.x}px,${p.y}px) rotate(${-b.angle}rad)`;
    const at = (part, x, y) => { const n = gizmo.querySelector(`[data-part="${part}"]`);n.style.left = x + 'px';n.style.top = y + 'px';n.hidden = b.locked && part !== 'frame'; };
    const frame = gizmo.querySelector('[data-part="frame"]');frame.style.left = -w / 2 + 'px';frame.style.top = -top + 'px';frame.style.width = w + 'px';frame.style.height = h + 'px';
    at('tl', -w / 2, -top);at('tr', w / 2, -top);at('bl', -w / 2, h - top);at('br', w / 2, h - top);
    at('top', 0, -top);at('bottom', 0, h - top);
    // A small object keeps its corners reachable: the offset handles step aside.
    for (const part of ['top', 'bottom']) if (w < 44 || h < 44) gizmo.querySelector(`[data-part="${part}"]`).hidden = true;at('rot-l', -w / 2 - 16, -top - 16);at('rot-r', w / 2 + 16, -top - 16);
  }
  // Drag grips: visual only; the canvas takes the press.
  const grips = [];
  function grip(i) {
    if (!grips[i]) {
      const g = document.createElement('div');g.id = 'rider-fence-grip-' + i;g.className = 'rider-grip';
      g.style.cssText = 'position:fixed;z-index:99995;width:16px;height:16px;margin:-8px 0 0 -8px;box-sizing:border-box;border-radius:50%;background:#fff;border:3px solid #8fe0c0;box-shadow:0 0 0 2px #17272f;pointer-events:none';
      document.body.append(g);grips[i] = g;
    }
    return grips[i];
  }
  function renderGrips() {
    const e = state && state.ends, canvas = document.querySelector('canvas');
    const show = !!(e && canvas && api.visible && !api.blocked);
    for (let i = 0; i < 2; i++) {
      const g = grip(i);g.hidden = !show;
      if (show) { const r = canvas.getBoundingClientRect();g.style.left = r.left + e[i].x * r.width + 'px';g.style.top = r.top + (1 - e[i].y) * r.height + 'px'; }
    }
  }
  function renderRange() {
    renderGrips();
    const g = state && state.range, canvas = document.querySelector('canvas');
    if (!rangeBox || !g || !canvas || !api.visible || api.blocked) { if (rangeBox) rangeBox.hidden = true;return; }
    const r = canvas.getBoundingClientRect(), x0 = r.left + g.a * r.width, x1 = r.left + g.b * r.width;
    rangeBox.style.left = Math.max(r.left, x0) + 'px';rangeBox.style.width = Math.max(3, Math.min(r.right, x1) - Math.max(r.left, x0)) + 'px';
    rangeBox.style.top = r.top + 'px';rangeBox.style.height = r.height + 'px';rangeBox.hidden = x1 < r.left || x0 > r.right;
  }
  function slide(id, label, min, max, step, unit, field) {
    const wrap = document.createElement('label');wrap.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:12px';
    const input = document.createElement('input');input.type = 'range';input.id = id;input.min = min;input.max = max;input.step = step;input.style.width = '90px';
    const out = document.createElement('output');out.id = id + '-output';out.style.cssText = 'min-width:44px;text-align:right';
    const show = () => { out.textContent = Number(input.value).toFixed(2) + unit; };
    input.oninput = () => { input.dataset.live = '1';show();send({type: 'preview', field, value: Number(input.value)}); };
    input.onchange = () => { delete input.dataset.live;send({type: field, value: Number(input.value)}); };
    wrap.append(label, input, out);
    if (field === 'offset') {
      // Reset button: back to the track (a double-click would first move the knob, adding Undo steps).
      const zero = () => { input.value = '0';show();delete input.dataset.live;send({type: 'offset', value: 0}); };
      const reset = document.createElement('button');reset.type = 'button';reset.id = id + '-reset';reset.textContent = '↺';reset.title = 'Reset offset';reset.setAttribute('aria-label', 'Reset offset');
      reset.style.cssText = 'padding:1px 6px;margin:0;cursor:pointer';reset.onclick = zero;wrap.append(reset);
    }
    return wrap;
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
    bar.addEventListener('pointerdown', () => { bar.dataset.hold = '1'; });
    // Released anywhere: the bar may follow its object again.
    const let_go = () => { if (bar.dataset.hold) { delete bar.dataset.hold;renderBar(); } };
    for (const type of ['pointerup', 'pointercancel']) addEventListener(type, let_go, true);
    bar.addEventListener('pointerup', () => send({type: 'release'}));
    document.body.append(bar);
  }
  function renderBar() {
    const item = state && state.selected, at = state && state.anchor, canvas = document.querySelector('canvas');
    if (!bar || !item || !at || !canvas || !api.visible || api.blocked) { if (bar) bar.hidden = true;return; }
    const r = canvas.getBoundingClientRect();
    // Held still while a control is used: the object moves, the bar does not.
    if (bar.dataset.hold && !bar.hidden) { syncBar(item);return; }
    const x = Math.max(8, Math.min(innerWidth - 8, r.left + at.x * r.width)), y = Math.max(110, Math.min(innerHeight - 8, r.top + (1 - at.y) * r.height - 34));
    bar.style.left = x + 'px';bar.style.top = y + 'px';bar.hidden = false;
    syncBar(item);
  }
  function syncBar(item) {
    const on = mark;
    bar.querySelectorAll('[data-bar-placement]').forEach(n => { on(n, n.dataset.barPlacement === item.placement);n.hidden = !!item.fence && n.dataset.barPlacement === 'body'; });
    on(bar.querySelector('#rider-bar-tilt'), item.tilt);bar.querySelector('#rider-bar-tilt').hidden = !!item.fence;
    on(bar.querySelector('#rider-bar-lock'), item.locked);on(bar.querySelector('#rider-bar-hide'), item.hidden);
    bar.querySelector('#rider-bar-copy').hidden = !!item.fence;
    const scale = bar.querySelector('#rider-bar-scale');scale.parentNode.style.display = item.fence ? 'none' : 'flex';
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
      b.onclick = () => { if (a.fence) state.fence_asset = a.id;else { state.asset = a.id;state.fence_asset = false; }render();send({type: 'asset', value: a.id}); };grid.append(b);
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
    const zero = document.createElement('button');zero.type = 'button';zero.id = 'rider-decoration-offset-reset';zero.textContent = '↺';zero.title = 'Reset offset';zero.setAttribute('aria-label', 'Reset offset');
    zero.style.cssText = 'padding:1px 6px;cursor:pointer';zero.onclick = () => { slider.value = '0';delete slider.dataset.live;out.textContent = '0.00 m';send({type: 'offset', value: 0}); };off.append(zero);
    const sel = document.createElement('div');sel.id = 'rider-decoration-selected';sel.style.margin = '6px 0';panel.append(sel);
    const actions = document.createElement('div');
    const copy = button('Copy', () => send({type: 'copy'}));copy.id = 'rider-decoration-copy';
    const del = button('Delete', () => send({type: 'delete'}));del.id = 'rider-decoration-delete';
    actions.append(copy, del);panel.append(actions);
    const flags = document.createElement('div');flags.style.marginTop = '6px';
    flags.append(check('rider-decoration-hidden', 'Hide', v => send({type: 'hidden', value: v})), check('rider-decoration-locked', 'Lock', v => send({type: 'locked', value: v})));panel.append(flags);
    const pop = document.createElement('details');pop.id = 'rider-populate';pop.open = true;pop.style.cssText = 'margin-top:8px;border-top:1px solid #4d6b70;padding-top:6px';
    const head = document.createElement('summary');head.textContent = 'Populate';pop.append(head);
    const set = document.createElement('div');set.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;font-size:12px';
    for (const a of list.filter(a => !a.fence)) {
      const wrap = document.createElement('label');const box = document.createElement('input');box.type = 'checkbox';box.dataset.populateAsset = a.id;wrap.append(box, ' ' + a.name);set.append(wrap);
    }
    pop.append(set);
    const fields = [['density', 'Per 10 m', 4, .1, 40, .1], ['spacing', 'Spacing m', 1.5, .25, 50, .25], ['size_min', 'Size min', .8, .25, 3, .05], ['size_max', 'Size max', 1.2, .25, 3, .05], ['slope', 'Max slope°', 35, 0, 90, 1], ['seed', 'Seed', 1, 0, 2147483646, 1]];
    for (const [id, label, value, min, max, step] of fields) {
      const wrap = document.createElement('label');wrap.style.cssText = 'display:flex;justify-content:space-between;margin:2px 0';
      const input = document.createElement('input');input.type = 'number';input.id = 'rider-populate-' + id;input.value = value;input.min = min;input.max = max;input.step = step;input.style.width = '110px';wrap.append(label, input);pop.append(wrap);
    }
    // Seed: type one or roll a random one.
    const seed = pop.querySelector('#rider-populate-seed');
    const dice = button('Random', () => { seed.value = String(1 + Math.floor(Math.random() * 2147483645));live(); });dice.id = 'rider-populate-random';dice.title = 'Random seed';
    dice.style.cssText += ';padding:2px 8px;margin:0 0 0 6px';seed.style.width = '80px';seed.parentNode.append(dice);
    const stretch = document.createElement('div');stretch.id = 'rider-populate-stretch';stretch.style.margin = '4px 0';pop.append(stretch);
    const a = button('Draw range', () => send({type: 'arm', value: 'range'}));a.id = 'rider-populate-range-button';
    const whole = button('Whole track', () => send({type: 'clear_stretch'}));whole.id = 'rider-populate-whole';
    pop.append(a, whole);
    const settings = () => {
      const value = id => Number(panel.querySelector('#rider-populate-' + id).value);
      const assets = [...panel.querySelectorAll('[data-populate-asset]')].filter(n => n.checked).map(n => n.dataset.populateAsset);
      return {assets, density: value('density'), spacing: value('spacing'), size_min: value('size_min'), size_max: value('size_max'), slope: value('slope'), seed: value('seed')};
    };
    // Live: every change shows its result on the track at once; Apply stores it as one Undo step.
    function live() { send(pop.open ? {type: 'populate_live', settings: settings()} : {type: 'populate_live'}); }
    pop.addEventListener('input', live);pop.addEventListener('change', live);pop.addEventListener('toggle', live);
    const run = button('Apply', () => send({type: 'populate', settings: settings()}));run.id = 'rider-populate-run';pop.append(run);panel.append(pop);
    // The range drawn on the track: shaded between two edges, which drag.
    rangeBox = document.createElement('div');rangeBox.id = 'rider-populate-range';rangeBox.hidden = true;
    rangeBox.style.cssText = 'position:fixed;z-index:99990;pointer-events:none;background:rgba(143,224,192,.14);border-left:3px solid #8fe0c0;border-right:3px solid #8fe0c0;box-sizing:border-box';
    // A handle on each edge, at mid height: drag there.
    for (const side of ['left', 'right']) {
      const h = document.createElement('div');h.id = 'rider-populate-range-' + side;h.className = 'rider-grip';
      h.style.cssText = `position:absolute;top:50%;${side}:-9px;width:14px;height:44px;margin-top:-22px;box-sizing:border-box;border-radius:7px;background:#fff;border:3px solid #8fe0c0;box-shadow:0 0 0 2px #17272f`;
      rangeBox.append(h);
    }
    document.body.append(rangeBox);
    const note = document.createElement('div');note.id = 'rider-decoration-note';note.setAttribute('role', 'status');note.style.cssText = 'margin-top:6px;color:#ffd27f';panel.append(note);
    // Close sits alone at the bottom left, away from the object actions.
    const foot = document.createElement('div');foot.style.cssText = 'position:sticky;bottom:-10px;margin:10px -10px -10px;padding:8px 10px;background:#17272f;border-top:1px solid #4d6b70';
    const close = button('Close', () => send({type: 'close'}));close.id = 'rider-decoration-close';close.style.margin = '0';foot.append(close);panel.append(foot);
    // A drag released over the panel never reaches the canvas.
    panel.addEventListener('pointerup', () => send({type: 'release'}));
    document.body.append(panel);
    buildBar();buildGizmo();
  }
  api.open = list => { if (!panel) build(list);api.queue.length = 0;panel.hidden = false;api.visible = true;render(); };
  const settle = () => document.querySelectorAll('#rider-decoration-panel [data-live],#rider-decoration-bar [data-live]').forEach(n => delete n.dataset.live);
  api.close = () => { settle();grips.forEach(g => { g.hidden = true; });if (gizmo) gizmo.hidden = true;if (rangeBox) rangeBox.hidden = true;if (bar) bar.hidden = true;if (panel) panel.hidden = true;api.visible = false;api.queue.length = 0;document.querySelector('canvas')?.focus(); };
  api.show = next => { state = next;render(); };
  api.suspend = blocked => { if (blocked) settle();api.blocked = !!blocked;if (blocked) api.queue.length = 0;if (panel) panel.hidden = !api.visible || !!blocked;renderBar();renderRange();renderGizmo(); };
  api.take = () => JSON.stringify(api.queue.splice(0, api.queue.length));
})();
