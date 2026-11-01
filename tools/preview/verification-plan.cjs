// Full remains the default for local callers. CI partitions the same assertions.
// Keep the seven release gameplay modules in one authoritative ordered inventory.
const DESKTOP_GAMEPLAY_CHECKS=Object.freeze([
  'check_run', 'check_gem_release', 'check_fuel_release', 'check_levels',
  'check_level_storage', 'check_objects', 'check_progress',
]);
const groups = {
  'desktop-layout': ['desktop'],
  'desktop-gameplay': ['desktop-gameplay'],
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
module.exports = {verificationPlan, DESKTOP_GAMEPLAY_CHECKS};
