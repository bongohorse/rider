const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const geometry=require('../../tools/gym/balance_geometry.cjs');
const ROOT=path.resolve(__dirname,'../..');

test('balance station file is the generator output',()=>{
  assert.equal(fs.readFileSync(path.join(ROOT,geometry.FILE),'utf8'),geometry.text(geometry.build()));
});

test('balance sections: raised decks, narrowing beams, independent starts from rest',()=>{
  const d=geometry.build(),chain=d.chains[0],points=new Set(chain.map(p=>p.join()));
  assert.equal(d.chains.length,1);assert.ok(chain.every((p,i)=>i===0||p[0]<=chain[i-1][0]),'descending x');
  assert.deepEqual(d.sections.map(s=>s.id),['beam-2','beam-1.5','beam-1.2','beam-1.05','up','down','seesaw']);
  assert.deepEqual(d.sections.slice(0,4).map(s=>+(s.target_x1-s.target_x0).toFixed(6)),[2,1.5,1.2,1.05]);
  assert.equal(d.labels.length,d.sections.length);
  for(const s of d.sections){
    assert.equal(s.start_speed,0);assert.ok(s.spawn[0]<s.target_x0&&s.target_x1<=s.end_x);
    // A cliff from the target platform back to the floor 0.8 m below the decks.
    assert.ok(points.has([s.end_x,s.target_y].join())&&points.has([s.end_x,0.8].join()),s.id);
    assert.ok(s.target_y-0.8>=0.8-1e-9,s.id+' raised at least 0.8 m');
  }
});

test('seesaw plank: data, resource and rest/tip geometry agree',()=>{
  const d=geometry.build(),s=d.seesaw,P=geometry.PLANK;
  const shape=fs.readFileSync(path.join(ROOT,'main/gym/seesaw.convexshape'),'utf8');
  const v=[...shape.matchAll(/data: (-?[0-9.]+)/g)].map(m=>+m[1]),r=x=>Math.round(x)/100,xs=v.filter((_,i)=>i%3===0),ys=v.filter((_,i)=>i%3===1);
  assert.equal(r(Math.max(...xs)-Math.min(...xs)),s.length);assert.equal(r(Math.max(...ys)-Math.min(...ys)),s.thickness);
  assert.equal(r(Math.max(...xs)-Math.max(...xs.filter(x=>x<Math.max(...xs)))),s.taper);
  assert.match(fs.readFileSync(path.join(ROOT,'main/gym/seesaw.collisionobject'),'utf8'),new RegExp(`mass: ${s.mass}\\.0\\n`));
  assert.match(fs.readFileSync(path.join(ROOT,'main/gym/station_data.lua'),'utf8'),new RegExp(`M.SEESAW_PLANK=\\{length=${s.length},thickness=${s.thickness},taper=${s.taper},mass=${s.mass}\\}`));
  const half=s.length/2,deck=1.6,reach=half*Math.cos(s.rest_angle),chain=d.chains[0];
  // At rest the left tip lies on the start deck, tipped the right tip on the exit deck; the limit is beyond both.
  assert.ok(Math.abs(s.pivot[1]-half*Math.sin(s.rest_angle)-deck)<1e-6);
  const deckAt=x=>chain.some((p,i)=>i>0&&p[1]===deck&&chain[i-1][1]===deck&&Math.min(p[0],chain[i-1][0])<=x&&x<=Math.max(p[0],chain[i-1][0]));
  assert.ok(deckAt(s.pivot[0]-reach)&&deckAt(s.pivot[0]+reach));
  assert.ok(s.limit>s.rest_angle+0.1);
  const section=d.sections.find(x=>x.id===s.section);assert.ok(section.target_x0>s.pivot[0]+reach);
  // The pedestal apex stays below the plank underside in every pose up to the limit.
  const apex=chain.find(p=>Math.abs(p[0]-s.pivot[0])<1e-6);
  assert.ok((s.pivot[1]-apex[1])*Math.cos(s.limit)>s.thickness/2+0.02);
  assert.equal(P.mass,s.mass);
});
