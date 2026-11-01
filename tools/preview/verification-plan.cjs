// Full remains the default for local callers. CI partitions the same assertions.
// One JSON inventory is consumed by both JS execution and the Python artifact gate.
const manifest=require('./gameplay-checks.json');
const DESKTOP_GAMEPLAY_CHECKS=Object.freeze([...manifest.checks]);
const GAMEPLAY_SHARDS=Object.freeze(Object.fromEntries(
  Object.entries(manifest.shards).map(([mode,checks])=>[mode,Object.freeze([...checks])])
));
function validateGameplayShards(checks=DESKTOP_GAMEPLAY_CHECKS,shards=GAMEPLAY_SHARDS){
  if(checks.length!==7||new Set(checks).size!==checks.length)
    throw Error('Invalid seven-module gameplay inventory');
  const names=Object.keys(shards);
  if(names.length!==2||!names.includes('desktop-gameplay-a')||!names.includes('desktop-gameplay-b'))
    throw Error('Expected two gameplay shards');
  const all=names.flatMap(name=>{
    const selected=shards[name];
    if(!Array.isArray(selected)||!selected.length)throw Error('Empty gameplay shard');
    const positions=selected.map(check=>checks.indexOf(check));
    if(positions.some(index=>index<0)||positions.some((index,i)=>i>0&&index<=positions[i-1]))
      throw Error('Unknown or reordered gameplay check');
    return selected;
  });
  if(all.length!==checks.length||new Set(all).size!==checks.length||
     checks.some(check=>!all.includes(check)))
    throw Error('Missing, duplicated or unexpected gameplay check');
  return true;
}
validateGameplayShards();
const groups = {
  'desktop-layout': ['desktop'],
  ...Object.fromEntries(Object.keys(GAMEPLAY_SHARDS).map(name=>[name,[name]])),
  phone: ['phone-emulation'],
  touch: ['mobile', 'tilt'],
  stations: ['ramps', 'steps', 'seams', 'gaps', 'balance', 'bumps', 'air'],
};
function verificationPlan(mode = 'full') {
  if (mode === 'full') return Object.values(groups).flat();
  if (mode === 'deployment') return ['desktop', 'phone-emulation'];
  if (!Object.hasOwn(groups, mode)) throw Error(`Unknown verification mode: ${mode}`);
  return [...groups[mode]];
}
module.exports = {verificationPlan, DESKTOP_GAMEPLAY_CHECKS, GAMEPLAY_SHARDS, validateGameplayShards};
