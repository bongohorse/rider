// Release real-input loop and acknowledged IndexedDB reopen; no injected physics or scoring commands.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),pointer=require('../gym/pointer.cjs');
module.exports=async function check(browser,base,sha,out){
 const context=await browser.newContext({viewport:{width:1280,height:720}});let page;const errors=[],checks=[];
 const report={source_sha:sha,status:'INCOMPLETE',real_device:'NOT RUN',checks,errors};
 async function open(){page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))errors.push(m.text());});await page.goto(new URL('index.html?station=first-run&touch=0',base).href);await page.waitForFunction(()=>window.riderRun?.state==='ready'&&window.riderTelemetry?.sequence>2);assert.equal(await page.evaluate(()=>window.riderBuild),sha);}
 async function key(k){await page.locator('canvas').focus();await page.keyboard.down(k);await pointer.frames(page,{n:4});await page.keyboard.up(k);await pointer.frames(page,{n:4});}
 const state=()=>page.evaluate(()=>window.riderRun);
 async function retryButton(){const p=await page.evaluate(()=>{const c=document.querySelector('canvas'),r=c.getBoundingClientRect(),p=window.riderRunUI.retry;return {x:r.x+p.x/c.width*r.width,y:r.y+(1-p.y/c.height)*r.height};});await pointer.tap(page,p);await page.waitForFunction(()=>window.riderRun.state==='ready');}
 async function drive(){await page.keyboard.down('ArrowUp');await page.waitForFunction(()=>['finished','failed'].includes(window.riderRun?.state),null,{timeout:45000});await page.keyboard.up('ArrowUp');assert.equal((await state()).state,'finished');}
 try{
  await open();assert.equal((await state()).official,true);await page.waitForTimeout(2500);assert.equal((await state()).time,0);
  const start=await page.evaluate(()=>window.riderTelemetry.station_distance);assert.ok(Math.abs(start)<.1,'Ready staging pad drift');
  await page.screenshot({path:path.join(out,'run-ready.png')});
  await page.keyboard.down('ArrowUp');await page.waitForFunction(()=>window.riderRun.state==='running'&&window.riderRun.time>1);await key('Space');await page.waitForFunction(()=>window.riderRun.state==='paused');await page.keyboard.up('ArrowUp');
  const paused=await state();await page.waitForTimeout(500);assert.equal((await state()).time,paused.time);await key('Space');await page.waitForFunction(()=>window.riderRun.state==='running');
  checks.push({name:'ready-flat-start-and-pause-resume',paused});
  // Focus loss uses the same acknowledged proxy pause, with explicit resume and cleared keys.
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.waitForFunction(()=>window.riderRun.state==='paused');const bg=await state();await page.waitForTimeout(300);assert.equal((await state()).time,bg.time);await key('Space');await page.waitForTimeout(1800);
  await drive();await page.waitForFunction(()=>window.riderRun.save==='saved'&&window.riderRun.best>0);const first=await state();assert.equal(first.time,first.best);const finishCount=await page.evaluate(()=>window.riderTelemetry.finish_count);await page.waitForFunction(()=>window.riderTimeState.paused);const stopped=await page.evaluate(()=>window.riderTelemetry.station_distance);await page.waitForTimeout(600);assert.equal(await page.evaluate(()=>window.riderTelemetry.station_distance),stopped);assert.equal((await state()).time,first.time);assert.equal(await page.evaluate(()=>window.riderTelemetry.finish_count),finishCount);
  await page.screenshot({path:path.join(out,'run-finished.png')});checks.push({name:'directed-finish-once-unrounded-best-acknowledged',first});
  const generation=await page.evaluate(()=>window.riderTelemetry.session_generation);await retryButton();await page.waitForFunction(id=>window.riderRun.state==='ready'&&window.riderRun.id!==id,first.id);assert.equal(await page.evaluate(()=>window.riderTelemetry.session_generation),generation);assert.equal((await state()).best,first.best);
  // Slower valid finish cannot downgrade the acknowledged best.
  await page.keyboard.down('ArrowUp');await page.waitForFunction(()=>window.riderRun.time>.3);await page.keyboard.up('ArrowUp');await page.waitForTimeout(4000);await drive();await page.waitForFunction(()=>window.riderRun.save==='saved');assert.equal((await state()).best,first.best);assert.equal((await state()).new_best,false);checks.push({name:'same-world-retry-and-slower-finish-no-downgrade',state:await state()});
  await page.close();await open();assert.equal((await state()).best,first.best);checks.push({name:'close-reopen-loads-acknowledged-best',state:await state()});
  // Tune the real native look menu at READY. Appearance must not change scoring identity/world.
  const cosmetic=await page.evaluate(()=>({id:window.riderRun.id,generation:window.riderTelemetry.session_generation,shapes:window.riderTelemetry.terrain_shapes}));
  async function tapCanvas(x,y){const p=await page.locator('canvas').evaluate((c,p)=>{const r=c.getBoundingClientRect();return {x:r.x+p.x/c.width*r.width,y:r.y+p.y/c.height*r.height};},{x,y});await pointer.tap(page,p);await pointer.frames(page,{n:6});}
  const size=await page.locator('canvas').evaluate(c=>({w:c.width,h:c.height}));
  await tapCanvas(616,size.h-40);await tapCanvas(size.w-436+316,16+104+12);await page.keyboard.type('1.2');await key('Enter');
  const footer=16+Math.min(580,size.h-96)-22;await tapCanvas(size.w-436+148,footer);await tapCanvas(size.w-436+344,footer);
  assert.equal((await state()).official,true);assert.equal((await state()).id,cosmetic.id);assert.equal(await page.evaluate(()=>window.riderTelemetry.session_generation),cosmetic.generation);assert.equal(await page.evaluate(()=>window.riderTelemetry.terrain_shapes),cosmetic.shapes);
  checks.push({name:'native-terrain-look-apply-preserves-official-identity-and-world',state:await state()});
  // Custom preset/assists are practice for the entire attempt, even if changed back.
  await key('c');await key('c');await page.waitForFunction(()=>!window.riderRun.official);await drive();assert.equal((await state()).best,first.best);assert.equal((await state()).official,false);checks.push({name:'changed-assists-practice-cannot-overwrite',state:await state()});
  await key('r');await page.waitForFunction(()=>window.riderRun.state==='ready');
  await key('e');await page.waitForFunction(()=>window.riderEditing===true);await key('e');
  await page.waitForFunction(()=>window.riderEditing===false&&window.riderTelemetry?.custom===true&&window.riderTelemetry.sequence>2);
  assert.equal(await state(),null);checks.push({name:'editor-play-is-custom-and-has-no-official-scoring-authority'});
  await page.close();await open();assert.equal((await state()).best,first.best);
  await page.evaluate(()=>{const sync=FS.syncfs;window.restoreRunSync=()=>FS.syncfs=sync;FS.syncfs=function(populate,cb){if(!populate){setTimeout(()=>{Module._syncTries=0;cb(new Error('injected record sync failure'));},0);return;}return sync.apply(this,arguments);};});
  await drive();assert.ok((await state()).time<first.best,'Fault run must improve the old best');
  await page.waitForFunction(()=>window.riderRun.save.includes('not saved'));assert.equal((await state()).best,first.best);
  assert.ok(!(await page.evaluate(()=>window.riderRunUI.detail)).includes('New personal best - saved'));
  checks.push({name:'failed-browser-sync-keeps-last-acknowledged-best',state:await state()});await page.evaluate(()=>window.restoreRunSync());
  assert.deepEqual(errors,[]);report.status='PASS';return report;
 }catch(e){report.status='FAIL';report.failure=e.stack;if(page){report.state=await state().catch(()=>null);await page.screenshot({path:path.join(out,'run-failure.png')}).catch(()=>{});}throw e;
 }finally{fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'run-results.json'),JSON.stringify(report,null,2));await context.close();}
};
if(require.main===module){const {chromium}=require('playwright');const [base,sha,out]=process.argv.slice(2);fs.mkdirSync(out,{recursive:true});(async()=>{const b=await chromium.launch();try{console.log(JSON.stringify(await module.exports(b,base,sha,out)));}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});}
