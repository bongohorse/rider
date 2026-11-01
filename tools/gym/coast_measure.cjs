// One real debug HTML5 Gym session, three fixed-owner stock-A trials (#345).
// No wall-clock drive input, no manual Box2D step, no A18 freewheel surrogate.
const {configure}=require('./launch.cjs');
const {verify}=require('./coast_measure_report.cjs');
const {chromium}=require('playwright');
const {presetA}=require('./regress_spec.cjs');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const assert=require('node:assert/strict'),crypto=require('node:crypto');
(async()=>{
  const [output,sha,runId,testcase,bundle]=process.argv.slice(2);
  assert.equal(testcase,'coast345');
  const out=path.resolve(output),dir=path.resolve(bundle);
  const manifestText=fs.readFileSync(path.join(dir,'bundle.json'),'utf8');
  const manifest=JSON.parse(manifestText);
  assert.equal(manifest.source_sha,sha);
  assert.equal(manifest.platform,'wasm-web');assert.equal(manifest.variant,'debug');
  const bundleSha=crypto.createHash('sha256').update(manifestText).digest('hex');
  const find=folder=>{
    for(const e of fs.readdirSync(folder,{withFileTypes:true})){
      const p=path.join(folder,e.name);
      if(e.isDirectory()){const found=find(p);if(found)return found;}
      else if(e.name==='index.html')return p;
    }
  };
  const index=find(dir);
  assert.ok(index,'missing debug Gym index');
  const web=path.dirname(index),lines=[];
  const server=http.createServer((req,res)=>{
    const file=path.resolve(web,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if(!file.startsWith(web+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){
      res.writeHead(404);res.end();return;
    }
    res.setHeader('Content-Type',{'.wasm':'application/wasm','.js':'text/javascript','.html':'text/html'}[path.extname(file)]||'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  let browser,page,done=false;
  try{
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    browser=await chromium.launch();
    page=await browser.newPage({viewport:{width:960,height:540}});
    await configure(page,runId,testcase);
    let resolveDone,rejectDone;
    const finished=new Promise((resolve,reject)=>{resolveDone=resolve;rejectDone=reject;});
    page.on('pageerror',e=>rejectDone(e));
    page.on('crash',()=>rejectDone(Error('Gym page crashed')));
    page.on('console',m=>{
      const line=m.text();lines.push(line);
      if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(line))rejectDone(Error(line));
      const index=line.indexOf('RIDER_GYM ');
      if(index<0)return;
      try{
        const event=JSON.parse(line.slice(index+'RIDER_GYM '.length));
        if(event.source_sha!==sha||event.run_id!==runId)throw Error('foreign engine evidence');
        if(event.event==='suite_end')resolveDone(event);
      }catch(e){rejectDone(e);}
    });
    await page.goto('http://127.0.0.1:'+server.address().port+'/index.html?station=straight');
    let timer;
    const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('real fixed-tick measurement timed out')),80000);});
    let event;
    try{event=await Promise.race([finished,timeout]);}finally{clearTimeout(timer);}
    assert.equal(event.status,'PASS',JSON.stringify(event.cases));
    const result=await page.evaluate(()=>window.riderCoastMeasureResult||null);
    assert.ok(result,'missing engine-owned per-tick artifact');
    verify(result,{source_sha:sha,run_id:runId,config_identity:presetA().identity});
    const report={...result,browser:'chromium '+browser.version(),
      platform:'HTML5 debug wasm-web, Playwright headless',real_device:'NOT RUN',
      bundle:{sha256:bundleSha,source_fingerprint:manifest.source_fingerprint,platform:manifest.platform,variant:manifest.variant}};
    fs.writeFileSync(path.join(out,'coast-measure-result.json'),JSON.stringify(report,null,1)+'\n');
    const [coast,brake,repeat]=report.runs;
    const md=[
      '# Stock-A coast/brake — measured debug Gym (#345)','',
      'Source SHA: `'+sha+'`  ',
      'Run ID: `'+runId+'`  ',
      'Bundle manifest SHA-256: `'+bundleSha+'`  ',
      'Source fingerprint: `'+manifest.source_fingerprint+'`  ',
      'Browser: '+report.browser+'; render '+report.render_fps+' FPS; physics '+report.physics_hz+' Hz; time factor 1.0; preset A unchanged.','',
      '| Trial | Start speed | Stop distance | Time | Ticks |',
      '| --- | ---: | ---: | ---: | ---: |',
      ...report.runs.map(r=>'| '+r.kind+' | '+r.start[2].toFixed(6)+' m/s | '+r.distance_m.toFixed(6)+' m | '+r.seconds.toFixed(6)+' s | '+r.ticks+' |'),
      '',
      'Neutral repeat delta: '+report.repeat_delta_m.toFixed(6)+' m; '+report.repeat_delta_s.toFixed(6)+' s.  ',
      'Full per-tick chassis velocity, x/y, wheel contacts, wheel angular speed and normalized commands: `coast-measure-result.json`.  ',
      'Physical phone / subjective driving: NOT RUN. No gameplay tuning changed.',''
    ].join('\n');
    fs.writeFileSync(path.join(out,'coast-measure-summary.md'),md);
    console.log(JSON.stringify({status:'PASS',source_sha:sha,coast_m:coast.distance_m,brake_m:brake.distance_m,
      repeat_m:repeat.distance_m,repeat_delta_m:report.repeat_delta_m,repeat_delta_s:report.repeat_delta_s}));
    done=true;
  }catch(e){
    console.error(e);
    fs.writeFileSync(path.join(out,'coast-measure-failed.json'),JSON.stringify({status:'FAIL',source_sha:sha,
      run_id:runId,error:String(e),engine_result:page?await page.evaluate(()=>window.riderCoastMeasureResult||null).catch(()=>null):null},null,1)+'\n');
    process.exitCode=1;
  }finally{
    fs.writeFileSync(path.join(out,'runtime.log'),lines.join('\n')+'\n');
    await browser?.close();
    if(server.listening)await new Promise(resolve=>server.close(resolve));
  }
  if(!done)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
