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
 try{
  server=http.createServer((req,res)=>{const file=path.resolve(web,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(web+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.wasm')?'application/wasm':file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':'application/octet-stream');fs.createReadStream(file).pipe(res);});
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));browser=await chromium.launch();report.browser=browser.version();
  page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});await configure(page,runId,kind);
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))report.errors.push(m.text());});
  const base=`http://127.0.0.1:${server.address().port}/index.html`;
  await page.goto(base+'?station=first-run');await page.waitForFunction(()=>window.riderTelemetry?.sequence>5,null,{timeout:60000});
  async function key(name){await page.locator('canvas').focus();await page.keyboard.down(name);await pointer.frames(page,{n:6});await page.keyboard.up(name);await pointer.frames(page,{n:6});}
  const state=()=>page.evaluate(()=>window.riderBackgroundState);
  const document=()=>page.evaluate(()=>window.riderEditorDoc);
  async function tap(name){
   await page.locator('canvas').focus();
   // Returning from DOM controls uses the editor's existing one-second canvas refocus guard.
   await page.waitForTimeout(1100);
   const point=await page.evaluate(name=>{const b=window.riderEditor.buttons[name],c=document.querySelector('canvas'),r=c.getBoundingClientRect();if(!b)throw Error('Missing editor button '+name);return {x:r.x+b.x*r.width/c.width,y:r.y+r.height-b.y*r.height/c.height};},name);
   await pointer.tap(page,point);await pointer.frames(page,{n:8});
  }
  await key('e');await page.waitForFunction(()=>window.riderEditor?.mode==='edit'&&window.riderEditor?.screen&&window.riderBackgroundState?.edit,null,{timeout:30000});await pointer.frames(page,{n:20});
  const initial=await page.evaluate(()=>({revision:window.riderEditor.revision,undo:window.riderEditor.undo}));
  async function open(){
   await page.mouse.move(640,70);await pointer.frames(page,{n:6});await tap('track_textures');
   await page.waitForFunction(()=>window.riderTrackPanel?.visible,null,{timeout:10000});
   await page.locator('#rider-track-panel').getByRole('tab',{name:'Background',exact:true}).click();
   await page.waitForFunction(()=>window.riderBackgroundPanel?.visible&&!window.riderTrackPanel?.visible,null,{timeout:10000});
  }
  await open();assert.equal(await page.locator('[data-background-preset]').count(),4);
  for(const id of ['meadow','quarry','city','volcano']){
   await page.locator(`[data-background-preset=${id}]`).click();
   await page.waitForFunction(id=>window.riderBackgroundState?.source?.preset===id&&window.riderBackgroundState?.objects===6,id,{timeout:10000});
   assert.equal((await document()).backgrounds,undefined);await page.screenshot({path:path.join(out,'preset-'+id+'.png')});
  }
  assert.equal(await page.evaluate(()=>window.riderEditor.revision),initial.revision);report.cases.preview_presets={presets:['meadow','quarry','city','volcano'],unchanged_revision:initial.revision};
  const checkbox=(i,name)=>page.getByRole('checkbox',{name:`${i===6?'Foreground':'Layer '+i} ${name}`,exact:true});
  const slots=[];
  for(let i=1;i<=6;i++){
   await checkbox(i,'ON/OFF').uncheck();await page.waitForFunction(i=>!window.riderBackgroundState.layers[i-1].visible&&window.riderBackgroundState.objects===5,i);
   await checkbox(i,'ON/OFF').check();await page.waitForFunction(i=>window.riderBackgroundState.layers[i-1].visible&&window.riderBackgroundState.objects===6,i);slots.push(i);
  }
  await checkbox(2,'ON/OFF').uncheck();await page.waitForFunction(()=>window.riderBackgroundState.objects===5);
  await checkbox(3,'Auto').uncheck();const depth=page.getByRole('slider',{name:'Layer 3 Depth',exact:true});await depth.focus();
  await page.keyboard.press('End');for(let i=0;i<50;i++)await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(()=>window.riderBackgroundState?.source?.layers[2].depth===.5&&!window.riderBackgroundState.source.layers[2].auto);
  await checkbox(3,'Auto').check();await page.waitForFunction(()=>window.riderBackgroundState.layers[2].effective_depth===.55&&window.riderBackgroundState.source.layers[2].depth===.5);
  await checkbox(3,'Auto').uncheck();await page.waitForFunction(()=>window.riderBackgroundState.layers[2].effective_depth===.5);
  await page.getByRole('combobox',{name:'Layer 4 image',exact:true}).selectOption('quarry');await page.waitForFunction(()=>window.riderBackgroundState.source.layers[3].image?.preset==='quarry');
  await depth.focus();await page.keyboard.press('e');await page.keyboard.press('Delete');await pointer.frames(page,{n:8});
  assert.equal(await page.evaluate(()=>window.riderEditor.mode),'edit');assert.equal(await page.evaluate(()=>window.riderEditor.undo),initial.undo);
  report.cases.layer_controls={slots,state:await state()};
  const master=page.getByRole('checkbox',{name:'Background ON/OFF',exact:true});const choices=(await state()).source.layers;
  await master.uncheck();await page.waitForFunction(()=>!window.riderBackgroundState.enabled&&window.riderBackgroundState.objects===0&&window.riderBackgroundState.buffers===0);
  let off=await state();assert.equal(off.texture_bytes,0);assert.deepEqual(off.source.layers,choices);
  await master.check();await page.waitForFunction(()=>window.riderBackgroundState.enabled&&window.riderBackgroundState.objects===5);
  assert.deepEqual((await state()).source.layers,choices);report.cases.master_restore={off,on:await state()};
  // Persist master OFF too; Undo/Redo must restore the complete source, not just visible images.
  await master.uncheck();await page.waitForFunction(()=>!window.riderBackgroundState.enabled&&window.riderBackgroundState.objects===0);
  const expected=structuredClone((await state()).source);
  await page.locator('#rider-background-apply').click();await page.waitForFunction(n=>window.riderEditor.revision===n+1&&window.riderEditorDoc.backgrounds?.enabled===false,initial.revision);
  assert.equal(await page.evaluate(()=>window.riderEditor.undo),initial.undo+1);assert.deepEqual((await document()).backgrounds,expected);
  await page.locator('#rider-background-close').click();await page.waitForFunction(()=>!window.riderBackgroundPanel.visible);await tap('undo');
  await page.waitForFunction(()=>!window.riderEditorDoc.backgrounds&&window.riderBackgroundState.objects===0);await tap('redo');
  await page.waitForFunction(()=>window.riderEditorDoc.backgrounds?.enabled===false);assert.deepEqual((await document()).backgrounds,expected);
  report.cases.apply_undo_redo={saved:expected,undo_steps:1};await page.waitForFunction(()=>window.riderEditor.status==='Saved'&&!window.riderEditor.dirty,null,{timeout:30000});
  await page.reload();await page.waitForFunction(()=>window.riderEditor?.mode==='edit'||window.riderTelemetry?.sequence>2,null,{timeout:60000});
  if(await page.evaluate(()=>window.riderEditor?.mode!=='edit'))await key('e');
  await page.waitForFunction(()=>window.riderEditor?.mode==='edit'&&window.riderEditorDoc?.backgrounds?.enabled===false&&window.riderBackgroundState?.objects===0,null,{timeout:30000});
  assert.deepEqual((await document()).backgrounds,expected);await open();assert.equal(await master.isChecked(),false);assert.equal(await checkbox(2,'ON/OFF').isChecked(),false);
  await master.check();await page.waitForFunction(()=>window.riderBackgroundState.objects===5);await page.locator('#rider-background-apply').click();
  await page.waitForFunction(()=>window.riderEditorDoc.backgrounds.enabled===true);expected.enabled=true;
  await page.locator('#rider-background-close').click();await tap('play');
  await page.waitForFunction(()=>window.riderEditor?.mode==='play'&&!window.riderBackgroundState?.edit&&window.riderBackgroundState?.objects===5,null,{timeout:30000});
  assert.deepEqual((await state()).source,expected);await page.locator('canvas').focus();await page.keyboard.down('w');await pointer.frames(page,{n:60});await page.keyboard.up('w');
  await page.screenshot({path:path.join(out,'drive.png')});report.cases.reload_play={source:expected,play:await state()};
  await key('e');await page.waitForFunction(()=>window.riderEditor?.mode==='edit'&&window.riderBackgroundState?.edit,null,{timeout:30000});await open();
  const undo=await page.evaluate(()=>window.riderEditor.undo);await page.locator('[data-background-preset=meadow]').click();await page.waitForFunction(()=>window.riderBackgroundState.source.preset==='meadow');
  await page.locator('#rider-background-panel').getByRole('tab',{name:'Track textures',exact:true}).click();
  await page.waitForFunction(()=>window.riderBackgroundPanel.message.includes('Apply or discard'));assert.equal(await page.evaluate(()=>window.riderBackgroundPanel.visible),true);
  // Canvas dialogs take precedence without discarding the pending Meadow preview.
  for(const modal of [{open:'view_help',field:'help_open',close:'help_close'},{open:'versions',field:'versions_open',close:'dialog_close'}]){
   await tap(modal.open);await page.waitForFunction(field=>window.riderEditor[field]&&window.riderBackgroundPanel.suspended,modal.field);
   assert.equal(await page.locator('#rider-background-panel').isVisible(),false);assert.equal((await state()).source.preset,'meadow');
   assert.deepEqual((await document()).backgrounds,expected);await tap(modal.close);
   await page.waitForFunction(field=>!window.riderEditor[field]&&!window.riderBackgroundPanel.suspended,modal.field);
   assert.equal(await page.locator('#rider-background-panel').isVisible(),true);assert.equal((await state()).source.preset,'meadow');
  }
  await page.locator('#rider-background-discard').click();await page.waitForFunction(()=>window.riderBackgroundState.source.preset==='volcano');assert.deepEqual((await document()).backgrounds,expected);
  await page.locator('#rider-background-panel').getByRole('tab',{name:'Track textures',exact:true}).click();await page.waitForFunction(()=>window.riderTrackPanel.visible&&!window.riderBackgroundPanel.visible);
  await page.locator('#rider-track-panel').getByRole('tab',{name:'Background',exact:true}).click();await page.waitForFunction(()=>window.riderBackgroundPanel.visible);
  for(const viewport of [{width:844,height:390},{width:1920,height:1080}]){
   await page.setViewportSize(viewport);await pointer.frames(page,{n:15});
   const box=await page.locator('#rider-background-panel').boundingBox();assert(box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1);
   await checkbox(6,'ON/OFF').uncheck();await page.waitForFunction(()=>window.riderBackgroundState.objects===4);await checkbox(6,'ON/OFF').check();await page.waitForFunction(()=>window.riderBackgroundState.objects===5);
   await page.screenshot({path:path.join(out,`layout-${viewport.width}x${viewport.height}.png`)});
  }
  await page.locator('#rider-background-close').click();assert.equal(await page.evaluate(()=>window.riderEditor.undo),undo);assert.deepEqual((await document()).backgrounds,expected);
  report.cases.discard_tabs_layout={unchanged_undo:undo,viewports:['844x390','1920x1080'],modal_draft_preserved:['help','versions']};assert.deepEqual(report.errors,[]);assert.deepEqual(Object.keys(report.cases),EXPECTED);report.status='PASS';
 }catch(e){report.failure=e.stack;if(page)report.observed=await page.evaluate(()=>({editor:window.riderEditor,document:window.riderEditorDoc,background:window.riderBackgroundState})).catch(()=>null);if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});}
 finally{fs.writeFileSync(path.join(out,'background549-result.json'),JSON.stringify(report,null,2)+'\n');if(browser)await browser.close();if(server)await new Promise(ok=>server.close(ok));}
 console.log(JSON.stringify({status:report.status,cases:Object.keys(report.cases),failure:report.failure}));return report.status==='PASS'?0:1;
}
module.exports={EXPECTED};if(require.main===module)main().then(code=>process.exitCode=code).catch(e=>{console.error(e);process.exitCode=1;});
