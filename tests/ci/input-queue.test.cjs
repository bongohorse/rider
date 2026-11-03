const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createGymSettlement}=require('../../tools/gym/input_queue.cjs');

// The runner's flow (tools/gym/browser.cjs): await done, then complete(report). Gives the
// verdict the runner would print, so a swallowed action failure shows up as a false PASS.
async function verdict(gym){
  try {await gym.complete(await gym.done);return 'PASS';}
  catch(error){return 'FAIL: '+error.message;}
}
function deferred(){let release;const blocked=new Promise(r=>{release=r;});return {blocked,release};}
const tick=()=>new Promise(r=>setImmediate(r));
// Fails the test if any promise rejection stays unhandled while body runs.
async function noUnhandled(body){
  const seen=[],listener=reason=>seen.push(reason);
  process.on('unhandledRejection',listener);
  try {await body();await tick();await tick();}
  finally {process.off('unhandledRejection',listener);}
  assert.deepEqual(seen,[]);
}

test('an action that fails before suite_end fails the suite',()=>noUnhandled(async()=>{
  const gym=createGymSettlement();
  gym.enqueue(async()=>{throw Error('keyboard.down failed');});
  await tick();
  gym.end({status:'PASS'});
  assert.equal(await verdict(gym),'FAIL: keyboard.down failed');
}));

test('an action that fails after suite_end fails the suite (#426 false PASS)',()=>noUnhandled(async()=>{
  const gym=createGymSettlement(),{blocked,release}=deferred();
  gym.enqueue(async()=>{await blocked;throw Error('keyboard.down failed');});
  gym.end({status:'PASS'});
  release();
  assert.equal(await verdict(gym),'FAIL: keyboard.down failed');
}));

test('a later successful action does not hide an earlier failure',()=>noUnhandled(async()=>{
  const gym=createGymSettlement(),{blocked,release}=deferred(),ran=[];
  gym.enqueue(async()=>{await blocked;throw Error('mouse.down failed');});
  gym.enqueue(async()=>{ran.push('second');});
  gym.end({status:'PASS'});
  release();
  assert.equal(await verdict(gym),'FAIL: mouse.down failed');
  assert.deepEqual(ran,[]);
}));

test('an early failure rejects done (guard behaviour; the unhandled case is covered by the first test)',()=>noUnhandled(async()=>{
  const gym=createGymSettlement();
  gym.enqueue(async()=>{throw Error('waitForFunction timeout');});
  await assert.rejects(gym.done,/waitForFunction timeout/);
}));

test('completed actions pass, in order, and complete waits for pending ones',()=>noUnhandled(async()=>{
  const gym=createGymSettlement(),{blocked,release}=deferred(),ran=[];
  gym.enqueue(async()=>{await blocked;ran.push(1);});
  gym.enqueue(async()=>{ran.push(2);});
  gym.end({status:'PASS',cases:{}});
  const result=verdict(gym);
  await tick();
  assert.deepEqual(ran,[]);
  release();
  assert.equal(await result,'PASS');
  assert.deepEqual(ran,[1,2]);
}));

test('a non-PASS report fails even when every action succeeded',()=>noUnhandled(async()=>{
  const gym=createGymSettlement();
  gym.enqueue(async()=>{});
  gym.end({status:'FAIL'});
  assert.equal(await verdict(gym),'FAIL: Gym test failed');
}));

test('a runner failure before suite_end rejects done',()=>noUnhandled(async()=>{
  const gym=createGymSettlement();
  gym.fail(Error('Gym page crashed'));
  gym.end({status:'PASS'});
  await assert.rejects(gym.done,/Gym page crashed/);
}));

// #447: runner failures (console ERROR:SCRIPT, pageerror, crash, foreign evidence) that arrive
// after suite_end, while queued actions or teardown still run, must not leave a false PASS.
test('a runner failure before suite_end fails the suite (unchanged)',()=>noUnhandled(async()=>{
  const gym=createGymSettlement();
  gym.fail(Error('ERROR:SCRIPT: early'));
  gym.end({status:'PASS'});
  assert.equal(await verdict(gym),'FAIL: ERROR:SCRIPT: early');
}));

test('a runner failure after suite_end fails the suite (#447 false PASS)',()=>noUnhandled(async()=>{
  const gym=createGymSettlement();
  gym.end({status:'PASS'});
  gym.fail(Error('ERROR:SCRIPT: late'));
  assert.equal(await verdict(gym),'FAIL: ERROR:SCRIPT: late');
}));

test('a runner failure while complete() waits for a pending action fails the suite',()=>noUnhandled(async()=>{
  const gym=createGymSettlement(),{blocked,release}=deferred();
  gym.enqueue(async()=>{await blocked;});
  gym.end({status:'PASS'});
  const result=verdict(gym);
  await tick();
  gym.fail(Error('Gym page crashed'));
  release();
  assert.equal(await result,'FAIL: Gym page crashed');
}));

test('the first late failure wins over later failures and failed actions',()=>noUnhandled(async()=>{
  const gym=createGymSettlement(),{blocked,release}=deferred();
  gym.enqueue(async()=>{await blocked;throw Error('keyboard.up failed');});
  gym.end({status:'PASS'});
  gym.fail(Error('Foreign gym evidence'));
  gym.fail(Error('ERROR:SCRIPT: second'));
  release();
  assert.equal(await verdict(gym),'FAIL: Foreign gym evidence');
}));

test('a failed action before a late runner failure still wins',()=>noUnhandled(async()=>{
  const gym=createGymSettlement(),{blocked,release}=deferred();
  gym.enqueue(async()=>{await blocked;throw Error('mouse.up failed');});
  gym.end({status:'PASS'});
  const result=verdict(gym);
  release();
  await tick();
  gym.fail(Error('ERROR:SCRIPT: after the action'));
  assert.equal(await result,'FAIL: mouse.up failed');
}));

test('a runner failure during teardown after complete() fails the final check',()=>noUnhandled(async()=>{
  const gym=createGymSettlement();
  gym.end({status:'PASS'});
  assert.equal(await verdict(gym),'PASS');
  gym.fail(Error('pageerror during key release'));
  gym.fail(Error('second'));
  assert.throws(()=>gym.check(),/pageerror during key release/);
}));

test('a clean run passes complete() and the final check',()=>noUnhandled(async()=>{
  const gym=createGymSettlement(),report={status:'PASS',cases:{}};
  gym.enqueue(async()=>{});
  gym.end(report);
  assert.equal(await gym.complete(await gym.done),report);
  assert.doesNotThrow(()=>gym.check());
}));
