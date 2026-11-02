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

test('FAIL: deepest primary phase survives parent propagation and failing cleanup',async()=>{
  const {timings,advance}=observer();
  const primary=new Error('verifier inner phase failed');
  await assert.rejects(timings.run('preview/parent',async()=>{
    advance(2);
    await timings.run('preview/inner',async()=>{advance(3);throw primary;});
  }),e=>e===primary);
  timings.fail(primary);
  const secondary=new Error('browser cleanup failed');
  await assert.rejects(timings.run('cleanup/global',async()=>{
    advance(4);throw secondary;
  }),e=>e===secondary);
  // Even if another caller reports the cleanup error, the first error is authoritative.
  timings.fail(secondary);
  timings.finish('FAIL');
  const data=timings.snapshot();
  assert.equal(data.status,'FAIL');
  assert.equal(data.last_active_case,'preview/inner');
  assert.equal(data.error,'verifier inner phase failed');
  assert.deepEqual(data.cases.map(c=>c.name),['preview/parent','preview/inner','cleanup/global']);
  assert.deepEqual(data.cases.map(c=>c.status),['FAIL','FAIL','FAIL']);
  assert.deepEqual(data.cases.map(c=>c.elapsed_ms),[5,3,4]);
  assert.equal(data.cases[0].error,'verifier inner phase failed');
  assert.equal(data.cases[1].error,'verifier inner phase failed');
  assert.equal(data.cases[2].error,'browser cleanup failed');
  assert.equal(data.elapsed_ms,9);
});

test('FAIL: active nested phase recorded by fail is not overwritten by unwinding',async()=>{
  const {timings,advance}=observer();
  const primary=new Error('phase assertion failed');
  await assert.rejects(timings.run('outer',async()=>{
    await timings.run('inner',async()=>{
      advance(1);
      timings.fail(primary);
      throw primary;
    });
  }),e=>e===primary);
  timings.finish('FAIL');
  const data=timings.snapshot();
  assert.equal(data.last_active_case,'inner');
  assert.equal(data.error,'phase assertion failed');
  assert.deepEqual(data.cases.map(c=>c.status),['FAIL','FAIL']);
});


test('parallel: independent gameplay phases overlap without violating nested LIFO timings',async()=>{
  const {timings,advance}=observer();const events=[];
  const values=await timings.run('gameplay/two-contexts',()=>timings.parallel([
    {name:'gameplay/check_run',run:async()=>{events.push('run-start');await Promise.resolve();advance(10);events.push('run-end');return 'run report';}},
    {name:'gameplay/check_levels/desktop',run:async()=>{events.push('levels-start');await new Promise(resolve=>setImmediate(resolve));advance(15);events.push('levels-end');return 'level report';}}
  ]));
  timings.finish('PASS');
  assert.deepEqual(values,['run report','level report']);
  assert.deepEqual(events,['run-start','levels-start','run-end','levels-end'],
    'both independent BrowserContexts must start before either completes');
  const report=timings.snapshot();
  assert.deepEqual(report.cases.map(x=>x.name),['gameplay/two-contexts','gameplay/check_run','gameplay/check_levels/desktop']);
  assert.deepEqual(report.cases.map(x=>x.elapsed_ms),[25,10,25]);
  assert.deepEqual(report.cases.map(x=>x.status),['PASS','PASS','PASS']);
  assert.equal(report.elapsed_ms,25);
});

test('parallel: preserves earliest gameplay failure and waits for the other page to finish cleanup',async()=>{
  const {timings,advance}=observer(),original=new Error('real-input check_run failed');
  let done=false,releaseSecond;
  const waitSecond=new Promise(resolve=>{releaseSecond=resolve;});
  const pending=timings.run('gameplay/two-contexts',()=>timings.parallel([
    {name:'gameplay/check_run',run:async()=>{advance(2);throw original;}},
    {name:'gameplay/check_levels/desktop',run:async()=>{await waitSecond;advance(7);done=true;return 'level report';}}
  ]));
  // Rejection of check_run must not close BrowserContexts while levels is active.
  let settled=false;pending.then(()=>{settled=true;},()=>{settled=true;});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(settled,false,'parallel group must wait for both independently opened contexts');
  releaseSecond();
  await assert.rejects(pending,error=>error===original);
  assert.equal(done,true);
  timings.fail(original);
  await timings.run('cleanup/global',async()=>advance(3));
  timings.finish('FAIL');
  const report=timings.snapshot();
  assert.equal(report.status,'FAIL');
  assert.equal(report.error,'real-input check_run failed');
  assert.equal(report.last_active_case,'gameplay/check_run');
  assert.deepEqual(report.cases.map(x=>x.status),['FAIL','FAIL','PASS','PASS']);
  assert.equal(report.cases[1].error,original.message);
  assert.equal(report.cases[2].elapsed_ms,9);
});

test('parallel: rejects missing/duplicate phases before launching any gameplay checks',async()=>{
  const {timings}=observer();let called=false;
  for(const tasks of [[],[{name:'x',run:()=>{called=true;}},{name:'x',run:()=>{called=true;}}],[{name:'x',run:()=>{called=true;}}]]){
    await assert.rejects(timings.parallel(tasks),/Expected two uniquely named/);
  }
  assert.equal(called,false);
  assert.equal(timings.snapshot().cases.length,0);
});
