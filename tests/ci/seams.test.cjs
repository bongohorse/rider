const {test}=require('node:test'),assert=require('node:assert/strict');
const {qualify,peaks}=require('../../tools/gym/seam_analysis.cjs');
function run(speed=15){return {nominal_mps:speed,trace:Array.from({length:170},(_,i)=>[i/60,1/60,39+i*.25,1.5,speed,0,0,0,true,true,.5,0,0])};}
test('actual complete on-target window qualifies',()=>assert(qualify(run()).comparable));
test('one off-target interior sample invalidates despite valid entry and exit',()=>{const r=run();r.trace[100][4]=14;assert(!qualify(r).comparable);});
test('incomplete and unsupported nominal windows rejected',()=>{const r=run();r.trace.length=10;assert(!qualify(r).comparable);assert(!qualify(run(10)).comparable);});
test('wrong timestep and nonfinite values rejected',()=>{const r=run();r.trace[30][1]=1/30;assert(!qualify(r).comparable);r.trace[30][4]=NaN;assert(!qualify(r).comparable);});

test('missing interior step and unintended enabled motor invalidate free roll',()=>{const r=run();r.trace.splice(80,1);assert(!qualify(r).comparable);const f=run();f.freewheel=true;assert(!qualify(f).comparable);});
test('raw samples recover vertical peak, rise and contact loss at a seam',()=>{const r=run();r.baseline_y=1.5;r.trace[4][5]=.4;r.trace[4][3]=1.52;r.trace[4][8]=false;const p=peaks(r,40);assert.equal(p.vy,.4);assert.equal(p.dvy,.4);assert(Math.abs(p.rise-.02)<1e-10);assert.equal(p.loss1,1);assert.equal(p.loss2,0);});
