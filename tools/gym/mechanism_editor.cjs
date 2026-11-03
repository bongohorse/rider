// O2 (#281), part of Gym ea2: author crates, plates and gates through the real editor controls, from a
// blank course. Pointer/keyboard input only; window.riderEditor / riderEditorDoc / riderMechanisms are
// read for coordinates and evidence, never written. Based on Codex's local O2 branch (a10d648).
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const pointer=require('./pointer.cjs'),target=require('./editor_ui_target.cjs');
const FIELDS={crate:['angle','mass','friction','restitution'],plate:['width','actors','mode','pulse_seconds','initial_on'],gate:['travel','speed','initial_open','condition']};
// The O1 mechanisms data an editor source compiles to (editor_mechanisms.runtime), for comparisons.
function runtime(d){
 const r={version:1,crates:[],plates:[],gates:[],links:JSON.parse(JSON.stringify(d.mechanism_links||[]))};
 for(const o of d.objects)if(FIELDS[o.type]){const v={id:o.id,position:o.position};for(const k of FIELDS[o.type])if(o[k]!==undefined)v[k]=o[k];r[o.type+'s'].push(v);}
 return r;
}
module.exports=async function(h){
 const {page,ed,doc,key,button,at,world,canvas,settle,snapshot,unchanged,edit,importText,exportFile,out,measurements}=h;
 const cases=[];
 const find=async id=>(await doc()).objects.find(o=>o.id===id);
 const links=async()=>((await doc()).mechanism_links||[]).map(l=>l.from+'>'+l.to);
 const to=async(p,mods)=>{await target.ensureWorld(page,ed,canvas,p);await at(p,mods);await settle();};
 const centre=o=>[o.position[0],o.position[1]+(o.type==='gate'&&o.initial_open?o.travel:0)];
 async function select(id){if((await ed()).selection===id)return;await to(centre(await find(id)));await page.waitForFunction(id=>window.riderEditor.selection===id,id);}
 async function place(kind,p){
  const before=(await doc()).objects.length;await button('tool_'+kind);assert.equal((await ed()).tool,kind);await to(p);
  const d=await doc();assert.equal(d.objects.length,before+1,'one '+kind+' placed');const o=d.objects.at(-1);
  assert.equal(o.type,kind);assert.equal((await ed()).selection,o.id);assert.equal((await ed()).tool,'select');return o.id;
 }
 // A Properties row by its label: a choice row steps on click; a number row takes typed text + Enter.
 async function param(id,label,value){
  await select(id);const rows=(await ed()).rows;const i=rows.findIndex(r=>r.startsWith(label+':'));assert.ok(i>=0,label+' row missing: '+rows.join(' | '));
  await button('param_'+(i+1));
  if(value!==undefined){await page.keyboard.type(String(value),{delay:30});await key('Enter');}
  return settle();
 }
 async function wire(from,gate){
  await select(from);await button('wire');assert.equal((await ed()).wire,from);
  await to(centre(await find(gate)));
 }

 // 1. Blank course: New level, ground drawn with D, then 1 crate, 2 plates and 3 gates with the tools.
 await button('new');await page.waitForFunction(()=>/^my-level-/.test(window.riderEditor.id)&&window.riderEditorDoc.objects.length===0);
 let d=await doc();assert.equal(d.editor_version,13);assert.equal(d.mechanism_links,undefined);
 await key('d');await to([-4,0]);await to([36,0]);await key('Enter');await settle();
 assert.equal((await doc()).objects.length,1);await key('s');
 const crate=await place('crate',[4,0]);
 const plateA=await place('plate',[9,0]),plateB=await place('plate',[13,0]);
 const g1=await place('gate',[18,0]),g2=await place('gate',[22,0]),g3=await place('gate',[26,0]);
 d=await doc();
 assert.deepEqual(d.objects.find(o=>o.id===crate),{id:crate,type:'crate',position:[4,.6],angle:0,mass:8,friction:.5,restitution:0});
 assert.deepEqual(d.objects.find(o=>o.id===plateA),{id:plateA,type:'plate',position:[9,-.05],width:3,actors:['vehicle'],mode:'hold',pulse_seconds:4,initial_on:false});
 assert.deepEqual(d.objects.find(o=>o.id===g1),{id:g1,type:'gate',position:[18,1.5],travel:4.5,speed:1.8,initial_open:false,condition:'any'});
 const ids=[crate,plateA,plateB,g1,g2,g3];assert.equal(new Set(ids).size,6);
 // One Undo step per placement.
 let e=await ed();const undo=e.undo;await key('z',['Control']);await settle();assert.ok(!await find(g3));assert.equal((await ed()).undo,undo-1);
 await key('y',['Control']);await settle();assert.deepEqual(await find(g3),d.objects.find(o=>o.id===g3));
 // Only O1-supported rows, per kind.
 await select(crate);assert.deepEqual((await ed()).rows.map(r=>r.split(':')[0]),['Position X','Position Y','Rotation','Mass','Friction','Bounce']);
 await select(plateA);assert.deepEqual((await ed()).rows.map(r=>r.split(':')[0]),['Position X','Position Y','Width','Mode','Vehicle presses','crate '+crate+' presses']);
 await select(g1);assert.deepEqual((await ed()).rows.map(r=>r.split(':')[0]),['Position X','Position Y','Lift height','Speed','Starts open','Opens when']);
 cases.push('mechanism_blank_course_places_one_undo_each');

 // 2. Configure: every changed field is one Undo step; invalid input fails closed with an actionable reason.
 e=await ed();let u=e.undo;
 await param(crate,'Mass','25');assert.equal((await find(crate)).mass,25);
 await param(crate,'Rotation','15');assert.ok(Math.abs((await find(crate)).angle-Math.PI/12)<1e-9,'degrees shown, radians stored');
 assert.equal((await ed()).undo,u+2);
 let before=await snapshot();
 await param(crate,'Mass','999');e=await ed();assert.match(e.message,/Mass must be 1 to 40 kg\. The previous value is kept\./);assert.equal(e.field,'999');
 await key('Escape');await settle();await unchanged(before,'invalid crate mass');
 await param(g1,'Lift height','2');e=await ed();assert.match(e.message,/Lift height must be 3\.5 to 6 m/);await key('Escape');await settle();await unchanged(before,'invalid gate travel');
 await param(g1,'Speed','abc');e=await ed();assert.match(e.message,/Speed must be 0\.25 to 2 m\/s/);await key('Escape');await settle();await unchanged(before,'non-numeric gate speed');
 await param(plateA,'Vehicle presses');e=await ed();assert.match(e.message,/at least one actor/);await unchanged(before,'plate without actors');
 await param(plateA,'crate '+crate+' presses');assert.deepEqual((await find(plateA)).actors,['vehicle',crate]);
 await param(plateA,'Mode');assert.equal((await find(plateA)).mode,'pulse');
 await param(plateA,'Button time','2');assert.equal((await find(plateA)).pulse_seconds,2);
 await param(plateB,'Mode');await param(plateB,'Mode');assert.equal((await find(plateB)).mode,'toggle');
 await param(plateB,'Starts ON');assert.equal((await find(plateB)).initial_on,true);
 assert.ok(!(await ed()).rows.some(r=>r.startsWith('Button time')),'pulse time only for Button plates');
 await param(g2,'Opens when');assert.equal((await find(g2)).condition,'all');
 // Number rows show their unit and take typed values; Tab moves to the next number row (no -/+ pair).
 await select(g3);u=(await ed()).undo;e=await ed();assert.ok(!e.visible.some(n=>/^[di][en]c_param_/.test(n)),'mechanism rows have no -/+ pair');
 await param(g3,'Lift height');assert.equal((await ed()).field,'4.5');await key('Tab');e=await settle();assert.equal(e.field,'1.8','Tab reaches Speed');
 await page.keyboard.type('1.25',{delay:30});await key('Enter');await settle();assert.equal((await find(g3)).speed,1.25);assert.equal((await ed()).undo,u+1);
 cases.push('mechanism_properties_bounded_and_fail_closed');

 // 3. The 2-plate / 3-gate example: five directed links; refusals keep the graph.
 for(const [from,gate] of [[plateA,g1],[plateA,g2],[plateA,g3],[plateB,g2],[plateB,g3]]){
  const n=(await links()).length;await wire(from,gate);
  await page.waitForFunction(n=>(window.riderEditorDoc.mechanism_links||[]).length===n+1,n);assert.equal((await ed()).wire,false);
 }
 const five=[plateA+'>'+g1,plateA+'>'+g2,plateA+'>'+g3,plateB+'>'+g2,plateB+'>'+g3];
 assert.deepEqual(await links(),five);
 e=await ed();assert.equal(e.overlay.links_drawn,5);assert.equal(e.overlay.dropped,0);assert.equal(e.overlay.nodes,628);
 before=await snapshot();
 await wire(plateA,g1);e=await ed();assert.match(e.message,/already opens gate/);
 await key('Escape');await settle();
 await select(plateA);await button('wire');await to(centre(await find(crate)));e=await ed();assert.equal(e.wire,plateA,'a crate is no gate: still connecting');assert.match(e.message,/Click a gate outline/);
 await key('Escape');await settle();assert.equal((await ed()).wire,false);await unchanged(before,'duplicate and wrong-kind connections');
 await select(plateA);await page.mouse.move(800,90);await pointer.frames(page);await page.screenshot({path:path.join(out,'mechanism-two-plates-three-gates.png')});
 // A link is picked on the canvas (no object under the cursor) and deleted alone; Undo restores it.
 // 70 % along plate A -> gate 1 (its only incoming link), away from the other four arrows and all outlines.
 const pa=await find(plateA),pg=await find(g1),a0=[pa.position[0],pa.position[1]+.05],a1=[pg.position[0],pg.position[1]+1.5];
 const along=[a0[0]+(a1[0]-a0[0])*.7,a0[1]+(a1[1]-a0[1])*.7];
 await key('Escape');await to(along);e=await ed();assert.deepEqual(e.selected_link,{from:plateA,to:g1},'picked link at '+along+' (ppm '+e.screen.ppm_x+')');assert.equal(e.selection,plateA);
 await key('Delete');await settle();assert.deepEqual(await links(),five.slice(1));assert.ok(await find(plateA)&&await find(g1));
 await key('z',['Control']);await settle();assert.deepEqual((await links()).sort(),[...five].sort());
 // Disconnect from Properties; Undo / Redo restore exactly that link.
 await select(plateA);await button('unlink_'+plateA+'_'+g2);await settle();assert.ok(!(await links()).includes(plateA+'>'+g2));
 await key('z',['Control']);await settle();assert.ok((await links()).includes(plateA+'>'+g2));
 await key('y',['Control']);await settle();assert.ok(!(await links()).includes(plateA+'>'+g2));
 await key('z',['Control']);await settle();assert.equal((await links()).length,5);
 cases.push('mechanism_two_plates_three_gates_five_links');

 // 4. Locks protect settings, position, delete and incident links; hide is editor-only.
 await button('collapse_prefabs');
 await button('object_lock_'+g2);assert.equal((await find(g2)).locked,true);
 before=await snapshot();
 await select(plateA);await button('unlink_'+plateA+'_'+g2);e=await settle();assert.match(e.message,/Locked: Gate /);
 await select(plateA);await button('wire');await to(centre(await find(g2)));await key('Escape');
 await param(g2,'Speed','1');e=await ed();assert.match(e.message,/Locked: Gate /);await key('Escape');await settle();
 await select(g2);await key('Delete');e=await settle();assert.match(e.message,/Locked: Gate /);
 const ga=await world(centre(await find(g2))),gb=await world([centre(await find(g2))[0]+2,centre(await find(g2))[1]]);
 await page.mouse.move(ga.x,ga.y);await pointer.frames(page);await page.mouse.down();await pointer.frames(page);await page.mouse.move(gb.x,gb.y,{steps:6});await pointer.frames(page);await page.mouse.up();await pointer.frames(page);
 await settle();await unchanged(before,'locked gate: rewire, settings, delete and drag');
 await button('object_lock_'+g2);assert.ok(!(await find(g2)).locked,'unlocked');
 await button('object_eye_'+plateB);e=await settle();assert.equal((await find(plateB)).hidden,true);assert.equal(e.overlay.links_drawn,3,'links of a hidden plate are not drawn');
 await key('z',['Control']);e=await settle();assert.equal((await find(plateB)).hidden,undefined);assert.equal(e.overlay.links_drawn,5);
 cases.push('mechanism_locks_and_hide');

 // 5. Copy/paste: all six remap every internal link and the crate actor; one plate keeps its external gates.
 await select(crate);
 for(const id of [plateA,plateB,g1,g2,g3]){const o=await find(id);await to(centre(o),['Shift']);}
 assert.equal((await ed()).selected.length,6);
 await key('c',['Control']);const n0=(await doc()).objects.length;await to([10,8]);await key('v',['Control']);await settle();
 d=await doc();const pasted=d.objects.slice(n0);assert.equal(pasted.length,6);assert.ok(pasted.every(o=>!ids.includes(o.id)));
 const map=Object.fromEntries(ids.map((id,i)=>[id,pasted[i].id]));
 assert.deepEqual(d.mechanism_links.slice(5).map(l=>l.from+'>'+l.to),five.map(s=>s.split('>').map(x=>map[x]).join('>')));
 assert.deepEqual(d.objects.find(o=>o.id===map[plateA]).actors,['vehicle',map[crate]]);
 await key('z',['Control']);await settle();assert.equal((await doc()).objects.length,n0);
 await select(plateA);await key('c',['Control']);await to([10,6]);await key('v',['Control']);e=await settle();
 d=await doc();const copy=d.objects.at(-1);assert.equal(copy.type,'plate');assert.match(e.message,/4 kept/);
 assert.deepEqual(d.mechanism_links.filter(l=>l.from===copy.id).map(l=>l.to),[g1,g2,g3]);assert.deepEqual(copy.actors,['vehicle',crate]);
 await key('z',['Control']);await settle();assert.equal((await links()).length,5);
 cases.push('mechanism_copy_remaps_and_keeps_external');

 // 6. Save/Reload and Export/Import keep stable IDs and the graph; Edit/Play/Retry use the course runtime.
 await page.waitForFunction(()=>!window.riderEditor.dirty&&window.riderEditor.status!=='Unsaved'&&!window.riderEditor.unsynced,null,{timeout:15000});
 const saved=await doc();
 await page.reload();e=await edit();await page.locator('canvas').focus();
 assert.deepEqual((await doc()).objects,saved.objects);assert.deepEqual((await doc()).mechanism_links,saved.mechanism_links);
 const file=await exportFile();
 assert.equal(file.schema,5);assert.equal(file.editor.editor_version,13);assert.deepEqual(file.mechanisms,runtime(saved));
 assert.equal(file.mechanisms.links.length,5);assert.equal(file.hulls.length,0);
 for(const o of file.editor.objects)if(FIELDS[o.type])assert.ok(!('name' in file.mechanisms[o.type+'s'].find(v=>v.id===o.id)));
 const level=file.id;
 // Editor Play from START: the same O1 runtime; repeated Retry and Edit/Play reset cleanly.
 await key('e');await page.waitForFunction(()=>window.riderMechanisms?.gates?.length===3&&window.riderMechanisms.sequence>=2,null,{timeout:20000});
 let m=await page.evaluate(()=>window.riderMechanisms);
 assert.deepEqual(m.gates.map(g=>g.id),[g1,g2,g3]);assert.deepEqual(m.plates.map(p=>p.id),[plateA,plateB]);assert.equal(m.crates[0].id,crate);assert.ok(Math.abs(m.crates[0].mass-25)<.01);
 assert.equal(m.plates[1].active,true,'Switch plate starts ON');
 const editorPlay=m;
 for(let i=0;i<2;i++){
  await key('r');await page.waitForFunction(g=>window.riderMechanisms?.generation>g&&window.riderMechanisms.sequence>=2,m.generation,{timeout:20000});
  const r=await page.evaluate(()=>window.riderMechanisms);assert.deepEqual(r.cost,editorPlay.cost);assert.deepEqual(r.gates.map(g=>g.joints),[1,1,1]);m=r;
 }
 // Edit simulates nothing: no mechanism signals are published while editing.
 await key('e');await edit();const idle=await page.evaluate(()=>window.riderMechanisms?.sequence??null);await page.waitForTimeout(700);
 assert.equal(await page.evaluate(()=>window.riderMechanisms?.sequence??null),idle,'no plate/gate signals in Edit');
 await key('e');await page.waitForFunction(g=>window.riderMechanisms?.gates?.length===3&&window.riderMechanisms.session_generation>g&&window.riderMechanisms.sequence>=2,editorPlay.session_generation,{timeout:20000});
 assert.deepEqual((await page.evaluate(()=>window.riderMechanisms)).cost,editorPlay.cost);
 await key('e');await edit();
 // Import of the exported file opens the same source (IDs, links) in a new My levels copy.
 const imported=await importText(JSON.stringify(file),'o2-authored.json');await settle();
 assert.deepEqual((await doc()).objects,file.editor.objects);assert.deepEqual((await doc()).mechanism_links,file.editor.mechanism_links);
 measurements.o2={level,cost:editorPlay.cost,links:5,imported_message:imported.message};
 cases.push('mechanism_save_reload_export_import_play_retry');

 // 7. Pools: the selected plate with its link rows fits the fixed GUI pools at desktop and short sizes.
 for(const size of [{width:1920,height:1080},{width:1280,height:480},{width:1280,height:720}]){
  await page.setViewportSize(size);await pointer.frames(page);await select(plateA);e=await settle();
  assert.equal(e.overlay.nodes,628);assert.ok(e.ui.boxes<=128&&e.ui.texts<=128,JSON.stringify(e.ui));assert.equal(e.overlay.dropped,0);
  await target.reveal(page,'unlink_'+plateA+'_'+g3);assert.ok((await ed()).visible.includes('unlink_'+plateA+'_'+g3),'last link row reachable at '+size.width+'x'+size.height);
  measurements['o2_pools_'+size.width+'x'+size.height]={boxes:e.ui.boxes,texts:e.ui.texts,overlay_handles:e.overlay.handles};
  await page.mouse.move(800,90);await pointer.frames(page);await page.screenshot({path:path.join(out,`mechanism-plate-${size.width}x${size.height}.png`)});
 }
 // Largest plate: Button mode, the vehicle and 8 crates as actors and 8 outgoing links (8/8/8 limits).
 const worst=JSON.parse(JSON.stringify(file));worst.id='o2-largest-plate';delete worst.editor.compiled_revision;
 const line=worst.editor.objects.find(o=>o.type==='line'),crates=[],gates=[];
 for(let i=0;i<8;i++){crates.push({id:'o'+(10+i),type:'crate',position:[2+i*1.3,.6],angle:0,mass:8,friction:.5,restitution:0});gates.push({id:'o'+(20+i),type:'gate',position:[16+i*1.2,1.5],travel:4.5,speed:1.8,initial_open:false,condition:'any'});}
 const big={id:'o30',type:'plate',position:[13,-.05],width:2,actors:['vehicle',...crates.map(c=>c.id)],mode:'pulse',pulse_seconds:2,initial_on:false};
 worst.editor.objects=[line,...crates,big,...gates];worst.editor.next_id=31;worst.editor.connections=[];
 worst.editor.mechanism_links=gates.map(g=>({from:'o30',event:'active',to:g.id,action:'open'}));
 await importText(JSON.stringify(worst),'o2-largest-plate.json');await settle();assert.equal(((await doc()).mechanism_links||[]).length,8);
 for(const size of [{width:1920,height:1080},{width:2560,height:1440},{width:1280,height:720}]){
  await page.setViewportSize(size);await pointer.frames(page);await select('o30');e=await settle();
  assert.equal(e.rows.length,14);assert.equal(e.overlay.links_drawn,8);assert.equal(e.overlay.dropped,0);
  assert.ok(e.ui.boxes<=128&&e.ui.texts<=128,JSON.stringify({size,boxes:e.ui.boxes,texts:e.ui.texts}));
  await target.reveal(page,'unlink_o30_o27');e=await ed();assert.ok(e.visible.includes('unlink_o30_o27'),'last link row reachable at '+size.width+'x'+size.height);
  assert.ok(e.ui.boxes<=128&&e.ui.texts<=128);
  measurements['o2_largest_plate_'+size.width+'x'+size.height]={boxes:e.ui.boxes,texts:e.ui.texts,overlay_handles:e.overlay.handles};
  await page.mouse.move(800,90);await pointer.frames(page);await page.screenshot({path:path.join(out,`mechanism-largest-plate-${size.width}x${size.height}.png`)});
 }
 cases.push('mechanism_pools_and_viewports');
 return {cases,file};
};
module.exports.runtime=runtime;
