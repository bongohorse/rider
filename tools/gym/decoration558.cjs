'use strict';
// #558: decoration draw order, tilt and culling in the real engine. Observer only; no renderer or camera writes.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{configure}=require('./launch.cjs');
const EXPECTED=['empty','order','tilt','culling'];
const near=(a,b,eps,why)=>assert.ok(Math.abs(a-b)<=eps,`${why}: ${a} ~ ${b}`);
// The compiled anchors of the two straight sources, as the editor compiler writes them.
function compiled(o){
 const slope=o.source==='o2',c=Math.SQRT1_2;
 return {asset:o.asset,placement:o.placement,angle:slope&&o.tilt?Math.PI/4:0,position:slope?[60+o.distance*c-o.offset*c,20+o.distance*c+o.offset*c]:[-20+o.distance,o.offset]};
}
function level(items){
 const chain=[[60,0],[20,0],[-20,0]];
 const anchors=items.map((o,i)=>({id:'d'+(i+1),source:'o1',tilt:true,offset:0,...o}));
 const editor={editor_version:16,compiler_version:16,revision:1,next_id:3,sampling:{tolerance:.005,max_segment:.5},start:{position:[0,1.2],speed:0},connections:[],
  objects:[{id:'o1',type:'line',points:[[-20,0],[20,0],[60,0]]},{id:'o2',type:'line',points:[[60,20],[80,40]]}],
  decorations:{version:1,next_id:items.length+1,items:anchors}};
 return {schema:8,units:'metres',id:'deco-558',name:'Decorations',spawn:[0,1.2],start_speed:0,run_in:0,run_out:0,bounds:[-30,90,-10,60],chains:[chain,[[80,40],[60,20]]],hulls:[],labels:[],checkpoints:[],
  decorations:{version:1,items:anchors.map(compiled)},editor};
}
async function main(){
 const [output,sha,runId,kind,bundleArg]=process.argv.slice(2);assert.equal(kind,'deco558');
 const out=path.resolve(output),bundle=path.resolve(bundleArg);fs.mkdirSync(out,{recursive:true});
 const manifest=JSON.parse(fs.readFileSync(path.join(bundle,'bundle.json')));assert.equal(manifest.source_sha,sha);
 const indexes=Object.keys(manifest.files).filter(x=>x.endsWith('/index.html')||x==='index.html');assert.equal(indexes.length,1);
 const web=path.dirname(path.join(bundle,indexes[0]));let browser,page,server;
 const report={schema_version:1,source_sha:sha,run_id:runId,status:'FAIL',cases:{},errors:[],not_run:['physical device','GPU cost','art acceptance']};
 try{
  server=http.createServer((req,res)=>{const file=path.resolve(web,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(web+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}const types={'.html':'text/html','.js':'text/javascript','.wasm':'application/wasm'};res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);});
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));browser=await chromium.launch();report.browser=browser.version();
  page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});await configure(page,runId,kind);
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))report.errors.push(m.text());});
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html?station=straight`);
  await page.waitForFunction(()=>window.riderTelemetry?.sequence>2,null,{timeout:60000});
  report.cases.empty={state:await page.evaluate(()=>window.riderDecorationState??null)};assert.equal(report.cases.empty.state,null);
  async function load(items){
   const fixture=level(items);
   await page.evaluate(()=>{window.riderDecorationState=null;window.riderCustom.open();});
   await page.locator('#rider-custom-text').fill(JSON.stringify(fixture));
   await page.getByRole('button',{name:'Import text',exact:true}).click();
   await page.waitForFunction(n=>window.riderCustomStatus==='Saved'&&(n===0||window.riderDecorationState?.objects===n),items.length,{timeout:60000});
   await page.waitForTimeout(1500);
   return page.evaluate(()=>window.riderDecorationState);
  }
  // Count pixels that differ from a decoration-free frame in a box clear of HUD and vehicle.
  let shots=0;const shot=async()=>{const b=await page.screenshot({clip:{x:900,y:540,width:270,height:140}});fs.writeFileSync(path.join(out,`deco-${++shots}.png`),b);return b.toString('base64');};
  const diff=(a,b)=>page.evaluate(async([a,b])=>{
   const read=async s=>{const i=await createImageBitmap(await (await fetch('data:image/png;base64,'+s)).blob());const c=new OffscreenCanvas(i.width,i.height),g=c.getContext('2d');g.drawImage(i,0,0);return g.getImageData(0,0,i.width,i.height).data;};
   const x=await read(a),y=await read(b);let n=0,sum=0;
   for(let i=0;i<x.length;i+=4){const d=Math.abs(x[i]-y[i])+Math.abs(x[i+1]-y[i+1])+Math.abs(x[i+2]-y[i+2]);if(d>24){n++;sum+=y[i]+y[i+1]+y[i+2];}}
   return {changed:n,brightness:n?sum/n:0};
  },[a,b]);
  // Under load the vehicle and camera settle slowly: measure only once two frames a second apart agree.
  const settled=async()=>{let last=await shot();for(let i=0;i<30;i++){await page.waitForTimeout(1000);const next=await shot();if((await diff(last,next)).changed<40)return next;last=next;}throw Error('view never settled');};
  await load([]);const blank=await settled();
  // A large rock wholly below the driving line, away from the vehicle.
  const rock=placement=>[{distance:24,offset:-1.3,placement,asset:'rock-large'}];
  const behind=await load(rock('behind'));const behindDiff=await diff(blank,await settled());
  const body=await load(rock('body'));const bodyDiff=await diff(blank,await settled());
  const front=await load(rock('front'));const frontDiff=await diff(blank,await settled());
  assert.ok(behind.items[0].z<-2.8&&body.items[0].z>-2&&body.items[0].z<0&&front.items[0].z>2,'engine z order');
  assert.ok(behindDiff.changed<40,`terrain hides Behind: ${behindDiff.changed}`);
  assert.ok(bodyDiff.changed>1000&&frontDiff.changed>1000,'Body and Front draw over terrain');
  assert.ok(bodyDiff.brightness<frontDiff.brightness*.7,'Body is darkened');
  report.cases.order={behind:behindDiff,body:bodyDiff,front:frontDiff,z:[behind.items[0].z,body.items[0].z,front.items[0].z]};
  // Fixed poses on a slope: engine rotation equals the segment angle, and tilt off stays upright.
  const slope=[{source:'o2',distance:5,placement:'front',asset:'cone'},{source:'o2',distance:5,tilt:false,placement:'front',asset:'cone'}];
  const tilted=await load(slope);
  near(tilted.items[0].rotation_z,45,.01,'tilted euler');near(tilted.items[1].rotation_z,0,.01,'upright euler');
  const ax=60+5*Math.SQRT1_2,lift=.875/2-.02;near(tilted.items[0].x,(ax-Math.SQRT1_2*lift)*100,.01,'tilted x');near(tilted.items[1].x,ax*100,.01,'upright x');
  report.cases.tilt=tilted.items;
  // The slope lies far off-screen from the start and is culled; a decoration at the vehicle stays on.
  const mixed=await load([{distance:20,placement:'front',asset:'cone'},{source:'o2',distance:5,placement:'front',asset:'cone'}]);
  assert.equal(mixed.objects,2);assert.equal(mixed.items[0].on,true);assert.equal(mixed.items[1].on,false);assert.equal(mixed.visible,1);
  report.cases.culling=mixed;
  assert.deepEqual(report.errors,[]);assert.deepEqual(Object.keys(report.cases),EXPECTED);report.status='PASS';
 }catch(e){report.failure=e.stack;}
 finally{fs.writeFileSync(path.join(out,'decoration558-result.json'),JSON.stringify(report,null,2)+'\n');if(browser)await browser.close();if(server)server.close();}
 console.log(JSON.stringify({status:report.status,cases:Object.keys(report.cases),failure:report.failure}));return report.status==='PASS'?0:1;
}
module.exports={EXPECTED};if(require.main===module)main().then(code=>process.exitCode=code).catch(e=>{console.error(e);process.exitCode=1;});
