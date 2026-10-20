// #227: the shared frame-based pointer helper waits for engine frames, never passes without them, and keeps the
// press/acknowledge/release/frames order.
const test=require('node:test');
const assert=require('node:assert/strict');
const pointer=require('../../tools/gym/pointer.cjs');

// A fake page whose evaluate runs page functions here, with a controllable requestAnimationFrame.
function fakePage({raf=cb=>setImmediate(cb),counter=10,waitFails=false}={}){
  const calls=[];
  const page={calls,mouse:{
    move:async(x,y)=>calls.push(['move',x,y]),down:async()=>calls.push(['down']),up:async()=>calls.push(['up'])},
    evaluate:async(fn,arg)=>{
      if(typeof fn==='string'){calls.push(['counter',fn]);return counter;}
      const saved=globalThis.requestAnimationFrame;globalThis.requestAnimationFrame=raf;
      try{calls.push(['raf',arg]);return await fn(arg);}finally{globalThis.requestAnimationFrame=saved;}
    },
    waitForFunction:async(fn,arg,options)=>{calls.push(['wait',typeof fn==='string'?fn:'predicate',arg,options]);if(waitFails)throw Error('page.waitForFunction: Timeout 30000ms exceeded.\nmore');},
  };
  return page;
}

test('an engine counter is read after the call and must advance by n (default 2)',async()=>{
  const page=fakePage();
  await pointer.frames(page,{counter:'window.riderReplay.frames'});
  assert.deepEqual(page.calls,[['counter','window.riderReplay.frames'],['wait','(window.riderReplay.frames)>=12',null,{polling:50,timeout:5000}]]);
});

test('a missing counter or a counter that stops fails with the label, never passes',async()=>{
  await assert.rejects(pointer.frames(fakePage({counter:null}),{counter:'window.x',label:'click a'}),/^Error: click a: the engine ran no 2 frames within 5000 ms \(frame counter window\.x is not a number/);
  await assert.rejects(pointer.frames(fakePage({waitFails:true}),{counter:'window.x',label:'click b'}),/^Error: click b: the engine ran no 2 frames within 5000 ms \(page\.waitForFunction: Timeout 30000ms exceeded\.\)$/);
});

test('without a counter three animation frames are required; a page that renders none times out',async()=>{
  let frames=0;
  await pointer.frames(fakePage({raf:cb=>{frames++;setImmediate(cb);}}));
  assert.equal(frames,3);
  await assert.rejects(pointer.frames(fakePage({raf:()=>{}}),{timeout:50,label:'hidden'}),/^Error: hidden: the engine ran no 3 frames within 50 ms \(only 0 animation frames in 50 ms \(page hidden or throttled\?\)\)$/);
});

test('click: move, press, acknowledgement, release, then frames; a missing acknowledgement reports the state',async()=>{
  const page=fakePage();
  await pointer.click(page,{x:1,y:2},{until:()=>true,arg:7,counter:'window.c',label:'click r'});
  assert.deepEqual(page.calls.map(c=>c[0]),['move','down','wait','up','counter','wait']);
  assert.deepEqual(page.calls[2].slice(2),[7,{polling:50}]);
  const failing=fakePage({waitFails:true});
  await assert.rejects(pointer.click(failing,{x:1,y:2},{until:()=>false,label:'click s',state:async()=>'play done'}),/^Error: click s: expected state not reached \(page\.waitForFunction: Timeout 30000ms exceeded\.\); play done$/);
  assert.deepEqual(failing.calls.map(c=>c[0]),['move','down','wait'],'no release before the acknowledgement');
});

test('tap: frames after the move, the press and the release',async()=>{
  const page=fakePage();
  await pointer.tap(page,{x:1,y:2},{counter:'window.c'});
  assert.deepEqual(page.calls.map(c=>c[0]),['move','counter','wait','down','counter','wait','up','counter','wait']);
});

test('a frozen page (evaluate never returns) fails within the timeout instead of hanging',async()=>{
  const frozen={evaluate:()=>new Promise(()=>{})};
  await assert.rejects(pointer.frames(frozen,{timeout:50,label:'frozen'}),/^Error: frozen: the engine ran no 3 frames within 50 ms \(the animation-frame wait did not return within 1050 ms \(page frozen\?\)\)$/);
  await assert.rejects(pointer.frames(frozen,{counter:'window.c',timeout:50,label:'frozen'}),/^Error: frozen: the engine ran no 2 frames within 50 ms \(reading window\.c did not return within 50 ms \(page frozen\?\)\)$/);
});

test('dblclick: frames after the move and between all four transitions; the press gap must be inside 0.4 s',async()=>{
  const page=fakePage();
  const gap=await pointer.dblclick(page,{x:1,y:2},{counter:'window.c'});
  assert.deepEqual(page.calls.map(c=>c[0]).filter(c=>c!=='counter'),['move','wait','down','wait','up','wait','down','wait','up','wait']);
  assert.ok(gap>=0&&gap<0.4);
  const slow=fakePage();slow.waitForFunction=async()=>new Promise(r=>setTimeout(r,250));
  await assert.rejects(pointer.dblclick(slow,{x:1,y:2},{counter:'window.c',label:'dbl'}),/^Error: dbl: press gap 0\.\d+ s is not inside the editor's 0\.4 s double-click window \(slow renderer\)$/);
});
