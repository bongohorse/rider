// #399 (release check, called by check_level_storage): a failed initial IndexedDB restore must never sync an empty memory FS back.
// Seeds a real persistent file, reloads with the first three indexedDB.open calls failing
// (the loader's preSync retry budget), triggers a game-path sync, then reopens normally.
const assert=require('node:assert/strict');
module.exports=async function(browser,base){
  const context=await browser.newContext({viewport:{width:1280,height:720}});
  const url=new URL('index.html?station=first-run&touch=0',base).href;
  const ready=page=>page.waitForFunction(()=>window.riderCustom&&window.riderLevels&&typeof FS!=='undefined',null,{timeout:60000});
  const settled=page=>page.waitForFunction(()=>!Module._syncInProgress&&!Module._syncNeeded,null,{timeout:30000});
  const result={};
  try{
    const seed=await context.newPage();await seed.goto(url);await ready(seed);
    await seed.evaluate(()=>{const dir=DMSYS.GetUserPersistentDataRoot();FS.writeFile(dir+'/rider-399-seed','kept');Module.persistentSync();});
    await settled(seed);await seed.close();

    const faulty=await context.newPage();
    await faulty.addInitScript(()=>{
      const open=indexedDB.open.bind(indexedDB);let failures=3;
      indexedDB.open=function(...args){if(failures>0){failures--;throw new Error('#399 injected initial restore failure');}return open(...args);};
    });
    await faulty.goto(url);await ready(faulty);
    await faulty.waitForFunction(()=>window.riderLevels.status!=='Checking progress storage',null,{timeout:30000});
    result.faulty=await faulty.evaluate(()=>({persistentStorage:Module.persistentStorage,restoreFailed:!!window.riderStorageRestoreFailed,
      sync:window.riderCustom.syncState(),levels:window.riderLevels.status,seedVisible:FS.analyzePath(DMSYS.GetUserPersistentDataRoot()+'/rider-399-seed').exists}));
    assert.deepEqual(result.faulty,{persistentStorage:false,restoreFailed:true,sync:'failed',levels:'Progress not saved',seedVisible:false},
      'a failed initial restore must block saving and keep the session off IndexedDB');
    // A normal game write path: closing a written file triggers Module.persistentSync().
    await faulty.evaluate(()=>{const dir=DMSYS.GetUserPersistentDataRoot();FS.writeFile(dir+'/rider-399-after','x');Module.persistentSync();});
    await faulty.waitForTimeout(1500);await settled(faulty);await faulty.close();

    const reopened=await context.newPage();await reopened.goto(url);await ready(reopened);
    result.reopened=await reopened.evaluate(()=>({sync:window.riderCustom.syncState(),
      seedKept:FS.analyzePath(DMSYS.GetUserPersistentDataRoot()+'/rider-399-seed').exists}));
    await reopened.close();
    assert.deepEqual(result.reopened,{sync:'saved',seedKept:true},'stored saves must survive a session whose restore failed');
    return result;
  }finally{await context.close();}
};
if(require.main===module){const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();try{const r=await module.exports(b,process.argv[2]);console.log(JSON.stringify(r));}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1);});}
