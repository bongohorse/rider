'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const {waitForDeployedBuild}=require('../../tools/preview/deployment-wait.cjs');
const sha='a'.repeat(40),buildId='1-6';
const build=id=>({source_sha:sha,build_id:id,path:'builds/'+sha+'/'+id+'/index.html'});
function harness(responses){
  let clock=0,reads=0;
  return {reads:()=>reads,options:{
    intervalMs:10,timeoutMs:50,now:()=>clock,sleep:async ms=>{clock+=ms;},
    fetchImpl:async()=>{const next=responses[Math.min(reads++,responses.length-1)];if(next instanceof Error)throw next;return {ok:true,json:async()=>next};},
  }};
}
test('waits past the previous build until the identity is stable',async()=>{
  const h=harness([build('1-3'),build('1-6'),build('1-3'),build('1-6'),build('1-6'),build('1-6')]);
  await waitForDeployedBuild('https://example.test/rider/',sha,buildId,h.options);
  assert.equal(h.reads(),6);
});
test('fails with the last seen build when the deployment never appears',async()=>{
  const h=harness([build('1-3')]);
  await assert.rejects(waitForDeployedBuild('https://example.test/rider/',sha,buildId,h.options),/did not serve 1-6.*1-3/);
});
test('a failed read resets the stable count',async()=>{
  const h=harness([build('1-6'),build('1-6'),new Error('offline'),build('1-6'),build('1-6'),build('1-6')]);
  await waitForDeployedBuild('https://example.test/rider/',sha,buildId,h.options);
  assert.equal(h.reads(),6);
});
