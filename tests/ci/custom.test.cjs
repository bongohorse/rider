const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const SOURCE=fs.readFileSync(path.join(__dirname,'../../main/gym/custom.js'),'utf8');
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
 const context=vm.createContext({window,document,Module,FS});
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

test('sync state follows dmloader through success and a recovered failure',()=>{
 const pending=[],Module=dmloader(cb=>pending.push(cb)),api=load(Module);
 Module.persistentSync();
 assert.equal(api.syncState(),'syncing');
 pending.shift()();assert.equal(api.syncState(),'saved');
 Module.persistentSync();pending.shift()('io error');
 assert.equal(api.syncState(),'failed');
 // The last completed attempt decides: a running retry is not latched as failed, and its success
 // persists everything written before it.
 Module.persistentSync();assert.equal(api.syncState(),'syncing');
 pending.shift()();assert.equal(api.syncState(),'saved');
});

test('exhausted dmloader retries report failed instead of syncing forever',()=>{
 const pending=[],Module=dmloader(cb=>pending.push(cb)),api=load(Module);
 for(let i=0;i<3;i++){Module.persistentSync();Module.persistentSync();pending.shift()('io error');}
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
