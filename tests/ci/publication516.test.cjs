'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PLAN,distribution,compare,fixtures,expectedRuns}=require('../../tools/gameplay/measure_publication.cjs');
test('fixed window and material-effect threshold retain the declared floor, dispersion and clock limits',()=>{
 assert.deepEqual([PLAN.warmup_s,PLAN.sample_s,PLAN.repetitions,PLAN.dpr],[5,20,3,1]);
 assert(!compare([1,1,1],[1.1,1.1,1.1],[.001]).material_observer_effect);
 assert(compare([1,1,1],[2,2,2],[.001]).material_observer_effect);
 assert(!compare([1,2,3],[2,3,4],[.001]).material_observer_effect,'dispersion must dominate a smaller apparent effect');
 assert(!compare([1,1,1],[2,2,2],[.3,.3]).material_observer_effect,'clock floor must dominate a sub-resolution effect');
 assert.throws(()=>compare([1,1],[2,2,2]));
 assert.equal(compare([1,1,1],[2,2,2],[false]).material_observer_effect,null,'missing clock resolution cannot become zero-cost precision');
});
test('callback percentiles preserve tails and reject empty samples',()=>{
 assert.deepEqual(distribution([0,2,1,100]),{count:4,p50_ms:1,p95_ms:100,max_ms:100});
 assert.throws(()=>distribution([]),/No samples/);
 for(const value of [-1,NaN,Infinity])assert.throws(()=>distribution([value]),/timing sample/);
});
test('retained course geometry stays unchanged; only the declared long-course appearance is derived',()=>{
 const root=path.resolve(__dirname,'../..'),rows=fixtures();assert.deepEqual(rows.map(x=>x.name),['short','long','mechanism']);
 for(const r of rows){
  assert.match(r.sha256,/^[a-f0-9]{64}$/);const original=JSON.parse(fs.readFileSync(path.join(root,r.source))),derived=JSON.parse(r.text);
  assert.deepEqual(derived.chains,original.chains);assert.deepEqual(derived.hulls,original.hulls);
  if(r.name==='long'){
   assert.equal(derived.editor.road_profile,'authored-v1');assert.deepEqual(derived.editor.objects,original.editor.objects);
   assert.deepEqual(derived.editor.connections,original.editor.connections);assert.deepEqual(derived.editor.sampling,original.editor.sampling);
  }else assert.deepEqual(derived,original);
 }
 assert(JSON.parse(rows[2].text).mechanisms);
});
test('mandatory matrix is declared independently of results and rejects zero/duplicate identities',()=>{
 const courses=fixtures(),all=expectedRuns(courses,false);
 assert.equal(all.length,27);assert.equal(new Set(all).size,27);assert.equal(all.filter(x=>x.includes('-release-')).length,9);
 assert.deepEqual(expectedRuns(courses,true),['long-on-0']);
 assert.throws(()=>expectedRuns([],false),/inventory/);assert.throws(()=>expectedRuns([courses[0],courses[0]],false),/inventory/);
});
