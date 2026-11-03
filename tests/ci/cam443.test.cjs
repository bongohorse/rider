'use strict';
// #443: pure checks of the cam443 Gym runner (the runner itself needs a real Defold debug bundle).
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {parseArgs,identicalPhysics,renderByTick,cameraDelta,verifyNoDrive,verifyReplay,overlap,inside,sameValues,
 SCENARIOS,PHYSICS_KEYS,DEFAULTS}=require('../../tools/gym/camera443.cjs');
const root=path.resolve(__dirname,'../..');

test('CLI accepts exactly the cam443 case',()=>{
 assert.deepEqual(parseArgs(['out','sha','run','cam443','bundle']),{output:'out',sha:'sha',runId:'run',bundle:'bundle'});
 for(const bad of [[],['out','sha','run','fps444','bundle'],['out','sha','','cam443','bundle'],['out','sha','run','cam443','bundle','--fast']])
  assert.throws(()=>parseArgs(bad),/Usage/);
});

test('defaults and scenarios mirror the game modules',()=>{
 const lua=fs.readFileSync(path.join(root,'main/game/camera_settings.lua'),'utf8');
 assert.match(lua,/M\.DEFAULT_MODE="a"/,'camera A must stay the default');
 for(const [key,value] of Object.entries(DEFAULTS)){
  if(key==='mode')continue;
  assert.match(lua,new RegExp(`key="${key}",[^\\n]*default=${value},`),'default of '+key);
 }
 const drive=fs.readFileSync(path.join(root,'main/gym/camera_drive443.lua'),'utf8');
 for(const s of SCENARIOS){
  const script=/drive443=(\w+)/.exec(s.query)[1];
  assert.match(drive,new RegExp(`\\b${script}=true`),'unknown drive443 script '+script);
  assert(s.ticks<=440&&s.ticks>=300,'window must fit the probe page buffer (480)');
  assert(lua.includes(`key="${s.setting.key}"`),'unknown setting '+s.setting.key);
 }
 assert.deepEqual(SCENARIOS.map(s=>s.station),['ramps-long','air','straight']);
 const probe=fs.readFileSync(path.join(root,'main/gym/camera_probe352.lua'),'utf8');
 for(const k of PHYSICS_KEYS)if(!['resets','generation','dt'].includes(k))assert.match(probe,new RegExp(`\\b${k}=`),'probe lacks '+k);
});

const trace=(n,f=s=>s)=>Array.from({length:n},(_,i)=>f({tick:i+1,engine_tick:i+5,resets:0,generation:1,dt:1/60,x:i*2,y:-i,vx:120,vy:-60,
 rear:true,front:true,throttle:0,brake_reverse:0,allow_reverse:false,reverse_engaged:false,mode:'a'}));

test('physics identity is exact over every compared tick and every field',()=>{
 const a=trace(120),b=trace(120,s=>({...s,engine_tick:s.engine_tick+1,mode:s.tick>20?'b':'a'}));
 const r=identicalPhysics(a,b,120);
 assert.equal(r.max_difference,0);assert.deepEqual(r.modes,{a:{a:120,b:0},b:{a:20,b:100}});
 for(const k of PHYSICS_KEYS){
  const bad=b.map(s=>s.tick===77?{...s,[k]:typeof s[k]==='boolean'?!s[k]:s[k]+1e-9}:s);
  assert.throws(()=>identicalPhysics(a,bad,120),new RegExp(`tick 77: ${k}`),'difference in '+k+' accepted');
 }
 assert.throws(()=>identicalPhysics(a,b.filter(s=>s.tick!==50),120),/missing fixed tick 50/);
 assert.throws(()=>identicalPhysics(a,b.slice(1),120),/does not start at the first drive-ready tick/);
 assert.throws(()=>identicalPhysics(a,b.concat({...b[9],x:5}),120),/conflicting duplicate/);
 assert.throws(()=>identicalPhysics(a,b,59),/too short/);
 assert.throws(()=>identicalPhysics(trace(120,s=>({...s,dt:1/30})),trace(120,s=>({...s,dt:1/30})),120),/fixed 1\/60/);
 assert.throws(()=>identicalPhysics(a,b.map(s=>s.tick===3?{...s,x:NaN}:s),120),/non-finite x/);
});

test('render frames pair by vehicle tick and report the camera change',()=>{
 const pa=trace(60),pb=trace(60,s=>({...s,engine_tick:s.engine_tick+1}));
 const frames=(p,shift,dy)=>p.flatMap(s=>[{tick:s.engine_tick,cx:s.x,cy:s.y+(s.tick>=30?dy:0)+shift,zoom:1,mode:'a'},{tick:s.engine_tick,cx:999,cy:999,zoom:9}]);
 const ra=renderByTick(frames(pa,0,0),pa),rb=renderByTick(frames(pb,0,25),pb);
 assert.equal(ra.size,60,'first render per vehicle tick');assert.equal(ra.get(1).cx,0);
 const before=cameraDelta(ra,rb,{to:29}),after=cameraDelta(ra,rb,{from:30});
 assert.equal(before.max_dcy_u,0);assert.equal(after.max_dcy_u,25);assert.equal(after.paired_ticks,31);assert.equal(after.first_tick,30);
 assert.equal(cameraDelta(ra,rb,{filter:s=>s.mode==='b'}).paired_ticks,0);
 assert.throws(()=>renderByTick([{tick:5,cx:NaN,cy:0,zoom:1}],pa),/non-finite render camera cx/);
});

test('no-drive recordings and replay verdicts',()=>{
 const rec={ended:'stopped',error:false,ticks:90,commands:{throttle:0,brake:0,lean:0}};
 assert.deepEqual(verifyNoDrive(rec,'t'),{ticks:90,commands:rec.commands});
 assert.throws(()=>verifyNoDrive({...rec,commands:{throttle:1,brake:0,lean:0}},'t'),/drive input/);
 assert.throws(()=>verifyNoDrive({...rec,ticks:30},'t'),/too short/);
 assert.throws(()=>verifyNoDrive({...rec,ended:'full'},'t'),/not cleanly stopped/);
 const play={ended:'done',complete:true,verdict:'MATCH',mismatches:0,tuning_changed:false,scaled_ticks:0,ticks:300,max_position_m:0,max_angle_rad:0};
 assert.equal(verifyReplay(play,'r').verdict,'MATCH');
 for(const [k,v,re] of [['verdict','DIVERGED',/verdict/],['mismatches',2,/commands differ/],['tuning_changed',true,/live tuning/],
  ['scaled_ticks',3,/1\.0 step/],['complete',false,/did not complete/],['ended','tick gap',/did not complete/]])
  assert.throws(()=>verifyReplay({...play,[k]:v},'r'),re,k);
});

test('placement helpers and settings comparison',()=>{
 const c={left:0,top:0,right:1280,bottom:720},a={left:10,top:10,right:110,bottom:60};
 assert(inside(a,c)&&!inside({...a,right:1281},c));
 assert(overlap(a,{left:100,top:50,right:200,bottom:90})&&!overlap(a,{left:110,top:0,right:200,bottom:60}),'touching is not overlapping');
 assert(sameValues({...DEFAULTS},DEFAULTS)&&!sameValues({...DEFAULTS,zoom:1.05},DEFAULTS)&&!sameValues({...DEFAULTS,mode:'b'},DEFAULTS));
});
