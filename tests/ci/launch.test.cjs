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
