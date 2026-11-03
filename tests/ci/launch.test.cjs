const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {inject} = require('../../tools/gym/launch.cjs');

test('each launch passes its own engine arguments before startup, preserving existing flags', () => {
  for (const [runId, testcase] of [['first-run', 'a15'], ['second-run', 'a17']]) {
    const html = inject('<script id="engine-start">start();</script>', runId, testcase);
    const context = {CUSTOM_PARAMETERS: {engine_arguments: ['--config=display.high_dpi=1']}};
    context.start = () => assert.deepEqual(Array.from(context.CUSTOM_PARAMETERS.engine_arguments), [
      '--config=display.high_dpi=1', '--config=rider.run_id=' + runId, '--config=rider.gym_test=' + testcase
    ]);
    for (const [, script] of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) vm.runInNewContext(script, context);
  }
});

test('unknown template or unsafe launch input fails closed', () => {
  assert.throws(() => inject('<html></html>', 'run', 'a15'), /marker/);
  assert.throws(() => inject('<script id="engine-start">'.repeat(2), 'run', 'a15'), /marker/);
  assert.throws(() => inject('<script id="engine-start">', '</script>', 'a15'), /identity/);
});

// #221: the index GET retries only connection resets (one log line each); a failure aborts the route instead of
// crashing the runner with an unhandled rejection.
const {handler, FETCH_RETRIES} = require('../../tools/gym/launch.cjs');
const page = '<script id="engine-start">start();</script>';
const URL = 'http://127.0.0.1:1/index.html?station=steps&section=0.2&speed=3';
function fakeRoute(results, method = 'GET') {
  const calls = {fetch: 0, fulfill: [], abort: []};
  return {calls, route: {
    request: () => ({url: () => URL, method: () => method}),
    fetch: async () => { const r = results[Math.min(calls.fetch++, results.length - 1)]; if (r instanceof Error) throw r; return r; },
    fulfill: async options => { calls.fulfill.push(options); },
    abort: async code => { calls.abort.push(code); },
  }};
}
const response = (status, text) => ({ok: () => status === 200, status: () => status, text: async () => text});
const reset = () => Object.assign(Error('route.fetch: read ECONNRESET\nCall log: ...'), {code: 'ECONNRESET'});
const run = async (results, method) => {
  const logged = [], waits = [];
  const {calls, route} = fakeRoute(results, method);
  await handler('run-1', 'a17', m => logged.push(m), async ms => { waits.push(ms); })(route);
  return {calls, logged, waits};
};

test('a clean index fetch is fulfilled once with the launch identity and no retry', async () => {
  const {calls, logged} = await run([response(200, page)]);
  assert.equal(calls.fetch, 1);assert.equal(calls.abort.length, 0);assert.deepEqual(logged, []);
  assert.equal(calls.fulfill.length, 1);assert.match(calls.fulfill[0].body, /rider\.gym_test=a17/);
});

test('connection resets are retried up to three times, each logged with the URL and attempt', async () => {
  assert.equal(FETCH_RETRIES, 3);
  const {calls, logged, waits} = await run([reset(), reset(), response(200, page)]);
  assert.equal(calls.fetch, 3);assert.equal(calls.fulfill.length, 1);assert.equal(calls.abort.length, 0);
  assert.deepEqual(logged, [1, 2].map(n => `Gym index fetch ECONNRESET, retry ${n}/3: ${URL}`));
  assert.deepEqual(waits, [250, 500]);
});

test('other errors, a bad status or a reset beyond the retries abort the route instead of throwing', async () => {
  for (const [results, fetches, message] of [
    [[reset()], 4, 'route.fetch: read ECONNRESET'],
    [[Object.assign(Error('route.fetch: connect ECONNREFUSED'), {code: 'ECONNREFUSED'})], 1, 'route.fetch: connect ECONNREFUSED'],
    [[response(404, '')], 1, 'Gym index request failed: 404'],
  ]) {
    const {calls, logged} = await run(results);
    assert.equal(calls.fetch, fetches);assert.deepEqual(calls.abort, ['failed']);assert.equal(calls.fulfill.length, 0);
    assert.equal(logged.at(-1), 'Gym index request failed: ' + message);
  }
});

test('only a GET is retried', async () => {
  const {calls, logged} = await run([reset(), response(200, page)], 'POST');
  assert.equal(calls.fetch, 1);assert.deepEqual(calls.abort, ['failed']);
  assert.deepEqual(logged, ['Gym index request failed: route.fetch: read ECONNRESET']);
});

// #356: optional startup override is only for the isolated debug FPS matrix.
// All existing callers must retain exactly their previous launch arguments.
test('FPS356 startup override is injected before engine start for 0, 30 and 60', () => {
  for (const hz of [0, 30, 60]) {
    const html = inject('<script id="engine-start">start();</script>', 'fps356-run', 'fps356', hz);
    const context = {CUSTOM_PARAMETERS: {engine_arguments: ['--config=display.high_dpi=1']}};
    context.start = () => assert.deepEqual(Array.from(context.CUSTOM_PARAMETERS.engine_arguments), [
      '--config=display.high_dpi=1', '--config=rider.run_id=fps356-run',
      '--config=rider.gym_test=fps356', '--config=display.update_frequency=' + hz
    ]);
    for (const [, script] of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) vm.runInNewContext(script, context);
  }
});

test('FPS356 startup override rejects unsupported rates and unsafe types', () => {
  for (const value of [-1, 15, 90, 120, 144, '30', NaN, Infinity, undefined]) {
    if (value === undefined) continue; // omitted is the backward-compatible default
    assert.throws(() => inject('<script id="engine-start">', 'run', 'fps356', value), /Unsupported debug startup/);
  }
});

test('FPS356 handler applies startup override without changing normal launch behavior', async () => {
  const {calls, route} = fakeRoute([response(200, page)]);
  await handler('fps356-run', 'fps356', () => {}, async () => {}, 30)(route);
  assert.equal(calls.fetch, 1);
  assert.match(calls.fulfill[0].body, /--config=display.update_frequency=30/);
  const normal = await run([response(200, page)]);
  assert.doesNotMatch(normal.calls.fulfill[0].body, /--config=display.update_frequency=/);
});
