// Focused real-engine resource comparison; records WebGL handle sizes, not GPU memory or duration.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright'),{configure}=require('../gym/launch.cjs'),pointer=require('../gym/pointer.cjs');
const [bundleArg,outArg,mode]=process.argv.slice(2),bundle=path.resolve(bundleArg),out=path.resolve(outArg);fs.mkdirSync(out,{recursive:true});
const manifest=JSON.parse(fs.readFileSync(path.join(bundle,'bundle.json'))),sha=manifest.source_sha;
execFileSync('python',['-c','import sys;sys.path.insert(0,"tools/gym");from bundle import verify_bundle;verify_bundle(sys.argv[1],sys.argv[2])',bundle,sha]);
function find(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory()){const f=find(p);if(f)return f;}else if(e.name==='index.html')return p;}}
function probe(){const p=window.__buffers={live:new Map(),created:0,deleted:0};
 for(const proto of [window.WebGLRenderingContext?.prototype,window.WebGL2RenderingContext?.prototype].filter(Boolean)){
  const bound=new Map(),create=proto.createBuffer,del=proto.deleteBuffer,bind=proto.bindBuffer,data=proto.bufferData;
  proto.createBuffer=function(...a){const b=create.apply(this,a);p.created++;p.live.set(b,0);return b;};
  proto.deleteBuffer=function(b){if(p.live.delete(b))p.deleted++;return del.call(this,b);};
  proto.bindBuffer=function(t,b){bound.set(t,b);return bind.call(this,t,b);};
  proto.bufferData=function(t,d,...a){const b=bound.get(t);if(b)p.live.set(b,typeof d==='number'?d:a.length>=3?a[2]*(d.BYTES_PER_ELEMENT||1):a.length>=2?(d.length-a[1])*(d.BYTES_PER_ELEMENT||1):d?.byteLength||0);return data.call(this,t,d,...a);};
 }
}
(async()=>{let browser,server;const r={schema:1,status:'INCOMPLETE',source_sha:sha,mode,loads:[],errors:[]};try{
 const web=path.dirname(find(bundle));server=http.createServer((q,res)=>{const f=path.resolve(web,'.'+new URL(q.url,'http://localhost').pathname);if(!f.startsWith(web+path.sep)||!fs.existsSync(f)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',f.endsWith('.wasm')?'application/wasm':f.endsWith('.html')?'text/html':'application/octet-stream');fs.createReadStream(f).pipe(res);});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1280,height:720}});await configure(page,'terrain-resource','le1b');await page.addInitScript(probe);
 page.on('pageerror',e=>r.errors.push(e.message));page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))r.errors.push(m.text());});
 await page.goto('http://127.0.0.1:'+server.address().port+'/index.html?station=straight');await page.waitForFunction(()=>window.riderTelemetry?.sequence>2);
 assert.equal(await page.evaluate(()=>window.riderReady.source_sha),sha);
 const body=fs.readFileSync('docs/terrain-p0/six-anchor.json','utf8');
 for(let i=0;i<8;i++){
  const before=await page.evaluate(()=>window.riderTelemetry.session_generation);
  await page.evaluate(body=>{window.riderCustom.open();document.querySelector('#rider-custom-text').value=body;[...document.querySelectorAll('#rider-custom-panel button')].find(x=>x.textContent==='Import text').click();},body);
  await page.waitForFunction(n=>window.riderCustomStatus==='Saved'&&window.riderTelemetry?.session_generation>n&&window.riderTelemetry.sequence>2,before);
  await pointer.frames(page,{n:5});
  r.loads.push(await page.evaluate(()=>{const p=window.__buffers,h={};for(const size of p.live.values())h[size]=(h[size]||0)+1;return {generation:window.riderTelemetry.session_generation,mesh:window.riderTerrainMesh,lifecycle:window.riderTerrainMeshLifecycle,webgl:{created:p.created,deleted:p.deleted,live:p.live.size,histogram:h}};}));
 }
 // Current mesh VBs have exactly their interleaved source payload size. None from prior worlds may accumulate.
 if(mode==='mesh')for(const [i,x] of r.loads.entries()){
  assert.equal(x.lifecycle.owned,11);assert.equal(x.webgl.histogram[41472],9);assert.equal(x.webgl.histogram[41688],1);assert.equal(x.webgl.histogram[17064],1);
  // Existing reference teardown grows by one 16-byte and one 64-byte scratch UBO per switch.
  // Keeping the shared terrain material resident must add no extra per-switch UBO growth.
  for(const size of [16,64])assert.ok((x.webgl.histogram[size]||0)<=(r.loads[0].webgl.histogram[size]||0)+i,'Additional shader-buffer growth at '+size+' bytes');
 }
 assert.equal(r.loads.length,8);assert.deepEqual(r.errors,[]);r.status='PASS';
}catch(e){r.status='FAIL';r.failure=e.stack;throw e;}finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(r,null,2)+'\n');if(browser)await browser.close();server?.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
