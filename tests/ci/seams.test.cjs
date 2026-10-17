const {test}=require('node:test'),assert=require('node:assert/strict');
const {qualify}=require('../../tools/gym/seam_analysis.cjs');
function run(speed=15){return {nominal_mps:speed,trace:Array.from({length:170},(_,i)=>[i/60,1/60,39+i*.25,1.5,speed,0,0,0,true,true,.5,0,0])};}
test('actual complete on-target window qualifies',()=>assert(qualify(run()).comparable));
test('one off-target interior sample invalidates despite valid entry and exit',()=>{const r=run();r.trace[100][4]=14;assert(!qualify(r).comparable);});
test('incomplete and unsupported nominal windows rejected',()=>{const r=run();r.trace.length=10;assert(!qualify(r).comparable);assert(!qualify(run(10)).comparable);});
test('wrong timestep and nonfinite values rejected',()=>{const r=run();r.trace[30][1]=1/30;assert(!qualify(r).comparable);r.trace[30][4]=NaN;assert(!qualify(r).comparable);});
