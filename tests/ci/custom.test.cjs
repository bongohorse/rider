const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const SOURCE=fs.readFileSync(path.join(__dirname,'../../main/game/custom.js'),'utf8');
// Sync logic copied from the pinned dmloader (a81dbb0, dmloader.js L1342-L1357 and L1452-L1476).
function dmloader(syncfs){
 const Module={persistentStorage:true,_syncInProgress:false,_syncNeeded:false,_syncInitial:true,_syncMaxTries:3,_syncTries:0,
  persistentSync(){if(Module.persistentStorage!=true)return;if(Module._syncInitial){if(Module._syncInProgress)Module._syncNeeded=true;else Module._startSyncFS();}},
  _startSyncFS(){
   Module._syncInProgress=true;
   if(Module._syncMaxTries>Module._syncTries){
    syncfs(err=>{
     Module._syncInProgress=false;
     if(err)Module._syncTries+=1;else Module._syncTries=0;
     if(Module._syncNeeded){Module._syncNeeded=false;Module._startSyncFS();}
    });
   }else Module._syncTries=0;
  }};
 return Module;
}
function load(Module,FS){
 const window={},document={getElementById:()=>null,addEventListener(){},querySelector:()=>null};
 const context=vm.createContext({window,document,Module,FS,queueMicrotask});
 vm.runInContext(SOURCE,context);
 return window.riderCustom;
}
function file(text){let finish,fail;const read=new Promise((resolve,reject)=>{finish=()=>resolve(text);fail=()=>reject(Error('read failed'));});return {size:text.length,text:()=>read,finish,fail};}
const flush=()=>new Promise(r=>setImmediate(r));

test('an older file read finishing after a newer one is ignored',async()=>{
 const api=load(undefined),a=file('A'),b=file('B');
 api.importFile(a);api.importFile(b);
 b.finish();await flush();
 assert.equal(api.take(),JSON.stringify({request:2,text:'B'}));
 a.finish();await flush();
 assert.equal(api.take(),'');assert.equal(api.request,2);
});

test('a stale read error does not overwrite the newer import state',async()=>{
 const api=load(undefined),a=file('A'),b=file('B');
 api.importFile(a);api.importFile(b);
 b.finish();await flush();
 a.fail();await flush();
 assert.equal(api.state,'reading');assert.equal(JSON.parse(api.take()).text,'B');
});

test('a newer rejected file supersedes a file still being read',async()=>{
 const api=load(undefined),a=file('A');
 api.importFile(a);api.importFile(file('x'.repeat(256*1024+1)));
 assert.equal(api.state,'error');
 a.finish();await flush();
 assert.equal(api.take(),'');assert.equal(api.state,'error');
});

test('sync state follows dmloader through success and a recovered failure',async()=>{
 const pending=[],Module=dmloader(cb=>pending.push(cb)),api=load(Module);
 Module.persistentSync();
 assert.equal(api.syncState(),'syncing');assert.equal(pending.length,0);await flush();
 pending.shift()();assert.equal(api.syncState(),'saved');
 Module.persistentSync();await flush();pending.shift()('io error');
 assert.equal(api.syncState(),'failed');
 // The last completed attempt decides: a running retry is not latched as failed, and its success
 // persists everything written before it.
 Module.persistentSync();assert.equal(api.syncState(),'syncing');await flush();
 pending.shift()();assert.equal(api.syncState(),'saved');
});

test('exhausted dmloader retries report failed instead of syncing forever',async()=>{
 const pending=[],Module=dmloader(cb=>pending.push(cb)),api=load(Module);
 for(let i=0;i<3;i++){Module.persistentSync();await flush();Module.persistentSync();await flush();pending.shift()('io error');}
 // The fourth start exceeds the retry limit: dmloader keeps _syncInProgress set and never clears it.
 assert.equal(Module._syncInProgress,true);assert.equal(pending.length,0);
 assert.equal(api.syncState(),'failed');
 Module.persistentSync();
 assert.equal(api.syncState(),'failed');
});


test('capacity measurement reads exact file metadata without requesting a persistence sync',()=>{
 const sizes=new Map([['/data/.rider/a',245001],['/data/.rider/b',245007]]),paths=[];
 const FS={stat(path){paths.push(path);if(!sizes.has(path))throw Error('missing');return {size:sizes.get(path)};},
  open(){throw Error('must not open a file');},close(){throw Error('must not close a file');}};
 const Module=dmloader(()=>{throw Error('must not sync for a byte measurement');}),api=load(Module,FS);
 assert.equal(api.fileBytes([...sizes.keys()]),490008);
 assert.deepEqual(paths,[...sizes.keys()]);assert.equal(api.syncState(),'saved');
 sizes.set('/data/.rider/b',0);assert.equal(api.fileBytes([...sizes.keys()]),245001);
 assert.equal(api.fileBytes(['/data/.rider/missing']),null,'Lua must use its existing io fallback');
 assert.equal(api.fileBytes(['/data/.rider/a','/data/.rider/missing']),null,'partial sums must not be reported');
 assert.equal(load(Module).fileBytes(['/data/.rider/a']),null);
});


test('read-only Rider closes do not sync; writes coalesce and remain unsaved until acknowledged',async()=>{
 const pending=[],Module=dmloader(cb=>pending.push(cb));let closed=0;
 const FS={close(){closed++;Module.persistentSync();return 37;}},api=load(Module,FS);
 assert.equal(FS.close({path:'/data/.rider/custom-version-1-a',flags:0}),37);
 await flush();assert.equal(closed,1);assert.equal(pending.length,0);assert.equal(api.syncState(),'saved');
 for(let i=0;i<5;i++)FS.close({path:'/data/.rider/custom-version-1-a',flags:577});
 assert.equal(api.syncState(),'syncing');assert.equal(pending.length,0);
 await flush();assert.equal(pending.length,1);assert.equal(api.syncState(),'syncing');
 pending.shift()();assert.equal(api.syncState(),'saved');
 // A queued write must not look saved when an older sync completes before the microtask runs.
 Module.persistentSync();await flush();Module.persistentSync();pending.shift()();
 assert.equal(api.syncState(),'syncing');await flush();assert.equal(pending.length,1);
 pending.shift()();assert.equal(api.syncState(),'saved');
 // Preserve loader behavior for non-Rider reads, missing/non-integer flags and a create/truncate open.
 for(const stream of [{path:'/other/file',flags:0},{path:'/data/.rider/file'},{path:'/data/.rider/file',flags:64},{path:'/data/.rider/file',flags:512}]){
  FS.close(stream);await flush();assert.equal(pending.length,1);pending.shift()();
 }
});

test('explicit deletion requests persist and write bursts during a sync require the later acknowledgement',async()=>{
 const pending=[],Module=dmloader(cb=>pending.push(cb)),api=load(Module);
 Module.persistentSync();await flush();
 Module.persistentSync();Module.persistentSync();await flush();
 assert.equal(pending.length,1);pending.shift()();assert.equal(pending.length,1);
 assert.equal(api.syncState(),'syncing');pending.shift()();assert.equal(api.syncState(),'saved');
 // Deletion uses the same explicit request even though its read-only close no longer requests one.
 Module.persistentSync();assert.equal(api.syncState(),'syncing');await flush();
 pending.shift()();assert.equal(api.syncState(),'saved');
});

test('a synchronous persistence-start error reports failed after the queued turn',async()=>{
 const Module=dmloader(()=>{throw Error('injected synchronous storage error');}),api=load(Module);
 Module.persistentSync();assert.equal(api.syncState(),'syncing');await flush();assert.equal(api.syncState(),'failed');
});


test('a failed read close cannot leave later writes suppressed',async()=>{
 const pending=[],Module=dmloader(cb=>pending.push(cb));let broken=true;
 const FS={close(){if(broken)throw Error('injected read close error');Module.persistentSync();}};
 const api=load(Module,FS);
 assert.throws(()=>FS.close({path:'/data/.rider/file',flags:0}),/injected read close/);
 broken=false;FS.close({path:'/data/.rider/file',flags:577});
 assert.equal(api.syncState(),'syncing');await flush();assert.equal(pending.length,1);
 pending.shift()();assert.equal(api.syncState(),'saved');
});

// #410: closing the import panel abandons the import. A minimal DOM drives the real panel controls.
function element(tag){
 return {tagName:tag.toUpperCase(),id:'',children:[],style:{},listeners:{},textContent:'',value:'',parent:null,
  setAttribute(){},focus(){},select(){},
  append(...nodes){for(const n of nodes){n.parent=this;this.children.push(n);}},
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;},
  find(match){for(const n of this.children){if(match(n))return n;const hit=n.find(match);if(hit)return hit;}return null;},
  querySelector(selector){return selector.startsWith('#')?this.find(n=>n.id===selector.slice(1)):null;},
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}};
}
function loadPage(){
 const body=element('body'),window={};
 const document={body,fullscreenElement:null,createElement:element,addEventListener(){},
  getElementById:id=>body.querySelector('#'+id),querySelector:selector=>body.querySelector(selector)};
 vm.runInContext(SOURCE,vm.createContext({window,document,queueMicrotask}));
 const api=window.riderCustom,panel=()=>body.querySelector('#rider-custom-panel');
 const button=label=>panel().find(n=>n.tagName==='BUTTON'&&n.textContent===label);
 return {api,panel,
  paste(text){panel().querySelector('#rider-custom-text').value=text;button('Import text').onclick();},
  choose(chosen){const input=panel().querySelector('#rider-custom-file');input.files=[chosen];input.onchange();},
  close:{
   'Close':()=>button('Close import').onclick(),
   'Escape':()=>panel().listeners.keydown.forEach(fn=>fn({key:'Escape'})),
   'closeEditor()':()=>api.closeEditor()}};
}
// closeEditor() only closes the editor's own import (LE4), so that path opens the panel from the editor.
const CLOSERS=['Close','Escape','closeEditor()'],fromEditor=how=>how==='closeEditor()';

for(const how of CLOSERS){
 test(`a queued paste is dropped by ${how}`,()=>{
  const page=loadPage(),{api}=page;
  api.open('',fromEditor(how));page.paste('A');
  page.close[how]();
  assert.equal(api.visible,false);assert.equal(page.panel(),null);
  assert.equal(api.take(),'');assert.notEqual(api.state,'reading');
 });

 test(`a file read that finishes after ${how} is not submitted`,async()=>{
  const page=loadPage(),{api}=page,a=file('A'),b=file('B');
  api.open('',fromEditor(how));page.choose(a);
  page.close[how]();
  a.finish();await flush();
  assert.equal(api.take(),'');assert.notEqual(api.state,'reading');
  // A read error after close is not reported either.
  api.open('',fromEditor(how));page.choose(b);page.close[how]();
  const before=api.state;b.fail();await flush();
  assert.equal(api.state,before);assert.equal(api.take(),'');
 });
}

test('a normal paste and file import still load',async()=>{
 const page=loadPage(),{api}=page,a=file('A');
 api.open();page.paste('P');
 assert.equal(api.state,'reading');assert.deepEqual(JSON.parse(api.take()),{request:1,text:'P',editor:false});
 api.result({request:1,state:'loading',message:'Loading P...'});assert.equal(api.visible,true);
 page.choose(a);a.finish();await flush();
 assert.deepEqual(JSON.parse(api.take()),{request:2,text:'A',editor:false});
 api.result({request:2,state:'loaded',message:'Loaded.'});
 assert.equal(api.state,'loaded');assert.equal(api.visible,false);assert.equal(page.panel(),null);
});

test('an import taken by Lua before Close still reports its result',()=>{
 const page=loadPage(),{api}=page;
 api.open();page.paste('P');const taken=JSON.parse(api.take());
 page.close.Close();
 api.result({request:taken.request,state:'loaded',message:'Loaded.'});
 assert.equal(api.state,'loaded');
});

for(const how of CLOSERS){
 test(`a new import after one cancelled by ${how} loads`,async()=>{
  const page=loadPage(),{api}=page,late=file('late'),next=file('next');
  api.open('',fromEditor(how));page.paste('cancelled');page.choose(late);page.close[how]();
  api.open('',fromEditor(how));page.paste('B');
  assert.deepEqual(JSON.parse(api.take()),{request:3,text:'B',editor:fromEditor(how)});
  page.choose(next);late.finish();next.finish();await flush();
  assert.deepEqual(JSON.parse(api.take()),{request:4,text:'next',editor:fromEditor(how)});
  assert.equal(api.take(),'');
 });
}
