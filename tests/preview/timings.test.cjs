const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createTimings}=require('../../tools/preview/timings.cjs');
const SHA='a'.repeat(40);
function observer(){
  let ns=0n;
  return {timings:createTimings({source_sha:SHA,build_id:'123-456',mode:'full',clock:()=>ns}),
    advance:ms=>{ns+=BigInt(ms)*1000000n;}};
}
test('PASS: ordered nested monotonic cases, identity and JSON artifact',async()=>{
  const {timings,advance}=observer();
  await timings.run('desktop/sliders',async()=>{
    advance(12);
    await timings.run('desktop/presets',async()=>advance(3));
    advance(5);
  },{viewport:'1280x720'});
  timings.finish('PASS');
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'rider-timings-'));
  try{
    timings.write(tmp);
    const data=JSON.parse(fs.readFileSync(path.join(tmp,'timings.json'),'utf8'));
    assert.equal(data.schema_version,1);
    assert.equal(data.source_sha,SHA);
    assert.equal(data.build_id,'123-456');
    assert.equal(data.mode,'full');
    assert.match(data.platform,/not a physical phone/);
    assert.equal(data.status,'PASS');
    assert.equal(data.elapsed_ms,20);
    assert.equal(data.last_active_case,null);
    assert.deepEqual(data.cases.map(c=>c.name),['desktop/sliders','desktop/presets']);
    assert.deepEqual(data.cases.map(c=>c.elapsed_ms),[20,3]);
    assert.deepEqual(data.cases.map(c=>c.status),['PASS','PASS']);
    assert.deepEqual(data.cases[0].details,{viewport:'1280x720'});
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
test('FAIL: thrown case retains original exception and last active case after cleanup',async()=>{
  const {timings,advance}=observer();
  const original=new Error('loader timed out');
  await assert.rejects(timings.run('phone-emulation/loader-ready',async()=>{
    advance(9);throw original;
  }),e=>e===original);
  timings.fail(original);
  await timings.run('cleanup/global',async()=>advance(2));
  timings.finish('FAIL');
  const data=timings.snapshot();
  assert.equal(data.status,'FAIL');
  assert.equal(data.last_active_case,'phone-emulation/loader-ready');
  assert.equal(data.error,'loader timed out');
  assert.deepEqual(data.cases.map(c=>c.status),['FAIL','PASS']);
  assert.deepEqual(data.cases.map(c=>c.elapsed_ms),[9,2]);
  assert.equal(data.elapsed_ms,11);
});
test('FAIL: observer serializes a failed case and refuses silent missing output',async()=>{
  const {timings,advance}=observer();
  const original=new Error('slider assertion failed');
  await assert.rejects(timings.run('desktop/sliders',async()=>{advance(1);throw original;}),e=>e===original);
  timings.fail(original);timings.finish('FAIL');
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'rider-timings-'));
  try{
    timings.write(tmp);
    const data=JSON.parse(fs.readFileSync(path.join(tmp,'timings.json'),'utf8'));
    assert.equal(data.status,'FAIL');
    assert.equal(data.cases[0].status,'FAIL');
    assert.equal(data.cases[0].error,'slider assertion failed');
    assert.equal(data.last_active_case,'desktop/sliders');
    assert.throws(()=>timings.write(path.join(tmp,'missing-dir')),/ENOENT/);
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
