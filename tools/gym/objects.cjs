// LE6a: warnings that jump to their source, navigation (Fit level, centre selection, START, last test start),
// the R13 bounds display and the paged template list in the debug HTML5 gym (level-editor contract R13, R17, LE6).
// Every navigation and display action is view only: the source document, its dirty state and the Undo
// history stay unchanged.
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
  const near=(a,b,eps)=>Math.abs(a-b)<=eps;
  const px=(e,p)=>[e.screen.ox+p[0]*e.screen.ppm_x,e.screen.oy+p[1]*e.screen.ppm_y];
  const middle=e=>[(e.usable.x0+e.usable.x1)/2,(e.usable.y0+e.usable.y1)/2];
  // p is drawn at the middle of the usable canvas area (not covered by the panels), within 2 px.
  function centred(e,p,what){const q=px(e,p),m=middle(e);assert.ok(near(q[0],m[0],2)&&near(q[1],m[1],2),what+': '+JSON.stringify({q,m}));}
  function inside(e,p,what){const q=px(e,p),u=e.usable;assert.ok(q[0]>=u.x0-1&&q[0]<=u.x1+1&&q[1]>=u.y0-1&&q[1]<=u.y1+1,what+' outside the usable area: '+JSON.stringify({q,u}));}
  // View only: same source, revision, dirty state and Undo/Redo depth.
  async function unchanged(before,what){
   const e=await ed(),d=await doc();
   assert.equal(JSON.stringify(d),before.doc,what+' changed the document');
   assert.equal(e.revision,before.revision,what+' changed the revision');assert.equal(e.dirty,before.dirty,what+' dirtied the document');
   assert.equal(e.undo,before.undo,what+' added an Undo step');assert.equal(e.redo,before.redo,what+' changed Redo');
  }
  // The baseline is taken once the last action is saved: a pending autosave (0.4 s after an edit, Undo or
  // document switch) would otherwise clear dirty during the view action and look like a change.
  async function snapshot(){
   await page.waitForFunction(()=>!window.riderEditor.dirty&&window.riderEditor.status!=='Unsaved',null,{timeout:10000})
    .catch(async()=>{const e=await ed();throw new Error('view-only baseline: the document was not saved within 10 s (dirty '+e.dirty+', status '+e.status+')');});
   const e=await ed();assert.equal(e.dirty,false,'view-only baseline taken while the document is unsaved');return {doc:JSON.stringify(await doc()),revision:e.revision,dirty:e.dirty,undo:e.undo,redo:e.redo};
  }
  async function settle(){await page.waitForTimeout(200);return ed();}

  async function type(text){await page.keyboard.type(text,{delay:40});await page.waitForFunction(t=>window.riderEditor.field===t,text);}
  const rise=8*Math.tan(10*Math.PI/180);
  const fixture={schema:1,units:'metres',id:'ea2-objects',name:'Object browser practice',spawn:[2,1],start_speed:0,run_in:0,run_out:0,bounds:[-10,60,-20,40],chains:[[[30,0],[0,0]]],hulls:[],labels:[],checkpoints:[],
   editor:{editor_version:6,compiler_version:6,revision:1,next_id:5,sampling:{tolerance:.005,max_segment:.5},start:{position:[2,1],speed:0},connections:[{from:'o1',to:'o2'},{from:'o2',to:'o3'}],objects:[
    {id:'o1',type:'line',points:[[0,0],[12,0]]},{id:'o2',type:'prefab',kind:'ramp',at:[12,0],params:{length:8,mode:'angle',angle:10}},
    {id:'o3',type:'line',points:[[20,rise],[35,rise]]},{id:'o4',type:'label',text:'A marker',position:[8,3]}]}};
  await page.goto(base+'?station=straight');await page.waitForFunction(()=>window.riderTelemetry?.station==='straight'&&window.riderTelemetry.sequence>2);
  await page.locator('canvas').focus();await key('e');let e=await edit();
  e=await importText(JSON.stringify(fixture),'ea2.json');await settle();assert.equal((await doc()).editor_version,7);
  await button('collapse_prefabs');await button('object_select_o2');e=await settle();assert.equal(e.selection,'o2');
  let before=await snapshot();await button('view_centre');await unchanged(before,'list selection centre');
  await button('object_name');await type('Main ramp');await key('Enter');e=await settle();
  assert.equal((await doc()).objects.find(o=>o.id==='o2').name,'Main ramp');assert.equal(e.undo,before.undo+1);
  await button('object_search');await type('Main');await key('Enter');e=await settle();
  assert.ok(e.visible.includes('object_select_o2'));assert.ok(!e.visible.includes('object_select_o1'));
  before=await snapshot();await button('object_search');await type('label');await key('Escape');await unchanged(before,'cancel search');
  await button('object_search');await key('Backspace');await key('Enter');
  cases.push('list_selection_search_naming');

  before=await snapshot();await button('object_eye_o2');e=await settle();
  assert.equal((await doc()).objects.find(o=>o.id==='o2').hidden,true);assert.equal(e.hidden_objects.o2,true);
  await key('Escape');await key('s');
  await require('./editor_ui_target.cjs').ensureWorld(page,ed,canvas,[16,rise/2]);await at([16,rise/2]);e=await settle();
  assert.notEqual(e.selection,'o2','hidden ramp remains pickable');
  await button('object_select_o2');assert.equal((await ed()).selection,'o2');
  await key('z',['Control']);await settle();assert.equal((await doc()).objects.find(o=>o.id==='o2').hidden,undefined);
  await key('y',['Control']);await settle();assert.equal((await doc()).objects.find(o=>o.id==='o2').hidden,true);
  await button('object_eye_o4');e=await settle();assert.equal(e.hidden_objects.o4,true);await page.screenshot({path:path.join(out,'objects-hidden-ramp-label.png')});
  // Hide changes neither compiled terrain nor labels. Export uses the normal user file flow.
  const exportFile=async()=>{const download=page.waitForEvent('download');await button('export');const f=await download;const data=JSON.parse(fs.readFileSync(await f.path(),'utf8'));await page.getByRole('button',{name:'Close export',exact:true}).click();await page.locator('canvas').focus();await refocused();return data;};
  const saved=await exportFile();assert.equal(saved.editor.editor_version,7);assert.ok(saved.labels.some(l=>l.text==='A marker'));
  assert.ok(saved.chains.flat().some(p=>Math.abs(p[0]-20)<1e-6&&Math.abs(p[1]-rise)<1e-6));
  assert.equal(saved.editor.objects.find(o=>o.id==='o2').hidden,true);
  await button('object_eye_o2');await button('object_eye_o4');
  cases.push('hide_undo_export_geometry');

  await button('object_lock_o3');await button('object_select_o2');before=await snapshot();
  await button('inc_param_2');e=await settle();assert.match(e.message,/Locked: Line o3/i);await unchanged(before,'indirect locked parameter edit');
  await require('./editor_ui_target.cjs').ensureWorld(page,ed,canvas,[16,rise/2]);before=await snapshot();
  const da=await world([16,rise/2]),db=await world([18,rise/2+1]);
  await page.mouse.move(da.x,da.y);await pointer.frames(page);await page.mouse.down();await pointer.frames(page);
  await page.mouse.move(db.x,db.y,{steps:6});await pointer.frames(page);await page.mouse.up();await pointer.frames(page);
  await unchanged(before,'drag run containing a locked object');
  await button('object_select_o3');before=await snapshot();await key('Delete');e=await settle();
  assert.match(e.message,/Locked: Line o3/i);await unchanged(before,'delete locked object');
  // A direct rename is refused too; unlocking and visibility remain available.
  await button('object_name');await type('Should not apply');await key('Enter');await unchanged(before,'rename locked object');
  await button('object_eye_o3');assert.equal((await doc()).objects.find(o=>o.id==='o3').hidden,true);await button('object_eye_o3');
  await button('object_lock_o3');await button('object_select_o2');before=await snapshot();await button('inc_param_2');e=await settle();
  assert.equal(e.undo,before.undo+1);assert.ok((await doc()).objects.find(o=>o.id==='o3').points[0][0]>20);
  await key('z',['Control']);await settle();
  cases.push('lock_direct_and_connected_changes');

  await button('object_lock_o2');await key('c',['Control']);await key('v',['Control']);await settle();
  let d=await doc(),copy=d.objects.find(o=>o.id!=='o2'&&o.name==='Main ramp');assert.ok(copy);assert.ok(!copy.hidden&&!copy.locked);
  await key('z',['Control']);await settle();
  await button('object_select_o2');await button('mirror_right');await settle();d=await doc();copy=d.objects.find(o=>o.id!=='o2'&&o.name==='Main ramp');
  assert.ok(copy);assert.ok(!copy.hidden&&!copy.locked);await key('z',['Control']);await settle();
  cases.push('copy_mirror_new_ids_unlocked_visible');

  await button('object_eye_o2');const stored=await exportFile();
  for(const size of [{width:1280,height:720},{width:1920,height:1080}]){
   await page.setViewportSize(size);await pointer.frames(page);await button('object_search');await key('Escape');await settle();
   await page.screenshot({path:path.join(out,`objects-named-locked-${size.width}x${size.height}.png`)});
  }
  await page.setViewportSize({width:1280,height:720});
  await page.waitForFunction(()=>!window.riderEditor.dirty&&!window.riderEditor.unsynced,null,{timeout:10000});
  await page.reload();await edit();await page.locator('canvas').focus();await button('collapse_prefabs');
  d=await doc();assert.equal(d.objects.find(o=>o.id==='o2').name,'Main ramp');assert.equal(d.objects.find(o=>o.id==='o2').locked,true);assert.equal(d.objects.find(o=>o.id==='o2').hidden,true);
  e=await importText(JSON.stringify(stored),'ea2-export.json');await settle();d=await doc();
  assert.deepEqual(d.objects,stored.editor.objects);assert.deepEqual(d.connections,stored.editor.connections);
  await key('Enter');await played('ea2-objects');await key('e');e=await edit();assert.equal((await doc()).objects.find(o=>o.id==='o2').locked,true);
  cases.push('save_reload_import_drive_roundtrip');

  // Maximum list length uses the same fixed pools; search and scrolling can reach the final object.
  const large=JSON.parse(JSON.stringify(fixture));large.id='ea2-many';large.editor.next_id=257;
  large.editor.objects=Array.from({length:256},(_,i)=>({id:'o'+(i+1),type:'line',points:[[i*2,0],[i*2+2,0]]}));large.editor.connections=[];
  e=await importText(JSON.stringify(large),'ea2-many.json');await settle();
  // Collapse/expand state is view-only and the object rows never allocate per source object.
  if(!(await ed()).visible.includes('object_search'))await require('./editor_ui_target.cjs').reveal(page,'object_search');
  before=await snapshot();await button('object_search');await type('o256');await key('Enter');e=await settle();
  assert.ok(e.visible.includes('object_select_o256'));await button('object_select_o256');assert.equal((await ed()).selection,'o256');await unchanged(before,'search 256 objects');
  await button('object_search');await key('Backspace');await key('Enter');
  for(const size of [{width:1280,height:720},{width:1920,height:1080},{width:1280,height:480}]){
   await page.setViewportSize(size);await pointer.frames(page);await button('object_search');await key('Escape');e=await settle();
   assert.equal(e.overlay.nodes,628);assert.ok(e.ui.boxes<=128&&e.ui.texts<=128);
   for(const r of Object.values(e.ui.rects))assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=size.width&&r.y+r.h<=size.height);
   await page.screenshot({path:path.join(out,`objects-${size.width}x${size.height}.png`)});
  }
  await page.setViewportSize({width:1280,height:720});await pointer.frames(page);await button('object_search');await key('Escape');e=await settle();
  // Search expansion keeps the selected row visible; drag the bounded list to both ends.
  assert.equal(e.ui.object_scroll,252);
  before=await snapshot();
  const scrollbar=e.ui.scrollbars.object_scroll;assert.ok(scrollbar);
  for(const end of [false,true]){
   const cur=(await ed()).ui.scrollbars.object_scroll;
   const start=cur.y+(cur.h-cur.knob)*(await ed()).ui.object_scroll/252+cur.knob/2;
   await page.mouse.move(cur.x+cur.w/2,start);await pointer.frames(page);await page.mouse.down();await pointer.frames(page);
   await page.mouse.move(cur.x+cur.w/2,end?cur.y+cur.h:cur.y,{steps:6});await pointer.frames(page);await page.mouse.up();await pointer.frames(page);
   assert.equal((await ed()).ui.object_scroll,end?252:0);
  }
  await unchanged(before,'object scrollbar drag');
  await button('object_select_o256');before=await snapshot();await key('Delete');await settle();assert.ok(!(await doc()).objects.some(o=>o.id==='o256'));
  await key('z',['Control']);await settle();assert.ok((await doc()).objects.some(o=>o.id==='o256'));
  measurements.budget={gui_nodes:628,max_nodes:640,objects:256,world_sprites_added:0};cases.push('bounded_list_and_viewports');

  const invalid=JSON.parse(JSON.stringify(stored));invalid.editor.objects[0].hidden='yes';
  await page.setViewportSize({width:1280,height:720});await importText(JSON.stringify(invalid),'ea2-invalid.json');e=await settle();
  // Invalid authoring data opens only as the explicit compiled line copy, never as malformed metadata.
  assert.ok((await doc()).objects.every(o=>typeof o.hidden!=='string'));assert.match(e.message,/visibility|Invalid editor|editable|source/i);
  cases.push('invalid_metadata_preserved_or_refused');
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'objects-result.json'),JSON.stringify({source_sha:sha,run_id:runId,browser:browser.version(),status:'PASS',cases,measurements},null,2));
  console.log(JSON.stringify({status:'PASS',cases,measurements}));
 }catch(e){
  if(errors.length)console.error('Page errors:\n'+errors.join('\n'));
  console.error('Last console lines:\n'+logs.join('\n'));
  if(browser)for(const context of browser.contexts())for(const page of context.pages()){
   console.error('State: '+JSON.stringify(await page.evaluate(()=>({editor:window.riderEditor&&{...window.riderEditor,buttons:undefined,library:undefined},doc:window.riderEditorDoc&&{objects:window.riderEditorDoc.objects?.slice(0,12)}})).catch(()=>null)));
   await page.screenshot({path:path.join(out,'objects-failed.png')}).catch(()=>{});
  }
  throw e;
 }
 finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
