// #440: remembered Quality High/Low on top of the High DPI switch (High = High DPI on).
// Runs the real inline loader scripts of main/html5/index.html (everything before
// engine-start) in a stubbed browser realm. The real-browser path, with the engine's
// canvas back-buffer and the touch Menu, is in tools/preview/mobile.cjs.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../../main/html5/index.html'),'utf8');
const KEY='rider-quality-v1';
const scripts=[...html.matchAll(/<script id="([^"]+)">([\s\S]*?)<\/script>/g)]
  .filter(([,id])=>id!=='engine-start').map(([,id,source])=>({id,source}));

function storage(initial,{readFails=false,writeFails=false}={}){
  const data=new Map(initial===undefined?[]:[[KEY,initial]]);
  return {data,
    getItem(key){if(readFails)throw new Error('SecurityError');return data.has(key)?data.get(key):null;},
    setItem(key,value){if(writeFails)throw new Error('QuotaExceededError');data.set(key,String(value));}};
}
function element(){return {textContent:'',onclick:null,width:0,height:0};}
function load({search='',stored,readFails,writeFails,dpr=2,width=1080,height=486}={}){
  const elements={quality:element(),fullscreen:element(),canvas:element()};
  const href='https://example.test/builds/abc/1-1/index.html'+search;
  const navigation={assigned:null,reloads:0};
  const localStorage=storage(stored,{readFails,writeFails});
  const realm={
    Module:{preSync(){}},CUSTOM_PARAMETERS:{engine_arguments:[]},localStorage,
    location:{search,get href(){return href;},set href(value){navigation.assigned=value;},reload(){navigation.reloads++;}},
    document:{getElementById:id=>elements[id]??null},
    ResizeObserver:class{observe(){}},matchMedia:()=>({addEventListener(){}}),
    innerWidth:width,innerHeight:height,devicePixelRatio:dpr,URL,URLSearchParams,console,
  };
  realm.window=realm;
  vm.createContext(realm);
  for(const {source} of scripts)vm.runInContext(source,realm);
  return {realm,elements,navigation,storage:localStorage,
    highDpiArg:realm.CUSTOM_PARAMETERS.engine_arguments.filter(a=>a.startsWith('--config=display.high_dpi=')),
    viewport:realm.riderViewport};
}

test('pure resolution: ?dpi=0|1 overrides, then a valid stored choice, else the High default',()=>{
  const page=load();
  assert.equal(typeof page.realm.riderQuality?.resolve,'function','window.riderQuality.resolve is exposed');
  const resolve=(search,stored)=>({...page.realm.riderQuality.resolve(search,stored)});
  assert.deepEqual(resolve('',null),{highDpi:true,source:'default'});
  assert.deepEqual(resolve('','low'),{highDpi:false,source:'stored'});
  assert.deepEqual(resolve('','high'),{highDpi:true,source:'stored'});
  assert.deepEqual(resolve('?dpi=1','low'),{highDpi:true,source:'url'});
  assert.deepEqual(resolve('?touch=1&dpi=0','high'),{highDpi:false,source:'url'});
  assert.deepEqual(resolve('?dpi=0',null),{highDpi:false,source:'url'});
  // Only 0 and 1 are overrides; anything else falls through to the stored choice.
  for(const search of ['?dpi=','?dpi=2','?dpi=true','?dpi=low','?DPI=0'])
    assert.deepEqual(resolve(search,'low'),{highDpi:false,source:'stored'},search);
  for(const bad of [undefined,'','HIGH','Low','1','0','true','{"q":"low"}',' low','low ','null'])
    assert.deepEqual(resolve('',bad),{highDpi:true,source:'default'},JSON.stringify(bad));
});

test('no stored choice starts High: High DPI engine flag and the device pixel ratio',()=>{
  const page=load({search:'?touch=1'});
  assert.deepEqual(page.highDpiArg,['--config=display.high_dpi=1']);
  assert.equal(page.elements.quality.textContent,'Quality: High');
  assert.deepEqual({dpr:page.viewport.dpr,w:page.elements.canvas.width,h:page.elements.canvas.height},{dpr:2,w:2160,h:972});
});

test('a stored Low starts Low before the engine starts: flag 0 and a DPR 1 back-buffer',()=>{
  const page=load({search:'?touch=1',stored:'low'});
  assert.deepEqual(page.highDpiArg,['--config=display.high_dpi=0']);
  assert.equal(page.elements.quality.textContent,'Quality: Low');
  assert.deepEqual({dpr:page.viewport.dpr,highDpi:page.viewport.highDpi,w:page.elements.canvas.width,h:page.elements.canvas.height},
    {dpr:1,highDpi:false,w:1080,h:486});
  assert.equal(page.realm.riderQuality.source,'stored');
});

test('?dpi=0|1 overrides the stored choice and leaves it stored',()=>{
  const high=load({search:'?dpi=1',stored:'low'});
  assert.deepEqual(high.highDpiArg,['--config=display.high_dpi=1']);
  assert.equal(high.elements.quality.textContent,'Quality: High');
  assert.equal(high.storage.data.get(KEY),'low');
  const low=load({search:'?dpi=0',stored:'high'});
  assert.deepEqual(low.highDpiArg,['--config=display.high_dpi=0']);
  assert.equal(low.elements.quality.textContent,'Quality: Low');
  assert.equal(low.storage.data.get(KEY),'high');
});

test('invalid or unreadable stored values fall back to the High default',()=>{
  for(const stored of ['banana','','LOW','0','false']){
    const page=load({stored});
    assert.deepEqual(page.highDpiArg,['--config=display.high_dpi=1'],JSON.stringify(stored));
    assert.equal(page.elements.quality.textContent,'Quality: High');
    assert.equal(page.realm.riderQuality.source,'default');
  }
  const blocked=load({stored:'low',readFails:true});
  assert.deepEqual(blocked.highDpiArg,['--config=display.high_dpi=1'],'a throwing localStorage is not fatal');
});

test('the Quality button stores the other choice and reloads without the override',()=>{
  const fromDefault=load({search:'?touch=1'});
  fromDefault.elements.quality.onclick();
  assert.equal(fromDefault.storage.data.get(KEY),'low');
  assert.equal(fromDefault.navigation.assigned,null);
  assert.equal(fromDefault.navigation.reloads,1,'same URL reloads');
  const fromOverride=load({search:'?touch=1&dpi=1',stored:'low'});
  fromOverride.elements.quality.onclick();
  assert.equal(fromOverride.storage.data.get(KEY),'low');
  assert.equal(fromOverride.navigation.assigned,'https://example.test/builds/abc/1-1/index.html?touch=1','?dpi is dropped so the stored choice applies');
  const fromLow=load({stored:'low'});
  fromLow.elements.quality.onclick();
  assert.equal(fromLow.storage.data.get(KEY),'high');
  assert.equal(fromLow.navigation.reloads,1);
});

test('without writable storage the button keeps the old ?dpi reload',()=>{
  const page=load({search:'?touch=1',writeFails:true});
  page.elements.quality.onclick();
  assert.equal(page.storage.data.has(KEY),false);
  assert.equal(page.navigation.assigned,'https://example.test/builds/abc/1-1/index.html?touch=1&dpi=0');
});
