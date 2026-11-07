'use strict';
// #617: Populate through real pointer, keyboard and DOM input. Observers only.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{configure}=require('./launch.cjs'),pointer=require('./pointer.cjs');
const EXPECTED=['populate','repeatable','undo','reload'];
async function main(){
 const [output,sha,runId,kind,bundleArg]=process.argv.slice(2);assert.equal(kind,'deco617');
 const out=path.resolve(output),bundle=path.resolve(bundleArg);fs.mkdirSync(out,{recursive:true});
 const manifest=JSON.parse(fs.readFileSync(path.join(bundle,'bundle.json')));assert.equal(manifest.source_sha,sha);
 const indexes=Object.keys(manifest.files).filter(x=>x.endsWith('/index.html')||x==='index.html');assert.equal(indexes.length,1);
 const web=path.dirname(path.join(bundle,indexes[0]));let browser,page,server;
 const report={schema_version:1,source_sha:sha,run_id:runId,status:'FAIL',cases:{},errors:[],not_run:['physical device','phone/GPU performance','tool feel and art acceptance']};
 try{
  server=http.createServer((req,res)=>{const file=path.resolve(web,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(web+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}const types={'.html':'text/html','.js':'text/javascript','.wasm':'application/wasm'};res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);});
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));browser=await chromium.launch();report.browser=browser.version();
  page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});await configure(page,runId,kind);
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))report.errors.push(m.text());});
  const base=`http://127.0.0.1:${server.address().port}/index.html`;
  await page.goto(base+'?station=first-run');await page.waitForFunction(()=>window.riderTelemetry?.sequence>5,null,{timeout:60000});
  const fixture={schema:1,units:'metres',id:'deco-617',name:'Decor tool',spawn:[0,1.2],start_speed:0,run_in:0,run_out:0,bounds:[-30,60,-10,40],chains:[[[40,0],[-20,0]]],hulls:[],labels:[],checkpoints:[],
   editor:{editor_version:13,compiler_version:13,revision:1,next_id:2,sampling:{tolerance:.005,max_segment:.5},start:{position:[0,1.2],speed:0},connections:[],objects:[{id:'o1',type:'line',points:[[-20,0],[40,0]]}]}};
  await page.evaluate(()=>window.riderCustom.open());await page.locator('#rider-custom-text').fill(JSON.stringify(fixture));
  await page.getByRole('button',{name:'Import text',exact:true}).click();await page.waitForFunction(()=>window.riderCustomStatus==='Saved',null,{timeout:60000});
  await page.waitForTimeout(1500);
  async function key(name,mods=[]){await page.locator('canvas').focus();for(const m of mods)await page.keyboard.down(m);await pointer.frames(page,{n:4});await page.keyboard.down(name);await pointer.frames(page,{n:6});await page.keyboard.up(name);for(const m of mods)await page.keyboard.up(m);await pointer.frames(page,{n:6});}
  const doc=()=>page.evaluate(()=>window.riderEditorDoc);const items=async()=>(await doc()).decorations?.items||[];
  const canvas=(x,y)=>page.evaluate(([x,y])=>{const c=document.querySelector('canvas'),r=c.getBoundingClientRect();return {x:r.x+x/c.width*r.width,y:r.y+(1-y/c.height)*r.height};},[x,y]);
  const world=async p=>{const s=(await page.evaluate(()=>window.riderEditor.screen));return canvas(s.ox+p[0]*s.ppm_x,s.oy+p[1]*s.ppm_y);};
  async function revision(n){await page.waitForFunction(n=>window.riderEditorDoc?.revision>=n,n,{timeout:10000});}
  const rev=async()=>(await doc()).revision;
  async function tapButton(name){await page.locator('canvas').focus();await page.waitForTimeout(1100);const point=await page.evaluate(name=>{const b=window.riderEditor.buttons[name],c=document.querySelector('canvas'),r=c.getBoundingClientRect();if(!b)throw Error('Missing editor button '+name);return {x:r.x+b.x*r.width/c.width,y:r.y+r.height-b.y*r.height/c.height};},name);await pointer.tap(page,point);await pointer.frames(page,{n:8});}
  async function click(p){await page.locator('canvas').focus();await page.waitForTimeout(1100);const q=await world(p);await pointer.tap(page,q);await pointer.frames(page,{n:8});}
  const dom=async sel=>{await page.locator(sel).click();await pointer.frames(page,{n:10});};
  await key('e');await page.waitForFunction(()=>window.riderEditor?.mode==='edit'&&window.riderEditor?.screen,null,{timeout:30000});await pointer.frames(page,{n:10});
  await tapButton('tool_decoration');await page.waitForFunction(()=>window.riderDecorationPanel?.visible);
  // Range: click, move (the edge follows), click; shown on the track.
  await dom('#rider-populate-range-button');await click([5.5,.5]);
  const mid=await world([7,.5]);await page.mouse.move(mid.x,mid.y,{steps:4});await pointer.frames(page,{n:8});
  await page.waitForFunction(()=>/Range x 5\.\d to 7\.\d/.test(document.querySelector('#rider-populate-stretch').textContent));
  await click([9,.5]);await page.waitForFunction(()=>/Range x 5\.\d to 9\.\d/.test(document.querySelector('#rider-populate-stretch').textContent));
  const band=await page.locator('#rider-populate-range').boundingBox(),e0=await world([5.5,.5]),e1=await world([9,.5]);
  assert.ok(Math.abs(band.x-e0.x)<6&&Math.abs(band.x+band.width-e1.x)<6,'range drawn over the track');
  for(const side of ['left','right'])assert.ok(await page.locator('#rider-populate-range-'+side).isVisible(),side+' edge grip');
  await page.locator('#rider-populate-density').fill('20');await page.locator('#rider-populate-spacing').fill('0.25');
  await dom('[data-decoration-placement="behind"]');
  // Live: checking assets shows the result at once, nothing stored.
  let r=await rev();await page.locator('[data-populate-asset="bush-round"]').check();await page.locator('[data-populate-asset="flowers"]').check();
  await page.waitForFunction(()=>(window.riderDecorationState?.objects||0)>3);assert.equal(await rev(),r,'live: no revision');
  // A range edge drags; the live result follows.
  const before=await page.evaluate(()=>window.riderDecorationState.objects);const g0=await world([9,.5]),g1=await world([12,.5]);
  await page.locator('canvas').focus();await page.waitForTimeout(1100);await page.mouse.move(g0.x,g0.y);await pointer.frames(page);await page.mouse.down();await pointer.frames(page);await page.mouse.move(g1.x,g1.y,{steps:5});await pointer.frames(page);await page.mouse.up();await pointer.frames(page,{n:8});
  await page.waitForFunction(()=>/Range x 5\.\d to 1[12]\.\d/.test(document.querySelector('#rider-populate-stretch').textContent));
  await page.waitForFunction(n=>window.riderDecorationState.objects>n,before);assert.equal(await rev(),r,'edge drag: no revision');
  const back=await world([9,.5]);const now=await world([12,.5]);
  await page.mouse.move(now.x,now.y);await pointer.frames(page);await page.mouse.down();await pointer.frames(page);await page.mouse.move(back.x,back.y,{steps:5});await pointer.frames(page);await page.mouse.up();await pointer.frames(page,{n:8});
  await page.waitForFunction(()=>/Range x 5\.\d to 9\.\d/.test(document.querySelector('#rider-populate-stretch').textContent));
  // Random seed changes the live result.
  const seed0=await page.locator('#rider-populate-seed').inputValue();await dom('#rider-populate-random');assert.notEqual(await page.locator('#rider-populate-seed').inputValue(),seed0,'random seed');
  await page.locator('#rider-populate-seed').fill('1');await pointer.frames(page,{n:8});
  r=await rev();await dom('#rider-populate-run');await revision(r+1);assert.equal(await rev(),r+1,'one action, one revision');
  let list=await items();assert.ok(list.length>3,`populated ${list.length}`);for(const o of list){assert.equal(o.generated,true);assert.equal(o.placement,'behind');assert.equal(o.source,'o1');assert.ok(o.distance>=25&&o.distance<=29.6,'inside the stretch: '+o.distance);assert.ok(Math.abs(o.distance-20)>=5,'clear of START');}
  await page.waitForFunction(n=>window.riderDecorationState?.objects===n,list.length);await page.screenshot({path:path.join(out,'populate.png')});report.cases.populate={count:list.length};
  const shape=l=>l.map(o=>[o.distance,o.asset,o.scale]);const once=shape(list);
  r=await rev();await dom('#rider-populate-run');await revision(r+1);assert.deepEqual(shape(await items()),once,'same seed, same result');
  r=await rev();await page.locator('#rider-populate-seed').fill('2');await dom('#rider-populate-run');await revision(r+1);assert.notDeepEqual(shape(await items()),once,'another seed differs');report.cases.repeatable=true;
  r=await rev();await tapButton('undo');await page.waitForFunction(r=>window.riderEditorDoc?.revision!==r,r);assert.deepEqual(shape(await items()),once,'one Undo restores');report.cases.undo=true;
  const kept=await items();await page.waitForTimeout(1100);await page.waitForFunction(()=>window.riderEditor.status==='Saved'&&!window.riderEditor.dirty&&window.riderCustom.syncState()==='saved',null,{timeout:20000});
  await page.goto(base+'?station=custom');await page.waitForFunction(()=>window.riderEditor||window.riderTelemetry?.sequence>2,null,{timeout:60000});await page.waitForTimeout(1000);
  if(await page.evaluate(()=>window.riderEditor?.mode!=='edit'))await key('e');
  await page.waitForFunction(()=>window.riderEditor?.mode==='edit'&&window.riderEditorDoc?.decorations,null,{timeout:30000});assert.deepEqual(await items(),kept);report.cases.reload={count:kept.length};
  assert.deepEqual(report.errors,[]);assert.deepEqual(Object.keys(report.cases),EXPECTED);report.status='PASS';
 }catch(e){report.failure=e.stack;if(page)await page.screenshot({path:path.join(out,'decoration-failure.png')}).catch(()=>{});}
 finally{fs.writeFileSync(path.join(out,'decoration617-result.json'),JSON.stringify(report,null,2)+'\n');if(browser)await browser.close();if(server)server.close();}
 console.log(JSON.stringify({status:report.status,cases:Object.keys(report.cases),failure:report.failure}));return report.status==='PASS'?0:1;
}
module.exports={EXPECTED};if(require.main===module)main().then(code=>process.exitCode=code).catch(e=>{console.error(e);process.exitCode=1;});
