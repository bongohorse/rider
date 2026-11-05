// #536 experiment: same fixed camera poses per variant on the texture-test course, real debug HTML5 bundle in headless
// Chromium. Evidence for Claudio's keep/drop, not a test; not part of `required`.
//   node tools/terrain_material/experiment_536/capture.cjs <bundle> <out dir>
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const {configure}=require('../../gym/launch.cjs');
const {sectionVertices,stats}=require('../observe.cjs');
const VARIANTS=[['today',''],['stage-a','grass'],['band-fill-line','proto'],['band-fill-world','protow']];
const DRIVE=.8;
const POSES=[['fit',137,10,.0316],['wide-ramp-drop',170,12,.25],['flat',8,1.2,DRIVE],['valley',38,-3.2,DRIVE],['crest',78,5.2,DRIVE],['ramp',142,10.5,DRIVE],['steep-drop',184,11,DRIVE],['gap',208.5,.5,DRIVE],['overhang',266,5.5,DRIVE],['overhang-top',273,11,DRIVE],['run-end-closeup',203,.2,2.5]];
function probe(){
 const p=window.__x={textures:[],mipmaps:0,frames:[]};
 for(const proto of [window.WebGLRenderingContext?.prototype,window.WebGL2RenderingContext?.prototype].filter(Boolean)){
  const tex=proto.texImage2D,mip=proto.generateMipmap;
  proto.texImage2D=function(...a){if(a.length>=9&&a[3]>=128&&a[4]>=128)p.textures.push({level:a[1],width:a[3],height:a[4],format:a[6],type:a[7]});return tex.apply(this,a);};
  proto.generateMipmap=function(...a){p.mipmaps++;return mip.apply(this,a);};
 }
 const raf=window.requestAnimationFrame.bind(window);
 window.requestAnimationFrame=cb=>raf(t=>{p.frames.push(performance.now());return cb(t);});
}
const [bundleArg,outArg]=process.argv.slice(2);
const bundle=path.resolve(bundleArg),out=path.resolve(outArg);
fs.mkdirSync(out,{recursive:true});
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
function find(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()){const v=find(p);if(v)return v;}else if(e.name==='index.html')return p;}}
const web=path.dirname(find(bundle));
const server=http.createServer((req,res)=>{
 const file=path.resolve(web,'.'+new URL(req.url,'http://localhost').pathname);
 if(!file.startsWith(web+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',file.endsWith('.wasm')?'application/wasm':file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':'text/html');
 fs.createReadStream(file).pipe(res);
});
const source=JSON.parse(fs.readFileSync('main/game/stations/texture-test.json','utf8'));
const expected=sectionVertices(source.chains),vertices=expected.reduce((a,b)=>a+b,0);
const r={schema:1,issue:536,source_sha:sha,status:'INCOMPLETE',vertices,sections:expected.length,variants:[],errors:[],
 not_measured:['real GPU time and texture memory','physical phone or touch','art direction (Claudio)','Edit mode on this course'],
 poses:POSES.map(([id,x,y,zoom])=>({id,x,y,zoom}))};
(async()=>{
 let browser;
 try{
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  browser=await chromium.launch();r.browser=browser.version();
  for(const [id,spec] of VARIANTS){
   const context=await browser.newContext({viewport:{width:1280,height:720}});const page=await context.newPage();
   page.on('pageerror',e=>r.errors.push(id+': '+e.message));
   page.on('console',m=>{const t=m.text();if(/ERROR:|RIDER_TERRAIN_MATERIAL|shader|Shader/.test(t))r.errors.push(id+': '+t);});
   await configure(page,'terrain-536','le6');await page.addInitScript(probe);
   await page.goto('http://127.0.0.1:'+server.address().port+'/index.html?station=texture-test'+(spec?'&terrain_material='+spec:''));
   await page.waitForFunction(s=>window.riderReady?.source_sha===s&&window.riderRoadProjection?.sections>0&&window.riderTelemetry?.sequence>30,sha,{timeout:90000,polling:100});
   await page.waitForTimeout(1500);
   await page.addStyleTag({content:'button{display:none!important}'}).catch(()=>{});
   const run={id,spec,poses:{}};
   await page.screenshot({path:path.join(out,id+'--start.png')});
   for(const [pose,x,y,zoom] of POSES){
    await page.evaluate(v=>{window.riderExperimentPose=v;},{x,y,zoom,clean:true});
    await page.waitForFunction(([zx])=>Math.abs((window.riderRoadProjection?.camera?.[0]??1e9)-zx)<.01,[x],{timeout:20000,polling:50});
    await page.waitForTimeout(900);
    const from=await page.evaluate(()=>window.__x.frames.length);await page.waitForTimeout(1200);
    const f=await page.evaluate(n=>window.__x.frames.slice(n),from);
    await page.screenshot({path:path.join(out,id+'--'+pose+'.png')});
    const p=await page.evaluate(()=>({stride:window.riderRoadProjection.stride,visible:window.riderRoadProjection.counts?.visible,allocated:window.riderRoadProjection.counts?.allocated,bytes:window.riderRoadProjection.counts?.bytes,camera:window.riderRoadProjection.camera}));
    run.poses[pose]={...p,frame_ms:stats(f.slice(1).map((t,i)=>t-f[i]))};
   }
   await page.evaluate(()=>{window.riderExperimentPose=null;});
   run.material=await page.evaluate(()=>window.riderRoadProjection.material);
   run.mesh=await page.evaluate(()=>window.riderTerrainMesh);
   run.stride=run.poses.fit.stride;run.fit_payload_bytes=vertices*run.stride;
   run.textures=await page.evaluate(()=>window.__x.textures);run.generate_mipmap_calls=await page.evaluate(()=>window.__x.mipmaps);
   r.variants.push(run);
   await context.close();
  }
  r.status=r.errors.length?'FAIL':'PASS';
 }catch(e){r.status='FAIL';r.failure=String(e&&e.stack||e);}
 finally{
  if(browser)await browser.close();server.close();
  fs.writeFileSync(path.join(out,'results-536.json'),JSON.stringify(r,null,1)+'\n');
  console.log(r.status,r.failure||'',r.errors.slice(0,10).join('\n'));
  process.exitCode=r.status==='PASS'?0:1;
 }
})();
