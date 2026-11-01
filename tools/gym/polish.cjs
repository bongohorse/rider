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
 // Emit timed checkpoints during the long LE6 cohort. The console stays useful
 // even if smoke.py reaches its existing 360 s deadline before the JSON report.
 const part=process.env.GYM_PART||null;
 if(part!==null&&!['1/2','2/2'].includes(part))throw Error('Unknown LE6 part '+part);
 const startedAt=performance.now();let lastCheckpointAt=startedAt;
 const checkpoint=(label)=>{
  const now=performance.now();
  console.log('RIDER_LE6_CHECKPOINT '+JSON.stringify({
   label,elapsed_ms:Math.round(now-startedAt),since_previous_ms:Math.round(now-lastCheckpointAt)
  }));
  lastCheckpointAt=now;
 };
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

  // A version 5 source with one problem of each located kind: an over-budget Bump/wave (o4, a source
  // object without a location), a line that doubles back (o3 at 50, 0) and two lines that touch without a
  // connection (seam warning, o1/o2 at 20, 0). The compiled fields are a valid older compile (stale: no
  // compiled_revision), so the file imports and opens its source.
  if(part==='2/2'){
   // Part 2 starts from an independent, drive-ready editor document; every
   // following module performs its own real UI operations and validations.
   checkpoint('start:le6-part-2');
   await page.goto(base+'?station=straight');
   await page.waitForFunction(()=>window.riderTelemetry?.station==='straight'&&window.riderTelemetry.sequence>2);
   await page.locator('canvas').focus();await key('e');await edit();
   const h={page,ed,doc,key,button,at,hover,importText,settle,snapshot,unchanged,revision,played,edit,canvas,out,cases,measurements,checkpoint};
   checkpoint('start:zoom_editor');
   await require('../gameplay/check_zoom_editor.cjs')(h);
   checkpoint('done:zoom_editor');
   checkpoint('start:coin_editor');
   await require('../gameplay/check_coin_editor.cjs')(h);
   checkpoint('done:coin_editor');
   checkpoint('start:drop_editor');
   await require('../gameplay/check_drop_editor.cjs')(h);
   checkpoint('done:drop_editor');
   checkpoint('start:along_editor');
   await require('../gameplay/check_along_editor.cjs')(h);
   checkpoint('done:along_editor');
   checkpoint('start:auto_editor');
   await require('../gameplay/check_auto_editor.cjs')(h);
   checkpoint('done:auto_editor');
   checkpoint('start:gem_editor');
   await require('../gameplay/check_gem_editor.cjs')(h);
   checkpoint('done:gem_editor');
   checkpoint('start:fuel_editor');
   await require('../gameplay/check_fuel_editor.cjs')(h);
   checkpoint('done:fuel_editor');
  }else{
  const file={schema:1,units:'metres',id:'le6-nav',name:'LE6 navigation',spawn:[2,1],start_speed:0,run_in:0,run_out:0,bounds:[-10,130,-20,30],
   chains:[[[20,0],[0,0]]],hulls:[],labels:[],checkpoints:[],
   editor:{editor_version:5,compiler_version:5,revision:4,next_id:5,sampling:{tolerance:0.005,max_segment:0.5},connections:[],start:{position:[2,1],speed:0},
    objects:[{id:'o1',type:'line',points:[[0,0],[20,0]]},{id:'o2',type:'line',points:[[20,0],[30,0]]},{id:'o3',type:'line',points:[[40,0],[50,0],[44,0]]},
     {id:'o4',type:'prefab',kind:'wave',at:[60,0],params:{height:10,wavelength:1,count:50}}]}};

  // 1. Located warnings and errors jump to their source by stable id; unlocated ones only show their text.
  checkpoint('start:le6');
  await page.goto(base+'?station=straight');
  await page.waitForFunction(()=>window.riderTelemetry?.station==='straight'&&window.riderTelemetry.sequence>2);
  await page.locator('canvas').focus();await key('e');let e=await edit();
  e=await importText(JSON.stringify(file),'le6-nav.json');
  assert.equal(e.id,'le6-nav');e=await settle();
  await button('warnings');e=await settle();
  assert.equal(e.warnings_open,true);
  const texts=e.problems.map(p=>p.text);
  assert.equal(e.problems.length,3,JSON.stringify(texts));
  // The existing message strings are unchanged; each now carries its source.
  assert.ok(texts[0].startsWith('Bump/wave o4 needs more than 2048 points'),texts[0]);
  assert.equal(texts[1],'Line o3 doubles back on itself at (50.00, 0.00) m.');
  assert.equal(texts[2],'o1 end and o2 start touch but are not connected (seam bump). Select the end and press Connect [J].');
  assert.deepEqual(e.problems.map(p=>[p.error,p.ids,p.at,p.located]),[[true,['o4'],false,true],[true,['o3'],[50,0],true],[false,['o1','o2'],[20,0],true]]);
  let before=await snapshot();
  await button('warn_2');e=await settle();
  assert.deepEqual(e.selected,['o3']);centred(e,[50,0],'doubles-back error');assert.deepEqual(e.flash,[50,0]);
  assert.equal(e.message,'Error: Line o3 doubles back on itself at (50.00, 0.00) m.');
  await button('warn_1');e=await settle();
  assert.deepEqual(e.selected,['o4']);
  // An object without a location: its whole shape (60-110 m) is in view.
  inside(e,[60,0],'wave entry');inside(e,[110,0],'wave exit');
  await button('warn_3');e=await settle();
  assert.deepEqual(e.selected.sort(),['o1','o2']);centred(e,[20,0],'seam warning');
  await unchanged(before,'jump to problem');
  measurements.jump={zoom:e.camera.zoom,problems:texts.length};
  // An edit removes the target: the seam warning goes, START loses its ground (a START target), and Undo
  // brings the seam back with the restored ids.
  await key('Delete');e=await revision(before.revision+1);e=await settle();
  assert.ok(!e.problems.some(p=>p.ids.includes('o1')||p.ids.includes('o2')),'a deleted source is still listed');
  const startRow=e.problems.findIndex(p=>p.text==='START has no terrain below it.');
  assert.ok(startRow>=0&&e.problems[startRow].start&&e.problems[startRow].located,JSON.stringify(e.problems));
  await button('warn_'+(startRow+1));e=await settle();
  assert.equal(e.selection,'start');centred(e,e.start.position,'START warning');
  await key('z',['Control']);e=await revision(before.revision+2);e=await settle();
  const seam=e.problems.findIndex(p=>p.ids.includes('o2'));assert.ok(seam>=0,'Undo did not restore the seam warning');
  before=await snapshot();
  await button('warn_'+(seam+1));e=await settle();
  assert.deepEqual(e.selected.sort(),['o1','o2']);centred(e,[20,0],'seam warning after Undo');
  await unchanged(before,'jump after Undo');
  cases.push('problems_jump_to_source_after_edit_and_undo');checkpoint('problems_jump_to_source_after_edit_and_undo');

  // 2. Fit level, centre selection (several objects), go to START and to the last launched test start.
  // Esc first closes the warning list, then clears the selection.
  await key('Escape');e=await settle();assert.equal(e.warnings_open,false);await key('Escape');e=await settle();assert.equal(e.selection,'');
  before=await snapshot();
  const cam0=JSON.stringify(e.camera);
  await button('view_centre');e=await settle();
  assert.ok(e.message.startsWith('Centre selection: nothing is selected'),e.message);assert.equal(JSON.stringify(e.camera),cam0,'centring without a selection moved the camera');
  await key('Home');e=await settle();
  const x=e.extent;
  for(const c of [[x[0],x[2]],[x[1],x[2]],[x[0],x[3]],[x[1],x[3]]])inside(e,c,'Fit level corner');
  centred(e,[(x[0]+x[1])/2,(x[2]+x[3])/2],'Fit level centre');
  // The level fills 80 % of the usable width or height (10 % padding on each side).
  assert.equal(e.message,'');
  const fillX=(x[1]-x[0])*e.screen.ppm_x/(e.usable.x1-e.usable.x0),fillY=(x[3]-x[2])*e.screen.ppm_y/(e.usable.y1-e.usable.y0);
  assert.ok(near(Math.max(fillX,fillY),0.8,0.005),JSON.stringify({fillX,fillY}));
  const fitted=e.camera;
  {const u=e.usable,p=await canvas((u.x0+u.x1)/2,(u.y0+u.y1)/2);await page.mouse.move(p.x,p.y);}
  for(let i=0;i<4;i++){await page.mouse.wheel(0,-120);await page.waitForTimeout(80);}
  e=await settle();assert.ok(e.camera.zoom>fitted.zoom*1.5,'zoomed in');
  await button('view_fit');e=await settle();
  // Repeatable within the float32 screen mapping (sub-millimetre).
  assert.ok(near(e.camera.zoom/fitted.zoom,1,1e-6)&&near(e.camera.x,fitted.x,1e-3)&&near(e.camera.y,fitted.y,1e-3),'Fit level is not repeatable: '+JSON.stringify([e.camera,fitted]));
  measurements.fit={extent:x,zoom:e.camera.zoom};
  // Two objects selected: the box of both is centred and the zoom is kept when it fits.
  await at([10,0]);await at([47,0],['Shift']);e=await settle();assert.deepEqual(e.selected.sort(),['o1','o3']);
  for(let i=0;i<2;i++){await page.mouse.wheel(0,120);await page.waitForTimeout(80);}
  e=await settle();const zoom=e.camera.zoom;
  await key('.');e=await settle();
  centred(e,[25,0],'two selected objects');assert.ok(near(e.camera.zoom,zoom,1e-9),'centring zoomed although the selection fits');
  await button('view_start');e=await settle();
  centred(e,[e.start.position[0],e.start.position[1]+0.08],'START');
  // No test start yet: Last test explains and stays put; a refused test start does not count.
  assert.equal(e.last_test,false);
  const cam1=JSON.stringify(e.camera);
  await button('view_test');e=await settle();
  assert.ok(e.message.startsWith('Last test start: none yet'),e.message);assert.equal(JSON.stringify(e.camera),cam1);
  await unchanged(before,'navigation');
  await hover([-5,3]);await key('f');e=await settle();
  assert.ok(e.message.startsWith('Test start refused'),e.message);assert.equal(e.last_test,false);
  // The errors (o3, o4) block every run: remove them, then start a test run at x 12.
  await key('Escape');await key('Home');await at([47,0]);await at([80,5],['Shift']);e=await settle();assert.deepEqual(e.selected.sort(),['o3','o4']);
  await key('Delete');e=await revision(before.revision+1);e=await settle();
  assert.equal(e.problem,'');
  await key('Home');await hover([12,3]);await key('f');await played('le6-nav');
  await key('e');e=await edit();
  assert.ok(e.last_test&&near(e.last_test[0],12,0.05)&&near(e.last_test[1],0.9,0.01),JSON.stringify(e.last_test));
  const launched=e.last_test;
  await key('Home');e=await settle();
  await button('view_test');e=await settle();
  centred(e,[launched[0],launched[1]+0.08],'last test start');
  // Another document has no last test start; Undo back to this one finds its own again.
  await button('open');await page.waitForFunction(()=>window.riderEditor.open_dialog);
  await button('template_straight');await page.waitForFunction(()=>window.riderEditor.id==='my-straight');e=await settle();
  assert.equal(e.last_test,false,'the last test start of another document was kept');
  await button('view_test');e=await settle();assert.ok(e.message.startsWith('Last test start: none yet'),e.message);
  await key('z',['Control']);await page.waitForFunction(()=>window.riderEditor.id==='le6-nav');e=await settle();
  assert.deepEqual(e.last_test,launched);
  cases.push('fit_centre_start_last_test_view_only');checkpoint('fit_centre_start_last_test_view_only');

  // 3. The R13 bounds as Play uses them: shown on demand, refreshed by a START move, and equal to the bounds
  // of the compiled level (Play from START).
  before=await snapshot();
  await button('view_bounds');e=await settle();
  assert.equal(e.show_bounds,true);assert.ok([-10,40,-10,21.68].every((v,i)=>near(e.bounds[i],v,1e-9)),JSON.stringify(e.bounds));
  {const u=e.usable,p=await canvas((u.x0+u.x1)/2,(u.y0+u.y1)/2);await page.mouse.move(p.x,p.y);}
  for(let i=0;i<8;i++){await page.mouse.wheel(0,120);await page.waitForTimeout(60);}
  e=await settle();assert.equal(e.overlay.bounds,4,'the whole bounds rectangle is drawn when it is in view');
  await button('view_bounds');e=await settle();assert.equal(e.show_bounds,false);assert.equal(e.overlay.bounds,0);
  await unchanged(before,'bounds display');
  await button('view_bounds');await key('Home');e=await settle();
  // Without o3 and o4 (removed above). Left: o1 at 0; right: o2 ends at 30; floor 0; top: the START box (1 + 0.68 m), 20 m headroom.
  const b1=e.bounds;assert.ok(near(b1[0],-10,1e-9)&&near(b1[1],40,1e-9)&&near(b1[2],-10,1e-9)&&near(b1[3],21.68,1e-9),JSON.stringify(b1));
  await button('tool_start');await at([10,5]);e=await revision(before.revision+1);e=await settle();
  assert.ok(e.start.position[1]>4&&near(e.bounds[3],e.start.position[1]+0.68+20,1e-9)&&near(e.bounds[1],40,1e-9),'bounds not refreshed after a START move: '+JSON.stringify(e.bounds));
  const shown=e.bounds;
  await button('tool_select');
  await key('e');await played('le6-nav');
  await page.waitForFunction(()=>window.riderSavedLevel?.id==='le6-nav');
  const level=await page.evaluate(()=>window.riderSavedLevel);
  assert.deepEqual(level.bounds,shown,'the shown bounds differ from the compiled level');
  await key('e');e=await edit();
  measurements.bounds={shown,compiled:level.bounds};
  cases.push('bounds_display_matches_compile');checkpoint('bounds_display_matches_compile');

  // 4. The template list pages (the 12th template no longer sits on Close); the wheel pages it too. The View
  // row stays clear of the page's own buttons at desktop and phone sizes; GUI node budget.
  await button('open');await page.waitForFunction(()=>window.riderEditor.open_dialog);e=await settle();
  const templates=Object.keys(e.buttons).filter(n=>n.startsWith('template_'));
  assert.equal(e.tpl_page,0);assert.equal(e.visible.filter(n=>n.startsWith('template_')).length,Math.min(10,templates.length));
  assert.ok(e.visible.includes('tpl_next')&&!e.visible.includes('tpl_prev'));
  const right=await canvas(e.buttons.template_ramps.x,e.buttons.template_ramps.y);
  await page.mouse.move(right.x,right.y);await page.waitForTimeout(80);await page.mouse.wheel(0,120);e=await settle();
  assert.equal(e.tpl_page,1);assert.equal(e.visible.filter(n=>n.startsWith('template_')).length,templates.length-10);
  assert.ok(e.visible.includes('tpl_prev'));
  await page.mouse.wheel(0,-120);e=await settle();assert.equal(e.tpl_page,0);
  await key('Escape');e=await settle();assert.equal(e.open_dialog,false);
  assert.ok(e.overlay.nodes<=e.overlay.max_nodes,JSON.stringify(e.overlay));
  measurements.gui={nodes:e.overlay.nodes,max_nodes:e.overlay.max_nodes,templates:templates.length};
  measurements.view_row={};
  for(const size of [{width:1280,height:720},{width:844,height:390},{width:390,height:844}]){
   await page.setViewportSize(size);await page.waitForTimeout(400);e=await settle();
   const r=await page.evaluate(rects=>{const c=document.querySelector('canvas'),cr=c.getBoundingClientRect(),t=document.getElementById('page-tools').getBoundingClientRect();
    const css=q=>({x0:cr.x+q.x0/c.width*cr.width,x1:cr.x+q.x1/c.width*cr.width,y0:cr.y+(1-q.y1/c.height)*cr.height,y1:cr.y+(1-q.y0/c.height)*cr.height});
    return {tools:{x0:t.left,x1:t.right,y0:t.top,y1:t.bottom},view:rects.map(css)};},e.view_rects);
   for(const v of r.view){
    assert.ok(v.x1<=r.tools.x0||v.y1<=r.tools.y0,'View row overlaps the page buttons at '+JSON.stringify(size)+': '+JSON.stringify({v,tools:r.tools}));
    assert.ok(v.x0>=0&&v.y1<=size.height+0.5,'View row off screen at '+JSON.stringify(size));
   }
   measurements.view_row[size.width+'x'+size.height]={last:r.view[r.view.length-1].x1,tools:r.tools.x0};
  }
  await page.setViewportSize({width:1280,height:720});await page.waitForTimeout(300);
  await page.screenshot({path:path.join(out,'polish-view.png')});
  // The warning list closes when the Open dialog opens, so its rows never take the dialog's clicks: a
  // template opens with the list shown before (review finding).
  if(!(await ed()).warnings_open)await button('warnings');
  e=await settle();assert.equal(e.warnings_open,true);assert.ok(e.problems.length>0);
  await button('open');await page.waitForFunction(()=>window.riderEditor.open_dialog);e=await settle();
  assert.equal(e.warnings_open,false);assert.ok(!e.visible.some(n=>n.startsWith('warn_')),e.visible.join(','));
  await button('template_ramps');await page.waitForFunction(()=>window.riderEditor.id==='my-ramps');
  await button('warnings');await button('open');await page.waitForFunction(()=>window.riderEditor.open_dialog);
  await button('template_straight');await page.waitForFunction(()=>window.riderEditor.id==='my-straight');
  cases.push('template_pages_view_row_budget');checkpoint('template_pages_view_row_budget');

  // 5. An unlocated message (an empty level) is listed and shown without moving the camera or selecting.
  await button('new');await page.waitForFunction(()=>window.riderEditor.id.startsWith('my-level-'));e=await settle();
  if(!e.warnings_open){await button('warnings');e=await settle();}
  const empty=e.problems.findIndex(p=>p.text.startsWith('No terrain yet'));
  assert.ok(empty>=0&&!e.problems[empty].located,JSON.stringify(e.problems));
  before=await snapshot();const cam2=JSON.stringify(e.camera);
  await button('warn_'+(empty+1));e=await settle();
  assert.equal(JSON.stringify(e.camera),cam2,'an unlocated message moved the camera');assert.equal(e.selection,'');
  assert.ok(e.message.startsWith('Error: No terrain yet'),e.message);
  await unchanged(before,'unlocated message');
  await page.screenshot({path:path.join(out,'polish-warnings.png')});
  cases.push('unlocated_message_shown_only');checkpoint('unlocated_message_shown_only');

  // LE6b. A plain course: one ground line, START at (2, 1).
  const plain={schema:1,units:'metres',id:'le6-labels',name:'LE6 labels',spawn:[2,1],start_speed:0,run_in:0,run_out:0,bounds:[-10,50,-10,30],
   chains:[[[40,0],[0,0]]],hulls:[],labels:[],checkpoints:[],
   editor:{editor_version:5,compiler_version:5,revision:1,next_id:2,sampling:{tolerance:0.005,max_segment:0.5},connections:[],start:{position:[2,1],speed:0},
    objects:[{id:'o1',type:'line',points:[[0,0],[40,0]]}]}};
  const label=(d,id)=>d.objects.find(o=>o.id===id);
  const labels=d=>d.objects.filter(o=>o.type==='label');

  // 6. Labels: place (one step) with the text focused at once, type (editor and game keys only type),
  // Undo/Redo exactly, move, edit by double-click and by the panel row (Esc keeps), the 64-byte limit,
  // no empty text, copy/paste, delete, reload, and Play -> import as an independent copy.
  e=await importText(JSON.stringify(plain),'le6-labels.json');assert.equal(e.id,'le6-labels');e=await settle();
  await key('Home');await key('l');e=await settle();assert.equal(e.tool,'label');
  let rev=e.revision;
  await at([6,3]);e=await revision(rev+1);
  let d=await doc();const lid=labels(d)[0].id;
  assert.deepEqual(labels(d)[0],{id:lid,type:'label',position:[6,3],text:'Label'});
  assert.equal(e.field_label,lid);assert.equal(e.field_all,true);assert.deepEqual(e.selected,[lid]);
  // Typing replaces the selected text; E (Play), S, D, F, H, L and Delete-free letters only type.
  await page.keyboard.type('Sehr hoher Flug 1',{delay:40});await page.waitForFunction(()=>window.riderEditor.field==='Sehr hoher Flug 1');
  e=await ed();assert.equal(e.mode,'edit');assert.equal(e.tool,'label');assert.equal(e.revision,rev+1);assert.equal(e.help_open,false);
  // The canvas label shows the typed text at once, before Enter commits it.
  await page.waitForFunction(id=>window.riderEditor.labels_drawn[id]==='Sehr hoher Flug 1',lid);
  await key('Enter');e=await revision(rev+2);
  assert.equal(label(await doc(),lid).text,'Sehr hoher Flug 1');assert.equal(e.field,false);
  await key('z',['Control']);e=await revision(rev+3);assert.equal(label(await doc(),lid).text,'Label');
  await key('z',['Control']);e=await revision(rev+4);assert.equal(label(await doc(),lid),undefined);
  await key('y',['Control']);e=await revision(rev+5);await key('y',['Control']);e=await revision(rev+6);
  assert.deepEqual(label(await doc(),lid),{id:lid,type:'label',position:[6,3],text:'Sehr hoher Flug 1'});
  // Pick and drag the label by its text (right of its anchor), snapped to the grid: one step.
  await key('s');e=await settle();
  const grab=[6.8,3];
  await (async()=>{const a=await world(grab),b=await world([grab[0]+4,4]);await page.mouse.move(a.x,a.y);await pointer.frames(page);await page.mouse.down();await pointer.frames(page);
   for(let i=1;i<=6;i++){await page.mouse.move(a.x+(b.x-a.x)*i/6,a.y+(b.y-a.y)*i/6);await page.waitForTimeout(40);}await pointer.frames(page);await page.mouse.up();await pointer.frames(page);})();
  e=await revision(rev+7);assert.deepEqual(label(await doc(),lid).position,[10,4]);
  // Double-click opens the field; Esc keeps the text and adds nothing.
  const lp=await world([10,4]);await pointer.dblclick(page,lp);
  await page.waitForFunction(id=>window.riderEditor.field_label===id,lid);
  await page.keyboard.type('xyz',{delay:30});await page.waitForFunction(id=>window.riderEditor.labels_drawn[id]==='xyz',lid);
  await key('Escape');e=await settle();
  assert.equal(e.field,false);assert.equal(e.revision,rev+7);assert.equal(label(await doc(),lid).text,'Sehr hoher Flug 1');
  await page.waitForFunction(id=>window.riderEditor.labels_drawn[id]==='Sehr hoher Flug 1',lid);
  // The panel's Text row: the 64-byte limit and no empty text.
  await button('param_1');await page.waitForFunction(()=>window.riderEditor.field_all);
  await page.keyboard.type('x'.repeat(70),{delay:5});e=await settle();
  assert.equal(e.field.length,64);assert.equal(e.message,'A label is limited to 64 bytes.');
  // Esc drops the typed text; reopened, the whole text is selected and Backspace clears it.
  await key('Escape');await button('param_1');await page.waitForFunction(()=>window.riderEditor.field_all);
  await key('Backspace');await page.waitForFunction(()=>window.riderEditor.field==='');
  await key('Enter');e=await settle();assert.equal(e.message,'A label cannot be empty.');assert.equal(e.field_label,lid);assert.equal(e.revision,rev+7);
  await page.keyboard.type('Gap 3 m',{delay:30});await key('Enter');e=await revision(rev+8);
  assert.equal(label(await doc(),lid).text,'Gap 3 m');
  // Copy/paste: a new id, the same text; Delete removes the copy only.
  await key('c',['Control']);await hover([24,6]);await key('v',['Control']);e=await revision(rev+9);
  d=await doc();assert.equal(labels(d).length,2);const copy=labels(d).find(o=>o.id!==lid);
  assert.equal(copy.text,'Gap 3 m');assert.deepEqual(e.selected,[copy.id]);
  await key('Delete');e=await revision(rev+10);assert.deepEqual(labels(await doc()).map(o=>o.id),[lid]);
  // Reload: the unplayed draft reopens with the label.
  await page.waitForFunction(()=>window.riderEditor.status==='Saved'&&!window.riderEditor.dirty);
  await page.waitForFunction(()=>window.riderCustom.syncState()!=='syncing');
  await page.goto(base+'?station=custom');e=await edit();
  assert.equal(e.id,'le6-labels');assert.deepEqual(label(await doc(),lid),{id:lid,type:'label',position:[10,4],text:'Gap 3 m'});
  // Play compiles the label; the played file imported again is an independent copy.
  await key('e');await played('le6-labels');await page.waitForFunction(()=>window.riderSavedLevel?.id==='le6-labels');
  const saved=await page.evaluate(()=>window.riderSavedLevel);
  assert.deepEqual(saved.labels,[{position:[10,4],text:'Gap 3 m'}]);
  await key('e');e=await edit();const ownKey=e.key;
  e=await importText(JSON.stringify(saved),'le6-labels.json');assert.notEqual(e.key,ownKey);
  assert.deepEqual(labels(await doc()).map(o=>[o.position,o.text]),[[[10,4],'Gap 3 m']]);
  e=await settle();rev=e.revision;
  await at([10,4]);await button('param_1');await page.waitForFunction(()=>window.riderEditor.field_all);
  await page.keyboard.type('Copy',{delay:30});await key('Enter');e=await revision(rev+1);
  await key('z',['Control']);await key('z',['Control']);await page.waitForFunction(k=>window.riderEditor.key===k,ownKey);
  assert.equal(label(await doc(),lid).text,'Gap 3 m','the import changed the original');
  // Saved data with an empty label (main's validators accept it; the editor never makes one) still opens as
  // its source and edits normally, also after a reload; its geometry and the empty label stay intact.
  const blank=JSON.parse(JSON.stringify(plain));blank.name='LE6 empty label';
  blank.labels=[{position:[3,3],text:''}];blank.editor.objects.push({id:'o2',type:'label',position:[3,3],text:''});blank.editor.next_id=3;
  e=await importText(JSON.stringify(blank),'le6-empty.json');
  assert.equal(e.name,'LE6 empty label');assert.equal(e.conflict,false);assert.ok(!/invalid|has no text/.test(e.message),e.message);
  d=await doc();assert.deepEqual(label(d,'o2'),{id:'o2',type:'label',position:[3,3],text:''});assert.deepEqual(d.objects[0].points,[[0,0],[40,0]]);
  e=await settle();rev=e.revision;
  await key('l');await at([8,6]);e=await revision(rev+1);await key('Enter');await key('s');e=await settle();
  assert.equal(e.revision,rev+1);
  await page.waitForFunction(()=>window.riderEditor.status==='Saved'&&!window.riderEditor.dirty);
  await page.waitForFunction(()=>window.riderCustom.syncState()!=='syncing');
  await page.goto(base+'?station=custom');e=await edit();
  d=await doc();assert.equal(e.name,'LE6 empty label');
  assert.deepEqual(label(d,'o2'),{id:'o2',type:'label',position:[3,3],text:''});assert.deepEqual(d.objects[0].points,[[0,0],[40,0]]);
  assert.deepEqual(labels(d).map(o=>o.text).sort(),['','Label']);
  measurements.labels={text_limit:64,compiled:saved.labels};
  cases.push('labels_place_edit_move_copy_undo_persist');checkpoint('labels_place_edit_move_copy_undo_persist');

  // 7. Help: modal (no key or click acts behind it), lists the shipped controls, closes with H, Esc,
  // Close or a click outside.
  e=await settle();before=await snapshot();const tool0=e.tool,cam3=JSON.stringify(e.camera);
  await key('h');e=await settle();assert.equal(e.help_open,true);
  assert.ok(e.help.left.join('\n').includes('[L] Label')&&e.help.right.join('\n').includes('Mirror [<] [>]'),JSON.stringify(e.help));
  assert.deepEqual(e.visible,['help_close']);
  for(const k of ['d','e','f','Delete','Enter','l','g','Home'])await key(k);
  await key('z',['Control']);
  const behind=await canvas(e.buttons.help_close.x-300,e.buttons.help_close.y+150);await click(behind);
  e=await settle();assert.equal(e.help_open,true);assert.equal(e.mode,'edit');assert.equal(e.tool,tool0);assert.equal(JSON.stringify(e.camera),cam3);assert.equal(e.grid,true);
  await unchanged(before,'keys and clicks behind the help');
  await key('Escape');e=await settle();assert.equal(e.help_open,false);
  await button('view_help');e=await settle();assert.equal(e.help_open,true);
  await button('help_close');e=await settle();assert.equal(e.help_open,false);
  await key('h');await click(await canvas(10,10));e=await settle();assert.equal(e.help_open,false);
  await key('h');await key('h');e=await settle();assert.equal(e.help_open,false);
  await unchanged(before,'help');
  // A piece being drawn stays as it is behind the help (not finished, not dropped).
  await key('d');await at([20,6]);await at([24,7]);e=await settle();assert.equal(e.drawing,2);
  await key('h');e=await settle();assert.equal(e.help_open,true);assert.equal(e.drawing,2);
  await key('Escape');e=await settle();assert.equal(e.help_open,false);assert.equal(e.drawing,2,'help changed the piece being drawn');
  await unchanged(before,'help while drawing');
  await key('Escape');e=await settle();assert.equal(e.drawing,0);await key('s');
  cases.push('help_modal_lists_controls');checkpoint('help_modal_lists_controls');

  // 8. Ghost: where F would start (same rules as F), refused in red with the reason, off over objects,
  // in dialogs and when switched off; F at the ghost starts exactly there.
  await key('Escape');await key('Home');await hover([20,3]);e=await settle();
  assert.equal(e.show_ghost,false,'Ghost must start off');assert.equal(e.ghost,false);
  await button('view_ghost');await hover([20,3]);e=await settle();
  assert.ok(e.ghost&&e.ghost.mode==='surface'&&near(e.ghost.pos[0],e.cursor[0],1e-9)&&near(e.ghost.pos[1],0.9,1e-9),JSON.stringify(e.ghost));
  assert.ok(e.readout.startsWith('F: test start here'),e.readout);
  await page.keyboard.down('Shift');await page.waitForTimeout(150);await hover([20.5,3]);e=await settle();
  assert.equal(e.ghost.mode,'drop');assert.ok(near(e.ghost.pos[1],e.cursor[1],1e-9),JSON.stringify(e.ghost));
  await page.keyboard.up('Shift');
  await hover([-3,3]);e=await settle();
  assert.equal(e.ghost.pos,false);assert.equal(e.ghost.err,'no surface below the cursor');assert.equal(e.readout,'F: refused (no surface below the cursor)');
  await hover([30,0]);e=await settle();assert.equal(e.ghost,false,'ghost over an object');
  await button('view_ghost');await hover([20,3]);e=await settle();assert.equal(e.show_ghost,false);assert.equal(e.ghost,false);
  await button('view_ghost');await hover([20,3]);e=await settle();assert.ok(e.ghost.pos);
  await button('open');await hover([20,3]);e=await settle();assert.equal(e.ghost,false,'ghost behind the Open dialog');await key('Escape');
  await hover([16,3]);e=await settle();const ghostAt=e.ghost.pos;
  await key('f');await played('le6-labels');await key('e');e=await edit();
  assert.deepEqual(e.last_test,ghostAt,'F did not start where the ghost was');
  measurements.ghost={pos:ghostAt};
  cases.push('ghost_matches_test_start');checkpoint('ghost_matches_test_start');

  // 9. Readouts: dragging START shows its position and a blocking overlap before release; units match.
  const s0=e.start.position;
  const a0=await world([s0[0],s0[1]]),a1=await world([s0[0]+3,s0[1]+1]),a2=await world([s0[0]+3,0.1]);
  await page.mouse.move(a0.x,a0.y);await pointer.frames(page);await page.mouse.down();await pointer.frames(page);
  await page.mouse.move(a1.x,a1.y,{steps:4});await page.waitForTimeout(150);e=await ed();
  assert.match(e.readout,/^START x -?\d+\.\d\d m  y -?\d+\.\d\d m$/);
  await page.mouse.move(a2.x,a2.y,{steps:4});await page.waitForTimeout(150);e=await ed();
  assert.ok(e.readout.endsWith('| overlaps line o1 (Play blocked)'),e.readout);
  await key('Escape');await page.mouse.up();e=await settle();assert.deepEqual(e.start.position,s0);
  assert.ok(e.overlay.nodes<=e.overlay.max_nodes,JSON.stringify(e.overlay));
  measurements.gui_le6b={nodes:e.overlay.nodes,max_nodes:e.overlay.max_nodes};
  await hover([16,3]);await page.screenshot({path:path.join(out,'polish-ghost.png')});
  await key('h');await page.screenshot({path:path.join(out,'polish-help.png')});await key('h');
  cases.push('readouts_start_drag_units');checkpoint('readouts_start_drag_units');

  checkpoint('start:editor_ui_checks');
  await require('./editor_ui_checks.cjs')({page,ed,doc,key,button,at,hover,importText,settle,snapshot,unchanged,revision,played,edit,canvas,out,cases,measurements,checkpoint,part});
  checkpoint('done:editor_ui_checks');
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'polish-result.json'),JSON.stringify({source_sha:sha,run_id:runId,part,browser:browser.version(),status:'PASS',cases,measurements},null,2));
  console.log(JSON.stringify({status:'PASS',cases,measurements}));
 }catch(e){
  if(errors.length)console.error('Page errors:\n'+errors.join('\n'));
  console.error('Last console lines:\n'+logs.join('\n'));
  if(browser)for(const context of browser.contexts())for(const page of context.pages()){
   console.error('State: '+JSON.stringify(await page.evaluate(()=>({editor:window.riderEditor&&{...window.riderEditor,buttons:undefined,library:undefined},doc:window.riderEditorDoc&&{objects:window.riderEditorDoc.objects?.slice(0,12)}})).catch(()=>null)));
   await page.screenshot({path:path.join(out,'polish-failed.png')}).catch(()=>{});
  }
  throw e;
 }
 finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
