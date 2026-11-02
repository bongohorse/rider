'use strict';
// #369: all 27 original Gym matrix case inventories remain; only path+regress share a runner.
// smoke.py remains authoritative for every actual real-input/physics assertion.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const GROUPS=Object.freeze({
  "seams-1": [
    "a18",
    "1/2"
  ],
  "seams-2": [
    "a18",
    "2/2"
  ],
  "sizes-1": [
    "le1b",
    "1/2"
  ],
  "sizes-2": [
    "le1b",
    "2/2"
  ],
  "ramps": [
    "a16"
  ],
  "steps": [
    "a17"
  ],
  "gaps": [
    "a19"
  ],
  "balance": [
    "a19d"
  ],
  "bumps-1": [
    "a19b",
    "1/2"
  ],
  "bumps-2": [
    "a19b",
    "2/2"
  ],
  "air": [
    "a19c"
  ],
  "editor": [
    "a15 le1a le2"
  ],
  "draw": [
    "le3"
  ],
  "library": [
    "le4"
  ],
  "prefab": [
    "le5a"
  ],
  "curve": [
    "le5b"
  ],
  "path-regress": [
    "le5c a22"
  ],
  "pause": [
    "a20"
  ],
  "points": [
    "le5d"
  ],
  "objects": [
    "ea2"
  ],
  "versions": [
    "ea3"
  ],
  "polish-1": [
    "le6",
    "1/2"
  ],
  "polish-2": [
    "le6",
    "2/2"
  ],
  "struts": [
    "cf3"
  ],
  "replay": [
    "a21"
  ],
  "controls": [
    "a3 a6 coast coast345 a15a hud a7 a8 m2feedback a9 a9invalid a10 a11 a12"
  ]
});
const CASE_REPORTS=Object.freeze({
  "a15": [
    "stations",
    "stations-result.json"
  ],
  "le1a": [
    "custom",
    "custom-result.json"
  ],
  "le1b": [
    "sizes",
    "sizes-result.json"
  ],
  "le2": [
    "editor",
    "editor-result.json"
  ],
  "le3": [
    "draw",
    "draw-result.json"
  ],
  "le4": [
    "library",
    "library-result.json"
  ],
  "le5a": [
    "prefab",
    "prefab-result.json"
  ],
  "le5b": [
    "curve",
    "curve-result.json"
  ],
  "le5c": [
    "path",
    "path-result.json"
  ],
  "a20": [
    "pause",
    "pause-result.json"
  ],
  "le5d": [
    "points",
    "points-result.json"
  ],
  "ea2": [
    "objects",
    "objects-result.json"
  ],
  "ea3": [
    "versions",
    "versions-result.json"
  ],
  "le6": [
    "polish",
    "polish-result.json"
  ],
  "cf3": [
    "struts",
    "struts-result.json"
  ],
  "a21": [
    "replay",
    "replay-result.json"
  ],
  "a22": [
    "regress",
    "regress-result.json"
  ],
  "a16": [
    "ramps",
    "ramps-result.json"
  ],
  "a17": [
    "steps",
    "steps-result.json"
  ],
  "a18": [
    "seams",
    "seams-result.json"
  ],
  "a19": [
    "gaps",
    "gaps-result.json"
  ],
  "a19d": [
    "balance",
    "balance-result.json"
  ],
  "a19b": [
    "bumps",
    "bumps-result.json"
  ],
  "a19c": [
    "air",
    "air-result.json"
  ],
  "a3": [
    "gym",
    "gym-result.json"
  ],
  "a6": [
    "feel",
    "gym-result.json"
  ],
  "coast": [
    "coast",
    "gym-result.json"
  ],
  "coast345": [
    "coast-measure",
    "coast-measure-result.json"
  ],
  "a15a": [
    "rider",
    "gym-result.json"
  ],
  "hud": [
    "hud",
    "gym-result.json"
  ],
  "a7": [
    "head",
    "gym-result.json"
  ],
  "a8": [
    "sliders",
    "gym-result.json"
  ],
  "m2feedback": [
    "feedback-feel",
    "gym-result.json"
  ],
  "a9": [
    "presets",
    "gym-result.json"
  ],
  "a9invalid": [
    "preset-invalid",
    "gym-result.json"
  ],
  "a10": [
    "audio",
    "gym-result.json"
  ],
  "a11": [
    "feedback",
    "gym-result.json"
  ],
  "a12": [
    "history",
    "gym-result.json"
  ]
});
const sorted=x=>[...x].sort();
function validateWorkflow(yaml){
 for(const name of ['native','native-windows','html5','gym','gym-reports'])
  assert.ok(yaml.includes('\n  '+name+':\n'),'Required G1 job missing: '+name);
 const gym=yaml.split('\n  gym:\n')[1].split('\n  gym-reports:\n')[0];
 const rows=[...gym.matchAll(/^          - group: ([\w-]+)\n            cases: '([^']+)'(?:\n            part: '([^']+)')?/gm)];
 assert.equal(rows.length,Object.keys(GROUPS).length,'Wrong matrix size');
 assert.deepEqual(sorted(rows.map(m=>m[1])),sorted(Object.keys(GROUPS)),'Missing/duplicate group');
 for(const m of rows){
  assert.equal(m[2],GROUPS[m[1]][0],'Changed case list: '+m[1]);
  assert.equal(m[3]||null,GROUPS[m[1]][1]||null,'Changed split part: '+m[1]);
 }
 const commands=[...gym.matchAll(/run: python tools\/gym\/smoke\.py --bundle artifacts\/g1\/gym-bundle --output artifacts\/g1\/([\w-]+) --case ([\w-]+)/g)];
 assert.equal(commands.length,Object.keys(CASE_REPORTS).length,'Changed smoke command count');
 assert.deepEqual(sorted(commands.map(m=>m[2])),sorted(Object.keys(CASE_REPORTS)),'Missing/duplicate smoke case');
 for(const m of commands){
  assert.equal(m[1],CASE_REPORTS[m[2]][0],'Changed case output: '+m[2]);
  const step=gym.slice(0,m.index).split('\n      - name:').pop();
  assert.ok(step.includes("' "+m[2]+" '"),'Missing case guard: '+m[2]);
 }
 assert.ok(yaml.includes('pattern: g1-gym-*-${{ github.run_id }}-${{ github.run_attempt }}'),'Artifact download missing');
 assert.ok(yaml.includes('node tools/ci/gym369_gate.cjs artifacts/gym369'),'Runtime gate missing');
 return {groups:rows.length,commands:commands.length};
}
function resultPaths(dir,prefix=''){
 let out=[];
 for(const e of fs.readdirSync(dir,{withFileTypes:true})){
  assert.ok(!e.isSymbolicLink(),'Artifact symlink forbidden');
  const rel=prefix?prefix+'/'+e.name:e.name;
  if(e.isDirectory())out.push(...resultPaths(path.join(dir,e.name),rel));
  else if(e.isFile()&&e.name.endsWith('-result.json'))out.push(rel);
 }
 return sorted(out);
}
function validateArtifacts(root,sha,run){
 assert.match(sha,/^[a-f0-9]{40}$/,'40-hex source SHA required');
 assert.match(run,/^[0-9]+-[0-9]+$/,'Run ID/attempt required');
 const names=Object.keys(GROUPS).map(g=>'g1-gym-'+g+'-'+run);
 assert.deepEqual(sorted(fs.readdirSync(root)),sorted(names),'Missing/duplicate/foreign Gym job artifact');
 const ids=new Set();let count=0;
 for(const [group,[cases,part]] of Object.entries(GROUPS)){
  const dir=path.join(root,'g1-gym-'+group+'-'+run);
  assert.ok(fs.statSync(dir).isDirectory(),'Not a directory: '+group);
  const expected=cases.split(' ').map(c=>CASE_REPORTS[c].join('/'));
  // Camera #352 writes a second, independently asserted A16 report with the SAME case run_id.
  if(group==='ramps')expected.push('ramps/camera352-result.json');
  assert.deepEqual(resultPaths(dir),sorted(expected),'Missing/duplicate/unexpected result: '+group);
  for(const c of cases.split(' ')){
   const [sub,file]=CASE_REPORTS[c],r=JSON.parse(fs.readFileSync(path.join(dir,sub,file),'utf8'));
   assert.equal(r.status,'PASS','Failed case: '+c);
   assert.equal(r.source_sha,sha,'Foreign source SHA: '+c);
   assert.ok(typeof r.run_id==='string'&&r.run_id.length,'Missing run identity: '+c);
   assert.ok(!ids.has(r.run_id),'Duplicate case run identity: '+c);ids.add(r.run_id);
   assert.equal(r.part??null,part||null,'Wrong split part: '+c);
   if(c==='le5c')assert.equal(r.cases?.length,4,'Incomplete path coverage');
   if(c==='a22'){assert.equal(r.cases?.length,7,'Incomplete regression coverage');assert.equal(r.mode,'check','Recording not allowed');}
   count++;
  }
  if(group==='ramps'){
   const camera=JSON.parse(fs.readFileSync(path.join(dir,'ramps','camera352-result.json'),'utf8'));
   const ramps=JSON.parse(fs.readFileSync(path.join(dir,'ramps','ramps-result.json'),'utf8'));
   assert.equal(camera.status,'PASS','Camera A/B supplementary report failed');
   assert.equal(camera.source_sha,sha,'Camera A/B supplementary report source mismatch');
   assert.equal(camera.run_id,ramps.run_id,'Camera A/B must share the A16 run identity');
   assert.equal(camera.human_drive,'REQUIRED BEFORE CAMERA DEFAULT MERGE','Camera human gate must remain');
  }
 }
 assert.equal(count,42,'Original 38 case commands plus four split part reports required');
 return {status:'PASS',source_sha:sha,run,groups:names.length,reports:count};
}
if(require.main===module){
 try{
  validateWorkflow(fs.readFileSync('.github/workflows/g1.yml','utf8'));
  console.log(JSON.stringify(validateArtifacts(process.argv[2],process.argv[3],process.argv[4])));
 }catch(e){console.error('Gym #369 inventory FAIL:',e.message);process.exitCode=1;}
}
module.exports={GROUPS,CASE_REPORTS,validateWorkflow,validateArtifacts};
