// #570: real browser check with a preset and a strong 3D look. Four run ends, camera on each side: a run end that
// turned away must not draw over the front face; one that faces the camera must draw. Real input only.
//   node tools/terrain_material/check_facing.cjs <verified debug bundle> <out dir>
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{configure}=require('../gym/launch.cjs'),pointer=require('../gym/pointer.cjs');
const [bundleArg,outArg]=process.argv.slice(2);
if(!bundleArg||!outArg)throw Error('Usage: node tools/terrain_material/check_facing.cjs BUNDLE OUT');
const out=path.resolve(outArg);fs.mkdirSync(out,{recursive:true});
function find(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory()){const v=find(p);if(v)return v;}else if(e.name==='index.html')return p;}}
const web=path.dirname(find(path.resolve(bundleArg)));
const server=http.createServer((q,r)=>{const f=path.join(web,new URL(q.url,'http://x').pathname);if(!f.startsWith(web)||!fs.existsSync(f)){r.writeHead(404);return r.end();}r.setHeader('Content-Type',f.endsWith('.wasm')?'application/wasm':f.endsWith('.js')?'text/javascript':f.endsWith('.json')?'application/json':'text/html');fs.createReadStream(f).pipe(r);});
const run=(a,b)=>{const p=[];for(let x=b;x>=a;x-=4)p.push([x,0]);return p;}; // solid side up: right to left
const LEVEL=JSON.stringify({schema:1,units:'metres',id:'facing',name:'facing',spawn:[10,.7],start_speed:0,run_in:0,run_out:0,bounds:[-10,350,-30,20],chains:[run(0,100),run(240,340)],hulls:[]});
// Home centres the view near x = 170. Outer ends face away from the camera, inner ends face it.
// The inner left end needs the camera well to its left, so that zoom anchors at a fixed point left of the end.
const BACKGROUND=27; // the editor's empty view
const ENDS=[['left-away',0,-1,false],['inner-right-facing',100,1,true],['inner-left-facing',240,-1,true],['right-away',340,1,false]];
(async()=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/ERROR:/.test(m.text()))errors.push(m.text());});
 await configure(page,'facing-570','le6');
 await page.goto('http://127.0.0.1:'+server.address().port+'/index.html?station=straight&terrain_material=meadow');
 await page.waitForFunction(()=>window.riderTelemetry?.sequence>2,null,{timeout:90000});
 const generation=await page.evaluate(()=>window.riderTelemetry.session_generation);
 await page.evaluate(body=>{window.riderCustom.open();window.riderCustom.importFile(new File([body],'facing.json',{type:'application/json'}));},LEVEL);
 await page.waitForFunction(g=>window.riderTelemetry?.session_generation>g&&window.riderTelemetry.sequence>2,generation,{timeout:30000}).catch(async e=>{console.log(errors.slice(0,4),await page.evaluate(()=>document.body.innerText.slice(0,300)));await page.screenshot({path:path.join(out,'failed.png')});throw e;});
 await page.locator('canvas').focus();
 const key=async k=>{await page.keyboard.down(k);await pointer.frames(page);await page.keyboard.up(k);await pointer.frames(page);};
 await key('e');await page.waitForFunction(()=>window.riderEditor?.mode==='edit'&&window.riderEditor.screen,null,{timeout:20000});
 const button=async name=>{for(let i=0;i<8&&!await page.evaluate(n=>window.riderEditor?.visible.includes(n),name);i++){await page.mouse.move(1100,350);await page.mouse.wheel(0,120);await pointer.frames(page);}const p=await page.evaluate(name=>{const e=window.riderEditor,b=e.buttons[name],c=document.querySelector('canvas'),r=c.getBoundingClientRect();if(!e.visible.includes(name)||!b)throw Error('Invisible '+name);return {x:r.x+b.x/c.width*r.width,y:r.y+(1-b.y/c.height)*r.height};},name);await pointer.tap(page,p);await pointer.frames(page,{n:4});};
 const numeric=async(k,v)=>{await button('look_value_'+k);await page.keyboard.type(String(v),{delay:30});await key('Enter');await page.waitForFunction(([k,v])=>window.riderEditor.look.params[k]===v&&!window.riderEditor.look.pending,[k,v]);};
 // The first tap can land before the bar reacts: retry until the panel is open.
 for(let i=0;i<5&&!await page.evaluate(()=>window.riderEditor.look?.open===true);i++){await page.mouse.move(640,70);await pointer.frames(page,{n:6});await button('terrain_look');await page.waitForTimeout(400);}
 assert.equal(await page.evaluate(()=>window.riderEditor.look?.open),true,'3D look did not open');
 await numeric('width',2);await numeric('perspective',1);
 await page.waitForFunction(()=>window.riderEditorDoc.road_profile==='authored-v1'&&window.riderEditorDoc.road_look.params.perspective===1);await button('look_close');
 const map=()=>page.evaluate(()=>{const e=window.riderEditor,c=document.querySelector('canvas'),r=c.getBoundingClientRect();return {s:e.screen,k:r.width/c.width,h:r.height,y:r.y,x:r.x,zoom:e.camera.zoom};});
 const at=(e,mx,my)=>({x:e.x+(e.s.ox+mx*e.s.ppm_x)*e.k,y:e.y+e.h-(e.s.oy+my*e.s.ppm_y)*e.k});
 const results=[];let failed=false;
 for(const [name,x,side,facing] of ENDS){
  await key('Home');await pointer.frames(page,{n:20});
  let e=await map();
  for(let i=0;i<30&&e.zoom<.08;i++){const q=name==='inner-left-facing'?{x:620,y:372}:at(e,x,0);await page.mouse.move(q.x,q.y);await pointer.frames(page);await page.mouse.wheel(0,-120);await pointer.frames(page,{n:5});e=await map();}
  assert.ok(e.zoom>=.08,'zoom target');await page.mouse.move(640,70);await pointer.frames(page,{n:8});await page.waitForTimeout(400);e=await map();
  const file=path.join(out,name+'.png');await page.screenshot({path:file});
  // Brightness of a strip just inside the front face, deep inside it, and just outside the run end.
  const strip=(mx,my)=>at(e,mx,my);
  const px=await page.evaluate(async({src,pts})=>{const i=new Image();i.src=src;await i.decode();const k=document.createElement('canvas');k.width=i.width;k.height=i.height;const c=k.getContext('2d');c.drawImage(i,0,0);return pts.map(q=>{const d=c.getImageData(Math.round(q.x)-1,Math.round(q.y)-30,3,60).data;let s=0;for(let j=0;j<d.length;j+=4)s+=.3*d[j]+.59*d[j+1]+.11*d[j+2];return s/(d.length/4);});},{src:'data:image/png;base64,'+fs.readFileSync(file).toString('base64'),pts:[strip(x-side*.4,-8),strip(x-side*6,-8),strip(x+side*.4,-8)]});
  const [inside,deep,outside]=px;
  // Facing: the cap lies outside the front corner and is lit. Away: nothing outside, and the front keeps its brightness.
  const ok=facing?outside>BACKGROUND+8:(outside<BACKGROUND+6&&inside>deep*.86);
  results.push({name,zoom:e.zoom,inside,deep,outside,facing,ok});if(!ok)failed=true;
 }
 await browser.close();server.close();
 fs.writeFileSync(path.join(out,'facing-570.json'),JSON.stringify(results,null,1)+'\n');
 console.log(JSON.stringify(results.map(r=>[r.name,+r.zoom.toFixed(2),Math.round(r.inside),Math.round(r.deep),Math.round(r.outside),r.ok])));
 assert.deepEqual(errors,[]);assert.equal(failed,false,'facing rule broken');console.log('PASS');
})().catch(e=>{console.error(String(e.message||e));process.exit(1);});
