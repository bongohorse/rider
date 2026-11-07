'use strict';
// #560: the decoration tool through real pointer, keyboard and DOM input. Observers only.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{configure}=require('./launch.cjs'),pointer=require('./pointer.cjs');
const EXPECTED=['place','move','placement','lock_copy_delete','undo_redo','reload_play'];
async function main(){
 const [output,sha,runId,kind,bundleArg]=process.argv.slice(2);assert.equal(kind,'deco560');
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
  const fixture={schema:1,units:'metres',id:'deco-560',name:'Decor tool',spawn:[0,1.2],start_speed:0,run_in:0,run_out:0,bounds:[-30,60,-10,40],chains:[[[40,0],[-20,0]]],hulls:[],labels:[],checkpoints:[],
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
  await page.waitForTimeout(800);await page.screenshot({path:path.join(out,'decoration-panel.png')});report.panel_probe=await page.evaluate(()=>{const e=document.elementFromPoint(1100,600);return {tag:e?.tagName,id:e?.id,panel:document.querySelector('#rider-decoration-panel').getBoundingClientRect().toJSON()};});
  // Place: choose an asset and placement in the panel, click near the run; snaps onto the line.
  let r=await rev();
  await dom('[data-decoration-asset="rock-large"]');await dom('[data-decoration-placement="front"]');
  await click([2,1.5]);await revision(r+1);
  let list=await items();assert.equal(list.length,1);assert.equal(list[0].asset,'rock-large');assert.equal(list[0].placement,'front');assert.equal(list[0].source,'o1');
  assert.ok(Math.abs(list[0].distance-22)<.3,`snapped distance ${list[0].distance}`);assert.equal(list[0].offset,0);assert.equal((await doc()).editor_version,16);
  await page.waitForFunction(()=>window.riderDecorationState?.objects===1);report.cases.place=list[0];
  // Move: one drag is one Undo step and follows the track.
  r=await rev();const from=await world([2,.5]),to=await world([5,1]);
  await page.locator('canvas').focus();await page.waitForTimeout(1100);await page.mouse.move(from.x,from.y);await pointer.frames(page);await page.mouse.down();await pointer.frames(page);await page.mouse.move(to.x,to.y,{steps:5});await pointer.frames(page);await page.mouse.up();await pointer.frames(page,{n:8});await revision(r+1);
  assert.equal(await rev(),r+1,'one drag, one revision');list=await items();assert.equal(list.length,1,'a drag places nothing');assert.ok(Math.abs(list[0].distance-25)<.3,`moved to ${list[0].distance}`);report.cases.move=list[0];
  // Placement of the selected object.
  r=await rev();await dom('[data-decoration-placement="behind"]');await revision(r+1);list=await items();assert.equal(list[0].placement,'behind');
  await page.waitForFunction(()=>window.riderDecorationState?.items?.[0]?.z===-3);report.cases.placement=list[0];
  // Lock refuses change; copy and delete work; Delete key too.
  r=await rev();await dom('#rider-decoration-locked');await revision(r+1);assert.equal((await items())[0].locked,true);
  r=await rev();await dom('[data-decoration-placement="body"]');await page.waitForFunction(()=>/Locked/.test(document.querySelector('#rider-decoration-note').textContent));assert.equal(await rev(),r,'locked: no revision');assert.equal((await items())[0].placement,'behind');
  await dom('#rider-decoration-locked');await revision(r+1);
  r=await rev();await dom('#rider-decoration-copy');await revision(r+1);list=await items();assert.equal(list.length,2);assert.notEqual(list[0].id,list[1].id);
  r=await rev();await key('Delete');await revision(r+1);assert.equal((await items()).length,1);report.cases.lock_copy_delete=await items();
  // Undo restores the delete, Redo repeats it.
  r=await rev();await key('z',['Control']);await page.waitForFunction(()=>window.riderEditorDoc?.decorations?.items?.length===2);
  await key('y',['Control']);await page.waitForFunction(()=>window.riderEditorDoc?.decorations?.items?.length===1);report.cases.undo_redo={after:await items()};
  // Durable reload, then Play shows it.
  const kept=await items();await page.waitForTimeout(1100);await page.waitForFunction(()=>window.riderEditor.status==='Saved'&&!window.riderEditor.dirty&&window.riderCustom.syncState()==='saved',null,{timeout:20000});
  await page.goto(base+'?station=custom');await page.waitForFunction(()=>window.riderEditor||window.riderTelemetry?.sequence>2,null,{timeout:60000});await page.waitForTimeout(1000);
  if(await page.evaluate(()=>window.riderEditor?.mode!=='edit'))await key('e');
  await page.waitForFunction(()=>window.riderEditor?.mode==='edit'&&window.riderEditor?.screen&&window.riderEditorDoc?.decorations,null,{timeout:30000});assert.deepEqual(await items(),kept);
  await tapButton('play');await page.waitForFunction(()=>window.riderEditor?.mode!=='edit'&&window.riderDecorationState?.objects===1&&window.riderDecorationState?.items?.[0]?.id==null,null,{timeout:30000});
  report.cases.reload_play=await page.evaluate(()=>window.riderDecorationState);await page.screenshot({path:path.join(out,'decoration-play.png')});
  assert.deepEqual(report.errors,[]);assert.deepEqual(Object.keys(report.cases),EXPECTED);report.status='PASS';
 }catch(e){report.failure=e.stack;if(page)await page.screenshot({path:path.join(out,'decoration-failure.png')}).catch(()=>{});}
 finally{fs.writeFileSync(path.join(out,'decoration560-result.json'),JSON.stringify(report,null,2)+'\n');if(browser)await browser.close();if(server)server.close();}
 console.log(JSON.stringify({status:report.status,cases:Object.keys(report.cases),failure:report.failure}));return report.status==='PASS'?0:1;
}
module.exports={EXPECTED};if(require.main===module)main().then(code=>process.exitCode=code).catch(e=>{console.error(e);process.exitCode=1;});
