// #699 clickable editor UI prototype. Fake level, fake data; no game or editor wiring.
'use strict';
(() => {
const $ = s => document.querySelector(s);
const NS = 'http://www.w3.org/2000/svg';
document.getElementById('icons').innerHTML = Object.entries(ICONS).map(([k,v]) => `<symbol id="i-${k}" viewBox="0 0 24 24">${v}</symbol>`).join('');
const ic = (n, cls='i') => `<svg class="${cls}"><use href="#i-${n}"/></svg>`;
const art = (key, world='meadow', extra='') => `<svg class="art" viewBox="0 0 48 48" ${extra}>${ART[key](WP[world].p)}</svg>`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const WORLD_W = 4200;

// ---------- state ----------
let uid = 1;
const item = (a, tab, x, o={}) => ({id:uid++, a, tab, x, dy:0, size:1, rot:0, flip:false, layer:'front', vis:true, lock:false, tilt:true, sway:false, swayAmt:.4, tint:null, world:'meadow', mat:'wood', mass:.4, bounce:.3, fric:.5, strength:.6, dir:1, value:1, length:12, ...o});
const S = {
  tab:'decor', leftOpen:true, rightOpen:true, rtab:'sel', itab:0,
  world:'meadow', cat:{decor:'plants', play:'all', track:'all', obj:'all'}, search:'',
  favs:new Set(['oak','cow','coin','crate']), armed:null, tool:'select',
  items:[], sel:null, cam:{x:0, z:Math.max(.55,Math.min(1,innerHeight/810))}, grid:true, mini:true,
  bg:{world:'meadow', on:true, layers:BG_LAYERS.map((n,i)=>({vis:true, depth:[0,.08,.25,.5,.75,1.25][i]}))},
  tex:{surface:'grass', band:'dirt', fill:'earth'},
  level:{name:'Meadow run', speed:0, fuel:60, medals:[38,45,60], look:{mode:1, width:.9, persp:.35, angle:29, side:64, shade:1}, drive:{from:0, crash:false, path:true}},
  undo:[], redo:[], saved:false, playing:false,
  versions:[{t:'Auto · 2 min ago'},{t:'Auto · 14 min ago'},{t:'Before bridge', named:true},{t:'Auto · yesterday'}],
};
S.items.push(item('start','play',140,{world:'meadow'}), item('oak','decor',380), item('coinpath','play',640,{dy:90}), item('pine','decor',900,{size:1.3}), item('crate','obj',1180,{dy:0}), item('cow','decor',1500), item('fuel','play',1760,{dy:30}), item('gem','play',2240,{dy:120}), item('bush','decor',2520), item('turbo','obj',2800), item('rock','decor',3200), item('finish','play',3950));

// ---------- geometry ----------
const H = () => innerHeight, W = () => innerWidth;
const base = () => H()*0.80;
const trackY = x => base() - 60*Math.sin(x/320) - 28*Math.sin(x/115+1.3) - (x>1300&&x<2100 ? 110*Math.sin((x-1300)/800*Math.PI) : 0) - (x>2900&&x<3500 ? -40*Math.sin((x-2900)/600*Math.PI) : 0);
const slope = x => Math.atan2(trackY(x+4)-trackY(x-4), 8)*180/Math.PI;
const toWorld = (sx, sy) => ({x: sx/S.cam.z + S.cam.x, y: (sy - base()*(1-S.cam.z))/S.cam.z});
const meta = (tab, a) => tab==='decor' ? {name:(DECOR_SETS.meadow.concat(...Object.values(DECOR_SETS)).find(d=>d[0]===a)||[a,a])[1]} : (()=>{const t=TABS[tab].items.find(i=>i[0]===a);return {name:t?t[1]:a}})();
const BASE_SIZE = {decor:96, play:56, obj:84, track:150};
const artKey = it => it.tab==='track' ? ((TABS.track.items.find(t=>t[0]===it.a)||[0,0,'t_flat'])[2]) : (ART[it.a]?it.a:'crate');
const isPickup = a => ['coin','coin5','gem','fuel','coinpath'].includes(a);

// ---------- history ----------
const snap = () => JSON.stringify({items:S.items, bg:S.bg, tex:S.tex, level:S.level});
function commit(label){ S.undo.push(S._pre ?? snap()); S._pre=null; S.redo=[]; if(S.undo.length>60) S.undo.shift(); S.saved=false; if(label) toast(label,'check','var(--go)'); render(); }
function begin(){ S._pre = snap(); }
function restore(s){ const o=JSON.parse(s); S.items=o.items; S.bg=o.bg; S.tex=o.tex; S.level=o.level; if(!S.items.find(i=>i.id===S.sel)) S.sel=null; }
function undo(){ if(!S.undo.length) return; S.redo.push(snap()); restore(S.undo.pop()); toast('Undone','undo'); render(); }
function redo(){ if(!S.redo.length) return; S.undo.push(snap()); restore(S.redo.pop()); toast('Redone','redo'); render(); }

// ---------- toast ----------
let toastT;
function toast(text, icon='cursor', color){ const t=$('#toast'); t.innerHTML=`<span class="ic" style="--tc:${color||'var(--info)'}">${ic(icon)}</span>${esc(text)}`; t.hidden=false; clearTimeout(toastT); if(!S.armed) toastT=setTimeout(()=>t.hidden=true,2200); }

// ---------- level drawing ----------
const svg = $('#level');
function hills(seed, amp, y0, color, par, step=180){ const cx=S.cam.x*par, w=W()/S.cam.z+400; let d=`M${-200} ${H()}`; for(let x=-200;x<=w;x+=step/3){ const wx=x+cx; d+=` L${x} ${y0 - amp*(0.6+0.4*Math.sin(wx/step+seed))*(0.7+0.3*Math.sin(wx/(step*2.7)+seed*2))}`;} return `<path d="${d} L${w} ${H()}Z" fill="${color}"/>`; }
function repeatArt(key, world, par, y, every, size, seed){ const cx=S.cam.x*par; let s=''; const w=W()+200; const first=Math.floor((cx-100)/every); for(let k=first;k*every-cx<w;k++){ const x=k*every-cx+((k*seed)%7)*18; s+=`<svg x="${x-size/2}" y="${y-size+((k*seed)%3)*6}" width="${size}" height="${size}" viewBox="0 0 48 48">${ART[key](WP[world].p)}</svg>`;} return s; }
function drawLevel(){
  const w=WP[S.bg.world], L=S.bg.layers, z=S.cam.z;
  let s=`<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${w.sky[0]}"/><stop offset="1" stop-color="${w.sky[1]}"/></linearGradient><pattern id="dots" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1.5" fill="#0d0f1322"/></pattern></defs>`;
  s+=`<rect width="100%" height="100%" fill="${S.bg.on&&L[0].vis?'url(#sky)':'#2c3039'}"/>`;
  if(S.bg.on){
    if(L[1].vis){ const cx=S.cam.x*L[1].depth; s+=`<g fill="#fff" opacity=".85">`; for(let k=0;k<8;k++){ const x=((k*430-cx)%(W()+400)+W()+400)%(W()+400)-200; const y=90+((k*37)%5)*28; s+=`<ellipse cx="${x}" cy="${y}" rx="48" ry="16"/><ellipse cx="${x+26}" cy="${y-9}" rx="30" ry="18"/>`;} s+='</g>'; }
    if(L[2].vis) s+=hills(1, 120, H()*0.62, w.far, L[2].depth, 260);
    if(L[3].vis) s+=hills(3, 60, H()*0.70, w.mid, L[3].depth, 180);
    if(L[4].vis) s+=`<g opacity=".75">${repeatArt('pine', S.bg.world, L[4].depth, H()*0.67, 230, 52, 3)}</g>`;
  }
  if(S.grid) s+=`<rect width="100%" height="100%" fill="url(#dots)" opacity=".7"/>`;
  // world group
  s+=`<g transform="translate(0 ${base()*(1-z)}) scale(${z}) translate(${-S.cam.x} 0)">`;
  const x0=S.cam.x-50, x1=S.cam.x+W()/z+50; let top='';
  for(let x=x0;x<=x1;x+=12) top+=`${x===x0?'M':'L'}${x.toFixed(1)} ${trackY(x).toFixed(1)} `;
  const surf=(MATERIALS.surface.find(m=>m[0]===S.tex.surface)||[0,'#7ccf5a'])[1], band=(MATERIALS.band.find(m=>m[0]===S.tex.band)||[0,'#9a6a46'])[1], fill=(MATERIALS.fill.find(m=>m[0]===S.tex.fill)||[0,'#b98157'])[1];
  s+=`<path d="${top} L${x1} ${H()/z+400} L${x0} ${H()/z+400}Z" fill="${fill}"/>`;
  s+=`<path d="${top}" fill="none" stroke="${band}" stroke-width="40" transform="translate(0 20)"/>`;
  s+=`<path d="${top}" fill="none" stroke="${surf}" stroke-width="16" transform="translate(0 6)"/>`;
  s+=`<path d="${top}" fill="none" stroke="${INK}" stroke-width="3"/>`;
  const order={behind:0,body:1,front:2};
  const list=[...S.items].sort((a,b)=>(order[a.layer]??2)-(order[b.layer]??2));
  for(const it of list){
    if(it._hidden) continue;
    const sz=BASE_SIZE[it.tab]*it.size, y=trackY(it.x)-it.dy, rot=it.rot+(it.tilt&&it.tab==='decor'?slope(it.x):0);
    const faded=!it.vis?' opacity=".35"':'';
    const k = artKey(it);
    const tint = it.tint?`<rect x="0" y="0" width="48" height="48" fill="${it.tint}" opacity=".35" style="mix-blend-mode:multiply"/>`:'';
    const sway = it.sway?`<animateTransform attributeName="transform" type="rotate" values="${-6*it.swayAmt} 24 44;${6*it.swayAmt} 24 44;${-6*it.swayAmt} 24 44" dur="2.4s" repeatCount="indefinite"/>`:'';
    s+=`<g class="it" data-id="${it.id}" transform="translate(${it.x} ${y}) rotate(${rot})"${faded}><g transform="scale(${it.flip?-1:1} 1)"><svg x="${-sz/2}" y="${-sz}" width="${sz}" height="${sz}" viewBox="0 0 48 48" overflow="visible"><g>${ART[k](WP[it.world||'meadow'].p)}${tint}${sway}</g></svg></g><rect x="${-sz/2}" y="${-sz}" width="${sz}" height="${sz}" fill="transparent"/>`;
    if(it.id===S.sel){ const c=TABS[it.tab].hex; s+=`<rect x="${-sz/2-6}" y="${-sz-6}" width="${sz+12}" height="${sz+12}" rx="10" fill="none" stroke="${c}" stroke-width="3" stroke-dasharray="7 5"/>`; for(const [hx,hy] of [[-sz/2-6,-sz-6],[sz/2+6,-sz-6],[-sz/2-6,6],[sz/2+6,6]]) s+=`<circle cx="${hx}" cy="${hy}" r="7" fill="#fff" stroke="${INK}" stroke-width="2.5"/>`; s+=`<circle cx="0" cy="${-sz-26}" r="7" fill="${c}" stroke="${INK}" stroke-width="2.5"/>`; if(it.lock) s+=`<g transform="translate(${sz/2-4} ${-sz-4})"><circle r="11" fill="#fff" stroke="${INK}" stroke-width="2"/><svg x="-8" y="-8" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${INK}" stroke-width="2.5">${ICONS.lock}</svg></g>`; }
    s+='</g>';
  }
  if(S.playing && S.car){ const cx=S.car.x, cy=trackY(cx); s+=`<g transform="translate(${cx} ${cy}) rotate(${slope(cx)})"><rect x="-34" y="-34" width="68" height="22" rx="7" fill="#ffd23f" stroke="${INK}" stroke-width="3"/><rect x="-14" y="-48" width="30" height="16" rx="5" fill="#4cc9ff" stroke="${INK}" stroke-width="3"/><circle cx="-20" cy="-10" r="11" fill="#2c3039" stroke="${INK}" stroke-width="3"/><circle cx="22" cy="-10" r="11" fill="#2c3039" stroke="${INK}" stroke-width="3"/></g>`; }
  s+='</g>';
  if(S.bg.on && L[5].vis) s+=`<g opacity=".95">${repeatArt('bush', S.bg.world, L[5].depth, H()+20, 520, 120, 5)}</g>`;
  svg.innerHTML=s;
}

// ---------- top bars ----------
function b(icon, {on=false, c, cls='', title='', act='', tag, dis=false, data=''}={}){ return `<button class="b ${on?'on':''} ${cls}" ${c?`style="--c:${c}"`:''} title="${esc(title)}" aria-label="${esc(title)}" ${act?`data-act="${act}"`:''} ${data} ${dis?'disabled':''}>${ic(icon)}${tag!=null?`<span class="tag">${tag}</span>`:''}</button>`; }
function drawBars(){
  const tools=[['select','cursor','Select · move'],['line','pencil','Draw line'],['curve','curve','Draw curve'],['brush','brush','Terrain brush'],['pan','hand','Pan view']];
  $('#tools').innerHTML = tools.map(([id,icn,t])=>b(icn,{on:S.tool===id,title:t,act:'tool',data:`data-v="${id}"`})).join('')+`<span class="sep"></span>${b('undo',{title:'Undo (Ctrl+Z)',act:'undo',dis:!S.undo.length})}${b('redo',{title:'Redo (Ctrl+Y)',act:'redo',dis:!S.redo.length})}<span class="sep"></span><button class="play" data-act="play" title="Test drive (Space)" aria-label="Test drive">${ic('play')}</button>`;
  $('#sys').innerHTML = b('history',{title:'Versions',act:'versions',tag:S.versions.length})+b('save',{title:'Save (Ctrl+S)',act:'save'})+b('share',{title:'Share',act:'share'})+b('help',{title:'Help',act:'help'});
  $('.lvlchip [data-act=menu]').innerHTML = ic('menu');
  $('#lvlName').textContent = S.level.name;
  const st=$('#saveState'); st.textContent=S.saved?'Saved':'Unsaved'; st.className=S.saved?'':'dirty';
  let coins=0, gems=0, fuel=0; for(const it of S.items){ if(it._hidden) continue; if(it.a==='coin') coins+=it.value; if(it.a==='coin5') coins+=5; if(it.a==='coinpath') coins+=5; if(it.a==='gem') gems++; if(it.a==='fuel') fuel++; }
  $('#counts').innerHTML = `<span class="cnt" style="color:#ffd23f" title="Coins">${ic('coin')}<span>${S.playing?S.got.coins+' / ':''}${coins}</span></span><span class="cnt" style="color:#b48cff" title="Wonder Gems">${ic('gem')}<span>${gems}</span></span><span class="cnt" style="color:#ff7b54" title="Fuel cans">${ic('fuel')}<span>${fuel}</span></span>`;
  $('#view').innerHTML = b('fit',{title:'Show whole level',act:'fit'})+b('start',{title:'Go to start',act:'gostart'})+b('grid',{on:S.grid,title:'Grid',act:'grid'})+`<span class="zoom"><button data-act="zout" aria-label="Zoom out">−</button><span>${Math.round(S.cam.z*100)}%</span><button data-act="zin" aria-label="Zoom in">+</button></span>`+b('map',{on:S.mini,c:'#4cc9ff',title:'Minimap',act:'mini'});
  $('#stop').innerHTML = ic('stop'); $('#stop').hidden=!S.playing;
}

// ---------- library ----------
function tileHTML(key, name, {on=false, fav, data='', world='meadow', c}={}){
  return `<div class="tile named ${on?'on':''}" role="button" tabindex="0" ${data} title="${esc(name)}" style="--c:${c}">${art(key,world)}<span class="nm">${esc(name)}</span>${fav!=null?`<button class="fav ${fav?'on':''}" data-fav="${key}" aria-label="Favourite">${ic('star')}</button>`:''}</div>`;
}
function worldsHTML(cur, act){ return `<div class="worlds">${WORLDS.map(w=>`<button class="world ${w.id===cur?'on':''}" data-act="${act}" data-v="${w.id}" style="background:linear-gradient(${w.thumb[0]} 0 55%,${w.thumb[1]} 55%)" aria-label="${w.name}"><span>${w.name.toUpperCase()}</span></button>`).join('')}</div>`; }
function drawLibrary(){
  const T=TABS[S.tab];
  $('#leftRail').innerHTML = b(S.leftOpen?'chevl':'chevr',{cls:'plain',title:S.leftOpen?'Collapse library':'Open library',act:'leftToggle'})+Object.entries(TABS).map(([k,t])=>b(t.icon,{on:S.leftOpen&&S.tab===k,c:t.color,title:t.name,act:'tab',data:`data-v="${k}"`})).join('')+`<span class="grow"></span>${b('list',{cls:'plain',title:'Level objects',act:'objects'})}`;
  $('#left').classList.toggle('closed',!S.leftOpen);
  if(!S.leftOpen){ $('#libPane').innerHTML=''; return; }
  let h=`<div class="ph" style="--c:${T.color}"><span class="ic">${ic(T.icon)}</span><h3>${T.name}</h3>${S.tab==='decor'||S.tab==='obj'||S.tab==='play'?b('star',{on:S.cat[S.tab]==='fav',title:'Favourites',act:'favcat'}):''}</div><div class="pbody">`;
  if(S.tab==='bg') h+=bgPane(); else if(S.tab==='tex') h+=texPane(); else h+=assetPane(T);
  h+='</div>';
  $('#libPane').innerHTML=h; $('#libPane').style.setProperty('--c',T.color);
  const inp=$('#search'); if(inp && S._focusSearch){ inp.focus(); inp.setSelectionRange(inp.value.length,inp.value.length); }
}
function assetList(T){
  if(S.tab==='decor'){
    const q=S.search.trim().toLowerCase(), cat=S.cat.decor;
    let src = q ? Object.entries(DECOR_SETS).flatMap(([w,l])=>l.map(d=>({k:d[0],n:d[1],c:d[2],w}))) : DECOR_SETS[S.world].map(d=>({k:d[0],n:d[1],c:d[2],w:S.world}));
    if(q) src=src.filter(d=>d.n.toLowerCase().includes(q)||d.c.includes(q)||d.w.includes(q));
    else if(cat==='fav') src=src.filter(d=>S.favs.has(d.k)); else src=src.filter(d=>d.c===cat);
    return src;
  }
  const q=S.search.trim().toLowerCase(), cat=S.cat[S.tab];
  let src=T.items.map(d=>({k:d[0],n:d[1],art:d[2],c:d[3],w:'meadow'}));
  if(q) src=src.filter(d=>d.n.toLowerCase().includes(q)); else if(cat==='fav') src=src.filter(d=>S.favs.has(d.k)); else if(cat!=='all') src=src.filter(d=>d.c===cat);
  return src;
}
function assetPane(T){
  const total = S.tab==='decor' ? Object.values(DECOR_SETS).reduce((n,l)=>n+l.length,0) : T.items.length;
  let h=`<label class="search">${ic('search')}<input id="search" type="search" placeholder="Search ${total} ${S.tab==='decor'?'assets':T.name.toLowerCase()}" value="${esc(S.search)}" autocomplete="off">${S.search?b('close',{title:'Clear search',act:'clearsearch'}):''}</label>`;
  if(T.worlds) h+=worldsHTML(S.world,'world');
  h+=`<div class="cats">${T.cats.map(([id,icn,name])=>`<button class="cat ${S.cat[S.tab]===id&&!S.search?'on':''}" data-act="cat" data-v="${id}" title="${name}" aria-label="${name}">${ic(icn)}</button>`).join('')}</div>`;
  const list=assetList(T);
  const catName = S.search ? `Search “${esc(S.search)}”` : (T.worlds?WP[S.world].name+' · ':'')+(T.cats.find(c=>c[0]===S.cat[S.tab])||[0,0,''])[2];
  h+=`<div class="label"><span>${catName}</span><b>${list.length}</b></div>`;
  if(!list.length) h+=`<div class="empty">${S.cat[S.tab]==='fav'&&!S.search?'No favourites yet. Tap the star on a tile.':'Nothing found. Try another word or world.'}</div>`;
  else h+=`<div class="grid">${list.map(d=>tileHTML(d.art||d.k, d.n, {on:S.armed&&S.armed.a===d.k&&S.armed.tab===S.tab, fav:S.favs.has(d.k), data:`data-arm="${d.k}" data-w="${d.w}"`, world:d.w, c:T.color})).join('')}</div>`;
  if(S.tab==='play') h+=`<p class="hint">Start and finish exist once per level. Coin paths are drawn along a curve.</p>`;
  if(S.tab==='obj') h+=`<p class="hint">Objects with the same system share their settings: bodies, zones, chains and bridges, breakables, joints.</p>`;
  return h;
}
function bgPane(){
  let h=`<div class="row"><span class="txt">Background</span>${b(S.bg.on?'eye':'eyeoff',{on:S.bg.on,c:'var(--k-bg)',title:'Background on/off',act:'bgon'})}</div>`;
  h+=worldsHTML(S.bg.world,'bgworld');
  h+=`<div class="label"><span>${WP[S.bg.world].name} · layers</span><b>${S.bg.layers.filter(l=>l.vis).length}/${S.bg.layers.length}</b></div><div class="layers">`;
  const w=WP[S.bg.world], th=[`linear-gradient(${w.sky[0]},${w.sky[1]})`,`linear-gradient(${w.sky[1]},#fff)`,w.far,w.mid,w.p.leaf2,w.p.leaf];
  S.bg.layers.forEach((l,i)=>{ const p=Math.round(l.depth/1.5*100); h+=`<div class="layer"><span class="th" style="background:${th[i]}"></span><span class="nmw"><b>${BG_LAYERS[i]}</b><input class="range" type="range" min="0" max="1.5" step=".01" value="${l.depth}" data-layer="${i}" style="--p:${p}%;--sc:var(--k-bg)" aria-label="${BG_LAYERS[i]} depth"></span>${b(l.vis?'eye':'eyeoff',{on:l.vis,c:'var(--k-bg)',title:'Show layer',act:'layervis',data:`data-v="${i}"`})}</div>`; });
  return h+`</div><p class="hint">Slide a layer to change how fast it moves behind the track.</p>`;
}
function texPane(){
  let h=worldsHTML(null,'texworld')+`<p class="hint">Pick a world to apply its full set, or choose each part below.</p><div class="slots">`;
  for(const [slot,label] of [['surface','Surface'],['band','Side band'],['fill','Fill']]){
    h+=`<div class="slot"><div class="label"><span>${label}</span><b>${esc(S.tex[slot])}</b></div><div class="grid">${MATERIALS[slot].map(([n,c])=>`<div class="tile ${S.tex[slot]===n?'on':''}" role="button" tabindex="0" data-tex="${slot}" data-v="${n}" title="${n}" style="--c:var(--k-tex);background:${c};background-image:repeating-linear-gradient(45deg,#ffffff18 0 4px,#0000 4px 9px)"><span class="nm" style="color:#fff;text-shadow:0 1px 0 #000">${n}</span></div>`).join('')}</div></div>`;
  }
  return h+'</div>';
}

// ---------- inspector ----------
const range = (key, min, max, step, val, unit, sc, label, icon) => { const p=Math.round((val-min)/(max-min)*100); return `<div class="row"><span class="lab" title="${label}">${ic(icon)}</span><input class="range" type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-k="${key}" style="--p:${p}%;--sc:${sc}" aria-label="${label}"><span class="val" data-val="${key}">${fmt(key,val)}${unit}</span></div>`; };
function fmt(k,v){ v=+v; if(k==='size') return v.toFixed(2).replace(/0$/,'')+'×'; if(k==='rot'||k==='angle') return Math.round(v)+'°'; if(k==='dy') return (v/40).toFixed(1)+' m'; if(['mass','bounce','fric','strength','swayAmt','persp','shade','width'].includes(k)) return Math.round(v*100)+'%'; return Math.round(v); }
function seg(key, opts, cur, c){ return `<div class="seg" style="--n:${opts.length}">${opts.map(([v,icn,l])=>`<button class="b ${cur===v?'on':''}" style="--c:${c}" data-seg="${key}" data-v="${v}" title="${l}">${ic(icn)}${l}</button>`).join('')}</div>`; }
function drawInspector(){
  const it=S.items.find(i=>i.id===S.sel), T=it?TABS[it.tab]:null;
  const rail=[['sel',it?(T.icon):'cursor',it?meta(it.tab,it.a).name:'Selection',it?T.color:'var(--accent)'],['level','layers','Level','#4cc9ff'],['look','map','Track look','#ffb03f'],['drive','car','Test drive','#ff7b54']];
  $('#rightRail').innerHTML = b(S.rightOpen?'chevr':'chevl',{cls:'plain',title:S.rightOpen?'Collapse inspector':'Open inspector',act:'rightToggle'})+rail.map(([k,icn,t,c])=>b(icn,{on:S.rightOpen&&S.rtab===k,c,title:t,act:'rtab',data:`data-v="${k}"`})).join('');
  $('#right').classList.toggle('closed',!S.rightOpen);
  if(!S.rightOpen){ $('#inspPane').innerHTML=''; return; }
  let h='';
  if(S.rtab==='sel'){
    if(!it){ h=`<div class="ph" style="--c:var(--accent)"><span class="ic">${ic('cursor')}</span><h3>Nothing selected</h3></div><div class="pbody"><div class="ibody solo"><p class="hint">Tap an object on the track to edit it, or pick something in the library and tap the track to place it.</p><div class="keys"><kbd>Del</kbd><span>Delete selection</span><kbd>Ctrl Z</kbd><span>Undo</span><kbd>Esc</kbd><span>Stop placing</span><kbd>Space</kbd><span>Test drive</span></div></div></div>`; }
    else {
      const c=T.color, name=meta(it.tab,it.a).name;
      const tabs = it.tab==='decor'?[['cursor','Place'],['sparkle','Effects'],['eye','Visibility']] : it.tab==='obj'?[['cursor','Place'],['weight','Physics'],['eye','Visibility']] : [['cursor','Place'],['eye','Visibility']];
      if(S.itab>=tabs.length) S.itab=0;
      h=`<div class="ph" style="--c:${c}"><span class="ic">${art(artKey(it),it.world||'meadow')}</span><h3>${esc(name)}</h3>${b('close',{title:'Deselect',act:'deselect'})}</div><div class="itabs" style="--c:${c}">${tabs.map(([icn,l],i)=>`<button class="itab ${S.itab===i?'on':''}" data-act="itab" data-v="${i}" title="${l}" aria-label="${l}">${ic(icn)}</button>`).join('')}</div><div class="ibody" style="--c:${c}">`;
      const tabName=tabs[S.itab][1];
      if(tabName==='Place'){
        if(it.tab==='decor') h+=seg('layer',[['behind','behind','Behind'],['front','front','Front'],['body','body','In ground']],it.layer,c);
        if(it.a==='coin') h+=seg('value',[[1,'coin','1'],[5,'coin','5'],[25,'coin','25']],it.value,c);
        if(it.a==='conveyor'||it.a==='turbo') h+=seg('dir',[[-1,'chevl','Left'],[1,'chevr','Right']],it.dir,c);
        h+=range('dy',0,320,1,it.dy,'',c,'Height above track','offset');
        if(it.tab!=='play') h+=range('size',.25,3,.05,it.size,'','#4cc9ff','Size','size');
        if(it.tab!=='play') h+=range('rot',-180,180,1,it.rot,'','#ffb03f','Rotation','rot');
        if(it.a==='bridge'||it.a==='chain') h+=range('length',2,30,1,it.length,' m','#b48cff','Length','link');
        if(['turbo','conveyor','spring','motorzone'].includes(it.a)) h+=range('strength',0,1,.01,it.strength,'','#ff7b54','Strength','speed');
        h+=`<div class="toggles">${it.tab==='decor'?b('tilt',{on:it.tilt,c:'#4cc9ff',title:'Tilt with slope',act:'tog',data:'data-v="tilt"'}):b('anchor',{title:'Snap to track',act:'snap'})}${b('flip',{on:it.flip,c:'#b48cff',title:'Mirror',act:'tog',data:'data-v="flip"'})}${b(it.vis?'eye':'eyeoff',{on:it.vis,c:'#ffd23f',title:'Visible in Edit',act:'tog',data:'data-v="vis"'})}${b('lock',{on:it.lock,c:'#ff7b54',title:'Lock',act:'tog',data:'data-v="lock"'})}</div>`;
        h+=`<div class="acts">${b('copy',{title:'Duplicate',act:'dup'})}${it.tab==='decor'?b('magic',{title:'Populate along the track',act:'populate'}):b('start',{title:'Centre view',act:'centre'})}${b('rot',{title:'Reset size and rotation',act:'resetxf'})}${b('trash',{cls:'del',title:'Delete (Del)',act:'del',dis:it.a==='start'||it.a==='finish'})}</div>`;
      } else if(tabName==='Effects'){
        h+=`<div class="row"><span class="lab">${ic('sway')}</span><span class="txt">Sway in the wind</span>${b('sway',{on:it.sway,c:c,title:'Sway',act:'tog',data:'data-v="sway"'})}</div>`;
        h+=range('swayAmt',0,1,.01,it.swayAmt,'',c,'Sway strength','sparkle');
        h+=`<div class="label"><span>Tint</span></div><div class="cats">${[null,'#ff7b54','#ffd23f','#4cc9ff','#b48cff','#0d0f13'].map(t=>`<button class="cat ${it.tint===t?'on':''}" style="--c:var(--accent);${t?`background:${t}`:''}" data-act="tint" data-v="${t||''}" aria-label="${t||'No tint'}">${t?'':ic('close')}</button>`).join('')}</div>`;
      } else if(tabName==='Physics'){
        h+=seg('mat',[['wood','crate','Wood'],['metal','weight','Metal'],['rubber','bounce','Rubber'],['stone','rock','Stone']],it.mat,c);
        h+=range('mass',0,1,.01,it.mass,'','#ff7b54','Weight','weight')+range('bounce',0,1,.01,it.bounce,'','#4cc9ff','Bounce','bounce')+range('fric',0,1,.01,it.fric,'','#ffb03f','Grip','friction');
        h+=`<p class="hint">Material presets set weight, bounce and grip together; sliders fine-tune them.</p>`;
      } else {
        h+=`<div class="row"><span class="lab">${ic('eye')}</span><span class="txt">Show in Edit</span>${b(it.vis?'eye':'eyeoff',{on:it.vis,c:'#ffd23f',title:'Show in Edit',act:'tog',data:'data-v="vis"'})}</div><div class="row"><span class="lab">${ic('layers')}</span><span class="txt">Draw order</span>${b('up',{title:'Bring forward',act:'order',data:'data-v="1"'})}${b('down',{title:'Send back',act:'order',data:'data-v="-1"'})}</div><div class="row"><span class="lab">${ic('lock')}</span><span class="txt">Lock position</span>${b('lock',{on:it.lock,c:'#ff7b54',title:'Lock',act:'tog',data:'data-v="lock"'})}</div>`;
      }
      h+='</div>';
    }
  } else if(S.rtab==='level'){
    const L=S.level; h=`<div class="ph" style="--c:#4cc9ff"><span class="ic">${ic('layers')}</span><h3>Level</h3></div><div class="pbody"><div class="ibody solo" style="--c:#4cc9ff"><label class="label"><span>Name</span></label><input class="field" id="lvlInput" value="${esc(L.name)}" maxlength="32">${range('speed',0,20,1,L.speed,' m/s','#4cc9ff','Start speed','speed')}${range('fuel',10,100,5,L.fuel,'%','#ff7b54','Starting fuel','fuel')}<div class="label"><span>Medal times (s)</span></div><div class="medals">${['#ffd23f','#c8d0dc','#d08a4a'].map((m,i)=>`<label class="medal"><i style="background:${m}"></i><input type="number" inputmode="decimal" data-medal="${i}" value="${L.medals[i]}" aria-label="Medal ${i+1}"></label>`).join('')}</div></div></div>`;
  } else if(S.rtab==='look'){
    const k=S.level.look; h=`<div class="ph" style="--c:#ffb03f"><span class="ic">${ic('map')}</span><h3>Track look</h3>${b('rot',{title:'Reset look',act:'resetlook'})}</div><div class="pbody"><div class="ibody solo" style="--c:#ffb03f">${seg('mode',[[0,'texture','Flat'],[1,'map','3D']],k.mode,'#ffb03f')}${range('width',0,2,.01,k.width,'','#ffb03f','Road width','size')}${range('persp',0,1,.01,k.persp,'','#4cc9ff','Perspective','eye')}${range('angle',0,60,1,k.angle,'','#b48cff','View angle','rot')}${range('shade',0,1,.01,k.shade,'','#6fd36b','Shading','sparkle')}</div></div>`;
  } else {
    const d=S.level.drive; h=`<div class="ph" style="--c:#ff7b54"><span class="ic">${ic('car')}</span><h3>Test drive</h3></div><div class="pbody"><div class="ibody solo" style="--c:#ff7b54">${seg('from',[[0,'flag','Start'],[1,'start','View'],[2,'checkpoint','Checkpoint']],d.from,'#ff7b54')}<div class="row"><span class="lab">${ic('brk')}</span><span class="txt">Crash ends the run</span>${b('check',{on:d.crash,c:'#ff7b54',title:'Crash reset',act:'drivetog',data:'data-v="crash"'})}</div><div class="row"><span class="lab">${ic('curve')}</span><span class="txt">Show last driven path</span>${b('check',{on:d.path,c:'#ff7b54',title:'Show path',act:'drivetog',data:'data-v="path"'})}</div><button class="b wide" data-act="play" style="--h:50px;background:var(--go);color:var(--ink)">${ic('play')}Drive from here</button></div></div>`;
  }
  $('#inspPane').innerHTML=h;
}

// ---------- minimap ----------
function drawMini(){
  const m=$('#mini'); m.hidden=!S.mini; if(!S.mini) return;
  const ms=$('#miniSvg'), mw=m.clientWidth, mh=m.clientHeight; ms.setAttribute('viewBox',`0 0 ${mw} ${mh}`);
  const sx=x=>x/WORLD_W*mw, b0=base(); const sy=y=>mh-6-(b0-y)*0.12;
  let d=`M0 ${mh}`; for(let x=0;x<=WORLD_W;x+=40) d+=` L${sx(x).toFixed(1)} ${sy(trackY(x)).toFixed(1)}`; d+=` L${mw} ${mh}Z`;
  let s=`<path d="${d}" fill="${(MATERIALS.surface.find(q=>q[0]===S.tex.surface)||[0,'#7ccf5a'])[1]}" stroke="${INK}" stroke-width="1.5"/>`;
  for(const it of S.items){ const col={play:'#ffd23f',obj:'#ff6fae',decor:'#ffffffaa',track:'#4cc9ff'}[it.tab]; s+=`<circle cx="${sx(it.x)}" cy="${sy(trackY(it.x)-it.dy*0.5)-3}" r="${it.id===S.sel?3.5:2.2}" fill="${it.id===S.sel?'#fff':col}"/>`; }
  ms.innerHTML=s;
  const win=$('#miniWin'); win.style.left=sx(S.cam.x)+'px'; win.style.width=Math.max(10,sx(W()/S.cam.z))+'px';
}

function render(){ drawLevel(); drawBars(); drawLibrary(); drawInspector(); drawMini(); $('#app').classList.toggle('playing',S.playing); svg.classList.toggle('arming',!!S.armed); svg.classList.toggle('panning',S.tool==='pan'); }

// ---------- actions ----------
function clampCam(){ S.cam.x=Math.max(-200,Math.min(WORLD_W-W()/S.cam.z+200,S.cam.x)); }
function zoom(f, cx=W()/2){ const wx=cx/S.cam.z+S.cam.x; S.cam.z=Math.max(.4,Math.min(2.5,+(S.cam.z*f).toFixed(2))); S.cam.x=wx-cx/S.cam.z; clampCam(); render(); }
function select(id){ S.sel=id; if(id!=null){ S.rtab='sel'; S.rightOpen=true; } render(); }
function arm(tab, a, w){
  if(S.armed && S.armed.a===a && S.armed.tab===tab){ disarm(); return; }
  if((a==='start'||a==='finish') && S.items.some(i=>i.a===a)){ const ex=S.items.find(i=>i.a===a); select(ex.id); S.cam.x=ex.x-W()/2/S.cam.z; clampCam(); toast(`${meta(tab,a).name} exists once · selected it`,'flag','var(--k-play)'); render(); return; }
  S.armed={tab,a,w}; S.tool='select'; render(); toast(`Tap the track to place ${meta(tab,a).name} · tap the tile again to stop`,'cursor',TABS[tab].hex);
}
function disarm(){ S.armed=null; $('#toast').hidden=true; render(); }
function place(wx){
  const A=S.armed; begin();
  const o={world:A.w||'meadow'}; if(isPickup(A.a)) o.dy=A.a==='coinpath'?90:40; if(A.tab==='obj'&&['metalcrate','steelball'].includes(A.a)) o.mat='metal';
  if(A.a==='bridge'||A.a==='chain') o.dy=A.a==='chain'?140:20;
  const it=item(A.a,A.tab,Math.round(wx),o); S.items.push(it); S.sel=it.id; S.rtab='sel'; S.itab=0;
  commit(); toast(`${meta(A.tab,A.a).name} placed · tap again to place more`,'check','var(--go)'); clearTimeout(toastT);
}
function startPlay(){
  if(S.playing) return stopPlay();
  const st=S.items.find(i=>i.a==='start'), fin=S.items.find(i=>i.a==='finish');
  const from = S.level.drive.from===1 ? S.cam.x+W()/S.cam.z*0.3 : (st?st.x:0);
  S.playing=true; S.sel=null; S.armed=null; S.got={coins:0}; S.car={x:from}; const t0=performance.now(), x0=from, x1=fin?fin.x:WORLD_W-100, dur=Math.max(2500,(x1-x0)*2.2);
  const hid=[];
  const step=t=>{ if(!S.playing) return; const k=Math.min(1,(t-t0)/dur); S.car.x=x0+(x1-x0)*(k*k*(3-2*k)*.3+k*.7); S.cam.x=S.car.x-W()*0.35/S.cam.z; clampCam();
    for(const it of S.items){ if(!it._hidden && isPickup(it.a) && Math.abs(it.x-S.car.x)<30){ it._hidden=true; hid.push(it); if(it.a!=='gem'&&it.a!=='fuel') S.got.coins+=it.a==='coin'?it.value:5; } }
    render(); if(k<1) S.raf=requestAnimationFrame(step); else { const secs=(dur/1000*4.1).toFixed(2); stopPlay(); toast(`Finished in ${secs} s · ${S.got.coins} coins`,'flag','var(--go)'); } };
  S.unhide=()=>hid.forEach(i=>delete i._hidden);
  S.raf=requestAnimationFrame(step); render();
}
function stopPlay(){ S.playing=false; cancelAnimationFrame(S.raf); S.unhide&&S.unhide(); S.car=null; render(); }
function modal(title, color, icon, body){ $('#sheet').innerHTML=`<div class="ph" style="--c:${color}"><span class="ic">${ic(icon)}</span><h3>${title}</h3>${b('close',{title:'Close',act:'closemodal'})}</div><div class="pbody">${body}</div>`; $('#modal').hidden=false; }
function closeModal(){ $('#modal').hidden=true; }

const ACT = {
  tool:v=>{ S.tool=v; S.armed=null; const hints={select:'Tap to select · drag to move',line:'Tap points along the track to draw a line',curve:'Drag to bend a curve between two points',brush:'Drag over the ground to raise it · hold Alt to lower',pan:'Drag the view · scroll to zoom'}; render(); toast(hints[v],({select:'cursor',line:'pencil',curve:'curve',brush:'brush',pan:'hand'})[v],'var(--accent)'); },
  undo, redo, play:startPlay,
  save:()=>{ S.saved=true; S.versions.unshift({t:'Auto · just now'}); render(); toast('Saved','save','var(--go)'); },
  versions:()=>modal('Versions','var(--accent)','history',S.versions.map((v,i)=>`<div class="vrow"><span class="dot ${v.named?'named':''}"></span><span>${esc(v.t)}<small>${i===0?'Newest':'Tap Restore to go back to this state'}</small></span>${b('rot',{title:'Restore',act:'restore',data:`data-v="${i}"`})}</div>`).join('')+`<button class="b wide" data-act="namedsnap" style="--h:46px">${ic('plus')}Save a named version</button>`),
  restore:v=>{ closeModal(); toast(`Restored “${S.versions[v].t}” (prototype: no change)`,'history','var(--accent)'); },
  namedsnap:()=>{ S.versions.unshift({t:'Named · '+new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}),named:true}); ACT.versions(); render(); },
  share:()=>modal('Share level','#4cc9ff','share',`<p class="hint">Others can open this level with the code.</p><div class="vrow"><span class="dot named"></span><span style="font:900 18px var(--body);letter-spacing:.08em">RDR-7Q4K-M2</span>${b('copy',{title:'Copy code',act:'copycode'})}</div><button class="b wide" data-act="export" style="--h:46px">${ic('save')}Export file</button>`),
  copycode:()=>{ try{navigator.clipboard.writeText('RDR-7Q4K-M2');}catch(e){} toast('Code copied','copy','var(--go)'); },
  export:()=>{ closeModal(); toast('Exported meadow-run.json (prototype)','save','var(--go)'); },
  help:()=>modal('Help','#4cc9ff','help',`<div class="keys"><kbd>Space</kbd><span>Test drive / stop</span><kbd>Ctrl Z / Y</kbd><span>Undo / redo</span><kbd>Del</kbd><span>Delete selection</span><kbd>Esc</kbd><span>Stop placing, deselect</span><kbd>Wheel</kbd><span>Scroll the level · Ctrl + wheel zooms</span><kbd>[ ]</kbd><span>Fold library / inspector</span></div>`),
  menu:()=>modal('Menu','var(--accent)','menu',`<div class="menu-grid">${[['plus','New level'],['list','Open level'],['share','Import'],['save','Export'],['sparkle','Settings'],['car','Back to game']].map(([i,t])=>`<button class="b" data-act="menuitem" data-v="${t}" style="--h:64px">${ic(i)}${t}</button>`).join('')}</div>`),
  menuitem:v=>{ closeModal(); toast(`${v} (prototype)`,'menu','var(--accent)'); },
  closemodal:closeModal,
  fit:()=>{ S.cam.z=Math.max(.4,W()/(WORLD_W+400)); S.cam.x=-200; render(); toast('Whole level','fit'); },
  gostart:()=>{ const st=S.items.find(i=>i.a==='start'); S.cam.x=(st?st.x:0)-W()*0.3/S.cam.z; clampCam(); render(); },
  grid:()=>{ S.grid=!S.grid; render(); }, mini:()=>{ S.mini=!S.mini; render(); },
  zin:()=>zoom(1.2), zout:()=>zoom(1/1.2),
  tab:v=>{ if(S.tab===v && S.leftOpen){ S.leftOpen=false; } else { S.tab=v; S.leftOpen=true; S.search=''; } render(); },
  leftToggle:()=>{ S.leftOpen=!S.leftOpen; render(); }, rightToggle:()=>{ S.rightOpen=!S.rightOpen; render(); },
  objects:()=>modal('Level objects','var(--accent)','list',S.items.map(it=>`<div class="vrow"><span class="dot" style="background:${TABS[it.tab].hex}"></span><span>${esc(meta(it.tab,it.a).name)}<small>${Math.round(it.x/40)} m · ${TABS[it.tab].name}</small></span>${b('start',{title:'Go to',act:'goto',data:`data-v="${it.id}"`})}</div>`).join('')),
  goto:v=>{ closeModal(); const it=S.items.find(i=>i.id==v); S.cam.x=it.x-W()/2/S.cam.z; clampCam(); select(it.id); },
  rtab:v=>{ if(S.rtab===v && S.rightOpen){ S.rightOpen=false; } else { S.rtab=v; S.rightOpen=true; } render(); },
  itab:v=>{ S.itab=+v; render(); },
  world:v=>{ S.world=v; S.search=''; if(S.cat.decor!=='fav' && !DECOR_SETS[v].some(d=>d[2]===S.cat.decor)) S.cat.decor=DECOR_SETS[v][0][2]; render(); },
  cat:v=>{ S.cat[S.tab]=v; S.search=''; render(); },
  favcat:()=>{ S.cat[S.tab]=S.cat[S.tab]==='fav'?(S.tab==='decor'?'plants':'all'):'fav'; S.search=''; render(); },
  clearsearch:()=>{ S.search=''; S._focusSearch=true; render(); S._focusSearch=false; },
  bgon:()=>{ begin(); S.bg.on=!S.bg.on; commit(); },
  bgworld:v=>{ begin(); S.bg.world=v; commit(`Background: ${WP[v].name}`); },
  layervis:v=>{ begin(); S.bg.layers[v].vis=!S.bg.layers[v].vis; commit(); },
  texworld:v=>{ begin(); const map={meadow:['grass','dirt','earth'],quarry:['sand','clay','stone'],volcano:['lava','basalt','magma'],city:['asphalt','brick','concrete'],glacier:['snow','ice','ice']}[v]; [S.tex.surface,S.tex.band,S.tex.fill]=map; commit(`Ground: ${WP[v].name}`); },
  deselect:()=>select(null),
  tog:v=>{ const it=S.items.find(i=>i.id===S.sel); begin(); it[v]=!it[v]; commit(); },
  snap:()=>{ const it=S.items.find(i=>i.id===S.sel); begin(); it.dy=0; it.rot=0; commit('Snapped to track'); },
  dup:()=>{ const it=S.items.find(i=>i.id===S.sel); begin(); const c={...it,id:uid++,x:it.x+70}; S.items.push(c); S.sel=c.id; commit('Duplicated'); },
  populate:()=>{ const it=S.items.find(i=>i.id===S.sel); begin(); for(let k=1;k<=5;k++) S.items.push({...it,id:uid++,x:it.x+k*(90+((k*37)%40)),size:+(it.size*(0.8+((k*13)%5)/10)).toFixed(2)}); commit('Populated 5 copies along the track'); },
  centre:()=>{ const it=S.items.find(i=>i.id===S.sel); S.cam.x=it.x-W()/2/S.cam.z; clampCam(); render(); },
  resetxf:()=>{ const it=S.items.find(i=>i.id===S.sel); begin(); it.size=1; it.rot=0; it.flip=false; commit('Size and rotation reset'); },
  del:()=>{ const it=S.items.find(i=>i.id===S.sel); if(!it||it.a==='start'||it.a==='finish') return; begin(); S.items=S.items.filter(i=>i.id!==S.sel); S.sel=null; commit('Deleted'); },
  order:v=>{ const it=S.items.find(i=>i.id===S.sel); begin(); const L=['behind','body','front']; it.layer=L[Math.max(0,Math.min(2,L.indexOf(it.layer)+ +v))]; commit(); },
  tint:v=>{ const it=S.items.find(i=>i.id===S.sel); begin(); it.tint=v||null; commit(); },
  resetlook:()=>{ begin(); S.level.look={mode:1,width:.9,persp:.35,angle:29,side:64,shade:1}; commit('Look reset'); },
  drivetog:v=>{ S.level.drive[v]=!S.level.drive[v]; render(); },
};

// ---------- events ----------
document.addEventListener('click', e=>{
  const fav=e.target.closest('[data-fav]'); if(fav){ e.stopPropagation(); const k=fav.dataset.fav; S.favs.has(k)?S.favs.delete(k):S.favs.add(k); render(); return; }
  const a=e.target.closest('[data-act]'); if(a){ if(a.disabled) return; const fn=ACT[a.dataset.act]; if(fn) fn(a.dataset.v); return; }
  const s=e.target.closest('[data-seg]'); if(s){ const k=s.dataset.seg, raw=s.dataset.v, v=isNaN(+raw)?raw:+raw; begin(); if(k==='mode') S.level.look.mode=v; else if(k==='from') { S.level.drive.from=v; S._pre=null; render(); return; } else { const it=S.items.find(i=>i.id===S.sel); it[k]=v; if(k==='mat'){ const pr={wood:[.4,.3,.5],metal:[.9,.1,.4],rubber:[.3,.85,.8],stone:[.8,.15,.6]}[v]; [it.mass,it.bounce,it.fric]=pr; } } commit(); return; }
  const t=e.target.closest('[data-arm]'); if(t){ arm(S.tab,t.dataset.arm,t.dataset.w); return; }
  const x=e.target.closest('[data-tex]'); if(x){ begin(); S.tex[x.dataset.tex]=x.dataset.v; commit(); return; }
  if(e.target===$('#modal')) closeModal();
});
document.addEventListener('keydown', e=>{
  if(e.target.matches('input')){ if(e.key==='Escape') e.target.blur(); return; }
  const k=e.key.toLowerCase();
  if((e.ctrlKey||e.metaKey)&&k==='z'){ e.preventDefault(); e.shiftKey?redo():undo(); }
  else if((e.ctrlKey||e.metaKey)&&k==='y'){ e.preventDefault(); redo(); }
  else if((e.ctrlKey||e.metaKey)&&k==='s'){ e.preventDefault(); ACT.save(); }
  else if(k==='delete'||k==='backspace') ACT.del();
  else if(k==='escape'){ if(!$('#modal').hidden) closeModal(); else if(S.playing) stopPlay(); else if(S.armed) disarm(); else select(null); }
  else if(k===' '){ e.preventDefault(); startPlay(); }
  else if(k==='['){ ACT.leftToggle(); } else if(k===']'){ ACT.rightToggle(); }
  else if(e.target.matches('.tile')&&(k==='enter')) e.target.click();
});
document.addEventListener('input', e=>{
  const t=e.target;
  if(t.id==='search'){ S.search=t.value; S._focusSearch=true; drawLibrary(); S._focusSearch=false; return; }
  if(t.id==='lvlInput'){ S.level.name=t.value||'Untitled'; S.saved=false; drawBars(); return; }
  if(t.dataset.medal!=null){ S.level.medals[t.dataset.medal]=+t.value; S.saved=false; return; }
  if(t.matches('.range')){
    const p=(t.value-t.min)/(t.max-t.min)*100; t.style.setProperty('--p',p+'%');
    if(S._pre==null) begin();
    if(t.dataset.layer!=null){ S.bg.layers[t.dataset.layer].depth=+t.value; drawLevel(); return; }
    const k=t.dataset.k, v=+t.value;
    if(S.rtab==='sel'){ const it=S.items.find(i=>i.id===S.sel); it[k]=v; }
    else if(S.rtab==='level') S.level[k]=v; else if(S.rtab==='look') S.level.look[k]=v;
    const out=document.querySelector(`[data-val="${k}"]`); if(out) out.textContent=fmt(k,v)+(k==='speed'?' m/s':k==='fuel'?'%':'');
    drawLevel(); drawMini();
  }
});
document.addEventListener('change', e=>{ if(e.target.matches('.range')&&S._pre!=null){ commit(); } });

// canvas pointer: place, select, drag, pan
let drag=null;
svg.addEventListener('pointerdown', e=>{
  if(S.playing) return;
  const p=toWorld(e.offsetX,e.offsetY); const g=e.target.closest('.it');
  if(S.armed && !g){ place(p.x); return; }
  if(g && S.tool==='select'){ const id=+g.dataset.id, it=S.items.find(i=>i.id===id); select(id); if(it.lock){ toast('Locked · unlock to move','lock','#ff7b54'); return; } drag={mode:'item', it, sx:e.clientX, sy:e.clientY, x0:it.x, dy0:it.dy, moved:false}; svg.setPointerCapture(e.pointerId); return; }
  drag={mode:'pan', sx:e.clientX, cx:S.cam.x, moved:false, tap:!g}; svg.setPointerCapture(e.pointerId);
});
svg.addEventListener('pointermove', e=>{
  if(!drag) return; const dx=(e.clientX-drag.sx)/S.cam.z;
  if(Math.abs(e.clientX-drag.sx)+Math.abs(e.clientY-(drag.sy??e.clientY))>4 && !drag.moved){ drag.moved=true; if(drag.mode==='item') begin(); }
  if(!drag.moved) return;
  if(drag.mode==='item'){ drag.it.x=Math.round(drag.x0+dx); if(drag.it.tab!=='decor'||drag.it.dy>0) drag.it.dy=Math.max(0,Math.round(drag.dy0-(e.clientY-drag.sy)/S.cam.z)); drawLevel(); drawMini(); }
  else { S.cam.x=drag.cx-dx; clampCam(); drawLevel(); drawMini(); }
});
svg.addEventListener('pointerup', ()=>{ if(!drag) return; if(drag.mode==='item'&&drag.moved) commit(); else if(drag.mode==='pan'&&!drag.moved&&drag.tap&&S.tool==='select') select(null); else if(drag.mode==='pan') render(); drag=null; });
svg.addEventListener('wheel', e=>{ e.preventDefault(); if(e.ctrlKey) zoom(e.deltaY<0?1.1:1/1.1, e.offsetX); else { S.cam.x+=(e.deltaX||e.deltaY)/S.cam.z; clampCam(); drawLevel(); drawMini(); } }, {passive:false});
// minimap drag
const mini=$('#mini'); let md=false;
const miniMove=e=>{ const r=mini.getBoundingClientRect(); const wx=(e.clientX-r.left)/r.width*WORLD_W; S.cam.x=wx-W()/2/S.cam.z; clampCam(); drawLevel(); drawMini(); };
mini.addEventListener('pointerdown', e=>{ md=true; mini.setPointerCapture(e.pointerId); miniMove(e); });
mini.addEventListener('pointermove', e=>{ if(md) miniMove(e); });
mini.addEventListener('pointerup', ()=>{ md=false; render(); });
$('#stop').addEventListener('click', stopPlay);
addEventListener('resize', render);
if(innerWidth<900||innerHeight<520){ S.rightOpen=false; }
render();
toast('Prototype · nothing is saved to the game','sparkle','var(--accent)');
})();
