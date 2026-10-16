// Exercise the same loader and release bundle locally and after deployment.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
async function main(){
  const [target,sha,buildId,out]=process.argv.slice(2);
  if(!/^[0-9]+-[0-9]+$/.test(buildId))throw Error('Expected build ID');
  if(!/^[a-f0-9]{40}$/.test(sha))throw Error('Expected full SHA');
  fs.mkdirSync(out,{recursive:true});
  let server,browser;
  let url=target;
  try{
    if(!/^https:\/\//.test(target)){
      const root=path.resolve(target);
      server=http.createServer((req,res)=>{
        const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
        const file=path.resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
        if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}
        res.setHeader('Content-Type',{'.wasm':'application/wasm','.js':'text/javascript','.json':'application/json','.html':'text/html'}[path.extname(file)]||'application/octet-stream');
        fs.createReadStream(file).pipe(res);
      });
      await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
      url='http://127.0.0.1:'+server.address().port+'/';
    }
    browser=await chromium.launch(process.env.RIDER_CHROME?{executablePath:process.env.RIDER_CHROME}:{});
    const results=[];
    for(const spec of [{name:'desktop',viewport:{width:1280,height:720},deviceScaleFactor:2},
                       {name:'phone-emulation',viewport:{width:1080,height:486},isMobile:true,hasTouch:true}]){
      const {name,...contextOptions}=spec;
      const context=await browser.newContext(contextOptions);
      const page=await context.newPage(),errors=[],logs=[];
      page.on('pageerror',e=>errors.push(e.message));page.on('crash',()=>errors.push('Page crashed'));
      page.on('console',m=>{logs.push(m.text());if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))errors.push(m.text());});
      const launch=new URL(url);launch.search='?preview-check=1';launch.hash='verify';
      await page.goto(launch.href);
      try {
        await page.waitForFunction(expected=>window.riderReady?.source_sha===expected&&window.riderBuild===expected,sha,{timeout:60000});
      } catch(error) {
        fs.writeFileSync(path.join(out,spec.name+'.log'),logs.join('\n'));
        await page.screenshot({path:path.join(out,spec.name+'-failed.png')});
        throw error;
      }
      const current=new URL(page.url());
      if(!current.pathname.endsWith('/builds/'+sha+'/'+buildId+'/index.html')||current.search!=='?preview-check=1'||current.hash!=='#verify')throw Error('Loader lost build identity/query/fragment');
      // Release engines may suppress diagnostics: require ongoing owner -> GUI
      // progress after READY so a dead controller cannot pass on a static scene.
      await page.waitForFunction(()=>window.riderTelemetry?.sequence>=2,null,{timeout:10000});
      const sequence=await page.evaluate(()=>window.riderTelemetry.sequence);
      await page.waitForFunction(previous=>window.riderTelemetry?.sequence>previous+1,sequence,{timeout:10000});
      // A12b: no page chrome/bars; DPR-sized buffer, resize without new world,
      // real engine slider acknowledgement at both endpoints after each layout.
      const responsive=[];
      const initialReady=await page.evaluate(()=>JSON.stringify(window.riderReady));
      const sizes=name==='desktop'?[{width:1920,height:1080},{width:2560,height:1440},{width:1280,height:720}]:
        [{width:1080,height:486},{width:486,height:1080},{width:1080,height:486}];
      for(const viewport of sizes){
        await page.setViewportSize(viewport);
        await page.waitForFunction(()=>{
          const c=document.querySelector('canvas'),r=c.getBoundingClientRect();
          return Math.abs(r.width-innerWidth)<1&&Math.abs(r.height-innerHeight)<1&&r.x===0&&r.y===0&&
            c.width===Math.floor(innerWidth*devicePixelRatio)&&c.height===Math.floor(innerHeight*devicePixelRatio);
        });
        // Allow input coordinates and owner -> UI messages to settle after resize.
        const seq=await page.evaluate(()=>window.riderTelemetry.sequence);
        await page.waitForFunction(n=>window.riderTelemetry.sequence>n+1,seq);
        for(let row=0;row<9;row++){
          for(const endpoint of ['left','right']){
            const point=await page.evaluate(({row,endpoint})=>{
              const c=document.querySelector('canvas'),r=c.getBoundingClientRect();
              const data=window.riderControls[row],p=data[endpoint];
              return {x:r.x+p.x/c.width*r.width,y:r.y+(1-p.y/c.height)*r.height,
                key:data.key,value:(endpoint==='left'?data.min:data.max)*data.sign};
            },{row,endpoint});
            await page.mouse.move(point.x,point.y);await page.mouse.down();
            await page.waitForFunction(({row,value})=>Math.abs(window.riderControls[row].value-value)<.01,{row,value:point.value});
            // Release outside the track; then actual keyboard drive must work again.
            await page.mouse.move(2,2);await page.mouse.up();
          }
        }
        await page.keyboard.down('1');
        await page.waitForFunction(()=>window.riderTelemetry.preset==='a'&&!window.riderTelemetry.modified);
        await page.keyboard.up('1');
        await page.screenshot({path:path.join(out,`${name}-${viewport.width}x${viewport.height}.png`)});
        responsive.push({viewport,status:'PASS',sliders:9});
      }
      if(await page.evaluate(()=>JSON.stringify(window.riderReady))!==initialReady)throw Error('Resize reloaded world');
      await page.keyboard.down('ArrowUp');
      const drivingSequence=await page.evaluate(()=>window.riderTelemetry.sequence);
      await page.waitForFunction(n=>window.riderTelemetry.sequence>n+4&&window.riderTelemetry.speed>20,drivingSequence);
      await page.keyboard.up('ArrowUp');
      // Capture a settled view after 30 rendered frames; this is not phone performance/feel evidence.
      await page.evaluate(async()=>{for(let i=0;i<30;i++)await new Promise(requestAnimationFrame);});
      await page.screenshot({path:path.join(out,spec.name+'.png')});
      fs.writeFileSync(path.join(out,spec.name+'.log'),logs.join('\n'));
      if(errors.length)throw Error(errors.join('\n'));
      results.push({name:spec.name,status:'PASS',url:page.url(),viewport:spec.viewport,responsive});
      // Same scene/viewport in both quality modes. These are CI software-browser
      // observations, not reference-phone performance or a product budget decision.
      const quality=[];
      for(const dpi of ['1','0']){
        const qualityUrl=new URL(page.url());qualityUrl.searchParams.set('dpi',dpi);
        await page.goto(qualityUrl.href);
        await page.waitForFunction(expected=>window.riderBuild===expected&&window.riderTelemetry?.sequence>=2,sha);
        await page.waitForFunction(enabled=>{
          const c=document.querySelector('canvas');
          return c.width===Math.floor(innerWidth*(enabled?devicePixelRatio:1))&&
            c.height===Math.floor(innerHeight*(enabled?devicePixelRatio:1));
        },dpi==='1');
        const samples=await page.evaluate(async()=>{
          const frames=[],engine=[],seen=new Set();let previous;
          const started=performance.now();
          while(performance.now()-started<2000){
            const now=await new Promise(requestAnimationFrame);
            if(previous!==undefined)frames.push(now-previous);previous=now;
            const t=window.riderTelemetry;
            if(!seen.has(t.sequence)){seen.add(t.sequence);engine.push({frame_ms:t.frame_ms,physics_ms:t.physics_ms});}
          }
          return {callbackMeanMs:frames.reduce((a,b)=>a+b,0)/frames.length,callbackSamples:frames.length,engine};
        });
        quality.push({dpi,viewport:await page.evaluate(()=>window.riderViewport),samples});
      }
      results.at(-1).qualityComparison=quality;
      await context.close();
    }
    fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({source_sha:sha,build_id:buildId,status:'PASS',browser:browser.version(),real_device:'NOT RUN',cases:results},null,2));
    console.log(JSON.stringify({source_sha:sha,build_id:buildId,status:'PASS',cases:results}));
  }catch(error){
    if(browser)for(const context of browser.contexts())for(const page of context.pages()){
      await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});
      fs.writeFileSync(path.join(out,'failure-state.json'),JSON.stringify(await page.evaluate(()=>({viewport:window.riderViewport,controls:window.riderControls,telemetry:window.riderTelemetry})).catch(()=>null),null,2));
    }
    throw error;
  }finally{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
