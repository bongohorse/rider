'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {GROUPS,CASE_REPORTS,validateWorkflow,validateArtifacts}=require('../../tools/ci/gym369_gate.cjs');
const SHA='a'.repeat(40),RUN='12345-1';
test('original 38 smoke commands and native/HTML5 remain',()=>{
 const y=fs.readFileSync(path.join(__dirname,'../../.github/workflows/g1.yml'),'utf8');
 assert.deepEqual(validateWorkflow(y),{groups:26,commands:38});
 assert.throws(()=>validateWorkflow(y.replace("cases: 'le5c a22'","cases: 'le5c'")),/Changed case list/);
 assert.throws(()=>validateWorkflow(y.replace('--case a22','--case a21')),/Missing\/duplicate smoke case/);
});
test('artifact gate fails closed on missing/duplicate/source/part',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rider-gym369-'));let n=0;
 try{
  for(const [group,[cases,part]] of Object.entries(GROUPS)){
   for(const c of cases.split(' ')){
    const [sub,file]=CASE_REPORTS[c],dir=path.join(root,'g1-gym-'+group+'-'+RUN,sub);
    fs.mkdirSync(dir,{recursive:true});
    const r={status:'PASS',source_sha:SHA,run_id:'unique-'+ ++n,part:part||null};
    if(c==='le5c')r.cases=[1,2,3,4];
    if(c==='a22'){r.cases=[1,2,3,4,5,6,7];r.mode='check';}
    fs.writeFileSync(path.join(dir,file),JSON.stringify(r));
   }
  }
  assert.deepEqual(validateArtifacts(root,SHA,RUN),{status:'PASS',source_sha:SHA,run:RUN,groups:26,reports:42});
  const dir=path.join(root,'g1-gym-path-regress-'+RUN),p=path.join(dir,'path','path-result.json'),original=fs.readFileSync(p,'utf8');
  fs.rmSync(p);assert.throws(()=>validateArtifacts(root,SHA,RUN),/Missing\/duplicate\/unexpected/);
  fs.writeFileSync(p,original);
  const extra=path.join(dir,'path','extra-result.json');fs.writeFileSync(extra,original);
  assert.throws(()=>validateArtifacts(root,SHA,RUN),/Missing\/duplicate\/unexpected/);fs.rmSync(extra);
  fs.writeFileSync(p,JSON.stringify({...JSON.parse(original),source_sha:'b'.repeat(40)}));
  assert.throws(()=>validateArtifacts(root,SHA,RUN),/Foreign source SHA/);fs.writeFileSync(p,original);
  const q=path.join(dir,'regress','regress-result.json'),regress=JSON.parse(fs.readFileSync(q,'utf8'));
  fs.writeFileSync(q,JSON.stringify({...regress,run_id:JSON.parse(original).run_id}));
  assert.throws(()=>validateArtifacts(root,SHA,RUN),/Duplicate case run identity/);
  fs.writeFileSync(q,JSON.stringify({...regress,part:'1/2'}));
  assert.throws(()=>validateArtifacts(root,SHA,RUN),/Wrong split part/);
  fs.writeFileSync(q,JSON.stringify(regress));
  fs.mkdirSync(path.join(root,'g1-gym-foreign-'+RUN));
  assert.throws(()=>validateArtifacts(root,SHA,RUN),/Missing\/duplicate\/foreign Gym job artifact/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
