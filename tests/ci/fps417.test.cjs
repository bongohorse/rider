'use strict';
// #417: pure checks of the fps417 Gym runner (the runner itself needs a real Defold debug bundle).
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {parseArgs,level,verifyCounter,verifyNoDrive,nextCap,CAPS,DEFAULT_CAP,capLabel}=require('../../tools/gym/fps417.cjs');
const root=path.resolve(__dirname,'../..');

test('CLI accepts exactly the fps417 case',()=>{
 assert.deepEqual(parseArgs(['out','sha','run','fps417','bundle']),{output:'out',sha:'sha',runId:'run',bundle:'bundle'});
 for(const bad of [[],['out','sha','run','fps356runtime','bundle'],['out','sha','','fps417','bundle'],['out','sha','run','fps417','bundle','--fast']])
  assert.throws(()=>parseArgs(bad),/Usage/);
});

test('cycle, default and labels match the game module',()=>{
 assert.deepEqual(CAPS,[30,60,90,120,144,0]);assert.equal(DEFAULT_CAP,60);
 let cap=DEFAULT_CAP;const seen=[];for(let i=0;i<6;i++){cap=nextCap(cap);seen.push(cap);}
 assert.deepEqual(seen,[90,120,144,0,30,60]);
 assert.equal(capLabel(0),'cap unlimited');assert.equal(capLabel(144),'cap 144');
 const lua=fs.readFileSync(path.join(root,'main/game/fps_counter.lua'),'utf8');
 assert.match(lua,/M\.CAPS=\{30,60,90,120,144,0\}/);assert.match(lua,/M\.DEFAULT_CAP=60/);assert.match(lua,/M\.UNLIMITED_REFERENCE=60/);
 assert.match(lua,/fps\*100>=90\*ref/);assert.match(lua,/fps\*100>=70\*ref/);
});

test('colour level is relative to the cap, Unlimited against 60',()=>{
 for(const [fps,cap,want] of [[54,60,'green'],[53.9,60,'orange'],[42,60,'orange'],[41.9,60,'red'],[60,144,'red'],[130,144,'green'],
  [101,144,'orange'],[27,30,'green'],[54,0,'green'],[41,0,'red'],[240,0,'green']])assert.equal(level(fps,cap),want,`${fps}@${cap}`);
 assert.equal(level(null,60),null);assert.equal(level(NaN,60),null);
});

const window60={world_update_callback_hz:59.8,fixed_tick_wall_hz:60.01,fixed_dt_s:1/60,elapsed_s:4.3};
const counter60={cap:60,label:false,fps:59.7,buckets:4,text:'60 fps',level:'green',color:[0.30000001,0.89999998,0.60000002]};
test('counter must report the measured cadence in its colour',()=>{
 assert.equal(verifyCounter(counter60,window60,60).level,'green');
 // Browser paces at 60 while the cap is 144: the counter shows ~60 in red, never the requested 144.
 const m144={...window60,world_update_callback_hz:60.1};
 assert.equal(verifyCounter({...counter60,cap:144,level:'red',color:[1,0.25,0.25]},m144,144).level,'red');
 assert.throws(()=>verifyCounter({...counter60,cap:144,fps:144,text:'144 fps',level:'green'},m144,144),/differs from the measured/);
 assert.throws(()=>verifyCounter({...counter60,cap:144},m144,144),/colour level/);
 assert.throws(()=>verifyCounter(counter60,window60,90),/another cap/);
 assert.throws(()=>verifyCounter({...counter60,label:true},window60,60),/label/);
 assert.throws(()=>verifyCounter({...counter60,buckets:2},window60,60),/smoothing window/);
 assert.throws(()=>verifyCounter({...counter60,text:'59 fps'},window60,60),/rounded/);
 assert.throws(()=>verifyCounter({...counter60,color:[1,0.65,0.2]},window60,60),/colour differs/);
 assert.throws(()=>verifyCounter({...counter60,fps:false},window60,60),/no measured reading/);
});

test('cap 30 and 60 must be observed; no cadence above a cap',()=>{
 const c30={...counter60,cap:30,fps:30.1,text:'30 fps'};
 assert.equal(verifyCounter(c30,{...window60,world_update_callback_hz:30.05},30).cap,30);
 assert.throws(()=>verifyCounter({...c30,fps:59.7,text:'60 fps'},window60,30),/Cap 30 not observed|above cap/);
 assert.throws(()=>verifyCounter({...counter60,fps:31,text:'31 fps',level:'red',color:[1,0.25,0.25]},{...window60,world_update_callback_hz:30.5},60),/Cap 60 not observed/);
 assert.throws(()=>verifyCounter({...counter60,cap:90,fps:120,text:'120 fps'},{...window60,world_update_callback_hz:120},90),/above cap/);
});

test('a tap-only recording must hold no drive command',()=>{
 const rec={ended:'stopped',error:false,ticks:180,commands:{throttle:0,brake:0,lean:0}};
 assert.deepEqual(verifyNoDrive(rec,6).commands,{throttle:0,brake:0,lean:0});
 assert.throws(()=>verifyNoDrive({...rec,commands:{throttle:1,brake:0,lean:0}},6),/drive input/);
 assert.throws(()=>verifyNoDrive({...rec,commands:{throttle:0,brake:0,lean:2}},6),/drive input/);
 assert.throws(()=>verifyNoDrive({...rec,ended:false},6),/stopped/);
 assert.throws(()=>verifyNoDrive({...rec,ticks:5},6),/too short/);
 assert.throws(()=>verifyNoDrive(rec,1),/Too few/);
});

test('fps417 is registered in smoke.py, the CI matrix and the affected rules',()=>{
 const smoke=fs.readFileSync(path.join(root,'tools/gym/smoke.py'),'utf8');
 assert.match(smoke,/'fps417\.cjs' if args\.case=='fps417'/);
 const g1=fs.readFileSync(path.join(root,'.github/workflows/g1.yml'),'utf8');
 assert.match(g1,/cases: 'fps417'/);assert.match(g1,/--case fps417\n/);
 const rules=JSON.parse(fs.readFileSync(path.join(root,'tools/local_affected.json'),'utf8')).rules;
 assert(rules.some(r=>Array.isArray(r.cases)&&r.cases.includes('fps417')&&r.paths.includes('tools/gym/fps417.cjs')));
});
