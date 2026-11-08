// #684: floating top tool bar, level chip and system buttons of the HTML editor chrome (#682), built from the
// UI kit (#683). UI only: clicks queue the same button names the Defold editor uses (on_button in
// main/editor/editor.gui_script), and Lua drains them with take(); Lua sends the state with render().
(() => {
'use strict';
if (window.riderChrome) return;
const UI = window.riderUI;
const queue = [];
let root = null, state = null, last = '', menuOpen = false;
const TOOLS = [['select','cursor','Select · move [S]'],['draw','pencil','Draw line [D]'],['curve','curve','Draw curve [C]'],['prefab','ramp','Prefab parts [P]'],['label','text','Label [L]'],['pan','hand','Pan']];
function mount() {
  UI.install();
  root = document.createElement('div');
  root.id = 'rider-chrome'; root.className = 'rider-ui';
  root.innerHTML = '<div class="float chrome-chip" id="rider-chrome-chip"></div><div class="float chrome-tools" id="rider-chrome-tools"></div><div class="float chrome-sys" id="rider-chrome-sys"></div>';
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
#rider-chrome .chrome-files{display:contents}#rider-chrome .chrome-more{display:none}
@media (max-width:1100px){#rider-chrome .chrome-more{display:inline-flex}#rider-chrome .chrome-files{display:none}
 #rider-chrome .chrome-files.open{display:flex;flex-direction:column;gap:6px;position:absolute;top:calc(100% + 8px);right:0;background:var(--panel);border:var(--ol) solid var(--ink);border-radius:14px;padding:6px;box-shadow:0 5px 0 var(--ink)}
 #rider-chrome .chrome-sys{gap:4px}}
`;
  document.head.append(style); document.body.append(root);
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
}
const q = sel => root.querySelector(sel);
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
}
// Commands since the last call, as JSON (Lua decodes them).
function take() { return JSON.stringify(queue.splice(0)); }
// Button centres in the engine's canvas space (x right, y up), so automation can tap them like Defold buttons.
function rects() {
  const out = {};
  if (!root || root.hidden) return JSON.stringify(out);
  const c = document.querySelector('canvas'); if (!c) return JSON.stringify(out);
  const r = c.getBoundingClientRect();
  for (const b of root.querySelectorAll('[data-cmd]')) {
    const q = b.getBoundingClientRect(); if (!q.width) continue;
    const kx = c.width / r.width, ky = c.height / r.height;
    const x = q.x + q.width / 2 - r.x, y = q.y + q.height / 2 - r.y;
    // x/y: centre in canvas pixels, y up (like Defold screen positions); left/top/w/h: canvas pixels, y down.
    out[b.dataset.cmd] = {x: x * kx, y: (r.height - y) * ky, left: (q.x - r.x) * kx, top: (q.y - r.y) * ky, w: q.width * kx, h: q.height * ky, label: b.getAttribute('title') || ''};
  }
  return JSON.stringify(out);
}
window.riderChrome = {render, take, rects, get visible() { return !!(root && !root.hidden); }};
})();
