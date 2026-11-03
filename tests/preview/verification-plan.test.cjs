const test=require('node:test');
const assert=require('node:assert/strict');
const {verificationPlan,DESKTOP_GAMEPLAY_CHECKS,DESKTOP_GAMEPLAY_SHARDS}=require('../../tools/preview/verification-plan.cjs');
test('six independent release groups preserve the original inventory',()=>{
  const groups=['desktop-layout','desktop-gameplay-1','desktop-gameplay-2','phone','touch','stations'];
  const cases=groups.flatMap(verificationPlan);
  assert.deepEqual(cases,['desktop','desktop-gameplay-1','desktop-gameplay-2','phone-emulation','mobile','tilt',
    'ramps','steps','seams','gaps','balance','bumps','air']);
  assert.equal(new Set(cases).size,cases.length);
  assert.deepEqual(verificationPlan('full'),cases);
  assert.deepEqual(verificationPlan('deployment'),['desktop','phone-emulation']);
});
test('seven gameplay modules remain exact and ordered across both shards',()=>{
  assert.deepEqual([...DESKTOP_GAMEPLAY_CHECKS],['check_run','check_gem_release',
    'check_fuel_release','check_levels','check_level_storage','check_objects','check_progress']);
  assert.deepEqual(Object.keys(DESKTOP_GAMEPLAY_SHARDS),['desktop-gameplay-1','desktop-gameplay-2']);
  assert.deepEqual(Object.values(DESKTOP_GAMEPLAY_SHARDS).flat(),[...DESKTOP_GAMEPLAY_CHECKS]);
  assert.throws(()=>verificationPlan('desktop'),/Unknown verification mode/);
  assert.throws(()=>verificationPlan('desktop-gameplay'),/Unknown verification mode/);
  assert.throws(()=>verificationPlan('typo'),/Unknown verification mode/);
});
