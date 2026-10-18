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
  await page.locator('#rider-custom-text').fill(text('kicker-platform'));
  await page.getByRole('button',{name:'Import text',exact:true}).click();
  t=await ready('kicker-platform',3);await page.keyboard.up('ArrowUp');
  assert.equal(t.command.throttle,0);assert.equal(t.world_loads,loadsA+1);assert.equal(t.start_speed,7);assert.equal(t.custom_snapshots,1);
  measurements.kicker_platform=counts(t);cases.push('held_input_released_on_import');
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

  // Injected browser write failure: B still loads, its save fails, the previous save survives a reload.
  assert(await page.evaluate(()=>typeof FS==='object'&&typeof FS.write==='function'&&typeof FS.ErrnoError==='function'),'Emscripten FS unavailable for fault injection');
  await page.evaluate(()=>{const write=FS.write;window.__riderRestoreWrite=()=>{FS.write=write;};
   FS.write=function(stream,...rest){if(String(stream?.path||'').includes('custom-level'))throw new FS.ErrnoError(29);return write.call(this,stream,...rest);};});
  await importFile('kicker-platform');t=await ready('kicker-platform',2,null);
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
