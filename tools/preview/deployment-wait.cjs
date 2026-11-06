'use strict';
// deploy-pages can report success before the CDN serves the new files, so wait
// for the public build identity before judging the deployed loader.
async function waitForDeployedBuild(baseUrl,sha,buildId,{fetchImpl=fetch,timeoutMs=300000,intervalMs=5000,stableReads=3,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),now=Date.now}={}){
  const expectedPath='builds/'+sha+'/'+buildId+'/index.html';
  const deadline=now()+timeoutMs;
  let matches=0,lastSeen='nothing';
  for(;;){
    try{
      const url=new URL('build.json',baseUrl);url.searchParams.set('fresh',String(now()));
      const response=await fetchImpl(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw Error('HTTP '+response.status);
      const build=await response.json();
      lastSeen=JSON.stringify(build);
      matches=build.source_sha===sha&&build.build_id===buildId&&build.path===expectedPath?matches+1:0;
    }catch(error){
      lastSeen=error.message;matches=0;
    }
    if(matches>=stableReads)return;
    if(now()>=deadline)throw Error('Deployment did not serve '+buildId+' within '+timeoutMs+' ms; last seen: '+lastSeen);
    await sleep(intervalMs);
  }
}
module.exports={waitForDeployedBuild};
