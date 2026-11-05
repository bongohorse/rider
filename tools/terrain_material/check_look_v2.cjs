// #573: real input on a level file with a material and parameter set 2: the panel accepts the new ranges by typing,
// refuses a value above them, Apply survives a reload and export. Screenshots of Play and Fit are for the eye.
//   node tools/terrain_material/check_look_v2.cjs <verified debug bundle> <out dir>
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{configure}=require('../gym/launch.cjs'),pointer=require('../gym/pointer.cjs');
const [bundleArg,outArg]=process.argv.slice(2);
if(!bundleArg||!outArg)throw Error('Usage: node tools/terrain_material/check_look_v2.cjs BUNDLE OUT');
const out=path.resolve(outArg);fs.mkdirSync(out,{recursive:true});
function find(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory()){const v=find(p);if(v)return v;}else if(e.name==='index.html')return p;}}
const web=path.dirname(find(path.resolve(bundleArg)));
const server=http.createServer((q,r)=>{const f=path.join(web,new URL(q.url,'http://x').pathname);if(!f.startsWith(web)||!fs.existsSync(f)){r.writeHead(404);return r.end();}r.setHeader('Content-Type',f.endsWith('.wasm')?'application/wasm':f.endsWith('.js')?'text/javascript':f.endsWith('.json')?'application/json':'text/html');fs.createReadStream(f).pipe(r);});
const params={version:2,mode:'perspective',width:.6,perspective:6,angle:45,side:64,shading:1.15,vehicle_position:.5};
const material={version:1,preset:'quarry'};
// Flat, a long climb to 30 m, a steep drop and a run end, so far views have terrain far above the camera.
const line=[];for(let x=0;x<=120;x+=1)line.push([x,x<60?0:(x-60)/2]);for(let x=121;x<=160;x+=1)line.push([x,30-(x-120)*.75]);
const chain=[...line].reverse();
const LEVEL=JSON.stringify({schema:6,units:'metres',id:'look',name:'look',spawn:[10,.7],start_speed:0,run_in:0,run_out:0,bounds:[-10,170,-30,60],chains:[chain],two_sided:[false],hulls:[],labels:[],material,
 editor:{editor_version:14,compiler_version:14,revision:1,next_id:2,objects:[{id:'o1',type:'line',points:line}],connections:[],sampling:{tolerance:.005,max_segment:.5},start:{position:[10,.7],speed:0},road_profile:'authored-v1',road_look:{version:1,params},material}});
(async()=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],results={};
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/ERROR:|EDITOR_MESH_FALLBACK/.test(m.text()))errors.push(m.text());});
 await configure(page,'look-573','le6');
 await page.goto('http://127.0.0.1:'+server.address().port+'/index.html?station=straight');
 await page.waitForFunction(()=>window.riderTelemetry?.sequence>2,null,{timeout:90000});
 const generation=await page.evaluate(()=>window.riderTelemetry.session_generation);
 await page.evaluate(body=>{window.riderCustom.open();window.riderCustom.importFile(new File([body],'look.json',{type:'application/json'}));},LEVEL);
 await page.waitForFunction(g=>window.riderTelemetry?.session_generation>g&&window.riderRoadProjection?.sections>0,generation,{timeout:30000}).catch(async e=>{console.log(await page.evaluate(()=>window.riderCustom.message));throw e;});
 await page.waitForTimeout(1000);
 assert.deepEqual(await page.evaluate(()=>{const p=window.riderRoadProjection.params;return [p.version,p.width,p.perspective,p.angle,p.shading,p.vehicle_position];}),[2,.6,6,45,1.15,.5]);
 await page.screenshot({path:path.join(out,'play.png')});
 await page.locator('canvas').focus();
 const key=async k=>{await page.keyboard.down(k);await pointer.frames(page);await page.keyboard.up(k);await pointer.frames(page);};
 await key('e');await page.waitForFunction(()=>window.riderEditor?.mode==='edit'&&window.riderEditor.screen,null,{timeout:20000});
 await page.waitForFunction(()=>window.riderTerrainResources?.mode==='edit',null,{timeout:15000});
 await key('Home');await pointer.frames(page,{n:30});await page.waitForTimeout(500);await page.screenshot({path:path.join(out,'fit.png')});
 const tapButton=async name=>{const q=await page.evaluate(n=>{const e=window.riderEditor,b=e.buttons[n],c=document.querySelector('canvas'),r=c.getBoundingClientRect();if(!b||!e.visible.includes(n))return null;return {x:r.x+b.x/c.width*r.width,y:r.y+(1-b.y/c.height)*r.height};},name);assert.ok(q,'invisible '+name);await pointer.tap(page,q);await pointer.frames(page,{n:4});};
 for(let i=0;i<5&&!await page.evaluate(()=>window.riderEditor.look?.open===true);i++){await page.mouse.move(640,70);await pointer.frames(page,{n:6});await tapButton('terrain_look');await page.waitForTimeout(400);}
 assert.equal(await page.evaluate(()=>window.riderEditor.look?.open),true,'panel');
 const visible=await page.evaluate(()=>window.riderEditor.visible.filter(n=>n.startsWith('look_value_')));results.controls=visible;
 assert.ok(visible.includes('look_value_vehicle_position'),'vehicle control: '+visible);
 const type=async(k,v)=>{await tapButton('look_value_'+k);await page.keyboard.type(String(v),{delay:30});await key('Enter');await pointer.frames(page,{n:6});};
 await type('width',3.5);assert.equal(await page.evaluate(()=>window.riderEditor.look.params.width),3.5);
 await type('angle',70);assert.equal(await page.evaluate(()=>window.riderEditor.look.params.angle),70);
 await type('vehicle_position',.25);assert.equal(await page.evaluate(()=>window.riderEditor.look.params.vehicle_position),.25);
 await type('width',.6);await type('angle',45);
 // Above the range: refused, the value stays.
 await tapButton('look_value_width');await page.keyboard.type('4.5',{delay:30});await key('Enter');await pointer.frames(page,{n:6});
 assert.equal(await page.evaluate(()=>window.riderEditor.look.params.width),.6,'above the range');
 assert.match(await page.evaluate(()=>String(window.riderEditor.look.error||window.riderEditor.ui?.field_error||'')),/4/);
 await key('Escape');await page.waitForTimeout(300);
 await tapButton('look_apply');await page.waitForFunction(()=>window.riderEditorDoc.road_look.params.vehicle_position===.25,null,{timeout:10000});
 await tapButton('look_close');await page.waitForFunction(()=>!window.riderEditor.look.open);
 await page.waitForFunction(()=>window.riderEditor.status==='Saved'&&!window.riderEditor.dirty,null,{timeout:20000});
 await page.reload();await page.waitForFunction(()=>window.riderEditor?.mode==='edit'||window.riderTelemetry?.sequence>2,null,{timeout:60000});await page.waitForTimeout(800);
 if(await page.evaluate(()=>window.riderEditor?.mode!=='edit')){await page.locator('canvas').focus();await key('e');}
 await page.waitForFunction(()=>window.riderEditor?.mode==='edit'&&window.riderEditor.screen,null,{timeout:30000});await page.waitForTimeout(800);
 assert.equal(await page.evaluate(()=>window.riderEditorDoc.road_look.params.vehicle_position),.25,'reload');
 const q=await page.evaluate(()=>{const e=window.riderEditor,b=e.buttons.export,c=document.querySelector('canvas'),r=c.getBoundingClientRect();return {x:r.x+b.x/c.width*r.width,y:r.y+(1-b.y/c.height)*r.height};});
 await pointer.tap(page,q);await page.waitForSelector('#rider-export-text');
 const file=JSON.parse(await page.locator('#rider-export-text').inputValue());
 assert.equal(file.editor.road_look.params.version,2);assert.equal(file.editor.road_look.params.vehicle_position,.25);assert.deepEqual(file.editor.material,material);
 await browser.close();server.close();
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'look-573.json'),JSON.stringify(results,null,1)+'\n');
 console.log('PASS');
})().catch(e=>{console.error(String(e.stack||e).slice(0,500));process.exit(1);});
