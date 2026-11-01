const test=require('node:test');
const assert=require('node:assert/strict');
const {verificationPlan,DESKTOP_GAMEPLAY_CHECKS,GAMEPLAY_SHARDS,validateGameplayShards}=
  require('../../tools/preview/verification-plan.cjs');
const ORIGINAL=['check_run','check_gem_release','check_fuel_release','check_levels',
  'check_level_storage','check_objects','check_progress'];
test('six independent release groups preserve all loader and station cases',()=>{
  const groups=['desktop-layout','desktop-gameplay-a','desktop-gameplay-b','phone','touch','stations'];
  const cases=groups.flatMap(verificationPlan);
  assert.deepEqual(cases,['desktop','desktop-gameplay-a','desktop-gameplay-b','phone-emulation',
    'mobile','tilt','ramps','steps','seams','gaps','balance','bumps','air']);
  assert.equal(new Set(cases).size,cases.length);
  assert.deepEqual(verificationPlan('full'),cases);
  assert.deepEqual(verificationPlan('deployment'),['desktop','phone-emulation']);
});
test('original seven real-input gameplay modules run exactly once across shards',()=>{
  assert.deepEqual([...DESKTOP_GAMEPLAY_CHECKS],ORIGINAL);
  assert.deepEqual([...GAMEPLAY_SHARDS['desktop-gameplay-a']],['check_run','check_progress']);
  assert.deepEqual([...GAMEPLAY_SHARDS['desktop-gameplay-b']],
    ['check_gem_release','check_fuel_release','check_levels','check_level_storage','check_objects']);
  const combined=Object.values(GAMEPLAY_SHARDS).flat();
  assert.equal(combined.length,7);
  assert.equal(new Set(combined).size,7);
  assert.deepEqual([...combined].sort(),[...ORIGINAL].sort());
  assert.equal(validateGameplayShards(),true);
  assert.throws(()=>verificationPlan('desktop'),/Unknown verification mode/);
  assert.throws(()=>verificationPlan('desktop-gameplay'),/Unknown verification mode/);
  assert.throws(()=>verificationPlan('typo'),/Unknown verification mode/);
});
test('reject missing, duplicate, unknown, reordered and overlapping gameplay modules',()=>{
  const valid={a:['check_run','check_progress'],b:ORIGINAL.slice(1,6)};
  const shards=(a,b)=>({'desktop-gameplay-a':a,'desktop-gameplay-b':b});
  assert.equal(validateGameplayShards(ORIGINAL,shards(valid.a,valid.b)),true);
  assert.throws(()=>validateGameplayShards(ORIGINAL,shards(['check_run'],valid.b)),/Missing/);
  assert.throws(()=>validateGameplayShards(ORIGINAL,shards(['check_run','check_run','check_progress'],valid.b)),/Unknown or reordered/);
  assert.throws(()=>validateGameplayShards(ORIGINAL,shards(['check_run','check_progress'],['check_run',...valid.b])),/^Error: Missing, duplicated or unexpected gameplay check$/);
  assert.throws(()=>validateGameplayShards(ORIGINAL,shards(['check_run','check_progress'],['fake',...valid.b])),/Unknown/);
  assert.throws(()=>validateGameplayShards(ORIGINAL,shards(['check_progress','check_run'],valid.b)),/reordered/);
  assert.throws(()=>validateGameplayShards(ORIGINAL,{'desktop-gameplay-a':ORIGINAL}),/two gameplay shards/);
});
