// Native Gym live authoring, using pointer/text input. Debug state is observation only.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('playwright'),{configure}=require('../gym/launch.cjs'),pointer=require('../gym/pointer.cjs');
const [bundleArg,outArg,releaseSha]=process.argv.slice(2),bundle=path.resolve(bundleArg),out=path.resolve(outArg),release=!!releaseSha,sha=releaseSha||JSON.parse(fs.readFileSync(path.join(bundle,'bundle.json'))).source_sha;
fs.mkdirSync(out,{recursive:true});
(async()=>{let browser,server,page;const r={schema:1,status:'INCOMPLETE',source_sha:sha,variant:release?'release':'debug',observer_sha256:crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),checks:[],errors:[]};try{
 const web=path.join(bundle,'RiderG1');server=http.createServer((q,res)=>{const f=path.resolve(web,'.'+new URL(q.url,'http://localhost').pathname);if(!f.startsWith(web+path.sep)||!fs.existsSync(f)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',f.endsWith('.wasm')?'application/wasm':f.endsWith('.js')?'text/javascript':'text/html');fs.createReadStream(f).pipe(res);});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch();r.browser=browser.version();
 async function fresh(){page=await browser.newPage({viewport:{width:1280,height:900}});if(!release)await configure(page,'terrain-look-gym','le6');page.on('pageerror',e=>r.errors.push(e.message));page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))r.errors.push(m.text());});}
 async function frames(n=5){await pointer.frames(page,{n});}
 async function key(k){await page.locator('canvas').focus();await page.keyboard.down(k);await frames();await page.keyboard.up(k);await frames();}
 async function size(){return page.locator('canvas').evaluate(c=>({w:c.width,h:c.height,r:c.getBoundingClientRect().toJSON()}));}
 async function tap(x,y){const s=await size();await pointer.tap(page,{x:s.r.x+x/s.w*s.r.width,y:s.r.y+y/s.h*s.r.height});await frames();}
 async function menu(){const s=await size();await tap(616,s.h-40);await page.waitForTimeout(350);if(!release)await page.waitForFunction(()=>window.riderEditor.look?.open);}
 async function action(which){const s=await size(),x=s.w-436,mh=Math.min(580,s.h-96);await tap(x+({reset:44,apply:148,close:344}[which]),16+mh-22);await page.waitForTimeout(220);}
 async function number(index,value){const s=await size();await tap(s.w-436+316,16+104+index*44+12);await page.keyboard.type(String(value),{delay:30});await key('Enter');await page.waitForTimeout(180);}
 async function playFromEditor(){const g=(await telemetry()).session_generation;await key('e');await page.waitForFunction(n=>!window.riderEditing&&window.riderTelemetry?.session_generation>n&&window.riderTelemetry.sequence>2,g);}
 async function ready(){await page.waitForFunction(()=>window.riderTelemetry?.sequence>2);assert.equal(await page.evaluate(()=>window.riderReady.source_sha),sha);}
 async function telemetry(){return page.evaluate(()=>window.riderTelemetry);}
 async function sameRun(t){const now=await telemetry();assert.equal(now.session_generation,t.session_generation);assert.equal(now.reset_count,t.reset_count);assert.equal(now.terrain_shapes,t.terrain_shapes);assert.equal(await page.evaluate(()=>!!window.riderEditing),false);}
 async function exported(){const s=await size();await tap(s.w-128,24);await page.waitForSelector('#rider-export-text');const d=JSON.parse(await page.locator('#rider-export-text').inputValue());await page.getByRole('button',{name:'Close export',exact:true}).click();await page.waitForTimeout(1000);return d;}
 async function durable(){await page.waitForTimeout(1200);await page.waitForFunction(()=>window.riderCustom.syncState()==='saved');}
 const chosen={version:1,mode:'perspective',width:1.25,perspective:.4,angle:30,side:6,shading:.6};
 // Built-in source/template: no Edit or proxy switch to open, preview, close or Apply.
 await fresh();await page.goto(base+'/index.html?station=straight');await ready();const initial=await telemetry();await menu();await sameRun(initial);
 if(!release){assert.equal(await page.evaluate(()=>window.riderRoadProjection.params.width),.9);assert.equal(await page.evaluate(()=>window.riderEditor.look.dirty),undefined);}
 await number(0,99);if(!release)assert.match(await page.evaluate(()=>window.riderEditor.look.error),/width must be/);await key('Escape');
 for(const [i,v] of [chosen.width,chosen.perspective,chosen.angle,chosen.side,chosen.shading].entries())await number(i,v);
 if(!release)await page.waitForFunction(()=>window.riderRoadProjection.params.width===1.25&&window.riderRoadProjection.params.side===6);
 for(const k of ['ArrowUp','ArrowLeft','e','r','1','Delete'])await key(k);await sameRun(initial);
 assert.equal((await telemetry()).ui_captured,true);await action('close');await sameRun(initial);await menu();
 if(!release)assert.deepEqual(await page.evaluate(()=>window.riderEditor.look.params),chosen);
 await action('apply');await durable();await sameRun(initial);await page.screenshot({path:path.join(out,'gym-menu.png')});await action('close');
 await page.waitForFunction(()=>!window.riderTelemetry.ui_captured);const uploadsBeforeDrive=!release&&await page.evaluate(()=>window.riderRoadProjection.uploads);await page.keyboard.down('ArrowUp');await page.waitForTimeout(1300);await page.keyboard.up('ArrowUp');assert.ok((await telemetry()).command.throttle===1&&(await telemetry()).speed_mps>1,'Controls did not resume after menu');await sameRun(initial);if(!release)assert.equal(await page.evaluate(()=>window.riderRoadProjection.uploads),uploadsBeforeDrive,'Camera motion rebuilt the visible mesh');
 await key('r');await page.waitForFunction(n=>window.riderTelemetry.reset_count>n,initial.reset_count);assert.equal((await telemetry()).session_generation,initial.session_generation);
 if(!release)assert.deepEqual(await page.evaluate(()=>window.riderRoadProjection.params),chosen);
 await key('e');await page.waitForFunction(()=>window.riderEditing);await page.waitForTimeout(1000);const builtin=await exported();assert.deepEqual(builtin.editor.road_look.params,chosen,'E lost the Gym-authored source copy');
 r.checks.push({name:'builtin_live_five_controls_input_capture_apply_drive_retry_and_editor_handoff',telemetry:await telemetry(),export:builtin});
 if(!release){const b=await page.evaluate(()=>window.riderEditor.buttons.undo);const s=await size();await tap(b.x,s.h-b.y);await page.waitForFunction(()=>window.riderEditorDoc.road_profile!=='authored-v1');r.checks.push({name:'gym_apply_is_existing_editor_undo_transaction'});}
 // Legacy 660 m, with full exact collision export comparison and persistence.
 await page.context().close();await fresh();await page.goto(base+'/index.html?station=custom');await page.waitForFunction(()=>window.riderCustom?.visible);
 const fixture=JSON.parse(fs.readFileSync('docs/terrain-p5/mixed-over-budget.json'));delete fixture.editor.road_profile;
 await page.evaluate(body=>window.riderCustom.importFile(new File([body],'gym-legacy-660.json',{type:'application/json'})),JSON.stringify(fixture));await page.waitForFunction(()=>window.riderCustomStatus==='Saved');await ready();await key('e');await page.waitForFunction(()=>window.riderEditing);await page.waitForTimeout(1000);const collisionBaseline=await exported();await playFromEditor();const old=await telemetry();await menu();await sameRun(old);
 if(!release)assert.equal(await page.evaluate(()=>window.riderRoadProjection),null,'Opening converted legacy terrain');
 await action('close');await menu();if(!release)assert.equal(await page.evaluate(()=>window.riderRoadProjection),null);
 for(const [i,v] of [2,1,45,.25,0].entries())await number(i,v);
 if(!release){await page.waitForFunction(()=>window.riderRoadProjection?.params.width===2&&window.riderRoadProjection.params.shading===0);assert.equal(await page.evaluate(()=>window.riderEditorDoc.road_profile),undefined);}
 await action('close');await sameRun(old);await page.screenshot({path:path.join(out,'gym-live-660.png')});
 if(!release){const uploads=await page.evaluate(()=>window.riderRoadProjection.uploads);await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>window.riderRoadProjection.uploads),uploads,'Stationary preview repeatedly rebuilt meshes');}
 await menu();await action('apply');await durable();await sameRun(old);await action('close');await key('e');await page.waitForFunction(()=>window.riderEditing);await page.waitForTimeout(1000);const styled=await exported();
 assert.deepEqual(styled.editor.road_look.params,{version:1,mode:'perspective',width:2,perspective:1,angle:45,side:.25,shading:0});for(const k of ['chains','bounds','spawn','start_speed','hulls','labels','finish','two_sided'])assert.deepEqual(styled[k],collisionBaseline[k],k);
 r.checks.push({name:'legacy_660_menu_no_conversion_until_explicit_preview_apply_and_collision_unchanged',export:styled,telemetry:old});
 await durable();await page.reload();await page.waitForFunction(()=>window.riderEditing);await page.waitForTimeout(1000);assert.deepEqual((await exported()).editor.road_look,styled.editor.road_look);await playFromEditor();
 const resetBefore=await telemetry();await menu();await action('reset');await action('apply');await durable();await action('close');await sameRun(resetBefore);await key('e');await page.waitForFunction(()=>window.riderEditing);await page.waitForTimeout(1000);assert.deepEqual((await exported()).editor.road_look.params,{version:1,mode:'perspective',width:.9,perspective:.35,angle:28.810793742973,side:64,shading:1});
 r.checks.push({name:'gym_apply_acknowledged_reload_and_shared_reset'});
 if(!release){
  await require('../gym/editor_ui_target.cjs').reveal(page,'object_select_o2');let b=await page.evaluate(()=>window.riderEditor.buttons.object_select_o2);let sz=await size();await tap(b.x,sz.h-b.y);
  await playFromEditor();const localRun=await telemetry();await menu();sz=await size();await tap(sz.w-436+228,16+56);await number(0,1.8);await number(3,4);await number(4,.2);await action('apply');await durable();await sameRun(localRun);
  assert.equal(await page.evaluate(()=>window.riderRoadProjection.baked),true);assert.equal(await page.evaluate(()=>window.riderEditorDoc.objects.find(o=>o.id==='o2').road_look.width),1.8);
  await action('close');await key('r');await page.waitForFunction(n=>window.riderTelemetry.reset_count>n,localRun.reset_count);assert.equal((await telemetry()).session_generation,localRun.session_generation);
  await key('e');await page.waitForFunction(()=>window.riderEditing);await page.waitForTimeout(1000);const locals=await exported();assert.deepEqual(locals.editor.objects.find(o=>o.id==='o2').road_look,{version:1,width:1.8,side:4,shading:.2});for(const k of ['chains','bounds','spawn','start_speed','hulls','labels','finish','two_sided'])assert.deepEqual(locals[k],collisionBaseline[k],k);
  r.checks.push({name:'Gym_selected_source_sections_baked_live_apply_same_world_retry_and_collision',export:locals});
 }
 if(release)assert.deepEqual(await page.evaluate(()=>[typeof window.riderEditor,typeof window.riderEditorDoc,typeof window.riderRoadProjection,typeof window.riderRoadLook]),Array(4).fill('undefined'));
 assert.deepEqual(r.errors,[]);r.status='PASS';
}catch(e){r.status='FAIL';r.failure=e.stack;if(page){r.failure_state=await page.evaluate(()=>({editor:window.riderEditor,projection:window.riderRoadProjection,telemetry:window.riderTelemetry})).catch(()=>null);await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});}throw e;}finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(r,null,2)+'\n');if(browser)await browser.close();server?.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
