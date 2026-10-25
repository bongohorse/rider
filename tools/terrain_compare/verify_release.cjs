// Focused release/interaction check for the isolated P1 preview. No debug engine overrides.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),pointer=require('../gym/pointer.cjs');
const [target,outArg,expected]=process.argv.slice(2),out=path.resolve(outArg);fs.mkdirSync(out,{recursive:true});
function find(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory()){const f=find(p);if(f)return f;}else if(e.name==='index.html')return p;}}
(async()=>{
 let server,browser;const errors=[],r={schema:1,status:'INCOMPLETE',switches:[],views:[],errors};
 try{
  let base=target;
  if(!/^https?:/.test(target)){
   const web=path.dirname(find(path.resolve(target)));server=http.createServer((q,res)=>{const file=path.resolve(web,'.'+new URL(q.url,'http://localhost').pathname);if(!file.startsWith(web+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.wasm')?'application/wasm':file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':'application/octet-stream');fs.createReadStream(file).pipe(res);});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));base='http://127.0.0.1:'+server.address().port+'/index.html';
  }
  browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1280,height:720}});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))errors.push(m.text());});
  async function ready(look){await page.waitForFunction(look=>window.riderTerrainCompare?.variant===look&&window.riderTelemetry?.sequence>2,look,{timeout:30000});const s=await page.evaluate(()=>({stats:window.riderTerrainCompare,telemetry:window.riderTelemetry,source_sha:window.riderReady.source_sha,debug_editor:typeof window.riderEditor,debug_world:typeof window.riderWorld}));assert.equal(s.debug_editor,'undefined');assert.equal(s.debug_world,'undefined');assert.equal(s.telemetry.preset,'a');assert.equal(s.telemetry.time_factor,1);assert.equal(s.telemetry.modified,false);if(expected)assert.equal(s.source_sha,expected);return s;}
  await page.goto(base+'?course=long-curves&look=flat&view=crest');r.initial=await ready('flat');r.source_sha=r.initial.source_sha;
  const labels={flat:'Flat fill',depth:'Top + edge + depth',sprites:'Original lines'};
  for(const look of ['depth','sprites','flat','depth','flat']){
   const at=await page.evaluate(()=>performance.timeOrigin+performance.now());const nav=page.waitForNavigation({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:labels[look],exact:true}).click();await nav;const state=await ready(look);r.switches.push({look,observed_ready_upper_ms:await page.evaluate(at=>performance.timeOrigin+performance.now()-at,at),state});
  }
  for(const view of ['climb','landing','valley']){
   const nav=page.waitForNavigation({waitUntil:'domcontentloaded'});await page.locator('#terrain-view').selectOption(view);await nav;const state=await ready('flat');assert.equal(state.stats.view,view);assert.equal(state.telemetry.terrain_shapes,696);r.views.push({view,state});await page.screenshot({path:path.join(out,'release-'+view+'.png')});
  }
  // R retains the world; E cannot enter or save the normal editor in this scene.
  await page.locator('canvas').focus();let before=await page.evaluate(()=>window.riderTelemetry);await page.keyboard.down('r');await page.waitForFunction(n=>window.riderTelemetry.reset_count>n,before.reset_count);await page.keyboard.up('r');await pointer.frames(page);const after=await page.evaluate(()=>window.riderTelemetry);assert.equal(after.session_generation,before.session_generation);assert.equal(after.world_loads,before.world_loads);
  await page.keyboard.down('e');await pointer.frames(page);await page.keyboard.up('e');await pointer.frames(page);assert.equal(await page.evaluate(()=>!!window.riderEditing),false);
  await page.keyboard.down('ArrowUp');await page.waitForFunction(()=>window.riderTelemetry.command.throttle===1);await page.keyboard.up('ArrowUp');await pointer.frames(page);
  r.final=await ready('flat');assert.equal(r.switches.length,5);assert.equal(r.views.length,3);assert.deepEqual(errors,[]);r.status='PASS';
 }catch(e){r.status='FAIL';r.failure=e.stack;throw e;}finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(r,null,2)+'\n');if(browser)await browser.close();server?.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
