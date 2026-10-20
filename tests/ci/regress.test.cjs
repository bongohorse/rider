// A22 (#37): stored regression traces, expected outcomes, frozen tolerances and the outcome check.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const S=require('../../tools/gym/regress_spec.cjs');

test('tolerances stay frozen at their declared sources',()=>{
  // Changing a value here weakens or tightens the regression check: it needs its own reviewed decision.
  assert.deepEqual(JSON.parse(JSON.stringify(S.TOLERANCE)),{
    pose:{position_m:0.05,angle_rad:0.05}, // A21 replay.lua M.TOLERANCE
    top_speed_mps:0.02, // a19 / a19b / a19c speed repeat tolerance
    gaps:{jump_distance_m:0.05,takeoff_speed_mps:0.02,peak_compression_m:0.005}, // a19
    air:{takeoff_speed_mps:0.02,airtime_s:0.034,rotation_deg:5,landing_angle_deg:5,peak_compression_m:0.005}, // a19c
  });
  assert.match(fs.readFileSync(path.join(S.ROOT,'main/gym/replay.lua'),'utf8'),/M\.TOLERANCE=\{position_m=0\.05,angle_rad=0\.05\}/);
  assert.equal(S.TRACES.length,3);
  assert.deepEqual(JSON.parse(JSON.stringify(S.PERTURB)),{
    trace:{name:'gaps-3',throttle_zero:[1,45],must_fail:['verdict','takeoff_speed_mps']},
    preset:{name:'straight-top',tune:{key:'motor_speed',value:-31},must_fail:['top_speed_mps']},
  });
});

test('CI only checks the stored traces and never regenerates them',()=>{
  const dir=path.join(S.ROOT,'.github/workflows');
  for(const name of fs.readdirSync(dir))assert(!/--record\b/.test(fs.readFileSync(path.join(dir,name),'utf8')),name+' passes --record');
  const g1=fs.readFileSync(path.join(dir,'g1.yml'),'utf8');
  assert.match(g1,/run: python tools\/gym\/smoke\.py --bundle artifacts\/g1\/gym-bundle --output artifacts\/g1\/regress --case a22\n/);
  // The runner itself refuses --record when CI is set.
  assert.match(fs.readFileSync(path.join(S.ROOT,'tools/gym/regress.cjs'),'utf8'),/if\(RECORD&&process\.env\.CI\)\{[^}]*process\.exit\(2\);\}/);
});

test('every trace is a valid format-v1 recording of preset A, unmodified, from its station start',()=>{
  const A=S.presetA(),expected=S.readExpected();
  assert.equal(expected.schema,1);assert.equal(expected.preset,'a');
  assert.deepEqual(Object.keys(expected.traces).sort(),S.TRACES.map(d=>d.name).sort());
  for(const def of S.TRACES){
    const text=fs.readFileSync(S.file(def.name),'utf8'),t=JSON.parse(text),e=expected.traces[def.name];
    assert.equal(e.sha256,S.sha256(text),def.name+': trace changed without regenerating expected.json');
    assert.equal(e.file,'traces/'+def.name+'.json');assert.equal(e.ticks,def.ticks);
    assert.equal(t.version,1);assert.equal(t.name,def.name);
    assert.equal(t.preset,'a',def.name+': preset');assert.equal(t.modified,false,def.name+': modified');
    assert.deepEqual(t.tuning,A.values,def.name+': tuning is not preset A');assert.equal(t.identity,A.identity);
    assert.equal(t.station,def.station);assert.equal(t.section,def.section);assert.equal(t.start_speed,def.start_speed);
    const station=JSON.parse(fs.readFileSync(path.join(S.ROOT,'main/gym/stations',def.station+'.json'),'utf8'));
    const start=def.section===false?station.start_speed:station.sections.find(s=>s.id===def.section).start_speed;
    assert.equal(start,def.start_speed,def.name+': station start speed');
    assert.equal(t.ticks,def.ticks);assert.equal(t.ended,'full');assert.equal(t.scaled_ticks,0);assert.equal(t.trailing,true);
    for(const k of ['throttle','brake','reverse','lean'])assert.equal(t[k].length,def.ticks,def.name+': '+k+' one entry per tick');
    assert.equal(t.pose.length,9*(def.ticks+1),def.name+': one pose per tick plus the trailing pose');
    for(let i=0;i<def.ticks;i++){
      for(const k of ['throttle','brake','reverse'])assert([0,1].includes(t[k][i]),def.name+': '+k+' at tick '+(i+1));
      assert(t.lean[i]>=-1&&t.lean[i]<=1);
    }
    assert(t.pose.every(Number.isFinite));
    // The protocol drivers: A19 full throttle without brake/lean; A19c adds the held lean in flight only.
    assert(t.throttle.every(v=>def.program!=='full'||v===1)&&t.brake.every(v=>v===0));
    if(def.program==='full')assert(t.lean.every(v=>v===0));
    else{
      // Throttle until the lip takeoff, then none; lean only from the takeoff on.
      const off=t.throttle.indexOf(0);
      assert(off>0&&t.throttle.slice(off).every(v=>v===0)&&t.lean.includes(1)&&t.lean.every(v=>v===0||v===1)&&t.lean.indexOf(1)>=off);
    }
    // Expected outcomes are complete and match the trace kind.
    const o=e.outcomes;
    assert.equal(o.complete,true);assert(Number.isFinite(o.top_speed_mps));
    for(const k of Object.keys(S.tolerances(def)))assert(k in o,def.name+': outcome '+k);
  }
});

test('the check passes the expected outcomes and fails each change beyond its tolerance',()=>{
  const expected=S.readExpected();
  for(const def of S.TRACES){
    const e=expected.traces[def.name].outcomes;
    const play={verdict:'MATCH',ended:'done',applied:def.ticks,compared:def.ticks+1,mismatches:0,scaled_ticks:0};
    assert.deepEqual(S.check(def,e,{...e},play),[]);
    for(const [key,tol] of Object.entries(S.tolerances(def))){
      if(!Number.isFinite(e[key]))continue;
      assert.deepEqual(S.check(def,e,{...e,[key]:e[key]+tol*0.99},play),[],def.name+' '+key+' inside');
      assert.deepEqual(S.check(def,e,{...e,[key]:e[key]-tol*1.01},play).map(f=>f.check),[key],def.name+' '+key+' outside');
    }
    if(e.status)assert.deepEqual(S.check(def,e,{...e,status:'OTHER'},play).map(f=>f.check),['status']);
    assert.deepEqual(S.check(def,e,{...e},{...play,verdict:'DIVERGED'}).map(f=>f.check),['verdict']);
    assert.deepEqual(S.check(def,e,{...e},{...play,verdict:'COMPARED'}).map(f=>f.check),['verdict']);
    assert.deepEqual(S.check(def,e,{...e},{...play,scaled_ticks:1}).map(f=>f.check),['scaled_ticks']);
    assert.deepEqual(S.check(def,e,{...e},{...play,applied:def.ticks-1}).map(f=>f.check),['applied']);
    assert.deepEqual(S.check(def,e,{top_speed_mps:e.top_speed_mps,complete:false},play).map(f=>f.check).slice(0,1),['complete']);
    assert.deepEqual(S.check(def,e,{...e},null).map(f=>f.check),['replay']);
  }
});
