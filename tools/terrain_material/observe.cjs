// #392 Stage A observer: untextured vs textured (Grass -> Stone) terrain on one real course in the debug Gym.
// Real Defold HTML5 debug build, headless Chromium. Measures WebGL vertex-buffer bytes per terrain section against
// vertex counts computed here from the station JSON, frame intervals, Play and Edit (Fit) screenshots.
// Visual evidence only: no physics, source or camera injection. Not part of `required`; run locally:
//   node tools/terrain_material/observe.cjs <verified debug Gym bundle> <out dir> [station] [spec]
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const STATION_DEFAULT='first-run',SPEC_DEFAULT='grass,stone@40';
// Mirrors main/game/terrain_geometry.lua describe(): 64 intervals per section, 18 vertices each, 6 per real run end.
function sectionVertices(chains){
 const out=[];
 for(const c of chains){const n=c.length;for(let first=1;first<=n-1;first+=64){const last=Math.min(first+64,n);out.push((last-first)*18+(first===1?6:0)+(last===n?6:0));}}
 return out;
}
const stats=v=>{if(!v.length)return null;const a=[...v].sort((x,y)=>x-y),q=f=>a[Math.max(0,Math.ceil(a.length*f)-1)];return {n:a.length,p50:q(.5),p95:q(.95),max:a.at(-1),mean:a.reduce((s,x)=>s+x,0)/a.length};};
function probe(){
 const p=window.__mat={uploads:[],frames:[],textures:[],mipmaps:0};
 for(const proto of [window.WebGLRenderingContext?.prototype,window.WebGL2RenderingContext?.prototype].filter(Boolean)){
  const data=proto.bufferData,tex=proto.texImage2D,mip=proto.generateMipmap;
  // Record texture uploads of at least 256 px (the atlas), with level and format; generateMipmap calls are counted.
  proto.texImage2D=function(...a){if(a.length>=9&&a[3]>=256&&a[4]>=256)p.textures.push({level:a[1],internal_format:a[2],width:a[3],height:a[4],format:a[6],type:a[7]});return tex.apply(this,a);};
  proto.generateMipmap=function(...a){p.mipmaps++;return mip.apply(this,a);};
  proto.bufferData=function(t,d,...a){const bytes=typeof d==='number'?d:a.length>=3?a[2]*(d.BYTES_PER_ELEMENT||1):a.length>=2?(d.length-a[1])*(d.BYTES_PER_ELEMENT||1):d?.byteLength||0;if(t===0x8892)p.uploads.push(bytes);return data.call(this,t,d,...a);};
 }
 const raf=window.requestAnimationFrame.bind(window);
 window.requestAnimationFrame=cb=>raf(t=>{p.frames.push(performance.now());return cb(t);});
}
module.exports={sectionVertices,stats};
if(require.main===module){
 const {chromium}=require('playwright');
 const {configure}=require('../gym/launch.cjs'),pointer=require('../gym/pointer.cjs');
 const [bundleArg,outArg,stationArg,specArg]=process.argv.slice(2);
 if(!bundleArg||!outArg)throw Error('Usage: node tools/terrain_material/observe.cjs BUNDLE OUT [station] [spec]');
 const bundle=path.resolve(bundleArg),out=path.resolve(outArg),station=stationArg||STATION_DEFAULT,spec=specArg||SPEC_DEFAULT;
 fs.mkdirSync(out,{recursive:true});
 const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 execFileSync('python',['-c','import sys;sys.path.insert(0,"tools/gym");from bundle import verify_bundle;verify_bundle(sys.argv[1],sys.argv[2])',bundle,sha]);
 const source=JSON.parse(fs.readFileSync(path.join('main/game/stations',station+'.json'),'utf8'));
 const expected=sectionVertices(source.chains),vertices=expected.reduce((a,b)=>a+b,0);
 function find(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()){const v=find(p);if(v)return v;}else if(e.name==='index.html')return p;}}
 const web=path.dirname(find(bundle));
 const server=http.createServer((req,res)=>{
  const file=path.resolve(web,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(web+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.wasm')?'application/wasm':file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':'text/html');
  fs.createReadStream(file).pipe(res);
 });
 const r={schema:1,issue:392,stage:'A',status:'INCOMPLETE',source_sha:sha,station,spec,expected_section_vertices:expected,vertices,runs:[],errors:[],
  not_measured:['hardware GPU time and texture memory','physical phone/touch','art-direction acceptance (Claudio)']};
 (async()=>{
  let browser;
  try{
   await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
   browser=await chromium.launch();r.browser=browser.version();
   for(const textured of [false,true]){
    const context=await browser.newContext({viewport:{width:1280,height:720}});const page=await context.newPage();
    page.on('pageerror',e=>r.errors.push(e.message));
    page.on('console',m=>{const t=m.text();if(/ERROR:|RIDER_TERRAIN_MATERIAL/.test(t))r.errors.push(t);});
    await configure(page,'terrain-392','le6');await page.addInitScript(probe);
    const query='?station='+station+(textured?'&terrain_material='+encodeURIComponent(spec):'');
    await page.goto('http://127.0.0.1:'+server.address().port+'/index.html'+query);
    await page.waitForFunction(s=>window.riderReady?.source_sha===s&&window.riderRoadProjection?.sections>0&&window.riderTelemetry?.sequence>30,sha,{timeout:60000,polling:100});
    r.identity??=await page.evaluate(()=>{const gl=document.createElement('canvas').getContext('webgl2'),x=gl&&gl.getExtension('WEBGL_debug_renderer_info');return {renderer:x&&gl.getParameter(x.UNMASKED_RENDERER_WEBGL),user_agent:navigator.userAgent};});
    const run={textured,query};
    const snap=()=>page.evaluate(()=>({projection:window.riderRoadProjection,mesh:window.riderTerrainMesh,resources:window.riderTerrainResources,car:{distance:window.riderTelemetry?.station_distance,speed:window.riderTelemetry?.speed_mps,sequence:window.riderTelemetry?.sequence}}));
    // Idle frame intervals at the start view (2 s settle, 5 s window).
    await page.waitForTimeout(2000);
    let from=await page.evaluate(()=>window.__mat.frames.length);await page.waitForTimeout(5000);
    let f=await page.evaluate(n=>window.__mat.frames.slice(n),from);run.idle_frame_ms=stats(f.slice(1).map((t,i)=>t-f[i]));
    await page.screenshot({path:path.join(out,(textured?'textured':'untextured')+'-play-start.png')});
    // Drive with real key input towards the boundary; frame intervals while sections stream in.
    await page.locator('canvas').focus();
    from=await page.evaluate(()=>window.__mat.frames.length);
    await page.keyboard.down('w');
    const boundary=Number(spec.split('@')[1]);
    // station_distance = chassis x - spawn x; stop a few metres before the boundary so both families are in view.
    await page.waitForFunction(d=>window.riderTelemetry?.station_distance>=d,(Number.isFinite(boundary)?boundary:20)-source.spawn[0]-4,{timeout:30000,polling:20});
    await page.keyboard.up('w');
    f=await page.evaluate(n=>window.__mat.frames.slice(n),from);run.drive_frame_ms=stats(f.slice(1).map((t,i)=>t-f[i]));
    await pointer.frames(page,{n:20});
    run.play=await snap();
    await page.screenshot({path:path.join(out,(textured?'textured':'untextured')+'-play-boundary.png')});
    // Edit mode, Home = Fit: every section resident.
    await page.keyboard.down('e');await pointer.frames(page,{n:3});await page.keyboard.up('e');
    await page.waitForFunction(()=>window.riderEditor?.mode==='edit'&&window.riderEditor.screen,null,{timeout:20000});
    await page.keyboard.down('Home');await pointer.frames(page,{n:3});await page.keyboard.up('Home');await pointer.frames(page,{n:30});
    await page.waitForFunction(()=>window.riderRoadProjection?.counts?.visible===window.riderRoadProjection?.sections,null,{timeout:20000});
    from=await page.evaluate(()=>window.__mat.frames.length);await page.waitForTimeout(3000);
    f=await page.evaluate(n=>window.__mat.frames.slice(n),from);run.edit_fit_frame_ms=stats(f.slice(1).map((t,i)=>t-f[i]));
    run.edit=await snap();
    run.uploads=await page.evaluate(()=>window.__mat.uploads);
    run.texture_uploads=await page.evaluate(()=>({textures:window.__mat.textures,generate_mipmap_calls:window.__mat.mipmaps}));
    await page.screenshot({path:path.join(out,(textured?'textured':'untextured')+'-edit-fit.png')});
    // Stride: each section's vertex count (from the JSON here) must appear as a WebGL ARRAY_BUFFER upload.
    const stride=textured?52:48,other=textured?48:52;
    run.edit_sections=run.edit.projection.sections;
    run.section_uploads=expected.map(n=>({vertices:n,bytes:n*stride,seen:run.uploads.filter(b=>b===n*stride).length,other_stride_seen:run.uploads.filter(b=>b===n*other).length}));
    run.measured_stride=stride;
    assert.equal(run.edit.projection.stride,stride,'published stride');
    assert.equal(run.edit.projection.material.active,textured,'material route');
    for(const s of run.section_uploads){assert(s.seen>0,`no ${s.bytes}-byte vertex upload for a ${s.vertices}-vertex section`);assert.equal(s.other_stride_seen,0,`a ${s.vertices}-vertex section was also uploaded at ${other} B/vertex`);}
    run.fit_payload_bytes=vertices*stride;
    r.runs.push(run);
    await context.close();
   }
   assert.deepEqual(r.errors,[],'page errors');
   r.status='PASS';
  }catch(e){r.status='FAIL';r.failure=String(e&&e.stack||e);}
  finally{
   if(browser)await browser.close();server.close();
   fs.writeFileSync(path.join(out,'terrain-material-392.json'),JSON.stringify(r,null,1)+'\n');
   console.log(r.status,path.join(out,'terrain-material-392.json'));
   process.exitCode=r.status==='PASS'?0:1;
  }
 })();
}
