'use strict';
// #444: pure checks of the fps444 Gym runner (the runner itself needs a real Defold debug bundle).
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {parseArgs,normalised,storedRect,displaced,overlap,contains,verifyPlacement,verifyNoDrive,PRESETS,THRESHOLD_CSS_PX}=require('../../tools/gym/fps444.cjs');
const root=path.resolve(__dirname,'../..');

test('CLI accepts exactly the fps444 case',()=>{
 assert.deepEqual(parseArgs(['out','sha','run','fps444','bundle']),{output:'out',sha:'sha',runId:'run',bundle:'bundle'});
 for(const bad of [[],['out','sha','run','fps417','bundle'],['out','sha','','fps444','bundle'],['out','sha','run','fps444','bundle','--fast']])
  assert.throws(()=>parseArgs(bad),/Usage/);
});

test('presets and threshold mirror the game module',()=>{
 const lua=fs.readFileSync(path.join(root,'main/game/fps_place.lua'),'utf8');
 for(const [name,[x,y]] of Object.entries(PRESETS))assert.match(lua,new RegExp(`\\b${name}=\\{${x},${y}\\}`),name);
 assert.equal(Object.keys(PRESETS).length,9);
 assert.match(lua,new RegExp(`M\\.THRESHOLD_CSS_PX=${THRESHOLD_CSS_PX}\\b`));
 assert.match(lua,/M\.DEFAULT_X,M\.DEFAULT_Y=0,0/,'reset must be the top left');
 const menu=fs.readFileSync(path.join(root,'main/game/level_menu.js'),'utf8');
 for(const name of Object.keys(PRESETS))assert.match(menu,new RegExp(`\\['${name}',`),'Menu lacks preset '+name);
});

test('normalised position of a placed rectangle',()=>{
 const area={x0:0,y0:0,x1:1280,y1:720};
 assert.deepEqual(normalised({x0:0,y0:674,x1:112,y1:720},area),{x:0,y:0});
 assert.deepEqual(normalised({x0:1168,y0:0,x1:1280,y1:46},area),{x:1,y:1});
 const n=normalised({x0:584,y0:337,x1:696,y1:383},area);assert(Math.abs(n.x-0.5)<1e-9&&Math.abs(n.y-0.5)<1e-9);
 assert.deepEqual(normalised({x0:0,y0:0,x1:2000,y1:900},area),{x:0,y:0},'no travel');
});

test('overlap and contains',()=>{
 const a={left:0,top:0,right:100,bottom:50};
 assert(overlap(a,{left:50,top:25,right:150,bottom:75}));
 assert(!overlap(a,{left:100,top:0,right:200,bottom:50}),'touching is not overlapping');
 assert(!overlap(a,{left:0,top:50.4,right:100,bottom:90}),'sub-pixel rounding is tolerated');
 assert(contains(a,{x:10,y:10})&&!contains(a,{x:100,y:10}));
});

function snapshot(over={}){
 const css={left:10,top:10,right:122,bottom:56};
 const zone={name:'drive:brake',left:8,top:390,right:138,bottom:478};
 return {canvas:{left:0,top:0,right:1080,bottom:486},dom:[zone],gui:[],hud_css:{...css},
  place:{clear:true,css,hit_css:{...css},blocked_css:[{left:8,top:390,right:138,bottom:478}],...over.place},...over};
}
test('placement verification: inside, clear of controls, measured where placed, controls avoided by the game',()=>{
 assert.deepEqual(verifyPlacement(snapshot(),'ok'),{left:10,top:10,width:112,height:46});
 const s=snapshot();s.place.css={left:1000,top:10,right:1112,bottom:56};s.place.hit_css=s.hud_css={...s.place.css};
 assert.throws(()=>verifyPlacement(s,'out'),/leaves the canvas/);
 const z=snapshot();z.place.css={left:20,top:400,right:132,bottom:446};z.place.hit_css=z.hud_css={...z.place.css};
 assert.throws(()=>verifyPlacement(z,'zone'),/covers drive:brake/);
 const g=snapshot({gui:[{name:'pause',left:100,top:40,right:192,bottom:64}]});g.place.blocked_css.push({left:100,top:40,right:192,bottom:64});
 assert.throws(()=>verifyPlacement(g,'pause'),/covers the GUI button pause/,'edge overlap, centre outside the counter');
 const ga=snapshot({gui:[{name:'pause',left:130,top:40,right:222,bottom:64}]});assert.throws(()=>verifyPlacement(ga,'pause'),/does not avoid the GUI button pause/);
 ga.place.blocked_css.push({left:130,top:40,right:222,bottom:64});assert.doesNotThrow(()=>verifyPlacement(ga,'clear'));
 const m=snapshot();m.hud_css={left:30,top:10,right:142,bottom:56};assert.throws(()=>verifyPlacement(m,'moved'),/corner probes left/);
 const u=snapshot();u.place.blocked_css=[];assert.throws(()=>verifyPlacement(u,'unknown'),/does not avoid drive:brake/);
 const c=snapshot();c.place.clear=false;assert.throws(()=>verifyPlacement(c,'crowded'),/no clear position/);
});

test('a drag recording must hold no drive command',()=>{
 const rec={ended:'stopped',error:false,ticks:120,commands:{throttle:0,brake:0,lean:0}};
 assert.deepEqual(verifyNoDrive(rec,'x'),{ticks:120,commands:rec.commands});
 assert.throws(()=>verifyNoDrive({...rec,commands:{throttle:1,brake:0,lean:0}},'x'),/drive input/);
 assert.throws(()=>verifyNoDrive({...rec,commands:{throttle:0,brake:0,lean:3}},'x'),/drive input/);
 assert.throws(()=>verifyNoDrive({...rec,ended:false},'x'),/stopped/);
 assert.throws(()=>verifyNoDrive({...rec,ticks:10},'x'),/too short/);
});

test('fps444 is registered in smoke.py, the CI matrix and the affected rules',()=>{
 const smoke=fs.readFileSync(path.join(root,'tools/gym/smoke.py'),'utf8');
 assert.match(smoke,/'fps444\.cjs' if args\.case=='fps444'/);assert.match(smoke,/if args\.case=='fps444':/);
 const g1=fs.readFileSync(path.join(root,'.github/workflows/g1.yml'),'utf8');
 assert.match(g1,/cases: 'fps417 fps444'/);assert.match(g1,/--case fps444\n/);
 const rules=JSON.parse(fs.readFileSync(path.join(root,'tools/local_affected.json'),'utf8')).rules;
 assert(rules.some(r=>Array.isArray(r.cases)&&r.cases.includes('fps444')&&r.paths.includes('tools/gym/fps444.cjs')));
 assert(rules.some(r=>Array.isArray(r.cases)&&r.cases.includes('fps444')&&r.paths.includes('tools/gym/storage.cjs')));
 const controller=fs.readFileSync(path.join(root,'main/game/controller.script'),'utf8');
 assert.match(controller,/self\.testcase=="fps444" then assert\(sys\.get_engine_info\(\)\.is_debug and html5/);
});

test('stored position and displacement by a control',()=>{
 const place={x:0.5,y:0.5,rect:{x0:0,y0:0,x1:112,y1:46},area:{x0:0,y0:0,x1:1280,y1:720},pixel_ratio:1,blocked:[]};
 assert.deepEqual(storedRect(place),{x0:584,y0:337,x1:696,y1:383});
 assert.equal(displaced(place),false);
 assert.equal(displaced({...place,blocked:[{x0:690,y0:300,x1:800,y1:340}]}),true,'overlapping control');
 assert.equal(displaced({...place,blocked:[{x0:698,y0:300,x1:800,y1:340}]}),true,'inside the 4 px gap');
 assert.equal(displaced({...place,blocked:[{x0:700.5,y0:300,x1:800,y1:340}]}),false,'beyond the gap');
 assert.equal(displaced({...place,pixel_ratio:2,blocked:[{x0:700.5,y0:300,x1:800,y1:340}]}),true,'gap scales with the pixel ratio');
});
