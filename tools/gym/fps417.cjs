// #417 tap-to-switch FPS counter, debug Gym case `fps417` (real Defold HTML5 debug build, real mouse/touch input).
// While driving Straight, taps on the counter switch the cap 60 -> 90 -> 120 -> 144 -> Unlimited -> 30 (reload) -> 60.
// Per cap: the read-only #356 observer must show fixed physics at 60 ticks/s with dt exactly 1/60, and the counter
// must report the measured update cadence (never the requested cap) in the colour for that cadence and cap.
// The cap persists across a reload; an A21 replay recorded at cap 30 MATCHes while the caps are switched during it;
// taps on the counter (mouse and touch) never produce a drive command. Presented frames stay UNKNOWN.
'use strict';
const assert=require('node:assert/strict');
const CAPS=[30,60,90,120,144,0], DEFAULT_CAP=60, STATION='straight', WINDOW_S=4, LABEL_S=1;
function parseArgs(args){
 const usage='Usage: node tools/gym/fps417.cjs OUT SHA RUN_ID fps417 VERIFIED_DEBUG_BUNDLE';
 if(!Array.isArray(args)||args.length!==5||args.some(v=>typeof v!=='string'||!v)||args[3]!=='fps417')throw Error(usage);
 return {output:args[0],sha:args[1],runId:args[2],bundle:args[4]};
}
const nextCap=cap=>CAPS[(CAPS.indexOf(cap)+1)%CAPS.length];
const reference=cap=>cap===0?60:cap;
// Mirror of main/game/fps_counter.lua (green >= 90 %, orange >= 70 %, red below; Unlimited against 60),
// applied to the whole number the counter shows.
function level(fps,cap){
 if(typeof fps!=='number'||!Number.isFinite(fps))return null;
 const ref=reference(cap);fps=Math.floor(fps+0.5);
 return fps*100>=90*ref?'green':fps*100>=70*ref?'orange':'red';
}
const COLORS={green:[0.3,0.9,0.6],orange:[1,0.65,0.2],red:[1,0.25,0.25]};
const capLabel=cap=>cap===0?'cap unlimited':'cap '+cap;
// The counter reading must be the measured Defold update cadence of the same window, not the requested cap.
function verifyCounter(counter,m,cap){
 assert(counter&&m,'Missing counter or measurement');
 assert.equal(counter.cap,cap,'Counter shows another cap');
 assert.equal(counter.label,false,'Cap label still shown in a measurement window');
 assert(Number.isFinite(counter.fps)&&counter.fps>0,'Counter has no measured reading');
 assert(counter.buckets>=4,'Counter reading is not a full smoothing window');
 const measured=m.world_update_callback_hz;
 assert(Number.isFinite(measured)&&measured>0,'No measured Defold update cadence');
 const tolerance=Math.max(3,0.1*measured);
 assert(Math.abs(counter.fps-measured)<=tolerance,
  `Counter ${counter.fps.toFixed(2)} fps differs from the measured ${measured.toFixed(2)} update callbacks/s (cap ${cap})`);
 assert.equal(counter.text,Math.floor(counter.fps+0.5)+' fps','Counter text is not the rounded measured value');
 const expected=level(counter.fps,cap);
 assert.equal(counter.level,expected,'Counter colour level is not relative to the cap');
 COLORS[expected].forEach((v,i)=>assert(Math.abs(counter.color[i]-v)<1e-3,'Counter colour differs from its level'));
 // The cap is an upper bound; the browser (display refresh) may keep the real cadence lower.
 if(cap===30)assert(Math.abs(measured-30)<=6,'Cap 30 not observed: '+measured);
 if(cap===60)assert(Math.abs(measured-60)<=12,'Cap 60 not observed: '+measured);
 if(cap!==0)assert(measured<=cap*1.1+3,`Cadence ${measured} above cap ${cap}`);
 return {cap,counter_fps:counter.fps,counter_text:counter.text,level:expected,
  update_callback_hz:measured,fixed_tick_wall_hz:m.fixed_tick_wall_hz,fixed_dt_s:m.fixed_dt_s,elapsed_s:m.elapsed_s};
}
// A recording made only of counter taps must contain no drive command on any fixed tick.
function verifyNoDrive(recording,taps){
 assert(recording&&recording.ended==='stopped'&&recording.error===false,'Tap recording not cleanly stopped');
 assert(Number.isSafeInteger(recording.ticks)&&recording.ticks>=30,'Tap recording too short');
 assert(Number.isSafeInteger(taps)&&taps>=3,'Too few counter taps');
 assert.deepEqual(recording.commands,{throttle:0,brake:0,lean:0},'A counter tap produced drive input');
 return {ticks:recording.ticks,taps,commands:recording.commands};
}
// The invisible tap area (CSS px) must meet the 44 px touch minimum and stay clear of DOM and HUD controls.
const MIN_TAP_PX=44;
function verifyHitArea(rect,controls=[]){
 assert(rect&&[rect.x0,rect.y0,rect.x1,rect.y1].every(Number.isFinite),'Missing counter tap area');
 const width=rect.x1-rect.x0,height=rect.y1-rect.y0;
 assert(width>=MIN_TAP_PX&&height>=MIN_TAP_PX,`Counter tap area ${width.toFixed(1)}x${height.toFixed(1)} CSS px is under ${MIN_TAP_PX} px`);
 for(const c of controls){
  assert(!(c.x>=rect.x0&&c.x<=rect.x1&&c.y>=rect.y0&&c.y<=rect.y1),'Counter tap area covers control '+c.name);
 }
 return {width_css_px:width,height_css_px:height};
}
// While a Throttle zone is held by another finger, the counter tap must leave exactly that drive command.
function verifyHeldThrottle(samples,recording){
 assert(Array.isArray(samples)&&samples.length>=3,'Too few drive samples during the multi-touch tap');
 for(const c of samples)assert(c&&c.throttle===1&&c.brake_reverse===0&&c.lean===0,'Counter tap changed the held throttle: '+JSON.stringify(c));
 assert(recording&&recording.ended==='stopped'&&recording.error===false,'Multi-touch recording not cleanly stopped');
 assert(recording.commands.throttle>0&&recording.commands.brake===0&&recording.commands.lean===0,'Extra drive input during the multi-touch tap: '+JSON.stringify(recording.commands));
 return {samples:samples.length,commands:recording.commands,ticks:recording.ticks};
}
module.exports={parseArgs,level,verifyCounter,verifyNoDrive,verifyHitArea,verifyHeldThrottle,nextCap,CAPS,DEFAULT_CAP,STATION,capLabel,MIN_TAP_PX};
if(require.main===module){
 const {configure}=require('./launch.cjs');
 const pointer=require('./pointer.cjs');
 const storage=require('./storage.cjs');
 const {compare}=require('./fps356_verify.cjs');
 const {verifyReplay}=require('./fps356_runtime.cjs');
 const {chromium}=require('playwright');
 const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
 const {output,sha,runId,bundle}=parseArgs(process.argv.slice(2));
 const out=path.resolve(output);fs.mkdirSync(out,{recursive:true});
 fs.rmSync(path.join(out,'fps417-result.json'),{force:true});
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
  let browser,page,phone;const errors=[],cases={},evidence={windows:[],labels:[]};
  const watch=p=>{p.on('pageerror',e=>{if(errors.length<20)errors.push(e.message);});
   p.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text())&&errors.length<20)errors.push(m.text());});};
  try{
   await new Promise(r=>server.listen(0,'127.0.0.1',r));
   const url='http://127.0.0.1:'+server.address().port+'/index.html?station='+STATION;
   browser=await chromium.launch();
   const desktop=await browser.newContext({viewport:{width:1280,height:720}});
   page=await desktop.newPage();watch(page);
   await configure(page,runId,'fps417');
   const counter=p=>p.evaluate(()=>window.riderFpsCounter?{...window.riderFpsCounter}:null);
   const snap=()=>page.evaluate(()=>({...window.riderFps356World}));
   const replayState=p=>p.evaluate(()=>window.riderReplay);
   async function ready(p){
    await p.waitForFunction(({sha,runId})=>window.riderReady?.source_sha===sha&&window.riderReady?.run_id===runId&&
     window.riderFps356World?.fixed_ticks>30&&window.riderFps356World?.vehicle_ready&&window.riderReplay?.frames>10&&
     window.riderFpsCounter?.cap_seq>=1&&window.riderHud?.fps,{sha,runId},{polling:100,timeout:30000});
   }
   // Hold W while the car is behind x=4 m and S (brake, then reverse) beyond 12 m: continuous driving inside bounds.
   function drive(p){
    let held=null,stopped=false,samples=0,active=0;
    const loop=(async()=>{
     while(!stopped){
      const r=await p.evaluate(()=>({x:window.riderReplay?.x,c:window.riderReplay?.command}));
      const want=r.x<4?'w':r.x>12?'s':held||'w';
      if(want!==held){if(held)await p.keyboard.up(held);await p.keyboard.down(want);held=want;}
      samples++;if(r.c&&(r.c.throttle>0||r.c.brake_reverse>0))active++;
      await new Promise(res=>setTimeout(res,100));
     }
     if(held)await p.keyboard.up(held);
    })();
    return {stats:()=>({samples,active}),reset(){samples=0;active=0;},async stop(){stopped=true;await loop;}};
   }
   // Real pointer tap on the counter: move, press and release in separate engine frames (engine pitfall 5). Since
   // #444 the release decides (a press may become a drag), so the loader-applied cap is awaited after it.
   async function tapMouse(p,expected){
    const before=await counter(p);
    await pointer.tap(p,await pointer.hudPoint(p,'fps'),{counter:'window.riderReplay.frames',label:'counter tap '+expected});
    await p.waitForFunction(({seq,cap})=>window.riderFpsCounter?.cap_seq>seq&&window.riderFpsCounter.cap===cap,
     {seq:before.cap_seq,cap:expected},{polling:50,timeout:5000})
     .catch(async e=>{throw Error(`counter tap ${expected}: cap not applied (${e.message.split('\n')[0]}); ${JSON.stringify(await counter(p))}`);});
    return labelSeen(p,expected);
   }
   async function tapTouch(p,session,expected,at=null){
    const before=await counter(p),point=at||await pointer.hudPoint(p,'fps');
    const target=await p.evaluate(({x,y})=>document.elementFromPoint(x,y)?.id||document.elementFromPoint(x,y)?.tagName,point);
    assert.equal(target,'canvas','A DOM overlay covers the counter at phone size');
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:point.x,y:point.y,id:1}]});
    try{await pointer.frames(p,{counter:'window.riderReplay.frames',label:'touch press '+expected});}
    finally{await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
    // The release is the tap (#444): the cap switches after it.
    await p.waitForFunction(({seq,cap})=>window.riderFpsCounter?.cap_seq>seq&&window.riderFpsCounter.cap===cap,
     {seq:before.cap_seq,cap:expected},{polling:50,timeout:5000});
    await pointer.frames(p,{counter:'window.riderReplay.frames',label:'touch release '+expected});
    return labelSeen(p,expected);
   }
   async function labelSeen(p,cap){
    const c=await counter(p);
    assert.equal(c.saved,true,'Tapped cap was not stored in player settings');
    return {cap,label:c.label,text:c.text};
   }
   // CSS-pixel rectangle of the invisible tap area from its two corner probes (GUI pixels, origin bottom left).
   async function hitArea(p){
    return p.evaluate(()=>{
     const c=document.querySelector('canvas'),r=c.getBoundingClientRect(),q=window.riderHud.fps_rect;
     const css=v=>({x:r.x+v.x/c.width*r.width,y:r.y+(1-v.y/c.height)*r.height});
     const a=css(q.top_left),b=css(q.bottom_right);
     const controls=['pause','step','record','replay','crash','struts'].map(name=>({name,...css(window.riderHud[name])}))
      .concat(Object.entries(window.riderHud.presets).map(([k,v])=>({name:'preset '+k,...css(v)})));
     return {rect:{x0:Math.min(a.x,b.x),y0:Math.min(a.y,b.y),x1:Math.max(a.x,b.x),y1:Math.max(a.y,b.y)},controls};
    });
   }
   // Every corner of the tap area must hit the canvas, not a DOM control of the touch overlay.
   async function canvasAt(p,rect){
    const ids=await p.evaluate(r=>[[r.x0+2,r.y0+2],[r.x1-2,r.y0+2],[r.x0+2,r.y1-2],[r.x1-2,r.y1-2]]
     .map(([x,y])=>document.elementFromPoint(x,y)?.id||document.elementFromPoint(x,y)?.tagName),rect);
    assert(ids.every(id=>id==='canvas'),'A DOM element covers the counter tap area: '+ids.join(','));
   }
   // "cap N" shows briefly after a tap, then the measured reading returns.
   async function labelCleared(p,cap,shown){
    assert.equal(shown.label,true,'No cap label after the tap');assert.equal(shown.text,capLabel(cap),'Wrong cap label');
    const t0=Date.now();
    await p.waitForFunction(seq=>window.riderFpsCounter?.label===false&&window.riderFpsCounter.cap_seq===seq,(await counter(p)).cap_seq,{polling:50,timeout:5000});
    const seconds=(Date.now()-t0)/1000;
    assert(seconds<=LABEL_S+0.6,'Cap label stayed too long: '+seconds);
    evidence.labels.push({cap,text:shown.text,cleared_after_s:seconds});
   }
   async function measure(cap,driver){
    const c0=await counter(page);
    await page.waitForFunction(seq=>window.riderFpsCounter?.label===false&&window.riderFpsCounter.buckets>=4&&window.riderFpsCounter.cap_seq===seq,c0.cap_seq,{polling:50,timeout:10000});
    driver?.reset();
    const a=await snap();
    await page.waitForTimeout(WINDOW_S*1000+300);
    await page.waitForFunction(seq=>window.riderFps356World?.sequence>seq,a.sequence,{polling:50,timeout:5000});
    const b=await snap();
    const c=await counter(page);
    assert.equal(c.cap_seq,c0.cap_seq,'Cap changed during the measurement window');
    const m=compare(a,b,{phase:'running',minSeconds:WINDOW_S});
    const w=verifyCounter(c,m,cap);
    if(driver){const s=driver.stats();assert(s.samples>=10&&s.active/s.samples>=0.9,'Not driving through the window: '+JSON.stringify(s));w.drive=s;}
    w.generation=b.generation;w.reset_count=b.reset_count;
    evidence.windows.push(w);
    console.log('FPS417_WINDOW '+JSON.stringify(w));
    return w;
   }

   // 1. Fresh profile: default cap 60, nothing stored yet.
   await page.goto(url);await ready(page);
   const first=await counter(page);
   assert.equal(first.cap,DEFAULT_CAP,'Default cap is not 60');assert.equal(first.status,'default','Fresh profile has stored settings');
   cases.default_cap_60={cap:first.cap,status:first.status};

   // 2. Drive and tap through 90, 120, 144, Unlimited, 30; measure the default 60 first.
   let driver=drive(page);
   const measured={};
   measured['60']=await measure(60,driver);
   let cap=DEFAULT_CAP;
   for(let i=0;i<5;i++){
    cap=nextCap(cap);
    await labelCleared(page,cap,await tapMouse(page,cap));
    measured[String(cap)]=await measure(cap,driver);
   }
   assert.equal(cap,30);
   await driver.stop();

   // 3. Reload: the stored cap 30 is restored and applied at startup (the measured cadence follows it).
   assert.equal(await storage.durable(page,{label:'fps cap 30'}),'saved');
   await page.reload();await ready(page);
   const restored=await counter(page);
   assert.equal(restored.cap,30,'Cap did not survive the reload');assert.equal(restored.status,'ok');
   const afterReload=await measure(30);
   cases.persisted_reload={cap:restored.cap,status:restored.status,update_callback_hz:afterReload.update_callback_hz,counter_fps:afterReload.counter_fps};

   // 4. A21 record at cap 30, then replay while every cap is switched by taps: the replay must MATCH.
   const beforeRecord=(await replayState(page)).resets;
   await page.keyboard.down('b');await page.waitForFunction(n=>window.riderReplay?.recording?.active&&window.riderReplay.resets===n+1,beforeRecord);await page.keyboard.up('b');
   // About 6 s of driving (3 s throttle, 3 s brake/reverse, staying inside the Straight bounds), so six taps fit
   // into the replay with a wide margin on a loaded runner.
   await page.keyboard.down('ArrowUp');
   await page.waitForFunction(()=>window.riderReplay?.command?.throttle===1,null,{polling:50,timeout:10000});
   await page.waitForTimeout(3000);
   await page.keyboard.up('ArrowUp');
   await page.keyboard.down('ArrowDown');
   await page.waitForFunction(()=>window.riderReplay?.command?.brake_reverse===1,null,{polling:50,timeout:10000});
   await page.waitForTimeout(3000);
   await page.keyboard.up('ArrowDown');
   await page.waitForFunction(()=>window.riderReplay?.command?.throttle===0&&window.riderReplay.command.brake_reverse===0,null,{polling:50,timeout:10000});
   await page.keyboard.down('b');await page.waitForFunction(()=>window.riderReplay?.recording?.active===false);await page.keyboard.up('b');
   await page.waitForFunction(()=>window.riderReplay?.recording?.trailing===true,null,{polling:50,timeout:10000});
   const recorded=await page.evaluate(()=>window.riderReplay.recording);
   assert.equal(recorded.commands.throttle>90,true,'Recording has too little throttle');
   assert.equal(recorded.commands.brake>90,true,'Recording has too little brake/reverse');
   assert(recorded.ticks>=330,'Recording too short for the replay tap margin: '+recorded.ticks);
   const beforePlay=(await replayState(page)).resets;
   await page.keyboard.down('g');await page.waitForFunction(n=>window.riderReplay?.play?.active&&window.riderReplay.resets===n+1,beforePlay);await page.keyboard.up('g');
   const duringReplay=[];
   for(let i=0;i<CAPS.length;i++){
    cap=nextCap(cap);
    const shown=await tapMouse(page,cap);
    const r=await replayState(page);
    duringReplay.push({cap,active:r.play.active,index:r.play.index,ticks:r.play.ticks});
    assert.equal(r.play.active,true,'Replay ended before every cap was switched');
    evidence.labels.push({cap,text:shown.text,during_replay:true});
   }
   assert.equal(cap,30,'Six taps did not return to the starting cap');
   await page.waitForFunction(()=>window.riderReplay?.play?.ended==='done',null,{polling:50,timeout:30000});
   const played=await page.evaluate(()=>window.riderReplay.play);
   const tolerance=await page.evaluate(()=>window.riderReplay.tolerance);
   cases.replay_match_across_caps={...verifyReplay(recorded,played,{sourceSha:sha,station:STATION,tolerance}),record_cap:30,caps_switched_during_replay:duringReplay};

   // 5. Finish the cycle: 30 -> 60 (wrap), measured while driving.
   driver=drive(page);
   cap=nextCap(cap);assert.equal(cap,60);
   await labelCleared(page,cap,await tapMouse(page,cap));
   measured['60_after_wrap']=await measure(60,driver);
   await driver.stop();

   // 6. Mouse taps only, recorded on the fixed tick: no drive command, the car stays at rest.
   const beforeTaps=(await replayState(page)).resets;
   await page.keyboard.down('b');await page.waitForFunction(n=>window.riderReplay?.recording?.active&&window.riderReplay.resets===n+1,beforeTaps);await page.keyboard.up('b');
   const startX=(await replayState(page)).x;
   for(let i=0;i<CAPS.length;i++){cap=nextCap(cap);await tapMouse(page,cap);}
   assert.equal(cap,60);
   await page.waitForFunction(()=>window.riderReplay?.recording?.ticks>=60,null,{polling:50,timeout:10000}); // at least 1 s recorded
   await page.keyboard.down('b');await page.waitForFunction(()=>window.riderReplay?.recording?.active===false);await page.keyboard.up('b');
   const tapRecording=await page.evaluate(()=>window.riderReplay.recording);
   const endX=(await replayState(page)).x;
   cases.tap_no_drive_mouse={...verifyNoDrive(tapRecording,CAPS.length),dx_m:endX-startX};
   assert(Math.abs(endX-startX)<0.05,'Car moved during counter taps: '+(endX-startX));

   // Every cap measured; physics fixed at 60 Hz in every window (compare() asserts 54-66 Hz and dt 1/60 per window).
   for(const c of CAPS)assert(measured[String(c)],'Cap not measured: '+c);
   cases.counter_reports_measured=Object.fromEntries(Object.entries(measured).map(([k,w])=>[k,{counter_fps:w.counter_fps,update_callback_hz:w.update_callback_hz,level:w.level,text:w.counter_text}]));
   cases.physics_fixed_60_all_caps=Object.fromEntries(Object.entries(measured).map(([k,w])=>[k,{fixed_tick_wall_hz:w.fixed_tick_wall_hz,fixed_dt_s:w.fixed_dt_s}]));
   cases.cap_label_after_tap=evidence.labels.filter(l=>!l.during_replay);
   const desktopArea=await hitArea(page);
   evidence.hit_area={desktop:{...verifyHitArea(desktopArea.rect,desktopArea.controls),rect:desktopArea.rect}};
   await page.screenshot({path:path.join(out,'fps417-desktop.png')});

   // 7. Phone emulation with touch controls: a touch tap on the counter switches the cap, no drive command.
   const mobile=await browser.newContext({viewport:{width:1080,height:486},isMobile:true,hasTouch:true});
   phone=await mobile.newPage();watch(phone);
   await configure(phone,runId,'fps417');
   await phone.goto(url+'&touch=1');await ready(phone);
   assert.equal(await phone.evaluate(()=>window.riderMobile?.enabled),true,'Touch controls not enabled');
   const phoneFirst=await counter(phone);assert.equal(phoneFirst.cap,DEFAULT_CAP,'Fresh phone profile is not at the default cap');
   const session=await mobile.newCDPSession(phone);
   const beforeTouch=(await replayState(phone)).resets;
   await phone.keyboard.down('b');await phone.waitForFunction(n=>window.riderReplay?.recording?.active&&window.riderReplay.resets===n+1,beforeTouch);await phone.keyboard.up('b');
   // The tap area is at least 44 CSS px and works up to its edges: centre, top-left and bottom-right taps.
   const phoneArea=await hitArea(phone),r=phoneArea.rect;
   evidence.hit_area.phone={...verifyHitArea(r,phoneArea.controls),rect:r};
   await canvasAt(phone,r);
   let touchCap=DEFAULT_CAP;
   for(const at of [null,{x:r.x0+4,y:r.y0+4},{x:r.x1-4,y:r.y1-4}]){touchCap=nextCap(touchCap);await tapTouch(phone,session,touchCap,at);}
   await phone.waitForFunction(()=>window.riderReplay?.recording?.ticks>=60,null,{polling:50,timeout:10000}); // at least 1 s recorded
   await phone.keyboard.down('b');await phone.waitForFunction(()=>window.riderReplay?.recording?.active===false);await phone.keyboard.up('b');
   cases.tap_no_drive_touch={...verifyNoDrive(await phone.evaluate(()=>window.riderReplay.recording),3),cap:(await counter(phone)).cap,
    hit_area_css_px:{width:evidence.hit_area.phone.width_css_px,height:evidence.hit_area.phone.height_css_px},edge_taps:true};
   assert.equal(cases.tap_no_drive_touch.cap,144);

   // Multi-touch: finger 1 holds the Throttle zone, finger 2 presses the counter. Throttle must stay exactly as held.
   // Since #444 a press on the counter is not yet a tap (it may become a drag): the cap switches on its release.
   // CDP cannot lift one finger alone in the pinned headless Chromium: a touchMove that omits finger 2 dispatches no
   // touchend until every finger ends (checked in #444, touches.length stays 2), so both fingers lift together here.
   // A real single-finger lift is part of the drive test.
   const throttleBox=await phone.locator('#rider-mobile [data-command="throttle"]').boundingBox();
   assert(throttleBox,'No Throttle zone');
   const hold={x:throttleBox.x+throttleBox.width/2,y:throttleBox.y+throttleBox.height/2,id:1};
   const counterPoint=await pointer.hudPoint(phone,'fps');
   const beforeMulti=(await replayState(phone)).resets;
   await phone.keyboard.down('b');await phone.waitForFunction(n=>window.riderReplay?.recording?.active&&window.riderReplay.resets===n+1,beforeMulti);await phone.keyboard.up('b');
   const multiSamples=[];const sample=async()=>multiSamples.push((await replayState(phone)).command);
   const multiCap=nextCap(touchCap);let multiSeq;
   try{
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[hold]});
    await phone.waitForFunction(()=>window.riderReplay?.command?.throttle===1,null,{polling:50,timeout:5000});
    await sample();
    multiSeq=(await counter(phone)).cap_seq;
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[hold,{x:counterPoint.x,y:counterPoint.y,id:2}]});
    await pointer.frames(phone,{counter:'window.riderReplay.frames',label:'second finger press'});
    await sample();
    await phone.waitForTimeout(300);await sample();
    assert.equal((await counter(phone)).cap_seq,multiSeq,'A held press on the counter switched the cap before its release');
    assert.equal(await phone.evaluate(()=>document.querySelector('#rider-mobile [data-command="throttle"]').classList.contains('held')),true,'Throttle zone released by the counter press');
   }finally{await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
   await phone.waitForFunction(({seq,cap})=>window.riderFpsCounter?.cap_seq===seq+1&&window.riderFpsCounter.cap===cap,{seq:multiSeq,cap:multiCap},{polling:50,timeout:5000});
   await phone.waitForFunction(()=>window.riderReplay?.command?.throttle===0,null,{polling:50,timeout:5000});
   await phone.keyboard.down('b');await phone.waitForFunction(()=>window.riderReplay?.recording?.active===false);await phone.keyboard.up('b');
   cases.tap_no_drive_touch.multi_touch_held_throttle={...verifyHeldThrottle(multiSamples,await phone.evaluate(()=>window.riderReplay.recording)),cap:multiCap};
   assert.equal((await counter(phone)).cap,0,'Multi-touch counter tap did not switch the cap');
   await phone.screenshot({path:path.join(out,'fps417-phone.png')});

   assert.equal(errors.length,0,'Defold errors: '+errors.join('; '));
   const report={status:'PASS',source_sha:sha,build_source_fingerprint:metadata.source_fingerprint,run_id:runId,
    browser:browser.version(),platform:'real-debug-defold-html5-chromium-headless',station:STATION,cases,evidence,
    presented_fps:null,
    not_run:['Android_device','real_touch','display_refresh_above_browser_raf','presented_frames'],
    limitations:'Update callbacks per wall second, not presented frames. Headless Chromium paces requestAnimationFrame, so caps above it measure the browser rate.'};
   fs.writeFileSync(path.join(out,'fps417-result.json'),JSON.stringify(report,null,2)+'\n');
   console.log('FPS417_RESULT '+JSON.stringify({status:report.status,source_sha:sha,run_id:runId,
    caps:cases.counter_reports_measured,replay:cases.replay_match_across_caps.verdict}));
  }catch(e){
   const diag={status:'FAIL',source_sha:sha,run_id:runId,error:String(e),cases,evidence,browser_errors:errors};
   for(const [name,p] of [['desktop',page],['phone',phone]]){
    if(!p)continue;
    diag[name]=await p.evaluate(()=>({counter:window.riderFpsCounter??null,world:window.riderFps356World??null,
     replay:window.riderReplay?{recording:window.riderReplay.recording,play:window.riderReplay.play,x:window.riderReplay.x,resets:window.riderReplay.resets}:null,
     hud:window.riderHud??null})).catch(err=>({capture_error:String(err)}));
    await p.screenshot({path:path.join(out,`fps417-${name}-failed.png`),timeout:5000}).catch(()=>{});
   }
   fs.writeFileSync(path.join(out,'fps417-failed.json'),JSON.stringify(diag,null,2)+'\n');
   console.error('FPS417_FAIL '+JSON.stringify({error:diag.error,source_sha:sha,run_id:runId}));
   throw e;
  }finally{
   if(browser)await browser.close().catch(()=>{});
   await new Promise(resolve=>server.close(resolve));
  }
 })().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
}
