// #399 (release check, called by check_level_storage): a failed initial IndexedDB restore must
// never sync an empty memory FS back. Seeds a real persistent file, reloads with the first
// indexedDB.open calls throwing (the loader's preSync retry budget is three), writes, reopens.
const assert=require('node:assert/strict');
module.exports=async function(browser,base){
  const context=await browser.newContext({viewport:{width:1280,height:720}}),errors=[];
  const url=new URL('index.html?station=first-run&touch=0',base).href;
  const SEED='/rider-399-seed';
  const open=async failures=>{
    const page=await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))errors.push(m.text());});
    if(failures)await page.addInitScript(n=>{
      const original=indexedDB.open.bind(indexedDB);let left=n;
      indexedDB.open=function(...args){if(left>0){left--;throw new Error('#399 injected initial restore failure');}return original(...args);};
    },failures);
    await page.goto(url);
    await page.waitForFunction(()=>window.riderCustom&&window.riderLevels&&typeof FS!=='undefined'
      &&window.riderCustom.syncState()!=='syncing'&&window.riderLevels.status!=='Checking progress storage',null,{timeout:60000});
    return page;
  };
  const state=page=>page.evaluate(seed=>({persistentStorage:Module.persistentStorage,restoreFailed:!!window.riderStorageRestoreFailed,
    sync:window.riderCustom.syncState(),levels:window.riderLevels.status,seed:FS.analyzePath(DMSYS.GetUserPersistentDataRoot()+seed).exists}),SEED);
  // A normal game write path: Module.persistentSync() is what every closed save file triggers.
  const write=(page,name)=>page.evaluate(n=>{FS.writeFile(DMSYS.GetUserPersistentDataRoot()+n,'x');Module.persistentSync();},name);
  const settled=page=>page.waitForFunction(()=>!Module._syncInProgress&&!Module._syncNeeded,null,{timeout:30000});
  const result={};
  try{
    const seed=await open(0);
    await seed.evaluate(s=>{FS.writeFile(DMSYS.GetUserPersistentDataRoot()+s,'kept');Module.persistentSync();},SEED);
    await settled(seed);await seed.close();

    // Two failed attempts, then success: the restore completed, so saving stays enabled.
    const recovered=await open(2);result.recovered=await state(recovered);await recovered.close();
    assert.deepEqual(result.recovered,{persistentStorage:true,restoreFailed:false,sync:'saved',levels:'saved',seed:true},
      'a restore that succeeds on a retry must not be treated as failed');

    // Every attempt fails: block saving and never write this session back to IndexedDB.
    const faulty=await open(3);result.faulty=await state(faulty);
    assert.deepEqual(result.faulty,{persistentStorage:false,restoreFailed:true,sync:'failed',levels:'Progress not saved',seed:false},
      'a failed initial restore must block saving and keep the session off IndexedDB');
    await write(faulty,'/rider-399-after');
    result.faulty_after_write=await faulty.evaluate(()=>({syncing:!!(Module._syncInProgress||Module._syncNeeded),sync:window.riderCustom.syncState()}));
    assert.deepEqual(result.faulty_after_write,{syncing:false,sync:'failed'},'no IndexedDB write may start in a failed-restore session');
    await faulty.close();

    const reopened=await open(0);result.reopened=await state(reopened);await reopened.close();
    assert.equal(result.reopened.sync,'saved');
    assert.equal(result.reopened.seed,true,'stored saves must survive a session whose restore failed');
    assert.deepEqual(errors,[]);
    return result;
  }finally{result.errors=errors;await context.close();}
};
if(require.main===module){const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();try{console.log(JSON.stringify(await module.exports(b,process.argv[2])));}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});}
