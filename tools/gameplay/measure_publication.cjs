'use strict';
// #516: fixed, predeclared source/viewport/idle-input experiment; callback CPU/bridge evidence, never GPU FPS.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),os=require('node:os');
const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'../..');
const PLAN={schema:1,warmup_s:5,sample_s:20,repetitions:3,viewport:{width:1280,height:720},dpr:1,
 command_trace:'idle: throttle=0, brake_reverse=0, lean=0; no driving keys or pointer gestures',
 material_rule:'absolute median p95 effect >= max(0.2ms, 3 * largest within-mode MAD, 5 * observed clock resolution)',
 floor_ms:.2,noise_factor:3,resolution_factor:5,
 byte_semantics:'json.encode bytes are encoded output; html5.run bytes are UTF-8 script input, returned_bytes are returned string bytes. These are memory/bridge representations, not network traffic; do not sum both layers as distinct payload.',
 limitations:'Lua callback/bridge wall time and browser rAF spacing; no GPU/presented FPS or physical-device acceptance. Timer-only debug control includes common timing overhead.'};
function percentile(values,p){assert(values.length,'No samples');const a=[...values].sort((x,y)=>x-y);return a[Math.max(0,Math.ceil(a.length*p)-1)];}
const median=a=>percentile(a,.5);
const mad=a=>median(a.map(x=>Math.abs(x-median(a))));
function distribution(a){return {count:a.length,p50_ms:percentile(a,.5),p95_ms:percentile(a,.95),max_ms:Math.max(...a)};}
function compare(off,on,resolutions=[]){
 assert.equal(off.length,PLAN.repetitions);assert.equal(on.length,PLAN.repetitions);
 const noise=Math.max(mad(off),mad(on)),resolution=Math.max(0,...resolutions.filter(Number.isFinite));
 const threshold=Math.max(PLAN.floor_ms,PLAN.noise_factor*noise,PLAN.resolution_factor*resolution);
 const delta=median(on)-median(off);
 return {off_median_p95_ms:median(off),on_median_p95_ms:median(on),delta_ms:delta,noise_mad_ms:noise,resolution_ms:resolution,
  threshold_ms:threshold,material_observer_effect:Math.abs(delta)>=threshold};
}
function fixtures(){
 const load=rel=>JSON.parse(fs.readFileSync(path.join(ROOT,rel),'utf8'));
 const paths={short:'tests/gameplay/level-fixtures/terrain-p0/six-anchor.json',long:'tests/gameplay/level-fixtures/terrain-p0/long-curves.json',mechanism:'main/game/stations/objects-demo.json'};
 const params=load('tests/gameplay/level-fixtures/terrain-278/applied-export.json').editor.road_look;
 return Object.entries(paths).map(([name,source])=>{
  const d=load(source);
  if(name==='long'){d.editor.road_profile='authored-v1';d.editor.road_look=params;}
  const text=JSON.stringify(d);
  return {name,source,text,id:d.id,projection:name==='long',sha256:crypto.createHash('sha256').update(text).digest('hex'),
   transformation:name==='long'?'level-wide authored-v1 parameters from retained applied-export; source/compiled geometry unchanged':'retained data, JSON re-encoded'};
 });
}
function verifyBundle(bundle,variant){
 const report=JSON.parse(fs.readFileSync(path.join(bundle,'bundle.json')));assert.equal(report.variant,variant);assert.equal(report.platform,'wasm-web');
 execFileSync('python',['-c',`import json,sys,subprocess;from pathlib import Path;sys.path.insert(0,'tools/gym');from bundle import inventory,source_fingerprint;p=Path(sys.argv[1]);r=json.loads((p/'bundle.json').read_text());assert r['source_sha']==subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip();assert r['source_fingerprint']==source_fingerprint();assert r['files'] and r['files']==inventory(p)`,bundle],{cwd:ROOT});
 const entries=Object.keys(report.files).filter(x=>x.endsWith('/index.html')||x==='index.html');assert.equal(entries.length,1);
 return {report,web:path.dirname(path.join(bundle,entries[0]))};
}
async function serve(web){
 const server=http.createServer((req,res)=>{
  const file=path.resolve(web,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(web+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',file.endsWith('.wasm')?'application/wasm':file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':'application/octet-stream');fs.createReadStream(file).pipe(res);
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 return {server,url:'http://127.0.0.1:'+server.address().port+'/index.html'};
}
async function runOne(chromium,served,source,course,mode,repeat,out){
 const {configure}=require('../gym/launch.cjs');
 const runId='pub516-'+crypto.randomUUID(),errors=[];let browser;
 const r={status:'FAIL',source_sha:source.source_sha,source_fingerprint:source.source_fingerprint,variant:source.variant,
  run_id:runId,course:course.name,fixture_sha256:course.sha256,mode,repeat,host:{platform:os.platform(),arch:os.arch(),cpus:os.cpus().length,load_start:os.loadavg()},errors};
 try{
  browser=await chromium.launch();r.browser=browser.version();const page=await browser.newPage({viewport:PLAN.viewport,deviceScaleFactor:PLAN.dpr});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT|ERROR:GUI/.test(m.text()))errors.push(m.text());});
  await configure(page,runId,'pub516');
  await page.addInitScript(()=>{
   window.__publicationFrames=[];let last;
   function sample(t){if(last!==undefined&&window.__publicationFrames.length<10000)window.__publicationFrames.push({unix_ms:Date.now(),dt_ms:t-last});last=t;requestAnimationFrame(sample);}
   requestAnimationFrame(sample);
  });
  await page.goto(served.url+'?station=straight&pub516='+(mode==='on'?'on':'off'));
  await page.waitForFunction(()=>window.riderTelemetry?.sequence>2,null,{timeout:30000});
  assert.equal(await page.evaluate(()=>window.riderReady.source_sha),source.source_sha);
  const generation=await page.evaluate(()=>window.riderTelemetry.session_generation);
  await page.evaluate(text=>{window.riderCustom.open();document.querySelector('#rider-custom-text').value=text;[...document.querySelectorAll('#rider-custom-panel button')].find(b=>b.textContent==='Import text').click();},course.text);
  await page.waitForFunction(({generation,id})=>window.riderCustomStatus==='Saved'&&window.riderTelemetry?.session_generation>generation&&window.riderTelemetry.station===id&&window.riderTelemetry.sequence>2,{generation,id:course.id},{timeout:30000});
  const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');
  const metrics=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.filter(x=>['JSHeapUsedSize','JSHeapTotalSize','TaskDuration'].includes(x.name)).map(x=>[x.name,x.value]));
  r.heap_before=await metrics();r.dpr=await page.evaluate(()=>devicePixelRatio);assert.equal(r.dpr,PLAN.dpr);
  let begin=Date.now()+PLAN.warmup_s*1000,end=begin+PLAN.sample_s*1000;
  if(mode!=='release')await page.evaluate(window=>{globalThis.riderPublication516Window=window;},
   {run_id:runId,begin_unix_ms:begin,end_unix_ms:end});
  if(mode==='release'){
   await page.waitForFunction(end=>Date.now()>=end,end,{polling:100,timeout:35000});
   assert.equal(await page.evaluate(()=>window.riderPublication516??null),null,'release must not install the observer');
   r.owners=null;r.fixed_ticks=null;r.fixed_tick_limit='Unchanged release exports no exact fixed-tick counter; not inferred from frames.';
  }else{
   const expected=['controller.update','hud.update',...(course.projection?['projection.apply']:[])];
   await page.waitForFunction(expected=>expected.every(k=>window.riderPublication516?.[k]),expected,{polling:100,timeout:40000});
   r.owners=await page.evaluate(()=>window.riderPublication516);
   for(const owner of expected){
    const p=r.owners[owner];assert.equal(p.run_id,runId);assert.equal(p.mode,mode);assert.equal(p.overflow,false);
    assert(p.buckets.callback.count>=300,'insufficient warmed callback samples');
    for(const b of Object.values(p.buckets))b.distribution=distribution(b.samples_ms);
   }
   const p=r.owners['controller.update'];begin=p.begin_unix_ms;end=p.end_unix_ms;
   r.fixed_ticks=p.fixed_tick_end-p.fixed_tick_begin;
   assert(Math.abs(r.fixed_ticks/PLAN.sample_s-60)<=1,'fixed-tick window is not comparable');
   assert(p.command_samples>0&&!p.nonzero_command,'idle command trace changed');
   if(mode==='off')for(const p of Object.values(r.owners))assert.deepEqual(Object.keys(p.buckets),['callback'],'off control must omit publication sampling');
  }
  r.window={begin_unix_ms:begin,end_unix_ms:end};
  const frames=await page.evaluate(({begin,end})=>window.__publicationFrames.filter(x=>x.unix_ms>=begin&&x.unix_ms<end).map(x=>x.dt_ms),{begin,end});
  assert(frames.length>=300);r.raf_spacing=distribution(frames);r.heap_after=await metrics();r.host.load_end=os.loadavg();assert.deepEqual(errors,[]);
  r.status='PASS';
 }catch(e){r.error=e.stack;throw e;}finally{
  fs.writeFileSync(path.join(out,course.name+'-'+mode+'-'+repeat+'.json'),JSON.stringify(r,null,2)+'\n');
  if(browser)await browser.close();
 }
 return r;
}
async function main(args){
 const smoke=args[3]==='--smoke';assert(args.length===(smoke?4:3),'Usage: node measure_publication.cjs DEBUG_BUNDLE RELEASE_BUNDLE OUT [--smoke]');
 const [debugArg,releaseArg,outArg]=args,out=path.resolve(outArg);fs.mkdirSync(out,{recursive:true});
 const debug=verifyBundle(path.resolve(debugArg),'debug'),release=smoke?null:verifyBundle(path.resolve(releaseArg),'release');
 if(release)assert.equal(release.report.source_sha,debug.report.source_sha);
 const courses=fixtures();fs.writeFileSync(path.join(out,'plan.json'),JSON.stringify({...PLAN,source_sha:debug.report.source_sha,smoke,courses:courses.map(({text,...rest})=>rest)},null,2)+'\n');
 const {chromium}=require('playwright');let a,b;const runs=[];
 try{
  a=await serve(debug.web);if(release)b=await serve(release.web);
  for(let repeat=0;repeat<(smoke?1:PLAN.repetitions);repeat++)for(const course of smoke?courses.filter(c=>c.name==='long'):courses){
   const order=smoke?['on']:[['off','on','release'],['release','on','off'],['on','release','off']][repeat];
   for(const mode of order){console.log('START '+course.name+' '+mode+' '+repeat);runs.push(await runOne(chromium,mode==='release'?b:a,mode==='release'?release.report:debug.report,course,mode,repeat,out));console.log('PASS '+course.name+' '+mode+' '+repeat);}
  }
  const comparisons={};
  if(!smoke)for(const course of courses){
   const off=runs.filter(r=>r.course===course.name&&r.mode==='off'),on=runs.filter(r=>r.course===course.name&&r.mode==='on');
   comparisons[course.name]={};
   for(const owner of Object.keys(on[0].owners)){
    const values=(rows)=>rows.map(r=>r.owners[owner].buckets.callback.distribution.p95_ms);
    comparisons[course.name][owner]=compare(values(off),values(on),[...off,...on].map(r=>r.owners[owner].resolution_ms));
   }
  }
  verifyBundle(path.resolve(debugArg),'debug');if(release)verifyBundle(path.resolve(releaseArg),'release');
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({status:smoke?'SMOKE_PASS':'PASS',source_sha:debug.report.source_sha,plan:PLAN,runs:runs.map(r=>({course:r.course,mode:r.mode,repeat:r.repeat,status:r.status,run_id:r.run_id})),comparisons},null,2)+'\n');
 }finally{if(a)await new Promise(ok=>a.server.close(ok));if(b)await new Promise(ok=>b.server.close(ok));}
}
module.exports={PLAN,percentile,distribution,compare,fixtures};
if(require.main===module)main(process.argv.slice(2)).catch(e=>{console.error(e);process.exitCode=1;});
