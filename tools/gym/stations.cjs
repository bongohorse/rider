const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
(async()=>{
 const [root,sha]=process.argv.slice(2);const out=path.resolve(root);let browser;
 function find(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()){const v=find(p);if(v)return v;}else if(e.name==='index.html')return p;}}
 const web=path.dirname(find(out)),errors=[],cases=[];
 const server=http.createServer((req,res)=>{const file=path.resolve(web,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(web+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',file.endsWith('.wasm')?'application/wasm':file.endsWith('.js')?'text/javascript':'text/html');fs.createReadStream(file).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1280,height:720}});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))errors.push(m.text());});
  const url='http://127.0.0.1:'+server.address().port+'/index.html';
  await page.goto(url+'?station=straight&speed=8');
  await page.waitForFunction(expected=>window.riderReady?.source_sha===expected&&window.riderTelemetry?.sequence>2,sha);
  async function state(){return page.evaluate(()=>window.riderTelemetry);}
  let t=await state();assert.equal(t.station,'straight');assert.equal(t.start_speed,8);assert(Math.abs(t.first_tick_speed-8)<=.2);assert(Math.abs(t.first_tick_omega+8/.22)<.5);cases.push('8mps_first_completed_tick');
  let n=t.reset_count;await page.keyboard.down('r');await page.waitForFunction(n=>window.riderTelemetry.reset_count===n+1,n);await page.keyboard.up('r');
  t=await state();assert.equal(t.start_speed,8);assert(Math.abs(t.first_tick_speed-8)<=.2);assert.equal(t.world_loads,1);cases.push('moving_retry_without_reload');
  async function select(key,id,loads){await page.keyboard.down(key);await page.waitForFunction(({id,loads})=>window.riderTelemetry.station===id&&window.riderTelemetry.world_loads===loads,{id,loads});await page.keyboard.up(key);await page.waitForFunction(()=>window.riderTelemetry.sequence>2);}
  await page.keyboard.down('ArrowUp');await page.waitForFunction(()=>window.riderTelemetry.command.throttle===1);
  await select('2','straight-test',2);await page.keyboard.up('ArrowUp');t=await state();assert.equal(t.command.throttle,0);assert.equal(t.start_speed,5);assert.equal(t.terrain_shapes,2);assert.equal(t.session_generation,2);assert(Math.abs(t.first_tick_speed-5)<=.2);cases.push('switch_clears_held_input_and_hulls_load');
  await select('1','straight',3);t=await state();assert.equal(t.start_speed,0);assert.equal(t.reset_count,0);cases.push('A_B_A_fresh_world');
  // Invalid files stay in the current world and produce a GUI diagnostic.
  await page.keyboard.down('3');await page.waitForFunction(()=>window.riderStationError?.includes('schema'));await page.keyboard.up('3');
  assert.equal((await state()).world_loads,3);cases.push('invalid_schema_visible_no_reload');
  await page.keyboard.down('ArrowUp');await page.waitForFunction(()=>window.riderTelemetry.station_top_speed>3);await page.keyboard.up('ArrowUp');
  await page.keyboard.down('ArrowDown');await page.waitForFunction(()=>window.riderTelemetry.station_brake_distance>.1);await page.keyboard.up('ArrowDown');
  assert((await page.evaluate(()=>window.riderFeedback.text)).includes('Start speed:'));cases.push('distance_top_braking_feedback');
  await page.screenshot({path:path.join(out,'stations.png')});
  await page.goto(url+'?station=unknown&speed=NaN');await page.waitForFunction(()=>window.riderTelemetry?.sequence>2&&window.riderTelemetry.station_note.includes('Invalid speed'));
  t=await state();assert.equal(t.station,'straight');assert.equal(t.start_speed,0);cases.push('invalid_url_fallback');
  if(errors.length)throw Error(errors.join('\n'));
  fs.writeFileSync(path.join(out,'stations-result.json'),JSON.stringify({source_sha:sha,status:'PASS',cases},null,2));console.log(JSON.stringify({status:'PASS',cases}));
 }catch(e){if(browser)for(const context of browser.contexts())for(const page of context.pages())await page.screenshot({path:path.join(out,'stations-failed.png')}).catch(()=>{});throw e;}
 finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
