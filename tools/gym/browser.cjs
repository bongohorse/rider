const {chromium} = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
async function main() {
  const root = path.resolve(process.argv[2]);
  const expected = process.argv[3];
  const runId = process.argv[4];
  const find = dir => {for (const e of fs.readdirSync(dir, {withFileTypes:true})) {
    const p = path.join(dir,e.name); const hit = e.isDirectory() ? find(p) : e.name==='index.html' ? p : null;
    if(hit) return hit;
  }};
  const index=find(root); if(!index) throw Error('Missing gym bundle');
  const web=path.dirname(index), lines=[], errors=[];
  let browser;
  const server=http.createServer((req,res)=>{
    let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(name==='/')name='/index.html';
    const file=path.resolve(web,'.'+name);
    if(!file.startsWith(web+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()) {res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type', {'.wasm':'application/wasm','.js':'text/javascript','.html':'text/html'}[path.extname(file)]||'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let result;
  try {
    browser=await chromium.launch();
    const page=await browser.newPage({viewport:{width:960,height:540}});
    if(process.argv[5]==='a11')await page.context().grantPermissions(['clipboard-read','clipboard-write']);
    let feedbackChecked=false;
    let resolveDone, rejectDone;
    let input = Promise.resolve();
    const done=new Promise((resolve,reject)=>{resolveDone=resolve;rejectDone=reject;});
    page.on('console',message=>{
      const line=message.text();lines.push(line);
      if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(line))rejectDone(Error(line));
      if(line.includes('RIDER_GYM ')) {
        const data=JSON.parse(line.split('RIDER_GYM ')[1]);
        if(data.source_sha!==expected||data.run_id!==runId)rejectDone(Error('Foreign gym evidence'));
        if(data.event==='phase') input=input.then(async()=>{
          if(data.name==='coast_brake')await page.keyboard.down('ArrowDown');
          if(data.name==='coast_release')await page.keyboard.up('ArrowDown');
          if(data.name==='throttle')await page.keyboard.down('ArrowUp');
          if(data.name==='brake'){
            if(process.argv[5]==='a10' && await page.evaluate(()=>window._dmJSDeviceShared?.audioCtx?.state)!=='running')throw Error('AudioContext not running after initial throttle input');
            await page.keyboard.down('ArrowDown');
          }
          if(data.name==='release_throttle')await page.keyboard.up('ArrowUp');
          if(data.name==='retry_held') {
            await page.keyboard.up('ArrowDown');await page.keyboard.down('ArrowUp');await page.keyboard.down('r');
          }
          if(data.name==='retry_release')await page.keyboard.up('r');
          if(data.name==='release_for_redrive')await page.keyboard.up('ArrowUp');
          if(data.name==='reverse_request')await page.keyboard.up('ArrowUp');
          if(data.name==='air_lean'){await page.keyboard.up('ArrowDown');await page.keyboard.down('a');}
          if(data.name==='ground_left')await page.keyboard.down('a');
          if(data.name==='ground_right')await page.keyboard.down('d');
          if(data.name==='ground_release'){await page.keyboard.up('a');await page.keyboard.up('d');}
          if(data.name==='enable_crash')await page.keyboard.down('c');
          async function guiPoint(name,key){
            return page.evaluate(({name,key})=>{
              const c=document.querySelector('canvas'),r=c.getBoundingClientRect();
              const p=key?window.riderHud[name][key]:window.riderHud[name];
              return {x:r.x+p.x/c.width*r.width,y:r.y+(1-p.y/c.height)*r.height};
            },{name,key});
          }
          async function openTuning(){
            if(!await page.evaluate(()=>window.riderHud?.tuning)){
              await page.keyboard.down('t');await page.waitForFunction(()=>window.riderHud?.tuning);await page.keyboard.up('t');
            }
          }
          if(data.name==='disable_crash_overlay'){
            await page.keyboard.up('c');await openTuning();
            const p=await guiPoint('crash');await page.mouse.move(p.x,p.y);await page.mouse.down();
          }
          if(data.name==='slider_begin'){
            await openTuning();
            const p=await page.evaluate(()=>{const c=document.querySelector('canvas'),r=c.getBoundingClientRect(),s=window.riderControls[0];return {x:r.x+(s.left.x+s.right.x)/2/c.width*r.width,y:r.y+(1-s.left.y/c.height)*r.height};});
            await page.mouse.move(p.x,p.y);await page.mouse.down();
          }
          if(data.name==='slider_move'){
            await page.keyboard.down('ArrowUp');
            const p=await page.evaluate(()=>{const c=document.querySelector('canvas'),r=c.getBoundingClientRect(),s=window.riderControls[0];return {x:r.x+s.right.x/c.width*r.width+3,y:r.y+(1-s.right.y/c.height)*r.height};});
            await page.mouse.move(p.x,p.y);
          }
          if(data.name==='slider_release'){await page.mouse.up();await page.keyboard.up('ArrowUp');}
          if(data.name==='select_preset'){
            await page.keyboard.up('ArrowUp');await openTuning();
            const p=await guiPoint('presets',data.key);
            const resets=await page.evaluate(()=>window.riderTelemetry.reset_count);
            await page.mouse.move(p.x,p.y);await page.mouse.down();
            // Reselecting the already active A still needs a fresh owner acknowledgement.
            await page.waitForFunction(({key,resets})=>window.riderTelemetry.preset===key&&!window.riderTelemetry.modified&&window.riderTelemetry.reset_count===resets+1,{key:data.key,resets});
            await page.mouse.up();
          }
          if(data.name==='preset_drive')await page.keyboard.down('ArrowUp');
          if(data.name==='copy_feedback'){
            await page.keyboard.down('f');
            await page.waitForFunction(()=>window.riderFeedback?.status==='Copied feedback [F]');
            await page.keyboard.up('f');
            const copied=await page.evaluate(()=>navigator.clipboard.readText());
            for(const field of ['Commit: '+expected,'Preset: A','Station: flat-gym','Speed:','m/s','km/h','ground_lean_torque','lean_rate_max','Wheel contact:','Suspension:','FPS:','physics step','Tuning:'])if(!copied.includes(field))throw Error('Missing feedback field: '+field);
            fs.writeFileSync(path.join(root,'copied-feedback.md'),copied);
            await page.evaluate(()=>{navigator.clipboard.writeText=()=>Promise.reject(new DOMException('Injected denial','NotAllowedError'));});
            await page.keyboard.down('f');
            await page.waitForFunction(()=>window.riderFeedback?.visible===true);
            await page.keyboard.up('f');
            const fallback=await page.locator('#rider-feedback-text').inputValue();
            for(const field of ['Commit: '+expected,'Preset: A','Station: flat-gym','Speed:','Tuning:'])if(!fallback.includes(field))throw Error('Incomplete denied-copy fallback');
            feedbackChecked=true;
          }
          if(data.name==='graph_spike')await page.screenshot({path:path.join(root,'suspension-spike.png')});
          if(data.name==='redrive')await page.keyboard.down('ArrowUp');
        }).catch(rejectDone);
        if(data.event==='suite_end')resolveDone(data);
      }
    });
    page.on('pageerror',e=>rejectDone(e));
    page.on('crash',()=>rejectDone(Error('Gym page crashed')));
    await page.goto('http://127.0.0.1:'+server.address().port+'/index.html'+(process.argv[5]==='a9'?'?preset=b':process.argv[5]==='a9invalid'?'?preset=invalid':''));
    let timer;
    try {result=await Promise.race([done,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Gym suite timeout')),60000))]);}
    catch(error){
      await page.screenshot({path:path.join(root,'gym-failed.png')}).catch(()=>{});
      fs.writeFileSync(path.join(root,'failed-telemetry.json'),JSON.stringify(await page.evaluate(()=>window.riderTelemetry||null).catch(()=>null),null,2));
      throw error;
    }
    finally {clearTimeout(timer);}
    if(result.status!=='PASS')throw Error('Gym test failed');
    await input;
    if(process.argv[5]==='a11'){if(!feedbackChecked)throw Error('Feedback roundtrip not verified');result.cases.clipboard_roundtrip=true;result.cases.denied_fallback=true;}
    if(process.argv[5]==='a10'){
      if(await page.evaluate(()=>window._dmJSDeviceShared?.audioCtx?.state)!=='running')throw Error('AudioContext stopped');
      result.cases.audio_context_running=true;
    }
    await page.mouse.up();
    await page.keyboard.up('ArrowUp');await page.keyboard.up('ArrowDown');
    await page.evaluate(()=>new Promise(requestAnimationFrame));
    await page.screenshot({path:path.join(root,'gym.png')});
    fs.writeFileSync(path.join(root,'browser-version.txt'),browser.version()+'\n');
  } finally {
    fs.writeFileSync(path.join(root,'runtime.log'),lines.join('\n'));
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
  fs.writeFileSync(path.join(root,'gym-result.json'),JSON.stringify(result,null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
