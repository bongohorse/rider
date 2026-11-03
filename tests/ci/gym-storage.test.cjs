// #411: Gym durable-save waits accept only 'saved'. 'failed' fails at once, 'session' only in a declared
// non-durable mode, and no Gym runner waits on `syncState() !== 'syncing'` alone any more.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const storage=require('../../tools/gym/storage.cjs');

// A fake Page/Frame whose waitForFunction runs the real page predicate here against a scripted
// riderCustom.syncState() sequence (the last state repeats), like Playwright's polling.
function fakePage(states,{status='Saved'}={}){
  const page={polls:0,waits:[],async waitForFunction(fn,arg,options){
    page.waits.push(options);
    const saved=globalThis.window;
    try{
      for(let i=0;i<50;i++){
        const state=states[Math.min(page.polls++,states.length-1)];
        globalThis.window={riderEditor:{status,dirty:false},riderCustom:{syncState:()=>state}};
        const value=fn(arg);
        if(value)return {jsonValue:async()=>value};
      }
      throw new Error('waitForFunction: Timeout exceeded');
    }finally{globalThis.window=saved;}
  }};
  return page;
}

test('a durable wait resolves only once storage is saved',async()=>{
  const page=fakePage(['syncing','syncing','saved']);
  assert.equal(await storage.durable(page),'saved');
  assert.equal(page.polls,3);
});

test('failed storage is rejected immediately, even with status Saved',async()=>{
  for(const states of [['failed'],['syncing','failed','saved']]){
    const page=fakePage(states);
    await assert.rejects(storage.durable(page),/sync failed.*'failed'.*not durable/);
    assert.equal(page.polls,states.indexOf('failed')+1,'failed must end the wait at once');
  }
  await assert.rejects(storage.durable(fakePage(['failed']),{session:true}),/'failed'/,'a non-durable mode still rejects failed');
});

test('session storage is rejected unless the caller declares a non-durable mode',async()=>{
  await assert.rejects(storage.durable(fakePage(['session'])),/session-only.*needs 'saved'/);
  assert.equal(await storage.durable(fakePage(['syncing','session']),{session:true}),'session');
  assert.equal(await storage.durable(fakePage(['saved']),{session:true}),'saved');
});

test('check rejects every non-saved settled state and names the caller',()=>{
  assert.equal(storage.check('saved'),'saved');
  for(const state of ['failed','session','syncing',undefined,'Saved'])
    assert.throws(()=>storage.check(state,{label:'library saved'}),/^Error: library saved: /);
  assert.deepEqual(storage.STATES,['syncing','saved','failed','session']);
});

test('the timeout option reaches waitForFunction',async()=>{
  const page=fakePage(['saved']);await storage.durable(page,{timeout:1234});await storage.durable(page);
  assert.deepEqual(page.waits,[{timeout:1234},undefined]);
});

// The states must match the game's own syncState() source.
test('the helper knows every state main/gym/custom.js returns',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../../main/gym/custom.js'),'utf8');
  const body=source.slice(source.indexOf('api.syncState = '),source.indexOf('};',source.indexOf('api.syncState = ')));
  const returned=[...body.matchAll(/return [^;]*?'(\w+)'(?: : '(\w+)')?/g)].flatMap(m=>m.slice(1).filter(Boolean));
  assert.deepEqual([...new Set(returned)].sort(),[...storage.STATES].sort());
});

// Every Gym runner's durable wait goes through the helper: a bare "not syncing" wait accepts failed or session storage.
// A combined readiness wait that also checks "not syncing" is allowed only when the helper follows on the same line.
test('no Gym runner waits on syncState() !== syncing alone',()=>{
  const dir=path.join(__dirname,'../../tools/gym'),offenders=[];
  for(const name of fs.readdirSync(dir).filter(n=>n.endsWith('.cjs')&&n!=='storage.cjs'))
    fs.readFileSync(path.join(dir,name),'utf8').split('\n').forEach((line,i)=>{
      if(/syncState\(\)\s*!==?\s*['"]syncing['"]/.test(line)&&!/\bstorage\.durable\(/.test(line))offenders.push(`tools/gym/${name}:${i+1}`);
    });
  assert.deepEqual(offenders,[]);
});
