'use strict';
// #549: actual DOM/canvas input through the production panel; no debug mutation of source or renderer.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{configure}=require('./launch.cjs'),pointer=require('./pointer.cjs');
const EXPECTED=['preview_presets','layer_controls','master_restore','apply_undo_redo','reload_play','discard_tabs_layout'];
async function main(){
 const [output,sha,runId,kind,bundleArg]=process.argv.slice(2);assert.equal(kind,'bg549');
 const out=path.resolve(output),bundle=path.resolve(bundleArg);fs.mkdirSync(out,{recursive:true});
 const manifest=JSON.parse(fs.readFileSync(path.join(bundle,'bundle.json')));assert.equal(manifest.source_sha,sha);
 const indexes=Object.keys(manifest.files).filter(x=>x.endsWith('/index.html')||x==='index.html');assert.equal(indexes.length,1);
 const web=path.dirname(path.join(bundle,indexes[0]));let browser,page,server;
 const report={schema_version:1,source_sha:sha,run_id:runId,status:'FAIL',cases:{},errors:[],not_run:['physical device','phone/GPU performance','human art and Auto acceptance']};
 // #703: a whole-run watchdog. The last action is logged every 20 s; 30 s before smoke.py's kill (360 s in
 // tools/gym/dispatch.py) the report is written with that action and the run exits, so a slow or stuck run
 // still reports where it was. (Only Node timers: they fire even when the page itself is stuck.)
 let last='start';const mark=what=>{last=what;report.last_action=what;};
 const beat=setInterval(()=>console.log('bg549 at '+last),20000);beat.unref();
 const dog=setTimeout(()=>{report.failure='bg549 stalled at: '+last;console.log(report.failure);
  try{fs.writeFileSync(path.join(out,'background549-result.json'),JSON.stringify(report,null,2)+'\n');}finally{process.exit(1);}},330000);dog.unref();
 try{
  server=http.createServer((req,res)=>{const file=path.resolve(web,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(web+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.wasm')?'application/wasm':file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':'application/octet-stream');fs.createReadStream(file).pipe(res);});
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));browser=await chromium.launch();report.browser=browser.version();
  page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});await configure(page,runId,kind);
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))report.errors.push(m.text());});
  const base=`http://127.0.0.1:${server.address().port}/index.html`;
  await page.goto(base+'?station=first-run');await page.waitForFunction(()=>window.riderTelemetry?.sequence>5,null,{timeout:60000});
  async function key(name){mark('key '+name);await page.locator('canvas').focus();await page.keyboard.down(name);await pointer.frames(page,{n:6});await page.keyboard.up(name);await pointer.frames(page,{n:6});}
  const state=()=>page.evaluate(()=>window.riderBackgroundState);
  const document=()=>page.evaluate(()=>window.riderEditorDoc);
  async function tap(name){
   mark('tap '+name);await page.locator('canvas').focus();
   // Returning from DOM controls uses the editor's existing one-second canvas refocus guard.
   await page.waitForTimeout(1100);
   const point=await page.evaluate(name=>{const b=window.riderEditor.buttons[name],c=document.querySelector('canvas'),r=c.getBoundingClientRect();if(!b)throw Error('Missing editor button '+name);return {x:r.x+b.x*r.width/c.width,y:r.y+r.height-b.y*r.height/c.height};},name);
   await pointer.tap(page,point);await pointer.frames(page,{n:8});
  }
  await key('e');await page.waitForFunction(()=>window.riderEditor?.mode==='edit'&&window.riderEditor?.screen&&window.riderBackgroundState?.edit,null,{timeout:30000});await pointer.frames(page,{n:20});
  const initial=await page.evaluate(()=>({revision:window.riderEditor.revision,undo:window.riderEditor.undo}));
  // #706: presets, ON/OFF, layer visibility, Depth and Auto are in the library's Background tab; the
  // Layer images and height panel keeps each layer's image and vertical settings.
  async function open(){mark('open Background tab');
   await page.mouse.move(640,70);await pointer.frames(page,{n:6});await tap('lib_bg');
   await page.waitForFunction(()=>document.querySelectorAll('[data-preset-bg]').length===4,null,{timeout:10000});
  }
  async function layers(){mark('layers');
   await page.getByRole('button',{name:'Layer images and height',exact:true}).click();
   await page.waitForFunction(()=>window.riderBackgroundPanel?.visible,null,{timeout:10000});
  }
  await open();assert.equal(await page.locator('[data-preset-bg]').count(),4);
  for(const id of ['meadow','quarry','city','volcano']){
   await page.locator(`[data-preset-bg=${id}]`).click();
   await page.waitForFunction(id=>window.riderBackgroundState?.source?.preset===id&&window.riderBackgroundState?.objects===6,id,{timeout:10000});
   await page.waitForFunction(id=>window.riderEditorDoc.backgrounds?.preset===id,id);await page.screenshot({path:path.join(out,'preset-'+id+'.png')});
  }
  assert.equal(await page.evaluate(()=>window.riderEditor.undo),initial.undo+4,'one Undo step per preset');assert.equal(await page.locator('#rider-background-apply').count(),0);assert.equal(await page.locator('#rider-background-discard').count(),0);report.cases.preview_presets={presets:['meadow','quarry','city','volcano'],undo_steps:4};
  // Tab switches (aria-pressed); the helper keeps the checkbox wording of the old panel.
  const checkbox=(i,name)=>{const b=page.getByRole('button',{name:`${i===6?'Foreground':'Layer '+i} ${name}`,exact:true});
   const set=async on=>{await b.waitFor();if(((await b.getAttribute('aria-pressed'))==='true')!==on){await b.click();await page.waitForFunction(([label,on])=>((document.querySelector(`#rider-chrome [aria-label="${label}"]`)?.getAttribute('aria-pressed'))==='true')===on,[`${i===6?'Foreground':'Layer '+i} ${name}`,on]);}};
   return {check:()=>set(true),uncheck:()=>set(false),isChecked:async()=>(await b.getAttribute('aria-pressed'))==='true'};};
  const slots=[];
  for(let i=1;i<=6;i++){
   await checkbox(i,'ON/OFF').uncheck();await page.waitForFunction(i=>!window.riderBackgroundState.layers[i-1].visible&&window.riderBackgroundState.objects===5,i);
   await checkbox(i,'ON/OFF').check();await page.waitForFunction(i=>window.riderBackgroundState.layers[i-1].visible&&window.riderBackgroundState.objects===6,i);slots.push(i);
  }
  await checkbox(2,'ON/OFF').uncheck();await page.waitForFunction(()=>window.riderBackgroundState.objects===5);
  await checkbox(3,'Auto').uncheck();const depth=page.getByRole('slider',{name:'Layer 3 Depth',exact:true});await depth.click();
  await page.keyboard.press('End');for(let i=0;i<50;i++)await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(()=>window.riderBackgroundState?.source?.layers[2].depth===.5&&!window.riderBackgroundState.source.layers[2].auto);
  await checkbox(3,'Auto').check();await page.waitForFunction(()=>window.riderBackgroundState.layers[2].effective_depth===.55&&window.riderBackgroundState.source.layers[2].depth===.5);
  await checkbox(3,'Auto').uncheck();await page.waitForFunction(()=>window.riderBackgroundState.layers[2].effective_depth===.5);
  await layers();await page.getByRole('combobox',{name:'Layer 4 image',exact:true}).selectOption('quarry');await page.waitForFunction(()=>window.riderBackgroundState.source.layers[3].image?.preset==='quarry');
  // #604: one mouse drag previews live and stores one Undo step on release.
  const track=await depth.boundingBox(),beforeDrag=await page.evaluate(()=>window.riderEditor.undo);
  await page.mouse.move(track.x+track.width*.3,track.y+track.height/2);await page.mouse.down();await page.mouse.move(track.x+track.width*.5,track.y+track.height/2,{steps:6});await page.mouse.move(track.x+track.width*.7,track.y+track.height/2,{steps:6});await pointer.frames(page,{n:8});
  assert.equal(await page.evaluate(()=>window.riderEditor.undo),beforeDrag,'a drag only previews');await page.mouse.up();await page.waitForFunction(n=>window.riderEditor.undo===n+1,beforeDrag);await pointer.frames(page,{n:8});assert.equal(await page.evaluate(()=>window.riderEditor.undo),beforeDrag+1);
  const beforeKeys=await page.evaluate(()=>window.riderEditor.undo);await depth.click();await page.waitForFunction(n=>window.riderEditor.undo===n+1,beforeKeys);const afterClick=beforeKeys+1;await page.keyboard.press('e');await page.keyboard.press('Delete');await pointer.frames(page,{n:8});
  assert.equal(await page.evaluate(()=>window.riderEditor.mode),'edit');assert.equal(await page.evaluate(()=>window.riderEditor.undo),afterClick);
  report.cases.layer_controls={slots,state:await state()};
  // #614: both sliders in every background slot use real pointer drags.
  // Keep the panel open during Undo/Redo to verify its values follow the source.
  const vertical=[];
  for(let slot=1;slot<=5;slot++){
   for(const [field,name] of [['vertical_position','Vertical position'],['vertical_parallax','Vertical parallax']]){
    const slider=page.getByRole('slider',{name:`Layer ${slot} ${name}`,exact:true});
    await slider.scrollIntoViewIfNeeded();const box=await slider.boundingBox();
    const before=structuredClone((await state()).source),undo=await page.evaluate(()=>window.riderEditor.undo);
    await page.mouse.move(box.x+box.width*.2,box.y+box.height/2);await page.mouse.down();
    await page.mouse.move(box.x+box.width*.4,box.y+box.height/2,{steps:5});await pointer.frames(page,{n:8});
    await page.waitForFunction(({slot,field})=>window.riderBackgroundState.source.layers[slot-1][field]!==undefined,{slot,field});
    assert.equal(await page.evaluate(()=>window.riderEditor.undo),undo,'vertical drag previews without Undo');
    assert.deepEqual((await document()).backgrounds,before,'preview leaves stored source untouched');
    const preview=(await state()).source.layers[slot-1][field];
    await page.mouse.move(box.x+box.width*.7,box.y+box.height/2,{steps:8});await pointer.frames(page,{n:8});
    assert.notEqual((await state()).source.layers[slot-1][field],preview,'drag previews newest value');
    await page.mouse.up();await page.waitForFunction(n=>window.riderEditor.undo===n+1,undo);
    await pointer.frames(page,{n:8});assert.equal(await page.evaluate(()=>window.riderEditor.undo),undo+1,'release is exactly one Undo step');
    const saved=structuredClone((await state()).source);assert.equal(saved.version,2);assert.deepEqual((await document()).backgrounds,saved);
    await tap('undo');await page.waitForFunction(b=>JSON.stringify(window.riderEditorDoc.backgrounds)===JSON.stringify(b),before);
    assert(Math.abs(Number(await slider.inputValue())-(before.layers[slot-1][field]??(field==='vertical_position'?0:1-[.9,.75,.55,.35,.15][slot-1])))<1e-8);
    await tap('redo');await page.waitForFunction(b=>JSON.stringify(window.riderEditorDoc.backgrounds)===JSON.stringify(b),saved);
    assert.equal(Number(await slider.inputValue()),saved.layers[slot-1][field]);vertical.push({slot,field,value:saved.layers[slot-1][field]});
   }
  }
  assert.equal(await page.getByRole('slider',{name:/Foreground Vertical/}).count(),0);
  report.cases.layer_controls.vertical=vertical;
  const masterButton=page.getByRole('button',{name:'Background ON/OFF',exact:true});
  const master={check:async()=>{if((await masterButton.getAttribute('aria-pressed'))!=='true')await masterButton.click();},uncheck:async()=>{if((await masterButton.getAttribute('aria-pressed'))==='true')await masterButton.click();},isChecked:async()=>(await masterButton.getAttribute('aria-pressed'))==='true'};const choices=(await state()).source.layers;
  await master.uncheck();await page.waitForFunction(()=>!window.riderBackgroundState.enabled&&window.riderBackgroundState.objects===0&&window.riderBackgroundState.buffers===0);
  let off=await state();assert.equal(off.texture_bytes,0);assert.deepEqual(off.source.layers,choices);
  await master.check();await page.waitForFunction(()=>window.riderBackgroundState.enabled&&window.riderBackgroundState.objects===5);
  assert.deepEqual((await state()).source.layers,choices);report.cases.master_restore={off,on:await state()};
  // Persist master OFF too; Undo/Redo must restore the complete source, not just visible images.
  await master.uncheck();await page.waitForFunction(()=>!window.riderBackgroundState.enabled&&window.riderBackgroundState.objects===0);
  const expected=structuredClone((await state()).source);
  await page.waitForFunction(()=>window.riderEditorDoc.backgrounds?.enabled===false);assert.deepEqual((await document()).backgrounds,expected);
  await page.locator('canvas').focus();await page.waitForTimeout(1100);await tap('undo');
  await page.waitForFunction(()=>window.riderEditorDoc.backgrounds?.enabled===true&&window.riderBackgroundState.objects===5);await tap('redo');
  await page.waitForFunction(()=>window.riderEditorDoc.backgrounds?.enabled===false);assert.deepEqual((await document()).backgrounds,expected);
  report.cases.apply_undo_redo={saved:expected,undo_steps:1};await page.waitForFunction(()=>window.riderEditor.status==='Saved'&&!window.riderEditor.dirty,null,{timeout:30000});
  await page.reload();await page.waitForFunction(()=>window.riderEditor?.mode==='edit'||window.riderTelemetry?.sequence>2,null,{timeout:60000});
  if(await page.evaluate(()=>window.riderEditor?.mode!=='edit'))await key('e');
  await page.waitForFunction(()=>window.riderEditor?.mode==='edit'&&window.riderEditorDoc?.backgrounds?.enabled===false&&window.riderBackgroundState?.objects===0,null,{timeout:30000});
  assert.deepEqual((await document()).backgrounds,expected);await open();assert.equal(await master.isChecked(),false);assert.equal(await checkbox(2,'ON/OFF').isChecked(),false);
  await master.check();await page.waitForFunction(()=>window.riderBackgroundState.objects===5);
  await page.waitForFunction(()=>window.riderEditorDoc.backgrounds.enabled===true);expected.enabled=true;
  await tap('play');
  await page.waitForFunction(()=>window.riderEditor?.mode==='play'&&!window.riderBackgroundState?.edit&&window.riderBackgroundState?.objects===5,null,{timeout:30000});
  assert.deepEqual((await state()).source,expected);await page.locator('canvas').focus();await page.keyboard.down('w');await pointer.frames(page,{n:60});await page.keyboard.up('w');
  await page.screenshot({path:path.join(out,'drive.png')});report.cases.reload_play={source:expected,play:await state()};
  await key('e');await page.waitForFunction(()=>window.riderEditor?.mode==='edit'&&window.riderBackgroundState?.edit,null,{timeout:30000});await open();
  const undo=await page.evaluate(()=>window.riderEditor.undo);await page.locator('[data-preset-bg=meadow]').click();await layers();await page.waitForFunction(()=>window.riderBackgroundState.source.preset==='meadow');
  await page.waitForFunction(()=>window.riderEditorDoc.backgrounds.preset==='meadow');assert.equal(await page.evaluate(()=>window.riderEditor.undo),undo+1,'preset is one Undo step');expected.preset='meadow';
  // Canvas dialogs take precedence and keep the panel state.
  for(const modal of [{open:'view_help',field:'help_open',close:'help_close'},{open:'versions',field:'versions_open',close:'dialog_close'}]){
   await tap(modal.open);await page.waitForFunction(field=>window.riderEditor[field]&&window.riderBackgroundPanel.suspended,modal.field);
   assert.equal(await page.locator('#rider-background-panel').isVisible(),false);assert.equal((await state()).source.preset,'meadow');
   assert.deepEqual((await document()).backgrounds,expected);await tap(modal.close);
   await page.waitForFunction(field=>!window.riderEditor[field]&&!window.riderBackgroundPanel.suspended,modal.field);
   assert.equal(await page.locator('#rider-background-panel').isVisible(),true);assert.equal((await state()).source.preset,'meadow');
  }
  // Library tabs switch freely: nothing is pending (#717: the Ground texture tab is the only Texture control).
  await tap('lib_tex');await page.waitForFunction(()=>document.querySelectorAll('[data-preset-tex]').length===7);
  await tap('lib_bg');await page.waitForFunction(()=>document.querySelectorAll('[data-preset-bg]').length===4);await layers();
  // #686: the hosted panel survives collapse/expand, and the Decor tool and the layer settings take turns in the dock.
  const hosted=sel=>page.evaluate(sel=>!!document.querySelector('#rider-chrome-insp .insp-host '+sel),sel);
  await tap('collapse_properties');await page.waitForFunction(()=>document.querySelector('#rider-chrome-insp').classList.contains('closed')&&window.riderBackgroundPanel.visible);
  assert.equal(await page.evaluate(()=>document.querySelectorAll('#rider-background-panel').length),1,'parked, not destroyed');
  await tap('collapse_properties');await page.waitForFunction(()=>!!document.querySelector('#rider-chrome-insp .insp-host #rider-background-panel'));
  await tap('lib_decor');await page.waitForFunction(()=>window.riderDecorationPanel?.visible&&!window.riderBackgroundPanel.visible&&!!document.querySelector('#rider-chrome-insp .insp-host #rider-decoration-panel'));
  await tap('lib_bg');await page.waitForFunction(()=>document.querySelectorAll('[data-preset-bg]').length===4);await layers();
  await page.waitForFunction(()=>window.riderEditor.tool==='select'&&!window.riderDecorationPanel.visible&&!!document.querySelector('#rider-chrome-insp .insp-host #rider-background-panel'));
  assert.equal(await hosted('#rider-decoration-panel'),false);
  // #703: CI sometimes hangs here until smoke.py's 4-minute kill, with no result. Each viewport step has its
  // own 25 s limit (the run reaches this loop after about 2 minutes) and logs its progress, so a stall fails
  // in time with the step name and failure.png.
  const step=async(label,run)=>{report.step=label;mark('step '+label);console.log('bg549 step '+label);let timer;
   try{return await Promise.race([run(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('bg549 step timed out after 25 s: '+label)),25000);})]);}finally{clearTimeout(timer);}};
  for(const viewport of [{width:844,height:390},{width:1920,height:1080}]){
   const tag=viewport.width+'x'+viewport.height;
   await step('resize '+tag,async()=>{await page.setViewportSize(viewport);await pointer.frames(page,{n:15});});
   await step('layout '+tag,async()=>{
    // #686: the layer settings scroll inside the inspector dock, which must fit the viewport.
    const box=await page.locator('#rider-chrome-insp').boundingBox();assert(box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1);
    assert.ok(await page.evaluate(()=>!!document.querySelector('#rider-chrome-insp .insp-host #rider-background-panel')),'layer settings in the dock');
   });
   await step('foreground toggle '+tag,async()=>{await checkbox(6,'ON/OFF').uncheck();await page.waitForFunction(()=>window.riderBackgroundState.objects===4);await checkbox(6,'ON/OFF').check();await page.waitForFunction(()=>window.riderBackgroundState.objects===5);});
   await step('screenshot '+tag,()=>page.screenshot({path:path.join(out,`layout-${tag}.png`)}));
  }
  delete report.step;
  await page.locator('#rider-background-close').click();assert.deepEqual((await document()).backgrounds.preset,'meadow');
  report.cases.discard_tabs_layout={viewports:['844x390','1920x1080'],modal_draft_preserved:['help','versions']};assert.deepEqual(report.errors,[]);assert.deepEqual(Object.keys(report.cases),EXPECTED);report.status='PASS';
 }catch(e){report.failure=e.stack;
  // A stalled page must not stall the report: each capture gets at most 10 s.
  const capped=p=>{let t;return Promise.race([p.catch(()=>null),new Promise(ok=>{t=setTimeout(()=>ok(null),10000);})]).finally(()=>clearTimeout(t));};
  console.log('bg549 failure: '+String(e.message||e).slice(0,400));
  if(page)report.observed=await capped(page.evaluate(()=>({editor:window.riderEditor,document:window.riderEditorDoc,background:window.riderBackgroundState})));if(page)await capped(page.screenshot({path:path.join(out,'failure.png')}));}
 finally{clearTimeout(dog);clearInterval(beat);if(report.status==='PASS')delete report.last_action;fs.writeFileSync(path.join(out,'background549-result.json'),JSON.stringify(report,null,2)+'\n');if(browser)await browser.close();if(server)await new Promise(ok=>server.close(ok));}
 console.log(JSON.stringify({status:report.status,cases:Object.keys(report.cases),failure:report.failure}));return report.status==='PASS'?0:1;
}
module.exports={EXPECTED};if(require.main===module)main().then(code=>process.exitCode=code).catch(e=>{console.error(e);process.exitCode=1;});
