const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const station=require('../../tools/gym/air_station.cjs');

test('air station file is the generator output',()=>{
  const file=fs.readFileSync(path.join(__dirname,'../..',station.FILE),'utf8');
  assert.equal(file,station.text(station.build()));
});

test('air sections: plateau, kicker lip, landing area and labels',()=>{
  const d=station.build(),chain=d.chains[0];
  assert.equal(d.kind,'air');assert.equal(d.chains.length,1);
  assert.deepEqual(d.sections.map(s=>s.id),station.SECTIONS.map(s=>s.id));
  assert.deepEqual(d.spawn,d.sections[0].spawn);
  // Right-to-left chain (collides on top); x never increases, so walls are vertical runs only.
  for(let i=1;i<chain.length;i++)assert(chain[i][0]<=chain[i-1][0]);
  const has=(x,y)=>chain.some(p=>Math.abs(p[0]-x)<1e-6&&Math.abs(p[1]-y)<1e-6);
  for(const s of d.sections){
    const spec=station.SECTIONS.find(x=>x.id===s.id);
    assert.equal(s.lip_y-s.land_y,spec.height+0.5);
    assert(has(s.ramp_start,s.lip_y-0.5)&&has(s.lip_x,s.lip_y),'kicker to the lip');
    assert.equal(s.landing,spec.slope?'down':'flat');
    if(!spec.slope)assert(has(s.lip_x,s.land_y),'vertical drop to the flat landing');
    else assert(has(s.lip_x,s.lip_y-spec.drop),'downslope starts below the lip');
    assert(s.end_x-s.land_x>=40);
    assert.equal(d.labels.filter(l=>l.text.startsWith(s.id.toUpperCase()+' ')).length,1);
  }
  assert.equal(d.labels.length,2*d.sections.length);
  assert(chain.length-1+d.labels.length<=800);
});
