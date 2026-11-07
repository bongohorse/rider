'use strict';
// #560: the decoration tool through real pointer, keyboard and DOM input. Observers only.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{configure}=require('./launch.cjs'),pointer=require('./pointer.cjs');
const EXPECTED=['place','move','quick_bar','placement','lock_copy_delete','undo_redo','reload_play'];
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
  await page.waitForTimeout(800);await page.screenshot({path:path.join(out,'decoration-panel.png')});
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
  // Quick bar above the selected object: a live offset moves it before release, release is one Undo step; size likewise.
  await page.waitForFunction(()=>{const b=document.querySelector('#rider-decoration-bar');return b&&!b.hidden;});
  const box=await page.locator('#rider-decoration-bar').boundingBox(),spot=await world([5,1]);assert.ok(Math.abs(box.x+box.width/2-spot.x)<40,'bar centred on the object');assert.ok(box.y+box.height<spot.y,'bar above the object');
  const y0=(await page.evaluate(()=>window.riderDecorationState.items[0].y));r=await rev();
  await page.evaluate(()=>{const n=document.querySelector('#rider-bar-offset');n.value='1.5';n.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.waitForFunction(y0=>window.riderDecorationState.items[0].y>y0+50,y0);assert.equal(await rev(),r,'live: no revision');
  assert.equal(await page.locator('#rider-bar-offset-output').textContent(),'1.50 m');
  await page.evaluate(()=>{const n=document.querySelector('#rider-bar-offset');n.dispatchEvent(new Event('change',{bubbles:true}));});await revision(r+1);assert.equal((await items())[0].offset,1.5);
  // An unfinished drag never sticks: Undo drops the live value.
  await page.evaluate(()=>{const n=document.querySelector('#rider-bar-offset');n.value='3';n.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.waitForFunction(y0=>window.riderDecorationState.items[0].y>y0+200,y0);
  await key('z',['Control']);await page.waitForFunction(()=>window.riderEditorDoc.decorations.items[0].offset===0);
  await page.waitForFunction(y0=>Math.abs(window.riderDecorationState.items[0].y-y0)<5,y0);
  await key('y',['Control']);await page.waitForFunction(()=>window.riderEditorDoc.decorations.items[0].offset===1.5);
  await page.evaluate(()=>{delete document.querySelector('#rider-bar-offset').dataset.live;});
  r=await rev();await page.locator('#rider-bar-scale').fill('1.5');await revision(r+1);assert.equal((await items())[0].scale,1.5);
  r=await rev();await page.locator('#rider-bar-scale').fill('1');await revision(r+1);assert.equal((await items())[0].scale,undefined,'size 1 is stored as default');
  // Reset: double-click or ↺ puts the offset back to 0; the bar does not move while a control is held.
  const held=await page.locator('#rider-decoration-bar').boundingBox();const knob=await page.locator('#rider-bar-offset').boundingBox();
  await page.mouse.move(knob.x+knob.width/2,knob.y+knob.height/2);await page.mouse.down();await page.mouse.move(knob.x+knob.width*.9,knob.y+knob.height/2,{steps:4});await pointer.frames(page,{n:10});
  const moved=await page.locator('#rider-decoration-bar').boundingBox();assert.ok(Math.abs(moved.y-held.y)<1&&Math.abs(moved.x-held.x)<1,'bar holds still while dragging');
  await page.mouse.up();await pointer.frames(page,{n:10});
  r=await rev();await dom('#rider-bar-offset-reset');await revision(r+1);assert.equal((await items())[0].offset,0,'reset');
  // Transform box: a corner drag sizes, the top handle moves the offset, a knob rotates; each release is one step.
  const drag=async(sel,dx,dy)=>{const b=await page.locator(sel).boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:6});await pointer.frames(page,{n:6});await page.mouse.up();await pointer.frames(page,{n:8});};
  await page.waitForFunction(()=>!document.querySelector('#rider-decoration-gizmo').hidden);
  r=await rev();await drag('#rider-gizmo-tr',30,-30);await revision(r+1);assert.ok((await items())[0].scale>1.1,'corner sizes '+(await items())[0].scale);
  r=await rev();await drag('#rider-gizmo-top',0,-40);await revision(r+1);assert.ok((await items())[0].offset>.2,'top handle offsets '+(await items())[0].offset);
  r=await rev();await drag('#rider-gizmo-rot-r',0,60);await revision(r+1);assert.ok(Math.abs((await items())[0].rotation||0)>5,'knob rotates '+(await items())[0].rotation);
  report.gizmo=await items();
  for(let i=0;i<3;i++){r=await rev();await key('z',['Control']);await revision(r+1);}
  assert.equal((await items())[0].rotation,undefined);assert.equal((await items())[0].scale,undefined);
  assert.equal(await page.locator('[data-bar-placement="front"]').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(143, 224, 192)','active is filled');
  await page.screenshot({path:path.join(out,'decoration-bar.png')});report.cases.quick_bar=await items();
  // Placement of the selected object.
  r=await rev();await dom('[data-decoration-placement="behind"]');await revision(r+1);list=await items();assert.equal(list[0].placement,'behind');
  await page.waitForFunction(()=>window.riderDecorationState?.items?.[0]?.z===-3);report.cases.placement=list[0];
  // Lock refuses change; copy and delete work; Delete key too.
  r=await rev();await dom('#rider-decoration-locked');await revision(r+1);assert.equal((await items())[0].locked,true);
  r=await rev();await dom('[data-decoration-placement="body"]');await page.waitForFunction(()=>/Locked/.test(document.querySelector('#rider-decoration-note').textContent));assert.equal(await rev(),r,'locked: no revision');assert.equal((await items())[0].placement,'behind');
  await dom('#rider-decoration-locked');await revision(r+1);assert.equal((await items())[0].locked,undefined,'unlock clears the flag');
  r=await rev();await dom('#rider-decoration-copy');await revision(r+1);list=await items();assert.equal(list.length,2);assert.notEqual(list[0].id,list[1].id);
  r=await rev();await key('Delete');await revision(r+1);assert.equal((await items()).length,1);report.cases.lock_copy_delete=await items();
  // Undo restores the delete, Redo repeats it.
  r=await rev();await key('z',['Control']);await page.waitForFunction(()=>window.riderEditorDoc?.decorations?.items?.length===2);
  await key('y',['Control']);await page.waitForFunction(()=>window.riderEditorDoc?.decorations?.items?.length===1);report.cases.undo_redo={after:await items()};
  // Leaving the tool hides the quick bar with the panel, whichever way it closes.
  const at=async()=>{const o=await page.evaluate(()=>window.riderDecorationState.items[0]);return [o.x/100,o.y/100];};
  await click(await at());await page.waitForFunction(()=>!document.querySelector('#rider-decoration-bar').hidden);
  await tapButton('tool_select');await pointer.frames(page,{n:10});await page.waitForFunction(()=>!window.riderDecorationPanel.visible);
  assert.ok(await page.evaluate(()=>document.querySelector('#rider-decoration-bar').hidden),'bar gone with another tool');
  await tapButton('tool_decoration');await page.waitForFunction(()=>window.riderDecorationPanel?.visible);await click(await at());await page.waitForFunction(()=>!document.querySelector('#rider-decoration-bar').hidden);
  await tapButton('tool_decoration');await page.waitForFunction(()=>!window.riderDecorationPanel.visible);
  assert.ok(await page.evaluate(()=>document.querySelector('#rider-decoration-bar').hidden),'Decor toggles off with its bar');
  await tapButton('tool_decoration');await page.waitForFunction(()=>window.riderDecorationPanel?.visible);await click(await at());await page.waitForFunction(()=>!document.querySelector('#rider-decoration-bar').hidden);
  await dom('#rider-decoration-close');await page.waitForFunction(()=>!window.riderDecorationPanel.visible);
  assert.ok(await page.evaluate(()=>document.querySelector('#rider-decoration-bar').hidden),'bar gone with Close');
  // Durable reload, then Play shows it.
  const kept=await items();await page.waitForTimeout(1100);await page.waitForFunction(()=>window.riderEditor.status==='Saved'&&!window.riderEditor.dirty&&window.riderCustom.syncState()==='saved',null,{timeout:20000});
  await page.goto(base+'?station=custom');await page.waitForFunction(()=>window.riderEditor||window.riderTelemetry?.sequence>2,null,{timeout:60000});await page.waitForTimeout(1000);
  if(await page.evaluate(()=>window.riderEditor?.mode!=='edit'))await key('e');
  await page.waitForFunction(()=>window.riderEditor?.mode==='edit'&&window.riderEditor?.screen&&window.riderEditorDoc?.decorations,null,{timeout:30000});assert.deepEqual(await items(),kept);
  // Play with an object selected: no Decor overlay stays on the drive.
  await tapButton('tool_decoration');await page.waitForFunction(()=>window.riderDecorationPanel?.visible);
  {const o=await page.evaluate(()=>window.riderDecorationState.items[0]);await click([o.x/100,o.y/100]);}
  await page.waitForFunction(()=>!document.querySelector('#rider-decoration-bar').hidden);
  // Picking another asset ends the selection: bar and box go.
  await dom('[data-decoration-asset="cone"]');await page.waitForFunction(()=>document.querySelector('#rider-decoration-bar').hidden&&document.querySelector('#rider-decoration-gizmo').hidden);
  {const o=await page.evaluate(()=>window.riderDecorationState.items[0]);await click([o.x/100,o.y/100]);}
  await page.waitForFunction(()=>!document.querySelector('#rider-decoration-bar').hidden);
  await tapButton('play');await page.waitForFunction(()=>window.riderEditor?.mode!=='edit'&&window.riderDecorationState?.objects===1&&window.riderDecorationState?.items?.[0]?.id==null,null,{timeout:30000});
  await pointer.frames(page,{n:20});
  assert.deepEqual(await page.evaluate(()=>['#rider-decoration-bar','#rider-decoration-gizmo','#rider-decoration-panel'].filter(s=>{const n=document.querySelector(s);return n&&!n.hidden;})),[],'no Decor overlay in Play');
  report.cases.reload_play=await page.evaluate(()=>window.riderDecorationState);await page.screenshot({path:path.join(out,'decoration-play.png')});
  assert.deepEqual(report.errors,[]);assert.deepEqual(Object.keys(report.cases),EXPECTED);report.status='PASS';
 }catch(e){report.failure=e.stack;if(page)await page.screenshot({path:path.join(out,'decoration-failure.png')}).catch(()=>{});}
 finally{fs.writeFileSync(path.join(out,'decoration560-result.json'),JSON.stringify(report,null,2)+'\n');if(browser)await browser.close();if(server)server.close();}
 console.log(JSON.stringify({status:report.status,cases:Object.keys(report.cases),failure:report.failure}));return report.status==='PASS'?0:1;
}
module.exports={EXPECTED};if(require.main===module)main().then(code=>process.exitCode=code).catch(e=>{console.error(e);process.exitCode=1;});
