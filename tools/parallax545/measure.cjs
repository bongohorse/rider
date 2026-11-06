'use strict';
// #545: engine callback time, frame intervals, WebGL draw calls and explicit texture payload.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os'),crypto=require('node:crypto');
const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {chromium}=require('playwright'),{configure}=require('../gym/launch.cjs'),{stats}=require('../terrain_material/observe.cjs');
const [bundleArg,outArg]=process.argv.slice(2),bundle=path.resolve(bundleArg),out=path.resolve(outArg);
assert(bundleArg&&outArg,'Usage: node tools/parallax545/measure.cjs BUNDLE FRESH_OUT');
fs.mkdirSync(out,{recursive:true});assert.equal(fs.readdirSync(out).length,0,'Fresh output required');
const manifest=JSON.parse(fs.readFileSync(path.join(bundle,'bundle.json')));
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
execFileSync(process.env.RIDER_PYTHON||'python',['-c','import sys;sys.path.insert(0,"tools/gym");from bundle import verify_bundle;verify_bundle(sys.argv[1],sys.argv[2])',bundle,sha]);
const engine=JSON.parse(fs.readFileSync('tools/toolchain-lock.json')).engine;
const guard=JSON.parse(fs.readFileSync(path.join(bundle,'engines.json')));assert.equal(guard.status,'PASS');
const index=Object.keys(manifest.files).filter(f=>f.endsWith('index.html'));assert.equal(index.length,1);
const web=path.dirname(path.join(bundle,index[0]));
function probe(){
 const s=window.__p545={frames:[],draws:0,textures:new Map(),bindings:new Map(),units:new Map(),drawOrder:[],next:0,identity:null};
 for(const proto of [window.WebGLRenderingContext?.prototype,window.WebGL2RenderingContext?.prototype].filter(Boolean)){
  const active=proto.activeTexture;proto.activeTexture=function(unit){s.units.set(this,unit);return active.call(this,unit);};
  const bound=(gl,unit=s.units.get(gl)||gl.TEXTURE0)=>s.bindings.get(gl)?.get(unit);
  const create=proto.createTexture,del=proto.deleteTexture,bind=proto.bindTexture,tex=proto.texImage2D,mip=proto.generateMipmap;
  proto.createTexture=function(...a){const t=create.apply(this,a);s.textures.set(t,{id:++s.next,levels:{}});return t;};
  proto.deleteTexture=function(t){s.textures.delete(t);return del.call(this,t);};
  proto.bindTexture=function(target,t){if(!s.bindings.has(this))s.bindings.set(this,new Map());s.bindings.get(this).set(s.units.get(this)||this.TEXTURE0,t);return bind.call(this,target,t);};
  proto.texImage2D=function(...a){const result=tex.apply(this,a),t=s.textures.get(bound(this));
   if(t&&a.length>=9){t.levels[a[1]]={width:a[3],height:a[4],internal:a[2],format:a[6],type:a[7]};if(a[1]===0&&a[8]?.length){t.first_pixel=Array.from(a[8].slice(0,4));t.last_pixel=Array.from(a[8].slice(-4));}}
   return result;};
  proto.generateMipmap=function(...a){const t=s.textures.get(bound(this));if(t)t.generated_mipmap=true;return mip.apply(this,a);};
  for(const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced'])if(proto[name]){
   const draw=proto[name];proto[name]=function(...a){s.draws++;if(s.drawOrder.length<100)s.drawOrder.push(s.textures.get(bound(this,this.TEXTURE0))?.id??null);return draw.apply(this,a);};
  }
  const get=proto.getParameter;
  proto.getParameter=function(...a){if(!s.identity){const e=this.getExtension('WEBGL_debug_renderer_info');s.identity={renderer:e?get.call(this,e.UNMASKED_RENDERER_WEBGL):get.call(this,this.RENDERER),version:get.call(this,this.VERSION)};}return get.apply(this,a);};
 }
 const raf=window.requestAnimationFrame.bind(window);
 window.requestAnimationFrame=cb=>raf(t=>{const start=performance.now();s.draws=0;s.drawOrder=[];try{cb(t);}finally{s.frames.push({at:start,callback_ms:performance.now()-start,draws:s.draws,order:s.drawOrder});}});
}
(async()=>{let browser,server,page;
 const r={schema:1,issue:545,status:'INCOMPLETE',source_sha:sha,source_fingerprint:manifest.source_fingerprint,engine,viewport:[1280,720],dpr:1,
  host:{platform:os.platform(),release:os.release(),arch:os.arch(),cpu:os.cpus()[0].model,logical_cpus:os.cpus().length},
  protocol:{course:'first-run',warmup_ms:3000,sample_ms:5000,sequence:['idle 5 seconds','W held 5 seconds'],budget_ms:16.67,
   matrix:['mesh/0','sprites/0','mesh/3','sprites/3','mesh/6','sprites/6','mesh/6/hidden','sprites/6/hidden']},runs:[],errors:[],loaded_engines:[],
  limitations:['Software renderer is not physical GPU or phone evidence.','Callback time is CPU wall time, not GPU time.','Frame intervals include browser scheduling.','Texture bytes are explicit RGBA8 upload payload, not physical memory.','Hidden means hidden from startup; live hide/unload transitions are not measured.','Diagnostic art, not approved preset art.']};
 try{
  server=http.createServer((q,res)=>{const f=path.resolve(web,'.'+new URL(q.url,'http://localhost').pathname);if(!f.startsWith(web+path.sep)||!fs.existsSync(f)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',f.endsWith('.wasm')?'application/wasm':f.endsWith('.js')?'text/javascript':f.endsWith('.html')?'text/html':'application/octet-stream');fs.createReadStream(f).pipe(res);});
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));browser=await chromium.launch();r.browser=browser.version();
  // Freeze the plan after acquiring the first renderer, before its timing window.
  for(const [layers,hidden] of [[0,false],[3,false],[6,false],[6,true]])for(const route of ['mesh','sprites']){
   const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});page=await context.newPage();
   const pending=[];page.on('response',response=>{const name=new URL(response.url()).pathname.slice(1);if(name.endsWith('.wasm'))pending.push(response.body().then(bytes=>{const digest=crypto.createHash('sha256').update(bytes).digest('hex');assert.equal(digest,manifest.files[path.posix.join(path.dirname(index[0]),name)]);assert(Object.values(guard.architectures).flat().some(x=>x.bundled===name&&x.sha256===digest));r.loaded_engines.push({name,sha256:digest});}));});
   page.on('pageerror',e=>r.errors.push(e.message));page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))r.errors.push(m.text());});
   await configure(page,'parallax545','le6');await page.addInitScript(probe);
   await page.goto(`http://127.0.0.1:${server.address().port}/index.html?station=first-run&route=${route}&layers=${layers}&hidden=${hidden?1:0}`);
   await page.waitForFunction(()=>window.parallax545?.ready&&window.parallax545?.updates>90&&window.riderTelemetry?.sequence>30,null,{timeout:60000});
   assert.equal(await page.evaluate(()=>window.riderReady.source_sha),sha);await Promise.all(pending);assert(pending.length);
   const run={route,layers,hidden,samples:{}};if(!r.renderer){r.renderer=await page.evaluate(()=>window.__p545.identity);fs.writeFileSync(path.join(out,'plan.json'),JSON.stringify({...r,runs:[]},null,2)+'\n');}await page.waitForTimeout(r.protocol.warmup_ms);
   for(const phase of ['idle','drive']){
    if(phase==='drive'){await page.locator('canvas').focus();await page.keyboard.down('w');}
    const from=await page.evaluate(()=>window.__p545.frames.length);await page.waitForTimeout(r.protocol.sample_ms);
    const raw=await page.evaluate(n=>window.__p545.frames.slice(n),from);
    if(phase==='drive')await page.keyboard.up('w');assert(raw.length>60,'Insufficient frames');
    run.samples[phase]={callback_ms:stats(raw.map(x=>x.callback_ms)),interval_ms:stats(raw.slice(1).map((x,i)=>x.at-raw[i].at)),draw_calls:stats(raw.map(x=>x.draws)),raw};
   }
   run.end=await page.evaluate(()=>({probe:window.parallax545,camera:window.riderTelemetry,webgl:window.__p545.identity,textures:[...window.__p545.textures.values()]}));
   run.texture_payload_bytes=run.end.textures.reduce((sum,t)=>sum+Object.values(t.levels).reduce((s,l)=>s+l.width*l.height*({6406:1,6409:1,6410:2,6407:3,6408:4}[l.format]||NaN),0),0);
   await page.screenshot({path:path.join(out,`${route}-${layers}${hidden?'-hidden':''}.png`)});
   r.runs.push(run);console.log(route,layers,hidden?'hidden':'visible',JSON.stringify({cpu:run.samples.drive.callback_ms,draws:run.samples.drive.draw_calls}));
   assert.deepEqual(r.errors,[],'Engine/page errors');await context.close();page=null;
  }
  execFileSync(process.env.RIDER_PYTHON||'python',['-c','import sys;sys.path.insert(0,"tools/gym");from bundle import verify_bundle;verify_bundle(sys.argv[1],sys.argv[2])',bundle,sha]);
  r.status='MEASURED';
 }catch(e){r.status='FAIL';r.failure=e.stack;if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});}
 finally{fs.writeFileSync(path.join(out,'measurement.json'),JSON.stringify(r,null,2)+'\n');if(browser)await browser.close();if(server)await new Promise(ok=>server.close(ok));}
 if(r.status==='FAIL')process.exitCode=1;
})();
