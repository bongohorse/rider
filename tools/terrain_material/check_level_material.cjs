// #542: real browser check with no URL selection. A level file carries its material: Play and Edit use it, a reload keeps
// it, export writes it unchanged, an override changes one surface, Undo in the document is covered by the Lua suite.
//   node tools/terrain_material/check_level_material.cjs <verified debug bundle> <out dir>
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{configure}=require('../gym/launch.cjs'),pointer=require('../gym/pointer.cjs');
const [bundleArg,outArg]=process.argv.slice(2);
if(!bundleArg||!outArg)throw Error('Usage: node tools/terrain_material/check_level_material.cjs BUNDLE OUT');
const out=path.resolve(outArg);fs.mkdirSync(out,{recursive:true});
function find(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory()){const v=find(p);if(v)return v;}else if(e.name==='index.html')return p;}}
const web=path.dirname(find(path.resolve(bundleArg)));
const server=http.createServer((q,r)=>{const f=path.join(web,new URL(q.url,'http://x').pathname);if(!f.startsWith(web)||!fs.existsSync(f)){r.writeHead(404);return r.end();}r.setHeader('Content-Type',f.endsWith('.wasm')?'application/wasm':f.endsWith('.js')?'text/javascript':f.endsWith('.json')?'application/json':'text/html');fs.createReadStream(f).pipe(r);});
const chain=[];for(let x=40;x>=-10;x-=1)chain.push([x,0]);
const level=material=>JSON.stringify({schema:6,units:'metres',id:'material',name:'material',spawn:[2,.7],start_speed:0,run_in:0,run_out:0,bounds:[-20,50,-30,20],chains:[chain],two_sided:[false],hulls:[],labels:[],material,
 editor:{editor_version:14,compiler_version:14,revision:1,next_id:2,objects:[{id:'o1',type:'line',points:[...chain].reverse()}],connections:[],sampling:{tolerance:.02,max_segment:4},start:{position:[2,.7],speed:0},road_profile:'authored-v1',road_look:{version:1,params:{version:1,mode:'perspective',width:.9,perspective:.35,angle:28.810793742973,side:64,shading:1}},material}});
const CASES=[['city',{version:1,preset:'city'}],['city-band-meadow',{version:1,preset:'city',band:'meadow'}]];
(async()=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await chromium.launch(),results={},errors=[];
 for(const [id,material] of CASES){
  const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/ERROR:/.test(m.text()))errors.push(m.text());});
  await configure(page,'material-'+id,'le6');
  await page.goto('http://127.0.0.1:'+server.address().port+'/index.html?station=straight');
  await page.waitForFunction(()=>window.riderTelemetry?.sequence>2,null,{timeout:90000});
  const generation=await page.evaluate(()=>window.riderTelemetry.session_generation);
  await page.evaluate(body=>{window.riderCustom.open();window.riderCustom.importFile(new File([body],'material.json',{type:'application/json'}));},level(material));
  await page.waitForFunction(g=>window.riderTelemetry?.session_generation>g&&window.riderRoadProjection?.sections>0,generation,{timeout:30000}).catch(async e=>{console.log(await page.evaluate(()=>window.riderCustom.message));throw e;});
  await page.waitForTimeout(1200);
  const seen=()=>page.evaluate(()=>({material:window.riderRoadProjection.material,stride:window.riderRoadProjection.stride}));
  const play=await seen();assert.equal(play.material.preset,'city');assert.equal(play.stride,52);
  await page.screenshot({path:path.join(out,id+'-play.png')});
  await page.locator('canvas').focus();
  const key=async k=>{await page.keyboard.down(k);await pointer.frames(page);await page.keyboard.up(k);await pointer.frames(page);};
  await key('e');await page.waitForFunction(()=>window.riderEditor?.mode==='edit'&&window.riderEditor.screen,null,{timeout:20000});await page.waitForTimeout(800);
  const edit=await seen();assert.equal(edit.material.preset,'city');assert.equal(edit.stride,52);
  await page.screenshot({path:path.join(out,id+'-edit.png')});
  const source=await page.evaluate(()=>window.riderEditorDoc);assert.deepEqual(source.material,material);assert.equal(source.editor_version,14);
  await page.reload();await page.waitForFunction(()=>window.riderEditor?.mode==='edit'&&window.riderEditor.screen,null,{timeout:60000});await page.waitForTimeout(800);
  const reloaded=await page.evaluate(()=>window.riderEditorDoc);assert.deepEqual(reloaded.material,material,'reload keeps the material');
  const again=await seen();assert.equal(again.material.preset,'city');assert.equal(again.stride,52);
  const q=await page.evaluate(()=>{const e=window.riderEditor,b=e.buttons.export,c=document.querySelector('canvas'),r=c.getBoundingClientRect();return {x:r.x+b.x/c.width*r.width,y:r.y+(1-b.y/c.height)*r.height};});
  await pointer.tap(page,q);await page.waitForSelector('#rider-export-text');
  const file=JSON.parse(await page.locator('#rider-export-text').inputValue());
  assert.deepEqual(file.editor.material,material);assert.deepEqual(file.material,material);assert.equal(file.schema,6);
  results[id]={play,edit,schema:file.schema};
  await context.close();
 }
 await browser.close();server.close();
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'level-material-542.json'),JSON.stringify(results,null,1)+'\n');
 console.log('PASS');
})().catch(e=>{console.error(String(e.message||e));process.exit(1);});
