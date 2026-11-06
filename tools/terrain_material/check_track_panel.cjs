// #543, #604: real input: open the panel, each choice is stored at once as one Undo step, Undo,
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
 // A choice is stored at once as one Undo step.
 await page.locator('[data-preset=volcano]').click();await page.waitForFunction(()=>window.riderRoadProjection?.material?.preset==='volcano',null,{timeout:10000});
 await page.waitForFunction(()=>window.riderEditorDoc.material?.preset==='volcano',null,{timeout:10000});
 await page.locator('#rider-track-band').selectOption('meadow');await pointer.frames(page,{n:10});await page.waitForTimeout(500);
 await page.screenshot({path:path.join(out,'draft.png')});
 // Keys in the panel do not reach the editor.
 await page.locator('#rider-track-band').focus();const undo=await page.evaluate(()=>window.riderEditor.undo);await page.keyboard.press('Delete');await page.keyboard.press('e');await pointer.frames(page,{n:6});
 assert.equal(await page.evaluate(()=>window.riderEditor.mode),'edit');assert.equal(await page.evaluate(()=>window.riderEditor.undo),undo);
 // #590: the editor keeps working beside the panel, and the draft follows the edit.
 await page.locator('canvas').focus();await page.mouse.move(640,70);await pointer.frames(page,{n:6});const q=await page.evaluate(()=>{const e=window.riderEditor,c=document.querySelector('canvas'),r=c.getBoundingClientRect();return {x:r.x+(e.screen.ox+15*e.screen.ppm_x)*r.width/c.width,y:r.y+r.height-(e.screen.oy+.1*e.screen.ppm_y)*r.width/c.width};});
 for(let i=0;i<3&&!await page.evaluate(()=>!!window.riderEditor.selection);i++){await pointer.tap(page,q);await pointer.frames(page,{n:8});await page.waitForTimeout(300);}
 assert.ok(await page.evaluate(()=>!!window.riderEditor.selection),'a click selects beside the panel');assert.equal(await page.evaluate(()=>window.riderRoadProjection.material.preset),'volcano');
 // Each choice is one Undo step; there is no Apply or Discard.
 assert.equal(await page.locator('#rider-track-apply').count(),0);assert.equal(await page.locator('#rider-track-discard').count(),0);
 const before=await page.evaluate(()=>window.riderEditor.undo);
 await page.locator('[data-preset=inca]').click();await page.waitForFunction(()=>window.riderEditorDoc.material?.preset==='inca',null,{timeout:10000});
 assert.equal(await page.evaluate(()=>window.riderEditor.undo),before+1);
 await page.locator('#rider-track-band').selectOption('glacier');await page.waitForFunction(()=>window.riderEditorDoc.material?.band==='glacier',null,{timeout:10000});
 assert.equal((await material()).band,'glacier');assert.equal(await page.evaluate(()=>window.riderEditor.undo),before+2);
 await page.locator('canvas').focus();await page.waitForTimeout(1100);await page.mouse.move(640,70);await pointer.frames(page,{n:6});await tap('undo');await page.waitForFunction(()=>window.riderEditorDoc.material?.band==='meadow',null,{timeout:10000});await page.waitForFunction(()=>document.querySelector('#rider-track-band').value==='meadow',null,{timeout:10000});await tap('redo');await page.waitForFunction(()=>window.riderEditorDoc.material?.band==='glacier',null,{timeout:10000});
 await page.locator('#rider-track-close').click();await page.waitForFunction(()=>!window.riderTrackPanel.visible);await pointer.frames(page,{n:6});
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
