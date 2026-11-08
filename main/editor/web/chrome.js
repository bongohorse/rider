// #684/#685: floating top tool bar, level chip, system buttons and the left library of the HTML editor chrome (#682), built from the
// UI kit (#683). UI only: clicks queue the same button names the Defold editor uses (on_button in
// main/editor/editor.gui_script), and Lua drains them with take(); Lua sends the state with render().
(() => {
'use strict';
if (window.riderChrome) return;
const UI = window.riderUI;
const queue = [];
let root = null, state = null, last = '', menuOpen = false;
// #685 library: the tab is view state of the chrome; everything else comes from Lua.
let tab = 'play', libKey = '', lastTool = null, lastSel = null, lastList = '';
const INK = '#0d0f13';
const ART = {
  start:`<path d="M14 42V8" stroke="${INK}" stroke-width="3"/><path d="M14 8h22l-5 7 5 7H14z" fill="#ff7b54" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`,
  finish:`<path d="M12 42V8" stroke="${INK}" stroke-width="3"/><rect x="12" y="8" width="26" height="16" fill="#fff" stroke="${INK}" stroke-width="2"/><path d="M12 8h6.5v8H12zM25 8h6.5v8H25zM18.5 16H25v8h-6.5zM31.5 16H38v8h-6.5z" fill="${INK}"/>`,
  coin:`<circle cx="24" cy="24" r="14" fill="#ffd23f" stroke="${INK}" stroke-width="2.5"/><circle cx="24" cy="24" r="9" fill="none" stroke="#e0a800" stroke-width="2"/><path d="M24 18v12" stroke="#b07f00" stroke-width="3" stroke-linecap="round"/>`,
  fuel:`<path d="M12 12h18l6 6v24H12z" fill="#ff4f5e" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><rect x="16" y="6" width="10" height="6" rx="2" fill="#ffd23f" stroke="${INK}" stroke-width="2"/><path d="M18 26l6-6 6 6-6 6z" fill="#fff"/>`,
  gem:`<path d="M14 12h20l7 9-17 20L7 21z" fill="#b48cff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path d="M7 21h34M19 12l5 29 5-29" stroke="${INK}" stroke-width="1.5" fill="none" opacity=".5"/>`,
  crate:`<rect x="9" y="11" width="30" height="30" rx="3" fill="#c98a52" stroke="${INK}" stroke-width="2"/><path d="M9 11l30 30M39 11L9 41" stroke="${INK}" stroke-width="2" opacity=".55"/>`,
  plate:`<rect x="6" y="34" width="36" height="6" rx="2" fill="#ffd23f" stroke="${INK}" stroke-width="2"/><path d="M24 10v14M19 19l5 5 5-5" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  gate:`<path d="M8 42V6M40 42V6" stroke="${INK}" stroke-width="3"/><rect x="12" y="10" width="24" height="32" fill="#9aa4b5" stroke="${INK}" stroke-width="2"/><path d="M18 10v32M24 10v32M30 10v32" stroke="${INK}" stroke-width="1.5" opacity=".5"/>`,
  flat:`<path d="M4 32h40v10H4z" fill="#4cc9ff" stroke="${INK}" stroke-width="2"/>`,
  ramp:`<path d="M4 42h40V14z" fill="#4cc9ff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`,
  step:`<path d="M4 42V32h18V20h22v22z" fill="#4cc9ff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`,
  gap:`<path d="M4 30h14v12H4zM30 30h14v12H30z" fill="#4cc9ff" stroke="${INK}" stroke-width="2"/><path d="M21 34h6" stroke="#fff" stroke-width="2" stroke-dasharray="2 2"/>`,
  kicker:`<path d="M4 42V34h20c8 0 14-6 18-14v22z" fill="#4cc9ff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`,
  platform:`<rect x="8" y="18" width="32" height="8" rx="2" fill="#4cc9ff" stroke="${INK}" stroke-width="2"/><path d="M14 26v16M34 26v16" stroke="${INK}" stroke-width="3"/>`,
  wave:`<path d="M4 42V30c6-10 12-10 18 0s12 10 22 0v12z" fill="#4cc9ff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`,
};
const art = k => `<svg class="art" viewBox="0 0 48 48" aria-hidden="true">${ART[k] || ART.crate}</svg>`;
const GAMEPLAY = [['start','Start'],['finish','Finish'],['coin','Coin'],['fuel','Fuel'],['gem','Gem'],['crate','Crate'],['plate','Plate'],['gate','Gate']];
const GAME_TOOLS = new Set(GAMEPLAY.map(g => g[0]));
// Rail: tabs built here, and launchers that open the existing panels until #705/#706 move them into the library.
// Launchers use their own names (lib_decor, lib_bg, lib_tex), mapped in editor.gui_script, so the footer's
// tool_decoration/track_textures buttons keep theirs.
const RAIL = [['play','flag','var(--k-play)','Gameplay'],['track','ramp','var(--k-track)','Track parts'],['decor','tree','var(--k-decor)','Decor (opens the Decor tool)','lib_decor'],
  ['bg','mountain','var(--k-bg)','Background (opens Track textures)','lib_bg'],['tex','texture','var(--k-tex)','Ground texture (opens Track textures)','lib_tex'],['objects','list','var(--k-obj)','Level objects']];
const TOOLS = [['select','cursor','Select · move [S]'],['draw','pencil','Draw line [D]'],['curve','curve','Draw curve [C]'],['prefab','ramp','Prefab parts [P]'],['label','text','Label [L]'],['pan','hand','Pan']];
function mount() {
  UI.install();
  root = document.createElement('div');
  root.id = 'rider-chrome'; root.className = 'rider-ui';
  root.innerHTML = '<div class="float chrome-chip" id="rider-chrome-chip"></div><div class="float chrome-tools" id="rider-chrome-tools"></div><div class="float chrome-sys" id="rider-chrome-sys"></div>'
    + '<aside class="dock chrome-dock" id="rider-chrome-dock" hidden><div class="rail" id="rider-lib-rail"></div><div class="pane" id="rider-lib-pane"></div></aside>';
  const style = document.createElement('style'); style.id = 'rider-chrome-style';
  style.textContent = `#rider-chrome .float{position:fixed;z-index:400}
#rider-chrome .chrome-chip{left:12px;top:8px;padding:5px 12px 5px 6px;max-width:min(360px,30vw)}
#rider-chrome .chrome-chip .name{display:flex;flex-direction:column;line-height:1.1;min-width:0}
#rider-chrome .chrome-chip b{font:800 16px var(--disp);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#rider-chrome .chrome-chip small{font:800 11px var(--body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--go)}
#rider-chrome .chrome-chip small.warn{color:var(--accent)}#rider-chrome .chrome-chip small.error{color:var(--danger)}
#rider-chrome .chrome-tools{left:50%;top:8px;transform:translateX(-50%)}
#rider-chrome .chrome-tools .b{--c:var(--accent)}
#rider-chrome .chrome-sys{right:12px;top:8px}
#rider-chrome .b.warnings-on{color:var(--accent)}#rider-chrome .b.warnings-block{color:var(--danger)}
#rider-chrome button *{pointer-events:none}
#rider-chrome .chrome-files{display:contents}#rider-chrome .chrome-more{display:none}
@media (max-width:1100px){#rider-chrome .chrome-more{display:inline-flex}#rider-chrome .chrome-files{display:none}
 #rider-chrome .chrome-files.open{display:flex;flex-direction:column;gap:6px;position:absolute;top:calc(100% + 8px);right:0;background:var(--panel);border:var(--ol) solid var(--ink);border-radius:14px;padding:6px;box-shadow:0 5px 0 var(--ink)}
 #rider-chrome .chrome-sys{gap:4px}}
#rider-chrome .chrome-dock{position:fixed;left:12px;top:72px;bottom:auto;max-height:calc(100vh - 160px);z-index:390}
#rider-chrome .chrome-dock .pane{width:292px}
#rider-chrome .chrome-dock .rail{overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--line) transparent}
@media (max-height:560px){#rider-chrome .chrome-dock .rail{gap:4px;padding:4px}#rider-chrome .chrome-dock .rail .b{--h:38px}}
#rider-chrome .chrome-dock.closed .pane{display:none}
#rider-chrome .chrome-dock .rail .b{color:var(--c)}#rider-chrome .chrome-dock .rail .b.on{color:var(--ink)}#rider-chrome .chrome-dock .rail .b.plain{color:var(--text)}
#rider-chrome .lib-grid3{grid-template-columns:repeat(3,1fr)}
#rider-chrome .lib-counts{display:flex;gap:6px}
#rider-chrome .lib-counts span{display:flex;align-items:center;gap:4px;height:28px;padding:0 9px 0 6px;border-radius:10px;background:var(--field);font:900 12px var(--body)}
#rider-chrome .lib-counts svg{width:16px;height:16px}
#rider-chrome .lib-search{justify-content:flex-start;width:100%;height:40px;padding:0 10px;gap:8px;font:800 14px var(--body);color:var(--muted)}
#rider-chrome .lib-search.typing{border-color:var(--accent);color:var(--text)}
#rider-chrome .lib-search .caret{display:inline-block;width:2px;height:16px;background:var(--accent);margin-left:1px}
#rider-chrome .lib-objects{overflow:hidden}
#rider-chrome .lib-rows{display:flex;flex-direction:column;gap:5px;overflow-y:auto;min-height:0;flex:1;scrollbar-width:thin;scrollbar-color:var(--line) transparent}
#rider-chrome .lib-row{display:grid;grid-template-columns:1fr auto auto;gap:5px;align-items:center}
#rider-chrome .lib-row .sel{height:44px;justify-content:center;padding:0 10px;display:flex;flex-direction:column;align-items:flex-start;gap:0;--c:var(--k-obj);color:var(--text)}
#rider-chrome .lib-row .sel b{font:800 13px var(--disp);line-height:1.1;max-width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#rider-chrome .lib-row .sel small{font:800 10.5px var(--body);color:var(--muted);line-height:1.1;max-width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#rider-chrome .lib-row .sel.on small{color:var(--ink)}
#rider-chrome .lib-row .b{--h:40px}
`;
  document.head.append(style); document.body.append(root);
  // Keyboard focus never leaves the canvas: editor shortcuts (Ctrl+Z, E, Delete …) are read there. The Defold
  // engine focuses the target of every mouse and wheel event (GLFW.isCanvasActive), so chrome elements ignore
  // focus() (see unfocusable) and only buttons are pointer targets.
  root.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
  root.addEventListener('focusin', () => document.querySelector('canvas')?.focus());
  const closeMenu = () => { if (menuOpen) { menuOpen = false; render(state); } };
  document.addEventListener('pointerdown', e => { if (!root.contains(e.target)) closeMenu(); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); }, true);
  // Like the Defold editor buttons, a chrome button acts on press. preventDefault keeps keyboard focus on
  // the canvas (the editor treats canvas blur as focus loss).
  root.addEventListener('pointerdown', e => {
    const b = e.target.closest('button'); if (!b) return;
    e.preventDefault();
    if (e.button !== 0 || !e.isPrimary || b.disabled) return;
    if (b.dataset.act === 'chrome-menu') { menuOpen = !menuOpen; render(state); return; }
    if (b.dataset.tab) { tab = b.dataset.tab; libKey = ''; if (state?.lib?.collapsed) queue.push('collapse_tools'); library(state); return; }
    if (!b.dataset.cmd) return;
    if (menuOpen) { menuOpen = false; render(state); }
    queue.push(b.dataset.cmd);
    document.querySelector('canvas')?.focus();
  });
}
// The buttons are built once and then only updated in place: rebuilding them while a pointer is down
// (e.g. on an autosave status change) would lose the pressed element.
function build() {
  const tools = TOOLS.map(([id, icon, title]) => UI.button({icon, title, d: {cmd: 'tool_' + id}})).join('')
    + '<span class="sep"></span>'
    + UI.button({icon: 'undo', title: 'Undo [Ctrl+Z]', d: {cmd: 'undo'}})
    + UI.button({icon: 'redo', title: 'Redo [Ctrl+Y]', d: {cmd: 'redo'}})
    + '<span class="sep"></span>'
    + UI.play({act: null, title: 'Play from START [E]'}).replace('<button', '<button data-cmd="play"');
  // New, Open, Import and Export fold into a menu on narrow screens (.chrome-files).
  const files = UI.button({icon: 'filenew', title: 'New level', d: {cmd: 'new'}})
    + UI.button({icon: 'folder', title: 'Open levels and templates', d: {cmd: 'open'}})
    + UI.button({icon: 'upload', title: 'Import JSON', d: {cmd: 'import'}})
    + UI.button({icon: 'download', title: 'Export JSON', d: {cmd: 'export'}});
  const sys = UI.button({icon: 'history', title: 'Versions: restore saved versions and named snapshots', d: {cmd: 'versions'}})
    + `<span class="chrome-files">${files}</span>`
    + UI.button({icon: 'menu', title: 'Level files', act: 'chrome-menu'}).replace('class="b', 'class="b chrome-more')
    + UI.button({icon: 'check', title: 'Problems', tag: '', d: {cmd: 'warnings'}})
    + UI.button({icon: 'help', title: 'Help [H]', d: {cmd: 'view_help'}});
  root.querySelector('#rider-chrome-tools').innerHTML = tools;
  root.querySelector('#rider-chrome-sys').innerHTML = sys;
  root.querySelector('#rider-chrome-chip').innerHTML = '<span class="name"><b></b><small></small></span>';
  unfocusable();
}
const q = sel => root.querySelector(sel);
const noop = () => {};
function unfocusable() { root.focus = noop; for (const e of root.querySelectorAll('*')) e.focus = noop; }
function setOn(b, on) { b.classList.toggle('on', on); if (on) b.setAttribute('aria-pressed', 'true'); else b.removeAttribute('aria-pressed'); }
function update(s) {
  for (const [id] of TOOLS) setOn(q(`[data-cmd="tool_${id}"]`), s.tool === id);
  q('[data-cmd="undo"]').disabled = !s.undo;
  q('[data-cmd="redo"]').disabled = !s.redo;
  q('.chrome-files').classList.toggle('open', menuOpen);
  setOn(q('[data-act="chrome-menu"]'), menuOpen);
  const w = s.warnings || {}, warn = q('[data-cmd="warnings"]'), alert = w.count > 0 || w.blocking;
  warn.classList.toggle('warnings-block', !!w.blocking);
  warn.classList.toggle('warnings-on', !w.blocking && w.count > 0);
  warn.title = w.label || 'Problems'; warn.setAttribute('aria-label', warn.title);
  warn.querySelector('use').setAttribute('href', alert ? '#ui-warn' : '#ui-check');
  const tag = warn.querySelector('.tag'); tag.textContent = w.count > 0 ? w.count : ''; tag.hidden = !(w.count > 0);
  const title = q('.chrome-chip b'), status = q('.chrome-chip small');
  title.textContent = s.title || ''; title.title = s.title || '';
  status.textContent = s.status || ''; status.title = s.status || '';
  status.className = /failed/i.test(s.status) ? 'error' : /only/i.test(s.status) ? 'warn' : '';
}
// Follow the editor's own layout scale (Defold shrinks the desktop layout in small windows), but keep
// phone-landscape buttons usable: at least 75 % unless the window is tinier than any supported layout.
function fit() {
  if (!root) return;
  const c = document.querySelector('canvas'), css = Math.min(1, (c && c.clientWidth || 1280) / 1280);
  root.style.zoom = String(css >= 0.5 ? Math.max(css, 0.75) : css);
}
function render(s) {
  if (!root) { mount(); build(); fit(); addEventListener('resize', fit); }
  state = s;
  if (!s.visible) { menuOpen = false; queue.length = 0; }
  root.hidden = !s.visible;
  const key = JSON.stringify(s) + menuOpen;
  if (key === last || !s.visible) return;
  last = key;
  update(s);
  library(s);
}

function library(s) {
  const dock = q('#rider-chrome-dock'), L = s && s.lib;
  dock.hidden = !L;
  if (!L) return;
  // Lua encodes an empty table as {}: normalise the lists.
  if (!Array.isArray(L.objects)) L.objects = [];
  if (!Array.isArray(L.kinds)) L.kinds = [];
  // Follow the active tool: a prefab kind shows Track parts, a gameplay tool shows Gameplay, a search Objects.
  if (s.tool !== lastTool) { if (s.tool === 'prefab') tab = 'track'; else if (GAME_TOOLS.has(s.tool)) tab = 'play'; lastTool = s.tool; }
  if (L.searching) tab = 'objects';
  const key = JSON.stringify([L, s.tool, tab]);
  if (key === libKey) return;
  libKey = key;
  dock.classList.toggle('closed', !!L.collapsed);
  q('#rider-lib-rail').innerHTML = UI.button({icon: L.collapsed ? 'chevr' : 'chevl', title: L.collapsed ? 'Open the library' : 'Collapse the library', variant: 'plain', d: {cmd: 'collapse_tools'}})
    + RAIL.map(([id, icon, color, title, cmd]) => cmd ? UI.button({icon, color, title, on: cmd === 'lib_decor' && s.tool === 'decoration', d: {cmd}}) : UI.button({icon, color, title, on: !L.collapsed && tab === id, d: {tab: id}})).join('');
  if (L.collapsed) { q('#rider-lib-pane').innerHTML = ''; unfocusable(); return; }
  const R = Object.fromEntries(RAIL.map(r => [r[0], r]));
  const head = id => UI.dockHeader({title: R[id][3], icon: R[id][1], color: R[id][2]});
  let h = '';
  if (tab === 'play') {
    h = head('play') + '<div class="pbody"><div class="grid" style="--c:var(--k-play)">' + GAMEPLAY.map(([id, name]) =>
      `<button type="button" class="tile named${s.tool === id ? ' on' : ''}" data-cmd="tool_${id}" title="Place ${UI.esc(name)}${id === 'coin' ? '; Select [S] to move, copy or delete' : ''}">${art(id)}<span class="nm">${UI.esc(name)}</span></button>`).join('')
      + `</div><div class="lib-counts"><span style="color:#ffd23f" title="Gold coins">${UI.icon('coin')}<b style="color:var(--text)">${L.gold}</b></span><span style="color:#b48cff" title="Wonder Gems">${UI.icon('gem')}<b style="color:var(--text)">${L.gems}</b></span></div></div>`;
  } else if (tab === 'track') {
    h = head('track') + '<div class="pbody"><div class="grid lib-grid3" style="--c:var(--k-track)">' + L.kinds.map((k, i) =>
      `<button type="button" class="tile named${s.tool === 'prefab' && L.kind === k.id ? ' on' : ''}" data-cmd="kind_${UI.esc(k.id)}" title="${i + 1}: ${UI.esc(k.full)} — click to place; Esc cancels">${art(k.id)}<span class="nm">${UI.esc(k.name)}</span></button>`).join('')
      + '</div><p class="hint">Keys 1–7 pick a part while Prefab [P] is active.</p></div>';
  } else {
    const text = L.searching ? `${UI.esc(L.search)}<span class="caret"></span>` : L.search ? UI.esc(L.search) : 'Search objects';
    h = head('objects') + `<div class="pbody lib-objects"><button type="button" class="b lib-search${L.searching ? ' typing' : ''}" data-cmd="object_search" title="Search by type, name or id; Esc cancels">${UI.icon('search')}<span>${text}</span></button><div class="lib-rows">`
      + (L.objects.length ? L.objects.map(o => `<div class="lib-row"><button type="button" class="b sel${o.selected ? ' on' : ''}" data-cmd="object_select_${UI.esc(o.id)}" title="${UI.esc(o.tip)}"><b>${UI.esc(o.title)}</b><small>${UI.esc(o.subtitle)}</small></button>`
        + UI.button({icon: o.hidden ? 'eyeoff' : 'eye', on: !o.hidden, color: '#ffd23f', title: (o.hidden ? 'Hidden: show ' : 'Visible: hide ') + o.tip, d: {cmd: 'object_eye_' + o.id}})
        + UI.button({icon: 'lock', on: !!o.locked, color: '#ff7b54', title: (o.locked ? 'Locked: unlock ' : 'Editable: lock ') + o.tip, d: {cmd: 'object_lock_' + o.id}}) + '</div>').join('')
        : '<p class="hint">No objects</p>') + '</div></div>';
  }
  // Re-rendering keeps the list's scroll position; a new selection is scrolled into view.
  const scroller = () => q('#rider-lib-pane .lib-rows') || q('#rider-lib-pane .pbody');
  const old = scroller(), top = old ? old.scrollTop : 0, oldTab = q('#rider-lib-pane').dataset.tab;
  q('#rider-lib-pane').innerHTML = h; q('#rider-lib-pane').dataset.tab = tab;
  unfocusable();
  const body = scroller();
  if (body && oldTab === tab) body.scrollTop = top;
  const sel = tab === 'objects' ? (L.objects.find(o => o.selected) || {}).id : null;
  const list = tab === 'objects' ? [L.search, L.searching, L.objects.length, oldTab].join('|') : '';
  if (sel && (sel !== lastSel || list !== lastList)) q(`#rider-lib-pane [data-cmd="object_select_${CSS.escape(sel)}"]`)?.scrollIntoView({block: 'nearest'});
  lastSel = sel; lastList = list;
}
// Commands since the last call, as JSON (Lua decodes them).
function take() { return JSON.stringify(queue.splice(0)); }
// Button centres in the engine's canvas space (x right, y up), so automation can tap them like Defold buttons.
function rects() {
  const out = {};
  if (!root || root.hidden) return JSON.stringify(out);
  const c = document.querySelector('canvas'); if (!c) return JSON.stringify(out);
  const r = c.getBoundingClientRect();
  for (const b of root.querySelectorAll('[data-cmd],[data-tab]')) {
    const q = b.getBoundingClientRect(); if (!q.width) continue;
    const clip = (b.closest('.lib-rows') || b.closest('.pbody') || b.closest('.chrome-dock .rail'))?.getBoundingClientRect();
    if (q.bottom <= 0 || q.top >= innerHeight || q.right <= 0 || q.left >= innerWidth) continue;
    if (clip && (q.top < clip.top - 1 || q.bottom > clip.bottom + 1)) continue;
    const name = b.dataset.cmd || 'lib_' + b.dataset.tab;
    const kx = c.width / r.width, ky = c.height / r.height;
    const x = q.x + q.width / 2 - r.x, y = q.y + q.height / 2 - r.y;
    // x/y: centre in canvas pixels, y up (like Defold screen positions); left/top/w/h: canvas pixels, y down.
    out[name] = {x: x * kx, y: (r.height - y) * ky, left: (q.x - r.x) * kx, top: (q.y - r.y) * ky, w: q.width * kx, h: q.height * ky, label: b.getAttribute('title') || ''};
  }
  return JSON.stringify(out);
}
window.riderChrome = {render, take, rects, get visible() { return !!(root && !root.hidden); }};
})();
