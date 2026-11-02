// Monotonic, observational timings for the existing release verification plan.
// Durations of nested cases are inclusive; never sum parent and child durations.
const fs=require('node:fs');
const path=require('node:path');

function createTimings({source_sha,build_id,mode,clock=()=>process.hrtime.bigint()}){
  const started=clock(),cases=[],stack=[];
  let status='RUNNING',lastActiveCase=null,topError=null;
  function elapsed(from){return Math.max(0,Number(clock()-from)/1e6);}
  function begin(name,details={}){
    if(status!=='RUNNING'&&status!=='FAIL')throw Error('Cannot time after finish');
    const record={name,details,status:'RUNNING',elapsed_ms:null};
    const entry={record,started:clock()};
    cases.push(record);stack.push(entry);
    return entry;
  }
  function end(entry,outcome='PASS',error){
    if(stack.at(-1)!==entry)throw Error('Timing case nesting mismatch');
    // The deepest failed case ends first; propagated parent and cleanup failures must not replace it.
    if(outcome==='FAIL'&&lastActiveCase===null)lastActiveCase=entry.record.name;
    entry.record.elapsed_ms=elapsed(entry.started);
    entry.record.status=outcome;
    if(error)entry.record.error=String(error.message||error);
    stack.pop();
  }
  async function run(name,fn,details){
    const entry=begin(name,details);
    try{const value=await fn();end(entry);return value;}
    catch(error){end(entry,'FAIL',error);throw error;}
  }
  // Concurrent phases have independent clocks: the regular nested LIFO stack cannot
  // represent overlapping Playwright BrowserContexts. Every started phase must settle.
  async function parallel(tasks){
    if(status!=='RUNNING')throw Error('Cannot start parallel phases after finish/failure');
    if(!Array.isArray(tasks)||tasks.length!==2||
       new Set(tasks.map(t=>t?.name)).size!==tasks.length||
       tasks.some(t=>typeof t?.name!=='string'||!t.name||typeof t.run!=='function'))
      throw Error('Expected two uniquely named independent verification phases');
    const work=tasks.map(task=>{
      const record={name:task.name,details:task.details||{},status:'RUNNING',elapsed_ms:null};
      cases.push(record);
      const began=clock();
      return Promise.resolve().then(task.run).then(
        value=>{record.elapsed_ms=elapsed(began);record.status='PASS';return value;},
        error=>{
          record.elapsed_ms=elapsed(began);record.status='FAIL';
          record.error=String(error?.message||error);
          if(lastActiveCase===null)lastActiveCase=record.name;
          throw error;
        });
    });
    // Promise.all would reject early and allow cleanup to close a still-running page.
    const settled=await Promise.allSettled(work);
    const failure=settled.find(x=>x.status==='rejected');
    if(failure)throw failure.reason;
    return settled.map(x=>x.value);
  }
  function fail(error){
    if(stack.length&&lastActiveCase===null)lastActiveCase=stack.at(-1).record.name;
    if(topError===null)topError=String(error?.message||error);
    status='FAIL';
  }
  function finish(outcome){
    if(status==='RUNNING')status=outcome;
    if(stack.length)throw Error('Unclosed timing cases');
  }
  function snapshot(){
    return {schema_version:1,source_sha,build_id,mode,
      platform:'CI software browser (desktop and phone emulation; not a physical phone)',
      status,elapsed_ms:elapsed(started),last_active_case:status==='FAIL'?lastActiveCase:null,
      ...(topError?{error:topError}:{}),cases:cases.map(c=>({...c}))};
  }
  function write(out){
    fs.writeFileSync(path.join(out,'timings.json'),JSON.stringify(snapshot(),null,2)+'\n');
  }
  return {run,parallel,fail,finish,snapshot,write};
}
module.exports={createTimings};
