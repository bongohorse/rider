// A1b exercises the real Defold UI, not a duplicate Lua/JS model of its implementation.
const assert=require('node:assert/strict');
const path=require('node:path');
const pointer=require('./pointer.cjs');
module.exports=async function uiChecks(h){
 const {page,ed,doc,key,button,at,hover,importText,settle,snapshot,unchanged,revision,played,edit,canvas,out,cases,measurements,checkpoint}=h;
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
 // #686: the inspector is the HTML dock; it scrolls inside its own body.
 const inspScroll=()=>page.evaluate(()=>{const b=document.querySelector('#rider-chrome-insp .insp-body');return b?{top:b.scrollTop,overflow:b.scrollHeight-b.clientHeight}:null;});
 async function panelWheel(delta){const b=await page.locator('#rider-chrome-insp .insp-body').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.wheel(0,delta);await pointer.frames(page);}
 let e=await importText(JSON.stringify(base),'ea1-ui.json');await key('Home');
 // #685: the library tabs (Gameplay, Track parts, Objects) and the centred command group are view-only at all
 // supported sizes; one tab shows at a time and the floating tool bar is independent of the library.
 const categoryBefore=await snapshot();
 const libReveal=n=>require('./editor_ui_target.cjs').reveal(page,n);
 for(const size of [{width:1280,height:720},{width:844,height:390},{width:390,height:844}]){
  await page.setViewportSize(size);await pointer.frames(page);
  await libReveal('tool_coin');let state=await ed();
  assert.ok(state.visible.includes('tool_coin')&&state.visible.includes('tool_start')&&state.visible.includes('tool_finish'),'Gameplay tab at '+size.width);
  assert.ok(!state.visible.includes('kind_flat')&&!state.visible.includes('collapse_gameplay')&&!state.visible.includes('collapse_tool_category'),'one library tab, no Defold palette');
  assert.ok(state.visible.includes('tool_select'),'top-bar tools independent of the library');
  await libReveal('kind_wave');state=await ed();assert.ok(state.visible.includes('kind_wave')&&!state.visible.includes('tool_coin'),'Track parts tab at '+size.width);
  await button('tool_select');assert.equal((await ed()).tool,'select');
  await libReveal('tool_coin');await button('tool_coin');assert.equal((await ed()).tool,'coin');
  state=await ed();const r=state.ui.rects;
  // #684: one floating bar, centred, above the library.
  assert.ok(Math.abs(r.undo.y+r.undo.h/2-(r.play.y+r.play.h/2))<=1&&Math.abs(r.redo.y-r.undo.y)<=1,JSON.stringify([r.undo,r.redo,r.play]));
  assert.ok(Math.abs((r.tool_select.x+r.play.x+r.play.w)/2-size.width/state.ui.scale/2)<=2,'top bar centred at '+size.width);
  // #688: the tool bar never reaches the system buttons on its right.
  {const g=await page.evaluate(()=>[document.getElementById('rider-chrome-tools').getBoundingClientRect().right,document.getElementById('rider-chrome-sys').getBoundingClientRect().left]);assert.ok(g[0]<g[1],'tool bar overlaps the system buttons at '+size.width+': '+g);}
  assert.ok(r.play.y+r.play.h<=r.lib_play.y,'top bar above the library at '+size.width);
  assert.ok(r.tool_coin.y!==r.play.y);assert.equal(state.overlay.nodes,628);await unchanged(categoryBefore,'library tabs/tool choice/viewport');
  await page.screenshot({path:path.join(out,`editor-categories-${size.width}x${size.height}.png`)});
 }
 for(const size of [{width:1280,height:720},{width:844,height:390},{width:390,height:844}]){
  await page.setViewportSize(size);await pointer.frames(page);const state=await ed();
  // #602: real clicks at the top-bar positions on every layout, plus the rendered names.
  // #688: 3D, Texture and the Decor tool moved from the Defold bottom bar into the chrome's top bar.
  for(const n of ['terrain_look','track_textures','tool_decoration'])assert.ok(state.visible.includes(n),n+' offered');
  assert.match(state.ui.labels.terrain_look,/^3D look/);assert.match(state.ui.labels.track_textures,/^Ground texture/);
  const undoBefore=(await ed()).undo;await button('undo');await pointer.frames(page);
  const undone=await ed();assert.ok(undone.undo!==undoBefore||/Nothing to undo/.test(undone.message),'Undo click had no effect at '+size.width);
  // #688: the chrome's status line shows the editor message (or the readout) and stays clear of the view bar.
  {const l=await page.evaluate(()=>{const m=document.querySelector('#rider-chrome-line .msg'),v=document.getElementById('rider-chrome-view').getBoundingClientRect(),r=m.getBoundingClientRect();return {text:m.textContent,top:r.top,bar:v.bottom};});
   const want=undone.message||undone.readout||'';if(want)await page.waitForFunction(t=>document.querySelector('#rider-chrome-line .msg').textContent===t,want,{timeout:5000});
   assert.ok(l.top>=l.bar-.5,'status line under the view bar at '+size.width+': '+JSON.stringify(l));}
  await button('redo');await pointer.frames(page);const redone=await ed();assert.ok(redone.undo===undoBefore||/Nothing to redo/.test(redone.message),'Redo click had no effect at '+size.width);
  await button('play');await page.waitForFunction(()=>window.riderEditor?.mode==='play'||window.riderEditor?.ui?.error_banner,null,{timeout:20000});
  if((await ed()).mode==='play'){await key('e');await edit();}
 }
 await page.setViewportSize({width:1280,height:720});await key('s');await key('Home');
 // #684: dialogs hide the chrome (no chrome button is published or pressable), and a chrome press while a
 // field is focused only confirms the field, like a Defold button press.
 await button('view_help');await page.waitForFunction(()=>window.riderEditor.help_open);await pointer.frames(page);
 e=await ed();assert.ok(!e.visible.includes('undo')&&!e.buttons.undo&&!e.visible.includes('tool_select'),'chrome hidden under Help');
 await button('help_close');await page.waitForFunction(()=>!window.riderEditor.help_open&&window.riderEditor.visible.includes('undo'));
 await button('rename');assert.notEqual((await ed()).field,false);const chromeUndo=(await ed()).undo,chromeTool=(await ed()).tool;
 await button('tool_draw');e=await ed();assert.equal(e.field,false,'chrome press confirms the focused field');
 assert.equal(e.tool,chromeTool,'chrome press with a focused field does not run its command');assert.equal(e.undo,chromeUndo);
 cases.push('coin_editor_categories_independent_and_top_bar_commands');checkpoint('coin_editor_categories_independent_and_top_bar_commands');

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
 assert.ok((await inspScroll()).overflow>0,'the inspector needs overflow scrolling');
 {const insp=await page.locator('#rider-chrome-insp').boundingBox();assert.ok(insp.y+insp.height<=400,'sidebar covers the footer');}
 {const dock=await page.locator('#rider-chrome-dock').boundingBox();assert.ok(dock&&dock.y+dock.height<=400,'library covers the footer');}
 async function seekScrollbar(name,bottom){
  const r=(await ed()).ui.scrollbars[name];assert.ok(r,name+' missing');
  await page.mouse.move(r.x+r.w/2,r.y+r.knob/2);await pointer.frames(page);await page.mouse.down();await pointer.frames(page);
  await page.mouse.move(r.x+r.w/2,bottom?r.y+r.h-1:r.y+1,{steps:6});await pointer.frames(page);await page.mouse.up();await pointer.frames(page);
 }
 // #685: the Track parts tab overflows the short window and scrolls inside the library dock.
 await libReveal('kind_flat');e=await settle();assert.ok(!e.visible.includes('kind_wave'),'short window: the last part starts below the fold');
 {const lb=await page.locator('#rider-chrome .chrome-dock .pbody').boundingBox();await page.mouse.move(lb.x+lb.width/2,lb.y+lb.height/2);await pointer.frames(page);}
 for(let i=0;i<12&&!(await ed()).visible.includes('kind_wave');i++){await page.mouse.wheel(0,120);await pointer.frames(page);}
 e=await settle();assert.ok(e.visible.includes('kind_wave'),'last prefab is unreachable');
 for(let i=0;i<12&&!(await ed()).visible.includes('kind_flat');i++){await page.mouse.wheel(0,-120);await pointer.frames(page);}
 e=await settle();assert.ok(e.visible.includes('kind_flat'),'library top reachable');
 await button('rename');assert.notEqual((await ed()).field,false);
 // #686: wheel scrolling the inspector keeps the focused field open with its typed text, uncommitted (no press reaches the editor).
 const nameBefore=(await ed()).name;await page.keyboard.type('Q',{delay:40});const typed=(await ed()).field;assert.ok(String(typed).endsWith('Q'),String(typed));
 for(let i=0;i<12&&(await inspScroll()).top<(await inspScroll()).overflow;i++)await panelWheel(120);
 e=await settle();assert.equal(e.field,typed,'inspector scrolling keeps the focused field and its text');assert.equal(e.name,nameBefore,'nothing committed while scrolling');assert.ok((await inspScroll()).top>0);assert.ok(e.visible.includes('inc_test_speed'));
 await key('Escape');e=await settle();assert.equal(e.field,false);assert.equal(e.name,nameBefore,'scrolling committed nothing');
 for(let i=0;i<12&&(await inspScroll()).top>0;i++)await panelWheel(-120);
 assert.equal((await inspScroll()).top,0);
 await unchanged(viewBefore,'scrollbar drag/wheel and resize');
 await page.screenshot({path:path.join(out,'editor-a-scrollbars-1280x480.png')});
 await page.setViewportSize({width:1280,height:720});await libReveal('tool_coin');e=await settle();
 {const dock=await page.locator('#rider-chrome-dock').boundingBox();assert.ok(dock.y+dock.height<600,'library dock hugs its content');}
 {const insp=await page.locator('#rider-chrome-insp').boundingBox();assert.ok(insp.y+insp.height<600,'Properties panel hugs its content');}
 assert.equal((await inspScroll()).overflow,0);
 // The empty area below a short panel belongs to the canvas, including pointer input.
 const freeBefore=await doc(),freeRevision=(await ed()).revision;
 await key('d');await pointer.tap(page,{x:1100,y:560});await pointer.tap(page,{x:1160,y:600});await key('Enter');
 await revision(freeRevision+1);assert.equal((await doc()).objects.length,freeBefore.objects.length+1,'short sidebar still captures canvas input below it');
 await key('z',['Control']);await revision(freeRevision+2);assert.equal(shape(await doc()),shape(freeBefore));
 await key('Escape');
 measurements.editor_a_feedback={error:'red button, automatic source flash, direct Play banner, fix/Undo',scroll:'both panels: wheel + draggable scrollbar, constant control size'};
 cases.push('a1b_feedback_errors_and_scroll');checkpoint('a1b_feedback_errors_and_scroll');
 const layouts={};
 for(const size of [{width:1280,height:720},{width:1920,height:1080}]){
  await page.setViewportSize(size);await pointer.frames(page);await key('Home');await key('Escape');await key('p');await key('2');await hover([6,3]);e=await settle();
  assert.equal(e.prefab_kind,'ramp');assert.equal(e.tool,'prefab');
  // #684: file commands sit in the system group at the top right, right of the floating tool bar.
  const rr=e.ui.rects;assert.ok(rr.new.y<32&&rr.new.x>rr.play.x+rr.play.w&&rr.new.x+rr.new.w<=size.width-12+1,JSON.stringify(rr.new));
  // #602/#684: Undo, Redo and Play sit in one row of the centred floating bar, left of Versions, without overlap.
  for(const name of ['undo','redo','play'])assert.ok(rr[name].y<32&&Math.abs(rr[name].y+rr[name].h/2-(rr.play.y+rr.play.h/2))<=1,name+' top bar');
  assert.ok(rr.undo.x+rr.undo.w<=rr.redo.x&&rr.redo.x+rr.redo.w<=rr.play.x&&rr.play.x+rr.play.w<=rr.versions.x,'top-bar commands overlap');
  assert.ok(Math.abs((rr.tool_select.x+rr.play.x+rr.play.w)/2-size.width/2)<=2,'top bar centred at '+size.width);
  // #685: the workspace lies between the library dock (392 CSS px) and the inspector (312).
  assert.equal(e.ui.scale,1);assert.equal(e.usable.x1-e.usable.x0,size.width-704);
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
  assert.equal(e.usable.x0,u.x0-308);assert.equal(e.usable.x1,u.x1+240);
  assert.ok(!e.visible.includes('tool_coin')&&!e.visible.includes('param_2'));
  assert.ok(e.visible.includes('tool_select'),'#684: the floating tool bar stays when the palette collapses');
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
 // #684: the chrome keeps its CSS-pixel size and centre at DPR 2.
 {const hr=high.state.ui.rects;assert.ok(Math.abs((hr.tool_select.x+hr.play.x+hr.play.w)/2-high.css/2)<=2,'hidpi top bar centred');assert.ok(Math.abs(hr.play.h-50)<=1,'hidpi play size '+hr.play.h);}
 assert.equal(high.state.usable.x0,784);assert.equal(high.state.usable.x1,1936);assert.equal(high.state.overlay.nodes,628);
 await hi.screenshot({path:path.join(out,'editor-a-hidpi.png')});assert.deepEqual(hiErrors,[]);
 layouts.hidpi={canvas:high.canvas,css:high.css,scale:high.state.ui.scale,nodes:high.state.overlay.nodes};
 await context.close();await page.bringToFront();await pointer.frames(page);
 measurements.editor_a_layout=layouts;cases.push('a1b_layout_viewports_and_collapse');checkpoint('a1b_layout_viewports_and_collapse');
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
 measurements.editor_a_fields={invalid_preserved:true,shift_length:9,alt_length:9.01,limit_refused:true,pending_step_single_undo:true};cases.push('a1b_numeric_focus_steps_and_connected_run');checkpoint('a1b_numeric_focus_steps_and_connected_run');
 // Seven-field Kicker: scroll stays in the panel; last numeric field remains reachable and focussed.
 const seven=JSON.parse(JSON.stringify(base));seven.id='ea1-seven';seven.name='Seven parameters';seven.editor.objects=seven.editor.objects.slice(0,2);
 seven.editor.objects[1]={id:'o2',type:'prefab',kind:'kicker',at:[10,0],params:{facing:'right',angle:15,lip:1,gap:2,landing:'down',landing_length:6,landing_angle:15}};
 seven.editor.connections=[{from:'o1',to:'o2'}];seven.editor.next_id=3;
 await importText(JSON.stringify(seven),'ea1-seven.json');await key('Home');await at([11,.25]);await page.waitForFunction(()=>window.riderEditor.selection==='o2');e=await settle();
 const beforeScroll=await snapshot(),zoom=e.camera.zoom;
 // Wheel over the inspector both ways: it scrolls the dock only, never the camera or the document.
 for(const d of [120,120,-120,-120])await panelWheel(d);e=await ed();assert.equal(e.camera.zoom,zoom,'inspector wheel zoomed the camera');
 for(let i=0;i<12&&!e.visible.includes('param_7');i++){await panelWheel(120);e=await ed();}
 assert.ok(e.visible.includes('param_7'),'seventh parameter unreachable');assert.equal(e.camera.zoom,zoom);await unchanged(beforeScroll,'inspector scrolling');
 await button('param_7');assert.equal((await ed()).field_param,'landing_angle');await key('Escape');
 await key('h');e=await settle();assert.equal(e.help_open,true);const mode=e.mode,tool=e.tool;
 await key('e');await key('s');await key('z',['Control']);e=await ed();assert.equal(e.mode,mode);assert.equal(e.tool,tool);assert.equal(e.revision,beforeScroll.revision);
 await page.mouse.wheel(0,120);await key('h');await unchanged(beforeScroll,'modal keys and scroll');
 await page.screenshot({path:path.join(out,'editor-a-seven-parameters.png')});
 measurements.editor_a_scroll={scroll:(await inspScroll()).top,gui_nodes:(await ed()).overlay.nodes};cases.push('a1b_scrolling_and_modal_capture');checkpoint('a1b_scrolling_and_modal_capture');
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
 await key('e');await edit();measurements.editor_a_budget=counts;cases.push('a1b_maximum_level_and_switch_budgets');checkpoint('a1b_maximum_level_and_switch_budgets');
 checkpoint('start:medal_editor');
 await require('../gameplay/check_medal_editor.cjs')(h);
 checkpoint('done:medal_editor');
 if(h.part==='1/2')return; // Part 1 stops after 16 cases; full local run still executes all 23.
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
};
