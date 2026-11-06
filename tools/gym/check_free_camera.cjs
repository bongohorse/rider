// #574: real input in a debug build: O toggles, D moves, the wheel zooms, O returns to the vehicle; the vehicle stays put;
// wheel zoom still works in the editor afterwards.  node tools/gym/check_free_camera.cjs <debug bundle>
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{configure}=require('./launch.cjs'),pointer=require('./pointer.cjs');
function find(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory()){const v=find(p);if(v)return v;}else if(e.name==='index.html')return p;}}
const web=path.dirname(find(path.resolve(process.argv[2])));
const server=http.createServer((q,r)=>{const f=path.join(web,new URL(q.url,'http://x').pathname);if(!f.startsWith(web)||!fs.existsSync(f)){r.writeHead(404);return r.end();}r.setHeader('Content-Type',f.endsWith('.wasm')?'application/wasm':f.endsWith('.js')?'text/javascript':f.endsWith('.json')?'application/json':'text/html');fs.createReadStream(f).pipe(r);});
(async()=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const b=await chromium.launch(),p=await b.newPage({viewport:{width:1280,height:720}});await configure(p,'free-574','le6');
 await p.goto('http://127.0.0.1:'+server.address().port+'/index.html?station=first-run');
 await p.waitForFunction(()=>window.riderRoadProjection?.sections>0&&window.riderTelemetry?.sequence>60,null,{timeout:90000});
 await p.waitForFunction(()=>Math.abs(window.riderTelemetry.speed_mps)<.05,null,{timeout:20000});
 const cam=()=>p.evaluate(()=>window.riderRoadProjection.camera[0]),at=await cam(),car=await p.evaluate(()=>window.riderTelemetry.station_distance);
 await p.locator('canvas').focus();await p.keyboard.press('KeyO');await p.waitForTimeout(200);assert.equal(await p.evaluate(()=>window.riderFreeCam.on),true);
 await p.keyboard.down('d');await p.waitForTimeout(800);await p.keyboard.up('d');await p.waitForTimeout(300);assert.ok(await cam()>at+3,'moved');
 const z=await p.evaluate(()=>window.riderFreeCam.zoom);await p.mouse.move(300,300);await p.mouse.wheel(0,400);await p.waitForTimeout(200);assert.ok(await p.evaluate(()=>window.riderFreeCam.zoom)<z,'zoomed');
 assert.ok(Math.abs(await p.evaluate(()=>window.riderTelemetry.station_distance)-car)<.05,'the vehicle stays');
 await p.keyboard.press('KeyO');await p.waitForTimeout(800);assert.ok(Math.abs(await cam()-at)<.5,'back to the vehicle');
 // A driving key held across the toggle is released in the game.
 await p.keyboard.down('w');await p.waitForTimeout(600);await p.keyboard.press('KeyO');await p.keyboard.up('w');await p.waitForTimeout(1500);const v1=await p.evaluate(()=>window.riderTelemetry.speed_mps);await p.waitForTimeout(1000);assert.ok(await p.evaluate(()=>window.riderTelemetry.speed_mps)<=v1+.01,'throttle released');await p.keyboard.press('KeyO');
 // On when entering Edit: it switches off.
 await p.keyboard.press('KeyO');await p.waitForTimeout(100);
 await p.keyboard.down('e');await pointer.frames(p,{n:3});await p.keyboard.up('e');await p.waitForFunction(()=>window.riderEditor?.mode==='edit'&&window.riderEditor.screen,null,{timeout:20000});await p.waitForTimeout(500);
 const ez=await p.evaluate(()=>window.riderEditor.camera.zoom);await p.mouse.move(640,300);await pointer.frames(p,{n:3});await p.mouse.wheel(0,-240);await pointer.frames(p,{n:6});assert.ok(await p.evaluate(()=>window.riderEditor.camera.zoom)>ez,'editor wheel');assert.equal(await p.evaluate(()=>window.riderFreeCam.on),false,'off in Edit');
 await b.close();server.close();console.log('PASS');
})().catch(e=>{console.error(String(e.message||e).slice(0,300));process.exit(1);});
