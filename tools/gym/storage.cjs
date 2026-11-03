// #411: durable-save waits for the Gym runners. window.riderCustom.syncState() (main/game/custom.js) is
// 'syncing' while an IndexedDB sync is queued or running, 'saved' when the last sync completed, 'failed' when
// the initial restore or a sync failed, and 'session' when the page has no persistent storage at all.
// Only 'saved' proves the browser copy exists: a durable wait never accepts 'failed', and accepts 'session'
// only when the caller explicitly declares a non-durable mode ({session:true}).
const STATES = ['syncing', 'saved', 'failed', 'session'];

// Settled state -> the state, or an Error naming why the save is not durable.
function check(state, { session = false, label = 'durable save' } = {}) {
  if (state === 'saved') return state;
  if (state === 'session' && session) return state;
  if (state === 'failed') throw new Error(`${label}: browser storage sync failed (riderCustom.syncState() is 'failed'); the save is not durable`);
  if (state === 'session') throw new Error(`${label}: browser storage is session-only (riderCustom.syncState() is 'session'); a durable save needs 'saved'`);
  throw new Error(`${label}: unexpected riderCustom.syncState() ${JSON.stringify(state)}`);
}

// Waits on a Playwright Page or Frame until no sync is pending, then requires a durable state. 'failed' and
// 'session' end the wait at once, so they fail immediately instead of timing out.
async function durable(target, options = {}) {
  const wait = options.timeout === undefined ? undefined : { timeout: options.timeout };
  const handle = await target.waitForFunction(() => { const state = window.riderCustom.syncState(); return state !== 'syncing' && state; }, null, wait);
  return check(await handle.jsonValue(), options);
}

module.exports = { STATES, check, durable };
