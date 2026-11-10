// #678: the play bar (HTML5, desktop and touch) in the editor's kit style: one row of buttons at the top right.
// UI only. Retry and Pause are the touch adapter's one-shot requests (main/game/mobile.js, read by the controller);
// Levels and Import use their DOM owners; Tuning, Help, 3D and Edit level are queued for main/game/ui.gui_script.
(() => {
'use strict';
if (window.riderPlayBar) return;
const UI = window.riderUI;
const queue = [];
let root, menuOpen = false, key = '';
const touch = () => !!window.riderMobile?.enabled;
const canvasFocus = () => document.querySelector('canvas')?.focus();
function mount() {
  UI.install();
  root = document.createElement('div'); root.id = 'rider-playbar'; root.className = 'rider-ui';
  root.innerHTML = '<div class="float pb-row"></div><div class="pb-menu" hidden></div>'
    // Slice 2: the player strip (time, best, coins, gems, fuel) and the progress bar under it, top centre.
    + '<div class="float pb-strip" hidden><span class="pb-time"></span><span class="pb-best"></span>'
    + '<span class="pb-chip pb-coins">' + UI.icon('coin') + '<b></b><i class="pb-flash"></i></span>'
    + '<span class="pb-chip pb-gems">' + UI.icon('gem') + '<b></b></span>'
    + '<span class="pb-chip pb-fuel">' + UI.icon('fuel') + '<span class="pb-fuelbar"><i></i></span></span></div>'
    + '<div class="float pb-progress" hidden><span class="pb-pi" title="Start">' + UI.icon('flag') + '</span>'
    + '<span class="pb-track"><i class="pb-fill"></i><i class="pb-car"></i></span><span class="pb-pi" title="Finish">' + UI.icon('finish') + '</span>'
    + '<b class="pb-pct"></b><span class="pb-reason"></span></div>'
    // Slice 3: the desktop debug group (touch keeps these tools in More).
    + '<div class="pb-lookpanel" hidden></div><div class="pb-tunepanel" hidden></div>'
    + '<div class="float pb-debug" hidden></div><div class="pb-campanel" hidden></div>'
    // The level line has its own box above the readouts card; neither wraps.
    + '<div class="pb-left"><div class="float pb-map" hidden></div>'
    + '<div class="float pb-card" hidden><b class="pb-speed"></b><span class="pb-travel"><i class="pb-dot"></i>L <i class="pb-dot"></i>R <em></em></span>'
    + '<span class="pb-result"></span><span class="pb-replay"></span></div></div>';
  const style = document.createElement('style');
  style.textContent = `#rider-playbar .pb-row{position:fixed;top:max(8px,env(safe-area-inset-top));right:max(8px,env(safe-area-inset-right));z-index:1100;gap:5px;padding:5px}
#rider-playbar .pb-row .b{--h:44px;min-width:44px}
#rider-playbar button{touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
#rider-playbar .pb-menu{overscroll-behavior:contain}
/* Claudio 2026-11-09: Pause is a normal button while driving; only a paused run shows a green Play. */
#rider-playbar .pb-row .b.resume{--c:var(--go);background:var(--c);color:var(--ink)}
#rider-playbar .pb-menu{position:fixed;top:calc(max(8px,env(safe-area-inset-top)) + 62px);right:max(8px,env(safe-area-inset-right));z-index:1101;
 width:min(340px,calc(100vw - 16px));max-height:calc(100vh - 90px);overflow-y:auto;box-sizing:border-box;padding:8px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;
 background:var(--panel);border:var(--ol) solid var(--ink);border-radius:16px;box-shadow:0 5px 0 var(--ink),0 10px 24px #0005;touch-action:pan-y}
#rider-playbar .pb-menu[hidden]{display:none}
#rider-playbar .pb-menu .b{--h:44px;justify-content:flex-start;padding:0 10px;font:800 13px var(--body);gap:8px}
#rider-playbar .pb-menu .touch-tools{grid-column:1/-1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;position:static;width:auto;padding:0;border:0;background:none;max-height:none;overflow:visible}
#rider-playbar .pb-menu .touch-tools button{min-height:44px;border:var(--ol) solid var(--ink);border-radius:12px;background:var(--btn);color:var(--text);font:800 13px var(--body);text-align:left;padding:0 10px}
#rider-playbar .pb-strip{position:fixed;top:max(8px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:1050;gap:12px;padding:6px 14px;pointer-events:none;
 font:800 13px var(--body);color:var(--muted);white-space:nowrap;flex-wrap:wrap;justify-content:center;row-gap:2px;box-sizing:border-box}
#rider-playbar [hidden]{display:none!important}
/* The info line (state, best, banks, fuel notes) is always the strip's second row and wraps inside it. */
#rider-playbar .pb-best{order:9;flex-basis:100%;white-space:normal;text-align:center;font-size:11.5px;line-height:1.3}
#rider-playbar .pb-time{font:800 22px var(--disp);color:var(--text);font-variant-numeric:tabular-nums;min-width:4.6em;text-align:right}
#rider-playbar .pb-chip{display:inline-flex;align-items:center;gap:4px;color:var(--text)}#rider-playbar .pb-chip svg{width:18px;height:18px}
#rider-playbar .pb-coins{color:#ffd23f}#rider-playbar .pb-coins b,#rider-playbar .pb-gems b{color:var(--text);font-variant-numeric:tabular-nums}
#rider-playbar .pb-gems{color:#b48cff}#rider-playbar .pb-fuel{color:#ff4f5e}
#rider-playbar .pb-flash{font-style:normal;color:#ffd23f}
#rider-playbar .pb-fuelbar{width:70px;height:10px;border-radius:5px;background:var(--field);overflow:hidden;border:2px solid var(--ink)}
#rider-playbar .pb-fuelbar i{display:block;height:100%;background:var(--go)}#rider-playbar .pb-fuel.low .pb-fuelbar i{background:#ffac40}
#rider-playbar .pb-progress{position:fixed;z-index:1050;gap:8px;padding:4px 10px;box-sizing:border-box;pointer-events:none;font:800 11px var(--body);color:var(--muted)}
#rider-playbar .pb-pi{display:inline-flex;color:var(--text)}#rider-playbar .pb-pi svg{width:16px;height:16px}
#rider-playbar .pb-track{flex:1;height:8px;border-radius:4px;background:var(--field);position:relative;min-width:40px}
#rider-playbar .pb-fill{position:absolute;left:0;top:0;bottom:0;border-radius:4px;background:var(--accent)}
#rider-playbar .pb-car{position:absolute;top:50%;width:12px;height:12px;border-radius:50%;background:#fff;border:2px solid var(--ink);transform:translate(-50%,-50%)}
#rider-playbar .pb-pct{color:var(--text);font-variant-numeric:tabular-nums;min-width:34px;text-align:right}
#rider-playbar .pb-reason{color:var(--muted)}
#rider-playbar .pb-debug{position:fixed;left:max(12px,env(safe-area-inset-left));bottom:max(12px,env(safe-area-inset-bottom));z-index:1050;gap:5px;padding:5px;flex-wrap:wrap;max-width:calc(100vw - 340px)}
#rider-playbar .pb-debug .b{--h:36px;font:800 12px var(--body);padding:0 10px;gap:6px}#rider-playbar .pb-debug .b.on{--c:var(--go)}
#rider-playbar .pb-left{position:fixed;left:max(12px,env(safe-area-inset-left));top:max(52px,env(safe-area-inset-top));z-index:1040;pointer-events:none;
 display:flex;flex-direction:column;align-items:flex-start;gap:6px}
#rider-playbar .pb-map,#rider-playbar .pb-card{padding:8px 12px;box-sizing:border-box;white-space:nowrap;max-width:min(560px,45vw);overflow:hidden;text-overflow:ellipsis;font:700 12px var(--body);color:var(--muted);font-variant-numeric:tabular-nums}
#rider-playbar .pb-left>.float{position:static}#rider-playbar .pb-map{font:800 13px var(--body);color:var(--text)}
#rider-playbar .pb-card{flex-direction:column;align-items:flex-start;gap:3px}
#rider-playbar .pb-card b{font:800 15px var(--disp);color:var(--text)}#rider-playbar .pb-card em{font-style:normal;color:var(--text)}
#rider-playbar .pb-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#59636e;margin:0 3px 0 0;vertical-align:middle}#rider-playbar .pb-dot.on{background:var(--go)}
#rider-playbar .pb-travel i+i{margin-left:8px}#rider-playbar .pb-replay{color:#9ae0ff}
#rider-playbar .pb-campanel{position:fixed;z-index:1101;width:min(380px,calc(100vw - 16px));max-height:calc(100vh - 90px);overflow-y:auto;box-sizing:border-box;padding:10px;
 display:flex;flex-direction:column;gap:8px;background:var(--panel);border:var(--ol) solid var(--ink);border-radius:16px;box-shadow:0 5px 0 var(--ink),0 10px 24px #0005;overscroll-behavior:contain}
#rider-playbar .pb-campanel[hidden]{display:none}
#rider-playbar .pb-campanel .hd{display:flex;align-items:center;gap:8px;font:800 15px var(--disp);color:var(--text)}#rider-playbar .pb-campanel .hd svg{width:20px;height:20px}
#rider-playbar .pb-campanel .hd span{flex:1}#rider-playbar .pb-campanel .b{--h:40px;font:800 13px var(--body);padding:0 10px}
#rider-playbar .pb-campanel .modes{display:grid;grid-template-columns:1fr 1fr;gap:6px}#rider-playbar .pb-campanel .modes .b{width:100%}
#rider-playbar .pb-campanel .modes .b.on{--c:var(--accent);background:var(--c);color:var(--ink)}
#rider-playbar .pb-campanel .rw{display:grid;grid-template-columns:1fr 40px 40px;gap:6px;align-items:center;font:700 13px var(--body);color:var(--text);white-space:nowrap}
#rider-playbar .pb-campanel .rw.dim span{color:var(--muted);opacity:.75}#rider-playbar .pb-campanel .rw .b{width:40px;padding:0}
#rider-playbar .pb-campanel .reset{width:100%}#rider-playbar .pb-campanel .rows{display:grid;gap:6px}
#rider-playbar .pb-campanel.compact{width:min(600px,calc(100vw - 16px))}#rider-playbar .pb-campanel.compact .rows{grid-template-columns:1fr 1fr;column-gap:16px}
#rider-playbar .pb-campanel.compact .hd .modes{flex:0 0 190px}#rider-playbar .pb-campanel.compact .hd>span{flex:1}
#rider-playbar .pb-lookpanel{position:fixed;z-index:1101;width:min(400px,calc(100vw - 16px));overflow-y:auto;box-sizing:border-box;padding:10px;
 display:flex;flex-direction:column;gap:8px;background:var(--panel);border:var(--ol) solid var(--ink);border-radius:16px;box-shadow:0 5px 0 var(--ink),0 10px 24px #0005;overscroll-behavior:contain}
#rider-playbar .pb-lookpanel[hidden]{display:none}
#rider-playbar .pb-lookpanel .hd{display:flex;align-items:center;gap:8px;font:800 15px var(--disp);color:var(--text)}#rider-playbar .pb-lookpanel .hd svg{width:20px;height:20px}
#rider-playbar .pb-lookpanel .hd span{flex:1}#rider-playbar .pb-lookpanel .b{--h:40px;font:800 13px var(--body);padding:0 10px}
#rider-playbar .pb-lookpanel .modes{display:grid;grid-template-columns:1fr 1fr;gap:6px}#rider-playbar .pb-lookpanel .modes .b{width:100%}
#rider-playbar .pb-lookpanel .modes .b.on{--c:var(--accent);background:var(--c);color:var(--ink)}
#rider-playbar .pb-lookpanel .note{font:700 12px var(--body);color:var(--muted)}#rider-playbar .pb-lookpanel .err{font:800 12px var(--body);color:var(--danger)}
#rider-playbar .pb-lookpanel .lk{display:grid;grid-template-columns:1fr auto;gap:2px 8px;align-items:center;font:700 13px var(--body);color:var(--text);white-space:nowrap}
#rider-playbar .pb-lookpanel .lk output{font-variant-numeric:tabular-nums;color:var(--text)}#rider-playbar .pb-lookpanel .lk input{grid-column:1/-1;width:100%;accent-color:var(--accent)}
#rider-playbar .pb-lookpanel .lk.dim{opacity:.5}#rider-playbar .pb-lookpanel .ft{display:flex;gap:6px}#rider-playbar .pb-lookpanel .ft .b{flex:1}
#rider-playbar .pb-tunepanel{position:fixed;z-index:1101;width:min(360px,calc(100vw - 16px));overflow-y:auto;box-sizing:border-box;padding:10px;
 display:flex;flex-direction:column;gap:7px;background:var(--panel);border:var(--ol) solid var(--ink);border-radius:16px;box-shadow:0 5px 0 var(--ink),0 10px 24px #0005;overscroll-behavior:contain}
#rider-playbar .pb-tunepanel[hidden]{display:none}
#rider-playbar .pb-tunepanel .hd{display:flex;align-items:center;gap:8px;font:800 15px var(--disp);color:var(--text)}#rider-playbar .pb-tunepanel .hd svg{width:20px;height:20px}
#rider-playbar .pb-tunepanel .hd span{flex:1}#rider-playbar .pb-tunepanel .b{--h:36px;font:800 12.5px var(--body);padding:0 8px}
#rider-playbar .pb-tunepanel .ps{display:grid;grid-template-columns:repeat(auto-fit,minmax(36px,1fr));gap:5px}#rider-playbar .pb-tunepanel .ps .b{width:100%}
#rider-playbar .pb-tunepanel .b.on{--c:var(--accent);background:var(--c);color:var(--ink)}
#rider-playbar .pb-tunepanel .two{display:grid;grid-template-columns:1fr 1fr;gap:6px}#rider-playbar .pb-tunepanel .two .b{width:100%}
#rider-playbar .pb-tunepanel .note{font:700 12px var(--body);color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#rider-playbar .pb-tunepanel .note.over{color:var(--danger)}
#rider-playbar .pb-tunepanel .ts{display:grid;grid-template-columns:70px 1fr 62px;gap:8px;align-items:center;font:700 12.5px var(--body);color:var(--text);white-space:nowrap}
#rider-playbar .pb-tunepanel .ts output{font-variant-numeric:tabular-nums;text-align:right}
#rider-playbar .pb-tunepanel .tr{position:relative;height:22px;cursor:pointer;touch-action:none}
#rider-playbar .pb-tunepanel .tr::before{content:'';position:absolute;left:0;right:0;top:8px;height:6px;border-radius:3px;background:var(--field);border:2px solid var(--ink);box-sizing:border-box}
#rider-playbar .pb-tunepanel .tr i{position:absolute;top:4px;width:14px;height:14px;margin-left:-7px;border-radius:50%;background:var(--accent);border:2px solid var(--ink);box-sizing:border-box;pointer-events:none}
body.rider-playbar-desktop #rider-freecam-button{display:none!important}
body.rider-editing #rider-playbar{display:none}
body.rider-portrait #rider-playbar{visibility:hidden}
body.rider-playbar:not(.rider-editing) #page-tools{display:none}
body.rider-playbar #rider-level-actions>button:first-child{display:none}
body.rider-playbar #rider-mobile .toolbar>button{display:none}
body.rider-playbar #rider-mobile .readout>:is(.run-line,.coin-count,.fuel-count,.fuel-bar,.course-progress){display:none!important}
body.rider-playbar #rider-mobile .readout{background:transparent;text-shadow:0 1px 2px #000,0 0 3px #000}`;
  // Inside #app-container: fullscreen shows only that element (index.html full_screen_container).
  document.head.append(style); (document.getElementById('app-container') || document.body).append(root); document.body.classList.add('rider-playbar');
  root.addEventListener('contextmenu', e => e.preventDefault());
  // Tuning sliders: the track maps the pointer linearly (like the native track); a drag captures the game's input.
  root.addEventListener('pointerdown', e => {
    const tr = e.target.closest?.('.pb-tunepanel .tr'); if (!tr || e.button !== 0) return;
    e.preventDefault(); tr.setPointerCapture?.(e.pointerId); tuneDrag = tr; queue.push('tune_grab'); tuneAt(tr, e.clientX);
  });
  root.addEventListener('pointermove', e => { if (tuneDrag) tuneAt(tuneDrag, e.clientX); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) root.addEventListener(ev, () => { if (tuneDrag) { tuneDrag = null; queue.push('tune_release'); tuneKey = ''; canvasFocus(); } });
  // The 3D panel's sliders: a drag previews (look_drag, coalesced), the release commits (look_drop).
  root.addEventListener('pointerdown', e => { if (e.target.matches?.('.pb-lookpanel input[type=range]')) lookSliding = e.target; }, true);
  root.addEventListener('input', e => {
    const t = e.target; if (!t.matches('.pb-lookpanel input[type=range]')) return;
    const out = t.parentNode.querySelector('output'); if (out) out.textContent = fmt(Number(t.value));
    const text = 'look_drag:' + JSON.stringify({key: t.dataset.key, value: Number(t.value)}), last = lookQueue[lookQueue.length - 1];
    if (last && last.startsWith('look_drag:')) lookQueue[lookQueue.length - 1] = text; else lookQueue.push(text);
  });
  root.addEventListener('change', e => { const t = e.target; if (t.matches('.pb-lookpanel input[type=range]')) lookDrop(t); });
  // A pointer release hands the focus back to the game (keys drive again; the panel refreshes).
  for (const ev of ['pointerup', 'pointercancel']) document.addEventListener(ev, () => { if (lookSliding) { lookDrop(lookSliding); canvasFocus(); } }, true);
  root.addEventListener('pointerdown', e => {
    const b = e.target.closest('button'); if (!b || e.button !== 0 || b.disabled) return;
    if (b.dataset.tune) { e.preventDefault(); queue.push(b.dataset.tune); canvasFocus(); return; }
    if (b.dataset.look) { e.preventDefault(); lookQueue.push(b.dataset.look); lookKey = ''; canvasFocus(); return; }
    const act = b.dataset.act; if (!act) return;
    e.preventDefault();
    if (act === 'more') { menuOpen = !menuOpen; if (menuOpen) { window.riderMobile?.closePanels?.(); if (camState()?.open) queue.push('cam:close'); } render(); return; }
    if (b.closest('.pb-menu') && !b.closest('.touch-tools')) { menuOpen = false; }
    run(act); render();
  });
  // A press elsewhere closes the menu (touch tools keep it open while a drive pointer is held, as before).
  document.addEventListener('pointerdown', e => {
    if (root.contains(e.target) || e.target.closest?.('#rider-mobile .zones')) return;
    if (menuOpen) { menuOpen = false; render(); }
    if (camState()?.open) queue.push('cam:close');
  }, true);
  document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (menuOpen) { menuOpen = false; render(); } if (camState()?.open) queue.push('cam:close'); });
}
// Tuning (Claudio 2026-11-10: modernised like the camera menu): desktop HTML5 only; touch keeps its details panel.
let tuneDrag = null, tuneKey = '';
function tuneAt(tr, x) {
  const b = tr.getBoundingClientRect(), row = (window.riderTuning?.rows || []).find(r => r.key === tr.dataset.tkey); if (!row || !(b.width > 0)) return;
  const ratio = Math.max(0, Math.min(1, (x - b.left) / b.width)), display = row.min + ratio * (row.max - row.min);
  tr.querySelector('i').style.left = ratio * 100 + '%';
  const out = tr.parentNode.querySelector('output'); if (out) out.textContent = display.toFixed(2);
  const text = 'tune:' + row.key + ':' + (display * (row.sign || 1)), last = queue[queue.length - 1];
  if (last && last.startsWith('tune:' + row.key + ':')) queue[queue.length - 1] = text; else queue.push(text);
}
function tunePanel() {
  const T = window.riderTuning || false, el = root.querySelector('.pb-tunepanel'), row = root.querySelector('.pb-row');
  if (tuneDrag) return;
  const rr = row.getBoundingClientRect();
  const k = T ? JSON.stringify([T, rr.bottom, rr.right, innerWidth, innerHeight]) : '';
  if (k === tuneKey) return; tuneKey = k;
  el.hidden = !T;
  if (!T) return;
  const top = rr.bottom + 8;
  el.style.top = top + 'px'; el.style.right = Math.max(8, Math.round(innerWidth - rr.right)) + 'px';
  el.style.maxHeight = Math.max(88, innerHeight - top - 8) + 'px';
  const b = (cmd, o) => UI.button(Object.assign({d: {tune: cmd}}, o));
  const on = t => / ON\b/.test(t || '');
  el.innerHTML = '<div class="hd">' + UI.icon('speed') + '<span>Tuning</span>' + UI.button({icon: 'close', title: 'Close tuning', d: {act: 'tuning'}}) + '</div>'
    + '<div class="ps">' + (T.presets || []).map(p => b('tune_preset:' + p, {label: p.toUpperCase(), on: p === T.preset, title: 'Preset ' + p.toUpperCase()}).replace('<button', '<button data-preset="' + UI.esc(p) + '"')).join('') + '</div>'
    + '<div class="note">' + UI.esc(T.note || '') + '</div>'
    + '<div class="two">' + b('tune_crash', {label: T.crash || 'Crash', on: on(T.crash), title: 'Crash [C]'}).replace('<button', '<button data-tool="crash"')
      + b('tune_struts', {label: T.struts || 'Struts', on: on(T.struts), title: 'Struts'}).replace('<button', '<button data-tool="struts"') + '</div>'
    + (T.head ? '<div class="note">' + UI.esc(T.head) + '</div>' : '')
    + (T.rows || []).map(r => {
      const ratio = Math.max(0, Math.min(1, (r.value - r.min) / (r.max - r.min)));
      return `<div class="ts"><span>${UI.esc(r.label)}</span><div class="tr" data-tkey="${UI.esc(r.key)}" role="slider" aria-label="${UI.esc(r.label)}" aria-valuemin="${r.min}" aria-valuemax="${r.max}" aria-valuenow="${r.value}"><i style="left:${ratio * 100}%"></i></div><output>${Number(r.value).toFixed(2)}</output></div>`;
    }).join('')
    + '<div class="two">' + b('tune_audio', {label: T.audio || 'Sound [M]', title: 'Sound [M]'}) + b('tune_copy', {icon: 'copy', label: 'Copy [F]', title: 'Copy report [F]'}) + '</div>'
    + '<div class="note' + (T.physics_over ? ' over' : '') + '">' + UI.esc(T.physics || '') + '</div>';
  // The published test points follow the panel at once (the game republishes them through the same functions).
  if (Array.isArray(window.riderControls)) window.riderControls = controlsGeometry(window.riderControls);
  if (window.riderHud) window.riderHud = hudGeometry(window.riderHud);
}
// GUI screen pixels (canvas pixels, origin bottom left) of a DOM point, for the tests' riderControls/riderHud points.
function guiPoint(x, y) {
  const cv = document.querySelector('canvas'), r = cv?.getBoundingClientRect(); if (!r || !(r.width > 0)) return null;
  return {x: (x - r.left) * cv.width / r.width, y: (r.bottom - y) * cv.height / r.height};
}
function controlsGeometry(rows) {
  const el = root?.querySelector('.pb-tunepanel'); if (!el || el.hidden) return rows;
  return rows.map(row => {
    const tr = el.querySelector(`.tr[data-tkey="${row.key}"]`); if (!tr) return row;
    const b = tr.getBoundingClientRect(), y = (b.top + b.bottom) / 2;
    return Object.assign({}, row, {left: guiPoint(b.left, y) || row.left, right: guiPoint(b.right, y) || row.right});
  });
}
function hudGeometry(h) {
  // The game's tuning flag waits until the panel is drawn, so its points are the panel's.
  const el = root?.querySelector('.pb-tunepanel'); if (!el || el.hidden) return h && h.tuning ? Object.assign({}, h, {tuning: false}) : h;
  const centre = e => { if (!e) return null; const b = e.getBoundingClientRect(); return guiPoint((b.left + b.right) / 2, (b.top + b.bottom) / 2); };
  const presets = {};
  for (const k of Object.keys(h.presets || {})) presets[k] = centre(el.querySelector(`[data-preset="${k}"]`)) || h.presets[k];
  return Object.assign({}, h, {presets, crash: centre(el.querySelector('[data-tool="crash"]')) || h.crash, struts: centre(el.querySelector('[data-tool="struts"]')) || h.struts});
}
const lookQueue = [];
let lookSliding = null, lookKey = '';
const fmt = v => Number.isFinite(v) ? String(+v.toPrecision(4)) : '';
function lookDrop(t) { if (lookSliding === t) lookSliding = null; lookQueue.push('look_drop:' + JSON.stringify({key: t.dataset.key})); lookKey = ''; }
// The 3D look panel (Claudio 2026-11-10: the kit style, like Tuning), from riderLook3D; presses use the editor's names.
function lookPanel() {
  const L = window.riderLook3D || false, el = root.querySelector('.pb-lookpanel'), row = root.querySelector('.pb-row');
  // Keep the dragged or keyboard-focused slider; the panel catches up after its release or blur.
  if (lookSliding || document.activeElement?.matches?.('.pb-lookpanel input[type=range]')) return;
  const rr = row.getBoundingClientRect();
  const k = L ? JSON.stringify([L, rr.bottom, rr.right, innerWidth, innerHeight]) : '';
  if (k === lookKey) return; lookKey = k;
  el.hidden = !L;
  if (!L) return;
  const zones = document.querySelector('#rider-mobile .zones'), level = document.getElementById('rider-level-actions');
  const lows = [zones, level].filter(e => e && e.getClientRects().length).map(e => e.getBoundingClientRect().top);
  const top = rr.bottom + 8;
  el.style.top = top + 'px'; el.style.right = Math.max(8, Math.round(innerWidth - rr.right)) + 'px';
  el.style.maxHeight = Math.max(88, Math.floor((lows.length ? Math.min(...lows) : innerHeight) - top - 8)) + 'px';
  const b = (act, o) => UI.button(Object.assign({d: {look: act}}, o));
  el.innerHTML = '<div class="hd">' + UI.icon('cube') + '<span>3D look' + (L.dirty ? ' •' : '') + '</span>' + b('look_close', {icon: 'close', title: 'Close'}) + '</div>'
    + '<div class="modes">' + b('look_scope_level', {label: 'Level', on: L.scope === 'level', title: 'Whole level'}) + b('look_scope_selected', {label: 'Selected sections', on: L.scope === 'selected', title: 'Selected sections'}) + '</div>'
    + '<div class="note">' + UI.esc(L.note || '') + '</div>'
    + (L.controls || []).map(c => `<label class="lk${c.disabled ? ' dim' : ''}"><span>${UI.esc(c.label)}</span><output>${fmt(c.value)}</output>`
      + `<input type="range" min="${c.min}" max="${c.max}" step="${c.step || 'any'}" value="${c.value}" data-key="${UI.esc(c.key)}" aria-label="${UI.esc(c.label)}"${c.disabled ? ' disabled' : ''}></label>`).join('')
    + (L.error ? '<div class="err">' + UI.esc(L.error) + '</div>' : '<div class="note">Strength and angle are level-wide. Each finished change is one Undo step.</div>')
    + '<div class="ft">' + b('look_reset', {label: 'Reset', title: 'Reset this scope. Selected reset restores inheritance.'}) + b('look_close', {label: 'Close', title: 'Close without resetting settings'}) + '</div>';
}
function run(act) {
  const m = window.riderMobile;
  if (act === 'retry' || act === 'pause') { m?.request(act); canvasFocus(); return; }
  // Touch tuning toggles the adapter's details at once, as its toolbar did (desktop goes through ui.gui_script).
  if (act === 'tuning' && touch()) { m.toggleDetails(); key = ''; return; }
  if (act === 'levels') { m?.clear(); window.riderLevelsRequest = {action: 'open'}; return; }
  if (act === 'import') { m?.clear(); window.riderCustom?.open(); return; }
  if (act === 'freecam') { window.riderFreeCam?.set(!window.riderFreeCam.on); debugKey = ''; canvasFocus(); return; }
  // One panel at a time: the camera menu and the 3D look close each other.
  if (act === '3d' && camState()?.open) queue.push('cam:close');
  // Tuning (desktop) also takes the place of the camera menu and the 3D look, and they of it.
  if (act === 'tuning' && !touch() && !window.riderTuning) { if (camState()?.open) queue.push('cam:close'); if (window.riderLook3D) lookQueue.push('look_close'); }
  if ((act === 'camera' || act === '3d') && !touch() && window.riderTuning) queue.push('tuning');
  if (act === 'camera' && window.riderLook3D && !camState()?.open) lookQueue.push('look_close');
  if (act === 'camera') { menuOpen = false; if (!camState()?.open) window.riderMobile?.closePanels?.(); queue.push('cam:open'); canvasFocus(); return; }
  if (act === 'cam:none') return;
  if (act === 'quality' || act === 'fullscreen') { document.getElementById(act)?.click(); canvasFocus(); return; }
  queue.push(act); canvasFocus();
}
function render() {
  if (!root) mount();
  strip(); debugGroup(); card(); camPanel(); lookPanel(); tunePanel();
  const run = window.riderRun || {}, paused = !!window.riderTimeState?.paused || run.state === 'paused';
  const terminal = run.state === 'finished' || run.state === 'failed';
  const quality = document.getElementById('quality')?.textContent || 'Quality';
  // Tuning is open: the touch adapter's details or the native panel (body.rider-tuning, set by ui.gui_script).
  const tuning = !!window.riderMobile?.details || document.body.classList.contains('rider-tuning');
  const row = root.querySelector('.pb-row');
  const cs = camState(), camOpen = !!cs?.open;
  const look3d = !!window.riderLook3D;
  const k = JSON.stringify([paused, terminal && run.state, menuOpen, quality, touch(), tuning, row.style.right, menuOpen && innerWidth, menuOpen && innerHeight, !!cs && !cs.forced, camOpen, look3d]);
  if (k === key) return; key = k;
  const btn = (act, icon, title, extra = {}) => UI.button(Object.assign({icon, title, d: {act}}, extra));
  root.querySelector('.pb-row').innerHTML =
    btn('retry', 'retry', 'Retry')
    + UI.button({icon: paused ? 'play' : 'pause', title: terminal ? (run.state === 'finished' ? 'Finished' : 'Attempt ended') : paused ? 'Resume' : 'Pause', disabled: terminal, d: {act: 'pause'}}).replace('class="b', 'class="b ' + (paused ? 'resume' : 'pause'))
    + btn('tuning', 'speed', tuning ? 'Close tuning' : 'Tuning', {on: tuning})
    + (camState() && !camState().forced ? btn('camera', 'camera', camOpen ? 'Close camera' : 'Camera', {on: camOpen}) : '')
    + btn('3d', 'cube', look3d ? 'Close 3D look' : '3D look', {on: look3d})
    + btn('edit', 'pencil', 'Edit level')
    + btn('levels', 'flag', 'Levels')
    + btn('more', 'menu', 'More', {on: menuOpen}).replace('<button', `<button aria-expanded="${menuOpen}" aria-haspopup="true"`);
  const menu = root.querySelector('.pb-menu');
  menu.hidden = !menuOpen;
  // On touch the menu stays above the drive zones and level actions (it scrolls instead), as the old More did.
  if (menuOpen) {
    const zones = document.querySelector('#rider-mobile .zones'), level = document.getElementById('rider-level-actions');
    const lows = [zones, level].filter(e => e && e.getClientRects().length).map(e => e.getBoundingClientRect().top);
    const rr = row.getBoundingClientRect(), top = rr.bottom + 8;
    menu.style.top = top + 'px';
    // The menu follows the row (it moves left of an open tuning panel).
    menu.style.right = Math.max(8, Math.round(innerWidth - rr.right)) + 'px';
    menu.style.maxHeight = Math.max(44, Math.floor((lows.length ? Math.min(...lows) : innerHeight) - top - 8)) + 'px';
  }
  // The touch adapter's tools (station, speed, record/replay, layout, measure, tilt, report) move in here.
  const tools = document.getElementById('rider-mobile-more');
  if (tools && tools.parentNode !== menu) tools.classList.add('touch-tools');
  // Touch: the adapter's tools already hold Import, Quality and Fullscreen, so only Help is added.
  menu.innerHTML = btn('help', 'help', 'Help [H]', {label: 'Help'}) + (tools ? '' : btn('import', 'upload', 'Import level', {label: 'Import level'})
    + btn('quality', 'sparkle', quality, {label: quality}) + btn('fullscreen', 'fit', 'Fullscreen', {label: 'Fullscreen'}));
  if (tools) {
    menu.append(tools); tools.hidden = !menuOpen;
    // The adapter hides its menu after a tool runs: close this menu with it.
    if (!tools.dataset.watched) { tools.dataset.watched = '1'; new MutationObserver(() => { if (tools.hidden && menuOpen) { menuOpen = false; key = ''; render(); } }).observe(tools, {attributes: true, attributeFilter: ['hidden']}); }
  }
}
// #678 slice 2: the player strip and progress bar, from the run state the game already publishes
// (riderRun, riderCoins, riderFuel, riderProgress). Text nodes are updated in place every frame.
let stripKey = '';
const MEDALS = ['None', 'Bronze', 'Silver', 'Gold'];
function strip() {
  const run = window.riderRun, coins = window.riderCoins, fuel = window.riderFuel, prog = window.riderProgress, gain = window.riderFuelGain;
  const s = root.querySelector('.pb-strip'), p = root.querySelector('.pb-progress');
  const set = (sel, t) => { const n = s.querySelector(sel); if (n.textContent !== t) n.textContent = t; };
  const terminal = run && (run.state === 'finished' || run.state === 'failed');
  // Hidden while touch tuning is open (as the touch readout was) and when there is nothing to show.
  const tuning = !!window.riderMobile?.details;
  const hasCoins = !!(coins && (coins.total > 0 || coins.gem_total > 0)) && !terminal;
  const hasFuel = !!fuel && !terminal;
  s.hidden = tuning || !(run || hasCoins || hasFuel);
  if (!s.hidden) {
    // Time and run line only with a timed run; coins, gems and fuel on any course that has them (custom levels too).
    s.querySelector('.pb-time').hidden = !run;
    if (run) set('.pb-time', run.time.toFixed(2) + ' s');
    // Same words as the native run line (run_ui.lua) and the touch readout.
    const state = !run ? '' : run.state === 'ready' ? 'Drive to start' : run.state === 'paused' ? 'Paused' : run.state === 'failed' ? 'Attempt ended' : run.state === 'finished' ? 'Finished' : (run.course_name || 'Run');
    const parts = run ? [state, 'Best ' + (run.best > 0 ? run.best.toFixed(2) + ' s' : '--'), run.has_medals ? MEDALS[run.highest_medal || 0] : '', run.official ? 'Official' : 'Practice', run.save === 'saved' ? '' : run.save] : [];
    if (hasCoins) {
      parts.push('Bank ' + coins.bank + (coins.practice ? ' (practice, not banked)' : ''));
      if (coins.gem_total) parts.push('Earned ' + coins.gem_earned + '/' + coins.gem_total + ' · Gem bank ' + coins.gem_bank);
      if (coins.save && coins.save !== 'saved') parts.push(coins.save);
    }
    if (hasFuel) {
      // The fuel guidance (LOW FUEL, EMPTY …) and refills stay readable text, not only a bar.
      if (fuel.low || fuel.empty) parts.push(fuel.text);
      if (fuel.collected) parts.push('Refills ' + fuel.collected + (gain ? ' (+' + Number(gain).toFixed(1) + '%)' : ''));
    }
    set('.pb-best', parts.filter(Boolean).join(' · '));
    const c = s.querySelector('.pb-coins'), g = s.querySelector('.pb-gems'), f = s.querySelector('.pb-fuel');
    c.hidden = !hasCoins; g.hidden = !(hasCoins && coins.gem_total);
    if (hasCoins) { set('.pb-coins b', coins.count + '/' + coins.total); set('.pb-flash', coins.flash ? '+' + coins.flash : ''); }
    if (hasCoins && coins.gem_total) set('.pb-gems b', coins.gems + '/' + coins.gem_total);
    f.hidden = !hasFuel;
    if (hasFuel) { const w = Math.max(0, Math.min(100, fuel.amount)) + '%', bar = f.querySelector('.pb-fuelbar i'); if (bar.style.width !== w) bar.style.width = w; f.classList.toggle('low', !!(fuel.low || fuel.empty)); }
  }
  // Layout only when what sizes the strip changes (not the ticking time: it has a fixed width).
  let box = null;
  if (!s.hidden) {
    const key = [innerWidth, innerHeight, s.querySelector('.pb-best').textContent, s.querySelector('.pb-coins b').textContent, s.querySelector('.pb-flash').textContent, s.querySelector('.pb-gems b').textContent, !!run, hasCoins, hasFuel, menuOpen].join('|');
    if (key !== stripKey) {
      stripKey = key;
      // Keeps clear of the button row (right) and, where possible, of the debug corner (about 150 px).
      const R = root.querySelector('.pb-row').getBoundingClientRect().left - 12;
      s.style.maxWidth = Math.max(220, Math.min(R - 158, 440)) + 'px'; s.style.left = '50%'; s.style.transform = 'translateX(-50%)';
      const b = s.getBoundingClientRect();
      if (b.right > R) { s.style.transform = 'none'; s.style.left = Math.max(8, R - b.width) + 'px'; }
    }
    box = s.getBoundingClientRect();
  } else stripKey = '';
  const showProg = !!(!s.hidden && prog && prog.enabled && !prog.modal && !window.riderTelemetry?.ui_captured);
  p.hidden = !showProg;
  if (showProg) {
    const w = Math.min(360, box.width);
    const top = (box.bottom + 6) + 'px', width = w + 'px', left = (box.left + (box.width - w) / 2) + 'px';
    if (p.style.top !== top) p.style.top = top; if (p.style.width !== width) p.style.width = width; if (p.style.left !== left) p.style.left = left;
    const ok = !!prog.available;
    for (const n of p.querySelectorAll('.pb-pi,.pb-track,.pb-pct')) n.hidden = !ok;
    const r = p.querySelector('.pb-reason'); r.hidden = ok; const reason = ok ? '' : 'Progress unavailable: ' + prog.reason; if (r.textContent !== reason) r.textContent = reason;
    if (ok) {
      const pct = 100 * prog.fraction, t = Math.floor(pct + .000001) + '%' + (prog.phase === 'paused' ? ' · Paused' : '');
      p.querySelector('.pb-fill').style.width = pct + '%'; p.querySelector('.pb-car').style.left = pct + '%';
      const n = p.querySelector('.pb-pct'); if (n.textContent !== t) n.textContent = t;
    }
  }
}
// Slice 3: the desktop debug group, with the visibility rules of the native buttons it replaces.
let debugKey = '';
function debugGroup() {
  const g = root.querySelector('.pb-debug'), run = window.riderRun, t = window.riderTelemetry || {}, time = window.riderTimeState || {};
  const tuning = document.body.classList.contains('rider-tuning'), fc = window.riderFreeCam;
  // On touch the free camera keeps its own button (the group is desktop only).
  document.body.classList.toggle('rider-playbar-desktop', !touch());
  const show = {station: !run && !!t.station, section: (t.section_count || 0) > 1, step: !run, rec: !run && !tuning, fc: !!fc};
  const k = JSON.stringify([touch(), show, time.step || 1, fc && fc.on]);
  if (k === debugKey) return; debugKey = k;
  g.hidden = touch() || !Object.values(show).some(Boolean);
  if (g.hidden) return;
  const b = (act, icon, label, title, extra = {}) => UI.button(Object.assign({icon, label, title, d: {act}}, extra));
  g.innerHTML = (show.station ? b('station_next', 'arrows', 'Next', 'Next station') : '')
    + (show.section ? b('next_section', 'ramp', 'Section [V]', 'Next section') : '')
    + (show.step ? b('step', 'speed', 'Speed ' + (time.step || 1) + 'x [X]', 'Speed (slow motion) [X]') : '')
    + (show.rec ? b('record', 'history', 'Record [B]', 'Record run [B]') + b('replay', 'play', 'Replay [G]', 'Replay run [G]') : '')
    + (show.fc ? b('freecam', 'hand', fc.on ? 'Free cam ON [O]' : 'Free cam [O]', 'Free camera [O]', {on: fc.on}) : '');
}
// Slice 3b: the desktop debug card (speed, suspension and wheel contact, station, result, replay), from riderDebugCard.
let cardKey = '';
function card() {
  const c = window.riderDebugCard || false, el = root.querySelector('.pb-card');
  const k = JSON.stringify(c);
  if (k === cardKey) return; cardKey = k;
  el.hidden = !c;
  if (!c) { root.querySelector('.pb-map').hidden = true; return; }
  el.querySelector('.pb-speed').textContent = c.speed || '';
  const dots = el.querySelectorAll('.pb-dot');
  dots.forEach((d, i) => d.classList.toggle('on', !!(c.contact || [])[i]));
  el.querySelector('.pb-travel em').textContent = c.travel || '';
  const map = root.querySelector('.pb-map'); map.textContent = c.station || ''; map.hidden = !c.station;
  for (const [cls, v] of [['result', c.result], ['replay', c.replay]]) {
    const s = el.querySelector('.pb-' + cls); s.textContent = v || ''; s.hidden = !v;
  }
}
// The #443 camera menu (Claudio 2026-11-10: one camera button in the bar, its settings like Tuning). State comes from
// riderCamera443; every press is a cam:* command for ui.gui_script (camera_hud.command), so taps never drive.
let camKey = '';
const camState = () => window.riderCamera443 || null;
function camPanel() {
  const c = camState(), el = root.querySelector('.pb-campanel'), row = root.querySelector('.pb-row');
  const open = !!(c && c.open && !c.forced);
  const rr = row.getBoundingClientRect();
  const k = open ? JSON.stringify([c.seq, c.mode, c.rows, rr.bottom, rr.right, innerWidth, innerHeight, document.querySelector('#rider-mobile .readout')?.getBoundingClientRect().left]) : '';
  if (k === camKey) return; camKey = k;
  el.hidden = !open;
  if (!open) return;
  const zones = document.querySelector('#rider-mobile .zones'), level = document.getElementById('rider-level-actions');
  const lows = [zones, level].filter(e => e && e.getClientRects().length).map(e => e.getBoundingClientRect().top);
  // Short views (phones in landscape): two columns, and on touch left of the status line that sits under the bar.
  const compact = innerHeight < 600;
  const ro = document.querySelector('#rider-mobile .readout');
  const rb = ro && ro.getClientRects().length && getComputedStyle(ro).visibility === 'visible' ? ro.getBoundingClientRect() : null;
  const top = rr.bottom + 8;
  el.classList.toggle('compact', compact);
  el.style.top = top + 'px';
  el.style.right = Math.max(8, Math.round(innerWidth - (rb && rb.top < top + 40 ? rb.left - 8 : rr.right))) + 'px';
  el.style.maxHeight = Math.max(88, Math.floor((lows.length ? Math.min(...lows) : innerHeight) - top - 8)) + 'px';
  const b = (act, o) => UI.button(Object.assign({d: {act}}, o));
  const clean = t => String(t || '').replace(/[<>&]/g, '');
  const modes = '<div class="modes">' + ['a', 'b'].map(m => b(c.mode === m ? 'cam:none' : 'cam:toggle', {label: 'Cam ' + m.toUpperCase(), on: c.mode === m, title: 'Camera ' + m.toUpperCase()})
    .replace('<button', '<button data-mode="' + m + '"')).join('') + '</div>';
  el.innerHTML = '<div class="hd">' + UI.icon('camera') + '<span>Camera</span>' + (compact ? modes : '') + b('cam:close', {icon: 'close', title: 'Close'}) + '</div>'
    + (compact ? '' : modes) + '<div class="rows">' + c.rows.map((r, i) => '<div class="rw' + (c.b_only?.[i] && c.mode !== 'b' ? ' dim' : '') + '"><span>' + clean(r.text) + '</span>'
      + b('cam:step:' + r.key + ':-1', {label: '−', title: 'Less'}) + b('cam:step:' + r.key + ':1', {icon: 'plus', title: 'More'}) + '</div>').join('') + '</div>'
    + b('cam:reset', {label: 'Reset camera', title: 'Reset to camera A and every default', variant: 'wide'}).replace('class="b', 'class="b reset');
}
// Commands for main/game/ui.gui_script since the last call, as JSON.
function take() { return JSON.stringify(queue.splice(0)); }
// 3D look presses for main/editor/editor.gui_script (its own Lua state owns the look session).
function takeLook() { return JSON.stringify(lookQueue.splice(0)); }
window.riderPlayBar = {render, take, takeLook, controlsGeometry, hudGeometry, get open() { return menuOpen; }};
})();
