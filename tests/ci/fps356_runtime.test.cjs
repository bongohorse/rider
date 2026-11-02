'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseArgs,classify,ORDER}=require('../../tools/gym/fps356_runtime.cjs');
const STEP=1/60;
const args=['out','sha-123','run-abc','fps356runtime','debug-bundle'];
const windows=()=>ORDER.map((rate,i)=>({
 requested_hz:rate,sequence:i+1,event:'sys.set_update_frequency',generation:1,reset_count:0,
 source_sha:'sha-123',run_id:'run-abc',presented_fps:null,
 measurement:{source_sha:'sha-123',run_id:'run-abc',physics_fixed_dt_valid:true,
  fixed_dt_s:STEP,fixed_tick_wall_hz:60,elapsed_s:10.4,
  world_update_callback_hz:rate===0?60:rate,presented_fps:null}
}));
test('runtime runner accepts only exact debug Gym identity',()=>{
 assert.deepEqual(parseArgs(args),{output:'out',sha:'sha-123',runId:'run-abc',bundle:'debug-bundle'});
});
for(const bad of [
 [],args.slice(0,4),[...args,'--rates=60'],['',...args.slice(1)],
 ['out','sha','run','fps356','bundle'],[...args.slice(0,4),''],
 ['out','sha','run','fps356runtime','bundle','--fake-raf']
])test('reject malformed runner arguments '+JSON.stringify(bad),()=>assert.throws(()=>parseArgs(bad),/Usage/));
test('real Defold callback classification separates requests from presented frames',()=>{
 const c=classify(windows());assert.equal(c.status,'RUNTIME_CALLBACK_TARGETS_OBSERVED');
 assert.equal(c.presented_fps,null);assert.equal(c.browser_raf_callback_hz,null);
});
test('30 request with 60 callbacks is BLOCKED, not a fake 30fps pass',()=>{
 const w=windows();w[0].measurement.world_update_callback_hz=60;
 const c=classify(w);assert.equal(c.status,'BLOCKED_RUNTIME_CAP_UNOBSERVED');
 assert.equal(c.cap30_callback_observed,false);
});
test('60 request with 30 callbacks is BLOCKED',()=>{
 const w=windows();w[1].measurement.world_update_callback_hz=30;
 assert.equal(classify(w).status,'BLOCKED_RUNTIME_CAP_UNOBSERVED');
});
for(const [name,mutate,reason] of [
 ['wrong rate order',w=>{w[2].requested_hz=60;},/Wrong live rate order/],
 ['missing setter event',w=>{w[0].event='browser_raf';},/genuine Defold setter/],
 ['repeated request sequence',w=>{w[1].sequence=1;},/request sequence/],
 ['world generation changed',w=>{w[2].generation=2;},/World generation/],
 ['unexpected world Retry',w=>{w[2].reset_count=1;},/crossed world Retry/],
 ['mixed source',w=>{w[2].source_sha='other';},/Mixed source/],
 ['mixed run',w=>{w[2].run_id='other';},/Mixed source/],
 ['world source mismatch',w=>{w[0].measurement.source_sha='other';},/Measurement source/],
 ['bad fixed dt',w=>{w[0].measurement.fixed_dt_s=1/30;},/fixed 1\/60/],
 ['bad fixed dt flag',w=>{w[0].measurement.physics_fixed_dt_valid=false;},/fixed 1\/60/],
 ['stalled physics',w=>{w[1].measurement.fixed_tick_wall_hz=1;},/Fixed wall cadence/],
 ['doubled physics',w=>{w[1].measurement.fixed_tick_wall_hz=120;},/Fixed wall cadence/],
 ['short window',w=>{w[1].measurement.elapsed_s=2;},/Short live-rate/],
 ['no callbacks',w=>{w[1].measurement.world_update_callback_hz=0;},/Missing Defold callbacks/],
 ['false presented fps',w=>{w[1].measurement.presented_fps=60;},/False presented FPS/],
 ['false request presented fps',w=>{w[1].presented_fps=60;},/False presented FPS/]
])test('runtime verifier rejects '+name,()=>{const w=windows();mutate(w);assert.throws(()=>classify(w),reason);});
