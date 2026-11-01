// #114: strictly read-only, fixed-owner Box2D wheel-cap evidence on an existing a16 downhill.
// No extra physics stepping, motor commands, gameplay tuning or browser-synthetic motion.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {configure}=require('./launch.cjs');
const SCALE=0.01, RADIUS_M=0.22, HZ=60, CAP_RAD_S=Math.PI*0.25*HZ;
const TICKS=45, SLOPE_START=113.80753109686238, SLOPE_END=117.27163271200013;
const RUNOUT_END=124.0;
function finite(n){return typeof n==='number'&&Number.isFinite(n);}
function validate(trace,{sha,runId,speed,reset}){
  assert(Array.isArray(trace)&&trace.length>=TICKS,'INCONCLUSIVE: insufficient real fixed-owner ticks');
  const samples=trace.filter(s=>s.resets===reset).slice(0,TICKS);
  assert.equal(samples.length,TICKS,'INCONCLUSIVE: missing Retry/initial fixed-owner samples');
  const generation=samples[0].generation;
  for(let i=0;i<samples.length;i++){
    const s=samples[i];
    assert.equal(s.source_sha,sha,'wrong source SHA');
    assert.equal(s.run_id,runId,'wrong Gym run identity');
    assert.equal(s.mode,'a','wheel cap probe must use unchanged camera A');
    assert.equal(s.station,'ramps-long');assert.equal(s.section,'down-30');
    assert.equal(s.resets,reset,'unexpected reset in fixed-tick window');
    assert.equal(s.generation,generation,'unexpected generation change');
    assert(Math.abs(s.dt*HZ-1)<1e-4,'not an actual 60-Hz owner tick');
    for(const key of ['tick','engine_tick','x','y','vx','vy','rear_omega','front_omega'])
      assert(finite(s[key]),'missing/non-finite fixed-tick '+key);
    assert(typeof s.rear==='boolean'&&typeof s.front==='boolean','missing genuine contact flags');
    if(i){
      assert.equal(s.tick,samples[i-1].tick+1,'missing/repeated vehicle fixed tick');
      assert.equal(s.engine_tick,samples[i-1].engine_tick+1,'missing/repeated engine fixed tick');
    }
  }
  assert(Math.abs(samples[0].vx*SCALE-speed)<0.08,'initial chassis speed not the authored speed');
  const points=samples.map(s=>({
    tick:s.tick,engine_tick:s.engine_tick,reset:s.resets,
    x_m:s.x*SCALE,y_m:s.y*SCALE,vx_mps:s.vx*SCALE,vy_mps:s.vy*SCALE,
    rear:s.rear,front:s.front,
    rear_rad_s:s.rear_omega,front_rad_s:s.front_omega,
    rear_roll_mps:-s.rear_omega*RADIUS_M,front_roll_mps:-s.front_omega*RADIUS_M,
    rear_slip_mps:s.vx*SCALE+s.rear_omega*RADIUS_M,
    front_slip_mps:s.vx*SCALE+s.front_omega*RADIUS_M
  }));
  // Skip the initial, engine-seeded state when measuring the Box2D post-step cap.
  const afterStep=points.slice(1);
  const dual=afterStep.filter(p=>p.rear&&p.front);
  const slope=dual.filter(p=>p.x_m>=SLOPE_START&&p.x_m<=SLOPE_END&&p.vy_mps<0);
  const runout=dual.filter(p=>p.x_m>SLOPE_END&&p.x_m<RUNOUT_END);
  const comparable=speed===9?slope.filter(p=>p.vx_mps<CAP_RAD_S*RADIUS_M):
    slope.filter(p=>p.vx_mps>CAP_RAD_S*RADIUS_M);
  assert(comparable.length>=2,'INCONCLUSIVE: no dual-supported '+(speed===9?'below-cap':'above-cap')+' downhill samples');
  assert(runout.length>=2,'INCONCLUSIVE: missing genuine dual-supported flat run-out');
  const angularMax=Math.max(...afterStep.flatMap(p=>[Math.abs(p.rear_rad_s),Math.abs(p.front_rad_s)]));
  const peakChassis=Math.max(...afterStep.map(p=>p.vx_mps));
  const high=dual.filter(p=>p.vx_mps>CAP_RAD_S*RADIUS_M);
  return {start_mps:speed,reset,source_sha:sha,run_id:runId,physics_hz:HZ,
    radius_m:RADIUS_M,scale:SCALE,theoretical_cap_rad_s:CAP_RAD_S,
    theoretical_roll_cap_mps:CAP_RAD_S*RADIUS_M,initial:points[0],
    fixed_ticks:TICKS,dual_supported_ticks:dual.length,slope_dual_ticks:slope.length,
    comparable_downhill_ticks:comparable.length,runout_dual_ticks:runout.length,
    peak_chassis_mps:peakChassis,peak_abs_wheel_rad_s:angularMax,
    high_speed_dual_ticks:high.length,
    peak_supported_slip_mps:high.length?Math.max(...high.flatMap(p=>[p.rear_slip_mps,p.front_slip_mps])):null,
    observed_cap_within_0_02_rad_s:angularMax<=CAP_RAD_S+0.02,
    trace:points};
}
function compareRetry(a,b){
  assert.equal(a.fixed_ticks,b.fixed_ticks);
  let maxPosition=0,maxVelocity=0,maxOmega=0;
  for(let i=0;i<a.trace.length;i++){
    const x=a.trace[i],y=b.trace[i];
    assert.equal(x.rear,y.rear,'Retry rear contact divergence at tick '+i);
    assert.equal(x.front,y.front,'Retry front contact divergence at tick '+i);
    maxPosition=Math.max(maxPosition,Math.abs(x.x_m-y.x_m),Math.abs(x.y_m-y.y_m));
    maxVelocity=Math.max(maxVelocity,Math.abs(x.vx_mps-y.vx_mps),Math.abs(x.vy_mps-y.vy_mps));
    maxOmega=Math.max(maxOmega,Math.abs(x.rear_rad_s-y.rear_rad_s),Math.abs(x.front_rad_s-y.front_rad_s));
  }
  assert(maxPosition<=0.02&&maxVelocity<=0.02&&maxOmega<=0.1,
    'Retry fixed-tick dynamics diverged: '+JSON.stringify({maxPosition,maxVelocity,maxOmega}));
  return {max_position_delta_m:maxPosition,max_velocity_delta_mps:maxVelocity,max_omega_delta_rad_s:maxOmega,
    contacts_identical:true};
}
async function run({browser,url,sha,runId,testcase,out,errors}){
  assert.equal(testcase,'a16','wheel cap evidence must reuse real a16 fixed-owner commands');
  const cases=[];
  for(const speed of [9,11]){
    const p=await browser.newPage({viewport:{width:1280,height:720}});
    p.on('pageerror',e=>errors.push('wheelcap114: '+e.message));
    p.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))errors.push('wheelcap114: '+m.text());});
    try{
      await configure(p,runId,testcase);
      await p.goto(url+'?station=ramps-long&section=down-30&speed='+speed+'&camera352=a');
      await p.waitForFunction(({sha,runId,speed})=>window.riderReady?.source_sha===sha&&
        window.riderReady?.run_id===runId&&window.riderTelemetry?.station==='ramps-long'&&
        window.riderTelemetry?.start_speed===speed&&window.riderTelemetry?.preset==='a'&&
        window.riderTelemetry?.modified===false&&window.riderTelemetry?.time_scaled_ticks===0&&
        window.riderStationReport?.section==='down-30',
        {sha,runId,speed},{timeout:15000});
      await p.waitForFunction(n=>(window.riderCamera352PhysicsTrace||[]).filter(s=>s.resets===0).length>=n,
        TICKS,{timeout:15000,polling:50});
      const first=validate(await p.evaluate(()=>window.riderCamera352PhysicsTrace.slice()),
        {sha,runId,speed,reset:0});
      const resetBefore=await p.evaluate(()=>window.riderTelemetry.reset_count);
      assert.equal(resetBefore,0,'unexpected reset before explicit Retry');
      await p.keyboard.down('r');
      await p.waitForFunction(n=>window.riderTelemetry?.reset_count===n+1,resetBefore,{timeout:8000});
      await p.keyboard.up('r');
      await p.waitForFunction(n=>(window.riderCamera352PhysicsTrace||[]).filter(s=>s.resets===1).length>=n,
        TICKS,{timeout:15000,polling:50});
      const second=validate(await p.evaluate(()=>window.riderCamera352PhysicsTrace.slice()),
        {sha,runId,speed,reset:1});
      const repeat=compareRetry(first,second);
      cases.push({speed_mps:speed,first,repeat_run:second,retry_comparison:repeat});
    }catch(e){
      const state=await p.evaluate(()=>({ready:window.riderReady,telemetry:window.riderTelemetry,
        samples:window.riderCamera352PhysicsTrace?.slice()||[]})).catch(()=>null);
      fs.writeFileSync(path.join(out,'wheelcap114-failed-'+speed+'.json'),JSON.stringify({error:String(e),state},null,2)+'\n');
      throw e;
    }finally{await p.close();}
  }
  const report={status:'PASS',source_sha:sha,run_id:runId,station:'ramps-long',section:'down-30',
    preset:'a',modified:false,conditions:'Normal a16 neutral input; 9 vs 11 m/s authored start-speed override, same 30-degree downhill and flat run-out. Real Defold fixed-owner ticks; keyboard Retry. No physics or tuning changes.',
    physical_phone:'NOT RUN',subjective_feel:'NOT RUN',cases};
  fs.writeFileSync(path.join(out,'wheelcap114-result.json'),JSON.stringify(report,null,2)+'\n');
  return {status:report.status,source_sha:sha,cases:cases.map(c=>({start_mps:c.speed_mps,
    max_mps:c.first.peak_chassis_mps,omega_rad_s:c.first.peak_abs_wheel_rad_s,
    slope_ticks:c.first.comparable_downhill_ticks,runout_ticks:c.first.runout_dual_ticks,
    peak_slip_mps:c.first.peak_supported_slip_mps,retry:c.retry_comparison}))};
}
module.exports={validate,compareRetry,run,TICKS,CAP_RAD_S,RADIUS_M};
