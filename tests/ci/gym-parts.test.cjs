const {test}=require('node:test');
const assert=require('node:assert/strict');
const {SPEEDS}=require('../../tools/gym/seam_analysis.cjs');
const seams=require('../../tools/gym/seam_report.cjs');
const sizes=require('../../tools/gym/sizes_report.cjs');
const {cases}=require('../../tools/gym/levels.cjs');

const SHA='a'.repeat(40);
test('A18 parts cover every speed, the powered controls and the rejected speed exactly once',()=>{
  const plans=Object.keys(seams.PARTS).map(seams.plan);
  assert.deepEqual(plans.flatMap(p=>p.speeds).sort(),[...SPEEDS].sort());
  assert.equal(plans.filter(p=>p.powered).length,1);
  assert.equal(plans.filter(p=>p.rejected).length,1);
  assert.deepEqual(seams.plan(),{speeds:SPEEDS,powered:true,rejected:true});
  for(const part of ['3/2','1','__proto__'])assert.throws(()=>seams.plan(part));
});
function seamRun(station,speed,bumps){return {station,nominal_mps:speed,status:'VALID',comparable:true,ghost_bumps:bumps,reasons:[]};}
function seamPart(part,speeds,{powered=false,rejected=false,run_id=part}={}){
  const results=speeds.flatMap(s=>[seamRun('seams-chain',s,0),seamRun('seams-hull',s,s===9?3:1)]);
  return {status:'PASS',protocol:3,part,source_sha:SHA,run_id,browser:'b',results,retries:results,
    poweredControls:powered?[5,9].flatMap(s=>[seamRun('seams-chain',s,0),seamRun('seams-hull',s,0)]):[],
    comparison:[],rejected:rejected?{comparable:false,reasons:['unsupported nominal speed']}:null};
}
test('A18 merge recomputes the full comparison and verdict from both parts',()=>{
  const merged=seams.merge([seamPart('2/2',[9],{powered:true}),seamPart('1/2',[5,7],{rejected:true})]);
  assert.deepEqual(merged.results.map(r=>r.nominal_mps),[5,5,7,7,9,9]);
  assert.deepEqual(merged.comparison.map(c=>c.mode+c.nominal_mps),['free roll5','free roll7','free roll9','powered control5','powered control9']);
  assert.equal(merged.acceptance,'PASS');assert.match(merged.d8,/^CONFIRMED/);
  assert.deepEqual(merged.parts,['1/2','2/2']);assert.deepEqual(merged.run_ids,['1/2','2/2']);
  assert.deepEqual(merged.rejected.reasons,['unsupported nominal speed']);
});
test('A18 merge rejects missing, repeated or mismatched parts',()=>{
  const one=seamPart('1/2',[5,7],{rejected:true}),two=seamPart('2/2',[9],{powered:true});
  assert.throws(()=>seams.merge([one]));
  assert.throws(()=>seams.merge([one,one]));
  assert.throws(()=>seams.merge([one,{...two,source_sha:'b'.repeat(40)}]));
  assert.throws(()=>seams.merge([one,{...two,run_id:one.run_id}]));
  assert.throws(()=>seams.merge([one,{...two,status:'FAIL'}]));
  assert.throws(()=>seams.merge([one,{...two,rejected:{}}]));
  assert.throws(()=>seams.merge([seamPart('1/2',[5,9],{rejected:true}),seamPart('2/2',[7],{powered:true})]));
  assert.throws(()=>seams.merge([one,{...two,poweredControls:[]}]));
  assert.deepEqual([Object.keys(seams.PARTS),sizes.PARTS],[['1/2','2/2'],['1/2','2/2']]);
});

const reported=list=>list.filter(c=>!c.warmup);
test('LE1b parts measure every accepted level once; rejected limits run once in the last part',()=>{
  const all=cases(),split=sizes.PARTS.map(p=>reported(sizes.select(all,p)));
  assert.deepEqual(split.flat().map(c=>c.id).sort(),all.map(c=>c.id).sort());
  assert.equal(new Set(split.flat().map(c=>c.id)).size,all.length);
  assert.deepEqual(split.map(p=>p.filter(c=>c.expect==='accepted').length),[8,7]);
  assert.deepEqual(split.map(p=>p.filter(c=>c.expect==='rejected').length),[0,12]);
  assert.deepEqual(split.flat().map(c=>c.id),all.map(c=>c.id));
  assert.equal(sizes.select(all,null),all);
  assert.throws(()=>sizes.select(all,'3/2'));
});
test('a later LE1b part first measures the previous level unreported, as a single run would',()=>{
  const all=cases(),[one,two]=sizes.PARTS.map(p=>sizes.select(all,p));
  assert(!one.some(c=>c.warmup));
  assert.equal(two.filter(c=>c.warmup).length,1);assert(two[0].warmup);
  assert.equal(two[0].id,one.at(-1).id);assert.equal(two[1].id,all[one.length].id);
});
function sizePart(part,{run_id=part,step=.1,renderer='r'}={}){
  const results=reported(sizes.select(cases(),part)).map(c=>c.expect==='accepted'?{id:c.id,dimension:c.dimension,outcome:'placement_failed',error:'x'}:{id:c.id,dimension:c.dimension,expect:'rejected',message:'m'});
  return {source_sha:SHA,run_id,part,status:'PASS',browser:'b',preset:'a',protocol:{repeats:5},elapsed_s:part==='1/2'?90:100,results,
    identity:{user_agent:'u',gl_renderer:renderer,gl_vendor:'v',dpr:1,cross_origin_isolated:false,viewport:{width:1280,height:720},performance_now_step_ms:step}};
}
test('LE1b merge restores case order and reports the coarsest clock step',()=>{
  const merged=sizes.merge([sizePart('2/2',{step:.2}),sizePart('1/2')]);
  assert.deepEqual(merged.results.map(r=>r.id),cases().map(c=>c.id));
  assert.equal(merged.identity.performance_now_step_ms,.2);assert.equal(merged.elapsed_s,100);assert.deepEqual(merged.parts_elapsed_s,[90,100]);
  assert.equal(sizes.merge([sizePart('1/2'),{...sizePart('2/2'),protocol:{repeats:5,lua_clock_values_whole_ms:false}}]).protocol.lua_clock_values_whole_ms,false);
  assert.deepEqual(merged.parts,['1/2','2/2']);
  const md=sizes.markdown(merged);
  assert(!md.includes('undefined'));assert.match(md,/runs `1\/2`, `2\/2` \(CI parts 1\/2, 2\/2\)/);
});
test('LE1b merge rejects missing parts, repeated cases and differing machines',()=>{
  const one=sizePart('1/2'),two=sizePart('2/2');
  assert.throws(()=>sizes.merge([one]));
  assert.throws(()=>sizes.merge([one,{...two,results:[...two.results,one.results[0]]}]));
  assert.throws(()=>sizes.merge([one,sizePart('2/2',{renderer:'other'})]));
  assert.throws(()=>sizes.merge([one,{...two,run_id:one.run_id}]));
  assert.throws(()=>sizes.merge([one,{...two,protocol:{repeats:1}}]));
  assert.throws(()=>sizes.merge([one,{...two,browser:'other'}]));
  assert.throws(()=>sizes.merge([one,{...two,identity:{...two.identity,viewport:{width:1,height:1}}}]));
});
