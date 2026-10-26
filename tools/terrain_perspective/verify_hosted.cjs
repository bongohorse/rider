// Verify the served release and capture fixed/camera at one paused vehicle/camera pose.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const [url,sha,outArg]=process.argv.slice(2),out=path.resolve(outArg);fs.mkdirSync(out,{recursive:true});
(async()=>{let browser;const r={schema:1,status:'INCOMPLETE',source_sha:sha,url,errors:[]};try{
 browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>r.errors.push(e.message));
 await page.goto(url+'?course=long-curves&start=crest');await page.waitForFunction(()=>document.querySelector('#status').dataset.ready==='true',null,{timeout:65000});const frame=page.frames().find(f=>f.url().includes('/index.html'));
 await frame.waitForFunction(()=>window.riderTelemetry?.sequence>2);assert.equal(await frame.evaluate(()=>window.riderReady.source_sha),sha);
 await frame.locator('canvas').focus();await page.keyboard.down('Space');await frame.waitForFunction(()=>window.riderTimeState?.paused===true);await page.keyboard.up('Space');
 const before=await frame.evaluate(()=>window.riderTelemetry);r.before=before;
 for(const mode of ['fixed','perspective']){
  await page.locator('#mode-'+mode).click();await frame.waitForFunction(m=>window.riderRoadLook.current.mode===m,mode);await page.waitForTimeout(200);
  const t=await frame.evaluate(()=>window.riderTelemetry);assert.equal(await frame.evaluate(()=>window.riderTimeState.paused),true);assert.equal(t.session_generation,before.session_generation);assert.equal(t.station_distance,before.station_distance);assert.equal(t.pitch,before.pitch);
  await page.screenshot({path:path.join(out,mode+'.png')});r[mode]={look:await frame.evaluate(()=>window.riderRoadLook.current),telemetry:t};
 }
 assert.equal(await frame.evaluate(()=>typeof window.riderRoadProjection),'undefined');assert.deepEqual(r.errors,[]);r.status='PASS';
}catch(e){r.status='FAIL';r.failure=e.stack;throw e;}finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(r,null,2)+'\n');if(browser)await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
