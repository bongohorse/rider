const {test}=require('node:test');
const assert=require('node:assert/strict');
const {verificationPlan}=require('../../tools/preview/verification-plan.cjs');

test('release CI partitions the full assertion inventory exactly once',()=>{
  const expected=['desktop','phone-emulation','mobile','tilt','ramps','steps','seams','gaps'];
  assert.deepEqual(verificationPlan(),expected);
  const split=['desktop','phone','touch','stations'].flatMap(verificationPlan);
  assert.deepEqual(split,expected);
  assert.equal(new Set(split).size,expected.length);
});
test('public deployment checks both viewports; unknown modes fail closed',()=>{
  assert.deepEqual(verificationPlan('deployment'),['desktop','phone-emulation']);
  for(const mode of ['','typo','toString','__proto__'])assert.throws(()=>verificationPlan(mode));
});
