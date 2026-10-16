const {test}=require('node:test');
const assert=require('node:assert/strict');
const {angle,normalize}=require('../../main/gym/tilt.js');
const near=(a,b)=>assert(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('screen horizontal lean stays consistent in four orientations',()=>{
  near(angle(0,-30,0),30);
  near(angle(30,0,90),30);
  near(angle(0,30,180),30);
  near(angle(-30,0,270),30);
  near(angle(0,-30,360),30);
});
test('neutral, dead zone, proportional response, clamping and inversion',()=>{
  near(normalize(10,10,20,3,false),0);
  near(normalize(12,10,20,3,false),0);
  near(normalize(23,10,20,3,false),10/17);
  near(normalize(30,10,20,3,false),1);
  near(normalize(-10,10,20,3,false),-1);
  near(normalize(30,10,20,3,true),-1);
  near(normalize(200,10,20,3,false),1);
});
test('missing, nonfinite and out-of-range sensor data cannot become input',()=>{
  for(const value of [null,undefined,NaN,Infinity,'0'])assert.equal(angle(value,0,0),null);
  assert.equal(angle(181,0,0),null);assert.equal(angle(0,91,0),null);
  assert.equal(angle(0,0,Infinity),null);
  near(normalize(null,0,20,3,false),0);
  near(normalize(30,0,3,3,false),0);
  near(normalize(30,0,20,-1,false),0);
});
