// Regenerates (or with --check compares) the A19b Bumps station and its editor source from a debug gym
// bundle: node tools/gym/bumps_station.cjs <debug-bundle> [--check]
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const geometry=require('./bumps_geometry.cjs');
const ROOT=path.resolve(__dirname,'../..');
function find(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()){const v=find(p);if(v)return v;}else if(e.name==='index.html')return p;}}
// Serves a debug bundle on a loopback port; returns the base URL and a close function.
async function serve(bundle){
 const web=path.dirname(find(path.resolve(bundle)));
 const server=http.createServer((req,res)=>{const f=path.resolve(web,'.'+new URL(req.url,'http://localhost').pathname);if(!f.startsWith(web+path.sep)||!fs.existsSync(f)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',f.endsWith('.wasm')?'application/wasm':f.endsWith('.js')?'text/javascript':'text/html');fs.createReadStream(f).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 return {base:'http://127.0.0.1:'+server.address().port+'/index.html',close:()=>new Promise(r=>server.close(r))};
}
// Both generated files with their expected bytes; check() lists files that differ.
function outputs(station){return [[geometry.SOURCE.file,geometry.text(geometry.source())],[geometry.STATION_FILE,geometry.text(station)]];}
function differing(station){return outputs(station).filter(([file,bytes])=>!fs.existsSync(path.join(ROOT,file))||fs.readFileSync(path.join(ROOT,file),'utf8')!==bytes).map(([file])=>file);}
module.exports={serve,outputs,differing};
if(require.main===module)(async()=>{
 const [bundle,flag]=process.argv.slice(2);
 if(!bundle||(flag&&flag!=='--check'))throw Error('usage: node tools/gym/bumps_station.cjs <debug-bundle> [--check]');
 const {base,close}=await serve(bundle);let browser;
 try{
  browser=await chromium.launch();
  const station=await geometry.compile(browser,base,crypto.randomUUID());
  if(flag==='--check'){
   const stale=differing(station);
   if(stale.length)throw Error('Stale generated geometry: '+stale.join(', ')+' (run without --check)');
   console.log(JSON.stringify({status:'PASS',chain_points:station.chains[0].length}));
  }else{
   for(const [file,bytes] of outputs(station))fs.writeFileSync(path.join(ROOT,file),bytes);
   console.log(JSON.stringify({written:outputs(station).map(([f])=>f),chain_points:station.chains[0].length}));
  }
 }finally{if(browser)await browser.close();await close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
