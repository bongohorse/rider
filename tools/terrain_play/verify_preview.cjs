// Bounded release QA of the artifact launcher and ordinary Play; no debug settings or engine API.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const [base,outArg,expected]=process.argv.slice(2),out=path.resolve(outArg);fs.mkdirSync(out,{recursive:true});
const r={schema:1,status:'INCOMPLETE',source_sha:expected,views:[],switches:[],errors:[]};
(async()=>{let browser;try{
 browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1280,height:720}});
 page.on('pageerror',e=>r.errors.push(e.message));page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))r.errors.push(m.text());});
 async function ready(){
  await page.waitForFunction(()=>document.getElementById('state')?.textContent==='Ready · normal Play',null,{timeout:65000});
  const frame=page.frames().find(f=>f.url().includes('/index.html'));
  const s=await frame.evaluate(()=>({ready:window.riderReady,telemetry:window.riderTelemetry,debug:[typeof window.riderWorld,typeof window.riderEditor,typeof window.riderTerrainMesh,typeof window.riderTerrainCompare,typeof window.riderEditorMesh]}));
  assert.equal(s.ready.source_sha,expected);assert.deepEqual(s.debug,['undefined','undefined','undefined','undefined','undefined']);
  assert.equal(s.telemetry.preset,'a');assert.equal(s.telemetry.time_factor,1);assert.equal(s.telemetry.modified,false);
  return {frame,s};
 }
 for(const [course,view] of [['six-anchor','start'],['long-curves','crest'],['long-curves','descent'],['long-curves','jump'],['long-curves','landing'],['long-curves','valley'],['mixed','start']]){
  await page.goto(base+'/terrain-preview.html?course='+course+'&view='+view);const {frame,s}=await ready();
  assert.equal(s.telemetry.terrain_shapes,course==='six-anchor'?666:course==='mixed'?708:696);
  await page.screenshot({path:path.join(out,course+'-'+view+'.png')});r.views.push({course,view,state:s});
 }
 let {frame,s}=await ready();await frame.locator('canvas').focus();await page.waitForTimeout(1100);
 await page.keyboard.down('ArrowUp');await frame.waitForFunction(()=>window.riderTelemetry.command.throttle===1);await page.keyboard.up('ArrowUp');
 let before=await frame.evaluate(()=>window.riderTelemetry);
 await page.keyboard.down('r');await frame.waitForFunction(n=>window.riderTelemetry.reset_count>n,before.reset_count);await page.keyboard.up('r');
 let after=await frame.evaluate(()=>window.riderTelemetry);assert.equal(after.session_generation,before.session_generation);assert.equal(after.world_loads,before.world_loads);
 // The normal editor remains available, drawing its previous line view. This is not mesh editor integration.
 await page.keyboard.down('e');await frame.waitForFunction(()=>window.riderEditing===true);await page.keyboard.up('e');
 if(process.argv.includes('--editor')){
  await page.waitForTimeout(600);await page.keyboard.down('Home');await page.waitForTimeout(120);await page.keyboard.up('Home');await page.waitForTimeout(200);
  assert.equal(await frame.evaluate(()=>window.riderEditing),true);
  await page.screenshot({path:path.join(out,'editor-mixed.png')});
  await page.setViewportSize({width:1280,height:480});await page.waitForTimeout(150);await page.screenshot({path:path.join(out,'editor-short.png')});
  await page.setViewportSize({width:1280,height:720});
  await page.keyboard.down('Control');await page.keyboard.down('s');await page.waitForTimeout(150);await page.keyboard.up('s');await page.keyboard.up('Control');
  r.editor={entered:true,view_only_home:true,save_shortcut_sent:true,debug_mesh:await frame.evaluate(()=>typeof window.riderEditorMesh)};
 }
 await page.waitForTimeout(300);await page.keyboard.down('e');await frame.waitForFunction(n=>!window.riderEditing&&window.riderTelemetry.session_generation>n,before.session_generation);await page.keyboard.up('e');
 await frame.waitForFunction(()=>window.riderTelemetry.sequence>2);assert.equal((await frame.evaluate(()=>window.riderTelemetry)).terrain_shapes,708);
 // Real keyboard A→B→A proxy switches, in the same engine instance.
 for(const [key,id] of [['1','straight'],['2','ramps'],['1','straight']]){
  const generation=await frame.evaluate(()=>window.riderTelemetry.session_generation);
  await page.keyboard.down(key);await frame.waitForFunction(({id,generation})=>window.riderTelemetry.station===id&&window.riderTelemetry.session_generation>generation&&window.riderTelemetry.sequence>2,{id,generation});await page.keyboard.up(key);
  r.switches.push(await frame.evaluate(()=>window.riderTelemetry));
 }
 await page.setViewportSize({width:1280,height:480});await page.screenshot({path:path.join(out,'short-desktop.png')});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'portrait.png')});
 assert.equal(r.views.length,7);assert.equal(r.switches.length,3);assert.deepEqual(r.errors,[]);r.status='PASS';
}catch(e){r.status='FAIL';r.failure=e.stack;throw e;}finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(r,null,2)+'\n');if(browser)await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
