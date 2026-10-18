const {test}=require('node:test'),assert=require('node:assert/strict');
const {qualify,peaks}=require('../../tools/gym/seam_analysis.cjs');
function run(speed=9,freewheel=false){return {nominal_mps:speed,freewheel,trace:Array.from({length:240},(_,i)=>[i/60,1/60,30+i*.25,1.5,speed,0,0,0,true,true,freewheel?0:.5,0,0,!freewheel,!freewheel,-speed/.22,-speed/.22])};}
test('actual complete on-target window qualifies',()=>{assert(qualify(run()).comparable);assert(qualify(run(5,true)).comparable);});
test('powered: one off-target interior sample invalidates despite valid entry and exit',()=>{const r=run();r.trace[100][4]=8;assert(!qualify(r).comparable);});
test('free roll: seam speed loss after a valid entry is measured, not rejected',()=>{const r=run(9,true);r.trace.forEach(v=>{if(v[2]>39)v[4]=9-(v[2]-39)*.05;});assert(qualify(r).comparable);});
test('free roll: off-target baseline, entry or gained speed rejected',()=>{
 const b=run(9,true);b.trace[5][4]=8;assert.deepEqual(qualify(b).reasons,['baseline speed outside +/-5% window']);
 const e=run(9,true);e.trace.forEach(v=>{if(v[2]>=39)v[4]=8;});assert(qualify(e).reasons.includes('entry speed outside +/-5% window'));
 const g=run(9,true);g.trace[120][4]=9.6;assert.deepEqual(qualify(g).reasons,['speed above +5% window']);});
test('wheel spin at the engine rotation cap invalidates',()=>{const r=run(9,true);r.trace[90][16]=-.25*Math.PI*60;assert.deepEqual(qualify(r).reasons,['wheel spin at engine rotation cap']);});
test('incomplete and unsupported nominal windows rejected',()=>{const r=run();r.trace.length=60;assert(!qualify(r).comparable);assert(!qualify(run(10)).comparable);assert(!qualify(run(15)).comparable);});
test('wrong timestep and nonfinite values rejected',()=>{const r=run();r.trace[30][1]=1/30;assert(!qualify(r).comparable);r.trace[30][4]=NaN;assert(!qualify(r).comparable);});
test('missing interior step and unintended enabled motor invalidate free roll',()=>{const r=run();r.trace.splice(80,1);assert(!qualify(r).comparable);const f=run(9,true);f.trace[70][14]=true;assert.deepEqual(qualify(f).reasons,['freewheel conditions changed']);});
test('raw samples recover vertical peak, rise and contact loss at a seam',()=>{const r=run();r.baseline_y=1.5;const i=40;r.trace[i][5]=.4;r.trace[i][3]=1.52;r.trace[i][8]=false;const p=peaks(r,40);assert.equal(p.vy,.4);assert.equal(p.dvy,.4);assert(Math.abs(p.rise-.02)<1e-10);assert.equal(p.loss1,1);assert.equal(p.loss2,0);});
test('raw samples recover one-step longitudinal drop and seam speed loss',()=>{const r=run(9,true);r.baseline_y=1.5;r.trace.forEach((v,i)=>{if(i>=40)v[4]=8.9;});const p=peaks(r,40);assert(Math.abs(p.dvx-.1)<1e-10);assert(Math.abs(p.vxLoss-.1)<1e-10);assert.equal(peaks(r,50).dvx,0);});
