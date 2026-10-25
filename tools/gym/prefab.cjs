// LE5a: parametric prefabs and Mirror in the debug HTML5 gym (level-editor contract R1, R4-R7, R9, R12, R16, R17).
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
  browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1280,height:720},acceptDownloads:true});
  await configure(page,runId,process.argv[5]);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{const t=m.text();logs.push(t);if(logs.length>60)logs.shift();if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(t))errors.push(t);});
  const base='http://127.0.0.1:'+server.address().port+'/index.html';
  const ed=()=>page.evaluate(()=>window.riderEditor);
  const doc=()=>page.evaluate(()=>window.riderEditorDoc);
  const paths=()=>page.evaluate(()=>window.riderEditorPaths);
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
  async function hover(p){const a=await world(p);await page.mouse.move(a.x,a.y);await page.waitForTimeout(120);}
  async function click(at,mods=[]){
   for(const m of mods)await page.keyboard.down(m);
   if(mods.length)await page.waitForTimeout(60);
   await pointer.tap(page,at);
   for(const m of mods)await page.keyboard.up(m);
  }
  const at=async(p,mods)=>click(await world(p),mods);
  async function drag(from,to,steps=6){
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
   return page.evaluate(()=>window.riderTelemetry);
  }
  async function revision(n){await page.waitForFunction(n=>window.riderEditor.revision===n&&window.riderEditorDoc?.revision===n,n);return ed();}
  async function saved(){
   await page.waitForFunction(()=>window.riderEditor.status==='Saved'&&!window.riderEditor.dirty);
   await page.waitForFunction(()=>window.riderCustom.syncState()!=='syncing');
   return ed();
  }
  const refocused=()=>page.waitForTimeout(1100);
  // Canonical JSON (sorted keys): Lua tables have no key order.
  const canon=v=>Array.isArray(v)?v.map(canon):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])])):v;
  const shape=d=>JSON.stringify(canon({objects:d.objects,connections:d.connections,start:d.start,finish:d.finish??null}));
  const obj=(d,id)=>d.objects.find(o=>o.id===id);
  const tan=deg=>Math.tan(deg*(Math.PI/180));
  const near=(a,b,eps=1e-9)=>Math.abs(a-b)<=eps;
  const nearPoint=(p,q,eps=1e-9)=>near(p[0],q[0],eps)&&near(p[1],q[1],eps);
  const exitOf=async id=>(await paths())[id].at(-1);
  async function importText(text,name){
   await button('import');await page.waitForFunction(()=>window.riderCustom.visible&&document.getElementById('rider-custom-file'));
   await page.locator('#rider-custom-file').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(text)});
   await page.waitForFunction(()=>!window.riderCustom.visible);await refocused();
   return ed();
  }
  // Places the current prefab type with its entry on p (or on the free end p snaps to).
  async function place(p,expectTarget){
   const r=(await ed()).revision;await hover(p);
   const e=await ed();assert.equal(e.place.target,expectTarget??false,'connect preview '+JSON.stringify(e.place));
   await at(p);return revision(r+1);
  }
  // Frames the course (0-68 m) between the tool palette and the right panel: five zoom-out steps (1.2 each)
  // followed by a pan to put the source origin inside the actual uncovered canvas.
  async function frame(){await require('./editor_ui_target.cjs').frameCourse(page,ed,canvas);}
  // A case passes only without engine script errors so far.
  const done=name=>{if(errors.length)throw Error(errors.join('\n'));cases.push(name);};
  const started=Date.now();

  // 1. Prefab tool: a Flat, a Ramp placed on its free exit and a Flat on the ramp's exit connect into one run
  // (deliberate placement with a visible connect preview, R5).
  await page.goto(base+'?station=straight');
  await page.waitForFunction(()=>window.riderTelemetry?.station==='straight'&&window.riderTelemetry.sequence>2);
  await page.locator('canvas').focus();await key('e');let e=await edit();
  await button('new');await page.waitForFunction(()=>window.riderEditor.id==='my-level-1');e=await saved();
  let d=await doc();assert.equal(d.editor_version,7);assert.equal(d.compiler_version,7);
  await frame();
  await key('p');e=await ed();assert.equal(e.tool,'prefab');assert.equal(e.prefab_kind,'flat');
  for(const k of ['flat','ramp','step','gap','kicker','platform'])assert.ok(e.visible.includes('kind_'+k),k);
  e=await place([0,0]);d=await doc();
  assert.deepEqual(canon(obj(d,'o1')),canon({id:'o1',type:'prefab',kind:'flat',at:[0,0],params:{length:10}}));
  assert.equal(e.selection,'o1');assert.deepEqual(e.rows,['Length: 10.00 m']);
  await key('2');assert.equal((await ed()).prefab_kind,'ramp');
  e=await place([10.2,0.1],'o1');d=await doc();
  assert.deepEqual(canon(obj(d,'o2')),canon({id:'o2',type:'prefab',kind:'ramp',at:[10,0],params:{mode:'angle',length:4,angle:15}}));
  await key('1');const rampExit=await exitOf('o2');assert.ok(nearPoint(rampExit,[14,4*tan(15)]),JSON.stringify(rampExit));
  e=await place([rampExit[0]+0.15,rampExit[1]+0.1],'o2');d=await doc();
  assert.deepEqual(obj(d,'o3').at,rampExit);assert.deepEqual(d.connections,[{from:'o1',to:'o2'},{from:'o2',to:'o3'}]);
  assert.equal(e.problem,'');
  done('place_and_connect');

  // 2. Numeric fields edit the parameters. The focused field takes every key (E, S, P only type). Invalid
  // input is refused with the reason and leaves the shape unchanged. A change keeps the ramp's entry and the
  // upstream Flat fixed and moves the downstream Flat by the exit displacement; Undo/Redo restore it exactly.
  await key('s');await at([12,2*tan(15)]);await page.waitForFunction(()=>window.riderEditor.selection==='o2');
  e=await ed();assert.deepEqual(e.rows,['Input: angle  (click)','Length: 4.00 m','Angle: 15.0 deg']);
  const before=await doc(),r0=e.revision;
  await button('param_3');await page.waitForFunction(()=>window.riderEditor.field_param==='angle'&&window.riderEditor.field==='15');
  await page.keyboard.type('esp',{delay:40});await page.waitForTimeout(150);
  e=await ed();assert.equal(e.field,'esp');assert.equal(e.mode,'edit');assert.equal(e.tool,'select');
  await key('Enter');e=await ed();assert.ok(e.message.startsWith('Angle: enter a number in deg'),e.message);assert.equal(e.revision,r0);assert.equal(e.field,'esp');
  for(let i=0;i<3;i++)await key('Backspace');
  await page.keyboard.type('75');await page.waitForFunction(()=>window.riderEditor.field==='75');await key('Enter');
  e=await ed();assert.ok(e.message.includes('Angle must be from -60 to 60 deg (got 75).'),e.message);
  assert.equal(e.revision,r0);assert.equal(shape(await doc()),shape(before));
  measurements.invalid={text:'Angle: enter a number in deg, e.g. 15.',range:e.message};
  await key('Escape');e=await ed();assert.equal(e.field,false);
  await button('param_3');await page.waitForFunction(()=>window.riderEditor.field_param==='angle');
  await page.keyboard.type('20');await page.waitForFunction(()=>window.riderEditor.field==='20');await key('Enter');
  e=await revision(r0+1);const after=await doc();
  assert.deepEqual(obj(after,'o2').params,{mode:'angle',length:4,angle:20});assert.deepEqual(obj(after,'o2').at,[10,0]);
  assert.deepEqual(obj(after,'o1'),obj(before,'o1'));assert.deepEqual(obj(after,'o3').params,obj(before,'o3').params);
  assert.ok(nearPoint(obj(after,'o3').at,[14,4*tan(20)]),JSON.stringify(obj(after,'o3')));
  assert.deepEqual(obj(after,'o3').at,await exitOf('o2'));assert.deepEqual(after.connections,before.connections);
  await key('z',['Control']);await revision(r0+2);assert.equal(shape(await doc()),shape(before));
  await key('y',['Control']);await revision(r0+3);assert.equal(shape(await doc()),shape(after));
  measurements.flat_ramp_flat={before:obj(before,'o3').at,after:obj(after,'o3').at};
  done('parameter_change_moves_downstream');done('invalid_parameters_unchanged');

  // 3. A change that adds a Play-blocking error is applied as one visible conflict: START above the downstream
  // Flat, then a steeper ramp lifts that Flat into it. Undo restores the previous shape.
  await button('tool_start');await at([20,2.6]);e=await revision(r0+4);await button('tool_select');
  await at([12,2*tan(20)]);await page.waitForFunction(()=>window.riderEditor.selection==='o2');
  const calm=await doc();
  await button('param_3');await page.waitForFunction(()=>window.riderEditor.field_param==='angle');
  await page.keyboard.type('35');await page.waitForFunction(()=>window.riderEditor.field==='35');await key('Enter');
  e=await revision(r0+5);assert.ok(e.message.startsWith('Changed, with a conflict: START overlaps flat o3. Undo'),e.message);
  assert.ok(e.errors.includes('START overlaps flat o3'),JSON.stringify(e.errors));measurements.conflict=e.message;
  await key('z',['Control']);e=await revision(r0+6);assert.equal(shape(await doc()),shape(calm));assert.ok(!e.errors.includes('START overlaps flat o3'));
  // The handle drag readout names the same conflict before release; Esc cancels the drag unchanged.
  await at([12,2*tan(20)]);await page.waitForFunction(()=>window.riderEditor.selection==='o2');
  const end=(await ed()).handles.find(x=>x.name==='end').p,ha=await world(end),hb=await world([end[0],end[1]+1.2]);
  await page.mouse.move(ha.x,ha.y);await pointer.frames(page);await page.mouse.down();await pointer.frames(page);
  for(let i=1;i<=5;i++){await page.mouse.move(ha.x,ha.y+(hb.y-ha.y)*i/5);await page.waitForTimeout(40);}
  await page.waitForFunction(()=>window.riderEditor.readout.includes('conflict: START overlaps flat o3'));
  measurements.drag_conflict=(await ed()).readout;
  await key('Escape');await page.mouse.up();await pointer.frames(page);
  e=await ed();assert.equal(e.revision,r0+6);assert.equal(shape(await doc()),shape(calm));
  done('conflict_is_visible');

  // 4. Handles edit the same parameters: dragging the ramp's exit handle 2 m right sets the length on the grid
  // and the angle in whole degrees; the downstream Flat follows. The input mode switch keeps the shape.
  await at([12,2*tan(20)]);await page.waitForFunction(()=>window.riderEditor.selection==='o2');
  e=await ed();const h=e.handles.find(x=>x.name==='end');assert.equal(h.index,2);assert.ok(nearPoint(h.p,[14,4*tan(20)]));
  const r1=e.revision;await drag(h.p,[h.p[0]+2,h.p[1]]);e=await revision(r1+1);d=await doc();
  const angle=Math.round(Math.atan2(4*tan(20),6)*180/Math.PI);
  assert.deepEqual(obj(d,'o2').params,{mode:'angle',length:6,angle});assert.ok(nearPoint(obj(d,'o3').at,[16,6*tan(angle)]),JSON.stringify(obj(d,'o3')));
  assert.deepEqual(obj(d,'o1'),obj(calm,'o1'));
  measurements.handle={params:obj(d,'o2').params};
  await key('z',['Control']);await revision(r1+2);assert.equal(shape(await doc()),shape(calm));
  await button('param_1');e=await revision(r1+3);d=await doc();
  assert.equal(obj(d,'o2').params.mode,'height');assert.ok(near(obj(d,'o2').params.height,4*tan(20)));assert.equal(obj(d,'o2').params.angle,undefined);
  assert.ok(nearPoint(obj(d,'o3').at,obj(calm,'o3').at));assert.equal(e.rows[2],'Height: 1.46 m');
  await key('z',['Control']);await revision(r1+4);assert.equal(shape(await doc()),shape(calm));
  // A 100 m ramp at 30 deg rises 57.7 m, beyond the height range: the input switch is refused unchanged.
  for(const [row,value,rev] of [['param_2','100',r1+5],['param_3','30',r1+6]]){
   await button(row);await page.waitForFunction(()=>window.riderEditor.field_param);
   await page.keyboard.type(value,{delay:40});await page.waitForFunction(v=>window.riderEditor.field===v,value);await key('Enter');await revision(rev);
  }
  await button('param_1');e=await ed();assert.ok(e.message.startsWith('Input stays angle: the height would be 57.74 m'),e.message);assert.equal(e.revision,r1+6);
  await key('z',['Control']);await key('z',['Control']);await revision(r1+8);assert.equal(shape(await doc()),shape(calm));
  done('handles_edit_parameters');

  // 5. The remaining types complete a ten-object course: Step, Flat, Gap with pit, Flat, Kicker + landing,
  // Flat on the landing and a Platform (a separate hull, never connected).
  await key('p');
  for(const [k,id] of [['3','o3'],['1','o4'],['4','o5'],['1','o6'],['5','o7'],['1','o8']]){
   await key(k);const x=await exitOf(id);await place([x[0]+0.1,x[1]+0.1],id);
  }
  await key('6');e=await place([60,4]);
  d=await doc();assert.equal(d.objects.length,10);assert.equal(d.connections.length,8);
  assert.deepEqual(d.objects.map(o=>o.kind),['flat','ramp','flat','step','flat','gap','flat','kicker','flat','platform']);
  assert.deepEqual(obj(d,'o10').at,[60,4]);assert.ok(!d.connections.some(c=>c.from==='o10'||c.to==='o10'));
  e=await saved();assert.equal(e.problem,'');measurements.course={objects:10,connections:8,elapsed_s:Math.round((Date.now()-started)/1000),view:e.view};
  await key('s');const kp=(await paths()).o8;await at([(kp[0][0]+kp[1][0])/2,(kp[0][1]+kp[1][1])/2]);
  await page.waitForFunction(()=>window.riderEditor.selection==='o8');e=await ed();
  assert.equal(e.rows.length,6);assert.deepEqual(e.handles.map(x=>x.name),['lip','gap','end']);
  await page.screenshot({path:path.join(out,'prefab-course.png')});
  // Jumping left swaps the kicker's parts through local mesh updates. Its gap handle sits on the kicker's back
  // wall and follows a drag (the landing end holds the entry).
  const gen=e.view.generation,r5=e.revision,uploads=await page.evaluate(()=>window.riderEditorMesh.uploads);await button('param_1');e=await revision(r5+1);
  await page.waitForFunction(n=>window.riderEditorMesh.uploads>n,uploads);e=await ed();assert.equal(e.view.generation,gen,'a local prefab edit reloaded the world');
  assert.equal((await doc()).objects[7].params.facing,'left');assert.deepEqual(e.handles.map(x=>x.name),['lip','gap']);
  const gh=e.handles.find(x=>x.name==='gap').p;const flipped=(await paths()).o8;assert.ok(nearPoint(gh,flipped[2]),JSON.stringify([gh,flipped]));
  await drag(gh,[gh[0]+1,gh[1]]);e=await revision(r5+2);
  assert.equal((await doc()).objects[7].params.gap,3);assert.ok(nearPoint(e.handles.find(x=>x.name==='gap').p,[gh[0]+1,gh[1]]),JSON.stringify(e.handles));
  measurements.left_jump={view_generation:[gen,e.view.generation],gap_handle:gh};
  await key('z',['Control']);await key('z',['Control']);await revision(r5+4);
  assert.equal((await doc()).objects[7].params.facing,'right');await key('Escape');
  done('ten_object_course');

  // 6. Kicker + landing keeps a real jump gap: no compiled chain segment spans it (two chains), and a vehicle
  // dropped above the gap falls through while one dropped on the landing rests on it.
  await key('s');
  const [download]=await Promise.all([page.waitForEvent('download'),button('export')]);
  const text=fs.readFileSync(await download.path(),'utf8');const file=JSON.parse(text);
  await page.getByRole('button',{name:'Close export',exact:true}).click();await refocused();
  const kick=(await paths()).o8,deck=kick[0][1],lipX=kick[1][0],landX=kick[3][0];
  assert.ok(near(landX-lipX,2),JSON.stringify(kick));
  assert.equal(file.chains.length,2);assert.equal(file.hulls.length,1);assert.deepEqual(file.hulls[0].vertices,[[60,4],[66,4],[66,5],[60,5]]);
  for(const chain of file.chains)for(let i=1;i<chain.length;i++){
   const lo=Math.min(chain[i-1][0],chain[i][0]),hi=Math.max(chain[i-1][0],chain[i][0]);
   assert.ok(!(lo<landX-1e-6&&hi>lipX+1e-6),'a segment spans the jump gap: '+JSON.stringify([chain[i-1],chain[i]]));
  }
  // The track restarts with every reset; a bounds reset means the vehicle fell out of the level.
  async function drop(x,y,done){
   await hover([x,y]);await key('f',['Shift']);const g=(await played('my-level-1')).session_generation;
   await page.waitForFunction(([g,deck,done])=>{const t=window.riderTrack;return t?.generation===g&&(done==='fell'?t.min_y<deck-2||t.resets>0:t.ticks>150);},[g,deck,done],{timeout:15000});
   const t=await page.evaluate(()=>window.riderTrack);await key('e');await edit();return t;
  }
  const fell=await drop((lipX+landX)/2,deck+3,'fell'),rest=await drop(landX+3,deck+3,'rest');
  assert.ok(fell.min_y<deck-2||fell.resets>0,'the vehicle fell through the gap: '+JSON.stringify(fell));
  assert.ok(rest.min_y>deck&&rest.resets===0,'the vehicle rests on the landing: '+JSON.stringify(rest));
  measurements.jump_gap={deck,lip_x:lipX,landing_x:landX,chains:file.chains.length,gap_drop_min_y:fell.min_y,landing_drop_min_y:rest.min_y};
  done('jump_gap_stays_open');

  // 7. Prefab type, parameters, ids and connections survive a reload and an export -> import round trip.
  e=await saved();const course=await doc();const level={key:e.key,shape:shape(course)};
  assert.ok(file.editor.objects.filter(o=>o.type==='prefab').length===10&&file.editor.editor_version===7,JSON.stringify(file.editor.objects[0]));
  assert.equal(shape(file.editor),level.shape);
  await page.goto(base+'?station=custom');e=await edit();
  assert.equal(e.key,level.key);assert.equal(shape(await doc()),level.shape);assert.equal(e.status,'Saved');
  e=await importText(text,'my-level-1.json');assert.ok(e.message.startsWith('Imported'),e.message);assert.equal(e.conflict,false);
  assert.equal(shape(await doc()),level.shape);e=await saved();assert.notEqual(e.key,level.key);
  await frame();
  measurements.export={bytes:Buffer.byteLength(text),chains:file.chains.length,hulls:file.hulls.length};
  done('reload_and_export_import_keep_prefabs');

  // 8. Copy/paste keeps type and parameters with new ids and only the internal connection; Undo/Redo.
  await at([12,2*tan(20)]);await page.waitForFunction(()=>window.riderEditor.selection==='o2');
  const o3=(await paths()).o3;await at([(o3[0][0]+o3[1][0])/2,o3[0][1]],['Shift']);await page.waitForFunction(()=>window.riderEditor.selected.length===2);
  await key('c',['Control']);e=await ed();assert.deepEqual(e.clipboard,{objects:2,connections:1});
  await hover([30,12]);const r2=e.revision;await key('v',['Control']);e=await revision(r2+1);d=await doc();
  assert.deepEqual(e.selected,['o11','o12']);
  assert.deepEqual([obj(d,'o11').kind,obj(d,'o12').kind],['ramp','flat']);
  assert.deepEqual(obj(d,'o11').params,obj(course,'o2').params);assert.deepEqual(obj(d,'o12').params,obj(course,'o3').params);
  assert.deepEqual(d.connections.filter(c=>['o11','o12'].includes(c.from)||['o11','o12'].includes(c.to)),[{from:'o11',to:'o12'}]);
  assert.deepEqual(obj(d,'o12').at,(await paths()).o11.at(-1));
  await key('z',['Control']);e=await revision(r2+2);assert.equal(e.objects,10);
  await key('y',['Control']);e=await revision(r2+3);assert.equal(e.objects,12);
  done('copy_paste_prefabs');

  // 9. Mirror [<] [>] replaces Duplicate: a horizontally mirrored copy beside the selection with new ids, the
  // internal connection reversed (the copy runs left to right again) and the original unchanged; Undo/Redo.
  await key('Escape');await key('Escape');
  const k=(await paths()).o8;await at([(k[0][0]+k[1][0])/2,(k[0][1]+k[1][1])/2]);await page.waitForFunction(()=>window.riderEditor.selection==='o8');
  const o9=(await paths()).o9;await at([(o9[0][0]+o9[1][0])/2,o9[0][1]],['Shift']);await page.waitForFunction(()=>window.riderEditor.selected.length===2);
  e=await ed();assert.ok(!e.visible.includes('duplicate')&&e.visible.includes('mirror_left')&&e.visible.includes('mirror_right'));
  const pre=await doc(),prePaths=await paths(),r3=e.revision;
  await button('mirror_right');e=await revision(r3+1);d=await doc();const post=await paths();
  assert.deepEqual(e.selected,['o13','o14']);assert.ok(e.message.includes('to the right'),e.message);
  for(const id of ['o8','o9'])assert.deepEqual(obj(d,id),obj(pre,id));
  assert.equal(obj(d,'o13').params.facing,'left');assert.deepEqual({...obj(d,'o13').params,facing:'right'},obj(pre,'o8').params);
  assert.deepEqual(obj(d,'o14').params,obj(pre,'o9').params);
  assert.deepEqual(d.connections.filter(c=>c.from==='o13'||c.to==='o13'||c.from==='o14'||c.to==='o14'),[{from:'o14',to:'o13'}]);
  // The mirror axis is rounded to the 0.5 m grid (the kicker length is not on it); the copy clears the original by 1 m.
  const xs=[...prePaths.o8,...prePaths.o9].map(p=>p[0]),x0=Math.min(...xs),x1=Math.max(...xs),c2=Math.round((x0+x1)*2)/2;
  const shift=Math.ceil((x1+1-(c2-x1))*2)/2;
  assert.ok(c2-x1+shift>=x1+1-1e-9);
  for(const [copy,orig] of [['o13','o8'],['o14','o9']]){
   const want=[...prePaths[orig]].reverse().map(p=>[c2-p[0]+shift,p[1]]);
   assert.equal(post[copy].length,want.length);post[copy].forEach((p,i)=>assert.ok(nearPoint(p,want[i]),copy+' '+JSON.stringify([p,want[i]])));
  }
  await key('z',['Control']);e=await revision(r3+2);assert.equal(shape(await doc()),shape(pre));
  await key('y',['Control']);e=await revision(r3+3);assert.equal(e.objects,14);
  await key('Escape');await at([12,2*tan(20)]);await page.waitForFunction(()=>window.riderEditor.selection==='o2');
  await button('mirror_left');e=await revision(r3+4);d=await doc();const left=await paths();
  assert.deepEqual(e.selected,['o15']);assert.ok(e.message.includes('to the left'),e.message);
  assert.deepEqual(obj(d,'o15').params,{mode:'angle',length:4,angle:-20});
  const ramp=prePaths.o2,rc2=ramp[0][0]+ramp[1][0];
  [...ramp].reverse().map(p=>[rc2-p[0]-5,p[1]]).forEach((p,i)=>assert.ok(nearPoint(left.o15[i],p),JSON.stringify([left.o15,p])));
  await key('z',['Control']);e=await revision(r3+5);assert.equal(e.objects,14);
  await key('y',['Control']);e=await revision(r3+6);assert.equal(e.objects,15);
  measurements.mirror={right:{copies:['o13','o14'],offset_m:shift},left:{copy:'o15',offset_m:-5}};
  done('mirror_left_and_right');

  // 10. An LE4 (editor version 2) level with compiled data for its revision opens unchanged under compiler 3:
  // the recompile matches (no R1 conflict) and it is upgraded with its connections.
  const v2={schema:1,units:'metres',id:'le4-level',name:'LE4 level',spawn:[0,1],start_speed:0,run_in:0,run_out:0,bounds:[-13,26,-10,21.68],
   chains:[[[16,1.5],[12,0],[-3,0]]],hulls:[],labels:[],checkpoints:[],
   editor:{editor_version:2,compiler_version:2,revision:3,compiled_revision:3,next_id:3,objects:[{id:'o1',type:'line',points:[[-3,0],[12,0]]},{id:'o2',type:'line',points:[[12,0],[16,1.5]]}],
    connections:[{from:'o1',to:'o2'}],start:{position:[0,1],speed:0}}};
  e=await importText(JSON.stringify(v2),'le4-level.json');assert.equal(e.conflict,false,e.conflict);assert.ok(e.message.startsWith('Imported'),e.message);
  d=await doc();assert.equal(d.editor_version,7);assert.deepEqual(d.connections,[{from:'o1',to:'o2'}]);assert.equal(d.objects.length,2);
  await key('e');await played('le4-level');await key('e');e=await edit();
  done('le4_document_opens');

  // 11. Budgets with prefabs (R7, R16): 255 objects (64 Platforms, 95 Gaps with pit and 95 Ramps in one run,
  // one 1650-point line) exceed the 800 render objects. Play is blocked with the reason and nothing changes;
  // the edit world still draws every segment. Without the line the prefab course plays.
  const objects=[],connections=[];let x=0,y=0,n=0;
  for(let i=0;i<95;i++){
   objects.push({id:'o'+(++n),type:'prefab',kind:'gap',at:[x,y],params:{width:2,depth:0.5}});x+=2;
   objects.push({id:'o'+(++n),type:'prefab',kind:'ramp',at:[x,y],params:{mode:'height',length:2,height:i%2?-0.35:0.35}});x+=2;y=i%2?0:0.35;
  }
  for(let i=1;i<n;i++)connections.push({from:'o'+i,to:'o'+(i+1)});
  for(let i=0;i<64;i++)objects.push({id:'o'+(++n),type:'prefab',kind:'platform',at:[i*6,40],params:{width:4,height:1}});
  objects.push({id:'o'+(++n),type:'line',points:Array.from({length:1650},(_,i)=>[i*0.5,-8+(i%2)*0.2])});
  const budgetDoc={schema:1,units:'metres',id:'prefab-budget',name:'Prefab budget',editor:{editor_version:3,compiler_version:3,revision:1,next_id:n+1,objects,connections,start:{position:[1,1.2],speed:0}}};
  await saved();
  await page.evaluate(text=>{window.riderDebugDraft={slot:1,seq:100000,text,now:true};},JSON.stringify(budgetDoc));
  await page.waitForFunction(()=>window.riderDebugDraft===null);
  await page.waitForFunction(()=>window.riderCustom.syncState()!=='syncing');
  await page.goto(base+'?station=custom');e=await edit();
  assert.equal(e.id,'prefab-budget');assert.equal(e.objects,255);
  await hover([21,5.2]);for(let i=0;i<3;i++){await page.mouse.wheel(0,120);await page.waitForTimeout(80);}
  const big=await doc();
  assert.ok(e.errors.some(m=>m.includes('Resource budget')),JSON.stringify(e.errors));assert.equal(e.view.simplified,true);
  assert.ok(e.view.sprites<=1024,'bounded line fallback for resource-rejected draft');
  await key('e');await page.waitForFunction(()=>window.riderEditor.message.includes('Play blocked'));
  e=await ed();assert.equal(e.mode,'edit');assert.equal(shape(await doc()),shape(big));
  const blocked={message:e.message,sprites:e.view.sprites,gui_nodes:e.overlay.nodes,max_nodes:e.overlay.max_nodes};
  // Blocked Play now selects the budget source. Clear its point-picking state before selecting
  // the whole line to remove it; the unchanged budget and geometry assertions still apply.
  await page.waitForTimeout(1100);await key('Escape');await key('Home');await key('s');
  await at([30,-8]);await page.waitForFunction(n=>window.riderEditor.selection==='o'+n,n);
  const r4=e.revision;await key('Delete');e=await revision(r4+1);assert.equal(e.objects,254);assert.equal(e.problem,'');
  // Zoom into the Gap before picking it: Fit at 380 m makes neighbouring source points share pixels.
  await hover([25,0]);for(let i=0;i<12;i++){await page.mouse.wheel(0,-120);await pointer.frames(page);}
  // A selected Gap shows its handles and fields within the GUI node budget.
  await at([25,-0.5]);await page.waitForFunction(()=>window.riderEditor.selection==='o13');e=await ed();
  assert.deepEqual(e.handles.map(h=>h.name),['end','floor']);assert.ok(e.overlay.nodes<=e.overlay.max_nodes,JSON.stringify(e.overlay));
  await key('e');const t=await played('prefab-budget');
  measurements.budget={...blocked,playable_objects:254,terrain_shapes:t.terrain_shapes??null,edit_sprites:e.view.sprites,editor_gui_max_nodes:Number(/max_nodes: (\d+)/.exec(fs.readFileSync(path.join(__dirname,'../../main/gym/editor.gui'),'utf8'))[1])};
  assert.equal(measurements.budget.editor_gui_max_nodes,e.overlay.max_nodes);
  await key('e');await edit();
  done('prefab_budget');

  if(errors.length)throw Error(errors.join('\n'));
  await page.screenshot({path:path.join(out,'prefab-budget.png')});
  fs.writeFileSync(path.join(out,'prefab-result.json'),JSON.stringify({source_sha:sha,run_id:runId,browser:browser.version(),status:'PASS',cases,measurements},null,2));
  console.log(JSON.stringify({status:'PASS',cases,measurements}));
 }catch(e){
  if(errors.length)console.error('Page errors:\n'+errors.join('\n'));
  console.error('Last console lines:\n'+logs.join('\n'));
  if(browser)for(const context of browser.contexts())for(const page of context.pages()){
   console.error('State: '+JSON.stringify(await page.evaluate(()=>({editor:window.riderEditor&&{...window.riderEditor,buttons:undefined,library:undefined},doc:window.riderEditorDoc&&{objects:window.riderEditorDoc.objects?.slice(0,16),connections:window.riderEditorDoc.connections?.slice(0,16)},
    custom:window.riderCustom&&{visible:window.riderCustom.visible,message:window.riderCustom.message},track:window.riderTrack})).catch(()=>null)));
   await page.screenshot({path:path.join(out,'prefab-failed.png')}).catch(()=>{});
  }
  throw e;
 }
 finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
