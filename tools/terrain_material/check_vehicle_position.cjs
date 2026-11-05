// #571: real browser check with the City preset, where the dark road and the light kerb are easy to tell apart. At 0.5 the
// driving line lies on the road, at 0 on the Surface's front edge; the vehicle rests at the same height either way; hover
// and selection keep the terrain visible in Edit. Real input only.
//   node tools/terrain_material/check_vehicle_position.cjs <verified debug bundle> <out dir>
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{configure}=require('../gym/launch.cjs'),pointer=require('../gym/pointer.cjs');
const [bundleArg,outArg]=process.argv.slice(2);
if(!bundleArg||!outArg)throw Error('Usage: node tools/terrain_material/check_vehicle_position.cjs BUNDLE OUT');
const out=path.resolve(outArg);fs.mkdirSync(out,{recursive:true});
function find(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory()){const v=find(p);if(v)return v;}else if(e.name==='index.html')return p;}}
const web=path.dirname(find(path.resolve(bundleArg)));
const server=http.createServer((q,r)=>{const f=path.join(web,new URL(q.url,'http://x').pathname);if(!f.startsWith(web)||!fs.existsSync(f)){r.writeHead(404);return r.end();}r.setHeader('Content-Type',f.endsWith('.wasm')?'application/wasm':f.endsWith('.js')?'text/javascript':f.endsWith('.json')?'application/json':'text/html');fs.createReadStream(f).pipe(r);});
const line=[];for(let x=-10;x<=60;x+=1)line.push([x,x<20?0:(x<40?(x-20)*.2:4)]);
const material={version:1,preset:'city'};
const level=v=>{const params={version:2,mode:'perspective',width:1,perspective:1,angle:45,side:64,shading:1,vehicle_position:v};return JSON.stringify({schema:6,units:'metres',id:'pos',name:'pos',spawn:[5,.7],start_speed:0,run_in:0,run_out:0,bounds:[-20,70,-30,30],chains:[[...line].reverse()],two_sided:[false],hulls:[],labels:[],material,
 editor:{editor_version:14,compiler_version:14,revision:1,next_id:2,objects:[{id:'o1',type:'line',points:line}],connections:[],sampling:{tolerance:.005,max_segment:.5},start:{position:[5,.7],speed:0},road_profile:'authored-v1',road_look:{version:1,params},material}});};
const brightness=(page,file,q)=>page.evaluate(async({src,q})=>{const i=new Image();i.src=src;await i.decode();const k=document.createElement('canvas');k.width=i.width;k.height=i.height;const c=k.getContext('2d');c.drawImage(i,0,0);const d=c.getImageData(Math.round(q.x)-8,Math.round(q.y)-1,16,3).data;let s=0;for(let j=0;j<d.length;j+=4)s+=.3*d[j]+.59*d[j+1]+.11*d[j+2];return s/(d.length/4);},{src:'data:image/png;base64,'+fs.readFileSync(file).toString('base64'),q});
(async()=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await chromium.launch(),results={},errors=[];
 for(const v of [0,.5]){
  const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/ERROR:|EDITOR_MESH_FALLBACK/.test(m.text()))errors.push(m.text());});
  await configure(page,'pos-'+v,'le6');
  await page.goto('http://127.0.0.1:'+server.address().port+'/index.html?station=straight');
  await page.waitForFunction(()=>window.riderTelemetry?.sequence>2,null,{timeout:90000});
  const generation=await page.evaluate(()=>window.riderTelemetry.session_generation);
  await page.evaluate(body=>{window.riderCustom.open();window.riderCustom.importFile(new File([body],'pos.json',{type:'application/json'}));},level(v));
  await page.waitForFunction(g=>window.riderTelemetry?.session_generation>g&&window.riderRoadProjection?.sections>0,generation,{timeout:30000});
  await page.waitForFunction(()=>Math.abs(window.riderTelemetry.speed_mps)<.05&&window.riderTelemetry.sequence>90,null,{timeout:30000});
  const rest=await page.evaluate(()=>({travel1:window.riderTelemetry.travel1,travel2:window.riderTelemetry.travel2,pitch:window.riderTelemetry.pitch,distance:window.riderTelemetry.station_distance}));
  const play=path.join(out,'play-'+v+'.png');await page.screenshot({path:play});
  await page.locator('canvas').focus();
  const key=async k=>{await page.keyboard.down(k);await pointer.frames(page);await page.keyboard.up(k);await pointer.frames(page);};
  await key('e');await page.waitForFunction(()=>window.riderEditor?.mode==='edit'&&window.riderEditor.screen,null,{timeout:20000});
  await page.waitForFunction(()=>window.riderTerrainResources?.mode==='edit',null,{timeout:15000});await page.waitForTimeout(800);
  const e=await page.evaluate(()=>{const e=window.riderEditor,c=document.querySelector('canvas'),r=c.getBoundingClientRect();return {s:e.screen,k:r.width/c.width,h:r.height,y:r.y,x:r.x};});
  const at=(mx,my)=>({x:e.x+(e.s.ox+mx*e.s.ppm_x)*e.k,y:e.y+e.h-(e.s.oy+my*e.s.ppm_y)*e.k});
  const edit=path.join(out,'edit-'+v+'.png');await page.screenshot({path:edit});
  // Above the line at the same height as the middle of the road.
  const road=await brightness(page,edit,at(10,.1));
  const q=at(10,0);await page.mouse.move(q.x,q.y);await pointer.frames(page,{n:10});await page.waitForTimeout(300);
  const hoverFile=path.join(out,'hover-'+v+'.png');await page.screenshot({path:hoverFile});
  const below=await brightness(page,hoverFile,at(10,-3));
  await page.mouse.down();await pointer.frames(page,{n:2});await page.mouse.up();await pointer.frames(page,{n:10});await page.waitForTimeout(300);
  const selectFile=path.join(out,'select-'+v+'.png');await page.screenshot({path:selectFile});
  const selected=await brightness(page,selectFile,at(10,-3));
  results[v]={rest,road,below,selected,hover:await page.evaluate(()=>window.riderEditor.hover)};
  await context.close();
 }
 await browser.close();server.close();
 fs.writeFileSync(path.join(out,'vehicle-position-571.json'),JSON.stringify(results,null,1)+'\n');
 console.log(JSON.stringify(results));
 assert.deepEqual(errors,[]);
 for(const k of ['travel1','travel2','pitch'])assert.ok(Math.abs(results[0].rest[k]-results[.5].rest[k])<1e-3,'physics differs in '+k);
 assert.ok(results[.5].road<results[0].road-10,'the line must lie on the darker road at 0.5');
 for(const v of [0,.5]){assert.ok(results[v].below>40,'terrain visible on hover at '+v);assert.ok(results[v].selected>40,'terrain visible on selection at '+v);}
 console.log('PASS');
})().catch(e=>{console.error(String(e.message||e).slice(0,400));process.exit(1);});
