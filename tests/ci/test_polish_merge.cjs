// Fail-closed validation for independent LE6 partitions; no browser/engine fixture needed.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {mergeLe6,LE6_EXPECTED}=require('../../tools/gym/merge.cjs');
const root=path.resolve(__dirname,'../..');
function fixtures(){
 return LE6_EXPECTED.map((cases,i)=>({
  status:'PASS',part:(i+1)+'/2',source_sha:'a'.repeat(40),
  run_id:'independent-'+i,browser:'156.0.8078.4',
  cases:[...cases],measurements:{['sample'+i]:i}
 }));
}
const copy=x=>structuredClone(x);
test('LE6 partitions preserve all 23 distinct cases and measurement identities',()=>{
 const f=fixtures(),m=mergeLe6(f);
 assert.equal(m.status,'PASS');assert.deepEqual(m.parts,['1/2','2/2']);
 assert.equal(m.cases.length,23);assert.equal(new Set(m.cases).size,23);
 assert.deepEqual(m.cases,LE6_EXPECTED.flat());
 assert.deepEqual(m.run_ids,['independent-0','independent-1']);
 assert.deepEqual(m.measurements,{sample0:0,sample1:1});
});
test('LE6 declared inventory matches real source case registration in run order',()=>{
 const read=p=>fs.readFileSync(path.join(root,p),'utf8');
 const names=p=>[...read(p).matchAll(/cases\.push\('([^']+)'\)/g)].map(m=>m[1]);
 const parent=names('tools/gym/polish.cjs'),ui=names('tools/gym/editor_ui_checks.cjs');
 const gameplay=['medal','zoom','coin','drop','along','auto','gem','fuel'].map(name=>names('tools/gameplay/check_'+name+'_editor.cjs'));
 assert.equal(parent.length,9);assert.equal(ui.length,6);
 for(const n of gameplay)assert.equal(n.length,1);
 assert.deepEqual([...parent,...ui,...gameplay[0]],LE6_EXPECTED[0]);
 assert.deepEqual(gameplay.slice(1).flat(),LE6_EXPECTED[1]);
});
test('LE6 merge rejects missing, duplicated and misordered test cases',()=>{
 const mk=()=>fixtures();
 let r=mk();r[1].cases.pop();assert.throws(()=>mergeLe6(r),/inventory/);
 r=mk();r[1].cases[0]=r[0].cases[0];assert.throws(()=>mergeLe6(r),/inventory/);
 r=mk();r[1].cases.reverse();assert.throws(()=>mergeLe6(r),/inventory/);
 r=mk();r.pop();assert.throws(()=>mergeLe6(r),/Both LE6 parts/);
});
test('LE6 merge rejects stale artifacts, reused identity and failed parts',()=>{
 const mk=()=>fixtures();
 let r=mk();r[0].status='FAIL';assert.throws(()=>mergeLe6(r),/failed part/);
 r=mk();r[1].part='1/2';assert.throws(()=>mergeLe6(r),/part\/order/);
 r=mk();r[1].source_sha='b'.repeat(40);assert.throws(()=>mergeLe6(r),/Mixed source/);
 r=mk();r[1].run_id=r[0].run_id;assert.throws(()=>mergeLe6(r),/Reused run/);
 r=mk();r[1].browser='other';assert.throws(()=>mergeLe6(r),/Mixed browser/);
 r=mk();r[1].measurements={sample0:10};assert.throws(()=>mergeLe6(r),/Duplicate LE6 measurement/);
});
