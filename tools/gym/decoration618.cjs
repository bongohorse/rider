'use strict';
// #618: fences through real pointer, keyboard and DOM input. Observers only.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{configure}=require('./launch.cjs'),pointer=require('./pointer.cjs');
const EXPECTED=['no_gap','placed','undo','reload'];
async function main(){
 const [output,sha,runId,kind,bundleArg]=process.argv.slice(2);assert.equal(kind,'deco618');
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
  const fixture={schema:1,units:'metres',id:'deco-618',name:'Decor tool',spawn:[0,1.2],start_speed:0,run_in:0,run_out:0,bounds:[-30,60,-10,40],chains:[[[40,0],[-20,0]]],hulls:[],labels:[],checkpoints:[],
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
  // Fixed pose in Play: flat, slope and curve inside one fence.
  const line=[[-20,0],[1,0],[3,1],[4,1.6],[5,1.9],[6,2],[30,2]];
  const play={...fixture,id:'deco-618-a',schema:8,chains:[[...line].reverse()],decorations:{version:1,items:[],fences:[{points:line.slice(0).filter(p=>p[0]>=1&&p[0]<=6),placement:'front',asset:'fence-wood'}]},
   editor:{...fixture.editor,editor_version:16,compiler_version:16,objects:[{id:'o1',type:'line',points:line}],decorations:{version:1,next_id:2,items:[{id:'d1',source:'o1',distance:21,to:21+Math.hypot(2,1)+Math.hypot(1,.6)+Math.hypot(1,.3)+Math.hypot(1,.1),offset:0,placement:'front',tilt:true,asset:'fence-wood'}]}}};
  const blank={...play,id:'deco-618-b',schema:1,decorations:undefined,editor:{...play.editor,editor_version:13,compiler_version:13,decorations:undefined}};
  async function importLevel(l){await page.keyboard.press('Escape').catch(()=>{});await page.evaluate(()=>window.riderCustom.open());await page.locator('#rider-custom-text').fill(JSON.stringify(l));await page.getByRole('button',{name:'Import text',exact:true}).click();await page.waitForFunction(id=>window.riderCustomStatus==='Saved'&&window.riderTelemetry?.station===id,l.id,{timeout:60000});await page.waitForTimeout(800);}
  const PLAY_CLIP={x:760,y:300,width:400,height:300};
  const settled=async()=>{let last=null;for(let i=0;i<30;i++){const b=(await page.screenshot({clip:PLAY_CLIP})).toString('base64');if(last===b)return b;last=b;await page.waitForTimeout(700);}return last;};
  await tapButton('play');await page.waitForFunction(()=>window.riderEditor?.mode!=='edit',null,{timeout:30000});
  await importLevel(blank);const empty=await settled();await importLevel(play);await page.waitForFunction(()=>window.riderDecorationState?.fences?.length===1);const fenced=await settled();
  fs.writeFileSync(path.join(out,'fence-play.png'),Buffer.from(fenced,'base64'));
  const columns=await page.evaluate(async([a,b])=>{const read=async s=>{const i=await createImageBitmap(await (await fetch('data:image/png;base64,'+s)).blob());const c=new OffscreenCanvas(i.width,i.height),g=c.getContext('2d');g.drawImage(i,0,0);return {d:g.getImageData(0,0,i.width,i.height).data,w:i.width,h:i.height};};const x=await read(a),y=await read(b);const out=[];for(let c=0;c<x.w;c++){let n=0;for(let r=0;r<x.h;r++){const k=(r*x.w+c)*4;if(Math.abs(x.d[k]-y.d[k])+Math.abs(x.d[k+1]-y.d[k+1])+Math.abs(x.d[k+2]-y.d[k+2])>24)n++;}out.push(n);}return out;},[empty,fenced]);
  const first=columns.findIndex(n=>n>0),last=columns.length-1-[...columns].reverse().findIndex(n=>n>0);
  assert.ok(first>=0&&last-first>200,`fence spans ${first}..${last}`);const gaps=columns.slice(first,last+1).filter(n=>n===0).length;assert.equal(gaps,0,'no column without fence');report.cases.no_gap={first,last};
  // Real input: draw, Undo, save, reload.
  await importLevel(fixture);await key('e');await page.waitForFunction(()=>window.riderEditor?.mode==='edit'&&window.riderEditor?.screen,null,{timeout:30000});await pointer.frames(page,{n:10});
  await tapButton('tool_decoration');await page.waitForFunction(()=>window.riderDecorationPanel?.visible);
  let r=await rev();await dom('#rider-decoration-fence');await click([1,.5]);await click([8,.5]);await revision(r+1);
  let list=await items();assert.equal(list.length,1);assert.ok(Math.abs(list[0].distance-21)<.3&&Math.abs(list[0].to-28)<.3,'fence '+list[0].distance+'..'+list[0].to);assert.equal(list[0].asset,'fence-wood');
  await page.waitForFunction(()=>window.riderDecorationState?.fences?.length===1);await page.screenshot({path:path.join(out,'fence-edit.png')});report.cases.placed=list[0];
  r=await rev();await tapButton('undo');await page.waitForFunction(()=>!window.riderEditorDoc?.decorations);await page.waitForFunction(()=>(window.riderDecorationState?.fences?.length||0)===0);
  await tapButton('redo');await page.waitForFunction(()=>window.riderEditorDoc?.decorations?.items?.length===1);report.cases.undo=true;
  const kept=await items();await page.waitForTimeout(1100);await page.waitForFunction(()=>window.riderEditor.status==='Saved'&&!window.riderEditor.dirty&&window.riderCustom.syncState()==='saved',null,{timeout:20000});
  await page.goto(base+'?station=custom');await page.waitForFunction(()=>window.riderEditor||window.riderTelemetry?.sequence>2,null,{timeout:60000});await page.waitForTimeout(1000);
  if(await page.evaluate(()=>window.riderEditor?.mode!=='edit'))await key('e');
  await page.waitForFunction(()=>window.riderEditor?.mode==='edit'&&window.riderEditorDoc?.decorations,null,{timeout:30000});assert.deepEqual(await items(),kept);await page.waitForFunction(()=>window.riderDecorationState?.fences?.length===1,null,{timeout:10000});report.cases.reload=kept[0];
  assert.deepEqual(report.errors,[]);assert.deepEqual(Object.keys(report.cases),EXPECTED);report.status='PASS';
 }catch(e){report.failure=e.stack;if(page)await page.screenshot({path:path.join(out,'decoration-failure.png')}).catch(()=>{});}
 finally{fs.writeFileSync(path.join(out,'decoration618-result.json'),JSON.stringify(report,null,2)+'\n');if(browser)await browser.close();if(server)server.close();}
 console.log(JSON.stringify({status:report.status,cases:Object.keys(report.cases),failure:report.failure}));return report.status==='PASS'?0:1;
}
module.exports={EXPECTED};if(require.main===module)main().then(code=>process.exitCode=code).catch(e=>{console.error(e);process.exitCode=1;});
