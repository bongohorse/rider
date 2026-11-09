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
  root.innerHTML = '<div class="float pb-row"></div><div class="pb-menu" hidden></div>';
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
body.rider-editing #rider-playbar{display:none}
body.rider-playbar:not(.rider-editing) #page-tools{display:none}
body.rider-playbar #rider-level-actions>button:first-child{display:none}
body.rider-playbar #rider-mobile .toolbar>button{display:none}`;
  document.head.append(style); document.body.append(root); document.body.classList.add('rider-playbar');
  root.addEventListener('contextmenu', e => e.preventDefault());
  root.addEventListener('pointerdown', e => {
    const b = e.target.closest('button'); if (!b || e.button !== 0 || b.disabled) return;
    const act = b.dataset.act; if (!act) return;
    e.preventDefault();
    if (act === 'more') { menuOpen = !menuOpen; if (menuOpen) window.riderMobile?.closePanels?.(); render(); return; }
    if (b.closest('.pb-menu') && !b.closest('.touch-tools')) { menuOpen = false; }
    run(act); render();
  });
  // A press elsewhere closes the menu (touch tools keep it open while a drive pointer is held, as before).
  document.addEventListener('pointerdown', e => { if (menuOpen && !root.contains(e.target) && !e.target.closest?.('#rider-mobile .zones')) { menuOpen = false; render(); } }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && menuOpen) { menuOpen = false; render(); } });
}
function run(act) {
  const m = window.riderMobile;
  if (act === 'retry' || act === 'pause') { m?.request(act); canvasFocus(); return; }
  // Touch tuning toggles the adapter's details at once, as its toolbar did (desktop goes through ui.gui_script).
  if (act === 'tuning' && touch()) { m.toggleDetails(); key = ''; return; }
  if (act === 'levels') { m?.clear(); window.riderLevelsRequest = {action: 'open'}; return; }
  if (act === 'import') { m?.clear(); window.riderCustom?.open(); return; }
  if (act === 'quality' || act === 'fullscreen') { document.getElementById(act)?.click(); canvasFocus(); return; }
  queue.push(act); canvasFocus();
}
function render(opts) {
  if (!root) mount();
  // #678: an open native tuning panel (canvas pixels from the left) keeps the top right: the row moves left of it.
  if (opts) {
    const c = document.querySelector('canvas'), row = root.querySelector('.pb-row');
    if (opts.panel_left !== false && c) {
      const r = c.getBoundingClientRect(), x = r.left + opts.panel_left * r.width / c.width;
      row.style.right = Math.max(8, Math.round(innerWidth - x + 8)) + 'px';
    } else row.style.right = '';
  }
  const run = window.riderRun || {}, paused = !!window.riderTimeState?.paused || run.state === 'paused';
  const terminal = run.state === 'finished' || run.state === 'failed';
  const quality = document.getElementById('quality')?.textContent || 'Quality';
  // Tuning is open: the touch adapter's details or the native panel (body.rider-tuning, set by ui.gui_script).
  const tuning = !!window.riderMobile?.details || document.body.classList.contains('rider-tuning');
  const row = root.querySelector('.pb-row');
  const k = JSON.stringify([paused, terminal, menuOpen, quality, touch(), tuning, row.style.right, menuOpen && innerWidth, menuOpen && innerHeight]);
  if (k === key) return; key = k;
  const btn = (act, icon, title, extra = {}) => UI.button(Object.assign({icon, title, d: {act}}, extra));
  root.querySelector('.pb-row').innerHTML =
    btn('retry', 'retry', 'Retry')
    + UI.button({icon: paused ? 'play' : 'pause', title: terminal ? 'Run ended' : paused ? 'Resume' : 'Pause', disabled: terminal, d: {act: 'pause'}}).replace('class="b', 'class="b ' + (paused ? 'resume' : 'pause'))
    + btn('tuning', 'speed', tuning ? 'Close tuning' : 'Tuning', {on: tuning})
    + btn('3d', 'cube', '3D look')
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
// Commands for main/game/ui.gui_script since the last call, as JSON.
function take() { return JSON.stringify(queue.splice(0)); }
window.riderPlayBar = {render, take, get open() { return menuOpen; }};
})();
