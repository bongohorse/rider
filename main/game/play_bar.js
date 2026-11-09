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
    + '<b class="pb-pct"></b><span class="pb-reason"></span></div>';
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
#rider-playbar .pb-strip.two .pb-best{order:9;flex-basis:100%;text-align:center;font-size:11.5px}
#rider-playbar .pb-time{font:800 22px var(--disp);color:var(--text);font-variant-numeric:tabular-nums}
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
body.rider-editing #rider-playbar{display:none}
body.rider-portrait #rider-playbar{visibility:hidden}
body.rider-playbar:not(.rider-editing) #page-tools{display:none}
body.rider-playbar #rider-level-actions>button:first-child{display:none}
body.rider-playbar #rider-mobile .toolbar>button{display:none}
body.rider-playbar #rider-mobile .readout>:is(.run-line,.coin-count,.fuel-count,.fuel-bar,.course-progress){display:none!important}
body.rider-playbar #rider-mobile .readout{background:transparent}`;
  // Inside #app-container: fullscreen shows only that element (index.html full_screen_container).
  document.head.append(style); (document.getElementById('app-container') || document.body).append(root); document.body.classList.add('rider-playbar');
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
function render() {
  if (!root) mount();
  strip();
  const run = window.riderRun || {}, paused = !!window.riderTimeState?.paused || run.state === 'paused';
  const terminal = run.state === 'finished' || run.state === 'failed';
  const quality = document.getElementById('quality')?.textContent || 'Quality';
  // Tuning is open: the touch adapter's details or the native panel (body.rider-tuning, set by ui.gui_script).
  const tuning = !!window.riderMobile?.details || document.body.classList.contains('rider-tuning');
  const row = root.querySelector('.pb-row');
  const k = JSON.stringify([paused, terminal && run.state, menuOpen, quality, touch(), tuning, row.style.right, menuOpen && innerWidth, menuOpen && innerHeight]);
  if (k === key) return; key = k;
  const btn = (act, icon, title, extra = {}) => UI.button(Object.assign({icon, title, d: {act}}, extra));
  root.querySelector('.pb-row').innerHTML =
    btn('retry', 'retry', 'Retry')
    + UI.button({icon: paused ? 'play' : 'pause', title: terminal ? (run.state === 'finished' ? 'Finished' : 'Attempt ended') : paused ? 'Resume' : 'Pause', disabled: terminal, d: {act: 'pause'}}).replace('class="b', 'class="b ' + (paused ? 'resume' : 'pause'))
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
// #678 slice 2: the player strip and progress bar, from the run state the game already publishes
// (riderRun, riderCoins, riderFuel, riderProgress). Text nodes are updated in place every frame.
function strip() {
  const run = window.riderRun, coins = window.riderCoins, fuel = window.riderFuel, prog = window.riderProgress;
  const s = root.querySelector('.pb-strip'), p = root.querySelector('.pb-progress');
  const set = (sel, t) => { const n = s.querySelector(sel); if (n.textContent !== t) n.textContent = t; };
  s.hidden = !run;
  if (run) {
    set('.pb-time', run.time.toFixed(2) + ' s');
    const state = run.state === 'ready' ? 'Drive to start' : run.state === 'paused' ? 'Paused' : run.state === 'failed' ? 'Attempt ended' : run.state === 'finished' ? 'Finished' : '';
    set('.pb-best', [state, 'Best ' + (run.best > 0 ? run.best.toFixed(2) + ' s' : '--'), run.official ? (run.has_medals ? ['None', 'Bronze', 'Silver', 'Gold'][run.highest_medal] : 'Official') : 'Practice', run.save === 'saved' ? '' : run.save].filter(Boolean).join(' · '));
    const c = s.querySelector('.pb-coins'), g = s.querySelector('.pb-gems'), f = s.querySelector('.pb-fuel');
    c.hidden = !coins; g.hidden = !(coins && coins.gem_total);
    if (coins) { set('.pb-coins b', coins.count + '/' + coins.total); set('.pb-flash', coins.flash ? '+' + coins.flash : ''); c.title = 'Coins · bank ' + coins.bank; }
    if (coins && coins.gem_total) { set('.pb-gems b', coins.gems + '/' + coins.gem_total); g.title = 'Wonder Gems · earned ' + coins.gem_earned + ' · gem bank ' + coins.gem_bank; }
    f.hidden = !fuel;
    if (fuel) { f.querySelector('.pb-fuelbar i').style.width = Math.max(0, Math.min(100, fuel.amount)) + '%'; f.classList.toggle('low', !!fuel.low); f.title = fuel.text + ' · refills ' + fuel.collected; }
  }
  // Centred when there is room; otherwise it ends left of the button row and wraps to two lines.
  let box = null;
  if (run) {
    // Keeps clear of the button row (right) and of the debug corner (about 150 px on the left).
    const R = root.querySelector('.pb-row').getBoundingClientRect().left - 12;
    s.classList.remove('two'); s.style.maxWidth = Math.max(160, R - 8) + 'px'; s.style.left = '50%'; s.style.transform = 'translateX(-50%)';
    box = s.getBoundingClientRect();
    // Two lines: the status line below; the strip keeps the width of its first line.
    if (box.width > R - 150) { s.classList.add('two'); s.style.maxWidth = Math.max(160, Math.min(R - 150, 330)) + 'px'; box = s.getBoundingClientRect(); }
    if (box.right > R) { s.style.transform = 'none'; s.style.left = Math.max(8, R - box.width) + 'px'; box = s.getBoundingClientRect(); }
  }
  const showProg = !!(run && prog && prog.enabled && !prog.modal && !window.riderTelemetry?.ui_captured);
  p.hidden = !showProg;
  if (showProg) {
    const w = Math.min(360, box.width); p.style.top = (box.bottom + 6) + 'px'; p.style.width = w + 'px'; p.style.left = (box.left + (box.width - w) / 2) + 'px';
    const ok = !!prog.available;
    for (const n of p.querySelectorAll('.pb-pi,.pb-track,.pb-pct')) n.hidden = !ok;
    const r = p.querySelector('.pb-reason'); r.hidden = ok; r.textContent = ok ? '' : 'Progress unavailable: ' + prog.reason;
    if (ok) { const pct = 100 * prog.fraction; p.querySelector('.pb-fill').style.width = pct + '%'; p.querySelector('.pb-car').style.left = pct + '%'; p.querySelector('.pb-pct').textContent = Math.floor(pct + .000001) + '%'; }
  }
}
// Commands for main/game/ui.gui_script since the last call, as JSON.
function take() { return JSON.stringify(queue.splice(0)); }
window.riderPlayBar = {render, take, get open() { return menuOpen; }};
})();
