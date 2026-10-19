// LE1a: custom level import, switching, persistence and recovery in the debug HTML5 gym.
const {configure}=require('./launch.cjs');
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'../..'),SAMPLES=path.join(ROOT,'main/gym/samples');
(async()=>{
 const [root,sha,runId]=process.argv.slice(2);const out=path.resolve(root);let browser;
 function find(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()){const v=find(p);if(v)return v;}else if(e.name==='index.html')return p;}}
 const web=path.dirname(find(path.resolve(process.argv[6]))),errors=[],resets=[],cases=[],measurements={};
 const server=http.createServer((req,res)=>{const file=path.resolve(web,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(web+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',file.endsWith('.wasm')?'application/wasm':file.endsWith('.js')?'text/javascript':'text/html');fs.createReadStream(file).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const sample=name=>path.join(SAMPLES,name+'.json'),text=name=>fs.readFileSync(sample(name),'utf8');
 try{
  browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1280,height:720}});
  await configure(page,runId,process.argv[5]);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{const t=m.text();if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(t))errors.push(t);const r=t.match(/GYM_RESET (\{.*\})/);if(r)resets.push(JSON.parse(r[1]));});
  const url='http://127.0.0.1:'+server.address().port+'/index.html?station=custom';
  const state=()=>page.evaluate(()=>window.riderTelemetry);
  // Telemetry survives until the next world reports, so each wait names the expected world load.
  async function ready(id,loads,status='Saved'){
   await page.waitForFunction(({id,loads,status})=>window.riderTelemetry?.station===id&&window.riderTelemetry.world_loads===loads&&window.riderTelemetry.custom&&window.riderTelemetry.sequence>2&&(!status||window.riderCustomStatus===status),{id,loads,status},{timeout:30000});
   return state();
  }
  async function importFile(name){
   if(!await page.evaluate(()=>window.riderCustom.visible))await page.getByRole('button',{name:'Import level',exact:true}).click();
   await page.locator('#rider-custom-file').setInputFiles(sample(name));
  }
  async function importText(value){
   if(!await page.evaluate(()=>window.riderCustom.visible)){await page.locator('canvas').focus();await page.keyboard.press('i');}
   await page.locator('#rider-custom-text').fill(value);
   await page.getByRole('button',{name:'Import text',exact:true}).click();
  }
  // A key pressed while the import panel still captures input is ignored by design. Telemetry
  // lags the 0.1 s capture poll, so require two fresh samples after the panel closed.
  async function uncaptured(){
   const seq=await page.evaluate(()=>window.riderTelemetry?.sequence??-1);
   await page.waitForFunction(seq=>!window.riderCustom.visible&&window.riderTelemetry?.ui_captured===false&&(seq<0||window.riderTelemetry.sequence>seq+1),seq);
  }
  async function drive(target,ms=25000){
   await uncaptured();await page.locator('canvas').focus();await page.keyboard.down('ArrowUp');
   try{await page.waitForFunction(x=>window.riderTelemetry.station_distance>x,target,{timeout:ms});}
   finally{await page.keyboard.up('ArrowUp');}
   return state();
  }
  const counts=t=>({terrain_shapes:t.terrain_shapes,decor_sprites:t.decor_sprites,decor_labels:t.decor_labels,custom_snapshots:t.custom_snapshots});

  // No save yet: the custom entry shows Import, never a built-in station.
  await page.goto(url);
  await page.waitForFunction(()=>window.riderCustom?.visible&&window.riderStationError?.includes('No saved custom level'));
  assert.equal(await page.evaluate(()=>window.riderTelemetry),undefined);cases.push('no_save_shows_import');

  // A from a file, then drive, retry and bounds-reset like a built-in station.
  await importFile('rolling-hills');let t=await ready('rolling-hills',2);
  assert.equal(await page.evaluate(()=>window.riderCustom.visible),false);
  const a1=counts(t),loadsA=2;assert.equal(a1.custom_snapshots,1);measurements.rolling_hills=a1;
  t=await drive(30);assert.equal(t.reset_count,0);measurements.rolling_drive_m=t.station_distance;cases.push('import_file_drives_chain_level');
  let n=t.reset_count;await page.keyboard.down('r');await page.waitForFunction(n=>window.riderTelemetry.reset_count===n+1,n);await page.keyboard.up('r');
  t=await state();assert.equal(t.world_loads,loadsA);assert.equal(t.terrain_shapes,a1.terrain_shapes);
  await page.waitForFunction(()=>Math.abs(window.riderTelemetry.station_distance)<.5);cases.push('custom_retry_in_world');
  n=resets.length;await page.keyboard.down('ArrowDown');
  try{await page.waitForFunction(()=>window.riderTelemetry.reset_count>=2,null,{timeout:30000});}finally{await page.keyboard.up('ArrowDown');}
  assert(resets.slice(n).some(r=>r.reason==='bounds'),'Leaving the custom bounds did not use the bounds reset');
  assert.equal((await state()).world_loads,loadsA);cases.push('custom_bounds_reset');

  // Invalid imports keep the running level and its save.
  await importText(text('invalid-bounds'));
  await page.waitForFunction(()=>document.querySelector('#rider-custom-error')?.textContent.includes('Invalid safety bounds'));
  const expected=await page.locator('#rider-custom-error').textContent();measurements.invalid_error=expected;
  assert.equal(expected,'Import failed: Invalid safety bounds. The current level and its save are unchanged.');
  await importText('{"schema":1,');
  await page.waitForFunction(()=>document.querySelector('#rider-custom-error')?.textContent.includes('not valid JSON'));
  t=await state();assert.equal(t.station,'rolling-hills');assert.equal(t.world_loads,loadsA);cases.push('invalid_import_keeps_level');

  // B by pasted text while throttle is held: the panel captures input and the new world starts neutral.
  await page.getByRole('button',{name:'Close import',exact:true}).click();
  await uncaptured();await page.locator('canvas').focus();await page.keyboard.down('ArrowUp');
  await page.waitForFunction(()=>window.riderTelemetry.command.throttle===1);
  await page.keyboard.press('i');await page.waitForFunction(()=>window.riderTelemetry.command.throttle===0);
  await page.keyboard.up('ArrowUp'); // released while the panel has focus: the engine never sees this keyup
  await page.locator('#rider-custom-text').fill(text('kicker-platform'));
  await page.getByRole('button',{name:'Import text',exact:true}).click();
  t=await ready('kicker-platform',3);
  assert.equal(t.command.throttle,0);assert.equal(t.world_loads,loadsA+1);assert.equal(t.start_speed,7);assert.equal(t.custom_snapshots,1);
  measurements.kicker_platform=counts(t);cases.push('held_input_released_on_import');
  // The first fresh press after the import must drive (no key left stuck from before the panel).
  t=await drive(24);assert.equal(t.reset_count,0);measurements.kicker_drive_m=t.station_distance;
  await page.screenshot({path:path.join(out,'custom-kicker.png')});cases.push('kicker_platform_drives');

  // A again: identical shape/sprite/label counts, fresh world, one live snapshot; the preset survives like a station switch.
  await uncaptured();await page.locator('canvas').focus();await page.keyboard.down('p');
  await page.waitForFunction(()=>window.riderTelemetry.preset==='b');await page.keyboard.up('p');
  await importFile('rolling-hills');t=await ready('rolling-hills',4);
  assert.deepEqual(counts(t),a1);assert.equal(t.world_loads,loadsA+2);assert.equal(t.reset_count,0);assert.equal(t.preset,'b');
  await page.screenshot({path:path.join(out,'custom-rolling.png')});cases.push('A_B_A_counts_identical');

  // A newer import during a load is queued; the in-flight snapshot is never replaced.
  await page.evaluate(()=>{window.__riderSeen=new Set();const tick=()=>{if(window.riderTelemetry)window.__riderSeen.add(window.riderTelemetry.station);requestAnimationFrame(tick);};tick();});
  await page.locator('canvas').focus();await page.keyboard.press('i');
  // Submit B, then A as soon as Lua has accepted B and started its world switch (same page task, no round trip).
  await page.evaluate(async([b,a])=>{
   const field=document.querySelector('#rider-custom-text'),button=[...document.querySelectorAll('#rider-custom-panel button')].find(x=>x.textContent==='Import text');
   field.value=b;button.click();
   while(window.riderCustom.state!=='loading')await new Promise(r=>setTimeout(r,0));
   field.value=a;button.click();
  },[text('kicker-platform'),text('rolling-hills')]);
  t=await ready('rolling-hills',6);assert.deepEqual(counts(t),a1);
  assert.deepEqual(await page.evaluate(()=>[...window.__riderSeen]),['rolling-hills'],'The superseded import reported telemetry');cases.push('import_during_load_queued');

  // Reload restores the last valid level.
  await page.goto(url);t=await ready('rolling-hills',1,null);assert.deepEqual(counts(t),a1);
  assert.equal(await page.evaluate(()=>window.riderCustom.visible),false);cases.push('reload_restores_last_valid');

  // Make the two save slots differ (older: B, newer: A) so a write to the wrong slot would be detected.
  await importFile('kicker-platform');await ready('kicker-platform',2);
  await importFile('rolling-hills');await ready('rolling-hills',3);
  // Injected browser write failure: B still loads, its save fails, the previous save survives a reload.
  assert(await page.evaluate(()=>typeof FS==='object'&&typeof FS.write==='function'&&typeof FS.ErrnoError==='function'),'Emscripten FS unavailable for fault injection');
  await page.evaluate(()=>{const write=FS.write;window.__riderRestoreWrite=()=>{FS.write=write;};
   FS.write=function(stream,...rest){if(String(stream?.path||'').includes('custom-level'))throw new FS.ErrnoError(29);return write.call(this,stream,...rest);};});
  await importFile('kicker-platform');t=await ready('kicker-platform',4,null);
  await page.waitForFunction(()=>window.riderCustomStatus?.startsWith('Save failed'));measurements.save_failure=await page.evaluate(()=>window.riderCustomStatus);
  await page.evaluate(()=>window.__riderRestoreWrite());
  await page.goto(url);t=await ready('rolling-hills',1,null);assert.deepEqual(counts(t),a1);cases.push('failed_save_keeps_previous');

  // A validated level whose hull Box2D cannot build: safe error state, re-import offered, save unchanged.
  const broken=JSON.parse(text('kicker-platform'));broken.id='weld-hull';broken.name='Welded hull';
  broken.hulls=[{vertices:[[30,0.8],[30.003,0.8],[30.003,0.803]]}];
  await importText(JSON.stringify(broken));
  await page.waitForFunction(()=>window.riderStationError?.includes('could not be built')&&window.riderCustom.visible&&document.querySelector('#rider-custom-error')?.textContent.includes('could not be built'));
  await importFile('kicker-platform');t=await ready('kicker-platform',3);assert.equal(t.reset_count,0);cases.push('build_failure_safe_state');
  await page.goto(url);t=await ready('kicker-platform',1,null);cases.push('reload_after_recovery');

  // Ids and names travel in every telemetry message (2048-byte msg.post cap): 65 bytes are rejected,
  // a 64-byte id and a 64-byte multi-byte name load, drive and report telemetry.
  const named=(id,name)=>{const d=JSON.parse(text('kicker-platform'));d.id=id;d.name=name;return JSON.stringify(d);};
  await importText(named('a'.repeat(65),'Long id'));
  await page.waitForFunction(()=>document.querySelector('#rider-custom-error')?.textContent.includes('limited to 64 bytes'));
  await importText(named('long-id','é'.repeat(33)));
  await page.waitForFunction(()=>document.querySelector('#rider-custom-error')?.textContent.includes('limited to 64 bytes'));
  assert.equal((await state()).station,'kicker-platform');
  const longId='l'+'o'.repeat(63);await importText(named(longId,'é'.repeat(32)));t=await ready(longId,2);
  assert.equal(t.station_name,'Custom: '+'é'.repeat(32));t=await drive(10);assert.equal(t.station,longId);cases.push('id_name_byte_limit');

  // Decision 2 (after LE1b), tightened in LE2: starts are limited to ±500 m in x and y. Full vehicle placement on a flat
  // chain under the start, first placement and Retry: positive/negative, fractional, several heights and drops, boundaries.
  const flat=(x,ground,drop=.9,id='start-test',name='Start test')=>JSON.stringify({schema:1,id,name,units:'metres',spawn:[x,ground+drop],start_speed:0,run_in:0,run_out:0,
   bounds:[x-10,x+30,ground-10,ground+25],chains:[[[x+40,ground],[x-20,ground]]]});
  const placements=[[500,.8],[-500,.8],[499.99,12.5],[-499.99,-30.25],[123.456,250.75],[-377.777,.8,3],[0.5,-75.125,1.7],[-250.5,498.6],[250.25,-500.9]];
  measurements.placements=[];let loads=(await state()).world_loads;
  for(const [x,ground,drop] of placements){
   await importText(flat(x,ground,drop));t=await ready('start-test',++loads);
   n=t.reset_count;await uncaptured();await page.locator('canvas').focus();
   await page.keyboard.down('r');await page.waitForFunction(n=>window.riderTelemetry.reset_count===n+1,n);await page.keyboard.up('r');
   t=await state();assert.ok(Math.abs(t.station_distance)<.5,'Retry at x='+x);measurements.placements.push({x,y:ground+(drop??.9),retry_distance_m:t.station_distance});
  }
  // A grid is no proof: run the full reset and its pose guards at 6000 dense fractional starts inside the limit in this world.
  const sweep=async spec=>{await page.evaluate(s=>{window.riderSweep=null;window.riderSweepRequest=s;},spec);await page.waitForFunction(()=>window.riderSweep,null,{timeout:60000});return page.evaluate(()=>window.riderSweep);};
  const inside=await sweep({from:-500,to:500,y_from:-500,y_to:500,count:6000});
  assert.equal(inside.failed,0,JSON.stringify(inside.failures));assert.ok(inside.max_error<.01);
  // Recorded, not asserted: the old ±1 km range fails the same guard (the reason for the tighter limit).
  const outside=await sweep({from:-1000,to:1000,y_from:-1000,y_to:1000,count:4000});
  measurements.placement_sweep={inside:{count:inside.count,failed:inside.failed,max_error_units:inside.max_error},old_1km:{count:outside.count,failed:outside.failed,example:outside.failures[0]}};
  for(const [x,y] of [[500.01,1.7],[-500.01,1.7],[0,500.01],[0,-500.01]]){
   await importText(flat(x,y-.9));
   await page.waitForFunction(()=>document.querySelector('#rider-custom-error')?.textContent.includes('Start is limited to 500 m from the origin in x and y'));
  }
  assert.equal((await state()).world_loads,loads);cases.push('start_limit_placements');
  // The load-path check stands on its own: with only the validator limit lifted, the world refuses to place the vehicle.
  await page.evaluate(()=>{window.riderDebugLimits={validator:5000};});
  await importText(flat(500.01,.8));loads++;
  await page.waitForFunction(()=>document.querySelector('#rider-custom-error')?.textContent.includes('Start 500.010, 1.700 m is outside the 500 m start limit'));
  // Decision 1: a real placement failure (reset-pose guard, both limits lifted) leaves a vehicle-less world, no save and a working re-import.
  await page.evaluate(()=>{window.riderDebugLimits={validator:5000,placement:5000};});
  const placeErrors=[];const onPlace=m=>{const r=m.text().match(/GYM_PLACE_FAILED (\{.*\})/);if(r)placeErrors.push(JSON.parse(r[1]));};page.on('console',onPlace);
  await importText(flat(0,999.1,.9,'far-start','Far start'));loads++;
  await page.waitForFunction(()=>document.querySelector('#rider-custom-error')?.textContent.includes('the vehicle could not be placed')&&window.riderStationError?.includes('could not be placed'));
  await page.waitForFunction(g=>window.riderPlacement?.generation>=g,loads);
  page.off('console',onPlace);await page.evaluate(()=>{window.riderDebugLimits=null;});
  const failure=await page.evaluate(()=>({placement:window.riderPlacement,status:window.riderCustomStatus,error:window.riderStationError,visible:window.riderCustom.visible}));
  assert.match(placeErrors[0]?.error||'',/Noncanonical reset pose|Reset velocity survived/);
  // Only the terrain body is left: no chassis, wheels or joints from the failed placement.
  assert.equal(failure.placement.bodies,1);assert.equal(failure.placement.joints,0);assert.equal(failure.status,null);assert.equal(failure.visible,true);
  measurements.placement_failure={error:placeErrors[0].error,...failure};
  // Neither save slot holds the level that failed placement.
  const slots=await page.evaluate(()=>['a','b'].map(s=>{try{return new TextDecoder('latin1').decode(FS.readFile('/data/.rider/custom-level-'+s));}catch(e){return '';}}));
  assert.ok(slots.some(s=>s.includes('start-test'))&&!slots.some(s=>s.includes('far-start')),'placement failure reached a save slot');
  await page.goto(url);t=await ready('start-test',1,null);cases.push('placement_failure_keeps_save');
  await importFile('kicker-platform');t=await ready('kicker-platform',2);assert.equal(t.reset_count,0);cases.push('reimport_after_placement_failure');
  // A save from before the limit (600 m, saved with both limits lifted) no longer validates: a reload restores the
  // older valid slot and says so instead of hiding the rejected newer one.
  await page.evaluate(()=>{window.riderDebugLimits={validator:5000,placement:5000};});
  await importText(flat(600,.8,.9,'old-far','Old far'));t=await ready('old-far',3);
  await page.goto(url);t=await ready('kicker-platform',1,null);
  await page.waitForFunction(()=>window.riderCustomStatus?.includes('the newer save is no longer valid (Start is limited to 500 m'));
  measurements.rejected_newer_save=await page.evaluate(()=>window.riderCustomStatus);cases.push('rejected_newer_save_reported');

  // Decision 3: every text field at its byte limit with umlauts and emoji, plus the URL speed note, in one telemetry message.
  const texts=JSON.parse(text('kicker-platform'));texts.id='t'+'x'.repeat(63);texts.name='🏁'.repeat(16);
  texts.labels=Array.from({length:8},(_,i)=>({position:[i*4,3],text:i%2?'ä'.repeat(32):'😀'.repeat(16)}));
  for(const s of [texts.id,texts.name,...texts.labels.map(l=>l.text)])assert.equal(Buffer.byteLength(s),64);
  await importText(JSON.stringify(texts));t=await ready(texts.id,2);
  await page.goto(url+'&speed=99');t=await ready(texts.id,1,null);
  assert.equal(t.station_name,'Custom: '+texts.name);assert.match(t.station_note,/Invalid speed/);assert.equal(t.decor_labels,8);
  const bytes=await page.evaluate(()=>window.riderMeasurementBytes);assert.ok(bytes>0&&bytes<2048,'measurement payload '+bytes);
  measurements.text_limits={measurement_bytes:bytes,headroom_bytes:2048-bytes,name_chars:[...texts.name].length,label_bytes:64};
  // 64 characters are allowed only while they fit the 64-byte limit: 64 emoji (256 bytes) are rejected.
  await importText(named('emoji-name','🏁'.repeat(64)));
  await page.waitForFunction(()=>document.querySelector('#rider-custom-error')?.textContent.includes('limited to 64 bytes'));
  await page.getByRole('button',{name:'Close import',exact:true}).click();
  t=await drive(10);assert.equal(t.station,texts.id);cases.push('text_fields_fit_message');

  // Exhausted dmloader sync retries leave its in-progress flag set for good: the status must end, not stay at Saving.
  assert(await page.evaluate(()=>typeof Module._startSyncFS==='function'&&Module._syncMaxTries>0),'dmloader sync internals changed');
  await page.evaluate(()=>{Module._syncTries=Module._syncMaxTries;});
  await importFile('rolling-hills');t=await ready('rolling-hills',2,'Browser storage sync failed; the level may not survive a reload');
  assert.equal(await page.evaluate(()=>Module._syncInProgress),true);cases.push('sync_retries_exhausted');

  if(errors.length)throw Error(errors.join('\n'));
  fs.writeFileSync(path.join(out,'custom-result.json'),JSON.stringify({source_sha:sha,run_id:runId,browser:browser.version(),status:'PASS',cases,measurements},null,2));
  console.log(JSON.stringify({status:'PASS',cases,measurements}));
 }catch(e){
  if(errors.length)console.error('Page errors:\n'+errors.join('\n'));
  if(browser)for(const context of browser.contexts())for(const page of context.pages()){
   console.error('State: '+JSON.stringify(await page.evaluate(()=>({station:window.riderTelemetry?.station,world_loads:window.riderTelemetry?.world_loads,
    ui_captured:window.riderTelemetry?.ui_captured,command:window.riderTelemetry?.command,custom:window.riderCustom&&{visible:window.riderCustom.visible,state:window.riderCustom.state,message:window.riderCustom.message},
    status:window.riderCustomStatus,error:window.riderStationError,active:document.activeElement?.tagName})).catch(()=>null)));
   await page.screenshot({path:path.join(out,'custom-failed.png')}).catch(()=>{});
  }
  throw e;
 }
 finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
