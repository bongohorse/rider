// #444 FPS counter ON/OFF and position, debug Gym case `fps444` (real Defold HTML5 debug build, real mouse and
// touch input, the real Menu DOM). On Straight at 1280x720 (desktop) and 1080x486 (phone, touch controls):
// - a mouse drag and a touch drag move the counter and store its normalised position; both survive a reload;
// - a press with less than 10 CSS px travel is still a tap and switches the cap; a drag never changes the cap;
// - drags record no drive command on any fixed tick (A21 recording) and the car stays at rest; a drop on the DOM
//   Levels button leaves the keys with the game; finger 2 drags and lifts alone while finger 1 holds Throttle;
// - at device pixel ratio 2.75 a 9 CSS px press is a tap and a 12 px press a drag;
// - Menu: ON/OFF survives a reload (OFF also disables the tap), the nine presets, Reset returns to top left;
// - every placement stays inside the canvas and clear of pause, drive and the other controls (also the editor's
//   Terrain Look button), also after a resolution change and a rotation, and the stored position is unchanged.
'use strict';
const assert=require('node:assert/strict');
const STATION='straight', THRESHOLD_CSS_PX=10, TOL_PX=1.5;
// Mirror of main/game/fps_place.lua PRESETS (x 0 left .. 1 right, y 0 top .. 1 bottom).
const PRESETS={top_left:[0,0],top:[0.5,0],top_right:[1,0],left:[0,0.5],center:[0.5,0.5],right:[1,0.5],
 bottom_left:[0,1],bottom:[0.5,1],bottom_right:[1,1]};
function parseArgs(args){
 const usage='Usage: node tools/gym/fps444.cjs OUT SHA RUN_ID fps444 VERIFIED_DEBUG_BUNDLE';
 if(!Array.isArray(args)||args.length!==5||args.some(v=>typeof v!=='string'||!v)||args[3]!=='fps444')throw Error(usage);
 return {output:args[0],sha:args[1],runId:args[2],bundle:args[4]};
}
// Normalised position of a placed counter rectangle inside the area (screen pixels, origin bottom left).
function normalised(rect,area){
 const rx=Math.max(0,area.x1-area.x0-(rect.x1-rect.x0)),ry=Math.max(0,area.y1-area.y0-(rect.y1-rect.y0));
 return {x:rx>0?(rect.x0-area.x0)/rx:0,y:ry>0?(area.y1-rect.y1)/ry:0};
}
// Where the stored pair puts the counter before keeping clear of controls, and whether a control is there (the game
// then moves it the shortest way off; otherwise it must sit exactly at the stored position). Screen pixels.
function storedRect(place){
 const r=place.rect,a=place.area,w=r.x1-r.x0,h=r.y1-r.y0;
 const left=a.x0+place.x*Math.max(0,a.x1-a.x0-w),top=a.y1-place.y*Math.max(0,a.y1-a.y0-h);
 return {x0:left,y0:top-h,x1:left+w,y1:top};
}
function displaced(place,gapCss=4){
 const r=storedRect(place),gap=gapCss*(place.pixel_ratio||1)-0.01;
 return (place.blocked||[]).some(b=>r.x0<b.x1+gap&&r.x1>b.x0-gap&&r.y0<b.y1+gap&&r.y1>b.y0-gap);
}
const overlap=(a,b,tol=0.5)=>a.left<b.right-tol&&a.right>b.left+tol&&a.top<b.bottom-tol&&a.bottom>b.top+tol;
const contains=(r,p)=>p.x>r.left&&p.x<r.right&&p.y>r.top&&p.y<r.bottom;
// One placement snapshot (CSS pixels): inside the canvas, clear of every control, measured where it was placed.
function verifyPlacement(s,label){
 const c=s.canvas,r=s.place&&s.place.css;
 assert(r&&[r.left,r.top,r.right,r.bottom].every(Number.isFinite),label+': no counter placement');
 assert(r.left>=c.left-0.5&&r.top>=c.top-0.5&&r.right<=c.right+0.5&&r.bottom<=c.bottom+0.5,
  `${label}: counter ${JSON.stringify(r)} leaves the canvas ${JSON.stringify(c)}`);
 assert.equal(s.place.clear,true,label+': the game found no clear position');
 for(const d of s.dom)assert(!overlap(r,d),`${label}: counter ${JSON.stringify(r)} covers ${d.name} ${JSON.stringify(d)}`);
 for(const g of s.gui){
  assert(!overlap(r,g),`${label}: counter ${JSON.stringify(r)} covers the GUI button ${g.name} ${JSON.stringify(g)}`);
  assert(s.place.blocked_css.some(b=>['left','top','right','bottom'].every(k=>Math.abs(b[k]-g[k])<=TOL_PX)),`${label}: the game does not avoid the GUI button ${g.name}`);
 }
 // The tap area really is where the game placed it (node rectangle and HUD corner probes).
 for(const [name,q] of [['tap area node',s.place.hit_css],['corner probes',s.hud_css]]){
  assert(q,label+': missing '+name);
  for(const k of ['left','top','right','bottom'])assert(Math.abs(q[k]-r[k])<=TOL_PX,`${label}: ${name} ${k} ${q[k]} differs from the placement ${r[k]}`);
 }
 // Every DOM control found here is one the game keeps clear of (pause and drive buttons included).
 for(const d of s.dom)assert(s.place.blocked_css.some(b=>['left','top','right','bottom'].every(k=>Math.abs(b[k]-d[k])<=TOL_PX)),
  `${label}: the game does not avoid ${d.name}`);
 return {left:r.left-c.left,top:r.top-c.top,width:r.right-r.left,height:r.bottom-r.top};
}
// A drag's recording: cleanly stopped and without any drive command.
function verifyNoDrive(recording,label){
 assert(recording&&recording.ended==='stopped'&&recording.error===false,label+': recording not cleanly stopped');
 assert(Number.isSafeInteger(recording.ticks)&&recording.ticks>=60,label+': recording too short');
 assert.deepEqual(recording.commands,{throttle:0,brake:0,lean:0},label+': a counter drag or tap produced drive input');
 return {ticks:recording.ticks,commands:recording.commands};
}
const near=(a,b,tol=TOL_PX)=>Math.abs(a-b)<=tol;
module.exports={parseArgs,normalised,storedRect,displaced,overlap,contains,verifyPlacement,verifyNoDrive,PRESETS,THRESHOLD_CSS_PX,STATION};
if(require.main===module){
 const {configure}=require('./launch.cjs');
 const pointer=require('./pointer.cjs');
 const storage=require('./storage.cjs');
 const {chromium}=require('playwright');
 const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
 const {output,sha,runId,bundle}=parseArgs(process.argv.slice(2));
 const out=path.resolve(output);fs.mkdirSync(out,{recursive:true});
 fs.rmSync(path.join(out,'fps444-result.json'),{force:true});
 const metadata=JSON.parse(fs.readFileSync(path.join(bundle,'bundle.json'),'utf8'));
 assert(metadata.variant==='debug'&&metadata.platform==='wasm-web'&&metadata.source_sha===sha,'Wrong Defold debug bundle');
 function find(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()){const v=find(p);if(v)return v;}else if(e.name==='index.html')return p;}}
 const index=find(path.resolve(bundle));assert(index,'No Defold index.html in bundle');
 const web=path.dirname(index);
 const server=http.createServer((req,res)=>{
  const file=path.resolve(web,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(web+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.wasm')?'application/wasm':file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':'text/html');
  fs.createReadStream(file).pipe(res);
 });
 (async()=>{
  let browser,page,phone,dense;const errors=[],cases={},evidence={placements:[]};
  const watch=p=>{p.on('pageerror',e=>{if(errors.length<20)errors.push(e.message);});
   p.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text())&&errors.length<20)errors.push(m.text());});};
  const FRAMES='window.riderReplay.frames';
  try{
   await new Promise(r=>server.listen(0,'127.0.0.1',r));
   const url='http://127.0.0.1:'+server.address().port+'/index.html?station='+STATION;
   browser=await chromium.launch();
   const desktop=await browser.newContext({viewport:{width:1280,height:720}});
   page=await desktop.newPage();watch(page);
   await configure(page,runId,'fps444');
   async function ready(p){
    await p.waitForFunction(({sha,runId})=>window.riderReady?.source_sha===sha&&window.riderReady?.run_id===runId&&
     window.riderReplay?.frames>10&&window.riderFpsCounter?.pos_seq>=1&&window.riderFpsPlace?.rect&&window.riderHud?.fps_rect,
     {sha,runId},{polling:100,timeout:30000});
    await settle(p);
   }
   // Everything the checks need, in CSS pixels: the placement, the canvas, DOM controls (drive zones, toolbar with
   // Pause, level actions, page buttons) found independently of the game, and the visible desktop GUI buttons.
   const state=p=>p.evaluate(()=>{
    const c=document.querySelector('canvas'),r=c.getBoundingClientRect(),P=window.riderFpsPlace,H=window.riderHud||{};
    const css=q=>q&&({left:r.x+q.x0/c.width*r.width,right:r.x+q.x1/c.width*r.width,top:r.y+(1-q.y1/c.height)*r.height,bottom:r.y+(1-q.y0/c.height)*r.height});
    const pt=q=>q&&({x:r.x+q.x/c.width*r.width,y:r.y+(1-q.y/c.height)*r.height});
    const dom=[];
    for(const [sel,kind] of [['#rider-mobile [data-command]','drive'],['#rider-mobile .toolbar > button','toolbar'],['#rider-level-actions button','level'],['#page-tools button','page']]){
     for(const e of document.querySelectorAll(sel)){
      const b=e.getBoundingClientRect();
      if(b.width>0&&b.height>0&&getComputedStyle(e).visibility==='visible')dom.push({name:kind+':'+(e.dataset.command||e.textContent.trim()),left:b.left,top:b.top,right:b.right,bottom:b.bottom});
     }
    }
    // The editor GUI's play-mode Terrain Look button (editor_ui.lua: x 560, 56 units above the bottom, 112x32,
    // scaled by min(1, CSS width / 1280)), drawn while driving on desktop and phone.
    if(!window.riderEditing){const k=Math.min(1,r.width/1280);
     dom.push({name:'editor:Terrain Look',left:r.x+560*k,right:r.x+672*k,top:r.y+r.height-56*k,bottom:r.y+r.height-24*k});}
    const touch=!!window.riderMobile?.enabled;
    let hud=null;
    if(H.fps_rect){const a=pt(H.fps_rect.top_left),b=pt(H.fps_rect.bottom_right);hud={left:Math.min(a.x,b.x),right:Math.max(a.x,b.x),top:Math.min(a.y,b.y),bottom:Math.max(a.y,b.y)};}
    // Desktop GUI buttons as rectangles: authored sizes (ui.gui_script, units x 24) in the same left_top root as the
    // counter's 112-unit tap area, so its measured width gives CSS px per unit.
    const unit=hud?(hud.right-hud.left)/112:0;
    const gui=touch||!unit?[]:[['pause',92],['step',100],['record',84],['replay',84]].filter(([k])=>H[k]).map(([k,w])=>{const c=pt(H[k]);
     return {name:k,left:c.x-w*unit/2,right:c.x+w*unit/2,top:c.y-12*unit,bottom:c.y+12*unit};});
    return {canvas:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:c.width,height:c.height},touch,
     place:P&&{...P,css:css(P.rect),hit_css:css(P.hit_rect),blocked_css:(P.blocked||[]).map(css)},hud_css:hud,
     counter:window.riderFpsCounter?{...window.riderFpsCounter}:null,dom,gui,x:window.riderReplay?.x};
   });
   // Placement follows the 0.1 s HUD poll: wait until the corner probes agree with the latest placement twice.
   async function settle(p){
    await p.waitForTimeout(350);
    await p.waitForFunction(tol=>{
     const c=document.querySelector('canvas'),r=c.getBoundingClientRect(),P=window.riderFpsPlace,H=window.riderHud;
     if(!P?.rect||!H?.fps_rect)return false;
     const y=v=>r.y+(1-v/c.height)*r.height,x=v=>r.x+v/c.width*r.width;
     return Math.abs(x(H.fps_rect.top_left.x)-x(P.rect.x0))<=tol&&Math.abs(y(H.fps_rect.top_left.y)-y(P.rect.y1))<=tol;
    },TOL_PX,{polling:100,timeout:5000});
    await pointer.frames(p,{counter:FRAMES,n:3,label:'settle'});
   }
   async function check(p,label){
    const s=await state(p);const at=verifyPlacement(s,label);
    const n=normalised(s.place.rect,s.place.area),moved=displaced(s.place);
    assert(s.place.x===s.counter.x&&s.place.y===s.counter.y,label+': placement and stored position disagree');
    if(!moved)assert(Math.abs(n.x-s.counter.x)<1e-3&&Math.abs(n.y-s.counter.y)<1e-3,
     `${label}: counter at ${JSON.stringify(n)}, not at its stored position ${s.counter.x},${s.counter.y} (no control there)`);
    evidence.placements.push({label,css:at,stored:{x:s.counter.x,y:s.counter.y},placed:n,displaced_by_control:moved,visible:s.counter.visible});
    return {s,at,n,moved};
   }
   const centre=r=>({x:(r.left+r.right)/2,y:(r.top+r.bottom)/2});
   const counter=p=>p.evaluate(()=>({...window.riderFpsCounter}));
   async function waitStored(p,seq,label){
    await p.waitForFunction(seq=>window.riderFpsCounter?.pos_seq>seq,seq,{polling:50,timeout:5000}).catch(e=>{throw Error(label+': position not stored ('+e.message.split('\n')[0]+')');});
    const c=await counter(p);assert.equal(c.pos_saved,true,label+': position not written to player settings');
    await settle(p);return c;
   }
   async function waitCap(p,seq,cap,label){
    await p.waitForFunction(({seq,cap})=>window.riderFpsCounter?.cap_seq>seq&&window.riderFpsCounter.cap===cap,{seq,cap},{polling:50,timeout:5000})
     .catch(e=>{throw Error(label+': cap did not switch to '+cap+' ('+e.message.split('\n')[0]+')');});
   }
   // Real mouse drag: move, press, several moves, release, each in its own engine frames (engine pitfall 5).
   async function mouseDrag(p,from,to,steps=8){
    await p.mouse.move(from.x,from.y);await pointer.frames(p,{counter:FRAMES,label:'drag move'});
    await p.mouse.down();await pointer.frames(p,{counter:FRAMES,label:'drag press'});
    for(let i=1;i<=steps;i++){await p.mouse.move(from.x+(to.x-from.x)*i/steps,from.y+(to.y-from.y)*i/steps);await pointer.frames(p,{counter:FRAMES,n:1,label:'drag step'});}
    await pointer.frames(p,{counter:FRAMES,label:'drag hold'});
    await p.mouse.up();await pointer.frames(p,{counter:FRAMES,label:'drag release'});
   }
   // Real touch drag on the canvas through CDP (the same path as a finger: touchstart/move/end on the canvas).
   async function touchDrag(p,session,from,to,steps=8){
    const target=await p.evaluate(({x,y})=>document.elementFromPoint(x,y)?.id||document.elementFromPoint(x,y)?.tagName,from);
    assert.equal(target,'canvas','A DOM overlay covers the counter where the finger starts');
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:from.x,y:from.y,id:1}]});
    try{
     await pointer.frames(p,{counter:FRAMES,label:'touch press'});
     for(let i=1;i<=steps;i++){
      await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*i/steps,y:from.y+(to.y-from.y)*i/steps,id:1}]});
      await pointer.frames(p,{counter:FRAMES,n:1,label:'touch step'});
     }
     await pointer.frames(p,{counter:FRAMES,label:'touch hold'});
    }finally{await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
    await pointer.frames(p,{counter:FRAMES,label:'touch release'});
   }
   async function record(p,on){
    if(on){const n=(await p.evaluate(()=>window.riderReplay.resets));await p.keyboard.down('b');await p.waitForFunction(n=>window.riderReplay?.recording?.active&&window.riderReplay.resets===n+1,n);await p.keyboard.up('b');}
    else{await p.waitForFunction(()=>window.riderReplay?.recording?.ticks>=60,null,{polling:50,timeout:10000});
     await p.keyboard.down('b');await p.waitForFunction(()=>window.riderReplay?.recording?.active===false);await p.keyboard.up('b');
     return p.evaluate(()=>window.riderReplay.recording);}
   }
   const menuButton=(p,sel)=>p.locator('#rider-levels '+sel);
   const resetButton=p=>p.locator('#rider-levels').getByRole('button',{name:'Reset position',exact:true});
   async function openMenu(p){
    await p.locator('#rider-level-actions').getByRole('button',{name:'Levels',exact:true}).click();
    await p.waitForFunction(()=>window.riderLevels?.open&&!document.getElementById('rider-levels').hidden);
   }
   async function closeMenu(p){
    await menuButton(p,'.level-heading').getByRole('button',{name:'Back',exact:true}).click();
    await p.waitForFunction(()=>!window.riderLevels?.open&&document.getElementById('rider-levels').hidden);
    await settle(p);
   }
   // Click a Menu control and wait until the loader stored the expected counter fields.
   async function menuCommand(p,button,expect,label){
    const seq=(await counter(p)).pos_seq;
    await button.click();
    await p.waitForFunction(({seq,expect})=>window.riderFpsCounter?.pos_seq>seq&&Object.entries(expect).every(([k,v])=>window.riderFpsCounter[k]===v),{seq,expect},{polling:50,timeout:5000})
     .catch(e=>{throw Error(label+': Menu command not applied ('+e.message.split('\n')[0]+')');});
    const c=await counter(p);assert.equal(c.pos_saved,true,label+': not written to player settings');return c;
   }
   async function presets(p,label){
    const out={};
    for(const [name,[x,y]] of Object.entries(PRESETS)){
     await openMenu(p);
     const before=await counter(p);
     if(before.x!==x||before.y!==y)await menuCommand(p,menuButton(p,`[data-fps-preset="${name}"]`),{x,y},label+' '+name);
     const pressed=await p.evaluate(()=>[...document.querySelectorAll('#rider-levels [data-fps-preset]')].filter(b=>b.getAttribute('aria-pressed')==='true').map(b=>b.dataset.fpsPreset));
     assert.deepEqual(pressed,[name],label+': Menu does not mark the preset '+name);
     await closeMenu(p);
     const {at,n}=await check(p,label+' preset '+name);
     out[name]={css:at,placed:n};
    }
    return out;
   }

   // 1. Fresh profile: shown at the top left (the #417 place), nothing stored yet.
   await page.goto(url);await ready(page);
   let {s,at}=await check(page,'desktop default');
   assert.equal(s.counter.visible,true,'Counter not ON by default');
   assert.equal(s.counter.x,0);assert.equal(s.counter.y,0);assert.equal(s.counter.pos_status,'default');
   assert(near(at.left,0)&&near(at.top,0),'Default counter is not at the top left: '+JSON.stringify(at));
   const area=s.place.area;assert(near(area.x1-area.x0,s.canvas.width)&&near(area.y1-area.y0,s.canvas.height),'Placement area is not the canvas');
   const initial={...at};
   cases.default_top_left={css:at,cap:s.counter.cap,status:s.counter.pos_status};

   // 2. Mouse: drag, sub-threshold tap, threshold drag, drags to the corner and onto Pause, all while recording.
   await record(page,true);
   const startX=(await state(page)).x;
   let c0=await counter(page);
   const from=centre(s.place.css),to={x:s.canvas.left+(s.canvas.right-s.canvas.left)*0.45,y:s.canvas.top+(s.canvas.bottom-s.canvas.top)*0.55};
   await mouseDrag(page,from,to);
   let c1=await waitStored(page,c0.pos_seq,'mouse drag');
   ({s,at}=await check(page,'desktop mouse drag'));
   assert.equal(c1.cap,c0.cap,'A drag changed the cap');assert.equal(c1.cap_seq,c0.cap_seq,'A drag re-applied the cap');
   assert.equal(c1.drags,c0.drags+1);
   assert(near(at.left,initial.left+to.x-from.x)&&near(at.top,initial.top+to.y-from.y),'Counter did not follow the mouse: '+JSON.stringify(at));
   const placedN=normalised(s.place.rect,s.place.area);
   assert(Math.abs(c1.x-placedN.x)<1e-6&&Math.abs(c1.y-placedN.y)<1e-6,'Stored position is not the dropped place');
   cases.mouse_drag={css:at,stored:{x:c1.x,y:c1.y},cap:c1.cap};
   // Less than 10 CSS px of travel is a tap: the cap switches, the counter stays.
   let p0=centre(s.place.css);c0=await counter(page);
   await mouseDrag(page,p0,{x:p0.x+5,y:p0.y+4},2);
   await waitCap(page,c0.cap_seq,90,'sub-threshold mouse tap');
   let c2=await counter(page);assert.equal(c2.pos_seq,c0.pos_seq,'A tap moved the counter');assert.equal(c2.drags,c0.drags);
   ({s,at}=await check(page,'desktop after tap'));assert(near(at.left,cases.mouse_drag.css.left)&&near(at.top,cases.mouse_drag.css.top),'A tap moved the counter');
   // A plain click (no travel) is a tap as well.
   c0=await counter(page);await pointer.tap(page,centre(s.place.css),{counter:FRAMES,label:'mouse tap'});
   await waitCap(page,c0.cap_seq,120,'mouse tap');assert.equal((await counter(page)).pos_seq,c0.pos_seq);
   // Just over the threshold drags (no cap change).
   c0=await counter(page);p0=centre(s.place.css);
   await mouseDrag(page,p0,{x:p0.x+THRESHOLD_CSS_PX+2,y:p0.y},3);
   c1=await waitStored(page,c0.pos_seq,'threshold drag');assert.equal(c1.cap_seq,c0.cap_seq,'A threshold drag switched the cap');
   ({s,at}=await check(page,'desktop threshold drag'));assert(near(at.left,cases.mouse_drag.css.left+THRESHOLD_CSS_PX+2),'Threshold drag did not move by its travel');
   cases.threshold={tap_switched_caps:[90,120],drag_px:THRESHOLD_CSS_PX+2};
   // Dragged past the bottom-right corner: clamped into the canvas and clear of the page and level buttons there.
   c0=await counter(page);
   await mouseDrag(page,centre(s.place.css),{x:s.canvas.right-2,y:s.canvas.bottom-2});
   await waitStored(page,c0.pos_seq,'corner drag');
   cases.drag_to_corner=(await check(page,'desktop drag to the bottom-right corner')).at;
   // Dropped onto the Pause button: moved clear of it.
   s=await state(page);const pause=s.gui.find(g=>g.name==='pause');assert(pause,'No desktop Pause button');
   c0=await counter(page);
   await mouseDrag(page,centre(s.place.css),centre(pause));
   await waitStored(page,c0.pos_seq,'drag onto Pause');
   ({s,at}=await check(page,'desktop drag onto Pause'));
   cases.drag_onto_pause={css:at,pause:{left:pause.left-s.canvas.left,top:pause.top-s.canvas.top,right:pause.right-s.canvas.left,bottom:pause.bottom-s.canvas.top}};
   const rec=await record(page,false);
   const endX=(await state(page)).x;
   cases.mouse_no_drive={...verifyNoDrive(rec,'desktop'),dx_m:endX-startX,drags:(await counter(page)).drags};
   assert(Math.abs(endX-startX)<0.05,'Car moved during counter drags: '+(endX-startX));
   assert.equal((await counter(page)).cap,120,'Drags changed the cap');
   // Dropped onto the DOM Levels button: the engine's mouse-up focuses that button; the canvas must get the keys back,
   // so the arrow keys drive and Space pauses instead of opening Levels.
   s=await state(page);const levels=s.dom.find(d=>d.name==='level:Levels');assert(levels,'No Levels button');
   c0=await counter(page);
   await mouseDrag(page,centre(s.place.css),centre(levels));
   await waitStored(page,c0.pos_seq,'drag onto Levels');
   ({s,at}=await check(page,'desktop drag onto Levels'));
   assert.equal(await page.evaluate(()=>document.activeElement?.tagName),'CANVAS','Canvas lost the keyboard focus after the drop');
   const keyX=(await state(page)).x;
   await page.keyboard.down('ArrowUp');
   try{await page.waitForFunction(x=>window.riderReplay?.command?.throttle===1&&window.riderReplay.x>x+0.2,keyX,{polling:50,timeout:5000})
    .catch(e=>{throw Error('Arrow keys do not drive after a drop on Levels ('+e.message.split('\n')[0]+')');});}
   finally{await page.keyboard.up('ArrowUp');}
   await page.waitForFunction(()=>window.riderReplay?.command?.throttle===0,null,{polling:50,timeout:5000});
   const paused0=await page.evaluate(()=>!!window.riderTimeState?.paused);
   // Space held until the game acknowledges (as a20 does), so the engine sees the press.
   const space=async want=>{await page.keyboard.down('Space');
    try{await page.waitForFunction(w=>!!window.riderTimeState?.paused===w,want,{polling:50,timeout:5000})
     .catch(e=>{throw Error('Space did not reach the game after the drop ('+e.message.split('\n')[0]+')');});}
    finally{await page.keyboard.up('Space');}
    await pointer.frames(page,{label:'space release'});}; // the next press must be a new edge (engine pitfall 5)
   await space(!paused0);
   assert.equal(await page.evaluate(()=>!!window.riderLevels?.open||!document.getElementById('rider-levels').hidden),false,'Space opened Levels after the drop');
   await space(paused0);
   cases.drop_on_levels_keeps_keys={css:at,drove_m:(await state(page)).x-keyX,space_paused:true};

   // 3. Reload: the dragged position and the cap survive.
   const beforeReload={counter:await counter(page),css:at};
   assert.equal(await storage.durable(page,{label:'fps counter position'}),'saved');
   await page.reload();await ready(page);
   ({s,at}=await check(page,'desktop after reload'));
   assert.equal(s.counter.x,beforeReload.counter.x);assert.equal(s.counter.y,beforeReload.counter.y);assert.equal(s.counter.pos_status,'ok');
   assert.equal(s.counter.cap,120,'Cap did not survive the reload');
   assert(near(at.left,beforeReload.css.left)&&near(at.top,beforeReload.css.top),'Dragged position moved after the reload');
   cases.mouse_drag_reload={stored:{x:s.counter.x,y:s.counter.y},css:at,status:s.counter.pos_status};

   // 4. Menu ON/OFF across a reload; OFF hides the counter and its tap.
   await openMenu(page);
   assert.equal(await menuButton(page,'[data-fps="toggle"]').getAttribute('aria-pressed'),'true');
   await menuCommand(page,menuButton(page,'[data-fps="toggle"]'),{visible:false},'Menu OFF');
   assert.equal(await menuButton(page,'[data-fps="toggle"]').textContent(),'Counter OFF');
   await closeMenu(page);
   s=await state(page);assert.equal(s.place.visible,false);
   c0=await counter(page);
   await pointer.tap(page,centre(s.place.css),{counter:FRAMES,label:'tap on the hidden counter'});
   await pointer.frames(page,{counter:FRAMES,n:10,label:'hidden counter'});
   assert.equal((await counter(page)).cap_seq,c0.cap_seq,'The hidden counter still switched the cap');
   assert.equal(await storage.durable(page,{label:'fps counter off'}),'saved');
   await page.reload();await ready(page);
   s=await state(page);assert.equal(s.counter.visible,false,'OFF did not survive the reload');assert.equal(s.place.visible,false);
   await openMenu(page);
   assert.equal(await menuButton(page,'[data-fps="toggle"]').getAttribute('aria-pressed'),'false');
   await menuCommand(page,menuButton(page,'[data-fps="toggle"]'),{visible:true},'Menu ON');
   await closeMenu(page);
   assert.equal(await storage.durable(page,{label:'fps counter on'}),'saved');
   await page.reload();await ready(page);
   s=await state(page);assert.equal(s.counter.visible,true,'ON did not survive the reload');
   cases.menu_on_off_reload={off_reload:false,on_reload:true,hidden_tap_ignored:true};

   // 5. Menu presets at 1280x720; the last one survives a reload; Reset returns to the top left.
   cases.presets_desktop=await presets(page,'desktop');
   assert.equal(await storage.durable(page,{label:'fps preset'}),'saved');
   await page.reload();await ready(page);
   s=await state(page);assert.equal(s.counter.x,1);assert.equal(s.counter.y,1);
   cases.preset_reload={stored:{x:s.counter.x,y:s.counter.y},css:(await check(page,'desktop preset after reload')).at};
   await openMenu(page);
   await menuCommand(page,resetButton(page),{x:0,y:0},'Reset');
   await closeMenu(page);
   ({at}=await check(page,'desktop reset'));
   assert(near(at.left,initial.left)&&near(at.top,initial.top),'Reset did not return to the top left: '+JSON.stringify(at));
   cases.reset_top_left={css:at};

   // 6. Resolution change: the stored position stays, the counter stays inside and clear, and returns exactly.
   s=await state(page);c0=await counter(page);
   await mouseDrag(page,centre(s.place.css),{x:s.canvas.left+(s.canvas.right-s.canvas.left)*0.3,y:s.canvas.top+(s.canvas.bottom-s.canvas.top)*0.4});
   const dropped=await waitStored(page,c0.pos_seq,'drag before resize');
   const before=(await check(page,'desktop before resize')).at;
   await page.setViewportSize({width:1080,height:486});await settle(page);
   const small=await check(page,'desktop at 1080x486');
   assert.equal(small.s.counter.x,dropped.x);assert.equal(small.s.counter.y,dropped.y);
   // check() asserts the normalised place unless a control sits there at this size (then it only moves clear).
   await page.setViewportSize({width:1280,height:720});await settle(page);
   const back=(await check(page,'desktop back at 1280x720')).at;
   assert(near(back.left,before.left)&&near(back.top,before.top),'Counter did not return after the resize');
   cases.resolution_change={stored:{x:dropped.x,y:dropped.y},at_1080x486:small.n,displaced_at_1080x486:small.moved,css_1280x720:back};
   await page.screenshot({path:path.join(out,'fps444-desktop.png')});

   // 7. Phone 1080x486 with touch controls: touch drags (also onto the drive zones), taps, reload, rotation, presets.
   const mobile=await browser.newContext({viewport:{width:1080,height:486},isMobile:true,hasTouch:true});
   phone=await mobile.newPage();watch(phone);
   await configure(phone,runId,'fps444');
   await phone.goto(url+'&touch=1');await ready(phone);
   assert.equal(await phone.evaluate(()=>window.riderMobile?.enabled),true,'Touch controls not enabled');
   ({s,at}=await check(phone,'phone default'));
   assert(near(at.left,0)&&near(at.top,0),'Phone default is not the top left');
   const session=await mobile.newCDPSession(phone);
   await record(phone,true);
   const phoneStartX=(await state(phone)).x;
   c0=await counter(phone);
   const tFrom=centre(s.place.css),tTo={x:s.canvas.left+(s.canvas.right-s.canvas.left)*0.5,y:s.canvas.top+(s.canvas.bottom-s.canvas.top)*0.45};
   await touchDrag(phone,session,tFrom,tTo);
   c1=await waitStored(phone,c0.pos_seq,'touch drag');
   ({s,at}=await check(phone,'phone touch drag'));
   assert.equal(c1.cap_seq,c0.cap_seq,'A touch drag changed the cap');
   assert(near(at.left,tTo.x-tFrom.x)&&near(at.top,tTo.y-tFrom.y),'Counter did not follow the finger: '+JSON.stringify(at));
   cases.touch_drag={css:at,stored:{x:c1.x,y:c1.y}};
   // Dragged onto the left drive zone: it ends clear of every zone, and no zone is held.
   const zone=s.dom.find(d=>d.name.startsWith('drive:'));assert(zone,'No drive zone');
   c0=await counter(phone);
   await touchDrag(phone,session,centre(s.place.css),centre(zone));
   await waitStored(phone,c0.pos_seq,'touch drag onto a drive zone');
   assert.equal(await phone.evaluate(()=>document.querySelectorAll('#rider-mobile [data-command].held').length),0,'A drive zone is held after the drag');
   cases.touch_drag_onto_drive_zone={zone:zone.name,css:(await check(phone,'phone drag onto '+zone.name)).at};
   // A touch tap (and a sub-threshold wiggle) still switches the cap.
   s=await state(phone);c0=await counter(phone);
   await touchDrag(phone,session,centre(s.place.css),centre(s.place.css),1);
   await waitCap(phone,c0.cap_seq,90,'touch tap');
   c0=await counter(phone);const w0=centre(s.place.css);
   await touchDrag(phone,session,w0,{x:w0.x+4,y:w0.y+5},2);
   await waitCap(phone,c0.cap_seq,120,'sub-threshold touch');
   assert.equal((await counter(phone)).pos_seq,c0.pos_seq,'A touch tap moved the counter');
   const phoneRec=await record(phone,false);
   const phoneEndX=(await state(phone)).x;
   cases.touch_no_drive={...verifyNoDrive(phoneRec,'phone'),dx_m:phoneEndX-phoneStartX,taps_switched:[90,120]};
   assert(Math.abs(phoneEndX-phoneStartX)<0.05,'Car moved during touch drags: '+(phoneEndX-phoneStartX));
   // Finger 1 holds Throttle while finger 2 drags the counter and lifts alone (CDP touchEnd listing only finger 2):
   // the counter moves and stores, the cap stays, Throttle stays held and driving.
   {
    const startAt=(await check(phone,'phone before the two-finger drag')).at;s=await state(phone);
    const tb=s.dom.find(d=>d.name==='drive:throttle');assert(tb,'No Throttle zone');
    const hold={...centre(tb),id:1},f0=centre(s.place.css),f1={x:f0.x+120,y:f0.y-60};
    c0=await counter(phone);
    try{
     await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[hold]});
     await phone.waitForFunction(()=>window.riderReplay?.command?.throttle===1,null,{polling:50,timeout:5000});
     await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[hold,{...f0,id:2}]});
     await pointer.frames(phone,{counter:FRAMES,label:'finger 2 press'});
     for(let i=1;i<=6;i++){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[hold,{x:f0.x+(f1.x-f0.x)*i/6,y:f0.y+(f1.y-f0.y)*i/6,id:2}]});await pointer.frames(phone,{counter:FRAMES,n:1,label:'finger 2 step'});}
     await pointer.frames(phone,{counter:FRAMES,label:'finger 2 hold'});
     await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[{...f1,id:2}]});
     c1=await waitStored(phone,c0.pos_seq,'two-finger drag');
     assert.equal(c1.cap_seq,c0.cap_seq,'A drag with Throttle held changed the cap');
     assert.equal((await state(phone)).counter.drags,c0.drags+1);
     assert.equal(await phone.evaluate(()=>window.riderReplay.command.throttle),1,'Throttle dropped when finger 2 lifted');
     assert.equal(await phone.evaluate(()=>document.querySelector('#rider-mobile [data-command="throttle"]').classList.contains('held')),true,'Throttle zone released by the drag');
    }finally{await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
    await phone.waitForFunction(()=>window.riderReplay?.command?.throttle===0,null,{polling:50,timeout:5000});
    ({s,at}=await check(phone,'phone drag with Throttle held'));
    assert(near(at.left,startAt.left+f1.x-f0.x)&&near(at.top,startAt.top+f1.y-f0.y),'Counter did not follow finger 2: '+JSON.stringify(at));
    cases.drag_with_throttle_held={css:at,stored:{x:c1.x,y:c1.y},cap_seq_unchanged:true,throttle_held_after_lift:true};
   }
   // Reload keeps the touch-dragged position.
   const phoneBefore={counter:await counter(phone),css:(await check(phone,'phone before reload')).at};
   assert.equal(await storage.durable(phone,{label:'phone fps position'}),'saved');
   await phone.reload();await ready(phone);
   ({s,at}=await check(phone,'phone after reload'));
   assert.equal(s.counter.x,phoneBefore.counter.x);assert.equal(s.counter.y,phoneBefore.counter.y);
   assert(near(at.left,phoneBefore.css.left)&&near(at.top,phoneBefore.css.top),'Touch-dragged position moved after the reload');
   cases.touch_drag_reload={stored:{x:s.counter.x,y:s.counter.y},css:at};
   // Rotation to portrait and back: same stored position, same place.
   await phone.setViewportSize({width:486,height:1080});
   await phone.waitForFunction(()=>window.riderMobile?.blocked===true,null,{timeout:5000});
   await phone.waitForTimeout(300);
   await phone.setViewportSize({width:1080,height:486});
   await phone.waitForFunction(()=>window.riderMobile?.blocked===false,null,{timeout:5000});
   await settle(phone);
   ({s,at}=await check(phone,'phone after rotation'));
   assert.equal(s.counter.x,phoneBefore.counter.x);assert.equal(s.counter.y,phoneBefore.counter.y);
   assert(near(at.left,phoneBefore.css.left)&&near(at.top,phoneBefore.css.top),'Rotation moved the counter');
   cases.rotation={css:at};
   cases.presets_phone=await presets(phone,'phone');
   await phone.screenshot({path:path.join(out,'fps444-phone.png')});

   // 8. Dense phone (device pixel ratio 2.75, 1080x486 CSS, touch): the threshold and gap are CSS pixels.
   const denseContext=await browser.newContext({viewport:{width:1080,height:486},deviceScaleFactor:2.75,isMobile:true,hasTouch:true});
   dense=await denseContext.newPage();watch(dense);
   await configure(dense,runId,'fps444');
   await dense.goto(url+'&touch=1');await ready(dense);
   s=await state(dense);
   assert(s.place.pixel_ratio>2.5,'Not a dense canvas: pixel ratio '+s.place.pixel_ratio);
   ({s,at}=await check(dense,'dense default'));
   const denseSession=await denseContext.newCDPSession(dense);
   c0=await counter(dense);let d0=centre(s.place.css);
   await touchDrag(dense,denseSession,d0,{x:d0.x+9,y:d0.y},3);
   await waitCap(dense,c0.cap_seq,90,'dense 9 px tap');
   assert.equal((await counter(dense)).pos_seq,c0.pos_seq,'A 9 CSS px press moved the counter at DPR 2.75');
   ({s,at}=await check(dense,'dense after 9 px tap'));const tapAt=at;
   c0=await counter(dense);d0=centre(s.place.css);
   await touchDrag(dense,denseSession,d0,{x:d0.x+12,y:d0.y},3);
   c1=await waitStored(dense,c0.pos_seq,'dense 12 px drag');
   assert.equal(c1.cap_seq,c0.cap_seq,'A 12 CSS px drag switched the cap at DPR 2.75');
   ({s,at}=await check(dense,'dense 12 px drag'));
   assert(near(at.left,tapAt.left+12)&&near(at.top,tapAt.top),'12 px drag did not move by 12 CSS px: '+JSON.stringify(at));
   const denseZone=s.dom.find(d=>d.name.startsWith('drive:'));assert(denseZone,'No drive zone');
   c0=await counter(dense);
   await touchDrag(dense,denseSession,centre(s.place.css),centre(denseZone));
   await waitStored(dense,c0.pos_seq,'dense drag onto a drive zone');
   const denseZoneAt=(await check(dense,'dense drag onto '+denseZone.name)).at;
   await openMenu(dense);
   await menuCommand(dense,menuButton(dense,'[data-fps-preset="bottom_left"]'),{x:0,y:1},'dense preset bottom_left');
   await closeMenu(dense);
   const densePreset=(await check(dense,'dense preset bottom_left')).at;
   cases.dense_dpr={pixel_ratio:s.place.pixel_ratio,tap_9px_switched:true,drag_12px:at,drive_zone:{zone:denseZone.name,css:denseZoneAt},preset_bottom_left:densePreset};

   assert.equal(errors.length,0,'Defold errors: '+errors.join('; '));
   const report={status:'PASS',source_sha:sha,build_source_fingerprint:metadata.source_fingerprint,run_id:runId,
    browser:browser.version(),platform:'real-debug-defold-html5-chromium-headless',station:STATION,cases,evidence,
    not_run:['Android_device','real_touch','native_menu'],
    limitations:'Synthetic mouse and CDP touch input in headless Chromium; a real finger drag is the drive test.'};
   fs.writeFileSync(path.join(out,'fps444-result.json'),JSON.stringify(report,null,2)+'\n');
   console.log('FPS444_RESULT '+JSON.stringify({status:report.status,source_sha:sha,run_id:runId,cases:Object.keys(cases)}));
  }catch(e){
   const diag={status:'FAIL',source_sha:sha,run_id:runId,error:String(e),cases,evidence,browser_errors:errors};
   for(const [name,p] of [['desktop',page],['phone',phone],['dense',dense]]){
    if(!p)continue;
    diag[name]=await p.evaluate(()=>({counter:window.riderFpsCounter??null,place:window.riderFpsPlace??null,hud:window.riderHud??null,
     replay:window.riderReplay?{recording:window.riderReplay.recording,x:window.riderReplay.x}:null})).catch(err=>({capture_error:String(err)}));
    await p.screenshot({path:path.join(out,`fps444-${name}-failed.png`),timeout:5000}).catch(()=>{});
   }
   fs.writeFileSync(path.join(out,'fps444-failed.json'),JSON.stringify(diag,null,2)+'\n');
   console.error('FPS444_FAIL '+JSON.stringify({error:diag.error,source_sha:sha,run_id:runId}));
   throw e;
  }finally{
   if(browser)await browser.close().catch(()=>{});
   await new Promise(resolve=>server.close(resolve));
  }
 })().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
}
