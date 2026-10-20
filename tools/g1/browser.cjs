// Each invocation creates a fresh browser context. Completion, not sleep, ends the run.
// Modes (#215): "isolated" serves COOP/COEP, so the browser loads the pthread
// engine; "players" serves like GitHub Pages (no COOP/COEP), so it loads the
// wasm-web engine players get. Each run records and asserts the engine it loaded.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const MODES = {
  isolated: {headers: {'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp'},
             wasm: 'RiderG1_pthread.wasm', isolated: true},
  players: {headers: {}, wasm: 'RiderG1.wasm', isolated: false},
};

function mode(name) {
  if (!Object.hasOwn(MODES, name)) throw Error(`Unknown G1 browser mode ${name}`);
  return MODES[name];
}

function headersFor(name, mime) {
  return {'Content-Type': mime, ...mode(name).headers};
}

// Fails unless the page loaded exactly the engine its mode stands for.
function checkEngineLoad(name, load) {
  const expected = mode(name);
  const problems = [];
  if (JSON.stringify(load.wasm) !== JSON.stringify([expected.wasm]))
    problems.push(`loaded ${JSON.stringify(load.wasm)}, expected exactly ["${expected.wasm}"]`);
  if (load.cross_origin_isolated !== expected.isolated)
    problems.push(`crossOriginIsolated is ${load.cross_origin_isolated}, expected ${expected.isolated}`);
  if (load.pthread_supported !== expected.isolated)
    problems.push(`Module.isWASMPthreadSupported is ${load.pthread_supported}, expected ${expected.isolated}`);
  if (expected.isolated) {
    if (!load.shared_array_buffer || !load.heap_shared) problems.push('the pthread engine does not run on a SharedArrayBuffer heap');
  } else if (load.shared_array_buffer && load.heap_shared) {
    problems.push('the players engine runs on a SharedArrayBuffer heap');
  }
  if (problems.length) throw Error(`Wrong engine for G1 browser mode "${name}": ${problems.join('; ')}`);
  return {mode: name, ...load};
}

async function main() {
  const {chromium} = require('playwright');
  const root=path.resolve(process.argv[2]), result=process.argv[3];
  const modeName=process.argv[4]||'isolated', out=path.resolve(process.argv[5]||root);
  mode(modeName);
  fs.mkdirSync(out,{recursive:true});
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
    res.writeHead(200,headersFor(modeName,mime));
    fs.createReadStream(p).pipe(res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;const lines=[],errors=[],wasm=[];
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
    page.on('request',request=>{const name=path.posix.basename(new URL(request.url()).pathname);if(name.endsWith('.wasm'))wasm.push(name);});
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
    let timer;
    try {await Promise.race([done,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Missing browser completion')),60000);})]);}
    finally {clearTimeout(timer);}
    let load;
    try {
      load=await page.evaluate(()=>({
        cross_origin_isolated: window.crossOriginIsolated,
        shared_array_buffer: typeof SharedArrayBuffer!=='undefined',
        pthread_supported: Module.isWASMPthreadSupported===true,
        heap_shared: typeof SharedArrayBuffer!=='undefined'&&!!Module.HEAP8&&Module.HEAP8.buffer instanceof SharedArrayBuffer,
      }));
    } catch(e) {
      // A crashed page cannot be inspected; its own error stays the primary one.
      if(errors.length)throw Error(errors.join('\n'));
      throw e;
    }
    fs.writeFileSync(path.join(out,'engine-load.json'),JSON.stringify({mode:modeName,wasm,...load},null,2)+'\n');
    await page.screenshot({path:path.join(out,'browser.png')});
    fs.writeFileSync(path.join(out,'browser-version.txt'),browser.version()+'\n');
    if(errors.length)throw Error(errors.join('\n'));
    checkEngineLoad(modeName,{wasm,...load});
  } finally {
    fs.writeFileSync(result,JSON.stringify(lines));
    fs.writeFileSync(path.join(out,'runtime.log'),lines.join('\n')+'\n'+errors.join('\n'));
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
}

module.exports = {MODES, headersFor, checkEngineLoad};
if (require.main === module) main().catch(e=>{console.error(e);process.exitCode=1;});
