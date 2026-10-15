// Exercise the same loader and release bundle locally and after deployment.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
async function main(){
  const [target,sha,out]=process.argv.slice(2);
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
    for(const spec of [{name:'desktop',viewport:{width:1280,height:720}},
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
      if(!current.pathname.endsWith('/builds/'+sha+'/index.html')||current.search!=='?preview-check=1'||current.hash!=='#verify')throw Error('Loader lost build identity/query/fragment');
      // Wait for two rendered frames after READY; readiness is not a device/feel result.
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await page.screenshot({path:path.join(out,spec.name+'.png')});
      fs.writeFileSync(path.join(out,spec.name+'.log'),logs.join('\n'));
      if(errors.length)throw Error(errors.join('\n'));
      results.push({name:spec.name,status:'PASS',url:page.url(),viewport:spec.viewport});
      await context.close();
    }
    fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({source_sha:sha,status:'PASS',browser:browser.version(),real_device:'NOT RUN',cases:results},null,2));
    console.log(JSON.stringify({source_sha:sha,status:'PASS',cases:results}));
  }finally{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
