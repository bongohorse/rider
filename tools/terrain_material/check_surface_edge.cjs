// #540: real browser check with the Meadow preset. The Surface's far edge shows the view behind it, its contact side has
// no holes, and hiding a section removes it. Real input only.
//   node tools/terrain_material/check_surface_edge.cjs <verified debug bundle> <out dir>
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{configure}=require('../gym/launch.cjs'),pointer=require('../gym/pointer.cjs');
const [bundleArg,outArg]=process.argv.slice(2);
if(!bundleArg||!outArg)throw Error('Usage: node tools/terrain_material/check_surface_edge.cjs BUNDLE OUT');
const out=path.resolve(outArg);fs.mkdirSync(out,{recursive:true});
function find(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory()){const v=find(p);if(v)return v;}else if(e.name==='index.html')return p;}}
const web=path.dirname(find(path.resolve(bundleArg)));
const server=http.createServer((q,r)=>{const f=path.join(web,new URL(q.url,'http://x').pathname);if(!f.startsWith(web)||!fs.existsSync(f)){r.writeHead(404);return r.end();}r.setHeader('Content-Type',f.endsWith('.wasm')?'application/wasm':f.endsWith('.js')?'text/javascript':f.endsWith('.json')?'application/json':'text/html');fs.createReadStream(f).pipe(r);});
const line=[];for(let x=-10;x<=60;x+=1)line.push([x,0]);
const material={version:1,preset:'meadow'},params={version:2,mode:'perspective',width:2,perspective:0,angle:45,side:64,shading:1,vehicle_position:0};
const LEVEL=JSON.stringify({schema:6,units:'metres',id:'edge',name:'edge',spawn:[5,.7],start_speed:0,run_in:0,run_out:0,bounds:[-20,70,-30,30],chains:[[...line].reverse()],two_sided:[false],hulls:[],labels:[],material,
 editor:{editor_version:14,compiler_version:14,revision:1,next_id:2,objects:[{id:'o1',type:'line',points:line}],connections:[],sampling:{tolerance:.005,max_segment:.5},start:{position:[5,.7],speed:0},road_profile:'authored-v1',road_look:{version:1,params},material}});
const row=(page,file,x0,x1,y)=>page.evaluate(async({src,x0,x1,y})=>{const i=new Image();i.src=src;await i.decode();const k=document.createElement('canvas');k.width=i.width;k.height=i.height;const c=k.getContext('2d');c.drawImage(i,0,0);const d=c.getImageData(x0,y,x1-x0,1).data,v=[];for(let j=0;j<d.length;j+=4)v.push(Math.round(.3*d[j]+.59*d[j+1]+.11*d[j+2]));return v;},{src:'data:image/png;base64,'+fs.readFileSync(file).toString('base64'),x0,x1,y});
(async()=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/ERROR:|EDITOR_MESH_FALLBACK/.test(m.text()))errors.push(m.text());});
 await configure(page,'edge-540','le6');
 await page.goto('http://127.0.0.1:'+server.address().port+'/index.html?station=straight');
 await page.waitForFunction(()=>window.riderTelemetry?.sequence>2,null,{timeout:90000});
 const generation=await page.evaluate(()=>window.riderTelemetry.session_generation);
 await page.evaluate(body=>{window.riderCustom.open();window.riderCustom.importFile(new File([body],'edge.json',{type:'application/json'}));},LEVEL);
 await page.waitForFunction(g=>window.riderTelemetry?.session_generation>g&&window.riderRoadProjection?.sections>0,generation,{timeout:30000});
 await page.locator('canvas').focus();
 const key=async k=>{await page.keyboard.down(k);await pointer.frames(page);await page.keyboard.up(k);await pointer.frames(page);};
 await key('e');await page.waitForFunction(()=>window.riderEditor?.mode==='edit'&&window.riderEditor.screen,null,{timeout:20000});
 await page.waitForFunction(()=>window.riderTerrainResources?.mode==='edit',null,{timeout:15000});
 const map=()=>page.evaluate(()=>{const e=window.riderEditor,c=document.querySelector('canvas'),r=c.getBoundingClientRect();return {s:e.screen,k:r.width/c.width,h:r.height,y:r.y,x:r.x,zoom:e.camera.zoom};});
 const at=(e,mx,my)=>({x:e.x+(e.s.ox+mx*e.s.ppm_x)*e.k,y:e.y+e.h-(e.s.oy+my*e.s.ppm_y)*e.k});
 let e=await map();for(let i=0;i<24&&e.zoom<1;i++){const q=at(e,10,1);await page.mouse.move(q.x,q.y);await pointer.frames(page);await page.mouse.wheel(0,-120);await pointer.frames(page,{n:5});e=await map();}
 await page.mouse.move(640,70);await pointer.frames(page,{n:6});await page.waitForTimeout(500);e=await map();
 const file=path.join(out,'edge.png');await page.screenshot({path:file});
 // Width 2 and angle 45: the Surface spans 2 m on screen. Row at the far edge's top, and one in the contact side.
 const far=at(e,10,2-.02),contact=at(e,10,1),x0=240,x1=960;
 const farRow=await row(page,file,x0,x1,Math.round(far.y)),contactRow=await row(page,file,x0,x1,Math.round(contact.y));
 const empty=await row(page,file,x0,x1,Math.round(at(e,10,2.6).y));
 const background=empty.reduce((a,b)=>a+b,0)/empty.length;
 const near=v=>v.filter(b=>Math.abs(b-background)<10).length/v.length;
 const soft=farRow.filter(b=>b>background+10&&b<Math.max(...contactRow)*.6).length/farRow.length;
 const results={zoom:e.zoom,background,farClear:near(farRow),farSoft:soft,contactClear:near(contactRow)};
 assert.ok(results.farClear>.05,'the far edge must show the view behind it: '+JSON.stringify(results));
 assert.ok(results.farClear<.98,'the far edge must have art: '+JSON.stringify(results));
 assert.ok(results.contactClear<.01,'holes in the contact side: '+JSON.stringify(results));
 // Hide: the section goes, without adding light.
 const eye=await page.evaluate(()=>{const n=window.riderEditor.visible.find(v=>v.startsWith('object_eye_'));if(!n)return null;const b=window.riderEditor.buttons[n],c=document.querySelector('canvas'),r=c.getBoundingClientRect();return {x:r.x+b.x/c.width*r.width,y:r.y+(1-b.y/c.height)*r.height};});
 assert.ok(eye,'object eye button');await pointer.tap(page,eye);await pointer.frames(page,{n:10});await page.mouse.move(640,70);await pointer.frames(page,{n:6});await page.waitForTimeout(500);
 const hiddenFile=path.join(out,'hidden.png');await page.screenshot({path:hiddenFile});
 e=await map();const hidden=await row(page,hiddenFile,x0,x1,Math.round(at(e,10,1).y));
 results.hiddenClear=near(hidden);assert.ok(results.hiddenClear>.9,'hidden terrain must leave the view as it was: '+JSON.stringify(results));
 await browser.close();server.close();
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'surface-edge-540.json'),JSON.stringify(results,null,1)+'\n');
 console.log(JSON.stringify(results));console.log('PASS');
})().catch(e=>{console.error(String(e.message||e).slice(0,500));process.exit(1);});
