// Each invocation creates a fresh browser context. Completion, not sleep, ends the run.
const {chromium} = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
async function main() {
  const root=path.resolve(process.argv[2]), result=process.argv[3];
  function find(dir) {for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    const p=path.join(dir,entry.name); if(entry.isDirectory()) {const hit=find(p);if(hit)return hit;}
    else if(entry.name==='index.html')return p;
  }}
  const index=find(root); if(!index)throw Error('Missing bundled index.html');
  const web=path.dirname(index);
  const server=http.createServer((req,res)=>{
    const target=path.resolve(web,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if(!target.startsWith(web+path.sep)&&target!==web){res.writeHead(403);res.end();return;}
    const p=target===web?path.join(web,'index.html'):target;
    if(!fs.existsSync(p)||fs.statSync(p).isDirectory()){res.writeHead(404);res.end();return;}
    const mime={'.wasm':'application/wasm','.js':'text/javascript','.html':'text/html','.json':'application/json'}[path.extname(p)]||'application/octet-stream';
    res.writeHead(200,{'Content-Type':mime,'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'});
    fs.createReadStream(p).pipe(res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;const lines=[],errors=[];
  try {
    browser=await chromium.launch();
    const context=await browser.newContext();const page=await context.newPage();
    let complete;
    const done=new Promise(resolve=>complete=resolve);
    page.on('console',msg=>{const line=msg.text();lines.push(line);
      if(line.includes('RIDER_G1 ')){try {const data=JSON.parse(line.split('RIDER_G1 ')[1]);if(data.event==='suite_end')complete();}catch(e){errors.push(String(e));}}
    });
    page.on('pageerror',e=>{errors.push(String(e));complete();});
    page.on('crash',()=>{errors.push('Page crash');complete();});
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
    let timer;
    try {await Promise.race([done,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Missing browser completion')),60000);})]);}
    finally {clearTimeout(timer);}
    await page.screenshot({path:path.join(root,'browser.png')});
    fs.writeFileSync(path.join(root,'browser-version.txt'),browser.version()+'\n');
    if(errors.length)throw Error(errors.join('\n'));
  } finally {
    fs.writeFileSync(result,JSON.stringify(lines));
    fs.writeFileSync(path.join(root,'runtime.log'),lines.join('\n')+'\n'+errors.join('\n'));
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
