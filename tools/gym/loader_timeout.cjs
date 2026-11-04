// Real Defold proxy/readiness messages are held/replayed by the le1a-only loader probe.
const assert=require('node:assert/strict'),pointer=require('./pointer.cjs');
async function loaderTimeout(page,url,ready,importFile){
 const results=[];
 const slots=()=>page.evaluate(()=>['a','b'].map(s=>{try{return Array.from(FS.readFile('/data/.rider/custom-level-'+s));}catch{return null;}}));
 let token=0;
 async function command(action,message){
  const expected=++token;
  await page.evaluate(r=>{window.riderLoaderRequest=r;},{token:expected,action,message});
  await page.waitForFunction(n=>window.riderLoaderProbe?.token===n,expected);
 }
 for(const message of ['proxy_loaded','gym_ready']){
  await page.goto(url);await ready('rolling-hills',1,null);
  const before=await slots();
  await command('hold',message);await importFile('kicker-platform');
  await page.waitForFunction(()=>window.riderLoaderProbe?.held===true);
  if(message==='gym_ready'){
   await command('stale');
   assert.equal(await page.evaluate(()=>window.riderLoaderProbe.loading),true,'superseded ready admitted');
   assert.deepEqual(await slots(),before,'superseded ready changed a save slot');
  }
  await command('expire');
  await page.waitForFunction(()=>window.riderLoaderProbe?.failed&&window.riderStationError?.includes('timed out'));
  // Disable is asynchronous: let the engine acknowledge it before observing a frozen world.
  await pointer.frames(page,{n:4});
  const stopped=await page.evaluate(()=>window.riderTelemetry?.sequence);
  await command('release');await command('release');await pointer.frames(page,{n:4});
  const after=await page.evaluate(()=>({probe:window.riderLoaderProbe,error:window.riderStationError,
   sequence:window.riderTelemetry?.sequence,status:window.riderCustomStatus}));
  assert.equal(after.probe.loading,true,'late completion cleared terminal loading');
  assert.equal(after.probe.alive,false,'late completion revived the world');
  assert.equal(after.sequence,stopped,'physics/telemetry resumed after terminal timeout');
  assert.match(after.error,/timed out/);assert.notEqual(after.status,'Saved');
  assert.deepEqual(await slots(),before,'late completion changed a prior save slot');
  results.push({message,...after});
  await page.goto(url);await ready('rolling-hills',1,null);
 }
 return results;
}
module.exports={loaderTimeout};
