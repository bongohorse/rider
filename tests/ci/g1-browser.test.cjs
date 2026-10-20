const {test} = require('node:test');
const assert = require('node:assert/strict');
const {headersFor, checkEngineLoad} = require('../../tools/g1/browser.cjs');

const pthread = {wasm: ['RiderG1_pthread.wasm'], cross_origin_isolated: true, shared_array_buffer: true, pthread_supported: true, heap_shared: true};
const players = {wasm: ['RiderG1.wasm'], cross_origin_isolated: false, shared_array_buffer: false, pthread_supported: false, heap_shared: false};

test('isolated mode keeps the exact COOP/COEP headers; players mode serves like GitHub Pages', () => {
  assert.deepEqual(Object.entries(headersFor('isolated', 'application/wasm')), [
    ['Content-Type', 'application/wasm'], ['Cross-Origin-Opener-Policy', 'same-origin'], ['Cross-Origin-Embedder-Policy', 'require-corp']]);
  assert.deepEqual(headersFor('players', 'text/html'), {'Content-Type': 'text/html'});
  assert.throws(() => headersFor('pages', 'text/html'), /Unknown G1 browser mode/);
});

test('each mode accepts only the engine it stands for', () => {
  assert.equal(checkEngineLoad('isolated', pthread).mode, 'isolated');
  assert.equal(checkEngineLoad('players', players).mode, 'players');
  assert.throws(() => checkEngineLoad('isolated', players), /Wrong engine for G1 browser mode "isolated": loaded \["RiderG1.wasm"\]/);
  assert.throws(() => checkEngineLoad('players', pthread), /Wrong engine for G1 browser mode "players": loaded \["RiderG1_pthread.wasm"\]/);
});

test('players mode fails when isolation or a shared heap appears', () => {
  assert.throws(() => checkEngineLoad('players', {...players, cross_origin_isolated: true}), /crossOriginIsolated is true, expected false/);
  assert.throws(() => checkEngineLoad('players', {...players, pthread_supported: true}), /isWASMPthreadSupported is true/);
  assert.throws(() => checkEngineLoad('players', {...players, shared_array_buffer: true, heap_shared: true}), /SharedArrayBuffer heap/);
  // Available but unused is allowed: the heap must not be shared.
  assert.equal(checkEngineLoad('players', {...players, shared_array_buffer: true}).mode, 'players');
});

test('a run must load exactly one engine', () => {
  assert.throws(() => checkEngineLoad('players', {...players, wasm: []}), /loaded \[\]/);
  assert.throws(() => checkEngineLoad('players', {...players, wasm: ['RiderG1.wasm', 'RiderG1.wasm']}), /expected exactly/);
  assert.throws(() => checkEngineLoad('isolated', {...pthread, wasm: ['RiderG1.wasm', 'RiderG1_pthread.wasm']}), /expected exactly/);
  assert.throws(() => checkEngineLoad('isolated', {...pthread, heap_shared: false}), /does not run on a SharedArrayBuffer heap/);
});
