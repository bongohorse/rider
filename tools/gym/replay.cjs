// A21 record and replay: a keyboard run recorded from the station start, replayed on the same and on other presets
// with a sprite-only ghost; tick policy, tolerances, pause/slow motion, render rate, resets and the input surfaces.
// Debug gym case `a21`. Tolerances are declared in main/gym/replay.lua (M.TOLERANCE) before any run.
const {configure}=require('./launch.cjs');
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const TOL={position_m:0.05,angle_rad:0.05};
(async()=>{
 const [root,sha,runId]=process.argv.slice(2);const out=path.resolve(root);let browser;
 function find(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()){const v=find(p);if(v)return v;}else if(e.name==='index.html')return p;}}
 const web=path.dirname(find(path.resolve(process.argv[6]))),errors=[],cases=[],measurements={};
 const server=http.createServer((req,res)=>{const file=path.resolve(web,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(web+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',file.endsWith('.wasm')?'application/wasm':file.endsWith('.js')?'text/javascript':'text/html');fs.createReadStream(file).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let page;
 try{
  browser=await chromium.launch();
  const url='http://127.0.0.1:'+server.address().port+'/index.html';
  async function newPage(query,options={}){
   page=await browser.newPage({viewport:{width:1280,height:720},...options});
   // Test-page render-rate control: with window.riderHalfRate every other animation frame is skipped, so the
   // engine renders at 30 FPS while its fixed 60 Hz physics runs two ticks per frame. The game is unchanged.
   await page.addInitScript(()=>{const raf=window.requestAnimationFrame.bind(window);let n=0;
    window.requestAnimationFrame=cb=>raf(function tick(t){if(window.riderHalfRate&&(n++%2===0))return raf(tick);cb(t);});});
   await configure(page,runId,process.argv[5]);
   page.on('pageerror',e=>errors.push(e.message));
   page.on('console',m=>{const t=m.text();if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(t))errors.push(t);});
   await page.goto(url+query);
   await wait(({sha,runId})=>window.riderReady?.source_sha===sha&&window.riderReady?.run_id===runId&&window.riderReplay?.ticks>30,{sha,runId});
  }
  // Interval polling: Playwright's default requestAnimationFrame polling stalls under the half-rate frame skip.
  const wait=(fn,arg,options={})=>page.waitForFunction(fn,arg,{polling:50,...options});
  const R=()=>page.evaluate(()=>window.riderReplay);
  const E=()=>page.evaluate(()=>window.riderReplayEditor);
  const sleep=ms=>page.waitForTimeout(ms);
  // Hold a key until the game acknowledges it, then release (engine pitfall 5).
  // The engine samples keys once per frame: leave a few frames after the release so a next press is a new edge.
  async function press(key,until,arg,timeout=15000){await page.keyboard.down(key);await wait(until,arg,{timeout});await page.keyboard.up(key);await sleep(80);}
  async function hold(key,ms){await page.keyboard.down(key);await sleep(ms);await page.keyboard.up(key);}
  const statusHas=text=>wait(t=>window.riderReplay.status.includes(t),text);
  // A replay (G) from the station start, run to the end of its commands.
  async function replay(label,during){
   const before=await R();
   await press('g',r=>window.riderReplay.play?.active&&window.riderReplay.resets===r+1,before.resets);
   let s=await R();
   assert(s.play.index<60,label+': replay starts at the station start');
   assert.equal(s.ghost.count,3,label+': ghost objects');assert.equal(s.ghost.sprites,4,label+': ghost sprites');
   // The ghost renders only: the world keeps the terrain and the three vehicle bodies.
   assert.equal(s.bodies,before.bodies,label+': ghost added bodies');assert.equal(s.shapes,before.shapes,label+': ghost added shapes');assert.equal(s.joints,before.joints);
   const start={frames:s.frames,ticks:s.ticks};
   if(during)await during(s);
   await wait(()=>window.riderReplay.play?.ended==='done',null,{timeout:60000});
   s=await R();
   const p=s.play;
   // Every recorded tick is applied once; every pose is compared, including the trailing post-step pose.
   assert.equal(p.applied,p.ticks,label+': every recorded tick applied once');assert.equal(p.compared,p.ticks+(s.recording.trailing?1:0),label+': every pose compared');
   assert.equal(s.recording.trailing,true,label+': trailing pose recorded');
   assert.equal(s.ghost.count,3,label+': the ghost stays at its final pose');
   const r={preset:p.preset,modified:p.modified,recorded_preset:s.recording.preset,ticks:p.ticks,verdict:p.verdict,mismatches:p.mismatches,scaled_ticks:p.scaled_ticks,
    max_position_m:+p.max_position_m.toFixed(6),max_angle_rad:+p.max_angle_rad.toFixed(6),final_dx_m:+p.final_dx_m.toFixed(4),final_position_m:+p.final_position_m.toFixed(4),
    frames_per_tick:+((s.frames-start.frames)/(s.ticks-start.ticks)).toFixed(3),status:s.status};
   return r;
  }

  await newPage('?station=gaps');
  let s=await R(),ed=await E();
  const grid0=ed.grid,rev0=ed.revision,undo0=ed.undo;
  assert.equal(ed.mode,'play');assert.equal(s.recording,false);assert.equal(s.play,false);assert.equal(s.ghost.count,0);
  assert.equal(s.bodies,4,'terrain + chassis + two wheels');
  measurements.world={bodies:s.bodies,joints:s.joints,shapes:s.shapes};

  // 1. G without a recording: refused visibly; B/G never touch the editor in Play.
  await press('g',()=>window.riderReplay.status.includes('No recording'));
  s=await R();assert.equal(s.play,false);assert.equal(s.resets,0);
  cases.push('replay_without_recording_refused');

  // 2. Record a keyboard run from the station start (B = Retry + tick 1), then stop it with B.
  await press('b',()=>window.riderReplay.recording?.active&&window.riderReplay.resets===1);
  s=await R();
  assert.equal(s.recording.version,1);assert.equal(s.recording.station,'gaps');assert.equal(s.recording.start_speed,7);assert.equal(s.recording.preset,'a');
  assert.equal(s.recording.source_sha,sha);assert(s.recording.ticks<30,'recording starts at the station start');
  await hold('ArrowUp',900);
  await page.keyboard.down('ArrowUp');await hold('a',350);await page.keyboard.up('ArrowUp');
  await sleep(500);await hold('d',300);await hold('ArrowUp',700);await hold('ArrowDown',400);await sleep(400);
  await press('b',()=>!window.riderReplay.recording.active);
  s=await R();ed=await E();
  assert.equal(s.recording.ended,'stopped');assert.equal(s.recording.error,false);assert.equal(s.recording.scaled_ticks,0,'recorded at 1.0');
  assert(s.recording.ticks>150,'recording length '+s.recording.ticks);
  const c=s.recording.commands;assert(c.throttle>60&&c.lean>10&&c.brake>5,'recorded command mix '+JSON.stringify(c));
  assert.equal(ed.mode,'play');assert.equal(ed.grid,grid0);assert.equal(ed.revision,rev0);assert.equal(ed.undo,undo0,'B/G changed editor state in Play');
  measurements.recording={ticks:s.recording.ticks,seconds:+(s.recording.ticks/60).toFixed(3),commands:c,preset:s.recording.preset,section:s.recording.section,start_speed:s.recording.start_speed};
  const ticks=s.recording.ticks;
  cases.push('record_from_station_start');

  // 3. Good trace: replay on the same preset at 60 FPS; live keys held during the replay are ignored.
  measurements.same_60=await replay('same 60',async()=>{await page.keyboard.down('ArrowUp');await hold('a',400);await page.keyboard.up('ArrowUp');});
  let m=measurements.same_60;
  assert.equal(m.ticks,ticks);assert.equal(m.mismatches,0,'live input reached a replay');assert.equal(m.scaled_ticks,0);
  assert.equal(m.verdict,'MATCH');assert(m.max_position_m<=TOL.position_m&&m.max_angle_rad<=TOL.angle_rad);
  assert(m.frames_per_tick>0.85&&m.frames_per_tick<1.15,'60 FPS render: '+m.frames_per_tick);
  s=await R();assert.equal(s.held,0,'held keys cleared after the replay');
  cases.push('good_trace_same_preset_60fps');

  // 4. Same good trace at a 30 FPS render rate (60 Hz physics unchanged: two ticks per frame).
  await page.evaluate(()=>{window.riderHalfRate=true;});
  measurements.same_30=await replay('same 30');
  await page.evaluate(()=>{window.riderHalfRate=false;});
  m=measurements.same_30;
  assert.equal(m.mismatches,0);assert.equal(m.scaled_ticks,0);assert.equal(m.verdict,'MATCH');
  assert(m.frames_per_tick>0.4&&m.frames_per_tick<0.6,'30 FPS render: '+m.frames_per_tick);
  cases.push('good_trace_same_preset_30fps');

  // 5. Pause in the middle of a replay: no tick, no replay or ghost progress; resume continues to the same result.
  measurements.pause=await replay('pause',async()=>{
   await wait(()=>window.riderReplay.play.index>60);
   await press('Space',()=>window.riderReplay.paused);
   const a=await R();await sleep(1000);
   // B and G presses while paused are dropped.
   await press('g',n=>window.riderReplay.dropped>n,a.dropped);await press('b',n=>window.riderReplay.dropped>n,a.dropped+1);
   const b=await R();
   assert.equal(b.ticks,a.ticks,'ticks while paused');assert.equal(b.play.index,a.play.index,'replay index while paused');
   assert.equal(b.ghost.x,a.ghost.x);assert.equal(b.x,a.x);assert.equal(b.play.active,true);assert.equal(b.recording.ticks,ticks);
   assert(b.frames-a.frames>=10,'rendering continued while paused');
   measurements.pause_window={ticks:b.ticks-a.ticks,frames:b.frames-a.frames,index:a.play.index,dropped:b.dropped-a.dropped};
   await press('Space',()=>!window.riderReplay.paused);
  });
  m=measurements.pause;assert.equal(m.verdict,'MATCH');assert.equal(m.mismatches,0);assert.equal(m.scaled_ticks,0);
  cases.push('pause_freezes_replay');

  // 6. Another preset: P switches in the same world (the recording survives), G replays the A run on B and C.
  for(const key of ['b','c']){
   await press('p',k=>window.riderReplay.preset===k,key);
   s=await R();assert.equal(s.recording.ticks,ticks);assert.equal(s.recording.preset,'a');
   measurements['preset_'+key]=await replay('preset '+key,async()=>{
    await wait(()=>window.riderReplay.play.index>90);
    await page.screenshot({path:path.join(out,`replay-a-vs-${key}.png`)});
    const v=await R();assert(v.ghost.x>0&&v.x>0,'ghost and live vehicle on the track');
    measurements['preset_'+key+'_shot']={tick:v.play.index,ghost_x:v.ghost.x,live_x:v.x};
   });
   m=measurements['preset_'+key];
   assert.equal(m.preset,key);assert.equal(m.recorded_preset,'a');assert.equal(m.mismatches,0,'identical commands');assert.equal(m.verdict,'COMPARED');
   assert(m.max_position_m>0,'presets produced identical runs');
  }
  cases.push('replay_on_other_presets_side_by_side');
  // A finished replay keeps its ghost and result only until the next reset (R here, V in case 15).
  s=await R();assert.equal(s.ghost.count,3);assert.equal(s.play.ended,'done');
  await press('r',r=>window.riderReplay.resets===r+1,s.resets);
  s=await R();assert.equal(s.play,false);assert.equal(s.ghost.count,0);assert(!s.status.includes('COMPARED'),'stale result: '+s.status);
  // Back to A through the rest of the registry (#199: P cycles A-B-C-D-E).
  for(const key of ['d','e','a'])await press('p',k=>window.riderReplay.preset===k,key);
  cases.push('finished_replay_cleared_by_retry');

  // 7. Deliberately bad trace: one recorded command block perturbed (full lean against the recording, ticks 30-89) must diverge.
  await page.evaluate(()=>{window.riderReplayDebug={fault:'perturb'};});
  measurements.bad_perturbed=await replay('perturbed');
  await page.evaluate(()=>{window.riderReplayDebug={};});
  m=measurements.bad_perturbed;
  assert.equal(m.mismatches,60);assert.equal(m.verdict,'DIVERGED');assert(m.max_position_m>TOL.position_m||m.max_angle_rad>TOL.angle_rad);
  cases.push('bad_trace_diverges');

  // 7b. Player tick policy: a replay whose tick counter skips once (debug fault) stops on the gap.
  await page.evaluate(()=>{window.riderReplayDebug={fault:'gap'};});
  s=await R();
  await press('g',r=>window.riderReplay.play?.active&&window.riderReplay.resets===r+1,s.resets);
  await page.evaluate(()=>{window.riderReplayDebug={};});
  await wait(()=>window.riderReplay.play.ended==='tick gap');
  s=await R();assert.equal(s.ghost.count,0);assert.equal(s.play.index,31);assert(s.status.includes('Replay stopped: tick gap'));
  measurements.player_gap={ended:s.play.ended,index:s.play.index};
  cases.push('player_stops_on_tick_gap');

  // 8. Slow motion: a replay at 0.5x runs but is marked not comparable.
  await press('x',()=>window.riderTimeState?.step===0.5&&window.riderReplay.factor===0.5);
  measurements.slow=await replay('slow');
  for(let i=0;i<2&&(await R()).factor!==1;i++){const f=(await R()).factor;await press('x',f=>window.riderReplay.factor!==f,f);}
  m=measurements.slow;assert.equal(m.verdict,'NOT COMPARABLE');assert(m.scaled_ticks>0);assert(m.status.includes('NOT COMPARABLE'));
  s=await R();assert.equal(s.factor,1);
  cases.push('slow_motion_not_comparable');

  // 9. Overlay buttons (mouse): Replay, then Retry (R) ends it and removes the ghost; the recording stays.
  async function click(name,until,arg){
   const p=await page.evaluate(name=>{const c=document.querySelector('canvas'),r=c.getBoundingClientRect(),q=window.riderHud[name];return {x:r.x+q.x/c.width*r.width,y:r.y+(1-q.y/c.height)*r.height};},name);
   await page.mouse.move(p.x,p.y);await page.mouse.down();await wait(until,arg);await page.mouse.up();
  }
  s=await R();
  await click('replay',r=>window.riderReplay.play?.active&&window.riderReplay.resets===r+1,s.resets);
  await wait(()=>window.riderReplay.play.index>30);
  await press('r',()=>window.riderReplay.play.ended==='manual');
  s=await R();assert.equal(s.ghost.count,0);assert.equal(s.recording.ticks,ticks);
  await click('replay',r=>window.riderReplay.play?.active&&window.riderReplay.resets===r+1,s.resets);
  await click('replay',()=>window.riderReplay.play.ended==='stopped');
  s=await R();assert.equal(s.ghost.count,0);
  cases.push('overlay_buttons_and_retry_end_replay');

  // 10. Recording cap (debug-reduced to 120 ticks): stops with "full".
  await page.evaluate(()=>{window.riderReplayDebug={cap:120};});
  await click('record',()=>window.riderReplay.recording?.active&&window.riderReplay.recording.cap===120);
  await wait(()=>window.riderReplay.recording.ended==='full');
  s=await R();assert.equal(s.recording.ticks,120);assert.equal(s.recording.error,false);
  await page.evaluate(()=>{window.riderReplayDebug={};});
  measurements.cap={ticks:s.recording.ticks,status:s.status};
  cases.push('recording_cap');

  // 11. Tick policy: a missing or repeated tick invalidates the recording; replay is refused.
  measurements.tick_policy={};
  for(const fault of ['skip','duplicate']){
   await page.evaluate(f=>{window.riderReplayDebug={fault:f};},fault);
   await press('b',()=>window.riderReplay.recording?.active);
   await wait(()=>window.riderReplay.recording.error);
   s=await R();assert.equal(s.recording.ended,'tick gap');assert.match(s.recording.error,/tick gap at tick 3[0-2]/);
   await page.evaluate(()=>{window.riderReplayDebug={};});
   await press('g',()=>window.riderReplay.status.includes('press B to record again'));
   s=await R();assert.equal(s.play,false);assert.equal(s.ghost.count,0);
   measurements.tick_policy[fault]=s.recording.error;
  }
  cases.push('tick_gap_refused');

  // 13. Every reset ends an active recording and keeps it: P (preset), R (manual).
  measurements.active_ends={};
  for(const [key,reason] of [['p','preset'],['r','manual']]){
   await press('b',()=>window.riderReplay.recording?.active);await sleep(300);
   await press(key,r=>window.riderReplay.recording.ended===r,reason);
   s=await R();assert.equal(s.recording.error,false);assert(s.recording.ticks>0);assert.equal(s.recording.trailing,true);
   measurements.active_ends[reason]=s.recording.ticks;
  }
  for(const key of ['c','d','e','a'])await press('p',k=>window.riderReplay.preset===k,key);
  cases.push('active_recording_ended_by_resets');

  // 14. A run recorded into a crash (head contact with crash on: full throttle, lean back) and replayed: the result
  // stays visible with the tick reached, on the same preset and on another preset.
  await press('c',()=>window.riderTelemetry?.crash_enabled===true);
  await page.keyboard.down('b');await wait(()=>window.riderReplay.recording?.active);await page.keyboard.up('b');
  await page.keyboard.down('ArrowUp');await page.keyboard.down('a');
  await wait(()=>!window.riderReplay.recording.active,null,{timeout:20000});
  await page.keyboard.up('ArrowUp');await page.keyboard.up('a');
  s=await R();assert.equal(s.recording.ended,'head');assert.equal(s.recording.trailing,true);
  const crashTicks=s.recording.ticks;measurements.crash={recording_ticks:crashTicks,recording_ended:'head'};
  for(const key of ['a','b']){
   if(key==='b')await press('p',()=>window.riderReplay.preset==='b');
   s=await R();
   await press('g',r=>window.riderReplay.play?.active&&window.riderReplay.resets===r+1,s.resets);
   await wait(()=>window.riderReplay.play.ended,null,{timeout:30000});
   s=await R();const p=s.play;
   assert.equal(s.ghost.count,p.ended==='done'?3:0);assert.equal(p.mismatches,0);
   if(key==='a'){
    assert.equal(p.ended,'head');assert.equal(p.complete,true);assert.equal(p.index,crashTicks);assert.equal(p.compared,crashTicks+1);assert.equal(p.verdict,'MATCH');
    assert(s.status.includes(`ended by head contact at tick ${crashTicks}/${crashTicks}`)&&s.status.includes('MATCH'),s.status);
   }else{
    assert.equal(p.verdict,'COMPARED');assert(['head','bounds','done'].includes(p.ended));
    assert(s.status.includes('COMPARED')&&(p.ended==='done'||s.status.includes(`at tick ${p.index}/${crashTicks}`)),s.status);
   }
   measurements.crash[key]={ended:p.ended,index:p.index,verdict:p.verdict,max_position_m:+p.max_position_m.toFixed(6),final_dx_m:+p.final_dx_m.toFixed(4),status:s.status};
   // The result stays until the next reset clears it.
   await press('r',r=>window.riderReplay.resets===r+1,s.resets);
   s=await R();assert.equal(s.play,false);assert.equal(s.ghost.count,0);
  }
  for(const key of ['c','d','e','a'])await press('p',k=>window.riderReplay.preset===k,key);
  await press('c',()=>window.riderTelemetry?.crash_enabled===false);
  cases.push('crash_end_keeps_result');

  // 15. Another section (V) is another start: V clears a finished replay's ghost and ends an active recording;
  // a recording from another section is refused.
  await press('b',()=>window.riderReplay.recording?.active);await sleep(600);await press('b',()=>!window.riderReplay.recording.active);
  s=await R();
  await press('g',r=>window.riderReplay.play?.active&&window.riderReplay.resets===r+1,s.resets);
  await wait(()=>window.riderReplay.play.ended==='done');
  s=await R();const sec=s.section;assert.equal(s.ghost.count,3);
  await press('v',p=>window.riderReplay.section!==p,sec);
  s=await R();assert.equal(s.play,false);assert.equal(s.ghost.count,0);assert(!s.status.includes('MATCH'),'stale result: '+s.status);
  await press('b',()=>window.riderReplay.recording?.active);await sleep(300);
  const sec2=(await R()).section;
  await press('v',()=>window.riderReplay.recording.ended==='section');
  s=await R();assert.equal(s.recording.section,sec2);assert.notEqual(s.section,sec2);
  await press('g',()=>window.riderReplay.status.includes('Recorded on another start'));
  s=await R();assert.equal(s.play,false);
  cases.push('section_switch_clears_and_refuses');

  // 16. A station switch reloads the world: the recording is discarded.
  await press('1',()=>window.riderReplay?.station==='straight'&&window.riderReplay.ticks>10);
  s=await R();assert.equal(s.recording,false);assert.equal(s.ghost.count,0);
  await press('g',()=>window.riderReplay.status.includes('No recording'));
  cases.push('station_switch_discards');

  // 17. Edit mode: G stays the editor's grid key and replays nothing; B changes nothing; Edit/Play reloads the
  // world and discards the recording made before.
  await press('b',()=>window.riderReplay.recording?.active);await sleep(400);await press('b',()=>!window.riderReplay.recording.active);
  s=await R();assert(s.recording.ticks>0);
  await press('e',()=>window.riderReplayEditor.mode==='edit');
  await sleep(300);ed=await E();const g=ed.grid,rev=ed.revision,undo=ed.undo;
  await press('g',g=>window.riderReplayEditor.grid!==g,g);
  await press('g',g=>window.riderReplayEditor.grid===g,g);
  await hold('b',200);await sleep(200);
  ed=await E();assert.equal(ed.mode,'edit');assert.equal(ed.grid,g);assert.equal(ed.revision,rev,'B edited the document');assert.equal(ed.undo,undo);
  await press('Enter',()=>window.riderReplayEditor.mode==='play'&&window.riderReplay?.station!=='straight'&&window.riderReplay.ticks>10,undefined,30000);
  s=await R();assert.equal(s.recording,false,'Edit/Play kept the recording');assert.equal(s.ghost.count,0);
  measurements.edit={grid_toggled:true,revision_unchanged:true,play_station:s.station};
  cases.push('edit_mode_g_is_grid_and_play_discards');
  await page.close();

  // 18. Touch toolbar (synthetic clicks, ?touch=1): Record run / Replay run.
  await newPage('?station=gaps&touch=1',{viewport:{width:900,height:500},hasTouch:true});
  const tap=label=>page.getByRole('button',{name:label,exact:true}).click();
  await tap('Record run');await wait(()=>window.riderReplay.recording?.active);
  await sleep(1500);
  await tap('Record run');await wait(()=>window.riderReplay.recording&&!window.riderReplay.recording.active);
  await tap('Replay run');await wait(()=>window.riderReplay.play?.active);
  await wait(()=>window.riderReplay.play.ended==='done',null,{timeout:30000});
  s=await R();
  assert.equal(s.play.verdict,'MATCH');assert.equal(s.play.mismatches,0);
  const text=await page.evaluate(()=>document.querySelector('#rider-mobile [data-replay]')?.textContent||'');
  assert(text.includes('MATCH'),'touch readout: '+text);
  await page.screenshot({path:path.join(out,'replay-touch.png')});
  measurements.touch={ticks:s.play.ticks,verdict:s.play.verdict,max_position_m:s.play.max_position_m,readout:text,evidence:'synthetic Playwright clicks, not a device'};
  cases.push('touch_toolbar_synthetic');

  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'replay-result.json'),JSON.stringify({status:'PASS',source_sha:sha,run_id:runId,tolerance:TOL,cases,measurements},null,1));
  console.log(JSON.stringify({cases,measurements}));
 }catch(e){
  console.error(e);
  try{if(page)await page.screenshot({path:path.join(out,'replay-failure.png')});console.error(JSON.stringify(await page.evaluate(()=>({r:window.riderReplay,e:window.riderReplayEditor,t:window.riderTimeState}))));}catch{}
  console.error('errors',errors);
  process.exitCode=1;
 }finally{await browser?.close();server.close();}
})();
