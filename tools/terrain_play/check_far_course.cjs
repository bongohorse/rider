// Focused #277 last-section travel with a normally validated START, stock vehicle and Retry.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright'),{configure}=require('../gym/launch.cjs'),pointer=require('../gym/pointer.cjs');
const [bundleArg,outArg]=process.argv.slice(2),bundle=path.resolve(bundleArg),out=path.resolve(outArg);fs.mkdirSync(out,{recursive:true});
const sha=JSON.parse(fs.readFileSync(path.join(bundle,'bundle.json'))).source_sha;
execFileSync('python',['-c','import sys;sys.path.insert(0,"tools/gym");from bundle import verify_bundle;verify_bundle(sys.argv[1],sys.argv[2])',bundle,sha]);
const r={schema:1,status:'INCOMPLETE',source_sha:sha,errors:[],views:[]};
(async()=>{let browser,server,page;try{
 const web=path.join(bundle,'RiderG1');server=http.createServer((q,res)=>{const f=path.resolve(web,'.'+new URL(q.url,'http://localhost').pathname);if(!f.startsWith(web+path.sep)||!fs.existsSync(f)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',f.endsWith('.wasm')?'application/wasm':f.endsWith('.js')?'text/javascript':'text/html');fs.createReadStream(f).pipe(res);});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 browser=await chromium.launch();page=await browser.newPage({viewport:{width:1280,height:720}});await configure(page,'p5-far-course','le1b');
 page.on('pageerror',e=>r.errors.push(e.message));page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))r.errors.push(m.text());});
 await page.goto('http://127.0.0.1:'+server.address().port+'/index.html?station=straight');await page.waitForFunction(()=>window.riderTelemetry?.sequence>2);
 const d=JSON.parse(fs.readFileSync('docs/terrain-p5/mixed-over-budget.json'));const x=488;let ground;
 for(const c of d.chains)for(let i=1;i<c.length;i++){const a=c[i-1],b=c[i];if(Math.min(a[0],b[0])<=x&&x<=Math.max(a[0],b[0]))ground=a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);}
 assert.ok(Number.isFinite(ground));d.spawn=[x,ground+.9];d.start_speed=7;d.editor.start={position:d.spawn,speed:7};r.start=d.spawn;assert.ok(d.spawn.every(n=>Math.abs(n)<=500));
 const generation=await page.evaluate(()=>window.riderTelemetry.session_generation);
 await page.evaluate(body=>{window.riderCustom.open();document.querySelector('#rider-custom-text').value=body;[...document.querySelectorAll('#rider-custom-panel button')].find(b=>b.textContent==='Import text').click();},JSON.stringify(d));
 await page.waitForFunction(n=>window.riderCustomStatus==='Saved'&&window.riderTelemetry?.session_generation>n&&window.riderTelemetry.sequence>2,generation);await page.locator('canvas').focus();
 await page.keyboard.down('ArrowUp');
 for(let i=0;i<300;i++){
  await page.waitForTimeout(100);const s=await page.evaluate(()=>({telemetry:window.riderTelemetry,resources:window.riderTerrainResources}));r.views.push(s);
  for(const e of s.resources.entries){const a=e.bounds,b=s.resources.view;if(a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1])assert.ok(e.allocated&&e.enabled,'Missing section along far travel');}
  assert.equal(s.telemetry.terrain_shapes,1028);assert.equal(s.telemetry.reset_count,0,'Unrequested bounds reset');
  if(s.telemetry.station_distance>172)break;
 }
 await page.keyboard.up('ArrowUp');r.end=await page.evaluate(()=>window.riderTelemetry);assert.ok(r.end.station_distance>172,'Did not reach the 660 m course end');
 await page.screenshot({path:path.join(out,'far-end.png')});await page.keyboard.down('r');await page.waitForFunction(n=>window.riderTelemetry.reset_count>n,r.end.reset_count);await page.keyboard.up('r');await pointer.frames(page);
 r.retry=await page.evaluate(()=>window.riderTelemetry);assert.equal(r.retry.session_generation,r.end.session_generation);assert.equal(r.retry.world_loads,r.end.world_loads);assert.deepEqual(r.errors,[]);r.status='PASS';
}catch(e){r.status='FAIL';r.failure=e.stack;if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw e;}finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(r,null,2)+'\n');if(browser)await browser.close();server?.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
