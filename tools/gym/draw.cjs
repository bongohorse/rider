// LE3: draw tool, connections, snapping and live validation in the debug HTML5 gym (level-editor contract R4-R7, R16, R17).
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
  browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1280,height:720}});
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
  const at=async(p,mods)=>{await require('./editor_ui_target.cjs').ensureWorld(page,ed,canvas,p);return click(await world(p),mods);};
  async function dblclick(p){await pointer.dblclick(page,await world(p));}
  async function drag(from,to,mods=[],steps=5){await require('./editor_ui_target.cjs').ensureWorld(page,ed,canvas,from);
   const a=await world(from),b=await world(to);
   await page.mouse.move(a.x,a.y);await pointer.frames(page);await page.mouse.down();await pointer.frames(page);
   for(const m of mods)await page.keyboard.down(m);
   for(let i=1;i<=steps;i++){await page.mouse.move(a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps);await page.waitForTimeout(40);}
   await pointer.frames(page);await page.mouse.up();
   for(const m of mods)await page.keyboard.up(m);
   await pointer.frames(page);
  }
  async function button(name,mods){await require('./editor_ui_target.cjs').reveal(page,name);const b=(await ed()).buttons[name];await click(await canvas(b.x,b.y),mods);}
  async function edit(){await page.waitForFunction(()=>window.riderEditor?.mode==='edit'&&window.riderEditor.view&&window.riderEditor.screen,null,{timeout:20000});await page.waitForTimeout(150);return ed();}
  async function played(id){
   const after=(await ed())?.view?.generation??0;
   await page.waitForFunction(({id,after})=>window.riderEditor?.mode==='play'&&window.riderTelemetry?.station===id&&window.riderTelemetry.sequence>2&&window.riderTelemetry.session_generation>after,{id,after},{timeout:20000});
   return tm();
  }
  async function revision(n){await page.waitForFunction(n=>window.riderEditor.revision===n&&window.riderEditorDoc?.revision===n,n);return ed();}
  const line=(d,id)=>d.objects.find(o=>o.id===id);
  const near=(a,b,eps=1e-6)=>Math.abs(a-b)<=eps;
  const pts=(d,id)=>JSON.stringify(line(d,id).points);
  const onGrid=(v,step)=>near(v/step,Math.round(v/step),1e-9);

  // 1. A blank course: open Straight as a template copy and delete its line. Play is blocked without terrain.
  await page.goto(base+'?station=straight');
  await page.waitForFunction(()=>window.riderTelemetry?.station==='straight'&&window.riderTelemetry.sequence>2);
  await page.locator('canvas').focus();await key('e');let e=await edit();
  assert.equal(e.id,'my-straight');let d=await doc();assert.equal(d.editor_version,9);assert.deepEqual(d.connections,[]);
  assert.ok(line(d,'o1').points[0][0]<line(d,'o1').points[1][0],'template lines run left to right');
  await at([10,0.8]);await page.waitForFunction(()=>window.riderEditor.selection==='o1');
  await key('Delete');e=await revision(1);assert.equal(e.objects,0);assert.ok(e.errors[0].includes('No terrain'),e.errors[0]);
  await key('e');await page.waitForFunction(()=>window.riderEditor.message.includes('Play blocked'));assert.equal((await ed()).mode,'edit');
  cases.push('empty_course_blocks_play');

  // 2. Draw a ramp-gap-landing course on the 0.5 m grid (R6): a run-up, a ramp connected to its free end
  // (connect preview, R5), a 2 m gap and a separate landing piece. One connected run compiles into one chain.
  await require('./editor_ui_target.cjs').frameCourse(page,ed,canvas,{zooms:3,minX:-3.5});
  await key('d');await page.waitForFunction(()=>window.riderEditor.tool==='draw');
  await at([-3.07,1.04]);await page.waitForFunction(()=>window.riderEditor.drawing===1);
  const runEnd=await world([11.93,0.97]);await page.mouse.move(runEnd.x,runEnd.y);
  await page.waitForFunction(()=>/15\.00 m\s+0\.0 deg/.test(window.riderEditor.readout));
  await click(runEnd);await page.waitForFunction(()=>window.riderEditor.drawing===2);
  await click(runEnd);e=await revision(2);assert.equal(e.drawing,0);
  d=await doc();assert.equal(pts(d,'o2'),'[[-3,1],[12,1]]');
  // Hover on the free end shows the connect preview before clicking.
  const endAt=await world([12.05,1.03]);await page.mouse.move(endAt.x,endAt.y);
  await page.waitForFunction(()=>window.riderEditor.snap.kind==='anchor'&&window.riderEditor.readout.includes('connects'));
  await at([12.05,1.03]);await at([16.02,2.04]);await key('Enter');e=await revision(3);
  d=await doc();assert.equal(pts(d,'o3'),'[[12,1],[16,2]]');assert.deepEqual(d.connections,[{from:'o2',to:'o3'}]);
  await at([18,1.5]);await at([22,1]);await dblclick([42,1]);e=await revision(4);
  d=await doc();assert.equal(pts(d,'o4'),'[[18,1.5],[22,1],[42,1]]');assert.equal(d.connections.length,1);
  assert.equal(e.chains,2);assert.deepEqual(e.errors,[]);
  for(const o of d.objects)for(const p of o.points)assert.ok(onGrid(p[0],0.5)&&onGrid(p[1],0.5),'grid point '+p);
  cases.push('draw_ramp_gap_landing_on_grid');

  // 3. FINISH and START speed 8 m/s, then drive the course: one chain per run (4 terrain segments), FINISH reached.
  await button('tool_finish');await at([35,1.3]);e=await revision(5);
  await button('tool_select');await at([0,1.7]);await page.waitForFunction(()=>window.riderEditor.selection==='start');
  await button('plus',['Shift']);for(let i=0;i<6;i++)await button('plus');
  e=await page.waitForFunction(()=>window.riderEditor.start.speed===8);
  await key('e');let t=await played('my-straight');
  assert.equal(t.terrain_shapes,4,'one chain per connected run');assert.equal(t.finish,true);
  const saved=await page.waitForFunction(()=>window.riderCustomStatus==='Saved'&&window.riderSavedLevel).then(h=>h.jsonValue());
  assert.equal(saved.chains.length,2);assert.equal(saved.chains[0].length+saved.chains[1].length,6);
  await page.locator('canvas').focus();await page.keyboard.down('ArrowUp');
  try{await page.waitForFunction(()=>window.riderTelemetry.finish_count===1,null,{timeout:30000});}finally{await page.keyboard.up('ArrowUp');}
  t=await tm();measurements.course={finish_time_s:t.finish_time,terrain_shapes:t.terrain_shapes,chains:saved.chains};
  cases.push('course_driven_to_finish');

  // 4. Connected edit (R4): dragging the joint (the run-up's exit) moves the downstream ramp; the separate
  // landing stays. One Undo step restores geometry and the connection; Redo re-applies both.
  await key('e');e=await edit();const r0=e.revision,before=await doc();
  await drag([12,1],[12.04,1.52]);e=await revision(r0+1);
  d=await doc();assert.equal(pts(d,'o2'),'[[-3,1],[12,1.5]]');assert.equal(pts(d,'o3'),'[[12,1.5],[16,2.5]]');
  assert.equal(pts(d,'o4'),pts(before,'o4'));assert.deepEqual(d.connections,before.connections);
  const edited=JSON.stringify({o:d.objects,c:d.connections});
  await key('z',['Control']);e=await revision(r0+2);d=await doc();
  assert.equal(JSON.stringify({o:d.objects,c:d.connections}),JSON.stringify({o:before.objects,c:before.connections}));
  await key('y',['Control']);e=await revision(r0+3);d=await doc();assert.equal(JSON.stringify({o:d.objects,c:d.connections}),edited);
  await key('z',['Control']);e=await revision(r0+4);cases.push('connected_edit_undo_redo');

  // 5. Dragging a piece moves its whole connected run; Shift multi-select moves each run once (R17).
  await drag([14,1.52],[14,2.5]);e=await revision(r0+5);d=await doc();
  assert.equal(pts(d,'o2'),'[[-3,2],[12,2]]');assert.equal(pts(d,'o3'),'[[12,2],[16,3]]');assert.equal(pts(d,'o4'),pts(before,'o4'));
  await key('z',['Control']);e=await revision(r0+6);
  await at([5,1]);await page.waitForFunction(()=>window.riderEditor.selection==='o2');await click(await world([14,1.5]),['Shift']);await click(await world([30,1]),['Shift']);
  e=await page.waitForFunction(()=>window.riderEditor.selected.length===3).then(()=>ed());assert.deepEqual([...e.selected].sort(),['o2','o3','o4']);
  await page.waitForTimeout(500);await drag([30,1],[31,1]);e=await revision(r0+7);d=await doc();
  assert.equal(pts(d,'o2'),'[[-2,1],[13,1]]');assert.equal(pts(d,'o3'),'[[13,1],[17,2]]');assert.equal(pts(d,'o4'),'[[19,1.5],[23,1],[43,1]]');
  await key('z',['Control']);e=await revision(r0+8);await key('Escape');
  cases.push('run_and_multi_select_move_once');

  // 6. Points: double-click inserts on the segment, Split [K] makes two connected pieces (still one chain),
  // Disconnect [J] warns about the touching ends, Tab cycles the overlapping candidates, Connect [J] joins
  // them again, Delete on an inner point joins its neighbours.
  await at([30,1]);await page.waitForFunction(()=>window.riderEditor.selection==='o4');await page.waitForTimeout(500);
  await dblclick([30,1]);e=await revision(r0+9);d=await doc();assert.equal(pts(d,'o4'),'[[18,1.5],[22,1],[30,1],[42,1]]');
  assert.deepEqual(e.vertex,{id:'o4',index:3});assert.ok(e.visible.includes('split'));
  await key('k');e=await revision(r0+10);d=await doc();
  assert.equal(pts(d,'o4'),'[[18,1.5],[22,1],[30,1]]');assert.equal(pts(d,'o5'),'[[30,1],[42,1]]');
  assert.deepEqual(d.connections,[{from:'o2',to:'o3'},{from:'o4',to:'o5'}]);assert.equal(e.chains,2);assert.deepEqual(e.vertex,{id:'o4',index:3});
  await key('j');e=await revision(r0+11);d=await doc();assert.equal(d.connections.length,1);assert.equal(e.chains,3);
  assert.ok(e.warnings.some(w=>w.includes('touch but are not connected')),JSON.stringify(e.warnings));
  const jointAt=await world([30,1]);await page.mouse.move(jointAt.x+3,jointAt.y);await page.waitForTimeout(120);await page.mouse.move(jointAt.x,jointAt.y);
  await page.waitForFunction(()=>window.riderEditor.hover_count>=4);const hover0=(await ed()).hover;
  await key('Tab');await page.waitForFunction(h=>window.riderEditor.hover!==h,hover0);const hover1=(await ed()).hover;
  measurements.cycle={candidates:(await ed()).hover_count,first:hover0,second:hover1};
  assert.ok(hover0.startsWith('v:')&&hover1.startsWith('v:'),hover0+' '+hover1);
  await key('j');e=await revision(r0+12);d=await doc();assert.equal(d.connections.length,2);assert.equal(e.chains,2);assert.deepEqual(e.warnings,[]);
  await at([22,1]);await page.waitForFunction(()=>window.riderEditor.vertex&&window.riderEditor.vertex.index===2);
  await key('Delete');e=await revision(r0+13);d=await doc();assert.equal(pts(d,'o4'),'[[18,1.5],[30,1]]');
  // A joint cannot be deleted: the refusal is visible and changes nothing.
  await at([30,1]);await key('Delete');await page.waitForFunction(()=>window.riderEditor.message.includes('disconnect it first'));assert.equal((await ed()).revision,r0+13);
  cases.push('insert_split_disconnect_cycle_connect_delete');

  // 7. Snapping (R6): Alt 0.1 m grid, Shift 15 degree rays with the grid along the ray, Ctrl off, G toggles the grid.
  await key('Escape');await key('d');
  await page.keyboard.down('Alt');await page.waitForTimeout(60);await at([5.21,6.41]);await page.keyboard.up('Alt');
  await page.keyboard.down('Shift');await page.waitForTimeout(60);const ray=await world([8.1,7.25]);await page.mouse.move(ray.x,ray.y);
  await page.waitForFunction(()=>window.riderEditor.snap.kind==='angle');e=await ed();await click(ray);await page.keyboard.up('Shift');
  await page.keyboard.down('Control');await page.waitForTimeout(60);await at([10.37,6.83]);await page.keyboard.up('Control');
  await key('g');await page.waitForFunction(()=>window.riderEditor.grid===false);await at([12.33,7.07]);await key('g');
  await key('Enter');e=await revision(r0+14);d=await doc();const free=line(d,'o6').points;measurements.snapping=free;
  assert.deepEqual(free[0],[5.2,6.4]);
  const [len,ang]=[Math.hypot(free[1][0]-5.2,free[1][1]-6.4),Math.atan2(free[1][1]-6.4,free[1][0]-5.2)*180/Math.PI];
  assert.ok(near(ang/15,Math.round(ang/15),1e-6)&&near(len/0.5,Math.round(len/0.5),1e-6),'ray '+len+' '+ang);
  assert.ok(!onGrid(free[2][0],0.1)&&near(free[2][0],10.37,0.05),'Ctrl point '+free[2]);
  assert.ok(!onGrid(free[3][0],0.1)&&near(free[3][0],12.33,0.05),'grid off point '+free[3]);
  // Deleting the hovered end point shortens the line; the stale hover must not break the overlay.
  await key('Escape');await key('s');await at([6,6.61]);await page.waitForFunction(()=>window.riderEditor.selection==='o6');
  await at(free[3]);await page.waitForFunction(()=>window.riderEditor.vertex&&window.riderEditor.vertex.index===4);
  await key('Delete');e=await revision(r0+15);d=await doc();assert.equal(line(d,'o6').points.length,3);
  await page.waitForTimeout(200);assert.equal((await ed()).revision,r0+15,'editor keeps publishing');
  await at([6,6.61]);await page.waitForFunction(()=>window.riderEditor.selection==='o6');await key('Delete');e=await revision(r0+16);
  // A modifier held across a structural edit (edit-world reload) stays active: Alt still gives the 0.1 m grid.
  await key('d');await page.keyboard.down('Alt');await page.waitForTimeout(60);
  await at([5.21,4.41]);await at([9.03,4.38]);await key('Enter');e=await revision(r0+17);
  await edit();const alt=await world([6.31,3.12]);await page.mouse.move(alt.x,alt.y);
  await page.waitForFunction(()=>JSON.stringify(window.riderEditor.snap.p)==='[6.3,3.1]');await page.keyboard.up('Alt');
  await key('z',['Control']);e=await revision(r0+18);await key('s');
  cases.push('snapping_alt_shift_ctrl_g');

  // 8. Unsupported shapes are refused with useful errors (R16) and block Play; Undo removes them.
  // A run that crosses itself and a segment that doubles back are refused; overhangs are allowed (step 9b).
  await key('d');await at([15,5]);await at([19,7]);await at([19,5]);await at([15,7]);await key('Enter');e=await revision(r0+19);
  assert.ok(e.errors.some(m=>m.includes('crosses itself')),JSON.stringify(e.errors));
  await key('e');await page.waitForFunction(()=>window.riderEditor.message.includes('Play blocked')&&window.riderEditor.message.includes('crosses itself'));
  measurements.errors={crossing:(await ed()).errors[0]};
  await key('z',['Control']);e=await revision(r0+20);
  await key('d');await at([24,4]);await at([24,7]);await at([24,5]);await key('Enter');e=await revision(r0+21);
  assert.ok(e.errors.some(m=>m.includes('doubles back')),JSON.stringify(e.errors));measurements.errors.doubles_back=e.errors[0];
  await button('warnings');await page.waitForFunction(()=>window.riderEditor.warnings_open);
  await key('Escape'); // Close the modal problem list before editing the underlying document.
  await key('z',['Control']);e=await revision(r0+22);assert.deepEqual(e.errors,[]);await key('Escape');
  cases.push('unsupported_shapes_refused');

  // 8b. Box selection (LE3b): a line crossing the box is selected even with both ends outside; a box holding
  // a whole line (and a joint of its neighbour) selects both; a box that touches nothing selects nothing.
  await require('./editor_ui_target.cjs').frameCourse(page,ed,canvas,{zooms:-3});
  await key('s');const boxes={};
  for(const [name,from,to,expect] of [['crossing',[4,0.2],[6,3],['o2']],['contained',[11.6,0.4],[16.4,2.4],['o2','o3']],['outside',[20,4],[26,6],[]]]){
   await key('Escape');await drag(from,to);await page.waitForTimeout(150);
   boxes[name]=[...(await ed()).selected].sort();assert.deepEqual(boxes[name],expect,name);
  }
  measurements.box_select=boxes;await key('Escape');cases.push('box_select_crossing_contained_outside');

  // 8c. Connect two separated free ends (LE3b): Shift+click the second end, J bridges them with a new piece;
  // no end moves, the whole course becomes one run and one chain. Undo/Redo restore both states.
  const bridgeBefore=await doc();
  await at([16,2]);await page.waitForFunction(()=>window.riderEditor.vertex&&window.riderEditor.vertex.id==='o3');
  await click(await world([18,1.5]),['Shift']);await page.waitForFunction(()=>window.riderEditor.vertex2&&window.riderEditor.vertex2.id==='o4');
  await key('j');e=await revision(r0+23);d=await doc();
  const bridge=d.objects.find(o=>!bridgeBefore.objects.some(b=>b.id===o.id));
  assert.deepEqual(bridge.points,[[16,2],[18,1.5]]);
  for(const o of bridgeBefore.objects)assert.equal(pts(d,o.id),JSON.stringify(o.points),'end moved: '+o.id);
  assert.equal(d.connections.length,4);assert.equal(e.chains,1);
  await key('e');t=await played('my-straight');assert.equal(t.terrain_shapes,5,'one chain over the bridged gap');
  await key('e');e=await edit();
  const bridged=JSON.stringify({o:d.objects,c:d.connections}),unbridged=JSON.stringify({o:bridgeBefore.objects,c:bridgeBefore.connections});
  await key('z',['Control']);e=await revision(r0+24);d=await doc();assert.equal(JSON.stringify({o:d.objects,c:d.connections}),unbridged);assert.equal(e.chains,2);
  await key('y',['Control']);e=await revision(r0+25);d=await doc();assert.equal(JSON.stringify({o:d.objects,c:d.connections}),bridged);
  await key('z',['Control']);e=await revision(r0+26);
  measurements.bridge={piece:bridge.id,points:bridge.points};cases.push('bridge_separated_ends_undo_redo');

  // 8d. Opening another template while drawing discards the unfinished piece (LE3b); it never lands in the
  // new document. Undo brings the course back.
  await key('d');await at([5,4]);await at([8,5]);await page.waitForFunction(()=>window.riderEditor.drawing===2);
  await button('open');await page.waitForFunction(()=>window.riderEditor.open_dialog);
  await button('template_ramps');await page.waitForFunction(()=>window.riderEditor.id==='my-ramps');
  e=await edit();await button('tool_select');await page.waitForTimeout(200);e=await ed();
  assert.equal(e.drawing,0);assert.equal(e.objects,12);assert.ok(e.message.includes('discarded'),e.message);
  d=await doc();assert.ok(!d.objects.some(o=>o.type==='line'&&JSON.stringify(o.points)==='[[5,4],[8,5]]'));
  // Undo across the document switch (the Undo button, not Ctrl+Z) also discards a piece started in my-ramps.
  await key('d');await at([5,4]);await at([8,5]);await page.waitForFunction(()=>window.riderEditor.drawing===2);
  await button('undo');await page.waitForFunction(()=>window.riderEditor.id==='my-straight');e=await edit();
  await page.waitForTimeout(300);e=await ed();d=await doc();assert.equal(e.drawing,0,'the piece from my-ramps survived the undo');
  assert.ok(!d.objects.some(o=>o.type==='line'&&JSON.stringify(o.points)==='[[5,4],[8,5]]'),'piece from my-ramps landed in my-straight');
  await key('s');
  // The same with two documents that share their level id: a second Straight template copy is my-straight
  // too. Undo and Redo between the two instances discard a piece started in the other one.
  const course=await doc(),hasPiece=d=>d.objects.some(o=>o.type==='line'&&JSON.stringify(o.points)==='[[5,4],[8,5]]');
  await button('open');await page.waitForFunction(()=>window.riderEditor.open_dialog);
  await button('template_straight');await page.waitForFunction(()=>window.riderEditor.id==='my-straight'&&window.riderEditor.objects===1);
  e=await edit();
  await key('d');await at([5,4]);await at([8,5]);await page.waitForFunction(()=>window.riderEditor.drawing===2);
  await button('undo');await page.waitForFunction(n=>window.riderEditor.objects===n,course.objects.length);e=await edit();
  await button('tool_select');await page.waitForTimeout(300);e=await ed();d=await doc();
  assert.equal(e.drawing,0,'Undo to the same-id document kept the piece');assert.ok(!hasPiece(d),'piece landed in the restored same-id document');
  await key('d');await at([5,4]);await at([8,5]);await page.waitForFunction(()=>window.riderEditor.drawing===2);
  await button('redo');await page.waitForFunction(()=>window.riderEditor.objects===1);e=await edit();
  await button('tool_select');await page.waitForTimeout(300);e=await ed();d=await doc();
  assert.equal(e.drawing,0,'Redo to the same-id document kept the piece');assert.ok(!hasPiece(d),'piece landed in the redone same-id document');
  await button('undo');await page.waitForFunction(n=>window.riderEditor.objects===n,course.objects.length);e=await edit();
  d=await doc();assert.equal(JSON.stringify({o:d.objects,c:d.connections}),JSON.stringify({o:course.objects,c:course.connections}));
  // Within one document Undo/Redo keeps the unfinished piece: change the START speed, start a piece, Undo.
  await at([0,1.7]);await page.waitForFunction(()=>window.riderEditor.selection==='start');
  const speed=(await ed()).start.speed;await button('plus');await page.waitForFunction(v=>window.riderEditor.start.speed===v+0.5,speed);
  await key('d');await at([5,4]);await at([8,5]);await page.waitForFunction(()=>window.riderEditor.drawing===2);
  await button('undo');await page.waitForFunction(v=>window.riderEditor.start.speed===v,speed);await page.waitForTimeout(300);
  assert.equal((await ed()).drawing,2,'Undo inside the same document discarded the piece');
  await key('Escape');await page.waitForFunction(()=>window.riderEditor.drawing===0);await key('s');
  cases.push('template_change_discards_drawing');

  // 9. The unplayed draft keeps its pieces and connections across a reload.
  await page.waitForFunction(()=>window.riderEditor.status==='Saved');const kept=await doc();
  await page.goto(base+'?station=custom');e=await edit();d=await doc();
  assert.equal(JSON.stringify({o:d.objects,c:d.connections}),JSON.stringify({o:kept.objects,c:kept.connections}));
  await key('e');t=await played('my-straight');assert.equal(t.terrain_shapes,4);cases.push('draft_keeps_connections');

  // 9b. Overhangs (LE3b): a ramp whose top curls back to the left compiles two-sided (its chain twice, once
  // reversed) and drives: the wheels never pass through the wall and the chassis climbs past the point where
  // the run turns back. Per-tick extremes come from the le3 track probe.
  await key('e');e=await edit();
  await button('open');await page.waitForFunction(()=>window.riderEditor.open_dialog);
  await button('template_straight');await page.waitForFunction(()=>window.riderEditor.objects===1&&window.riderEditor.open_dialog===false);
  e=await edit();await at([10,0.8]);await page.waitForFunction(()=>window.riderEditor.selection!=='');await key('Delete');
  await page.waitForFunction(()=>window.riderEditor.objects===0);
  // The curl ends left of where the run starts: the old one-sided rule (orientation from the run's end
  // points) would put the solid side above the run-up, so the control run falls through.
  const curl=[[-1,1],[10,1],[12,1.5],[13.5,2.5],[14.5,3.5],[15,4.5],[14.5,5.5],[13.5,6],[-2.5,6.5]];
  await key('d');for(const p of curl)await at(p);await key('Enter');
  await page.waitForFunction(()=>window.riderEditor.objects===1&&window.riderEditor.drawing===0);
  e=await ed();d=await doc();assert.ok([JSON.stringify(curl),JSON.stringify([...curl].reverse())].includes(JSON.stringify(d.objects[0].points)),JSON.stringify(d.objects[0].points));assert.deepEqual(e.errors,[]);
  await key('s');await at([0,1.7]);await page.waitForFunction(()=>window.riderEditor.selection==='start');
  for(let i=0;i<3;i++)await button('plus',['Shift']);
  await page.waitForFunction(()=>window.riderEditor.start.speed===15);
  await key('e');t=await played('my-straight');assert.equal(t.terrain_shapes,16,'8 segments, built twice');
  const curlLevel=await page.waitForFunction(()=>window.riderCustomStatus==='Saved'&&window.riderSavedLevel).then(h=>h.jsonValue());
  assert.deepEqual(curlLevel.two_sided,[true]);
  async function drive(){
   await page.locator('canvas').focus();await page.keyboard.down('ArrowUp');
   try{await page.waitForTimeout(4000);}finally{await page.keyboard.up('ArrowUp');}
   return page.evaluate(()=>window.riderTrack);
  }
  const track=await drive();
  // Control: the same level with the reversed chain left out (debug switch) lets the vehicle through.
  await page.evaluate(()=>{window.riderDebugOneSided=true;});
  await key('e');e=await edit();await key('e');t=await played('my-straight');assert.equal(t.terrain_shapes,8);
  const control=await drive();await page.evaluate(()=>{window.riderDebugOneSided=false;});
  measurements.curl={points:curl,two_sided:track,one_sided_control:control};
  console.log('CURL '+JSON.stringify(measurements.curl));
  assert.equal(track.resets,0,'two-sided run: no fall-through reset');
  assert.ok(track.wheel_max_x<15,'a wheel passed through the wall: '+JSON.stringify(track));
  assert.ok(track.max_y>4.5,'the chassis did not climb past the turn-back point (15, 4.5): '+JSON.stringify(track));
  assert.ok(control.min_y<0||control.resets>0,'one-sided control unexpectedly held: '+JSON.stringify(control));
  cases.push('overhang_curl_drives_two_sided');

  // 10. Editor budget re-check (R7) at the 800-segment sample: level sprites stay the only sprites; overlays
  // are GUI nodes within editor.gui max_nodes and drop handles (counted) instead of exceeding the pool.
  const seg=fs.readFileSync(path.join(__dirname,'../../main/gym/samples/seg-800.json'),'utf8');
  await page.evaluate(text=>{window.riderCustom.open();document.querySelector('#rider-custom-text').value=text;
   [...document.querySelectorAll('#rider-custom-panel button')].find(b=>b.textContent==='Import text').click();},seg);
  await page.waitForFunction(()=>!window.riderCustom.visible&&window.riderTelemetry?.station==='seg-800'&&window.riderCustomStatus==='Saved',null,{timeout:20000});
  const playSprites=(await tm()).decor_sprites;
  await page.locator('canvas').focus();await key('e');e=await edit();d=await doc();
  const segLine=d.objects.find(o=>o.type==='line');const p0=segLine.points.reduce((a,b)=>Math.abs(b[0]-10)<Math.abs(a[0]-10)?b:a);
  // The first click within 1 s of the canvas regaining focus (after the import panel) is ignored (R15).
  await page.waitForTimeout(1100);await at(p0);await page.waitForFunction(()=>window.riderEditor.selection!=='');
  const budget=[];
  for(const zoomSteps of [0,6]){
   for(let i=0;i<zoomSteps;i++){await page.mouse.wheel(0,120);await page.waitForTimeout(60);}
   await page.keyboard.down('Alt');await page.waitForTimeout(200);e=await ed();await page.keyboard.up('Alt');
   budget.push({zoom:e.camera.zoom,sprites:e.view.sprites,labels:e.view.labels,overlay:e.overlay});
  }
  for(const b of budget){
   assert.ok(b.sprites<=1024&&b.labels<=1024,JSON.stringify(b));assert.ok(b.overlay.nodes<=b.overlay.max_nodes,JSON.stringify(b));
   assert.ok(b.overlay.handles<=192&&b.overlay.grid<=96&&b.overlay.lines<=64,JSON.stringify(b));
  }
  assert.ok(budget.some(b=>b.overlay.dropped>0),'a full level exceeds the handle pool');
  measurements.budget={play_decor_sprites:playSprites,edit:budget,editor_gui_max_nodes:Number(/max_nodes: (\d+)/.exec(fs.readFileSync(path.join(__dirname,'../../main/gym/editor.gui'),'utf8'))[1])};
  assert.equal(measurements.budget.editor_gui_max_nodes,budget[0].overlay.max_nodes);
  cases.push('editor_budget_recheck');

  // 11. Drafts above the sprite budget (LE3b): the source validator accepts them; the edit world checks the
  // budget before building and lets sprites span several points. They open, edit and restore after a reload;
  // Play stays blocked by the station validator.
  const wave=(n,x0,y0)=>Array.from({length:n},(_,i)=>[Math.round((x0+i*0.5)*1000)/1000,Math.round((y0+0.2*Math.sin(i/10))*1000)/1000]);
  const big=lines=>JSON.stringify({schema:1,units:'metres',id:'big',name:'Big draft',editor:{editor_version:2,compiler_version:2,revision:1,next_id:lines.length+1,
   objects:lines.map((points,i)=>({id:'o'+(i+1),type:'line',points})),connections:[],start:{position:[0,1.7],speed:0}}});
  const large=[];
  for(const [name,lines] of [['1651 points',[wave(1651,-5,1)]],['7245 points',[wave(1101,-5,1),wave(2048,-5,10),wave(2048,-5,20),wave(2048,-5,30)]]]){
   // A pending autosave of the open document would get a higher slot sequence than the injected draft.
   await page.waitForFunction(()=>window.riderEditor.status==='Saved'&&!window.riderEditor.dirty);
   await page.evaluate(([text,seq])=>{window.riderDebugDraft={slot:1,seq,text,now:true};},[big(lines),100000*(large.length+1)]);
   await page.waitForFunction(()=>window.riderDebugDraft===null);
   // sys.save only writes the in-memory file system; wait for the IndexedDB sync before reloading.
   // The write starts its sync synchronously on file close, so 'syncing' is already visible here.
   await page.waitForFunction(()=>window.riderCustom.syncState()!=='syncing');
   assert.equal(await page.evaluate(()=>window.riderCustom.syncState()),'saved','injected draft sync');
   await page.goto(base+'?station=custom');e=await edit();
   assert.equal(e.id,'big');
   await page.waitForFunction(()=>window.riderEditor.status==='Saved'||!window.riderEditor.dirty);assert.equal(e.objects,lines.length);
   assert.ok(e.view.sprites<=1024&&e.view.simplified,name+' '+JSON.stringify(e.view));assert.ok(e.display_note.includes('Display simplified'),e.display_note);
   assert.ok(e.errors.some(m=>m.includes('Resource budget')),JSON.stringify(e.errors));
   const entry={name,points:lines.reduce((n,l)=>n+l.length,0),view:e.view,note:e.display_note,error:e.errors.find(m=>m.includes('Resource budget'))};
   if(large.length===0){
    await key('e');await page.waitForFunction(()=>window.riderEditor.message.includes('Play blocked'));
    // Blocked Play now selects/frames its source. Clear that selection and restore working precision
    // before dragging the whole dense line; keep the same geometry and persistence assertions.
    assert.equal((await ed()).selection,'o1');assert.ok((await ed()).ui.error_banner.includes('Resource budget'));
    await key('Escape');await require('./editor_ui_target.cjs').frameCourse(page,ed,canvas,{zooms:-8,minX:-5});
    await page.waitForTimeout(1100);await drag([10.02,1.03],[10.02,3.03]);e=await revision(2);d=await doc();
    assert.ok(d.objects[0].points[0][1]>2,'line moved');const moved=JSON.stringify(d.objects[0].points.slice(0,3));
    assert.ok(e.view.sprites<=1024,JSON.stringify(e.view));
    await page.waitForFunction(()=>window.riderEditor.status==='Saved');
    await page.goto(base+'?station=custom');e=await edit();d=await doc();
    assert.equal(e.revision,2);assert.equal(JSON.stringify(d.objects[0].points.slice(0,3)),moved);assert.ok(e.view.sprites<=1024&&e.view.simplified);
    entry.after_reload=e.view;
    // FINISH and a direction flip at the full budget: the flip creates its objects before the old ones are freed.
    await page.waitForTimeout(1100);await button('tool_finish');await at([20,1.6]);e=await revision(3);
    await button('tool_select');await at([20,3]);await page.waitForFunction(()=>window.riderEditor.selection==='finish');
    await button('direction');e=await revision(4);await page.waitForTimeout(300);e=await ed();
    assert.equal(e.finish.direction,-1);assert.ok(e.view.sprites<=1024,JSON.stringify(e.view));entry.with_finish=e.view;
   }
   large.push(entry);
  }
  measurements.large_drafts=large;cases.push('drafts_above_sprite_budget');

  if(errors.length)throw Error(errors.join('\n'));
  await page.screenshot({path:path.join(out,'draw-budget.png')});
  fs.writeFileSync(path.join(out,'draw-result.json'),JSON.stringify({source_sha:sha,run_id:runId,browser:browser.version(),status:'PASS',cases,measurements},null,2));
  console.log(JSON.stringify({status:'PASS',cases,measurements}));
 }catch(e){
  if(errors.length)console.error('Page errors:\n'+errors.join('\n'));
  if(browser)for(const context of browser.contexts())for(const page of context.pages()){
   console.error('State: '+JSON.stringify(await page.evaluate(()=>({editor:window.riderEditor&&{...window.riderEditor,buttons:undefined},doc:window.riderEditorDoc&&{objects:window.riderEditorDoc.objects?.slice(0,8),connections:window.riderEditorDoc.connections},
    telemetry:window.riderTelemetry&&{station:window.riderTelemetry.station,finish_count:window.riderTelemetry.finish_count,terrain_shapes:window.riderTelemetry.terrain_shapes},status:window.riderCustomStatus})).catch(()=>null)));
   await page.screenshot({path:path.join(out,'draw-failed.png')}).catch(()=>{});
  }
  throw e;
 }
 finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
