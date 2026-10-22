// Editor A2 (#172): exercise the actual object-list controls, source protection and persistence.
const {configure}=require('./launch.cjs');
const pointer=require('./pointer.cjs');
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
(async()=>{
 const [root,sha,runId]=process.argv.slice(2);const out=path.resolve(root);let browser;
 function find(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()){const v=find(p);if(v)return v;}else if(e.name==='index.html')return p;}}
 const web=path.dirname(find(path.resolve(process.argv[6]))),errors=[],logs=[],cases=[],measurements={};
 const server=http.createServer((req,res)=>{const file=path.resolve(web,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(web+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',file.endsWith('.wasm')?'application/wasm':file.endsWith('.js')?'text/javascript':'text/html');fs.createReadStream(file).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1280,height:720}});
  await configure(page,runId,process.argv[5]);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{const t=m.text();logs.push(t);if(logs.length>60)logs.shift();if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(t))errors.push(t);});
  const base='http://127.0.0.1:'+server.address().port+'/index.html';
  const ed=()=>page.evaluate(()=>window.riderEditor);
  const doc=()=>page.evaluate(()=>window.riderEditorDoc);
  async function key(name,mods=[]){
   for(const m of mods)await page.keyboard.down(m);
   if(mods.length)await page.waitForTimeout(60);
   await page.keyboard.down(name);await page.waitForTimeout(90);await page.keyboard.up(name);
   for(const m of [...mods].reverse())await page.keyboard.up(m);
   await page.waitForTimeout(120);
  }
  const canvas=(x,y)=>page.evaluate(([x,y])=>{const c=document.querySelector('canvas'),r=c.getBoundingClientRect();return {x:r.x+x/c.width*r.width,y:r.y+(1-y/c.height)*r.height};},[x,y]);
  async function world(p){const s=(await ed()).screen;return canvas(s.ox+p[0]*s.ppm_x,s.oy+p[1]*s.ppm_y);}
  async function hover(p){const a=await world(p);await page.mouse.move(a.x,a.y);await page.waitForTimeout(150);}
  async function click(at,mods=[]){
   for(const m of mods)await page.keyboard.down(m);
   if(mods.length)await page.waitForTimeout(60);
   await pointer.tap(page,at);
   for(const m of mods)await page.keyboard.up(m);
  }
  const at=async(p,mods)=>click(await world(p),mods);
  async function button(name){await require('./editor_ui_target.cjs').reveal(page,name);
   if(/^warn_\d+$/.test(name)&&!(await ed()).warnings_open){await button('warnings');await page.waitForFunction(()=>window.riderEditor.warnings_open);}
   const e=await ed();assert.ok(e.visible.includes(name),name+' not visible: '+e.visible.join(','));
   const b=e.buttons[name];await click(await canvas(b.x,b.y));
  }
  async function edit(){await page.waitForFunction(()=>window.riderEditor?.mode==='edit'&&window.riderEditor.view&&window.riderEditor.screen,null,{timeout:20000});await page.waitForTimeout(150);return ed();}
  async function played(id){
   const after=(await ed())?.view?.generation??0;
   await page.waitForFunction(({id,after})=>window.riderEditor?.mode==='play'&&window.riderTelemetry?.station===id&&window.riderTelemetry.sequence>2&&window.riderTelemetry.session_generation>after,{id,after},{timeout:20000});
   return page.evaluate(()=>window.riderTelemetry);
  }
  async function revision(n){await page.waitForFunction(n=>window.riderEditor.revision===n&&window.riderEditorDoc?.revision===n,n);return ed();}
  const refocused=()=>page.waitForTimeout(1100);
  async function importText(text,name){
   await button('import');await page.waitForFunction(()=>window.riderCustom.visible&&document.getElementById('rider-custom-file'));
   await page.locator('#rider-custom-file').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(text)});
   await page.waitForFunction(()=>!window.riderCustom.visible);await refocused();
   return ed();
  }
  const canon=v=>Array.isArray(v)?v.map(canon):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])])):v;
  const shape=d=>JSON.stringify(canon({objects:d.objects,connections:d.connections,start:d.start,finish:d.finish??null}));
  const idle=async()=>{const start=Date.now();await page.waitForFunction(()=>!window.riderEditor?.versions_busy&&window.riderCustom.syncState()!=='syncing');measurements.longestVersionWaitMs=Math.max(measurements.longestVersionWaitMs||0,Date.now()-start);};
  async function saved(){await page.waitForFunction(()=>window.riderEditor.status==='Saved'&&!window.riderEditor.dirty&&!window.riderEditor.versions_busy);await idle();return ed();}
  async function versions(){if(!(await ed()).versions_open)await button('versions');await page.waitForTimeout(120);return (await ed()).versions;}
  async function close(){if((await ed()).open_dialog)await button('dialog_close');}
  async function named(name,confirm='Enter'){await versions();await button('snapshot');await page.keyboard.type(name,{delay:30});await key(confirm);await saved();return (await versions()).find(v=>v.named&&v.name===name);}
  async function restore(id){await versions();let e=await ed(),i=e.versions.findIndex(v=>v.id===id);assert.ok(i>=0);while(i>=6){await button('versions_next');i-=6;}await button('restore_'+(i+1));await page.waitForTimeout(200);}
  let token=0;
  async function request(r){r={...r,token:++token};await page.evaluate(r=>{window.riderVersionResult=null;window.riderVersionRequest=r;},r);await page.waitForFunction(t=>window.riderVersionResult?.token===t,r.token);return page.evaluate(()=>window.riderVersionResult);}
  const files=()=>page.evaluate(()=>Object.fromEntries(FS.readdir('/data/.rider').filter(n=>/^custom-version/.test(n)).map(n=>[n,Array.from(FS.readFile('/data/.rider/'+n))])));
  const rise=8*Math.tan(10*Math.PI/180);
  const fixture={schema:1,units:'metres',id:'ea2-objects',name:'Object browser practice',spawn:[2,1],start_speed:0,run_in:0,run_out:0,bounds:[-10,60,-20,40],chains:[[[30,0],[0,0]]],hulls:[],labels:[],checkpoints:[],
   editor:{editor_version:6,compiler_version:6,revision:1,next_id:5,sampling:{tolerance:.005,max_segment:.5},start:{position:[2,1],speed:0},connections:[{from:'o1',to:'o2'},{from:'o2',to:'o3'}],objects:[
    {id:'o1',type:'line',points:[[0,0],[12,0]]},{id:'o2',type:'prefab',kind:'ramp',at:[12,0],params:{length:8,mode:'angle',angle:10}},
    {id:'o3',type:'line',points:[[20,rise],[35,rise]]},{id:'o4',type:'label',text:'A marker',position:[8,3]}]}};
  await page.goto(base+'?station=straight');await page.waitForFunction(()=>window.riderTelemetry?.station==='straight'&&window.riderTelemetry.sequence>2);
  await page.locator('canvas').focus();await key('e');let e=await edit();
  await importText(JSON.stringify(fixture),'versions.json');e=await saved();const levelKey=e.key;
  const original=shape(await doc()),first=await named('First connected course','Tab');assert.ok(first);assert.equal((await ed()).field,false,'Tab must not focus a hidden field behind Versions');assert.equal((await ed()).name,fixture.name);
  await close();await button('rename');await page.keyboard.type('Changed course',{delay:60});await key('Enter');await saved();
  await at([8,3]);await key('Delete');await saved();const changed=shape(await doc());assert.notEqual(changed,original);
  await idle();await page.reload();await edit();await page.locator('canvas').focus();await saved();
  const before=(await ed()).undo,rev=(await ed()).revision;
  await restore(first.id);await page.waitForFunction(r=>window.riderEditor.revision>r,rev);await saved();
  assert.equal(shape(await doc()),original);assert.equal((await ed()).undo,before+1);
  assert.ok((await versions()).some(v=>v.name==='Before restore'));
  await close();await key('z',['Control']);await saved();assert.equal(shape(await doc()),changed);
  await key('y',['Control']);await saved();assert.equal(shape(await doc()),original);
  cases.push('named_reload_restore_undo');console.log('PASS named_reload_restore_undo');

  // 299 s is too early, 301 s triggers a version after the next completed edit/save.
  await versions();const n=(await ed()).versions.filter(v=>!v.named).length;await close();
  await button('rename');await page.keyboard.type('Timed edit',{delay:60});await key('Enter');await saved();await request({op:'clock',seconds:299});await page.waitForTimeout(150);
  assert.equal((await versions()).filter(v=>!v.named).length,n);await close();
  await request({op:'clock',seconds:301});await page.waitForTimeout(300);await saved();
  assert.equal((await versions()).filter(v=>!v.named).length,n+1);await close();
  await button('rename');await page.keyboard.type('Before switching',{delay:60});await key('Enter');await saved();
  await button('new');await saved();await versions();assert.notEqual((await ed()).key,levelKey);await close();
  const switched=await request({op:'measure',key:levelKey});assert.ok(switched.entries.some(v=>v.name==='Before switch'));
  cases.push('automatic_timing_switch');console.log('PASS automatic_timing_switch');

  // Incomplete drafts remain source-valid and restorable, independently of gameplay validation.
  assert.equal((await ed()).objects,0);const empty=await named('Empty design');await close();
  await button('rename');await page.keyboard.type('Empty changed',{delay:60});await key('Enter');await saved();
  const emptyRev=(await ed()).revision;await restore(empty.id);await page.waitForFunction(r=>window.riderEditor.revision>r,emptyRev);await saved();assert.equal((await ed()).objects,0);
  const future={schema:1,units:'metres',id:(await ed()).id,name:'Future',editor:{...(await doc()),editor_version:999,compiler_version:999}};
  const versionFiles=await files();
  await page.evaluate(r=>{window.riderDebugDraft=r;},{version:empty.id,slot:1,seq:999,text:JSON.stringify(future)});
  await page.waitForTimeout(300);await idle();const protectedFiles=await files();await restore(empty.id);
  assert.match((await ed()).message,/Restore refused.*Unsupported/i);assert.deepEqual(await files(),protectedFiles);
  // Restore its original bytes so later count/prune checks exercise supported versions.
  await page.evaluate(f=>{for(const [n,v] of Object.entries(f))FS.writeFile('/data/.rider/'+n,new Uint8Array(v));},versionFiles);await close();
  cases.push('incomplete_and_unknown_versions');console.log('PASS incomplete_and_unknown_versions');

  // A failed version write leaves every indexed snapshot byte-for-byte intact.
  await idle();const goodFiles=await files();
  await page.evaluate(()=>{const write=FS.write;window.restoreWrite=()=>FS.write=write;FS.write=function(stream,...args){if(/custom-version-/.test(stream.path||''))throw new FS.ErrnoError(29);return write.call(this,stream,...args);};});
  await versions();await button('snapshot');await page.keyboard.type('Write failure');await key('Enter');
  await page.waitForFunction(()=>window.riderEditor.status.includes('Save failed'));const failedFiles=await files();
  for(const [n,v] of Object.entries(goodFiles))assert.deepEqual(failedFiles[n],v,n+' changed after write failure');
  await page.evaluate(()=>window.restoreWrite());await close();await named('After write recovery');await close();
  const beforeIndex=await files();
  await page.evaluate(()=>{const write=FS.write;window.restoreWrite=()=>FS.write=write;FS.write=function(stream,...args){if(/custom-versions-/.test(stream.path||''))throw new FS.ErrnoError(29);return write.call(this,stream,...args);};});
  await versions();await button('snapshot');await page.keyboard.type('Index failure',{delay:30});await key('Enter');
  await page.waitForFunction(()=>window.riderEditor.status.includes('Save failed'));
  const afterIndex=await files();for(const [n,v] of Object.entries(beforeIndex).filter(([n])=>/^custom-version-/.test(n)))assert.deepEqual(afterIndex[n],v);
  await page.evaluate(()=>window.restoreWrite());await close();await named('After index recovery');await close();
  // Force IndexedDB callbacks to fail. Existing files remain usable; the UI must never say Saved.
  await page.evaluate(()=>{const sync=FS.syncfs;window.restoreSync=()=>FS.syncfs=sync;FS.syncfs=function(populate,cb){if(!populate){setTimeout(()=>{Module._syncTries=0;cb(new Error('injected sync failure'));},0);return;}return sync.apply(this,arguments);};});
  await versions();await button('snapshot');await page.keyboard.type('Sync failure');await key('Enter');
  await page.waitForFunction(()=>window.riderEditor.status.includes('Save failed'));assert.equal((await ed()).versions_busy,false);
  await page.evaluate(()=>window.restoreSync());await close();await button('rename');await page.keyboard.type('After failed sync',{delay:60});await key('Enter');await page.waitForFunction(()=>!window.riderEditor.dirty&&!window.riderEditor.unsynced);await idle();await named('After sync recovery');await close();await saved();
  cases.push('write_and_sync_failure');console.log('PASS write_and_sync_failure');

  // Per-level limits and exact filesystem cap, with large but valid source JSON (whitespace padding).
  const currentKey=(await ed()).key;
  for(let i=0;i<12;i++){await idle();const r=await request({op:'add',name:'Auto '+i});assert.equal(r.ok,true,r.error);await idle();}
  let report=await request({op:'measure'});assert.equal(report.entries.filter(v=>!v.named).length,10);assert.ok(!report.entries.some(v=>v.name==='Auto 0'));
  let namedCount=report.entries.filter(v=>v.named).length;
  for(let i=namedCount;i<10;i++){const r=await request({op:'add',named:true,name:'Named '+i});assert.equal(r.ok,true,r.error);await idle();}
  const full=await request({op:'add',named:true,name:'Eleventh'});assert.equal(full.ok,false);assert.match(full.error,/10 named/);
  // Independent keys represent other saved levels; global pruning may remove only automatic entries.
  for(let i=0;i<35;i++){
   if(i%10===0)console.log('global cap auto '+i);
   // The first full-cap admission must handle many tiny old versions within the same 30 s bound,
   // even when each real IndexedDB acknowledgement takes an extra second.
   if(i===34)await page.evaluate(()=>{const sync=FS.syncfs;window.restoreSlowSync=()=>FS.syncfs=sync;FS.syncfs=function(populate,cb){return sync.call(this,populate,populate?cb:(...args)=>setTimeout(()=>cb(...args),1000));};});
   const r=await request({op:'add',key:100+i,name:'Large auto '+i,pad:240000});assert.equal(r.ok,true,r.error);await idle();
   if(i===34)await page.evaluate(()=>window.restoreSlowSync());
  }
  report=await request({op:'measure'});assert.ok(report.bytes<=16*1024*1024);measurements.capBytes=report.bytes;const diskBytes=await page.evaluate(()=>FS.readdir('/data/.rider').filter(n=>/^custom-versions?-/.test(n)).reduce((n,f)=>n+FS.stat('/data/.rider/'+f).size,0));assert.equal(report.bytes,diskBytes,'registry must account for every physical slot');assert.ok(diskBytes<=16*1024*1024);measurements.diskBytes=diskBytes;
  assert.equal(report.entries.filter(v=>v.named).length,10);assert.equal(report.entries.filter(v=>!v.named).length,0,'global oldest-first pruning must reclaim the older small automatic versions');
  const over=await request({op:'add',key:199,name:'Too large',pad:262145});assert.equal(over.ok,false);assert.match(over.error,/256 KiB/);
  let refusal;
  for(let i=0;i<40;i++){if(i%10===0)console.log('global cap named '+i);const r=await request({op:'add',key:200+i,named:true,name:'Large named '+i,pad:240000});if(!r.ok){refusal=r;break;}await idle();}
  assert.ok(refusal);assert.match(refusal.error,/full|16 MiB/);report=await request({op:'measure'});assert.ok(report.bytes<=16*1024*1024);measurements.namedCapBytes=report.bytes;
  // The normal level can still autosave while the history is full.
  await request({op:'clock',seconds:301});
  await button('rename');await page.keyboard.type('Level saves at cap',{delay:60});await key('Enter');await saved();assert.equal((await ed()).name,'Level saves at cap');
  assert.ok((await request({op:'measure'})).entries.some(v=>!v.named),'the due automatic checkpoint must finish before deletion fault injection');
  cases.push('limits_pruning_total_cap');console.log('PASS limits_pruning_total_cap');

  // Deletion is explicit for named versions, and level deletion removes all its versions.
  await button('open');await page.waitForTimeout(200);
  e=await ed();const deleteRow=e.library.findIndex(v=>v.key===levelKey)+1;assert.ok(deleteRow>0&&deleteRow<=10);
  await page.evaluate(()=>{const write=FS.write;window.restoreDeleteWrite=()=>FS.write=write;FS.write=function(stream,...args){if(/custom-versions-/.test(stream.path||''))throw new FS.ErrnoError(29);return write.call(this,stream,...args);};});
  await button('libdel_'+deleteRow);await button('libdel_'+deleteRow);
  await page.waitForFunction(()=>window.riderEditor.message.includes('Save failed'));assert.match((await ed()).status,/Save failed/);
  assert.ok((await ed()).library.some(v=>v.key===levelKey),'failed version deletion must keep the level available for retry');
  await page.evaluate(()=>window.restoreDeleteWrite());
  await button('libdel_'+deleteRow);await button('libdel_'+deleteRow);await idle();await page.waitForTimeout(200);
  assert.ok(!(await ed()).library.some(v=>v.key===levelKey));await close();
  const removed=await request({op:'measure',key:levelKey});assert.deepEqual(removed.entries,[]);
  const allFiles=await page.evaluate(()=>FS.readdir('/data/.rider'));for(const v of switched.entries)assert.ok(!allFiles.some(n=>n==='custom-version-'+v.id+'-a'||n==='custom-version-'+v.id+'-b'));
  cases.push('delete_level_versions');console.log('PASS delete_level_versions');
  await versions();for(const viewport of [{width:1280,height:720},{width:1920,height:1080},{width:1280,height:480}]){
   await page.setViewportSize(viewport);await page.waitForTimeout(300);e=await ed();assert.ok(e.ui.boxes<=128&&e.ui.texts<=128);await page.screenshot({path:path.join(out,'versions-'+viewport.width+'x'+viewport.height+'.png')});
  }
  measurements.pairSizes=await page.evaluate(()=>Object.fromEntries(FS.readdir('/data/.rider').filter(n=>/^custom-version-/.test(n)).slice(0,6).map(n=>[n,FS.stat('/data/.rider/'+n).size])));
  measurements.gui=(await ed()).overlay;cases.push('viewports');console.log('PASS viewports');
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'versions-result.json'),JSON.stringify({source_sha:sha,run_id:runId,browser:browser.version(),status:'PASS',cases,measurements},null,2));
  console.log(JSON.stringify({status:'PASS',cases,measurements}));
 }catch(e){
  if(errors.length)console.error('Page errors:\n'+errors.join('\n'));
  console.error('Last console lines:\n'+logs.join('\n'));
  if(browser)for(const context of browser.contexts())for(const page of context.pages()){
   console.error('State: '+JSON.stringify(await page.evaluate(()=>({editor:window.riderEditor&&{...window.riderEditor,buttons:undefined,library:undefined},doc:window.riderEditorDoc&&{objects:window.riderEditorDoc.objects?.slice(0,12)}})).catch(()=>null)));
   await page.screenshot({path:path.join(out,'versions-failed.png')}).catch(()=>{});
  }
  throw e;
 }
 finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
