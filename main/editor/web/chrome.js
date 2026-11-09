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
// #705 Decor tab: presets from Lua (palette(), sent once) and the chrome's own view state: world, category,
// search text and favourites (this browser only).
let decor = {worlds: [], categories: [], items: []}, world = 'meadow', cat = 'all', find = '';
const FAVS = 'rider.editor.decorFavourites';
let favs = new Set(), tookFocus = false, over = false;
// #706 Background and Texture tabs: presets from Lua (looks(), sent once); the stored or previewed source
// comes with each state (lib.look). Choices build the same draft/commit messages the old panels sent.
let looks = {bg: [], tex: []}, sliding = null;
const AUTO = [.9, .75, .55, .35, .15, -.1], OVERRIDES = [['surface', 'Surface'], ['band', 'Band'], ['fill', 'Fill']];

try { favs = new Set(JSON.parse(localStorage.getItem(FAVS) || '[]')); } catch (e) { favs = new Set(); }
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
// Rail: one tab per library page; tabs are view state of the chrome and publish as lib_<id>.
const RAIL = [['play','flag','var(--k-play)','Gameplay'],['track','ramp','var(--k-track)','Track parts'],['decor','tree','var(--k-decor)','Decor'],
  ['bg','mountain','var(--k-bg)','Background'],['tex','texture','var(--k-tex)','Ground texture'],['objects','list','var(--k-obj)','Level objects']];
// #717: Prefab parts and Decor live in the library (Track parts tiles, Decor tab), not here.
const TOOLS = [['select','cursor','Select · move [S]'],['draw','pencil','Draw line [D]'],['curve','curve','Draw curve [C]'],['label','text','Label [L]'],['pan','hand','Pan']];
function mount() {
  UI.install();
  root = document.createElement('div');
  root.id = 'rider-chrome'; root.className = 'rider-ui';
  root.innerHTML = '<div class="float chrome-chip" id="rider-chrome-chip"></div><div class="float chrome-tools" id="rider-chrome-tools"></div><div class="float chrome-sys" id="rider-chrome-sys"></div>'
    + '<aside class="dock chrome-dock" id="rider-chrome-dock" hidden><div class="rail" id="rider-lib-rail"></div><div class="pane" id="rider-lib-pane"></div></aside>'
    + '<aside class="dock chrome-insp" id="rider-chrome-insp" hidden></aside>'
    + '<div class="chrome-line" id="rider-chrome-line"><span class="msg"></span><span class="cur"></span></div>'
    + '<div class="float chrome-view" id="rider-chrome-view" hidden></div><div class="float chrome-map" id="rider-chrome-map" hidden><svg viewBox="0 0 640 128" preserveAspectRatio="none" role="img" aria-label="Minimap: press or drag to move the view"><g class="course"></g><rect class="win"></rect></svg></div>';
  const style = document.createElement('style'); style.id = 'rider-chrome-style';
  style.textContent = `#rider-chrome .float{position:fixed;z-index:400}
#rider-chrome .chrome-chip{left:12px;top:8px;padding:5px 12px 5px 6px;max-width:min(360px,30vw)}
#rider-chrome .chrome-chip .name{display:flex;flex-direction:column;line-height:1.1;min-width:0}
#rider-chrome .chrome-chip b{font:800 16px var(--disp);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#rider-chrome .chrome-chip small{font:800 11px var(--body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--go)}
#rider-chrome .chrome-chip small.warn{color:var(--accent)}#rider-chrome .chrome-chip small.error{color:var(--danger)}
#rider-chrome .chrome-tools{left:50%;top:8px;transform:translateX(-50%)}
#rider-chrome .chrome-tools .b{--c:var(--accent)}
/* #688: seven tools: slightly tighter spacing keeps the bar clear of the system buttons at 1280 px. */
#rider-chrome .chrome-tools{gap:4px;padding:5px}#rider-chrome .chrome-tools .sep{margin:6px 1px}
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
#rider-chrome .chrome-dock .rail .rail-sep{width:auto;height:2px;margin:2px 6px;align-self:stretch}
#rider-chrome .chrome-dock .rail .b{color:var(--c)}#rider-chrome .chrome-dock .rail .b.on{color:var(--ink)}#rider-chrome .chrome-dock .rail .b.plain{color:var(--text)}
#rider-chrome .lib-grid3{grid-template-columns:repeat(3,1fr)}
#rider-chrome .chrome-insp{position:fixed;right:12px;left:auto;top:72px;bottom:auto;max-height:calc(100vh - 160px);z-index:390;flex-direction:column;width:276px}
#rider-chrome .chrome-insp.closed{width:auto}
#rider-chrome .chrome-insp .ph .b{--h:32px}
#rider-chrome .insp-body{padding:10px;display:flex;flex-direction:column;gap:6px;overflow-y:auto;min-height:0;scrollbar-width:thin;scrollbar-color:var(--line) transparent}
#rider-chrome .insp-row{display:flex;gap:5px;align-items:center;min-width:0}
#rider-chrome .insp-t{font:800 12px var(--body);color:var(--muted);line-height:1.3;overflow-wrap:anywhere}
#rider-chrome .insp-t.s18{font:800 17px var(--disp);color:var(--text)}#rider-chrome .insp-t.s14{font-size:13px;color:var(--text)}
#rider-chrome .insp-t.error{color:var(--danger)}#rider-chrome .insp-t.selected{color:var(--k-decor)}#rider-chrome .insp-t.active{color:var(--accent)}
#rider-chrome .insp-row .b{--h:36px;font:800 12.5px var(--body);flex:1;justify-content:flex-start;padding:0 10px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#rider-chrome .insp-row .b.on{--c:var(--accent)}
#rider-chrome .insp-row .b.step{flex:none;width:36px;justify-content:center;padding:0;font-size:16px}
#rider-chrome .insp-row .b.field{background:var(--field);background-image:none;box-shadow:none;font-variant-numeric:tabular-nums}
#rider-chrome .insp-row .b.field.focus{border-color:var(--accent);box-shadow:0 0 0 2px #ffd23f55}
#rider-chrome .insp-row .b.field.bad{border-color:var(--danger)}
#rider-chrome .insp-row .unit{font:800 11px var(--body);color:var(--muted);flex:none}
#rider-chrome .insp-row .lbl{flex:1 1 auto;min-width:0;font:800 12px var(--body);color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#rider-chrome .insp-row .lbl~.b.field{flex:0 0 92px}
#rider-chrome .insp-row.foot{position:sticky;bottom:-10px;background:var(--panel);padding:6px 0 8px;margin-bottom:-10px;z-index:1}
#rider-chrome .insp-range{width:100%;accent-color:var(--k-tex);margin:-2px 0 4px}
#rider-chrome .insp-host>section{position:static!important;inset:auto!important;width:auto!important;max-height:none!important;overflow:visible!important;padding:0!important;margin:0!important;background:none!important;border:0!important;border-radius:0!important;box-shadow:none!important;font:700 13px/1.35 var(--body)!important;color:var(--text)!important;z-index:auto!important}
#rider-chrome .insp-host h2{display:none}
#rider-chrome .insp-host button{background:var(--btn)!important;color:var(--text)!important;border:var(--ol) solid var(--ink)!important;border-radius:10px!important;box-shadow:0 3px 0 var(--ink)!important;font:800 12px var(--body)!important;padding:6px 10px!important;margin:0 4px 6px 0;cursor:pointer;outline:none!important}
#rider-chrome .insp-host button[aria-pressed=true]{background:var(--c)!important;color:var(--ink)!important}
#rider-chrome .insp-host button:disabled{opacity:.45;cursor:default}
#rider-chrome .insp-host input[type=number],#rider-chrome .insp-host select{background:var(--field)!important;color:var(--text)!important;border:var(--ol) solid var(--ink)!important;border-radius:8px!important;height:30px;padding:0 6px;font:800 12.5px var(--body)}
#rider-chrome .insp-host input[type=range],#rider-chrome .insp-host input[type=checkbox]{accent-color:var(--c)}
#rider-chrome .insp-host input[type=checkbox]{width:16px;height:16px}
#rider-chrome .insp-host fieldset,#rider-chrome .insp-host details{border-color:var(--line)!important;border-radius:10px}
#rider-chrome .insp-host summary,#rider-chrome .insp-host legend{font:800 13px var(--disp);color:var(--text)}
#rider-chrome .insp-host output{font-variant-numeric:tabular-nums}
#rider-chrome .insp-host div[style*="sticky"]{position:static!important;background:none!important;padding:4px 0 0!important}
#rider-chrome .chrome-line{position:fixed;left:16px;right:330px;bottom:3px;display:flex;gap:16px;font:700 11.5px var(--body);color:var(--muted);white-space:nowrap;pointer-events:none;z-index:380}
#rider-chrome .chrome-line .msg{overflow:hidden;text-overflow:ellipsis;min-width:0;pointer-events:auto}#rider-chrome .chrome-line .cur{flex:none;font-variant-numeric:tabular-nums}
#rider-chrome .chrome-view{left:12px;bottom:22px;padding:3px 5px;gap:3px}
#rider-chrome .chrome-view .b{--h:32px;min-width:32px;padding:0 4px}#rider-chrome .chrome-view .sep{margin:0 1px}#rider-chrome .chrome-view .b.on{--c:var(--accent)}
#rider-chrome .chrome-view .zoomv{min-width:56px;font:800 12.5px var(--body);font-variant-numeric:tabular-nums;justify-content:center}
#rider-chrome .chrome-view .zoomv.edit{border-color:var(--accent)}#rider-chrome .chrome-view .zoomv.bad{border-color:var(--danger)}
#rider-chrome .chrome-view .b.dim{opacity:.5}
/* The minimap sits under the library, outside the workspace; the library leaves it room. */
#rider-chrome .chrome-map{left:12px;bottom:72px;padding:4px}
#rider-chrome.with-map .chrome-dock{max-height:calc(100vh - 258px)}
#rider-chrome .chrome-map svg{display:block;width:344px;height:72px;border-radius:10px;background:var(--field);cursor:crosshair;touch-action:none}
#rider-chrome .chrome-map svg *{pointer-events:none}
#rider-chrome .chrome-map .course polyline{fill:none;stroke:var(--k-track);stroke-width:3;stroke-linejoin:round;vector-effect:non-scaling-stroke}
#rider-chrome .chrome-map .win{fill:#ffd23f24;stroke:var(--accent);stroke-width:2.5;vector-effect:non-scaling-stroke}
@media (max-height:560px){#rider-chrome .chrome-map svg{height:44px}#rider-chrome.with-map .chrome-dock{max-height:calc(100vh - 230px)}}
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
#rider-chrome .lib-decor{overflow:hidden}
#rider-chrome .lib-look .tile.wide{aspect-ratio:2;--c:var(--k-bg)}#rider-chrome .lib-look .tile img{width:100%;height:100%;object-fit:cover;border-radius:9px;pointer-events:none}
#rider-chrome .lib-look .tile.wide .nm{background:#0d0f13b0;border-radius:6px;color:var(--text)}
#rider-chrome .lib-tex .tile{--c:var(--k-tex)}#rider-chrome .lib-tex .tile img{width:76%;height:62%;object-fit:cover;border-radius:6px;margin-bottom:10px;pointer-events:none}
#rider-chrome .lib-grid2{grid-template-columns:repeat(2,1fr)}
#rider-chrome .look-row{display:grid;grid-template-columns:62px 36px 1fr 34px 46px;gap:5px;align-items:center}
#rider-chrome .look-row .lbl{font:800 11.5px var(--body);color:var(--muted);white-space:nowrap}
#rider-chrome .look-row .b{--h:32px;padding:0;min-width:0;font:900 10.5px var(--body)}#rider-chrome .look-row .b.on{--c:var(--k-bg)}
#rider-chrome .look-row output{font:800 11px var(--body);color:var(--text);text-align:right;font-variant-numeric:tabular-nums}
#rider-chrome .lib-range{width:100%;min-width:0;accent-color:var(--k-bg)}
#rider-chrome .look-master{display:flex;gap:6px}#rider-chrome .look-master .b{--h:36px;flex:1;font:800 12.5px var(--body)}#rider-chrome .look-master .b.on{--c:var(--k-bg)}
#rider-chrome .ovr-row{display:grid;grid-template-columns:62px 1fr;gap:6px;align-items:center}#rider-chrome .ovr-row .lbl{font:800 12px var(--body);color:var(--muted)}
#rider-chrome .lib-select{height:34px}
#rider-chrome .look-note{min-height:1.2em;color:var(--accent)}
#rider-chrome .lib-cats{display:flex;gap:4px}#rider-chrome .lib-cats .b{--h:34px;flex:1;min-width:0;padding:0}
#rider-chrome .lib-cats .b.on{--c:var(--k-decor)}
#rider-chrome .lib-decor .chips .chip{display:inline-flex;align-items:center;gap:4px;--c:var(--k-decor)}#rider-chrome .lib-decor .chips svg{width:14px;height:14px}
#rider-chrome .dt{position:relative}#rider-chrome .dt .tile{width:100%;--c:var(--k-decor)}
#rider-chrome .dt .tile img{width:62%;height:62%;object-fit:contain;margin-bottom:10px;pointer-events:none}
#rider-chrome .dt .fav{position:absolute;left:3px;top:3px;width:22px;height:22px;display:grid;place-items:center;color:#ffffff50;background:none;border:0;padding:0;cursor:pointer}
#rider-chrome .dt .fav svg{width:14px;height:14px;fill:currentColor;stroke:none}#rider-chrome .dt .fav.on{color:var(--accent)}
`;
  // Inside #app-container: fullscreen shows only that element (index.html full_screen_container).
  document.head.append(style); (document.getElementById('app-container') || document.body).append(root);
  // Keyboard focus never leaves the canvas: editor shortcuts (Ctrl+Z, E, Delete …) are read there. The Defold
  // engine focuses the target of every mouse and wheel event (GLFW.isCanvasActive), so chrome elements ignore
  // focus() (see unfocusable) and only buttons are pointer targets.
  // A press anywhere on the chrome (a button, a label, the dock background) keeps the keyboard on the canvas;
  // only inputs and hosted panels take it.
  // #717: whether the pointer is over the chrome; Lua ignores the world zoom/scroll wheel there.
  addEventListener('pointermove', e => { over = root.contains(e.target) && e.target !== root; }, true);
  // Not a 'wheel' listener on window: Chromium then stops sending the legacy 'mousewheel' events the engine reads.
  // DOMMouseScroll is Firefox's legacy event, which the engine also reads.
  for (const type of ['mousewheel', 'DOMMouseScroll']) addEventListener(type, e => { over = root.contains(e.target) && e.target !== root; }, true);
  root.addEventListener('mousedown', e => { if (!e.target.closest('input,select,textarea,.insp-host')) e.preventDefault(); });
  // The Decor search is the one exception: a real click into it takes the keyboard while typing (Esc or Enter
  // hand it back). Its focus() is stubbed too, so the engine's mouseup/wheel focus calls never move the keyboard.
  // #706: the Background Depth sliders and Texture override lists (.kf) follow the same rule as the search.
  root.addEventListener('focusin', e => { if (e.target.matches('.kf') || e.target.closest('.insp-host')) tookFocus = true; else document.querySelector('canvas')?.focus(); });
  // A slider or list keeps its element while focused or dragged; the tab catches up when it lets go.
  // (Only a slider or list that is still in the page: a rebuild's own removal must not start another rebuild.)
  root.addEventListener('focusout', e => {
    if (!e.target.matches('.kf:not(.lib-find)') || !e.target.isConnected || sliding) return;
    // Only the dock that held the control catches up (rewriting the other could move a hosted panel mid-drag).
    const lib = !!e.target.closest('#rider-chrome-dock');
    setTimeout(() => { if (lib) { libKey = ''; library(state); } else { inspKey = ''; inspector(state); } });
  });
  root.addEventListener('input', e => { if (e.target.matches('.lib-range')) depth(e.target, false); else if (e.target.matches('.insp-range')) lookSlide(e.target); });
  root.addEventListener('change', e => {
    if (e.target.matches('.lib-range')) depth(e.target, true);
    else if (e.target.matches('.lib-select')) override(e.target);
    // A 3D look slider changed by keyboard (no pointer release) also ends its preview.
    else if (e.target.matches('.insp-range') && !sliding) lookDrop(e.target);
  });
  // A drag always ends with a commit, also when it returns to its start value (no change event); Lua
  // stores nothing for an unchanged value, so it adds no Undo step.
  root.addEventListener('pointerdown', e => { if (e.target.matches?.('.lib-range,.insp-range') && !e.target.disabled) sliding = e.target; }, true);
  const release = () => {
    const s = sliding; if (!s) return; sliding = null;
    if (s.matches('.insp-range')) { lookDrop(s); return; }
    depth(s, true); libKey = ''; setTimeout(() => library(state));
  };
  addEventListener('pointerup', release, true); addEventListener('pointercancel', release, true);
  root.addEventListener('input', e => { if (e.target.matches('.lib-find')) { find = e.target.value; decorGrid(); } });
  root.addEventListener('keydown', e => { if (e.target.matches('.kf:not(.lib-find)') && (e.key === 'Escape' || e.key === 'Enter')) { e.preventDefault(); document.querySelector('canvas')?.focus(); return; }
    if (e.target.matches('.lib-find') && (e.key === 'Escape' || e.key === 'Enter')) { e.preventDefault(); if (e.key === 'Escape') { find = e.target.value = ''; decorGrid(); } document.querySelector('canvas')?.focus(); } });
  const closeMenu = () => { if (menuOpen) { menuOpen = false; render(state); } };
  document.addEventListener('pointerdown', e => { if (!root.contains(e.target) || e.target.closest('.insp-host')) closeMenu(); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); }, true);
  // #687: minimap press and drag.
  // One primary pointer, captured; a cancel or release ends the drag.
  let mapDrag = null;
  root.addEventListener('pointerdown', e => {
    const svg = e.target.closest('#rider-chrome-map svg'); if (!svg || e.button !== 0 || !e.isPrimary) return;
    mapDrag = e.pointerId; e.preventDefault(); try { svg.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
    mapTo(e); document.querySelector('canvas')?.focus();
  });
  addEventListener('pointermove', e => { if (mapDrag !== null && e.pointerId === mapDrag && (e.buttons & 1)) mapTo(e); });
  const endMap = e => { if (e.pointerId === mapDrag) mapDrag = null; };
  addEventListener('pointerup', endMap); addEventListener('pointercancel', endMap);
  // Like the Defold editor buttons, a chrome button acts on press. preventDefault keeps keyboard focus on
  // the canvas (the editor treats canvas blur as focus loss).
  root.addEventListener('pointerdown', e => {
    const b = e.target.closest('button'); if (!b || b.closest('.insp-host')) return;
    e.preventDefault();
    if (e.button !== 0 || !e.isPrimary || b.disabled) return;
    if (b.dataset.act === 'chrome-menu') { menuOpen = !menuOpen; render(state); return; }
    if (b.dataset.act === 'minimap') { mapOn = !mapOn; try { localStorage.setItem('rider.editor.minimap', mapOn ? 'on' : 'off'); } catch (err) { /* per session */ } viewKey = ''; viewBar(state); return; }
    if (b.dataset.tab) {
      document.querySelector('canvas')?.focus(); tab = b.dataset.tab; libKey = ''; if (state?.lib?.collapsed) queue.push('collapse_tools');
      // #717: the Decor tab is the Decor tool (it replaced the tool bar's Decor button).
      // 'decor_tool' only switches the tool on (never off), so a second press keeps Decor.
      if (tab === 'decor') queue.push('decor_tool');
      library(state); return;
    }
    if (b.dataset.dcat || b.dataset.dworld) { if (b.dataset.dcat) cat = b.dataset.dcat; else world = b.dataset.dworld; libKey = ''; library(state); return; }
    if (b.dataset.look) { look(b.dataset); document.querySelector('canvas')?.focus(); return; }
    if (b.dataset.fav) { const id = b.dataset.fav; if (favs.has(id)) favs.delete(id); else favs.add(id); try { localStorage.setItem(FAVS, JSON.stringify([...favs])); } catch (e) { /* favourites stay for this session */ } decorGrid(); return; }
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
// Hosted panels (.insp-host) keep their own focus behaviour: their fields and sliders take the keyboard.
function unfocusable() { root.focus = noop; for (const e of root.querySelectorAll('*')) if (!e.closest('.insp-host,#rider-chrome-park')) e.focus = noop; }
function setOn(b, on) { b.classList.toggle('on', on); if (on) b.setAttribute('aria-pressed', 'true'); else b.removeAttribute('aria-pressed'); }
function rail3d(s) {
  const b = root && q('#rider-lib-rail [data-cmd="terrain_look"]'); if (!b || !s) return;
  setOn(b, !!s.look_open); const t = b.querySelector('.tag'); if (t) { t.textContent = s.look_dirty ? '•' : ''; t.hidden = !s.look_dirty; }
}
function update(s) {
  rail3d(s);
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
  inspector(s);
  viewBar(s);
}

function library(s) {
  const dock = q('#rider-chrome-dock'), L = s && s.lib;
  dock.hidden = !L;
  if (!L) return;
  // Lua encodes an empty table as {}: normalise the lists.
  if (!Array.isArray(L.objects)) L.objects = [];
  if (!Array.isArray(L.kinds)) L.kinds = [];
  // Follow the active tool: a prefab kind shows Track parts, a gameplay tool shows Gameplay, a search Objects.
  if (s.tool !== lastTool) { if (s.tool === 'prefab') tab = 'track'; else if (GAME_TOOLS.has(s.tool)) tab = 'play'; else if (s.tool === 'decoration') tab = 'decor'; lastTool = s.tool; }
  if (L.searching) tab = 'objects';
  // A focused slider or list, or a slider drag, keeps its element: the tab catches up afterwards.
  if ((tab === 'bg' || tab === 'tex') && (sliding || document.activeElement?.matches?.('#rider-lib-pane .kf:not(.lib-find)'))) return;
  // The Decor tab is rebuilt only for its own data, so a level edit does not reset the search box while typing.
  const key = tab === 'decor' ? JSON.stringify(['decor', L.collapsed, L.decor, s.tool === 'decoration', world, cat, decor.items.length])
    : tab === 'bg' || tab === 'tex' ? JSON.stringify([tab, L.collapsed, L.look, looks.bg.length, looks.tex.length]) : JSON.stringify([L, s.tool, tab]);
  if (key === libKey) return;
  libKey = key;
  dock.classList.toggle('closed', !!L.collapsed);
  q('#rider-lib-rail').innerHTML = UI.button({icon: L.collapsed ? 'chevr' : 'chevl', title: L.collapsed ? 'Open the library' : 'Collapse the library', variant: 'plain', d: {cmd: 'collapse_tools'}})
    + RAIL.map(([id, icon, color, title, cmd]) => cmd ? UI.button({icon, color, title, d: {cmd}}) : UI.button({icon, color, title, on: !L.collapsed && tab === id, d: {tab: id}})).join('')
    // #717: the 3D look (a dot while a change is unfinished; on while it is open in the dock).
    + '<span class="sep rail-sep"></span>' + UI.button({icon: 'cube', color: 'var(--k-tex)', title: '3D look: level or selected terrain sections. Each finished change is one Undo step.', tag: '', d: {cmd: 'terrain_look'}});
  rail3d(s);
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
  } else if (tab === 'bg') {
    const b = L.look && L.look.bg || null;
    h = head('bg') + '<div class="pbody lib-look"><div class="look-master">'
      + UI.button({icon: b && b.enabled ? 'eye' : 'eyeoff', label: b && b.enabled ? 'Background ON' : 'Background OFF', on: !!(b && b.enabled), disabled: !b, title: 'Background ON/OFF', d: {look: 'enabled'}})
      + '</div><div class="grid lib-grid2">' + looks.bg.map(p => `<button type="button" class="tile wide named${b && b.preset === p.id ? ' on' : ''}" data-look="preset" data-id="${UI.esc(p.id)}" data-preset-bg="${UI.esc(p.id)}" title="Background: ${UI.esc(p.name)}"><img src="${UI.esc(p.thumb)}" alt=""><span class="nm">${UI.esc(p.name)}</span></button>`).join('')
      + '</div>' + AUTO.map((auto, i) => {
        const layer = b && b.layers && b.layers[i] || null, title = i === 5 ? 'Foreground' : `Layer ${i + 1}`;
        const value = layer ? (layer.auto ? auto : layer.depth ?? auto) : auto;
        return `<div class="look-row" data-bg-layer="${i + 1}"><span class="lbl">${title}</span>`
          + UI.button({icon: layer && layer.visible ? 'eye' : 'eyeoff', on: !!(layer && layer.visible), disabled: !b, title: `${title} ON/OFF`, d: {look: 'visible', layer: i}})
          + `<input type="range" class="lib-range kf" min="-0.25" max="1" step=".01" value="${value}" data-layer="${i}" aria-label="${title} Depth" title="Higher Depth moves more slowly. Turn Auto off to use your manual value."${!b || !layer || layer.auto ? ' disabled' : ''}>`
          + `<output>${Number(value).toFixed(2)}</output>`
          + UI.button({label: 'Auto', on: !!(layer && layer.auto), disabled: !b, title: `${title} Auto`, d: {look: 'auto', layer: i}}) + '</div>';
      }).join('')
      + UI.button({icon: 'layers', label: 'Layer images and height', disabled: !b, title: 'Layer images and height', d: {cmd: 'bg_layers'}}).replace('class="b', 'class="b look-more')
      + `<p class="hint look-note">${UI.esc(L.look && L.look.bg_msg || (!b ? 'Choose a background.' : ''))}</p></div>`;
  } else if (tab === 'tex') {
    const m = L.look && L.look.tex || null;
    h = head('tex') + '<div class="pbody lib-look lib-tex"><div class="grid lib-grid3">' + looks.tex.map(p => `<button type="button" class="tile named${m && m.preset === p.id ? ' on' : ''}" data-look="material" data-id="${UI.esc(p.id)}" data-preset-tex="${UI.esc(p.id)}" title="Ground: ${UI.esc(p.name)}"><img src="${UI.esc(p.thumb)}" alt=""><span class="nm">${UI.esc(p.name)}</span></button>`).join('')
      + '</div>' + OVERRIDES.map(([k, label]) => `<label class="ovr-row"><span class="lbl">${label}</span><select class="field lib-select kf" data-key="${k}" aria-label="${label} override"${m ? '' : ' disabled'}>`
        + `<option value="">Inherit</option>` + looks.tex.map(p => `<option value="${UI.esc(p.id)}"${m && m[k] === p.id ? ' selected' : ''}>${UI.esc(p.name)}</option>`).join('') + '</select></label>').join('')
      + `<p class="hint look-note">${UI.esc(L.look && L.look.tex_msg || (!m ? 'Choose a ground texture; Surface, Band and Fill can then differ.' : ''))}</p></div>`;
  } else if (tab === 'decor') {
    const cats = [['all', 'grid', 'All decor'], ['fav', 'star', 'Favourites'], ...decor.categories.map(c => [c.id, c.icon, c.name])];
    h = head('decor') + '<div class="pbody lib-decor"><div class="chips">' + decor.worlds.map(w =>
      `<button type="button" class="chip${w.id === world ? ' on' : ''}" data-dworld="${UI.esc(w.id)}" title="World: ${UI.esc(w.name)}">${UI.icon('mountain')}${UI.esc(w.name)}</button>`).join('')
      + `</div><label class="search" title="Search decor by name; Esc clears">${UI.icon('search')}<input class="lib-find kf" type="search" placeholder="Search decor" value="${UI.esc(find)}" spellcheck="false" autocomplete="off" aria-label="Search decor"></label>`
      + '<div class="lib-cats">' + cats.map(([id, icon, title]) => UI.button({icon, title, on: cat === id, d: {dcat: id}})).join('') + '</div>'
      + '<div class="lib-rows"><div class="grid lib-grid3" id="rider-decor-grid"></div></div></div>';
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
  const old = scroller(), top = old ? old.scrollTop : 0, oldTab = q('#rider-lib-pane').dataset.pane;
  const typing = document.activeElement?.matches?.('.lib-find') ? document.activeElement.selectionStart : null;
  q('#rider-lib-pane').innerHTML = h; q('#rider-lib-pane').dataset.pane = tab;
  if (tab === 'decor') decorGrid();
  // A rebuild while typing (category or world chip) keeps the keyboard in the new search box.
  const input = q('#rider-lib-pane .lib-find');
  if (typing !== null) { if (input) { HTMLElement.prototype.focus.call(input); input.setSelectionRange(typing, typing); } else document.querySelector('canvas')?.focus(); }
  unfocusable();
  const body = scroller();
  if (body && oldTab === tab) body.scrollTop = top;
  const sel = tab === 'objects' ? (L.objects.find(o => o.selected) || {}).id : null;
  const list = tab === 'objects' ? [L.search, L.searching, L.objects.length, oldTab].join('|') : '';
  if (sel && (sel !== lastSel || list !== lastList)) q(`#rider-lib-pane [data-cmd="object_select_${CSS.escape(sel)}"]`)?.scrollIntoView({block: 'nearest'});
  lastSel = sel; lastList = list;
}

// Decor tiles: the armed preset is on while the Decor tool is active; a tile arms it (and opens the tool).
function decorGrid() {
  const grid = q('#rider-decor-grid'); if (!grid) return;
  const words = find.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const armed = state?.tool === 'decoration' && state?.lib?.decor || {};
  const shown = decor.items.filter(a => a.world === world && (cat === 'all' || (cat === 'fav' ? favs.has(a.id) : a.category === cat))
    && words.every(w => (a.name + ' ' + a.id + ' ' + a.category).toLowerCase().includes(w)));
  grid.innerHTML = shown.length ? shown.map(a => {
    const on = a.fence ? armed.fence === a.id : !armed.fence && armed.asset === a.id;
    return `<div class="dt"><button type="button" class="tile named${on ? ' on' : ''}" data-cmd="decor_asset_${UI.esc(a.id)}" title="${UI.esc(a.name)}${a.fence ? ': click where it starts, then where it ends' : ': click the track to place'}"><img src="${UI.esc(a.thumb)}" alt=""><span class="nm">${UI.esc(a.name)}</span></button>`
      + `<button type="button" class="fav${favs.has(a.id) ? ' on' : ''}" data-fav="${UI.esc(a.id)}" title="${favs.has(a.id) ? 'Remove from' : 'Add to'} favourites" aria-pressed="${favs.has(a.id)}">${UI.icon('star')}</button></div>`;
  }).join('') : `<p class="hint">${cat === 'fav' && !words.length ? 'No favourites yet: tap a star.' : 'No decor found'}</p>`;
  unfocusable();
}
// #706: Background and Texture choices are sent as operations; Lua applies them to the stored (or previewed)
// source, so a choice never starts from an older copy. Each is one commit (one Undo step); a Depth drag
// previews (draft) until release.
function queueLook(kind, value) {
  const text = kind + ':' + JSON.stringify(value), last = queue[queue.length - 1];
  if (value.op === 'depth' && !value.commit && last && last.startsWith('bg_op:') && JSON.parse(last.slice(6)).op === 'depth' && !JSON.parse(last.slice(6)).commit) queue[queue.length - 1] = text;
  else queue.push(text);
}
function look(d) {
  if (d.look === 'material') queueLook('tex_op', {preset: d.id});
  else queueLook('bg_op', d.layer != null ? {op: d.look, layer: +d.layer + 1} : {op: d.look, id: d.id});
}
function depth(input, commit) {
  const out = input.parentNode.querySelector('output'); if (out) out.textContent = Number(input.value).toFixed(2);
  queueLook('bg_op', {op: 'depth', layer: +input.dataset.layer + 1, value: Number(input.value), commit});
}
// #686: a 3D look slider in the inspector previews while dragged (one coalesced message per frame); release commits.
function lookSlide(input) {
  const text = 'look_drag:' + JSON.stringify({key: input.dataset.key, value: Number(input.value)}), last = queue[queue.length - 1];
  if (last && last.startsWith('look_drag:')) queue[queue.length - 1] = text; else queue.push(text);
  // The value field above follows the drag (the dock is not rebuilt meanwhile).
  const field = q(`#rider-chrome-insp [data-cmd="look_value_${CSS.escape(input.dataset.key)}"]`); if (field) field.textContent = String(+Number(input.value).toPrecision(4));
}
// The release stores the look (one Undo step); the keyboard returns to the canvas and the dock catches up.
function lookDrop(input) {
  queue.push('look_drop:' + JSON.stringify({key: input.dataset.key}));
  document.querySelector('canvas')?.focus();
  inspKey = ''; setTimeout(() => inspector(state));
}
function override(select) { queueLook('tex_op', {key: select.dataset.key, value: select.value}); }
function setLooks(p) {
  looks = {bg: Array.isArray(p?.bg) ? p.bg : [], tex: Array.isArray(p?.tex) ? p.tex : []};
  libKey = ''; if (state) library(state);
}
function setPalette(p) {
  decor = {worlds: Array.isArray(p?.worlds) ? p.worlds : [], categories: Array.isArray(p?.categories) ? p.categories : [], items: Array.isArray(p?.items) ? p.items : []};
  if (decor.worlds.length && !decor.worlds.some(w => w.id === world)) world = decor.worlds[0].id;
  libKey = ''; if (state) library(state);
}

let inspKey = '', lastFocus = null, inspHead = '';
// #687: floating view controls and the minimap (course profile from Lua, sent per revision).
let course = null, mapOn = true, viewKey = '', viewWin = null;
const mapLog = [];
try { mapOn = localStorage.getItem('rider.editor.minimap') !== 'off'; } catch (e) { mapOn = true; }
const VIEWS = [['view_fit', 'fit', 'Fit level [Home]'], ['view_centre', 'arrows', 'Centre selection [.]'], ['view_start', 'flag', 'Go to START'],
  ['view_test', 'checkpoint', 'Go to last test start'], ['view_bounds', 'size', 'Show level bounds'], ['view_ghost', 'car', 'Ghost: preview test start (off by default)']];
function viewBar(s) {
  const bar = q('#rider-chrome-view'), V = s && s.view;
  // The minimap lives under the library: with the library collapsed it would cover the workspace, so it hides.
  // #717: the toggle alone decides; a collapsed library leaves the minimap in place.
  bar.hidden = !V; q('#rider-chrome-map').hidden = !V || !mapOn || !course;
  root.classList.toggle('with-map', !q('#rider-chrome-map').hidden);
  if (!V) return;
  const key = JSON.stringify([V.grid, V.grid_on, V.zoom, V.on, V.reasons, mapOn]);
  if (key !== viewKey) {
    viewKey = key;
    const z = V.zoom || {};
    bar.innerHTML = VIEWS.map(([cmd, icon, title]) => UI.button({icon, title: V.reasons[cmd] || title, on: !!V.on[cmd], d: {cmd}}).replace('class="b', V.reasons[cmd] ? 'aria-disabled="true" class="b dim' : 'class="b')).join('')
      + '<span class="sep"></span>' + UI.button({icon: 'grid', title: `Grid ${V.grid} [G]: snap on/off`, on: !!V.grid_on, d: {cmd: 'grid_toggle'}})
      + '<span class="sep"></span>' + UI.button({label: '−', title: 'Zoom out to the previous step (minimum 1%).', d: {cmd: 'zoom_out'}})
      + `<button type="button" class="b zoomv${z.edit ? ' edit' : ''}${z.error ? ' bad' : ''}" data-cmd="zoom_value" title="${UI.esc(z.error || 'Zoom 1-400%: type a value; Enter applies, Esc cancels.')}">${UI.esc(z.edit ? z.text + '_' : z.text + '%')}</button>`
      + UI.button({label: '+', title: 'Zoom in to the next step (maximum 400%).', d: {cmd: 'zoom_in'}})
      + '<span class="sep"></span>' + UI.button({icon: 'map', title: mapOn ? 'Hide the minimap' : 'Show the minimap', on: mapOn, act: 'minimap'});
    unfocusable();
  }
  drawMap(viewWin);
}
// #688: the bottom status line (message or readout, cursor position), sent by Lua when it changes.
function statusLine(l) {
  if (!root) return;
  const line = q('#rider-chrome-line');
  line.querySelector('.msg').textContent = (l && l.text) || ''; line.querySelector('.msg').title = (l && l.text) || '';
  line.querySelector('.cur').textContent = (l && l.cursor) || '';
}
function viewRect(r) { viewWin = r || null; if (state) drawMap(viewWin); }
// The course profile, START/FINISH and the view window; x and y scale separately (a long course stays readable).
const MAP_W = 640, MAP_H = 128, MAP_PAD = 8;
let mapScale = null, mapCourse = null;
function drawMap(rect) {
  const wrap = q('#rider-chrome-map'); if (wrap.hidden || !course) return;
  const b = course.box || [0, 1, 0, 1], bw = Math.max(1, b[1] - b[0]), bh = Math.max(1, b[3] - b[2]);
  const sx = (MAP_W - 2 * MAP_PAD) / bw, sy = (MAP_H - 2 * MAP_PAD) / bh;
  mapScale = {x: v => MAP_PAD + (v - b[0]) * sx, y: v => MAP_H - MAP_PAD - (v - b[2]) * sy, wx: px => b[0] + (px - MAP_PAD) / sx, wy: py => b[2] + (MAP_H - MAP_PAD - py) / sy};
  if (mapCourse !== course) {
    mapCourse = course;
    const f = n => n.toFixed(1), dot = (p, col) => p ? `<circle cx="${f(mapScale.x(p[0]))}" cy="${f(mapScale.y(p[1]))}" r="5" fill="${col}"/>` : '';
    wrap.querySelector('.course').innerHTML = course.lines.map(l => {
      let pts = ''; for (let i = 0; i < l.length; i += 2) pts += f(mapScale.x(l[i])) + ',' + f(mapScale.y(l[i + 1])) + ' ';
      return `<polyline points="${pts}"/>`;
    }).join('') + dot(course.start, '#ff7b54') + dot(course.finish, '#ffffff');
  }
  const win = wrap.querySelector('.win');
  if (!rect) { win.setAttribute('width', 0); return; }
  const x0 = Math.max(0, mapScale.x(rect.x0)), x1 = Math.min(MAP_W, mapScale.x(rect.x1)), y0 = Math.max(0, mapScale.y(rect.y1)), y1 = Math.min(MAP_H, mapScale.y(rect.y0));
  win.setAttribute('x', x0.toFixed(1)); win.setAttribute('y', y0.toFixed(1));
  win.setAttribute('width', Math.max(0, x1 - x0).toFixed(1)); win.setAttribute('height', Math.max(0, y1 - y0).toFixed(1));
}
function setMinimap(data) {
  course = data && Array.isArray(data.box) ? {box: data.box, lines: Array.isArray(data.lines) ? data.lines : [], start: data.start || null, finish: data.finish || null} : null;
  viewKey = ''; if (state) viewBar(state);
}
// A press or drag on the minimap centres the view there (one coalesced message per frame).
function mapTo(e) {
  const r = q('#rider-chrome-map svg').getBoundingClientRect(); if (!mapScale || !r.width) return;
  const px = (e.clientX - r.left) * MAP_W / r.width, py = (e.clientY - r.top) * MAP_H / r.height;
  const text = 'view_to:' + JSON.stringify({x: Math.round(mapScale.wx(px) * 100) / 100, y: Math.round(mapScale.wy(py) * 100) / 100}), last = queue[queue.length - 1];
  // Debug trace for automation: the last minimap inputs (bounded).
  mapLog.push({type: e.type, id: e.pointerId, b: e.buttons, cx: Math.round(e.clientX), left: Math.round(r.left), w: Math.round(r.width), px: Math.round(px), wx: Math.round(mapScale.wx(px) * 10) / 10}); if (mapLog.length > 24) mapLog.shift();
  if (last && last.startsWith('view_to:')) queue[queue.length - 1] = text; else queue.push(text);
}
// #686: DOM panels hosted in the inspector dock (their controls, Undo and storage stay as they are).
const HOSTS = {decor: ['#rider-decoration-panel', 'Decor', 'tree', 'var(--k-decor)'], layers: ['#rider-background-panel', 'Background layers', 'layers', 'var(--k-bg)']};
// Before the dock is rewritten, hosted panels move to a hidden holder so they are never destroyed.
function park() {
  let holder = q('#rider-chrome-park');
  if (!holder) { holder = document.createElement('div'); holder.id = 'rider-chrome-park'; holder.hidden = true; root.append(holder); }
  for (const [sel] of Object.values(HOSTS)) { const p = document.querySelector('#rider-chrome-insp ' + sel); if (p) holder.append(p); }
}
function inspector(s) {
  const dock = q('#rider-chrome-insp'), I = s && s.insp;
  dock.hidden = !I;
  if (!I) return;
  const items = Array.isArray(I.items) ? I.items : [];
  // A 3D look slider keeps its element while dragged or focused; the dock catches up afterwards.
  if (sliding?.matches?.('.insp-range')) return;
  const host = HOSTS[I.host] && document.querySelector(HOSTS[I.host][0]);
  const key = JSON.stringify([I.collapsed, I.title, I.host ? I.host + !!host : I.items]);
  if (key === inspKey) return;
  inspKey = key;
  park();
  dock.classList.toggle('closed', !!I.collapsed);
  if (I.collapsed) {
    dock.innerHTML = '<div class="rail">' + UI.button({icon: 'chevl', title: 'Open Properties', variant: 'plain', d: {cmd: 'collapse_properties'}}) + '</div>';
    unfocusable(); return;
  }
  if (host) {
    const [, title, icon, color] = HOSTS[I.host];
    dock.innerHTML = `<div class="ph" style="--c:${color}"><span class="ic">${UI.icon(icon)}</span><h3>${UI.esc(title)}</h3>`
      + UI.button({icon: 'chevr', title: 'Collapse Properties', d: {cmd: 'collapse_properties'}}) + `</div><div class="insp-body insp-host" style="--c:${color}"></div>`;
    q('#rider-chrome-insp .insp-host').append(host);
    unfocusable(); return;
  }
  const aliases = {};
  for (const it of items) if (it.k === 'alias') aliases[it.target] = it.name;
  // Rows: items recorded at the same y form one line (field + steppers); a short muted text just below a
  // field is its unit and joins that line.
  const rows = [], byY = new Map();
  for (const it of items) {
    if (it.k === 'alias') continue;
    let row = [...byY.values()].find(r => Math.abs(r.y - it.y) < 1);
    if (!row && it.k === 't' && it.size === 12 && it.role === 'muted' && it.t.length <= 5)
      row = [...byY.values()].find(r => r.field && it.y > r.y && it.y - r.y <= 20);
    if (!row) { row = {y: it.y, items: [], field: false}; byY.set(it.y + ':' + byY.size, row); rows.push(row); }
    if (it.k === 'b' && it.field) row.field = true;
    row.items.push(it);
  }
  // Inside a row: field, unit, then the steppers.
  // A longer text on a field's line is its label (3D look) and leads; a short one is the unit after it.
  const order = it => it.k === 'b' && /^(dec|inc)_/.test(it.name) ? 2 : it.k === 't' ? (it.t.length > 5 ? -1 : 1) : 0;
  for (const r of rows) if (r.field) r.items.sort((a, b) => order(a) - order(b));
  const btn = it => {
    const step = /^(dec|inc)_/.test(it.name);
    const cls = ['b', step && 'step', it.field && 'field', it.focused && 'focus', it.active && 'on', it.danger && 'del'].filter(Boolean).join(' ');
    const label = step ? (it.name.startsWith('dec_') ? '−' : '+') : (it.label || (it.field ? '' : it.name));
    const alias = aliases[it.name] ? ` data-alias="${UI.esc(aliases[it.name])}"` : '';
    return `<button type="button" class="${cls}" data-cmd="${UI.esc(it.name)}"${alias} title="${UI.esc(it.tip || label)}"${it.disabled ? ' disabled' : ''}>${UI.esc(label)}</button>`;
  };
  const slider = it => `<input type="range" class="insp-range kf" min="${it.min}" max="${it.max}" step="${it.step || 'any'}" value="${it.value}" data-key="${UI.esc(it.name.replace(/^look_slider_/, ''))}" aria-label="${UI.esc(it.label || it.name)}" title="${UI.esc(it.label || '')}: drag to preview; release stores one Undo step"${it.disabled ? ' disabled' : ''}>`;
  // The 3D look's Reset/Close line stays at the bottom of the dock while the controls scroll.
  const body = rows.map(r => '<div class="insp-row' + (r.items.some(it => it.name === 'look_close') ? ' foot' : '') + '">' + r.items.map(it => it.k === 's' ? slider(it) : it.k === 't'
    ? (r.items.length > 1 && r.items.some(x => x.k === 'b') ? (it.t.length > 5 ? `<span class="lbl" title="${UI.esc(it.t)}">${UI.esc(it.t)}</span>` : `<span class="unit">${UI.esc(it.t)}</span>`) : `<div class="insp-t s${it.size} ${it.role}">${UI.esc(it.t)}</div>`)
    : btn(it)).join('') + '</div>').join('');
  const old = q('#rider-chrome-insp .insp-body'), top = old ? old.scrollTop : 0;
  dock.innerHTML = '<div class="ph" style="--c:' + (I.title ? 'var(--k-tex)' : 'var(--accent)') + '"><span class="ic">' + UI.icon(I.title ? 'cube' : 'cursor') + '</span><h3>' + UI.esc(I.title || 'Properties') + '</h3>'
    + UI.button({icon: 'chevr', title: 'Collapse Properties', d: {cmd: 'collapse_properties'}}) + `</div><div class="insp-body">${body}</div>`;
  // A new selection or tool starts at the top, like the Defold panel; otherwise keep the scroll position.
  const head = (items.find(it => it.k === 't') || {}).t || '';
  const nb = q('#rider-chrome-insp .insp-body'); if (nb) nb.scrollTop = head === inspHead ? top : 0;
  inspHead = head;
  const focus = (items.find(it => it.focused) || {}).name || null;
  if (focus && focus !== lastFocus) q(`#rider-chrome-insp [data-cmd="${CSS.escape(focus)}"]`)?.scrollIntoView({block: 'nearest'});
  lastFocus = focus;
  unfocusable();
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
    const clip = (b.closest('.lib-rows') || b.closest('.pbody') || b.closest('.insp-body') || b.closest('.chrome-dock .rail'))?.getBoundingClientRect();
    if (q.bottom <= 0 || q.top >= innerHeight || q.right <= 0 || q.left >= innerWidth) continue;
    if (clip && (q.top < clip.top - 1 || q.bottom > clip.bottom + 1)) continue;
    const name = b.dataset.cmd || 'lib_' + b.dataset.tab;
    const kx = c.width / r.width, ky = c.height / r.height;
    const x = q.x + q.width / 2 - r.x, y = q.y + q.height / 2 - r.y;
    // x/y: centre in canvas pixels, y up (like Defold screen positions); left/top/w/h: canvas pixels, y down.
    const rect = {x: x * kx, y: (r.height - y) * ky, left: (q.x - r.x) * kx, top: (q.y - r.y) * ky, w: q.width * kx, h: q.height * ky, label: b.getAttribute('title') || ''};
    out[name] = rect;
    if (b.dataset.alias) out[b.dataset.alias] = rect;
  }
  return JSON.stringify(out);
}
window.riderChrome = {render, take, rects, palette: setPalette, looks: setLooks, minimap: setMinimap, viewRect, statusLine, over() { return over && !!root && !root.hidden; }, get mapLog() { return mapLog.slice(); }, tookFocus() { const t = tookFocus; tookFocus = false; return t; }, get visible() { return !!(root && !root.hidden); }};
})();
