// LE4: My levels, export/import, copy/paste and compatibility in the debug HTML5 gym (level-editor contract R1, R3, R12, R14, R17).
const {configure}=require('./launch.cjs');
const pointer=require('./pointer.cjs');
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
(async()=>{
 const [root,sha,runId]=process.argv.slice(2);const out=path.resolve(root);let browser;
 function find(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()){const v=find(p);if(v)return v;}else if(e.name==='index.html')return p;}}
 const web=path.dirname(find(path.resolve(process.argv[6]))),errors=[],cases=[],measurements={};
 const server=http.createServer((req,res)=>{const file=path.resolve(web,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(web+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',file.endsWith('.wasm')?'application/wasm':file.endsWith('.js')?'text/javascript':'text/html');fs.createReadStream(file).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1280,height:720},acceptDownloads:true});
  await configure(page,runId,process.argv[5]);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{const t=m.text();if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(t))errors.push(t);});
  const base='http://127.0.0.1:'+server.address().port+'/index.html';
  const ed=()=>page.evaluate(()=>window.riderEditor);
  const doc=()=>page.evaluate(()=>window.riderEditorDoc);
  const tm=()=>page.evaluate(()=>window.riderTelemetry);
  // Engine input is sampled per frame: hold keys across frames; modifiers go down first.
  async function key(name,mods=[]){
   for(const m of mods)await page.keyboard.down(m);
   if(mods.length)await page.waitForTimeout(60);
   await page.keyboard.down(name);await page.waitForTimeout(90);await page.keyboard.up(name);
   for(const m of [...mods].reverse())await page.keyboard.up(m);
   await page.waitForTimeout(60);
  }
  const canvas=(x,y)=>page.evaluate(([x,y])=>{const c=document.querySelector('canvas'),r=c.getBoundingClientRect();return {x:r.x+x/c.width*r.width,y:r.y+(1-y/c.height)*r.height};},[x,y]);
  async function world(p){const s=(await ed()).screen;return canvas(s.ox+p[0]*s.ppm_x,s.oy+p[1]*s.ppm_y);}
  async function click(at,mods=[]){
   for(const m of mods)await page.keyboard.down(m);
   if(mods.length)await page.waitForTimeout(60);
   await pointer.tap(page,at);
   for(const m of mods)await page.keyboard.up(m);
  }
  const at=async(p,mods)=>click(await world(p),mods);
  async function drag(from,to,steps=5){
   const a=await world(from),b=await world(to);
   await page.mouse.move(a.x,a.y);await pointer.frames(page);await page.mouse.down();await pointer.frames(page);
   for(let i=1;i<=steps;i++){await page.mouse.move(a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps);await page.waitForTimeout(40);}
   await pointer.frames(page);await page.mouse.up();await pointer.frames(page);
  }
  async function button(name){await require('./editor_ui_target.cjs').reveal(page,name);
   const e=await ed();assert.ok(e.visible.includes(name),name+' not visible: '+e.visible.join(','));
   const b=e.buttons[name];await click(await canvas(b.x,b.y));
  }
  async function edit(){await page.waitForFunction(()=>window.riderEditor?.mode==='edit'&&window.riderEditor.view&&window.riderEditor.screen,null,{timeout:20000});await page.waitForTimeout(150);return ed();}
  async function played(id){
   const after=(await ed())?.view?.generation??0;
   await page.waitForFunction(({id,after})=>window.riderEditor?.mode==='play'&&window.riderTelemetry?.station===id&&window.riderTelemetry.sequence>2&&window.riderTelemetry.session_generation>after,{id,after},{timeout:20000});
   return tm();
  }
  async function revision(n){await page.waitForFunction(n=>window.riderEditor.revision===n&&window.riderEditorDoc?.revision===n,n);return ed();}
  // Saved = the draft and the My levels copy are written and the IndexedDB sync is idle.
  async function saved(){
   await page.waitForFunction(()=>window.riderEditor.status==='Saved'&&!window.riderEditor.dirty);
   await page.waitForFunction(()=>window.riderCustom.syncState()!=='syncing');
   return ed();
  }
  // After a DOM panel closes, the canvas regains focus; the first press within 1 s is ignored (R15).
  const refocused=()=>page.waitForTimeout(1100);
  async function openDialog(){if(!(await ed()).open_dialog)await button('open');await page.waitForFunction(()=>window.riderEditor.open_dialog);return ed();}
  // Row button of a My levels entry (by name or storage key) on the first page.
  async function row(which){const e=await openDialog();const i=e.library.findIndex(l=>typeof which==='number'?l.key===which:l.name===which);assert.ok(i>=0&&i<10,which+' not listed: '+JSON.stringify(e.library));return i+1;}
  // Canonical JSON (sorted keys): Lua tables have no key order.
  const canon=v=>Array.isArray(v)?v.map(canon):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])])):v;
  const shape=d=>JSON.stringify(canon({objects:d.objects,connections:d.connections,start:d.start,finish:d.finish??null}));
  const line=(d,id)=>d.objects.find(o=>o.id===id);
  const slot=name=>page.evaluate(n=>{try{return new TextDecoder('latin1').decode(FS.readFile('/data/.rider/'+n));}catch(e){return '';}},name);
  async function importText(text,name){
   await button('import');await page.waitForFunction(()=>window.riderCustom.visible&&document.getElementById('rider-custom-file'));
   await page.locator('#rider-custom-file').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(text)});
   await page.waitForFunction(()=>!window.riderCustom.visible);await refocused();
   return ed();
  }

  // 1. A copy is not in My levels until edited; New adds a level at once. The name field takes every key:
  // letters that are editor or game keys (E Play, S Select, K Split, C, T) only type.
  await page.goto(base+'?station=straight');
  await page.waitForFunction(()=>window.riderTelemetry?.station==='straight'&&window.riderTelemetry.sequence>2);
  await page.locator('canvas').focus();await key('e');let e=await edit();
  assert.equal(e.id,'my-straight');assert.equal(e.key,0);assert.equal(e.stored,false);assert.deepEqual(e.library,[]);
  await button('new');await page.waitForFunction(()=>window.riderEditor.id==='my-level-1');
  e=await saved();assert.ok(e.key>0);assert.equal(e.objects,0);assert.deepEqual(e.library.map(l=>l.name),['New level 1']);
  assert.ok(e.errors[0].includes('No terrain'),e.errors[0]);
  await button('export');await page.waitForFunction(()=>window.riderEditor.message.startsWith('Export blocked: No terrain'));
  assert.equal(await page.evaluate(()=>window.riderCustom.visible),false);
  await key('d');await page.waitForFunction(()=>window.riderEditor.tool==='draw');
  const before=e.revision;
  await button('rename');await page.waitForFunction(()=>window.riderEditor.field==='New level 1'&&window.riderEditor.field_all);
  await page.keyboard.type('Kicker test',{delay:40});await page.waitForTimeout(150);
  e=await ed();assert.equal(e.field,'Kicker test');assert.equal(e.mode,'edit');assert.equal(e.tool,'draw');assert.equal(e.selection,'');
  await key('Backspace');await page.waitForFunction(()=>window.riderEditor.field==='Kicker tes');await page.keyboard.type('t');
  await page.waitForFunction(()=>window.riderEditor.field==='Kicker test');await key('Enter');e=await revision(before+1);assert.equal(e.name,'Kicker test');assert.equal(e.field,false);assert.equal(e.tool,'draw');
  e=await saved();assert.deepEqual(e.library.map(l=>l.name),['Kicker test']);
  // Esc cancels the field without an edit.
  await button('rename');await page.waitForFunction(()=>window.riderEditor.field_all);await page.keyboard.type('x');
  await page.waitForFunction(()=>window.riderEditor.field==='x');await key('Escape');
  e=await ed();assert.equal(e.field,false);assert.equal(e.name,'Kicker test');assert.equal(e.revision,before+1);
  cases.push('new_level_and_name_field');

  // 2. A run-up, a ramp and a landing drawn as one connected run, START speed 1 m/s and FINISH.
  for(const [a,b] of [[[-3,0],[12,0]],[[12,0],[16,1.5]],[[16,1.5],[22,1.5]]]){
   const r=(await ed()).revision;await at(a);await at(b);await at(b);await revision(r+1);
  }
  let d=await doc();assert.equal(d.objects.length,3);assert.equal(d.connections.length,2);
  await key('s');await at([0,1]);await page.waitForFunction(()=>window.riderEditor.selection==='start');
  await button('plus');await button('plus');await page.waitForFunction(()=>window.riderEditorDoc.start.speed===1);
  await button('tool_finish');await at([21,2.5]);await page.waitForFunction(()=>window.riderEditorDoc.finish);
  await button('tool_select');await key('Escape');e=await saved();assert.equal(e.problem,'');
  const course=await doc();

  // 3. Copy the ramp and the landing (a passage of the run) and paste it at the cursor: new ids, the
  // connection between them kept, none to the run-up; START and FINISH are not copied. One Undo step.
  await at([14,0.75]);await page.waitForFunction(()=>window.riderEditor.selection==='o2');
  await at([19,1.5],['Shift']);await page.waitForFunction(()=>window.riderEditor.selected.length===2);
  await key('c',['Control']);await page.waitForFunction(()=>window.riderEditor.clipboard&&window.riderEditor.clipboard.objects===2);
  e=await ed();assert.deepEqual(e.clipboard,{objects:2,connections:1});
  const target=await world([26.1,6.25]);await page.mouse.move(target.x,target.y);await page.waitForTimeout(120);
  const r0=e.revision;await key('v',['Control']);e=await revision(r0+1);d=await doc();
  assert.equal(d.objects.length,5);assert.deepEqual(e.selected,['o4','o5']);
  const off=[line(d,'o4').points[0][0]-12,line(d,'o4').points[0][1]-0];
  assert.ok(off.every(v=>Math.abs(v/0.5-Math.round(v/0.5))<1e-9),'paste offset on the grid '+off);
  assert.ok(Math.abs(off[0]+17-26.1)<=0.25&&Math.abs(off[1]+0.75-6.25)<=0.25,'pasted at the cursor '+off);
  for(const [copy,orig] of [['o4','o2'],['o5','o3']])
   assert.deepEqual(line(d,copy).points,line(course,orig).points.map(p=>[p[0]+off[0],p[1]+off[1]]));
  assert.deepEqual(d.connections,[...course.connections,{from:'o4',to:'o5'}]);
  assert.deepEqual(d.start,course.start);assert.deepEqual(d.finish,course.finish);
  await key('z',['Control']);e=await revision(r0+2);assert.equal(e.objects,3);
  await key('y',['Control']);e=await revision(r0+3);assert.equal(e.objects,5);
  // Mirror [>] places a mirrored copy of the selection to the right (one Undo step); a level line is its own mirror image.
  await key('Escape');await at([5,0]);await page.waitForFunction(()=>window.riderEditor.selection==='o1');
  await button('mirror_right');e=await revision(r0+4);d=await doc();
  assert.deepEqual(line(d,'o6').points,[[13,0],[28,0]]);assert.equal(d.connections.length,3);
  await key('z',['Control']);e=await revision(r0+5);assert.equal(e.objects,5);
  measurements.paste={offset:off,clipboard:{objects:2,connections:1}};
  cases.push('copy_paste_keeps_internal_connections');

  // 4. Change the pasted passage, reload, continue: the editor reopens the level with every change.
  await key('Home');
  const end=line(d,'o5').points[1];
  await key('Escape');await drag(end,[end[0],end[1]+1]);await revision(r0+6);d=await doc();
  assert.deepEqual(line(d,'o5').points[1],[end[0],end[1]+1]);
  e=await saved();const kicker={key:e.key,shape:shape(d)};
  await page.goto(base+'?station=custom');e=await edit();d=await doc();
  assert.equal(e.name,'Kicker test');assert.equal(e.key,kicker.key);assert.equal(shape(d),kicker.shape);assert.equal(e.status,'Saved');
  await key('e');let t=await played('my-level-1');assert.equal(t.start_speed,1);
  await key('e');e=await edit();assert.equal(e.key,kicker.key);
  cases.push('reload_restores_changed_passage');

  // 5. Templates open as copies; an edit stores them. The list is newest first; opening a saved level is one Undo step.
  e=await openDialog();assert.equal(e.buttons.template_ramps!==undefined,true);
  await button('template_ramps');await page.waitForFunction(()=>window.riderEditor.id==='my-ramps');
  e=await saved();assert.equal(e.key,0);assert.equal(e.library.length,1);
  await button('rename');await page.waitForFunction(()=>window.riderEditor.field_all);
  await key('Backspace');await page.waitForFunction(()=>window.riderEditor.field==='');
  await page.keyboard.type('Ramps short copy 2',{delay:40});await page.waitForFunction(()=>window.riderEditor.field==='Ramps short copy 2');await key('Enter');
  e=await saved();assert.equal(e.name,'Ramps short copy 2');assert.ok(e.key>kicker.key);
  assert.deepEqual(e.library.map(l=>l.name),['Ramps short copy 2','Kicker test']);const ramps={key:e.key,shape:shape(await doc())};
  const r1=e.revision;
  await button('lib_'+await row(kicker.key));await page.waitForFunction(k=>window.riderEditor.key===k,kicker.key);
  e=await edit();d=await doc();assert.equal(shape(d),kicker.shape);assert.equal(e.open_dialog,false);
  await key('z',['Control']);await page.waitForFunction(k=>window.riderEditor.key===k,ramps.key);assert.equal(shape(await doc()),ramps.shape);
  await key('y',['Control']);await page.waitForFunction(k=>window.riderEditor.key===k,kicker.key);
  e=await saved();assert.ok(e.revision>r1);
  measurements.template_labels=Object.keys(e.buttons).filter(n=>n.startsWith('template_')).length;
  cases.push('my_levels_and_templates');

  // 6. Export -> import: the file is the compiled station plus its editor block; the import opens as a copy
  // (a new My levels entry) with equal lines, hulls, labels, START/FINISH, connections and name.
  const [download]=await Promise.all([page.waitForEvent('download'),button('export')]);
  assert.equal(download.suggestedFilename(),'my-level-1.json');
  const text=fs.readFileSync(await download.path(),'utf8');const file=JSON.parse(text);
  assert.equal(file.schema,1);assert.equal(file.chains.length,2);assert.equal(file.editor.compiled_revision,file.editor.revision);
  assert.equal(file.kind,undefined);assert.equal(shape(file.editor),kicker.shape);assert.equal(file.start_speed,1);
  assert.equal(await page.evaluate(()=>document.getElementById('rider-export-text').value),text);
  // While the panel is open the editor takes no input: a canvas click neither selects nor edits.
  const rx=e.revision;await click(await canvas(240,400));e=await ed();
  assert.equal(e.selection,'');assert.equal(e.revision,rx);assert.equal(e.message,'Close the Import/Export panel first.');
  await page.getByRole('button',{name:'Close export',exact:true}).click();await refocused();
  e=await importText(text,'my-level-1.json');assert.ok(e.message.startsWith('Imported'),e.message);
  assert.equal(e.conflict,false);assert.ok(e.stored);assert.equal(e.id,file.id);assert.equal(e.name,file.name);
  assert.equal(shape(await doc()),kicker.shape);
  e=await saved();assert.ok(e.key>ramps.key);assert.equal(e.library.filter(l=>l.name==='Kicker test').length,2);
  // Play compiles the imported copy to the same station fields as the file.
  await key('e');t=await played(file.id);await key('e');e=await edit();
  const replay=await page.evaluate(()=>window.riderSavedLevel);
  for(const f of ['spawn','start_speed','bounds','chains','hulls','labels','finish','checkpoints'])assert.deepEqual(replay[f],file[f],f);
  measurements.export={bytes:Buffer.byteLength(text),chains:file.chains.length,objects:file.editor.objects.length};
  cases.push('export_import_roundtrip');

  // 7. Expected stale compiled data (edited after the last compile) is not a conflict: the source opens.
  const stale=JSON.parse(text);stale.editor.revision+=1;stale.chains[0][0][1]+=0.5;
  e=await importText(JSON.stringify(stale),'stale.json');assert.equal(e.conflict,false);assert.equal(shape(await doc()),kicker.shape);
  cases.push('stale_compiled_data_opens_source');

  // 8. Unexpectedly different compiled data for the same source revision: the user chooses (R1).
  const changed=JSON.parse(text);changed.chains[0][0][1]+=0.5;
  const listed=(await ed()).library.length;
  e=await importText(JSON.stringify(changed),'changed.json');
  assert.ok(e.conflict.includes('chains'),e.conflict);assert.deepEqual(e.visible,['conflict_source','conflict_lines']);
  assert.equal(shape(await doc()),kicker.shape);
  await key('e');e=await ed();assert.equal(e.mode,'edit');assert.ok(e.message.includes('Choose'),e.message);
  const r2=e.revision;await button('conflict_lines');e=await revision(r2+1);d=await doc();
  assert.equal(e.conflict,false);assert.equal(d.connections.length,0);assert.equal(d.objects.filter(o=>o.type==='line').length,2);
  assert.ok(d.objects.some(o=>o.type==='line'&&JSON.stringify(o.points.at(-1))===JSON.stringify([22,2])),'compiled point kept');
  // The line copy replaces the imported source in My levels (one new entry, not two).
  e=await saved();assert.equal(e.library.length,listed+1);
  await key('z',['Control']);await revision(r2+2);assert.equal(shape(await doc()),kicker.shape);
  e=await importText(JSON.stringify(changed),'changed.json');assert.ok(e.conflict);
  await button('conflict_source');await page.waitForFunction(()=>window.riderEditor.conflict===false);
  assert.equal(shape(await doc()),kicker.shape);
  measurements.conflict=e.conflict;
  cases.push('changed_compiled_data_choice');

  // 9. An unknown editor version is never recompiled: the compiled geometry opens as an editable line copy.
  // An unsupported My levels slot is refused and stays unchanged.
  const unknown=JSON.parse(text);unknown.editor.editor_version=99;unknown.editor.compiler_version=99;
  e=await importText(JSON.stringify(unknown),'unknown.json');assert.ok(e.message.includes('unsupported editor'),e.message);
  d=await doc();assert.equal(d.editor_version,9);assert.equal(d.connections.length,0);assert.equal(d.objects.length,2);
  e=await saved();
  const raw=JSON.stringify({schema:1,units:'metres',id:'my-ramps',name:'Ramps short copy 2',editor:{editor_version:99,compiler_version:99,revision:1,next_id:1,objects:[],start:{position:[0,1],speed:0}}});
  await page.evaluate(([key,text])=>{window.riderDebugDraft={key,slot:1,seq:999,text,now:true};},[ramps.key,raw]);
  await page.waitForFunction(()=>window.riderDebugDraft===null);
  const current=e.key;await button('lib_'+await row(ramps.key));
  await page.waitForFunction(()=>window.riderEditor.message.startsWith('Not opened'));e=await ed();assert.equal(e.key,current);
  await key('Escape');
  assert.ok((await slot('custom-doc-'+ramps.key+'-a')).includes('"editor_version":99'),'unsupported level slot changed');
  measurements.unsupported=e.message;
  cases.push('unsupported_versions_kept');

  // 10. Save failures (R12). A failed My levels save is retried before another level opens; a failed
  // draft and level save keep the previous good copies, which a reload restores.
  await button('lib_'+await row(kicker.key));await page.waitForFunction(k=>window.riderEditor.key===k,kicker.key);
  e=await saved();
  await page.evaluate(()=>{const write=FS.write;window.__riderRestoreWrite=()=>{FS.write=write;};
   window.__riderFail='custom-doc';FS.write=function(stream,...rest){if(String(stream?.path||'').includes(window.__riderFail))throw new FS.ErrnoError(29);return write.call(this,stream,...rest);};});
  let s=(await doc()).start.position;await drag(s,[s[0]+1,s[1]]);
  await page.waitForFunction(()=>window.riderEditor.status.startsWith('Save failed (My levels'));
  const moved=shape(await doc());
  await page.evaluate(()=>window.__riderRestoreWrite());
  await button('lib_'+await row(ramps.key));await page.waitForFunction(()=>window.riderEditor.message.startsWith('Not opened'));
  await button('lib_'+await row(kicker.key));e=await ed();assert.equal(e.message,'This level is already open.');
  await button('new');await page.waitForFunction(k=>window.riderEditor.key!==k&&window.riderEditor.objects===0,kicker.key);
  const fresh=await saved();
  await button('lib_'+await row(kicker.key));await page.waitForFunction(k=>window.riderEditor.key===k,kicker.key);
  assert.equal(shape(await doc()),moved,'the retried My levels save holds the moved START');
  e=await saved();
  await page.evaluate(()=>{const write=FS.write;window.__riderRestoreWrite=()=>{FS.write=write;};
   FS.write=function(stream,...rest){if(/custom-(doc|draft)/.test(String(stream?.path||'')))throw new FS.ErrnoError(29);return write.call(this,stream,...rest);};});
  s=(await doc()).start.position;await drag(s,[s[0]+1,s[1]]);
  await page.waitForFunction(()=>window.riderEditor.status.startsWith('Save failed'));e=await ed();measurements.save_failed=e.status;
  await page.evaluate(()=>window.__riderRestoreWrite());
  await page.goto(base+'?station=custom');e=await edit();
  assert.equal(e.key,kicker.key);assert.equal(shape(await doc()),moved,'a reload restores the last good save');
  cases.push('failed_saves_keep_backups');

  // 10b. A failed draft write or browser-storage sync is pending save state: switching to another level is
  // refused (the save is retried first) instead of leaving the edit only in Undo.
  e=await saved();
  await page.evaluate(()=>{const write=FS.write;window.__riderRestoreWrite=()=>{FS.write=write;};
   FS.write=function(stream,...rest){if(String(stream?.path||'').includes('custom-draft'))throw new FS.ErrnoError(29);return write.call(this,stream,...rest);};});
  s=(await doc()).start.position;await drag(s,[s[0],s[1]+0.5]);
  await page.waitForFunction(()=>/^Save failed \(.*custom-draft/.test(window.riderEditor.status));
  const edited=shape(await doc());
  await button('new');e=await ed();assert.ok(e.message.startsWith('Not switched'),e.message);assert.equal(e.key,kicker.key);
  await page.evaluate(()=>window.__riderRestoreWrite());
  // The next switch retries the save first; the level's My levels copy then holds the edit.
  await button('new');await page.waitForFunction(k=>window.riderEditor.key!==k,kicker.key);await saved();
  await button('lib_'+await row(kicker.key));await page.waitForFunction(k=>window.riderEditor.key===k,kicker.key);
  assert.equal(shape(await doc()),edited,'the retried save holds the edit');
  e=await saved();
  await page.evaluate(()=>{const sync=FS.syncfs;window.__riderRestoreSync=()=>{FS.syncfs=sync;};
   // Every attempt fails, but dmloader's failure count is held at one: after 3 counted failures it never
   // syncs again in this page (exercised in le1a), and recovery is what this case checks.
   FS.syncfs=function(populate,cb){if(!populate){setTimeout(()=>{Module._syncTries=0;cb(new Error('injected sync failure'));},0);return;}return sync.apply(this,arguments);};});
  s=(await doc()).start.position;await drag(s,[s[0],s[1]+0.5]);
  await page.waitForFunction(()=>window.riderEditor.status==='Save failed (browser storage sync)'&&window.riderEditor.unsynced);
  const refused=Date.now();await button('new');e=await ed();assert.ok(e.message.startsWith('Not switched')&&e.message.includes('sync'),e.message);assert.equal(e.key,kicker.key);
  await page.evaluate(()=>window.__riderRestoreSync());
  // A later good sync clears the failure: switching then needs no repeat.
  s=(await doc()).start.position;await drag(s,[s[0],s[1]-0.5]);
  e=await saved();assert.equal(e.unsynced,false);
  // Outside the 10 s repeat window, so only a cleared failure lets this switch through.
  await page.waitForTimeout(Math.max(0,10500-(Date.now()-refused)));
  await button('new');await page.waitForFunction(k=>window.riderEditor.key!==k,kicker.key);
  e=await ed();assert.ok(!e.message.startsWith('Not switched'),e.message);await saved();
  await button('lib_'+await row(kicker.key));await page.waitForFunction(k=>window.riderEditor.key===k,kicker.key);
  measurements.pending_save={draft:'refused, retried on the next switch',sync:'refused until a good sync'};
  cases.push('failed_write_or_sync_blocks_switch');

  // 11. Delete asks once more; the open level has no Delete.
  e=await openDialog();const n=e.library.length;const open=e.library.findIndex(l=>l.key===e.key)+1;
  assert.ok(!e.visible.includes('libdel_'+open),'open level offers Delete');
  const victim=e.library.findIndex(l=>l.key===fresh.key)+1;
  await button('libdel_'+victim);e=await ed();assert.equal(e.library.length,n);assert.ok(e.message.includes('Sure?'));
  await button('libdel_'+victim);await page.waitForFunction(n=>window.riderEditor.library.length===n-1,n);
  e=await ed();assert.ok(!e.library.some(l=>l.key===fresh.key));
  await key('Escape');
  measurements.library={levels:e.library.length,gui_nodes:e.overlay.nodes,max_nodes:e.overlay.max_nodes};
  assert.ok(e.overlay.nodes<=e.overlay.max_nodes,JSON.stringify(e.overlay));
  cases.push('delete_level_confirms');

  // 12. An index that exists but cannot be read is never treated as empty: it stays unchanged, blocks every
  // My levels write, and switching away from an unsaved level is refused (repeat within 10 s to continue).
  e=await saved();
  const levelFiles=await page.evaluate(()=>Object.fromEntries(FS.readdir('/data/.rider').filter(n=>n.startsWith('custom-doc-')).map(n=>[n,Array.from(FS.readFile('/data/.rider/'+n)).join(',')])));
  await page.evaluate(()=>{for(const s of ['a','b'])FS.writeFile('/data/.rider/custom-index-'+s,'not a save file');});
  await page.waitForFunction(()=>window.riderCustom.syncState()!=='syncing');
  await page.goto(base+'?station=custom');e=await edit();assert.equal(e.key,kicker.key);assert.deepEqual(e.library,[]);
  s=(await doc()).start.position;await drag(s,[s[0],s[1]+1]);
  await page.waitForFunction(()=>window.riderEditor.status.includes('index cannot be read'));
  await button('new');e=await ed();assert.ok(e.message.startsWith('Not switched'),e.message);assert.equal(e.key,kicker.key);
  await button('new');await page.waitForFunction(k=>window.riderEditor.key!==k,kicker.key);
  await page.waitForFunction(()=>!window.riderEditor.dirty&&window.riderEditor.status.includes('index cannot be read'));
  e=await ed();assert.equal(e.key,0);
  await page.waitForFunction(()=>window.riderCustom.syncState()!=='syncing');
  // Observing an unreadable index, including its Open dialog, must let IndexedDB settle.
  await openDialog();
  await page.waitForFunction(()=>window.riderCustom.syncState()!=='syncing');
  assert.deepEqual((await ed()).library,[]);
  await key('Escape');
  const after=await page.evaluate(()=>({index:['a','b'].map(s=>new TextDecoder().decode(FS.readFile('/data/.rider/custom-index-'+s))),
   files:Object.fromEntries(FS.readdir('/data/.rider').filter(n=>n.startsWith('custom-doc-')).map(n=>[n,Array.from(FS.readFile('/data/.rider/'+n)).join(',')]))}));
  assert.deepEqual(after.index,['not a save file','not a save file']);assert.deepEqual(after.files,levelFiles);
  measurements.unreadable_index=e.status;
  cases.push('unreadable_index_blocks_writes');

  if(errors.length)throw Error(errors.join('\n'));
  await openDialog();await page.screenshot({path:path.join(out,'library-open.png')});await key('Escape');
  fs.writeFileSync(path.join(out,'library-result.json'),JSON.stringify({source_sha:sha,run_id:runId,browser:browser.version(),status:'PASS',cases,measurements},null,2));
  console.log(JSON.stringify({status:'PASS',cases,measurements}));
 }catch(e){
  if(errors.length)console.error('Page errors:\n'+errors.join('\n'));
  if(browser)for(const context of browser.contexts())for(const page of context.pages()){
   console.error('State: '+JSON.stringify(await page.evaluate(()=>({editor:window.riderEditor&&{...window.riderEditor,buttons:undefined},doc:window.riderEditorDoc&&{objects:window.riderEditorDoc.objects?.slice(0,8),connections:window.riderEditorDoc.connections},
    custom:window.riderCustom&&{visible:window.riderCustom.visible,state:window.riderCustom.state,message:window.riderCustom.message},status:window.riderCustomStatus})).catch(()=>null)));
   await page.screenshot({path:path.join(out,'library-failed.png')}).catch(()=>{});
  }
  throw e;
 }
 finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
