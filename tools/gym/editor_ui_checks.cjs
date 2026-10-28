// A1b exercises the real Defold UI, not a duplicate Lua/JS model of its implementation.
const assert=require('node:assert/strict');
const path=require('node:path');
const pointer=require('./pointer.cjs');
module.exports=async function uiChecks(h){
 const {page,ed,doc,key,button,at,hover,importText,settle,snapshot,unchanged,revision,played,edit,canvas,out,cases,measurements}=h;
 const close=(a,b)=>Math.abs(a-b)<1e-8;
 const shape=d=>JSON.stringify({objects:d.objects,connections:d.connections,start:d.start,finish:d.finish??null});
 const base={schema:1,units:'metres',id:'ea1-ui',name:'Hillside practice',spawn:[2,1],start_speed:0,run_in:0,run_out:0,bounds:[-10,60,-20,40],
  chains:[[[30,0],[0,0]]],hulls:[],labels:[],checkpoints:[],editor:{editor_version:6,compiler_version:6,revision:1,next_id:4,sampling:{tolerance:.005,max_segment:.5},
   connections:[{from:'o1',to:'o2'},{from:'o2',to:'o3'}],start:{position:[2,1],speed:0},objects:[
    {id:'o1',type:'prefab',kind:'flat',at:[0,0],params:{length:10}},
    {id:'o2',type:'prefab',kind:'ramp',at:[10,0],params:{mode:'angle',length:8,angle:20}},
    {id:'o3',type:'prefab',kind:'flat',at:[18,8*Math.tan(20*Math.PI/180)],params:{length:12}}]}};
 const ramp=()=>doc().then(d=>d.objects.find(o=>o.id==='o2'));
 async function selectRamp(){await key('s');await key('Home');await at([14,4*Math.tan(20*Math.PI/180)]);await page.waitForFunction(()=>window.riderEditor.selection==='o2');}
 async function field(name,value){await button(name);await page.waitForFunction(()=>window.riderEditor.field!==false);await page.keyboard.type(String(value),{delay:20});await key('Enter');}
 async function panelWheel(delta){const e=await ed(),c=await canvas((e.ui.rects.collapse_properties.x+140)*e.ui.scale,400*e.ui.scale);await page.mouse.move(c.x,c.y);await page.mouse.wheel(0,delta);await pointer.frames(page);}
 let e=await importText(JSON.stringify(base),'ea1-ui.json');await key('Home');
 const bad=structuredClone(base);bad.id='ea1-error';bad.name='Invalid line';
 bad.editor.connections=[];bad.editor.next_id=3;
 bad.editor.objects=[{id:'o1',type:'line',points:[[0,0],[30,0]]},{id:'o2',type:'line',points:[[40,0],[50,0],[44,0]]}];
 e=await importText(JSON.stringify(bad),'ea1-error.json');
 assert.ok(e.errors.some(t=>t.includes('doubles back')));assert.equal(e.ui.problem_colour,'error');
 assert.ok(e.flash,'a new located error must flash without opening Problems');assert.equal(e.selection,'','automatic attention changes the selection');
 let viewBefore=await snapshot();await button('play');e=await settle();
 assert.equal(e.mode,'edit');assert.equal(e.warnings_open,false);
 assert.ok(e.ui.error_banner.includes('Cannot play:')&&e.ui.error_banner.includes('doubles back'),e.ui.error_banner);
 assert.equal(e.selection,'o2');assert.deepEqual(e.flash,[50,0]);
 await unchanged(viewBefore,'blocked Play attention');
 await page.screenshot({path:path.join(out,'editor-a-blocked-play.png')});
 await key('Delete');await revision(viewBefore.revision+1);e=await settle();
 assert.equal(e.errors.length,0);assert.equal(e.ui.problem_colour,'normal');assert.equal(e.ui.error_banner,false);
 await key('z',['Control']);await revision(viewBefore.revision+2);e=await settle();
 assert.equal(e.ui.problem_colour,'error');assert.ok(e.flash,'Undo restoring an error must flash its source');
 await key('Enter');e=await settle();assert.ok(e.ui.error_banner.includes('doubles back'));assert.equal(e.mode,'edit');
 e=await importText(JSON.stringify(base),'ea1-ui.json');await key('Escape');await key('Home');
 assert.equal(e.ui.error_banner,false,'a new document keeps the previous Play error');
 viewBefore=await snapshot();await page.setViewportSize({width:1280,height:480});e=await settle();
 assert.equal(e.ui.scale,1,'short desktop windows must keep control size');
 assert.ok(e.ui.tool_max_scroll>0&&e.ui.max_scroll>0,'both sidebars need overflow scrolling');
 assert.ok(e.ui.scrollbars.tool_scroll&&e.ui.scrollbars.scroll,'both scrollbars must be visible');
 for(const r of [e.ui.tools_panel,e.ui.properties_panel])assert.ok(r.y+r.h<=400,'sidebar covers the footer');
 async function seekScrollbar(name,bottom){
  const r=(await ed()).ui.scrollbars[name];assert.ok(r,name+' missing');
  await page.mouse.move(r.x+r.w/2,r.y+r.knob/2);await pointer.frames(page);await page.mouse.down();await pointer.frames(page);
  await page.mouse.move(r.x+r.w/2,bottom?r.y+r.h-1:r.y+1,{steps:6});await pointer.frames(page);await page.mouse.up();await pointer.frames(page);
 }
 await page.mouse.move(100,250);
 for(let i=0;i<4;i++){await page.mouse.wheel(0,120);await pointer.frames(page);}
 e=await settle();
 assert.ok(e.ui.tool_scroll>0);assert.ok(e.visible.includes('kind_wave'),'last prefab is unreachable');
 await seekScrollbar('tool_scroll',false);e=await settle();assert.equal(e.ui.tool_scroll,0);assert.ok(e.visible.includes('tool_select'));
 await button('rename');assert.notEqual((await ed()).field,false);
 await seekScrollbar('scroll',true);e=await settle();assert.equal(e.field,false,'scrollbar does not commit valid focused input');assert.ok(e.ui.scroll>0);assert.ok(e.visible.includes('inc_test_speed'));
 await seekScrollbar('scroll',false);e=await settle();assert.equal(e.ui.scroll,0);
 await unchanged(viewBefore,'scrollbar drag/wheel and resize');
 await page.screenshot({path:path.join(out,'editor-a-scrollbars-1280x480.png')});
 await page.setViewportSize({width:1280,height:720});await button('collapse_objects');e=await settle();
 assert.ok(e.ui.tools_panel.y+e.ui.tools_panel.h<600,'Tools panel has empty solid background');
 assert.ok(e.ui.properties_panel.y+e.ui.properties_panel.h<600,'Properties panel has empty solid background');
 assert.equal(e.ui.tool_max_scroll,0);assert.equal(e.ui.max_scroll,0);
 // The empty area below a short panel belongs to the canvas, including pointer input.
 const freeBefore=await doc(),freeRevision=(await ed()).revision;
 await key('d');await pointer.tap(page,{x:1100,y:560});await pointer.tap(page,{x:1160,y:600});await key('Enter');
 await revision(freeRevision+1);assert.equal((await doc()).objects.length,freeBefore.objects.length+1,'short sidebar still captures canvas input below it');
 await key('z',['Control']);await revision(freeRevision+2);assert.equal(shape(await doc()),shape(freeBefore));
 await key('Escape');
 measurements.editor_a_feedback={error:'red button, automatic source flash, direct Play banner, fix/Undo',scroll:'both panels: wheel + draggable scrollbar, constant control size'};
 cases.push('a1b_feedback_errors_and_scroll');
 const layouts={};
 for(const size of [{width:1280,height:720},{width:1920,height:1080}]){
  await page.setViewportSize(size);await pointer.frames(page);await key('Home');await key('Escape');await key('p');await key('2');await hover([6,3]);e=await settle();
  assert.equal(e.prefab_kind,'ramp');assert.equal(e.tool,'prefab');
  assert.equal(e.ui.rects.new.y,8);assert.equal(e.ui.rects.new.x,size.width-264);
  assert.equal(e.ui.rects.play.y,56);assert.equal(e.ui.rects.play.x,96);
  assert.equal(e.ui.scale,1);assert.equal(e.usable.x1-e.usable.x0,size.width-528);
  const nodes=e.overlay.nodes;assert.ok(nodes<=640);assert.equal(nodes,628);
  const pageTools=await page.locator('#page-tools').boundingBox();
  assert.ok(pageTools.y>=size.height-64&&pageTools.y+pageTools.height<=size.height-24+1,'browser controls cover the cursor row');
  await page.screenshot({path:path.join(out,`editor-a-build-${size.width}x${size.height}.png`)});
  await selectRamp();e=await settle();
  for(const name of ['param_2','param_3','mode_angle','mode_height','mirror_left','mirror_right','convert'])assert.ok(e.visible.includes(name),name+' hidden at '+size.width);
  for(const [name,r] of Object.entries(e.ui.rects)){
   assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=size.width&&r.y+r.h<=size.height,name+' outside the canvas');
   if(/^(param_|inc_param_|dec_param_|mode_)/.test(name))assert.ok(r.x>=size.width-280&&r.x+r.w<=size.width-16,name+' outside the inspector');
  }
  await page.screenshot({path:path.join(out,`editor-a-ramp-${size.width}x${size.height}.png`)});
  let before=await snapshot(),u={...e.usable};
  await button('collapse_tools');await button('collapse_properties');e=await settle();
  assert.equal(e.usable.x0,u.x0-144);assert.equal(e.usable.x1,u.x1+240);
  assert.ok(!e.visible.includes('tool_select')&&!e.visible.includes('param_2'));
  await unchanged(before,'collapse panels');
  await key('Home');e=await settle();
  const ext=e.extent;for(const p of [[ext[0],ext[2]],[ext[1],ext[3]]]){
   const x=e.screen.ox+p[0]*e.screen.ppm_x,y=e.screen.oy+p[1]*e.screen.ppm_y;
   assert.ok(x>=e.usable.x0&&x<=e.usable.x1&&y>=e.usable.y0&&y<=e.usable.y1,'Fit ignored collapsed panels');
  }
  await button('collapse_tools');await button('collapse_properties');await unchanged(before,'expand and fit');
  layouts[size.width]={nodes,usable:u,chrome:e.ui.rects.new};
 }
 // DPR 2 uses the same CSS-pixel chrome while the actual framebuffer doubles.
 const context=await page.context().browser().newContext({viewport:{width:1280,height:720},deviceScaleFactor:2});
 const hi=await context.newPage(),hiErrors=[];
 hi.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))hiErrors.push(m.text());});
 hi.on('pageerror',err=>hiErrors.push(err.message));
 await require('./launch.cjs').configure(hi,process.argv[4],'le6');
 await hi.goto(new URL('/index.html?station=straight',page.url()).href);
 await hi.waitForFunction(()=>window.riderTelemetry?.sequence>2);await hi.locator('canvas').focus();
 await hi.keyboard.down('e');await pointer.frames(hi);await hi.keyboard.up('e');
 await hi.waitForFunction(()=>window.riderEditor?.mode==='edit'&&window.riderEditor.ui.rects.play);
 const high=await hi.evaluate(()=>({state:window.riderEditor,canvas:document.querySelector('canvas').width,css:document.querySelector('canvas').clientWidth}));
 assert.equal(high.canvas/high.css,2);assert.equal(high.state.ui.scale,2);
 assert.equal(high.state.ui.rects.play.x,96);assert.equal(high.state.ui.rects.play.h,32);
 assert.equal(high.state.usable.x0,432);assert.equal(high.state.usable.x1,1936);assert.equal(high.state.overlay.nodes,628);
 await hi.screenshot({path:path.join(out,'editor-a-hidpi.png')});assert.deepEqual(hiErrors,[]);
 layouts.hidpi={canvas:high.canvas,css:high.css,scale:high.state.ui.scale,nodes:high.state.overlay.nodes};
 await context.close();await page.bringToFront();await pointer.frames(page);
 measurements.editor_a_layout=layouts;cases.push('a1b_layout_viewports_and_collapse');
 await page.setViewportSize({width:1280,height:720});await key('Home');await selectRamp();
 const original=await doc(),r0=(await ed()).revision,undo0=(await ed()).undo;
 await button('param_3');await page.keyboard.type('esp',{delay:40});await page.waitForFunction(()=>window.riderEditor.field==='esp');await key('Enter');e=await ed();
 assert.equal(e.mode,'edit');assert.equal(e.tool,'select');assert.equal(e.revision,r0);assert.equal(e.field,'esp');assert.ok(e.ui.field_error);
 await button('inc_param_3');assert.equal((await ed()).field,'esp');assert.equal((await ed()).revision,r0);
 await key('Tab');assert.equal((await ed()).field_param,'angle');assert.equal((await ed()).field,'esp');
 await key('Escape');assert.equal(shape(await doc()),shape(original));
 await button('param_2');await key('Tab');e=await ed();assert.equal(e.field_param,'angle');
 await key('Tab',['Shift']);assert.equal((await ed()).field_param,'length');await key('Escape');
 await button('inc_param_2');e=await revision(r0+1);let d=await doc();
 assert.ok(close(d.objects[1].params.length,8.1));assert.deepEqual(d.objects[0],original.objects[0]);
 assert.ok(close(d.objects[2].at[0],18.1));assert.ok(close(d.objects[2].at[1],8.1*Math.tan(20*Math.PI/180)));
 assert.equal(e.undo,undo0+1);await key('z',['Control']);await revision(r0+2);assert.equal(shape(await doc()),shape(original));
 const pending=(await ed()).revision,pendingUndo=(await ed()).undo;
 await button('param_2');await page.keyboard.type('8.2',{delay:40});await page.waitForFunction(()=>window.riderEditor.field==='8.2');
 await button('inc_param_2');e=await revision(pending+1);assert.equal(e.undo,pendingUndo+1);assert.ok(close((await ramp()).params.length,8.3));
 await key('z',['Control']);await revision(pending+2);assert.equal(shape(await doc()),shape(original));
 const beforeShift=(await ed()).revision;
 await page.keyboard.down('Shift');await pointer.frames(page);await button('inc_param_2');await page.keyboard.up('Shift');await pointer.frames(page);
 await revision(beforeShift+1);assert.ok(close((await ramp()).params.length,9));
 await page.keyboard.down('Alt');await pointer.frames(page);await button('inc_param_2');await page.keyboard.up('Alt');await pointer.frames(page);
 await revision(beforeShift+2);assert.ok(close((await ramp()).params.length,9.01));
 await field('param_3','60');const limit=(await ed()).revision;await button('inc_param_3');e=await ed();assert.equal(e.revision,limit);assert.equal((await ramp()).params.angle,60);
 await field('param_3','20');const geometric=await page.evaluate(()=>window.riderEditorPaths.o2);
 await button('mode_height');assert.equal((await ramp()).params.mode,'height');
 let changed=await page.evaluate(()=>window.riderEditorPaths.o2);assert.ok(changed.every((p,i)=>p.every((v,j)=>close(v,geometric[i][j]))));
 await button('mode_angle');assert.equal((await ramp()).params.mode,'angle');
 await key('Escape');const speedRev=(await ed()).revision,speedUndo=(await ed()).undo;
 await button('speed');await page.keyboard.type('2.5',{delay:40});await page.waitForFunction(()=>window.riderEditor.field==='2.5');
 await button('inc_speed');e=await revision(speedRev+1);assert.equal(e.start.speed,3);assert.equal(e.undo,speedUndo+1);
 await key('z',['Control']);await revision(speedRev+2);assert.equal((await ed()).start.speed,0);
 measurements.editor_a_fields={invalid_preserved:true,shift_length:9,alt_length:9.01,limit_refused:true,pending_step_single_undo:true};cases.push('a1b_numeric_focus_steps_and_connected_run');
 // Seven-field Kicker: scroll stays in the panel; last numeric field remains reachable and focussed.
 const seven=JSON.parse(JSON.stringify(base));seven.id='ea1-seven';seven.name='Seven parameters';seven.editor.objects=seven.editor.objects.slice(0,2);
 seven.editor.objects[1]={id:'o2',type:'prefab',kind:'kicker',at:[10,0],params:{facing:'right',angle:15,lip:1,gap:2,landing:'down',landing_length:6,landing_angle:15}};
 seven.editor.connections=[{from:'o1',to:'o2'}];seven.editor.next_id=3;
 await importText(JSON.stringify(seven),'ea1-seven.json');await key('Home');await at([11,.25]);await page.waitForFunction(()=>window.riderEditor.selection==='o2');e=await settle();
 const beforeScroll=await snapshot(),zoom=e.camera.zoom;
 for(let i=0;i<12&&!e.visible.includes('param_7');i++){await panelWheel(120);e=await ed();}
 assert.ok(e.visible.includes('param_7'),'seventh parameter unreachable');assert.ok(e.ui.scroll>0);assert.equal(e.camera.zoom,zoom);await unchanged(beforeScroll,'inspector scrolling');
 await button('param_7');assert.equal((await ed()).field_param,'landing_angle');await key('Escape');
 await key('h');e=await settle();assert.equal(e.help_open,true);const mode=e.mode,tool=e.tool;
 await key('e');await key('s');await key('z',['Control']);e=await ed();assert.equal(e.mode,mode);assert.equal(e.tool,tool);assert.equal(e.revision,beforeScroll.revision);
 await page.mouse.wheel(0,120);await key('h');await unchanged(beforeScroll,'modal keys and scroll');
 await page.screenshot({path:path.join(out,'editor-a-seven-parameters.png')});
 measurements.editor_a_scroll={scroll:(await ed()).ui.scroll,gui_nodes:(await ed()).overlay.nodes};cases.push('a1b_scrolling_and_modal_capture');
 // Current component headroom at the unchanged 800 render-object limit, not the old LE1b vehicle.
 const full=JSON.parse(JSON.stringify(base));full.id='ea1-budget';full.name='800 segments';full.editor.connections=[];full.editor.next_id=2;
 full.editor.objects=[{id:'o1',type:'line',points:Array.from({length:801},(_,i)=>[i*.5,0])}];
 await importText(JSON.stringify(full),'ea1-budget.json');await key('Home');e=await settle();
 assert.equal(e.problem,'');assert.equal(e.view.sprites,4);assert.equal(e.view.meshes,13);assert.equal(e.view.mesh_bytes,518832);assert.ok(e.view.labels<=1024);assert.equal(e.overlay.nodes,628);
 const counts={edit:{...e.view,nodes:e.overlay.nodes}};
 await key('e');await played('ea1-budget');await page.waitForFunction(()=>window.riderEditorRuntime?.decoration===0&&window.riderEditorRuntime.terrain_meshes===13);
 counts.play=await page.evaluate(()=>window.riderEditorRuntime);assert.equal(counts.play.sprites,6);assert.equal(counts.play.terrain_meshes,13);assert.equal(counts.play.terrain_buffer_bytes,518832);assert.equal(counts.play.struts,2);
 await key('b');await page.waitForTimeout(350);await key('b');await key('g');
 await page.waitForFunction(()=>window.riderEditorRuntime?.replay===4);
 counts.replay=await page.evaluate(()=>window.riderEditorRuntime);assert.equal(counts.replay.sprites,10);assert.equal(counts.replay.terrain_meshes,13);assert.equal(counts.replay.terrain_buffer_bytes,518832);
 for(let i=0;i<2;i++){
  await key('e');e=await edit();assert.equal(e.view.sprites,4);assert.equal(e.view.meshes,13);assert.equal(e.view.mesh_bytes,518832);assert.equal(e.overlay.nodes,628);
  await key('e');await played('ea1-budget');await page.waitForFunction(()=>window.riderEditorRuntime?.decoration===0&&window.riderEditorRuntime.terrain_meshes===13&&window.riderEditorRuntime.replay===0);
  const live=await page.evaluate(()=>window.riderEditorRuntime);assert.equal(live.sprites,6);assert.equal(live.terrain_meshes,13);assert.equal(live.terrain_buffer_bytes,518832);assert.ok(live.labels<=1024);
 }
 await key('e');await edit();measurements.editor_a_budget=counts;cases.push('a1b_maximum_level_and_switch_budgets');
 await require('../gameplay/check_medal_editor.cjs')(h);
 await require('../gameplay/check_coin_editor.cjs')(h);
};
