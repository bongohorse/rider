const test=require('node:test');
const assert=require('node:assert/strict');
const {verificationPlan,DESKTOP_GAMEPLAY_CHECKS}=require('../../tools/preview/verification-plan.cjs');
test('five independent release groups preserve the original inventory',()=>{
  const groups=['desktop-layout','desktop-gameplay','phone','touch','stations'];
  const cases=groups.flatMap(verificationPlan);
  assert.deepEqual(cases,['desktop','desktop-gameplay','phone-emulation','mobile','tilt',
    'ramps','steps','seams','gaps','balance','bumps','air']);
  assert.equal(new Set(cases).size,cases.length);
  assert.deepEqual(verificationPlan('full'),cases);
  assert.deepEqual(verificationPlan('deployment'),['desktop','phone-emulation']);
});
test('seven gameplay modules remain exact and ordered',()=>{
  assert.deepEqual([...DESKTOP_GAMEPLAY_CHECKS],['check_run','check_gem_release',
    'check_fuel_release','check_levels','check_level_storage','check_objects','check_progress']);
  assert.throws(()=>verificationPlan('desktop'),/Unknown verification mode/);
  assert.throws(()=>verificationPlan('typo'),/Unknown verification mode/);
});
