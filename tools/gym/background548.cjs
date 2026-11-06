'use strict';
// #548: authored background import/save/reopen and actual resources in both proxied worlds.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{configure}=require('./launch.cjs');
const EXPECTED=['legacy_empty','imported_play','edit_agreement','saved_reload','master_off_restore','foreground_603'];
async function main(){
 const [output,sha,runId,kind,bundleArg]=process.argv.slice(2);assert.equal(kind,'bg548');
 const out=path.resolve(output),bundle=path.resolve(bundleArg);fs.mkdirSync(out,{recursive:true});
 const manifest=JSON.parse(fs.readFileSync(path.join(bundle,'bundle.json')));assert.equal(manifest.source_sha,sha);
 const indexes=Object.keys(manifest.files).filter(x=>x.endsWith('/index.html')||x==='index.html');assert.equal(indexes.length,1);
 const web=path.dirname(path.join(bundle,indexes[0]));let browser,page,server;
 const report={schema_version:1,source_sha:sha,run_id:runId,status:'FAIL',cases:{},errors:[],not_run:['physical device','art acceptance','editor background controls']};
 try{
  server=http.createServer((req,res)=>{const file=path.resolve(web,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(web+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.wasm')?'application/wasm':file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':'application/octet-stream');fs.createReadStream(file).pipe(res);});
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));browser=await chromium.launch();report.browser=browser.version();
  page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});await configure(page,runId,kind);await page.addInitScript(require('./foreground603.cjs').observe);
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))report.errors.push(m.text());});
  const base=`http://127.0.0.1:${server.address().port}/index.html`;
  await page.goto(base+'?station=straight');
  await page.waitForFunction(()=>window.riderBackgroundState?.generation&&window.riderTelemetry?.sequence>2,null,{timeout:60000});
  const state=()=>page.evaluate(()=>window.riderBackgroundState);
  let r=await state();assert.equal(r.objects,0);assert.equal(r.texture_bytes,0);report.cases.legacy_empty=r;
  const fixture=JSON.parse(fs.readFileSync('tests/gameplay/level-fixtures/terrain-p0/six-anchor.json'));
  const source={version:1,preset:'meadow',enabled:true,layers:[.9,.75,.27,.35,.15,-.1].map((depth,i)=>({visible:i!==1,auto:i!==2,depth}))};
  source.layers[3].image={preset:'city',hash:'a'.repeat(64)};
  fixture.schema=7;fixture.backgrounds=source;fixture.editor.backgrounds=structuredClone(source);
  fixture.editor.editor_version=fixture.editor.compiler_version=15;
  async function load(){
   const old=(await state()).generation;
   await page.evaluate(()=>window.riderCustom.open());
   await page.locator('#rider-custom-text').fill(JSON.stringify(fixture));
   await page.getByRole('button',{name:'Import text',exact:true}).click();
   await page.waitForFunction(g=>window.riderCustomStatus==='Saved'&&window.riderBackgroundState?.generation>g&&window.riderTelemetry?.session_generation===window.riderBackgroundState.generation&&window.riderTelemetry?.sequence>2,old,{timeout:30000});
   return state();
  }
  function selected(s,objects=5){
   assert.equal(s.source_sha,sha);assert.equal(s.run_id,runId);assert.equal(s.objects,objects);assert.equal(s.textures,objects);assert.equal(s.texture_bytes,objects*1024*512*4);
   assert.deepEqual(s.source,source);assert.equal(s.layers[1].visible,false);assert.equal(s.layers[2].auto,false);assert.equal(s.layers[2].depth,.27);assert.match(s.warning,/missing/);
  }
  r=await load();selected(r);assert.equal(r.edit,false);assert.match(await page.evaluate(()=>window.riderTelemetry.station_note),/Local background image missing/);report.cases.imported_play=r;await page.screenshot({path:path.join(out,'play.png')});
  async function key(name){await page.keyboard.down(name);await page.waitForTimeout(100);await page.keyboard.up(name);await page.waitForTimeout(100);}
  await key('e');await page.waitForFunction(()=>window.riderEditor?.mode==='edit'&&window.riderBackgroundState?.edit&&window.riderBackgroundState?.objects===5,null,{timeout:30000});
  r=await state();selected(r);assert.match(await page.evaluate(()=>window.riderEditor.message),/Local background image missing/);report.cases.edit_agreement=r;await page.screenshot({path:path.join(out,'edit.png')});
  await page.goto(base+'?station=custom');await page.waitForFunction(id=>window.riderTelemetry?.station===id&&window.riderTelemetry?.sequence>2&&window.riderBackgroundState?.objects===5,fixture.id,{timeout:60000});
  r=await state();selected(r);assert.equal(r.edit,false);report.cases.saved_reload=r;
  source.enabled=false;fixture.editor.backgrounds=structuredClone(source);r=await load();selected(r,0);assert.equal(r.buffers,0);
  const off=r;source.enabled=true;fixture.editor.backgrounds=structuredClone(source);r=await load();selected(r);
  report.cases.master_off_restore={off,on:r};
  report.cases.foreground_603=await require('./foreground603.cjs').run(page,out,state);
  assert.deepEqual(report.errors,[]);assert.deepEqual(Object.keys(report.cases),EXPECTED);report.status='PASS';
 }catch(e){report.failure=e.stack;if(page)report.pixel_diagnostic=await page.evaluate(()=>window.riderForegroundPixels||null).catch(()=>null);if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});}
 finally{fs.writeFileSync(path.join(out,'background548-result.json'),JSON.stringify(report,null,2)+'\n');if(browser)await browser.close();if(server)await new Promise(ok=>server.close(ok));}
 console.log(JSON.stringify({status:report.status,cases:Object.keys(report.cases),failure:report.failure}));return report.status==='PASS'?0:1;
}
module.exports={EXPECTED};if(require.main===module)main().then(code=>process.exitCode=code).catch(e=>{console.error(e);process.exitCode=1;});
