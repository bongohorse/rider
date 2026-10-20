// LE2: editor shell and Edit <-> Play loop in the debug HTML5 gym (level-editor contract R3, R9-R13, R15-R17).
const {configure}=require('./launch.cjs');
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
(async()=>{
 const [root,sha,runId]=process.argv.slice(2);const out=path.resolve(root);let browser;
 function find(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()){const v=find(p);if(v)return v;}else if(e.name==='index.html')return p;}}
 const web=path.dirname(find(path.resolve(process.argv[6]))),errors=[],finishes=[],cases=[],measurements={};
 const server=http.createServer((req,res)=>{const file=path.resolve(web,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(web+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',file.endsWith('.wasm')?'application/wasm':file.endsWith('.js')?'text/javascript':'text/html');fs.createReadStream(file).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1280,height:720}});
  await configure(page,runId,process.argv[5]);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{const t=m.text();if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(t))errors.push(t);const r=t.match(/GYM_FINISH (\{.*\})/);if(r)finishes.push(JSON.parse(r[1]));});
  const base='http://127.0.0.1:'+server.address().port+'/index.html';
  const ed=()=>page.evaluate(()=>window.riderEditor);
  const tm=()=>page.evaluate(()=>window.riderTelemetry);
  // Engine input is sampled per frame: hold every key across a few frames.
  // Modifiers go down a few frames earlier, as a person holds Ctrl/Shift before the key.
  async function key(name,mods=[]){
   for(const m of mods)await page.keyboard.down(m);
   if(mods.length)await page.waitForTimeout(60);
   await page.keyboard.down(name);await page.waitForTimeout(90);await page.keyboard.up(name);
   for(const m of mods.reverse())await page.keyboard.up(m);
   await page.waitForTimeout(60);
  }
  const canvas=(x,y)=>page.evaluate(([x,y])=>{const c=document.querySelector('canvas'),r=c.getBoundingClientRect();return {x:r.x+x/c.width*r.width,y:r.y+(1-y/c.height)*r.height};},[x,y]);
  async function world(p){const s=(await ed()).screen;return canvas(s.ox+p[0]*s.ppm_x,s.oy+p[1]*s.ppm_y);}
  async function click(at,mods=[]){
   for(const m of mods)await page.keyboard.down(m);
   if(mods.length)await page.waitForTimeout(60);
   await page.mouse.move(at.x,at.y);await page.waitForTimeout(50);await page.mouse.down();await page.waitForTimeout(90);await page.mouse.up();await page.waitForTimeout(60);
   for(const m of mods)await page.keyboard.up(m);
  }
  async function button(name,mods){const b=(await ed()).buttons[name];await click(await canvas(b.x,b.y),mods);}
  async function edit(){await page.waitForFunction(()=>window.riderEditor?.mode==='edit'&&window.riderEditor.view&&window.riderEditor.screen,null,{timeout:20000});await page.waitForTimeout(150);return ed();}
  // A Play run is ready when the world for the newest generation reports telemetry.
  // Telemetry of the previous Play world survives until the new one reports: require a newer generation than the last edit world.
  async function played(id){
   const after=(await ed())?.view?.generation??0;
   await page.waitForFunction(({id,after})=>window.riderEditor?.mode==='play'&&window.riderTelemetry?.station===id&&window.riderTelemetry.sequence>2&&window.riderTelemetry.session_generation>after
    &&window.riderWorldCounts?.generation===window.riderTelemetry.session_generation,{id,after},{timeout:20000});
   return tm();
  }
  async function revision(n){await page.waitForFunction(n=>window.riderEditor.revision===n,n);return ed();}
  const counts=async()=>{const t=await tm(),w=await page.evaluate(()=>window.riderWorldCounts);return {terrain_shapes:t.terrain_shapes,decor_sprites:t.decor_sprites,decor_labels:t.decor_labels,bodies:w.bodies,joints:w.joints,shapes:w.shapes};};
  const near=(a,b,eps=1e-6)=>Math.abs(a-b)<=eps;

  // 1. Template from a built-in station; held throttle -> E -> release -> Play is neutral.
  await page.goto(base+'?station=ramps');
  await page.waitForFunction(()=>window.riderTelemetry?.station==='ramps'&&window.riderTelemetry.sequence>2);
  await page.locator('canvas').focus();await page.keyboard.down('ArrowUp');
  await page.waitForFunction(()=>window.riderTelemetry.command.throttle===1);
  await key('e');let e=await edit();
  await page.keyboard.up('ArrowUp');
  assert.equal(e.id,'my-ramps');assert.equal(e.name,'Ramps short copy');assert.equal(e.revision,0);assert.equal(e.start.speed,8);
  assert.equal(new URL(page.url()).searchParams.get('station'),'custom');
  measurements.template={id:e.id,objects:e.objects,view:e.view};cases.push('template_copy_opens_editor');

  // 2. Edit mode intercepts every game key and the page shortcuts (R15).
  const before=await page.evaluate(()=>({feedback:window.riderFeedback.status,generation:window.riderEditor.view.generation,objects:window.riderEditor.objects}));
  for(const k of ['1','2','p','c','r','t','m','v'])await key(k);
  await page.evaluate(()=>{for(const code of ['KeyF','KeyI'])document.dispatchEvent(new KeyboardEvent('keydown',{code,bubbles:true}));});
  await page.waitForTimeout(300);
  e=await ed();
  assert.equal(e.mode,'edit');assert.equal(e.view.generation,before.generation,'a game key reloaded the world');
  assert.equal(await page.evaluate(()=>window.riderCustom.visible),false);assert.equal(await page.evaluate(()=>window.riderFeedback.status),before.feedback);
  assert.equal(await page.evaluate(()=>document.getElementById('custom-import').hidden),true);
  // P and C are the editor's Prefab and Curve tool keys (contract controls), not the game's preset cycle and
  // crash toggle; C came last. S returns to Select.
  assert.equal(e.tool,'curve');assert.equal(e.objects,before.objects);await key('s');assert.equal((await ed()).tool,'select');
  cases.push('edit_mode_input_gating');

  // 3. Drag START: one Undo step; Undo/Redo restore by stable id.
  const start0=e.start.position;
  let at=await world([start0[0],start0[1]]);await page.mouse.move(at.x,at.y);await page.waitForTimeout(60);await page.mouse.down();await page.waitForTimeout(60);
  for(let i=1;i<=5;i++){const p=await world([start0[0]+2*i,start0[1]]);await page.mouse.move(p.x,p.y);await page.waitForTimeout(40);}
  await page.mouse.up();e=await revision(1);
  assert.ok(near(e.start.position[0],start0[0]+10,0.05)&&near(e.start.position[1],start0[1],0.05),JSON.stringify(e.start));
  assert.equal(e.selection,'start');assert.equal(e.undo,1);
  await key('z',['Control']);e=await revision(2);assert.deepEqual(e.start.position,start0);assert.equal(e.redo,1);
  await key('y',['Control']);e=await revision(3);assert.ok(near(e.start.position[0],start0[0]+10,0.05));assert.equal(e.redo,0);
  const start=e.start.position;cases.push('start_drag_undo_redo');

  // 4. Focus loss cancels a drag; the click that refocuses the canvas never edits.
  at=await world(start);await page.mouse.move(at.x,at.y);await page.waitForTimeout(60);await page.mouse.down();await page.waitForTimeout(60);
  at=await world([start[0]+6,start[1]]);await page.mouse.move(at.x,at.y);await page.waitForTimeout(100);
  await page.evaluate(()=>document.querySelector('canvas').blur());await page.waitForTimeout(150);
  await page.mouse.up();await page.locator('canvas').focus();
  // The click that returns focus is ignored: it neither clears the selection nor edits.
  at=await world([start[0]+20,start[1]+5]);await page.mouse.move(at.x,at.y);await page.mouse.down();await page.waitForTimeout(40);await page.mouse.up();
  await page.waitForTimeout(400);
  e=await ed();assert.equal(e.revision,3);assert.deepEqual(e.start.position,start);assert.equal(e.selection,'start');cases.push('focus_loss_cancels_drag');

  // 5. FINISH tool: place it 25 m right of START on the ground line.
  await button('tool_finish');
  const finishAt=[start[0]+25,1.2];await click(await world(finishAt));e=await revision(4);
  assert.equal(e.finish.direction,1);assert.ok(near(e.finish.position[0],finishAt[0],0.1));
  await button('tool_select');
  const camera=e.camera;await page.waitForFunction(()=>window.riderEditor.status==='Saved');cases.push('finish_placed');

  // 6. Play from START: neutral input, FINISH once per attempt, re-armed by Retry.
  await key('e');let t=await played('my-ramps');
  assert.equal(t.command.throttle,0);assert.equal(t.finish,true);assert.equal(t.finish_count,0);
  await page.waitForFunction(()=>window.riderCustomStatus==='Saved');
  const saved=await page.evaluate(()=>window.riderSavedLevel);
  assert.equal(saved.kind,undefined);assert.equal(saved.sections,undefined);assert.equal(saved.markers,undefined);assert.deepEqual(saved.checkpoints,[]);
  assert.deepEqual(saved.spawn,start);assert.equal(saved.editor.compiled_revision,4);
  // Keys pressed in Edit mode (P, C, M, T, 1, 2, R, V) changed nothing in the game.
  assert.equal(t.preset,'a');assert.equal(t.crash_enabled,false);assert.equal(t.audio_muted,false);assert.equal(await page.evaluate(()=>window.riderHud.tuning),false);
  const play0=await counts();
  await page.locator('canvas').focus();await page.keyboard.down('ArrowUp');
  try{await page.waitForFunction(()=>window.riderTelemetry.finish_count===1,null,{timeout:30000});await page.waitForTimeout(1500);}
  finally{await page.keyboard.up('ArrowUp');}
  t=await tm();assert.equal(t.finish_count,1);assert.equal(t.finish_done,true);assert.ok(t.finish_time>0);
  await key('r');await page.waitForFunction(n=>window.riderTelemetry.reset_count===n+1&&window.riderTelemetry.finish_done===false,t.reset_count);
  await page.keyboard.down('ArrowUp');
  try{await page.waitForFunction(()=>window.riderTelemetry.finish_count===2,null,{timeout:30000});}finally{await page.keyboard.up('ArrowUp');}
  measurements.finish={first_time_s:t.finish_time,events:finishes.length};cases.push('finish_once_per_attempt_rearmed');

  // 7. E while driving returns to the last editor view; nothing is lost.
  await page.keyboard.down('ArrowUp');await key('e');e=await edit();await page.keyboard.up('ArrowUp');
  assert.deepEqual(e.camera,camera);assert.equal(e.revision,4);assert.deepEqual(e.start.position,start);assert.equal(e.undo,2);cases.push('edit_returns_to_editor_view');

  // 8. Against the direction nothing fires: flip FINISH and drive through it.
  await click(await world([e.finish.position[0],e.finish.position[1]+1]));await page.waitForFunction(()=>window.riderEditor.selection==='finish');
  await button('direction');e=await revision(5);assert.equal(e.finish.direction,-1);
  await key('e');t=await played('my-ramps');
  await page.locator('canvas').focus();await page.keyboard.down('ArrowUp');
  try{await page.waitForFunction(x=>window.riderTelemetry.station_distance>x,27,{timeout:30000});}finally{await page.keyboard.up('ArrowUp');}
  t=await tm();assert.equal(t.finish_count,0);
  await key('e');e=await edit();
  await click(await world([e.finish.position[0],e.finish.position[1]+1]));await page.waitForFunction(()=>window.riderEditor.selection==='finish');
  await button('direction');e=await revision(6);assert.equal(e.finish.direction,1);cases.push('finish_direction_only');

  // 9. High speed through FINISH with a temporary test start: fires once; R repeats the test start.
  await key('Escape');await page.waitForFunction(()=>window.riderEditor.selection==='');
  for(let i=0;i<4;i++)await button('plus',['Shift']);
  await page.waitForFunction(()=>window.riderEditor.test_speed===20);
  const testAt=[e.finish.position[0]-4,3];at=await world(testAt);await page.mouse.move(at.x,at.y);await page.waitForTimeout(100);
  const fast=finishes.length;await key('f');t=await played('my-ramps');
  // Start on surface: the run spawns at the cursor x, 0.9 m above the terrain below it.
  assert.ok(near(t.spawn_x,testAt[0],0.05)&&t.spawn_y<testAt[1],'test start spawn '+t.spawn_x+','+t.spawn_y);assert.equal(t.start_speed,20);
  const testSpawn=[t.spawn_x,t.spawn_y];
  await page.waitForFunction(()=>window.riderTelemetry.finish_count===1,null,{timeout:10000});
  await page.waitForTimeout(800);t=await tm();assert.equal(t.finish_count,1);
  assert.equal(finishes.length,fast+1);assert.ok(finishes.at(-1).speed>15,'crossing speed '+finishes.at(-1).speed);
  await key('r');await page.waitForFunction(()=>window.riderTelemetry.reset_count===1&&window.riderTelemetry.finish_done===false);
  t=await tm();assert.deepEqual([t.spawn_x,t.spawn_y],testSpawn,'R repeats the test start');
  // Test starts are never saved or exported: the saved level keeps START, its bounds and the editor sources.
  // A test run never replaces the save: the status says so and the saved level is the earlier START level.
  await page.waitForFunction(()=>window.riderCustomStatus==='Test run; the saved level is unchanged');
  const afterTest=await page.evaluate(()=>window.riderSavedLevel);
  assert.deepEqual(afterTest.spawn,start);assert.deepEqual(afterTest.bounds,saved.bounds);assert.equal(afterTest.start_speed,8);
  measurements.high_speed={crossing_speed_mps:finishes.at(-1).speed,time_s:finishes.at(-1).time};cases.push('test_start_high_speed_finish');

  // 10. Refused test starts: no surface below, outside the bounds, inside geometry.
  await key('e');e=await edit();
  // Wheel zoom around the cursor: three steps out make the area below the bounds visible.
  at=await world([start[0]+5,2]);await page.mouse.move(at.x,at.y);
  for(let i=0;i<3;i++){await page.mouse.wheel(0,120);await page.waitForTimeout(80);}
  await page.waitForFunction(()=>Math.abs(window.riderEditor.camera.zoom-0.2/1.2**3)<1e-6);await page.waitForTimeout(100);
  e=await ed();measurements.zoom_out=e.camera;
  const refused=[];
  for(const [p,mods,expect] of [[[start[0]+5,-12],[],'no surface below'],[[start[0]+5,-12],['Shift'],'outside the level bounds'],[[start[0]+5,0.8],['Shift'],'would overlap']]){
   at=await world(p);await page.mouse.move(at.x,at.y);await page.waitForTimeout(100);await key('f',mods);
   await page.waitForFunction(x=>window.riderEditor.message.includes(x),expect);refused.push((await ed()).message);
  }
  assert.equal((await ed()).mode,'edit');measurements.refused=refused;cases.push('test_start_refusals');

  // 11. A missing FINISH does not block Play.
  await click(await world([e.finish.position[0],e.finish.position[1]+1]));await page.waitForFunction(()=>window.riderEditor.selection==='finish');
  await key('Delete');e=await revision(7);assert.equal(e.finish,false);
  await key('Enter');t=await played('my-ramps');assert.equal(t.finish,false);cases.push('play_without_finish');

  // 12. Repeated Edit <-> Play keeps shape, sprite, label, body and joint counts.
  const loop=[];let editView;
  for(let i=0;i<5;i++){
   await key('e');e=await edit();editView=editView||e.view;assert.deepEqual({...e.view,generation:0},{...editView,generation:0});
   await key('e');await played('my-ramps');loop.push(await counts());
  }
  for(const c of loop)assert.deepEqual(c,loop[0]);
  measurements.loop={play:loop[0],edit:{sprites:editView.sprites,labels:editView.labels}};cases.push('edit_play_loop_counts_stable');

  // 13. An unfinished draft survives a reload and can be edited further.
  await key('e');e=await edit();const rev=e.revision;
  at=await world(start);await page.mouse.move(at.x,at.y);await page.waitForTimeout(60);await page.mouse.down();await page.waitForTimeout(60);
  at=await world([start[0]+3,start[1]+0.5]);await page.mouse.move(at.x,at.y,{steps:3});await page.mouse.up();
  e=await revision(rev+1);const moved=e.start.position;
  await page.waitForFunction(()=>window.riderEditor.status==='Saved');
  await page.goto(base+'?station=custom');e=await edit();
  assert.deepEqual(e.start.position,moved);assert.equal(e.revision,rev+1);assert.equal(e.id,'my-ramps');assert.equal(e.undo,0);
  await button('tool_finish');await click(await world([moved[0]+22,1.2]));e=await revision(rev+2);assert.equal(e.finish.direction,1);
  await key('e');t=await played('my-ramps');assert.equal(t.finish,true);cases.push('draft_survives_reload');

  // 14. Every built-in station opens as a template copy (R3) that compiles without Play errors; Undo brings back the replaced document.
  await key('e');e=await edit();const own=e.id,ids=await page.evaluate(()=>Object.keys(window.riderEditor.buttons).filter(n=>n.startsWith('template_')).map(n=>n.slice(9)));
  assert.equal(ids.length,10);const templates={};
  for(const id of ids){
   await button('open');await page.waitForFunction(()=>window.riderEditor.open_dialog);
   await button('template_'+id);await page.waitForFunction(id=>window.riderEditor.id==='my-'+id,id);
   e=await ed();assert.equal(e.problem,'',id+': '+e.problem);templates[id]=e.objects;
  }
  for(let i=0;i<ids.length;i++)await key('z',['Control']);
  e=await page.waitForFunction(own=>window.riderEditor.id===own,own);
  e=await edit();assert.equal(e.id,own);measurements.templates=templates;cases.push('all_templates_compile_undo_restores');
  await key('e');await played(own);

  // 15. A re-imported file with the same id opens as itself, not as the editor's older document.
  const changed=await page.evaluate(()=>window.riderSavedLevel);changed.start_speed=3;changed.editor.start.speed=3;
  await page.evaluate(text=>{window.riderCustom.open();document.querySelector('#rider-custom-text').value=text;
   [...document.querySelectorAll('#rider-custom-panel button')].find(b=>b.textContent==='Import text').click();},JSON.stringify(changed));
  await page.waitForFunction(()=>!window.riderCustom.visible&&window.riderTelemetry?.start_speed===3&&window.riderCustomStatus==='Saved');
  await page.locator('canvas').focus();await key('e');e=await edit();
  assert.equal(e.id,own);assert.equal(e.start.speed,3);assert.ok(e.undo>=1,'the previous document is one Undo step away');
  await key('e');await played(own);cases.push('reimport_same_id_opens_file');

  // 16. An unplayed draft of another level reopens after a reload, whatever level is saved; once played, a reload drives it.
  await key('e');e=await edit();assert.equal(e.id,own);
  await button('open');await page.waitForFunction(()=>window.riderEditor.open_dialog);
  await button('template_steps');await page.waitForFunction(()=>window.riderEditor.id==='my-steps');
  e=await edit();await button('tool_finish');await click(await world([e.start.position[0]+12,1.2]));e=await revision(e.revision+1);
  await page.waitForFunction(()=>window.riderEditor.status==='Saved');
  await page.goto(base+'?station=custom');e=await edit();
  assert.equal(e.id,'my-steps');assert.ok(e.finish&&near(e.finish.position[0],e.start.position[0]+12,0.1),JSON.stringify(e.finish));
  // A test run of the reopened draft (my-ramps still saved) returns to that draft, not to the saved level.
  at=await world([e.start.position[0]+3,3]);await page.mouse.move(at.x,at.y);await page.waitForTimeout(100);await key('f');await played('my-steps');
  await key('e');e=await edit();assert.equal(e.id,'my-steps');
  await key('e');await played('my-steps');
  await page.waitForFunction(()=>window.riderCustomStatus==='Saved'&&window.riderEditor.status==='Saved');
  await page.goto(base+'?station=custom');t=await played('my-steps');assert.equal((await ed()).mode,'play');cases.push('other_level_draft_reopens');

  // 17. A level imported after unplayed edits wins after a reload; bounds include both ends of every edge.
  await key('e');e=await edit();await button('tool_finish');await click(await world([e.start.position[0]+16,1.2]));e=await revision(e.revision+1);
  await page.waitForFunction(()=>window.riderEditor.status==='Saved');
  at=await world([e.start.position[0]+3,3]);await page.mouse.move(at.x,at.y);await page.waitForTimeout(100);await key('f');await played('my-steps');
  await page.waitForTimeout(1100); // save times have whole-second resolution
  const ltr={schema:1,id:'flat-ltr',name:'Left to right',units:'metres',spawn:[5,1.7],start_speed:0,run_in:0,run_out:0,bounds:[-5,105,-10,20],chains:[[[0,0.8],[100,0.8]]]};
  await page.evaluate(text=>{window.riderCustom.open();document.querySelector('#rider-custom-text').value=text;
   [...document.querySelectorAll('#rider-custom-panel button')].find(b=>b.textContent==='Import text').click();},JSON.stringify(ltr));
  await page.waitForFunction(()=>!window.riderCustom.visible&&window.riderTelemetry?.station==='flat-ltr'&&window.riderCustomStatus==='Saved');
  await page.goto(base+'?station=custom');await played('flat-ltr');assert.equal((await ed()).mode,'play');
  await page.locator('canvas').focus();await key('e');e=await edit();assert.equal(e.id,'flat-ltr');assert.ok(e.undo>=1);
  at=await world([45,3]);await page.mouse.move(at.x,at.y);await page.waitForTimeout(100);await key('f');
  t=await played('flat-ltr');assert.ok(near(t.spawn_x,45,0.05),'test start at 45 m: '+t.spawn_x);
  await key('e');e=await edit();await key('e');await played('flat-ltr');
  await page.waitForFunction(()=>window.riderSavedLevel?.id==='flat-ltr');
  assert.deepEqual((await page.evaluate(()=>window.riderSavedLevel)).bounds.slice(0,2),[-10,110]);cases.push('bounds_include_line_end');
  await page.waitForFunction(()=>window.riderEditor.status==='Saved');

  // 17b. Without a restorable level a played draft still reopens in the editor (not the Import panel).
  // Remove both level slots and push that to IndexedDB (a reload reads the synced store).
  await page.evaluate(()=>new Promise((resolve,reject)=>{for(const s of ['a','b'])try{FS.unlink('/data/.rider/custom-level-'+s);}catch(e){}FS.syncfs(false,e=>e?reject(e):resolve());}));
  await page.goto(base+'?station=custom');e=await edit();assert.equal(e.id,'flat-ltr');
  assert.equal(await page.evaluate(()=>window.riderCustom.visible),false);
  await key('e');await played('flat-ltr');await page.waitForFunction(()=>window.riderCustomStatus==='Saved');cases.push('draft_opens_without_level');

  // 18. An unsupported newest draft is refused and kept unchanged; the editor opens the level instead and saves around it.
  const unknown=JSON.stringify({schema:1,units:'metres',id:'future',name:'Future',editor:{editor_version:99,compiler_version:1,revision:0,next_id:1,objects:[],start:{position:[0,1.7],speed:0}}});
  await page.evaluate(text=>{window.riderDebugDraft={slot:1,seq:999,text};},unknown);
  await page.waitForFunction(()=>window.riderDebugDraft===null);
  // sys.save only writes the in-memory file system: reload after the IndexedDB sync, or the draft is lost.
  await page.waitForFunction(()=>window.riderCustom.syncState()!=='syncing');
  assert.equal(await page.evaluate(()=>window.riderCustom.syncState()),'saved','injected draft sync');
  await page.goto(base+'?station=custom');t=await played('flat-ltr');
  await page.locator('canvas').focus();await key('e');
  e=await edit();assert.ok(e.message.includes('unsupported editor'),e.message);assert.equal(e.id,'flat-ltr');
  measurements.unsupported_message=e.message;
  await button('tool_finish');await click(await world([e.start.position[0]+15,1.2]));e=await revision(e.revision+1);
  await page.waitForFunction(()=>window.riderEditor.status==='Saved');
  const raw=await page.evaluate(()=>{const b=FS.readFile('/data/.rider/custom-draft-a');return new TextDecoder('latin1').decode(b);});
  assert.ok(raw.includes('"editor_version":99'),'unsupported draft changed');cases.push('unsupported_version_rejected');

  if(errors.length)throw Error(errors.join('\n'));
  await page.screenshot({path:path.join(out,'editor-play.png')});
  fs.writeFileSync(path.join(out,'editor-result.json'),JSON.stringify({source_sha:sha,run_id:runId,browser:browser.version(),status:'PASS',cases,measurements},null,2));
  console.log(JSON.stringify({status:'PASS',cases,measurements}));
 }catch(e){
  if(errors.length)console.error('Page errors:\n'+errors.join('\n'));
  if(browser)for(const context of browser.contexts())for(const page of context.pages()){
   console.error('State: '+JSON.stringify(await page.evaluate(()=>({editor:window.riderEditor&&{...window.riderEditor,buttons:undefined},telemetry:window.riderTelemetry&&{station:window.riderTelemetry.station,finish_count:window.riderTelemetry.finish_count,
    station_distance:window.riderTelemetry.station_distance,session_generation:window.riderTelemetry.session_generation},counts:window.riderWorldCounts,status:window.riderCustomStatus,error:window.riderStationError})).catch(()=>null)));
   await page.screenshot({path:path.join(out,'editor-failed.png')}).catch(()=>{});
  }
  throw e;
 }
 finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
