const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {invalidateHostValidation, setup} = require('../../tools/ci/setup_playwright.cjs');

test('warm browser binaries must not reuse another runner host-validation marker', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rider-pw-'));
  try {
    for (const name of ['chromium-1248', 'chromium_headless_shell-1248', 'firefox-1']) {
      fs.mkdirSync(path.join(root, name));
      fs.writeFileSync(path.join(root, name, 'DEPENDENCIES_VALIDATED'), 'another host');
      fs.writeFileSync(path.join(root, name, 'browser'), 'keep');
    }
    invalidateHostValidation(path.join(root, 'chromium-1248', 'chrome-linux64', 'chrome'));
    for (const name of ['chromium-1248', 'chromium_headless_shell-1248']) {
      assert.equal(fs.existsSync(path.join(root, name, 'DEPENDENCIES_VALIDATED')), false);
      assert.equal(fs.readFileSync(path.join(root, name, 'browser'), 'utf8'), 'keep');
    }
    assert.equal(fs.existsSync(path.join(root, 'firefox-1', 'DEPENDENCIES_VALIDATED')), true);
    assert.throws(() => invalidateHostValidation(path.join(root, 'unknown', 'chrome')), /layout/);
    invalidateHostValidation(path.join(root, 'cold-cache', 'chromium-1248', 'chrome-linux64', 'chrome'));
  } finally { fs.rmSync(root, {recursive: true, force: true}); }
});

test('missing host libraries install dependencies once and must pass a second real probe', () => {
  for (const diagnostic of ['Host system is missing dependencies to run browsers.', 'error while loading shared libraries: libnss3.so']) {
    const calls = [], report = {fallback: false};
    setup((name, args) => {
      calls.push([name, args]);
      if (name === 'probe') throw Error(diagnostic);
    }, report);
    assert.deepEqual(calls.map(c => c[0]), ['install', 'probe', 'system-dependencies', 'probe-after-install']);
    assert.deepEqual(calls[2][1], ['install-deps', 'chromium']);
    assert.equal(report.fallback, true);
  }
});

test('healthy host avoids apt; install, unrelated launch, fallback install and second probe failures fail closed', () => {
  const calls = [];
  setup(name => calls.push(name), {});
  assert.deepEqual(calls, ['install', 'probe']);
  for (const failAt of ['install', 'probe', 'system-dependencies', 'probe-after-install']) {
    const names = [];
    assert.throws(() => setup(name => {
      names.push(name);
      if (name === failAt) throw Error('deliberate failure');
      if (name === 'probe') throw Error('Host system is missing dependencies');
    }, {}), /deliberate failure/);
    assert.equal(names.at(-1), failAt);
    if (failAt === 'probe') assert.deepEqual(names, ['install', 'probe']);
  }
});
