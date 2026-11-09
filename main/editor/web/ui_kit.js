// #683: shared editor UI kit (tokens, icons, components) for the HTML editor chrome (#682).
// Everything is scoped under .rider-ui so the kit never restyles the game page. UI only: it sends no
// commands itself; callers own state and Lua stays the owner of the level document (level-editor contract).
(() => {
'use strict';
if (window.riderUI) return;
const CSS = `.rider-ui{
  --ink:#0d0f13; --panel:#22252c; --panel2:#2c3039; --btn:#393e4a; --field:#181a20; --line:#4a505e;
  --text:#f6f3ee; --muted:#a4a9b6; --accent:#ffd23f; --go:#4fe08a; --danger:#ff4f7b; --info:#4cc9ff;
  --k-play:#ff7b54; --k-track:#4cc9ff; --k-decor:#6fd36b; --k-bg:#b48cff; --k-tex:#ffb03f; --k-obj:#ff6fae;
  --disp:"Baloo 2",system-ui,sans-serif; --body:"Nunito",system-ui,sans-serif;
  --r:12px; --ol:2px; --h:44px; --gap:6px; --dock-w:300px; --tile-cols:4;
  color-scheme:dark;
}
.rider-ui,.rider-ui *{box-sizing:border-box}
.rider-ui [hidden]{display:none!important}
.rider-ui button{font:inherit;color:inherit;cursor:pointer;padding:0}
.rider-ui button:focus-visible,.rider-ui .tile:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.rider-ui svg.i{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;flex:none;pointer-events:none}
.rider-ui .b{height:var(--h);min-width:var(--h);display:inline-flex;align-items:center;justify-content:center;gap:6px;border-radius:var(--r);background:var(--btn);background-image:linear-gradient(#ffffff1c,#ffffff00 55%);border:var(--ol) solid var(--ink);box-shadow:0 3px 0 var(--ink);color:var(--c,var(--text));position:relative;transition:transform .06s,box-shadow .06s}
.rider-ui .b:active{transform:translateY(2px);box-shadow:0 1px 0 var(--ink)}
.rider-ui .b.on{background-color:var(--c,var(--accent));color:var(--ink);transform:translateY(2px);box-shadow:0 1px 0 var(--ink)}
.rider-ui .b.plain{color:var(--text)}
.rider-ui .b.wide{padding:0 12px;font:800 14px var(--disp)}
.rider-ui .b .tag{position:absolute;right:-6px;top:-7px;font:900 10px/1 var(--body);background:var(--accent);color:var(--ink);border:2px solid var(--ink);border-radius:999px;padding:2px 5px}
.rider-ui .b[disabled]{opacity:.45;cursor:default;transform:none;box-shadow:0 3px 0 var(--ink)}
.rider-ui .float{position:absolute;display:flex;gap:var(--gap);align-items:center;background:var(--panel);border:var(--ol) solid var(--ink);border-radius:18px;padding:6px;box-shadow:0 5px 0 var(--ink),0 10px 24px #0005;z-index:5}
.rider-ui .sep{width:2px;align-self:stretch;margin:6px 2px;background:var(--line);border-radius:2px}
.rider-ui .cnt{display:flex;align-items:center;gap:4px;height:30px;padding:0 9px 0 5px;border-radius:10px;background:var(--field);font:900 13px var(--body);font-variant-numeric:tabular-nums}
.rider-ui .cnt svg{width:18px;height:18px}
.rider-ui .cnt span{color:var(--text)}
.rider-ui .play{height:50px;width:64px;border-radius:15px;display:grid;place-items:center;color:var(--ink);background:var(--go);border:var(--ol) solid var(--ink);box-shadow:0 4px 0 var(--ink),inset 0 -4px 0 #0003,inset 0 3px 0 #fff8}
.rider-ui .play:active{transform:translateY(2px);box-shadow:0 2px 0 var(--ink),inset 0 -4px 0 #0003}
.rider-ui .play svg{fill:currentColor;stroke:none;width:26px;height:26px}
.rider-ui .ui-toast{display:flex;align-items:center;gap:8px;background:var(--panel);border:var(--ol) solid var(--ink);border-radius:999px;padding:5px 14px 5px 5px;font:800 13px var(--body);box-shadow:0 3px 0 var(--ink);white-space:nowrap;z-index:6;max-width:calc(100% - 24px);overflow:hidden;text-overflow:ellipsis}
.rider-ui .ui-toast .ic{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:var(--tc,var(--info));color:var(--ink);border:2px solid var(--ink);flex:none}
.rider-ui .ui-toast .ic svg{width:15px;height:15px}
.rider-ui .dock{position:absolute;top:126px;display:flex;background:var(--panel);border:var(--ol) solid var(--ink);border-radius:18px;box-shadow:0 5px 0 var(--ink),0 10px 24px #0005;overflow:hidden;z-index:4;max-height:calc(100% - 138px)}
.rider-ui .dock.closed .pane{display:none}
.rider-ui .rail{display:flex;flex-direction:column;gap:6px;padding:6px;background:#16181dcc;overflow-y:auto;scrollbar-width:none}
.rider-ui .right .rail{border-left:var(--ol) solid var(--ink);order:2}
.rider-ui .left .rail{border-right:var(--ol) solid var(--ink)}
.rider-ui .dock.closed .rail{border:none}
.rider-ui .rail .b{--h:46px;flex:none}
.rider-ui .rail .grow{flex:1;min-height:0}
.rider-ui .pane{width:var(--dock-w);display:flex;flex-direction:column;min-height:0}
.rider-ui .ph{display:flex;align-items:center;gap:8px;padding:8px 8px 8px 10px;background:var(--c);color:var(--ink);border-bottom:var(--ol) solid var(--ink);flex:none}
.rider-ui .ph h3{margin:0;font:800 19px/1 var(--disp);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rider-ui .ph .b{--h:34px;background:#fff;color:var(--ink);border-radius:10px}
.rider-ui .ph .b.on{background:var(--accent)}
.rider-ui .ph .ic{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:#fff;border:2px solid var(--ink);flex:none;overflow:hidden}
.rider-ui .ph .ic svg{width:18px;height:18px}
.rider-ui .ph .ic svg.art{width:26px;height:26px}
.rider-ui .pbody{padding:8px;display:flex;flex-direction:column;gap:8px;min-height:0;overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--line) transparent}
.rider-ui .search{height:40px;border-radius:12px;background:var(--field);border:var(--ol) solid var(--ink);display:flex;align-items:center;gap:8px;padding:0 6px 0 10px;color:var(--muted);flex:none}
.rider-ui .search input{flex:1;min-width:0;background:none;border:0;color:var(--text);font:800 14px var(--body);outline:none}
.rider-ui .search input::placeholder{color:var(--muted)}
.rider-ui .search .b{--h:28px;min-width:28px;border-radius:8px;box-shadow:none}
.rider-ui .worlds{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;flex:none;padding:2px 2px 4px}
.rider-ui .world{width:50px;height:50px;border-radius:12px;border:var(--ol) solid var(--ink);box-shadow:0 3px 0 var(--ink);position:relative;overflow:hidden;flex:none}
.rider-ui .world.on{outline:3px solid var(--accent);outline-offset:1px}
.rider-ui .world span{position:absolute;left:0;right:0;bottom:0;font:900 8.5px/1 var(--body);text-align:center;background:#0d0f13bb;padding:2px 0;color:#fff;letter-spacing:.02em}
.rider-ui .cats{display:flex;gap:5px;flex-wrap:wrap;flex:none}
.rider-ui .cat{height:36px;min-width:36px;border-radius:10px;display:grid;place-items:center;background:var(--field);border:var(--ol) solid var(--ink);color:var(--muted)}
.rider-ui .cat.on{background:var(--c);color:var(--ink)}
.rider-ui .cat svg{width:20px;height:20px}
.rider-ui .label{font:800 12px var(--body);color:var(--muted);display:flex;justify-content:space-between;align-items:center;flex:none}
.rider-ui .label b{color:var(--text)}
.rider-ui .grid{display:grid;grid-template-columns:repeat(var(--tile-cols),1fr);gap:6px}
.rider-ui .tile{aspect-ratio:1;border-radius:12px;background:var(--panel2);border:var(--ol) solid var(--ink);box-shadow:0 3px 0 var(--ink);display:grid;place-items:center;position:relative}
.rider-ui .tile svg.art{width:72%;height:72%;pointer-events:none}
.rider-ui .tile.on{background:color-mix(in srgb,var(--c) 30%,var(--panel2));outline:3px solid var(--c);outline-offset:-1px}
.rider-ui .tile .nm{position:absolute;left:3px;right:3px;bottom:2px;font:900 9px/1.1 var(--body);color:var(--muted);text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none}
.rider-ui .tile.named svg.art{width:58%;height:58%;margin-bottom:10px}
.rider-ui .tile .fav{position:absolute;left:2px;top:1px;width:20px;height:20px;display:grid;place-items:center;color:#ffffff40;background:none;border:0}
.rider-ui .tile .fav svg{width:13px;height:13px;fill:currentColor;stroke:none}
.rider-ui .tile .fav.on{color:var(--accent)}
.rider-ui .empty{font:800 13px var(--body);color:var(--muted);text-align:center;padding:18px 8px;border:2px dashed var(--line);border-radius:12px}
.rider-ui .layers{display:flex;flex-direction:column;gap:6px}
.rider-ui .layer{display:grid;grid-template-columns:46px 1fr auto;gap:8px;align-items:center;background:var(--panel2);border:var(--ol) solid var(--ink);border-radius:12px;padding:5px}
.rider-ui .layer .th{width:46px;height:32px;border-radius:8px;border:2px solid var(--ink)}
.rider-ui .layer .nmw{display:flex;flex-direction:column;gap:5px;min-width:0}
.rider-ui .layer .nmw b{font:800 13px var(--disp);line-height:1}
.rider-ui .layer .b{--h:34px;border-radius:10px}
.rider-ui .slots{display:flex;flex-direction:column;gap:8px}
.rider-ui .slot .label{margin-bottom:5px}
.rider-ui .slot .grid{--tile-cols:5}
.rider-ui .itabs{display:flex;gap:5px;padding:8px 8px 0;flex:none}
.rider-ui .itab{flex:1;height:40px;border-radius:11px 11px 0 0;display:grid;place-items:center;background:var(--field);border:var(--ol) solid var(--ink);border-bottom:none;color:var(--muted)}
.rider-ui .itab.on{background:var(--panel2);color:var(--c)}
.rider-ui .ibody{margin:0 8px 8px;background:var(--panel2);border:var(--ol) solid var(--ink);border-radius:0 0 12px 12px;padding:10px;display:flex;flex-direction:column;gap:10px}
.rider-ui .ibody.solo{border-radius:12px;margin-top:8px}
.rider-ui .seg{display:grid;grid-template-columns:repeat(var(--n,3),1fr);gap:5px}
.rider-ui .seg .b{--h:50px;flex-direction:column;gap:1px;font:900 10px var(--body);color:var(--text)}
.rider-ui .seg .b svg{width:22px;height:22px}
.rider-ui .seg .b.on{color:var(--ink)}
.rider-ui .row{display:flex;align-items:center;gap:8px}
.rider-ui .row .lab{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:var(--field);color:var(--muted);flex:none}
.rider-ui .row .lab svg{width:18px;height:18px}
.rider-ui .row .txt{font:800 12.5px var(--body);color:var(--muted);flex:1}
.rider-ui .range{flex:1;-webkit-appearance:none;appearance:none;height:14px;border-radius:7px;background:linear-gradient(var(--sc,var(--c)),var(--sc,var(--c))) 0/var(--p,50%) 100% no-repeat,var(--field);border:var(--ol) solid var(--ink);outline:none;min-width:0}
.rider-ui .range::-webkit-slider-thumb{-webkit-appearance:none;width:26px;height:26px;border-radius:50%;background:#fff;border:var(--ol) solid var(--ink);box-shadow:0 2px 0 var(--ink);cursor:grab}
.rider-ui .range::-moz-range-thumb{width:22px;height:22px;border-radius:50%;background:#fff;border:var(--ol) solid var(--ink);box-shadow:0 2px 0 var(--ink);cursor:grab}
.rider-ui .val{width:66px;height:34px;border-radius:10px;background:var(--field);border:var(--ol) solid var(--ink);display:flex;align-items:center;justify-content:center;font:900 13px var(--body);font-variant-numeric:tabular-nums;flex:none}
.rider-ui .field{height:38px;border-radius:10px;background:var(--field);border:var(--ol) solid var(--ink);color:var(--text);font:800 14px var(--body);padding:0 10px;width:100%;outline:none}
.rider-ui .field:focus{border-color:var(--accent)}
.rider-ui .toggles,.rider-ui .acts{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}
.rider-ui .toggles .b,.rider-ui .acts .b{--h:46px}
.rider-ui .acts .b.del{background:var(--danger);color:#fff}
.rider-ui .medals{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.rider-ui .medal{display:flex;flex-direction:column;align-items:center;gap:4px;background:var(--field);border:var(--ol) solid var(--ink);border-radius:10px;padding:6px 4px}
.rider-ui .medal i{width:22px;height:22px;border-radius:50%;border:2px solid var(--ink)}
.rider-ui .medal input{width:100%;background:none;border:0;color:var(--text);font:900 13px var(--body);text-align:center;outline:none}
.rider-ui .hint{font:800 12px var(--body);color:var(--muted);line-height:1.35}
.rider-ui .view .b{--h:38px;border-radius:10px}
.rider-ui .zoom{display:flex;align-items:center;height:38px;border-radius:10px;background:var(--field);border:var(--ol) solid var(--ink);font:900 13px var(--body);overflow:hidden}
.rider-ui .zoom span{padding:0 9px;border-left:2px solid var(--ink);border-right:2px solid var(--ink);line-height:34px;min-width:58px;text-align:center;font-variant-numeric:tabular-nums}
.rider-ui .zoom button{width:32px;height:34px;background:none;border:0;font:900 17px var(--body)}
.rider-ui .zoom button:active{background:var(--btn)}
.rider-ui .modal{position:absolute;inset:0;background:#0008;display:grid;place-items:center;z-index:20}
.rider-ui .sheet{width:min(520px,calc(100% - 32px));max-height:calc(100% - 40px);overflow:auto;background:var(--panel2);border:var(--ol) solid var(--ink);border-radius:18px;box-shadow:0 6px 0 var(--ink);display:flex;flex-direction:column}
.rider-ui .sheet .ph{border-radius:16px 16px 0 0}
.rider-ui .sheet .pbody{gap:6px}
.rider-ui .vrow{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;background:var(--field);border:var(--ol) solid var(--ink);border-radius:12px;padding:6px 8px;font:800 13px var(--body)}
.rider-ui .vrow small{display:block;color:var(--muted);font-size:11px}
.rider-ui .vrow .dot{width:10px;height:10px;border-radius:50%;background:var(--muted)}
.rider-ui .vrow .dot.named{background:var(--accent)}
.rider-ui .menu-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.rider-ui .menu-grid .b{--h:64px;flex-direction:column;font:800 12px var(--disp)}
.rider-ui .keys{display:grid;grid-template-columns:auto 1fr;gap:6px 12px;font:800 13px var(--body)}
.rider-ui .keys kbd{font:900 12px var(--body);background:var(--btn);border:2px solid var(--ink);border-radius:7px;padding:2px 7px;box-shadow:0 2px 0 var(--ink);text-align:center}
.rider-ui .chips{display:flex;flex-wrap:wrap;gap:6px}
.rider-ui .chip{font:800 12px var(--body);padding:3px 10px;border-radius:999px;border:var(--ol) solid var(--ink);background:var(--field);color:var(--muted)}
.rider-ui .chip.on{background:var(--c,var(--accent));color:var(--ink)}
.rider-ui .ui-sheet{position:fixed;inset:0;z-index:5000;background:#14161b;color:var(--text);font-family:var(--body);overflow:auto;padding:20px}
.rider-ui .ui-sheet h1{font:800 26px var(--disp);margin:0 0 4px}
.rider-ui .ui-sheet h2{font:800 16px var(--disp);margin:18px 0 8px;color:var(--muted)}
.rider-ui .ui-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.rider-ui .ui-cell{display:flex;flex-direction:column;align-items:center;gap:6px;font:800 11px var(--body);color:var(--muted)}
.rider-ui .ui-box{width:300px;background:var(--panel);border:var(--ol) solid var(--ink);border-radius:18px;box-shadow:0 5px 0 var(--ink);overflow:hidden}
.rider-ui .ui-swatch{width:64px;height:40px;border-radius:10px;border:var(--ol) solid var(--ink)}
.rider-ui .ui-close{position:fixed;right:20px;top:20px}
`;
const ICONS = {
  cursor:'<path d="M5 3l14 7-6 2-2 6z"/>',
  pencil:'<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>',
  curve:'<path d="M4 18C6 6 18 6 20 18"/><circle cx="4" cy="18" r="1.5"/><circle cx="20" cy="18" r="1.5"/>',
  brush:'<path d="M3 19c4 0 5-2 6-5l9-9 2 2-9 9c-3 1-5 2-5 5z"/>',
  hand:'<path d="M7 11V6a1.5 1.5 0 013 0v4M10 10V4.5a1.5 1.5 0 013 0V10M13 10V5.5a1.5 1.5 0 013 0V11M16 11V8a1.5 1.5 0 013 0v6a7 7 0 01-7 7h-1a6 6 0 01-5-3l-3-5a1.5 1.5 0 012.5-1.5L7 14"/>',
  undo:'<path d="M9 7L4 12l5 5"/><path d="M4 12h10a6 6 0 010 12"/>',
  retry:'<path d="M20 12a8 8 0 11-2.4-5.7"/><path d="M20 4v5h-5"/>',
  pause:'<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
  redo:'<path d="M15 7l5 5-5 5"/><path d="M20 12H10a6 6 0 000 12"/>',
  play:'<path d="M7 4l13 8-13 8z"/>', stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>',
  menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
  history:'<path d="M3 12a9 9 0 103-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  save:'<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h8V4M8 20v-6h8v6"/>',
  share:'<path d="M12 15V3M7 8l5-5 5 5M5 13v7h14v-7"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 015 0c0 2-2.5 2-2.5 4M12 17h.01"/>',
  coin:'<circle cx="12" cy="12" r="8"/><path d="M12 8v8"/>',
  gem:'<path d="M6 4h12l3 5-9 11L3 9z"/><path d="M3 9h18M9 4l3 16 3-16"/>',
  fuel:'<path d="M6 21V6a2 2 0 012-2h6a2 2 0 012 2v15M4 21h14M8 9h6"/><path d="M16 10l3 2v6a1 1 0 002 0V9l-3-3"/>',
  flag:'<path d="M6 21V4M6 4h11l-2 4 2 4H6"/>',
  finish:'<path d="M6 21V4"/><path d="M6 4h12v8H6z"/><path d="M6 4h3v4H6zM12 4h3v4h-3zM9 8h3v4H9zM15 8h3v4h-3z" fill="currentColor"/>',
  ramp:'<path d="M3 18h18L21 7z"/>',
  tree:'<path d="M12 21v-6M9 18l3-2 3 2"/><path d="M7 15a4 4 0 01-1-7.5A5 5 0 0115.5 5 4.5 4.5 0 0118 15z"/>',
  mountain:'<path d="M2 20l7-12 4 6 3-4 6 10z"/>',
  texture:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v6M15 9v6M9 15v6"/>',
  layers:'<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  list:'<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
  crate:'<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 4l16 16M20 4L4 20"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  chevl:'<path d="M15 6l-6 6 6 6"/>', chevr:'<path d="M9 6l6 6-6 6"/>',
  close:'<path d="M6 6l12 12M18 6L6 18"/>',
  behind:'<rect x="9" y="3" width="12" height="12" rx="2"/><rect x="3" y="9" width="12" height="12" rx="2" fill="currentColor" opacity=".35"/>',
  front:'<rect x="9" y="3" width="12" height="12" rx="2" fill="currentColor" opacity=".35"/><rect x="3" y="9" width="12" height="12" rx="2"/>',
  body:'<path d="M3 12h18v9H3z" fill="currentColor" opacity=".35"/><circle cx="12" cy="15" r="3"/>',
  tilt:'<path d="M3 18L21 10"/><path d="M12 14V6"/><circle cx="12" cy="5" r="2"/>',
  offset:'<path d="M12 3v13M8 7l4-4 4 4M4 20h16"/>',
  size:'<path d="M4 20l7-7M4 20v-5M4 20h5M20 4l-7 7M20 4v5M20 4h-5"/>',
  rot:'<path d="M20 12a8 8 0 11-3-6.2"/><path d="M20 4v5h-5"/>',
  eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff:'<path d="M3 3l18 18M10.6 5.1A10 10 0 0112 5c6 0 10 7 10 7a17 17 0 01-3.1 3.9M6.6 6.6C3.9 8.4 2 12 2 12s4 7 10 7a9.6 9.6 0 004.4-1"/>',
  lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
  flip:'<path d="M12 3v18M8 7L3 12l5 5V7zM16 7l5 5-5 5V7z"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="1"/><path d="M16 8V4H4v12h4"/>',
  trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  magic:'<path d="M4 20L16 8M14 4v3M18 8h3M19 3l-2 2M10 4l1 2"/>',
  fit:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  start:'<circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
  grid:'<path d="M4 4h16v16H4zM4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16"/>',
  car:'<path d="M3 15l2-5h11l3 5v3H3z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  map:'<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
  star:'<path d="M12 3l2.7 5.6 6.1.8-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1-4.4-4.3 6.1-.8z" fill="currentColor"/>',
  animal:'<path d="M5 13c0-3 3-5 7-5s7 2 7 5v3H5z"/><path d="M8 16v4M16 16v4M19 11l2-2M5 11L3 9"/>',
  sign:'<path d="M12 21V8M5 4h12l2 2-2 2H5z"/>',
  fence:'<path d="M5 21V7l2-2 2 2v14M15 21V7l2-2 2 2v14M3 11h18M3 16h18"/>',
  rock:'<path d="M3 19l4-8 5-3 5 4 4 7z"/>',
  flower:'<circle cx="12" cy="9" r="2.5"/><path d="M12 11.5V21M9 16c-2 0-3-1-3-3 2 0 3 1 3 3zM15 16c2 0 3-1 3-3-2 0-3 1-3 3z"/>',
  ball:'<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c3 3 3 13 0 16"/>',
  zone:'<rect x="3" y="7" width="18" height="10" rx="2" stroke-dasharray="3 2"/><path d="M9 12h6M13 10l2 2-2 2"/>',
  chain:'<rect x="3" y="9" width="9" height="6" rx="3"/><rect x="12" y="9" width="9" height="6" rx="3"/>',
  brk:'<path d="M4 6h16v12H4z"/><path d="M11 6l-2 5 4 2-2 5"/>',
  joint:'<circle cx="12" cy="12" r="3"/><path d="M3 18L21 6"/>',
  sparkle:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/>',
  sway:'<path d="M12 21v-8"/><path d="M12 13c-4-1-5-5-3-8 3 1 5 4 3 8zM12 13c4-1 5-5 3-8"/>',
  palette:'<path d="M12 3a9 9 0 100 18c1.5 0 2-1 2-2s-1-2 0-3 3 0 4-1 2-2 2-4c0-4.5-3.6-8-8-8z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
  up:'<path d="M12 19V5M6 11l6-6 6 6"/>', down:'<path d="M12 5v14M6 13l6 6 6-6"/>',
  text:'<path d="M5 5h14M12 5v14M9 19h6"/>',
  cube:'<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  filenew:'<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M12 11v6M9 14h6"/>',
  folder:'<path d="M3 7h6l2 2h10v10H3z"/>',
  download:'<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  upload:'<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
  warn:'<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  check:'<path d="M5 12l5 5 9-10"/>', plus:'<path d="M12 5v14M5 12h14"/>',
  speed:'<path d="M4 18a8 8 0 1116 0"/><path d="M12 18l4-6"/>', clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  checkpoint:'<path d="M6 21V4"/><path d="M6 4h12v8H6"/><path d="M10 4v8M14 4v8M6 8h12"/>',
  arrows:'<path d="M3 12h14M13 8l4 4-4 4M7 8l4 4-4 4"/>',
  weight:'<path d="M7 9h10l3 11H4z"/><circle cx="12" cy="6" r="2.5"/>',
  bounce:'<path d="M4 20c2-8 4-8 6 0M10 20c1.5-5 3-5 4.5 0M14.5 20c1-3 2-3 3 0"/><circle cx="18" cy="6" r="2.5"/>',
  friction:'<path d="M3 18h18M5 14l3-3M10 14l3-3M15 14l3-3"/>',
  power:'<path d="M12 3v9M6.3 6.3a8 8 0 1011.4 0"/>',
  link:'<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
  anchor:'<circle cx="12" cy="5" r="2"/><path d="M12 7v14M5 13a7 7 0 0014 0M9 10h6"/>',
};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const attr = (k, v) => v == null || v === false ? '' : ` ${k}="${esc(v)}"`;
const data = d => d ? Object.entries(d).map(([k, v]) => attr('data-' + k, v)).join('') : '';
// cls and colours come from internal callers only; they are not escaped for CSS.
const icon = (name, cls = 'i') => {
  if (!ICONS[name]) throw new Error('Unknown UI icon: ' + name);
  return `<svg class="${cls}" aria-hidden="true"><use href="#ui-${name}"/></svg>`;
};
function install() {
  if (!document.getElementById('rider-ui-kit')) {
    const s = document.createElement('style'); s.id = 'rider-ui-kit'; s.textContent = CSS; document.head.append(s);
  }
  if (!document.getElementById('rider-ui-icons')) {
    const d = document.createElement('div'); d.id = 'rider-ui-icons'; d.hidden = true;
    d.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0"><defs>${Object.entries(ICONS).map(([k, v]) => `<symbol id="ui-${k}" viewBox="0 0 24 24">${v}</symbol>`).join('')}</defs></svg>`;
    document.body.append(d);
  }
}
// Chunky button with depth. variant: plain | wide | danger | primary
function button({icon: ic, label, on = false, color, title, act, d, disabled = false, variant, tag} = {}) {
  const cls = ['b', on && 'on', variant === 'plain' && 'plain', variant === 'wide' && 'wide', variant === 'danger' && 'del'].filter(Boolean).join(' ');
  const style = variant === 'primary' ? ' style="background:var(--go);color:var(--ink)"' : color ? ` style="--c:${esc(color)}"` : '';
  return `<button type="button" class="${cls}"${style}${attr('title', title)}${attr('aria-label', title || label)}${attr('aria-pressed', on ? 'true' : null)}${attr('data-act', act)}${data(d)}${disabled ? ' disabled' : ''}>${ic ? icon(ic) : ''}${label ? esc(label) : ''}${tag != null ? `<span class="tag">${esc(tag)}</span>` : ''}</button>`;
}
const play = ({playing = false, act = 'play', title} = {}) => `<button type="button" class="play"${attr('data-act', act)} title="${esc(title || (playing ? 'Stop' : 'Test drive'))}" aria-label="${esc(title || (playing ? 'Stop' : 'Test drive'))}">${icon(playing ? 'stop' : 'play')}</button>`;
const seg = (key, options, current, color) => `<div class="seg" role="radiogroup" style="--n:${options.length}">${options.map(([v, ic, l]) => `<button type="button" role="radio" aria-checked="${String(current) === String(v)}" class="b ${String(current) === String(v) ? 'on' : ''}" style="--c:${esc(color)}" data-seg="${esc(key)}" data-v="${esc(v)}" title="${esc(l)}">${icon(ic)}${esc(l)}</button>`).join('')}</div>`;
function range({key, min, max, step = 1, value, label, icon: ic, color, text}) {
  const p = max > min ? Math.max(0, Math.min(100, Math.round((value - min) / (max - min) * 100))) : 0;
  return `<div class="row"><span class="lab" title="${esc(label)}">${icon(ic)}</span><input class="range" type="range" min="${min}" max="${max}" step="${step}" value="${esc(value)}" data-k="${esc(key)}" style="--p:${p}%;--sc:${esc(color)}" aria-label="${esc(label)}"><span class="val" data-val="${esc(key)}">${esc(text ?? value)}</span></div>`;
}
const search = ({id, placeholder, value = '', clear = 'clearsearch'}) => `<label class="search">${icon('search')}<input id="${esc(id)}" type="search" placeholder="${esc(placeholder)}" value="${esc(value)}" autocomplete="off">${value ? button({icon: 'close', title: 'Clear search', act: clear}) : ''}</label>`;
const tabRail = (tabs, {collapse, collapsed = false} = {}) => (collapse ? button({icon: collapsed ? 'chevr' : 'chevl', variant: 'plain', title: collapsed ? 'Open' : 'Collapse', act: collapse}) : '') + tabs.map(t => button({icon: t.icon, on: t.on, color: t.color, title: t.title, act: t.act || 'tab', d: {v: t.id}})).join('');
const dockHeader = ({title, icon: ic, color, actions = ''}) => `<div class="ph" style="--c:${esc(color)}"><span class="ic">${icon(ic)}</span><h3>${esc(title)}</h3>${actions}</div>`;
const chip = ({label, on = false, act, v}) => `<button type="button" class="chip ${on ? 'on' : ''}"${attr('data-act', act)}${attr('data-v', v)}>${esc(label)}</button>`;
function toast(el, {text, icon: ic = 'info', color}) { el.className = 'ui-toast'; el.innerHTML = `<span class="ic" style="--tc:${esc(color || 'var(--info)')}">${icon(ic)}</span>${esc(text)}`; el.hidden = false; }
// Debug component sheet (#683 acceptance): every component in its states.
function sheet() {
  install();
  let root = document.getElementById('rider-ui-sheet');
  if (root) { root.hidden = false; return root; }
  root = document.createElement('div'); root.id = 'rider-ui-sheet'; root.className = 'rider-ui';
  const colors = [['--k-play','Gameplay'],['--k-track','Track'],['--k-decor','Decor'],['--k-bg','Background'],['--k-tex','Texture'],['--k-obj','Objects'],['--accent','Accent'],['--go','Go'],['--danger','Danger'],['--info','Info']];
  const cell = (inner, name) => `<span class="ui-cell">${inner}${esc(name)}</span>`;
  root.innerHTML = `<div class="ui-sheet"><h1>Rider editor UI kit</h1><p class="hint">#683 · tokens, icons and components for the HTML editor chrome. Debug builds only (?uikit=1).</p>
  ${button({icon: 'close', title: 'Close sheet', act: 'ui-sheet-close', variant: 'plain'}).replace('class="b plain"', 'class="b plain ui-close"')}
  <h2>Colours</h2><div class="ui-row">${colors.map(([v, n]) => cell(`<span class="ui-swatch" style="background:var(${v})"></span>`, n)).join('')}</div>
  <h2>Buttons</h2><div class="ui-row">${cell(button({icon: 'cursor', title: 'Default'}), 'default')}${cell(button({icon: 'cursor', on: true, title: 'On'}), 'on')}${cell(button({icon: 'tree', on: true, color: 'var(--k-decor)', title: 'Area colour'}), 'area')}${cell(button({icon: 'history', tag: 12, title: 'Badge'}), 'badge')}${cell(button({icon: 'undo', disabled: true, title: 'Disabled'}), 'disabled')}${cell(button({icon: 'trash', variant: 'danger', title: 'Danger'}), 'danger')}${cell(button({icon: 'plus', label: 'Wide', variant: 'wide'}), 'wide')}${cell(button({icon: 'play', label: 'Primary', variant: 'primary'}), 'primary')}${cell(play(), 'play')}${cell(play({playing: true}), 'stop')}</div>
  <h2>Icons</h2><div class="ui-row">${Object.keys(ICONS).map(k => cell(`<span class="b plain" title="${k}">${icon(k)}</span>`, k)).join('')}</div>
  <h2>Panel</h2><div class="ui-box">${dockHeader({title: 'Decor', icon: 'tree', color: 'var(--k-decor)', actions: button({icon: 'star', title: 'Favourites'})})}<div class="pbody">${search({id: 'ui-sheet-search', placeholder: 'Search 312 assets'})}<div class="cats">${['star','tree','flower','rock','animal','sign','fence'].map((c, i) => `<button type="button" class="cat ${i === 1 ? 'on' : ''}" style="--c:var(--k-decor)" aria-label="${c}">${icon(c)}</button>`).join('')}</div>${seg('layer', [['behind','behind','Behind'],['front','front','Front'],['body','body','In ground']], 'front', 'var(--k-decor)')}${range({key: 'size', min: .25, max: 3, step: .05, value: 1.4, label: 'Size', icon: 'size', color: '#4cc9ff', text: '1.4×'})}${range({key: 'rot', min: -180, max: 180, value: 0, label: 'Rotation', icon: 'rot', color: '#ffb03f', text: '0°'})}<div class="chips">${chip({label: 'Oak', on: true})}${chip({label: 'Pine', on: true})}${chip({label: 'Grass'})}</div><div class="toggles">${button({icon: 'tilt', on: true, color: '#4cc9ff', title: 'Tilt'})}${button({icon: 'flip', title: 'Mirror'})}${button({icon: 'eye', on: true, color: '#ffd23f', title: 'Visible'})}${button({icon: 'lock', title: 'Lock'})}</div></div></div>
  <h2>Toast</h2><div class="ui-row"><div id="ui-sheet-toast"></div></div></div>`;
  document.body.append(root);
  toast(root.querySelector('#ui-sheet-toast'), {text: 'Tap the track to place Oak', icon: 'cursor'});
  root.addEventListener('click', e => {
    if (e.target.closest('[data-act="ui-sheet-close"]')) { root.hidden = true; return; }
    const b = e.target.closest('.b:not(.ui-close),.cat,.chip'); if (b && !b.disabled && !b.closest('.seg')) { b.classList.toggle('on'); }
    const s = e.target.closest('[data-seg]'); if (s) { for (const x of s.parentNode.children) { x.classList.toggle('on', x === s); x.setAttribute('aria-checked', String(x === s)); } }
  });
  root.addEventListener('input', e => { const t = e.target; if (t.matches('.range')) { t.style.setProperty('--p', (t.value - t.min) / (t.max - t.min) * 100 + '%'); const v = root.querySelector(`[data-val="${t.dataset.k}"]`); if (v) v.textContent = t.value; } });
  return root;
}
window.riderUI = {version: 1, install, esc, icon, button, play, seg, range, search, tabRail, dockHeader, chip, toast, sheet, icons: Object.keys(ICONS)};
})();
