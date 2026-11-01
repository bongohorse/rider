const {test}=require('node:test');
const assert=require('node:assert/strict');
const {verificationPlan,DESKTOP_GAMEPLAY_CHECKS}=require('../../tools/preview/verification-plan.cjs');

test('release CI partitions every original assertion exactly once plus desktop gameplay',()=>{
  // Freeze the original eleven release cases independently of the new sharding plan.
  const original=['desktop','phone-emulation','mobile','tilt','ramps','steps','seams','gaps','balance','bumps','air'];
  const expected=['desktop','desktop-gameplay',...original.slice(1)];
  const groups={
    'desktop-layout':['desktop'],
    'desktop-gameplay':['desktop-gameplay'],
    phone:['phone-emulation'],
    touch:['mobile','tilt'],
    stations:['ramps','steps','seams','gaps','balance','bumps','air'],
  };
  assert.deepEqual(verificationPlan(),expected);
  assert.deepEqual(verificationPlan('full'),expected);
  const split=Object.entries(groups).flatMap(([group,cases])=>{
    const actual=verificationPlan(group);
    assert.deepEqual(actual,cases,`Missing or unexpected case in ${group}`);
    return actual;
  });
  assert.deepEqual(split,expected);
  assert.deepEqual(split.filter(name=>name!=='desktop-gameplay'),original);
  assert.equal(new Set(split).size,expected.length,'Duplicate release case');
  const gameplay=['check_run','check_gem_release','check_fuel_release','check_levels',
    'check_level_storage','check_objects','check_progress'];
  assert.deepEqual([...DESKTOP_GAMEPLAY_CHECKS],gameplay);
  assert.equal(new Set(DESKTOP_GAMEPLAY_CHECKS).size,gameplay.length,'Duplicate gameplay module');
});
test('public deployment checks both viewports; unknown modes fail closed',()=>{
  assert.deepEqual(verificationPlan('deployment'),['desktop','phone-emulation']);
  for(const mode of ['','desktop','typo','toString','__proto__'])
    assert.throws(()=>verificationPlan(mode),/Unknown verification mode/);
});
