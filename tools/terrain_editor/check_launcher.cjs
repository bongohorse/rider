// Focused draft-reload check: actual editor input, same artifact launcher, verified ordinary debug bundle.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright'),{configure}=require('../gym/launch.cjs'),pointer=require('../gym/pointer.cjs');
const [bundleArg,launcherArg,outArg]=process.argv.slice(2),bundle=path.resolve(bundleArg),launcher=path.resolve(launcherArg),out=path.resolve(outArg);fs.mkdirSync(out,{recursive:true});
const sha=JSON.parse(fs.readFileSync(path.join(bundle,'bundle.json'))).source_sha;
execFileSync('python',['-c','import sys;sys.path.insert(0,"tools/gym");from bundle import verify_bundle;verify_bundle(sys.argv[1],sys.argv[2])',bundle,sha]);
const course=process.argv[5]||'six-anchor';
const r={schema:1,status:'INCOMPLETE',source_sha:sha,course,errors:[]};
(async()=>{let browser,server,page,frame;try{
 const web=path.join(bundle,'RiderG1');server=http.createServer((q,res)=>{const p=new URL(q.url,'http://localhost').pathname,root=p==='/terrain-preview.html'||p.startsWith('/courses/')?launcher:web,f=path.resolve(root,'.'+p);if(!f.startsWith(root+path.sep)||!fs.existsSync(f)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',f.endsWith('.wasm')?'application/wasm':f.endsWith('.js')?'text/javascript':f.endsWith('.json')?'application/json':'text/html');fs.createReadStream(f).pipe(res);});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 browser=await chromium.launch();page=await browser.newPage({viewport:{width:1280,height:720}});await configure(page,'launcher-resume','le4');
 page.on('pageerror',e=>r.errors.push(e.message));page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))r.errors.push(m.text());});
 await page.goto('http://127.0.0.1:'+server.address().port+'/terrain-preview.html?course='+course);await page.waitForFunction(()=>document.querySelector('#state').textContent==='Ready · normal Play');
 frame=page.frames().find(f=>f.url().includes('/index.html'));
 await frame.locator('canvas').focus();await page.waitForTimeout(1100);await page.keyboard.down('e');await frame.waitForFunction(()=>window.riderEditor?.mode==='edit'&&window.riderEditor.view);await page.keyboard.up('e');
 const before=await frame.evaluate(()=>({editor:window.riderEditor,objects:window.riderEditorDoc.objects}));r.before={revision:before.editor.revision,speed:before.editor.start.speed};
 const b=before.editor.buttons.speed;assert.ok(b?.x>0);const canvas=await frame.locator('canvas').boundingBox(),size=await frame.locator('canvas').evaluate(c=>({w:c.width,h:c.height}));
 await pointer.tap(page,{x:canvas.x+b.x/size.w*canvas.width,y:canvas.y+(1-b.y/size.h)*canvas.height});
 await frame.waitForFunction(()=>window.riderEditor.field!==false&&window.riderEditor.field_all);
 // Text and confirmation must reach the iframe engine on distinct acknowledged frames.
 await page.keyboard.type('1',{delay:40});await frame.waitForFunction(()=>window.riderEditor.field==='1');
 await page.keyboard.down('Enter');await frame.waitForFunction(n=>window.riderEditor.revision>n&&window.riderEditor.start.speed===1,before.editor.revision);await page.keyboard.up('Enter');
 await frame.waitForFunction(n=>window.riderEditor.revision>n&&window.riderEditor.start.speed===1&&window.riderEditor.status==='Saved',before.editor.revision,{timeout:30000});
 await frame.waitForFunction(()=>window.riderCustom.syncState()!=='syncing');
 const edited=await frame.evaluate(()=>({revision:window.riderEditor.revision,speed:window.riderEditor.start.speed,objects:window.riderEditorDoc.objects}));r.edited={revision:edited.revision,speed:edited.speed};assert.deepEqual(edited.objects,before.objects);
 await page.reload();await page.waitForFunction(()=>document.querySelector('#state').dataset.resumed==='true');frame=page.frames().find(f=>f.url().includes('/index.html'));
 await frame.waitForFunction(()=>window.riderEditor?.mode==='edit'&&window.riderEditor.view);const restored=await frame.evaluate(()=>({revision:window.riderEditor.revision,speed:window.riderEditor.start.speed,objects:window.riderEditorDoc.objects}));
 assert.deepEqual(restored,edited,'Launcher overwrote the saved unplayed draft');assert.equal(await page.locator('#state').textContent(),'Ready · resumed editor');r.restored={revision:restored.revision,speed:restored.speed};
 await page.screenshot({path:path.join(out,'resumed-editor.png')});
 if(course.endsWith('over-budget')){
  await frame.locator('canvas').focus();await page.keyboard.down('e');await frame.waitForFunction(()=>window.riderEditor?.mode==='play'&&window.riderTelemetry?.sequence>2);await page.keyboard.up('e');
  const played=await frame.evaluate(()=>window.riderTelemetry);assert.equal(played.terrain_shapes,course==='mixed-over-budget'?1028:1016);
  await page.keyboard.down('r');await frame.waitForFunction(n=>window.riderTelemetry.reset_count>n,played.reset_count);await page.keyboard.up('r');
  const retried=await frame.evaluate(()=>window.riderTelemetry);assert.equal(retried.session_generation,played.session_generation);assert.equal(retried.world_loads,played.world_loads);
  r.play_retry={terrain_shapes:retried.terrain_shapes,generation:retried.session_generation,world_loads:retried.world_loads,reset_before:played.reset_count,reset_after:retried.reset_count};
 }
 assert.deepEqual(r.errors,[]);r.status='PASS';
}catch(e){r.status='FAIL';r.failure=e.stack;if(frame)r.failure_editor=await frame.evaluate(()=>window.riderEditor).catch(()=>null);if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw e;}finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(r,null,2)+'\n');if(browser)await browser.close();server?.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
