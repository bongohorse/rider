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
          if(data.name==='throttle')await page.keyboard.down('ArrowUp');
          if(data.name==='brake')await page.keyboard.down('ArrowDown');
          if(data.name==='release_throttle')await page.keyboard.up('ArrowUp');
          if(data.name==='retry_held') {
            await page.keyboard.up('ArrowDown');await page.keyboard.down('ArrowUp');await page.keyboard.down('r');
          }
          if(data.name==='retry_release')await page.keyboard.up('r');
          if(data.name==='release_for_redrive')await page.keyboard.up('ArrowUp');
          if(data.name==='redrive')await page.keyboard.down('ArrowUp');
        }).catch(rejectDone);
        if(data.event==='suite_end')resolveDone(data);
      }
    });
    page.on('pageerror',e=>rejectDone(e));
    page.on('crash',()=>rejectDone(Error('Gym page crashed')));
    await page.goto('http://127.0.0.1:'+server.address().port+'/index.html');
    let timer;
    try {result=await Promise.race([done,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Gym suite timeout')),30000))]);}
    finally {clearTimeout(timer);}
    if(result.status!=='PASS')throw Error('Gym test failed');
    await input;
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
