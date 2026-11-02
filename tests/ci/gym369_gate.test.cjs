'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {GROUPS,CASE_REPORTS,validateWorkflow,validateArtifacts}=require('../../tools/ci/gym369_gate.cjs');
const SHA='a'.repeat(40),RUN='12345-1';
test('original 38 smoke commands and native/HTML5 remain',()=>{
 const y=fs.readFileSync(path.join(__dirname,'../../.github/workflows/g1.yml'),'utf8');
 assert.deepEqual(validateWorkflow(y),{groups:26,commands:38});
 assert.throws(()=>validateWorkflow(y.replace("cases: 'le5c a22'","cases: 'le5c'")),/Changed case list/);
 assert.throws(()=>validateWorkflow(y.replace('--case a22','--case a21')),/Missing\/duplicate smoke case/);
  // Every original smoke must be an active exact YAML run, never a commented copy.
  for(const [caseName,[output]] of Object.entries(CASE_REPORTS)){
   const prefix='        run: python tools/gym/smoke.py --bundle artifacts/g1/gym-bundle --output artifacts/g1/'+output+' --case '+caseName;
   const active=y.split('\n').find(line=>line===prefix||line===prefix+' --part "$PART"');
   assert.ok(active,'Original active smoke missing: '+caseName);
   const commented=y.replace(active,'        run: echo disabled-'+caseName+'\n        # '+active.trim());
   assert.throws(()=>validateWorkflow(commented),/Changed smoke command count/,'Comment-only smoke accepted: '+caseName);
  }
  const le4='        run: python tools/gym/smoke.py --bundle artifacts/g1/gym-bundle --output artifacts/g1/library --case le4';
  assert.throws(()=>validateWorkflow(y.replace(le4,le4+'\n      - name: Duplicate LE4 smoke\n'+le4)),/Changed smoke command count/);
  const guard="        if: contains(format(' {0} ', matrix.cases), ' le4 ')";
  assert.throws(()=>validateWorkflow(y.replace(guard,'        # '+guard.trim())),/Missing active case guard: le4/);
 assert.throws(()=>validateWorkflow(y.replace('python tools/project.py verify --suite physics --target html5 --output artifacts/g1/html5','echo no-html5-physics')),/Missing html5 verification/);
 assert.throws(()=>validateWorkflow(y.replace('python tools/project.py verify --suite physics --target desktop --configuration ${{ matrix.configuration }} --output artifacts/g1/native','echo no-linux-physics')),/Missing native verification/);
 assert.throws(()=>validateWorkflow(y.replace('python tools/project.py verify --suite physics --target desktop --configuration debug --output artifacts/g1/native','echo no-windows-physics')),/Missing native-windows verification/);
 assert.throws(()=>validateWorkflow(y.replace('node --test tests/ci/*.cjs','echo no-ci-tests')),/Missing html5 verification/);
 assert.throws(()=>validateWorkflow(y.replace('    needs: gym\n','    needs: html5\n')),/Gym merge must depend/);
 assert.throws(()=>validateWorkflow(y.replace('run: python tools/gym/smoke.py --case le6 --output artifacts/g1/polish --merge','run: echo no-le6-merge --output artifacts/g1/polish --merge')),/Missing\/duplicate active split merge: le6/);
 for(const c of ['a18','le1b','a19b','le6']){
  const active=y.match(new RegExp('^        run: python tools/gym/smoke\\.py --case '+c+' --output [^\\n]+$','m'))?.[0];
  assert.ok(active,'Original active merge command missing: '+c);
  const commented=y.replace(active,'        run: echo no-'+c+'-merge\n        # '+active.trim());
  assert.throws(()=>validateWorkflow(commented),new RegExp('Missing/duplicate active split merge: '+c));
 }
 const activeLe6=y.match(/^        run: python tools\/gym\/smoke\.py --case le6 --output [^\n]+$/m)?.[0];
 assert.ok(activeLe6,'Original LE6 merge missing');
 assert.throws(()=>validateWorkflow(y.replace(activeLe6,activeLe6+'\n      - name: Duplicate LE6 merge\n'+activeLe6)),/Missing\/duplicate active split merge: le6/);
 assert.throws(()=>validateWorkflow(y.replace('name: g1-gym-reports-${{ github.run_id }}-${{ github.run_attempt }}','name: no-merged-reports')),/Merged Gym report artifact missing/);
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
   if(group==='ramps'){
    const dir=path.join(root,'g1-gym-ramps-'+RUN,'ramps');
    const ramps=JSON.parse(fs.readFileSync(path.join(dir,'ramps-result.json'),'utf8'));
    fs.writeFileSync(path.join(dir,'camera352-result.json'),JSON.stringify({
      status:'PASS',source_sha:SHA,run_id:ramps.run_id,
      human_drive:'REQUIRED BEFORE CAMERA DEFAULT MERGE'
    }));
   }
  }
  assert.deepEqual(validateArtifacts(root,SHA,RUN),{status:'PASS',source_sha:SHA,run:RUN,groups:26,reports:42});
  const camera=path.join(root,'g1-gym-ramps-'+RUN,'ramps','camera352-result.json');
  const cameraOriginal=fs.readFileSync(camera,'utf8');
  fs.rmSync(camera);assert.throws(()=>validateArtifacts(root,SHA,RUN),/Missing\/duplicate\/unexpected/);
  fs.writeFileSync(camera,cameraOriginal);
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
