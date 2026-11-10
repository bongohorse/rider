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
    + '<div class="float pb-debug" hidden></div><div class="pb-cam" aria-hidden="true"></div>'
    + '<div class="float pb-card" hidden><b class="pb-speed"></b><span class="pb-travel"><i class="pb-dot"></i>L <i class="pb-dot"></i>R <em></em></span>'
    + '<span class="pb-station"></span><span class="pb-result"></span><span class="pb-replay"></span></div>';
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
#rider-playbar .pb-card{position:fixed;left:max(12px,env(safe-area-inset-left));top:max(52px,env(safe-area-inset-top));z-index:1040;pointer-events:none;
 flex-direction:column;align-items:flex-start;gap:3px;padding:8px 12px;width:220px;box-sizing:border-box;white-space:normal;overflow-wrap:anywhere;font:700 12px var(--body);color:var(--muted);font-variant-numeric:tabular-nums}
/* A fixed width: longer lines wrap, so the camera control placed beside it does not move while text changes. */
#rider-playbar .pb-card b{font:800 15px var(--disp);color:var(--text)}#rider-playbar .pb-card em{font-style:normal;color:var(--text)}
#rider-playbar .pb-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#59636e;margin:0 3px 0 0;vertical-align:middle}#rider-playbar .pb-dot.on{background:var(--go)}
#rider-playbar .pb-travel i+i{margin-left:8px}#rider-playbar .pb-station{color:var(--text)}#rider-playbar .pb-replay{color:#9ae0ff}
#rider-playbar .pb-cam,#rider-playbar .pb-cam *{pointer-events:none}
#rider-playbar .pb-cam>*{position:fixed;box-sizing:border-box;z-index:1040}#rider-playbar .pb-cam .b{--h:100%;width:100%;font:800 13px var(--body);padding:0 6px}
#rider-playbar .pb-cam .b.big{font-size:20px}#rider-playbar .pb-cam .lab{display:flex;align-items:center;font:700 12px var(--body);color:var(--text);white-space:nowrap;overflow:hidden}
#rider-playbar .pb-cam .lab.dim{color:var(--muted);opacity:.7}#rider-playbar .pb-cam .ttl{font:800 14px var(--disp)}
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
  if (act === 'freecam') { window.riderFreeCam?.set(!window.riderFreeCam.on); debugKey = ''; canvasFocus(); return; }
  if (act === 'quality' || act === 'fullscreen') { document.getElementById(act)?.click(); canvasFocus(); return; }
  queue.push(act); canvasFocus();
}
function render() {
  if (!root) mount();
  strip(); debugGroup(); card(); cam();
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
  if (!c) return;
  el.querySelector('.pb-speed').textContent = c.speed || '';
  const dots = el.querySelectorAll('.pb-dot');
  dots.forEach((d, i) => d.classList.toggle('on', !!(c.contact || [])[i]));
  el.querySelector('.pb-travel em').textContent = c.travel || '';
  for (const [cls, v] of [['station', c.station], ['result', c.result], ['replay', c.replay]]) {
    const s = el.querySelector('.pb-' + cls); s.textContent = v || ''; s.hidden = !v;
  }
}
// The #443 camera control in the kit style, drawn over its transparent native tap targets (riderCamera443 rects are
// GUI screen pixels with the origin bottom left). Purely visual: taps reach the canvas.
let camKey = '';
function cam() {
  const c = window.riderCamera443, el = root.querySelector('.pb-cam'), cv = document.querySelector('canvas');
  const r = cv && cv.getBoundingClientRect();
  const k = c && r ? [c.seq, r.left, r.top, r.width, r.height, cv.width, cv.height].join() : '';
  if (k === camKey) return; camKey = k;
  if (!c || !r || !c.control || c.forced) { el.innerHTML = ''; return; }
  const sx = r.width / cv.width, sy = r.height / cv.height, clean = s => String(s || '').replace(/[<>&]/g, '');
  const at = q => `left:${r.left + q.x0 * sx}px;top:${r.top + (cv.height - q.y1) * sy}px;width:${(q.x1 - q.x0) * sx}px;height:${(q.y1 - q.y0) * sy}px`;
  const btn = (q, o, cls = '') => q ? `<div style="${at(q)}">${UI.button(o).replace('class="b', 'class="b' + cls)}</div>` : '';
  let h = btn(c.toggle, {label: c.label, on: c.mode === 'b', title: 'Switch camera'}) + btn(c.set, {label: 'Set', on: c.open, title: 'Camera settings'});
  if (c.open && c.panel && c.reset) {
    const p = c.panel, line = (q, x0, w, cls, text) => `<div class="lab ${cls}" style="left:${r.left + x0 * sx}px;top:${r.top + (cv.height - q.y1) * sy}px;width:${w * sx}px;height:${(q.y1 - q.y0) * sy}px">${clean(text)}</div>`;
    h += `<div class="float" style="${at(p)}"></div>` + line(c.reset, p.x0 + 12, c.reset.x0 - p.x0 - 16, 'ttl', c.title);
    h += btn(c.reset, {label: 'Reset', title: 'Reset camera'}) + btn(c.close, {icon: 'close', title: 'Close'});
    c.rows.forEach((row, i) => {
      if (!row.minus) return;
      const x0 = row.minus.x0 - 160 * (row.minus.x1 - row.minus.x0) / 48;
      h += line(row.minus, x0, row.minus.x0 - x0 - 6, c.b_only?.[i] && c.mode !== 'b' ? 'dim' : '', row.text);
      h += btn(row.minus, {label: '−', title: 'Less'}, ' big') + btn(row.plus, {icon: 'plus', title: 'More'});
    });
  }
  // Not focusable: `inert` here broke canvas taps under it in Chromium (cam443), so the buttons only leave the Tab order.
  el.innerHTML = h.replace(/<button /g, '<button tabindex="-1" ');
}
// Commands for main/game/ui.gui_script since the last call, as JSON.
function take() { return JSON.stringify(queue.splice(0)); }
window.riderPlayBar = {render, take, get open() { return menuOpen; }};
})();
