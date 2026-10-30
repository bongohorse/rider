// Actual release storage fault: a successful finish must not publish an unacknowledged unlock.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async function(browser,base,sha,out){
 const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[],report={source_sha:sha,status:'INCOMPLETE',real_device:'NOT RUN'};fs.mkdirSync(out,{recursive:true});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))errors.push(m.text());});
 try{
  await page.goto(new URL('index.html?station=first-run&touch=0',base).href);await page.waitForFunction(()=>window.riderRun?.state==='ready'&&window.riderLevels?.status==='saved'&&window.riderTelemetry?.sequence>2);assert.equal(await page.evaluate(()=>window.riderBuild),sha);
  await page.evaluate(()=>{FS.syncfs=(populate,cb)=>cb(new Error('intentional progress sync fault'));});
  await page.locator('canvas').focus();await page.keyboard.down('ArrowUp');await page.waitForFunction(()=>window.riderRun?.state==='finished',null,{timeout:45000});await page.keyboard.up('ArrowUp');await page.waitForFunction(()=>window.riderLevels.status==='Progress not saved');
  report.levels=await page.evaluate(()=>window.riderLevels);assert.equal(report.levels.courses[0].completed,false);assert.equal(report.levels.courses[1].unlocked,false);assert.equal(report.levels.next_enabled,false);
  await page.locator('#rider-level-actions').getByRole('button',{name:'Levels',exact:true}).click();await page.waitForFunction(()=>window.riderLevels.open);assert.equal(await page.locator('[data-course="rolling-hills"] button').isDisabled(),true);assert.match(await page.locator('#rider-levels .level-status').innerText(),/Progress not saved/);await page.screenshot({path:path.join(out,'progress-sync-failure.png')});assert.deepEqual(errors,[]);report.status='PASS';return report;
 }catch(e){report.status='FAIL';report.failure=e.stack;throw e;}finally{report.errors=errors;fs.writeFileSync(path.join(out,'level-storage-results.json'),JSON.stringify(report,null,2));await context.close();}
};
if(require.main===module){const {chromium}=require('playwright');const [base,sha,out]=process.argv.slice(2);(async()=>{const b=await chromium.launch();try{console.log(JSON.stringify(await module.exports(b,base,sha,out)));}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});}
