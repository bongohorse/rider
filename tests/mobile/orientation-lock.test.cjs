// #359: fullscreen HTML5 requests a landscape lock; absence or refusal is silent.
// Loads the real mobile.js in a minimal stubbed browser realm (touch off), so only
// the page-level listeners run. The real-browser path is in tools/preview/mobile.cjs.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../../main/game/mobile.js'),'utf8');

function load(screen){
  const listeners={};
  const on=(type,handler)=>{(listeners[type]??=[]).push(handler);};
  const document={fullscreenElement:null,hidden:false,addEventListener:on};
  const window={addEventListener(){}};
  vm.runInNewContext(source,{window,document,screen,URLSearchParams,performance:{now:()=>0},
    navigator:{maxTouchPoints:0,userAgent:'node'},location:{search:'?touch=0'}});
  return {
    enter(){document.fullscreenElement={};for(const handler of listeners.fullscreenchange||[])handler();},
    exit(){document.fullscreenElement=null;for(const handler of listeners.fullscreenchange||[])handler();},
  };
}
async function noUnhandledRejection(run){
  const seen=[],record=reason=>seen.push(reason);
  process.on('unhandledRejection',record);
  try{
    await run();
    for(let i=0;i<3;i++)await new Promise(resolve=>setImmediate(resolve));
  }finally{process.off('unhandledRejection',record);}
  assert.deepEqual(seen,[],'A refused lock must not surface as an unhandled rejection');
}

test('entering fullscreen requests a landscape lock; leaving does not',async()=>{
  const calls=[];
  const page=load({orientation:{lock(type){calls.push(type);return Promise.resolve();}}});
  page.exit();
  assert.deepEqual(calls,[]);
  page.enter();page.exit();page.enter();
  assert.deepEqual(calls,['landscape','landscape']);
});

test('lock is called on screen.orientation itself',()=>{
  const orientation={calls:0,lock(type){assert.equal(this,orientation);assert.equal(type,'landscape');this.calls++;return Promise.resolve();}};
  load({orientation}).enter();
  assert.equal(orientation.calls,1);
});

test('a rejected lock is swallowed without an unhandled rejection',async()=>{
  let calls=0;
  await noUnhandledRejection(()=>{
    const page=load({orientation:{lock(){calls++;return Promise.reject(Object.assign(new Error('refused'),{name:'NotSupportedError'}));}}});
    page.enter();page.exit();page.enter();
  });
  assert.equal(calls,2);
});

test('missing API, missing lock, a throwing lock or a non-promise return never throws',async()=>{
  const variants=[{},{orientation:undefined},{orientation:{}},{orientation:{lock:undefined}},
    {orientation:{lock(){throw new TypeError('old implementation');}}},{orientation:{lock(){return undefined;}}}];
  await noUnhandledRejection(()=>{
    for(const screen of variants)assert.doesNotThrow(()=>load(screen).enter());
  });
});
