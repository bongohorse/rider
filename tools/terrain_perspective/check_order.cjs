// #577: real browser check on the debug Gym bundle. Overlapping multi-section runs in both source orders, and a bridge over
// a long climb: the lower run must stay visible in Play and at several zooms in Edit. No camera or source injection.
//   node tools/terrain_perspective/check_order.cjs <verified debug bundle> <out dir>
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{configure}=require('../gym/launch.cjs'),pointer=require('../gym/pointer.cjs');
const [bundleArg,outArg]=process.argv.slice(2);
if(!bundleArg||!outArg)throw Error('Usage: node tools/terrain_perspective/check_order.cjs BUNDLE OUT');
const out=path.resolve(outArg);fs.mkdirSync(out,{recursive:true});
function find(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory()){const v=find(p);if(v)return v;}else if(e.name==='index.html')return p;}}
const web=path.dirname(find(path.resolve(bundleArg)));
const server=http.createServer((q,r)=>{const f=path.join(web,new URL(q.url,'http://x').pathname);if(!f.startsWith(web)||!fs.existsSync(f)){r.writeHead(404);return r.end();}r.setHeader('Content-Type',f.endsWith('.wasm')?'application/wasm':f.endsWith('.js')?'text/javascript':f.endsWith('.json')?'application/json':'text/html');fs.createReadStream(f).pipe(r);});
const dense=(x0,y0,x1,y1,step=.5)=>{const p=[];for(let x=x0;x<=x1;x+=step)p.push([x,y0+(y1-y0)*(x-x0)/(x1-x0)]);return p.reverse();}; // solid side up: runs go right to left
const LOW=dense(0,0,60,0),HIGH=dense(10,2.5,50,2.5),CLIMB=dense(0,0,120,24),BRIDGE=dense(10,6.5,30,6.5);
const level=(id,chains,y)=>JSON.stringify({schema:1,units:'metres',id,name:id,spawn:[20,y+.7],start_speed:0,run_in:0,run_out:0,bounds:[-10,130,-30,40],chains,hulls:[]});
// target: the lower run's height at x = 20 m (more than one 64-interval section per run).
// The Play check needs flat ground: on the climb the vehicle rolls away.
const CASES=[['low-first',[LOW,HIGH],0,true],['high-first',[HIGH,LOW],0,true],['bridge',[CLIMB,BRIDGE],4,false]];
const rows=(page,src,x)=>page.evaluate(async({src,x})=>{const i=new Image();i.src=src;await i.decode();const k=document.createElement('canvas');k.width=i.width;k.height=i.height;const c=k.getContext('2d');c.drawImage(i,0,0);const d=c.getImageData(x,0,1,i.height).data,out=[];for(let y=0;y<i.height;y++)out.push(.3*d[y*4]+.59*d[y*4+1]+.11*d[y*4+2]);return out;},{src,x});
// Bright clusters in one screen column: each visible Surface and edge is one.
const clusters=v=>{let n=0,last=-99;v.forEach((b,y)=>{if(y>270&&y<620&&b>135){if(y-last>10)n++;last=y;}});return n;}; // below the debug HUD, above the bottom bar
(async()=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await chromium.launch(),results=[];let failed=false;
 for(const [id,chains,lowY,checkPlay] of CASES){
  const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();
  await configure(page,'order-'+id,'le6');
  await page.goto('http://127.0.0.1:'+server.address().port+'/index.html?station=straight');
  await page.waitForFunction(()=>window.riderTelemetry?.sequence>2,null,{timeout:90000});
  const generation=await page.evaluate(()=>window.riderTelemetry.session_generation);
  await page.evaluate(([body,name])=>{window.riderCustom.open();window.riderCustom.importFile(new File([body],name+'.json',{type:'application/json'}));},[level('order-'+id,chains,lowY),id]);
  await page.waitForFunction(g=>window.riderTelemetry?.session_generation>g&&window.riderTelemetry.sequence>2,generation,{timeout:30000}).catch(async e=>{console.log('import',await page.evaluate(()=>JSON.stringify({hud:document.body.innerText.slice(0,400)})));await page.screenshot({path:path.join(out,'import-failed.png')});throw e;});
  if(checkPlay){
  await page.waitForFunction(()=>Math.abs(window.riderTelemetry?.speed_mps)<.5&&window.riderTelemetry.sequence>60,null,{timeout:20000});await page.waitForTimeout(500);
  const playShot=path.join(out,id+'-play.png');await page.screenshot({path:playShot});
  const png='data:image/png;base64,'+fs.readFileSync(playShot).toString('base64');
  const play=[clusters(await rows(page,png,240)),clusters(await rows(page,png,1040))];
  const speed=await page.evaluate(()=>window.riderTelemetry.speed_mps);
  results.push({id,step:'play',clusters:play,speed,visible:play.every(n=>n>=2)});if(!play.every(n=>n>=2))failed=true;
  }
  await page.locator('canvas').focus();
  await page.keyboard.down('e');await pointer.frames(page,{n:3});await page.keyboard.up('e');
  await page.waitForFunction(()=>window.riderEditor?.mode==='edit'&&window.riderEditor.screen,null,{timeout:20000});
  await page.keyboard.down('Home');await pointer.frames(page,{n:3});await page.keyboard.up('Home');await pointer.frames(page,{n:20});
  const map=()=>page.evaluate(()=>{const e=window.riderEditor,c=document.querySelector('canvas'),r=c.getBoundingClientRect();return {s:e.screen,k:r.width/c.width,h:r.height,y:r.y,x:r.x,zoom:e.camera.zoom};});
  const toPageWith=(e,mx,my)=>({x:e.x+(e.s.ox+mx*e.s.ppm_x)*e.k,y:e.y+e.h-(e.s.oy+my*e.s.ppm_y)*e.k});
  // Zoom towards the overlap until a metre covers enough pixels to sample; the wheel keeps the point under the cursor.
  const wheelTo=async target=>{for(let i=0;i<30;i++){const e=await map();if(e.zoom>=target)return;const q=toPageWith(e,20,lowY);await page.mouse.move(q.x,q.y);await pointer.frames(page);await page.mouse.wheel(0,-120);await pointer.frames(page,{n:6});}assert.fail('zoom target not reached: '+target);};
  for(const step of [.15,.3,.6]){
   await wheelTo(step);await page.waitForTimeout(400);
   const shot=path.join(out,id+'-'+step+'.png');await page.screenshot({path:shot});
   const e=await map();
   // Screen map from the editor: canvas units, y up. The overlap column x = 20 m.
   const edge=toPageWith(e,20,lowY-.06),body=toPageWith(e,20,lowY-1.2);
   const px=await page.evaluate(async({src,a,b})=>{const i=new Image();i.src=src;await i.decode();const k=document.createElement('canvas');k.width=i.width;k.height=i.height;const x=k.getContext('2d');x.drawImage(i,0,0);const g=q=>{const d=x.getImageData(Math.round(q.x),Math.round(q.y),1,1).data;return .3*d[0]+.59*d[1]+.11*d[2];};return [g(a),g(b)];},{src:'data:image/png;base64,'+fs.readFileSync(shot).toString('base64'),a:edge,b:body});
   const visible=px[0]>px[1]+20;results.push({id,step,zoom:e.zoom,edge:px[0],body:px[1],visible});
   if(!visible)failed=true;
  }
  await context.close();
 }
 await browser.close();server.close();
 fs.writeFileSync(path.join(out,'terrain-order-577.json'),JSON.stringify(results,null,1)+'\n');
 console.log(JSON.stringify(results.map(r=>r.step==='play'?[r.id,'play',r.clusters,r.visible]:[r.id,+r.zoom.toFixed(2),Math.round(r.edge),Math.round(r.body),r.visible])));
 assert.equal(failed,false,'the lower run was hidden');
 console.log('PASS');
})().catch(e=>{console.error(String(e.message||e));process.exit(1);});
