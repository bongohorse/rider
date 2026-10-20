// Full remains the default for local callers. CI partitions the same assertions.
const groups = {
  desktop: ['desktop'],
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
module.exports = {verificationPlan};
