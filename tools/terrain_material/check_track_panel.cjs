// #543: real input: open the panel from the editor, pick a preset, override the Band, Discard, pick again, Apply, Undo,
// Redo, reload, and drive. Keys typed in the panel do not reach the editor.
//   node tools/terrain_material/check_track_panel.cjs <verified debug bundle> <out dir>
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{configure}=require('../gym/launch.cjs'),pointer=require('../gym/pointer.cjs');
const [bundleArg,outArg]=process.argv.slice(2);
if(!bundleArg||!outArg)throw Error('Usage: node tools/terrain_material/check_track_panel.cjs BUNDLE OUT');
const out=path.resolve(outArg);fs.mkdirSync(out,{recursive:true});
function find(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory()){const v=find(p);if(v)return v;}else if(e.name==='index.html')return p;}}
const web=path.dirname(find(path.resolve(bundleArg)));
const server=http.createServer((q,r)=>{const f=path.join(web,new URL(q.url,'http://x').pathname);if(!f.startsWith(web)||!fs.existsSync(f)){r.writeHead(404);return r.end();}r.setHeader('Content-Type',f.endsWith('.wasm')?'application/wasm':f.endsWith('.js')?'text/javascript':f.endsWith('.json')?'application/json':'text/html');fs.createReadStream(f).pipe(r);});
(async()=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/ERROR:|EDITOR_MESH_FALLBACK/.test(m.text()))errors.push(m.text());});
 await configure(page,'track-543','le6');
 await page.goto('http://127.0.0.1:'+server.address().port+'/index.html?station=first-run');
 await page.waitForFunction(()=>window.riderTelemetry?.sequence>30,null,{timeout:90000});
 await page.locator('canvas').focus();
 const key=async k=>{await page.keyboard.down(k);await pointer.frames(page);await page.keyboard.up(k);await pointer.frames(page);};
 await key('e');await page.waitForFunction(()=>window.riderEditor?.mode==='edit'&&window.riderEditor.screen,null,{timeout:20000});await pointer.frames(page,{n:20});
 const tap=async name=>{const q=await page.evaluate(n=>{const e=window.riderEditor,b=e.buttons[n],c=document.querySelector('canvas'),r=c.getBoundingClientRect();if(!b||!e.visible.includes(n))return null;return {x:r.x+b.x/c.width*r.width,y:r.y+(1-b.y/c.height)*r.height};},name);assert.ok(q,'invisible '+name);await pointer.tap(page,q);await pointer.frames(page,{n:6});};
 const stride=()=>page.evaluate(()=>window.riderRoadProjection?.stride);
 const material=()=>page.evaluate(()=>window.riderEditorDoc.material||null);
 for(let i=0;i<5&&!await page.evaluate(()=>window.riderTrackPanel?.visible);i++){await page.mouse.move(640,70);await pointer.frames(page,{n:6});await tap('track_textures');await page.waitForTimeout(300);}
 assert.equal(await page.evaluate(()=>window.riderTrackPanel.visible),true,'panel');
 assert.equal(await page.locator('#rider-track-panel [data-preset]').count(),7);
 // Draft preview, document unchanged.
 await page.locator('[data-preset=volcano]').click();await page.waitForFunction(()=>window.riderRoadProjection?.material?.preset==='volcano',null,{timeout:10000});
 assert.equal(await material(),null,'a draft leaves the document alone');
 await page.locator('#rider-track-band').selectOption('meadow');await pointer.frames(page,{n:10});await page.waitForTimeout(500);
 await page.screenshot({path:path.join(out,'draft.png')});
 // Keys in the panel do not reach the editor.
 await page.locator('#rider-track-band').focus();const undo=await page.evaluate(()=>window.riderEditor.undo);await page.keyboard.press('Delete');await page.keyboard.press('e');await pointer.frames(page,{n:6});
 assert.equal(await page.evaluate(()=>window.riderEditor.mode),'edit');assert.equal(await page.evaluate(()=>window.riderEditor.undo),undo);
 // Discard restores.
 await page.locator('#rider-track-discard').click();await page.waitForFunction(()=>!window.riderRoadProjection?.material?.preset,null,{timeout:10000});
 // Apply is one Undo step.
 await page.locator('[data-preset=inca]').click();await pointer.frames(page,{n:6});await page.locator('#rider-track-band').selectOption('glacier');await pointer.frames(page,{n:6});
 await page.locator('#rider-track-apply').click();await page.waitForFunction(()=>window.riderEditorDoc.material?.preset==='inca',null,{timeout:10000});
 assert.equal((await material()).band,'glacier');assert.equal(await page.evaluate(()=>window.riderEditor.undo),undo+1);
 await page.locator('#rider-track-close').click();await page.waitForFunction(()=>!window.riderTrackPanel.visible);await pointer.frames(page,{n:6});
 await page.mouse.move(640,70);await pointer.frames(page,{n:6});await page.locator('canvas').focus();for(let i=0;i<4&&await page.evaluate(()=>!!window.riderEditorDoc.material);i++){await tap('undo');await pointer.frames(page,{n:10});await page.waitForTimeout(300);}await page.waitForFunction(()=>!window.riderEditorDoc.material,null,{timeout:10000}).catch(async e=>{console.log(JSON.stringify(await page.evaluate(()=>({m:window.riderEditor.message,status:window.riderEditor.status,u:window.riderEditor.undo,mat:window.riderEditorDoc.material}))));await page.screenshot({path:path.join(out,'undo.png')});throw e;});
 await page.waitForFunction(()=>!window.riderRoadProjection?.material?.preset,null,{timeout:10000});
 await tap('redo');await page.waitForFunction(()=>window.riderEditorDoc.material?.preset==='inca',null,{timeout:10000});
 await page.waitForFunction(()=>window.riderRoadProjection?.material?.preset==='inca',null,{timeout:10000});
 await page.waitForFunction(()=>window.riderEditor.status==='Saved'&&!window.riderEditor.dirty,null,{timeout:20000});
 await page.reload();await page.waitForFunction(()=>window.riderEditor?.mode==='edit'||window.riderTelemetry?.sequence>2,null,{timeout:60000});await page.waitForTimeout(800);
 if(await page.evaluate(()=>window.riderEditor?.mode!=='edit')){await page.locator('canvas').focus();await key('e');}
 await page.waitForFunction(()=>window.riderEditor?.mode==='edit'&&window.riderEditorDoc?.material?.preset==='inca',null,{timeout:30000});
 await page.waitForTimeout(800);assert.equal(await stride(),52);await page.screenshot({path:path.join(out,'reloaded.png')});
 await tap('play');await page.waitForFunction(()=>window.riderEditor?.mode!=='edit'&&window.riderRoadProjection?.material?.preset==='inca',null,{timeout:30000});await page.waitForTimeout(800);
 await page.locator('canvas').focus();await page.keyboard.down('w');await page.waitForTimeout(3000);await page.keyboard.up('w');await page.screenshot({path:path.join(out,'drive.png')});
 await browser.close();server.close();
 assert.deepEqual(errors,[]);console.log('PASS');
})().catch(e=>{console.error(String(e.stack||e).slice(0,500));process.exit(1);});
