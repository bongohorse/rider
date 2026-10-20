const {test} = require('node:test');
const assert = require('node:assert/strict');
const preset = require('../../tools/gym/preset.cjs');
const cmp = require('../../tools/gym/presets_compare.cjs');

test('without --preset a runner keeps its arguments, URLs and assertions', async () => {
  const argv = ['node', 'ramps.cjs', 'out', 'sha', 'run', 'a16', 'bundle'];
  const p = preset.fromArgv(argv);
  assert.deepEqual(argv, ['node', 'ramps.cjs', 'out', 'sha', 'run', 'a16', 'bundle']);
  assert.equal(p.key, 'a'); assert.equal(p.query, ''); assert.deepEqual(p.report(), {});
  await p.check({evaluate: () => { throw Error('default runs never read the preset'); }});
});

test('--preset is removed from argv so positional arguments keep their indices', () => {
  for (const tail of [['--preset', 'b'], ['--preset=b']]) {
    const argv = ['node', 'gaps.cjs', 'out', 'sha', 'run', 'a19', 'bundle', ...tail];
    const p = preset.fromArgv(argv);
    assert.equal(argv[6], 'bundle'); assert.equal(argv.length, 7);
    assert.equal(p.query, '&preset=b'); assert.deepEqual(p.report(), {preset: 'b', preset_checks: 0, tuning: null});
  }
  const explicitA = preset.fromArgv(['node', 'x', '--preset', 'a']);
  assert.equal(explicitA.query, '&preset=a');
  for (const bad of [['--preset'], ['--preset', 'B'], ['--preset', 'b&x=1'], ['--preset', 'b', '--preset', 'c']])
    assert.throws(() => preset.fromArgv(['node', 'x', ...bad]));
});

function page(t, r) { return {evaluate: async () => ({t, r})}; }
const report = (extra = {}) => ({kind: 'steps', preset: 'b', modified: false, comparable: true, time_comparable: true, ...extra});

test('each trial must report the requested preset, unmodified and comparable', async () => {
  const p = preset.option('b');
  await p.check(page({preset: 'b', modified: false}, report()));
  await p.check(page({preset: 'b', modified: false}, {kind: 'ramps', preset: 'b', modified: false, time_comparable: true}));
  assert.equal(p.checks, 2);
  // An unknown key falls back to A in the game (feel.lua): the telemetry check rejects it.
  await assert.rejects(p.check(page({preset: 'a', modified: false}, report({preset: 'a'}))), /telemetry preset/);
  await assert.rejects(p.check(page({preset: 'b', modified: true}, report())), /not modified/);
  await assert.rejects(p.check(page({preset: 'b', modified: false}, report({preset: 'a'}))), /station report preset/);
  await assert.rejects(p.check(page({preset: 'b', modified: false}, report({comparable: false}))), /comparable/);
  await assert.rejects(p.check(page({preset: 'b', modified: false}, report({time_comparable: false}))), /comparable/);
  // Ramps reports carry no comparable flag: they must be unmodified and time-comparable instead.
  await assert.rejects(p.check(page({preset: 'b', modified: false}, {kind: 'ramps', preset: 'b', modified: false})), /comparable/);
  assert.equal(p.checks, 2);
});

test('a seams free-roll run may measure comparable=false, but never at another time factor', async () => {
  const p = preset.option('b'), seams = extra => ({kind: 'seams', preset: 'b', comparable: false, time_comparable: true, ...extra});
  await p.check(page({preset: 'b', modified: false}, seams()));
  await assert.rejects(p.check(page({preset: 'b', modified: false}, seams({time_comparable: false}))), /comparable/);
  assert.equal(p.checks, 1);
});

test('the run records the tuning its trials measured with and rejects a change between trials', async () => {
  const p = preset.option('b');
  await p.check(page({preset: 'b', modified: false}, report({tuning_at_start: {spring_hz: 6, damping: .9}})));
  await p.check(page({preset: 'b', modified: false}, {kind: 'ramps', preset: 'b', modified: false, time_comparable: true, tuning: {spring_hz: 6}}));
  assert.deepEqual(p.report(), {preset: 'b', preset_checks: 2, tuning: {spring_hz: 6, damping: .9}});
  await assert.rejects(p.check(page({preset: 'b', modified: false}, report({tuning_at_start: {spring_hz: 5}}))), /tuning spring_hz changed/);
});

const tuning = {a: {spring_hz: 5, damping: .8}, b: {spring_hz: 6, damping: .8}};
function run(key, label, steps) {
  return {key, label, stations: {steps: {status: 'PASS', preset: key, preset_checks: 5, source_sha: 'abc', run_id: label, browser: 'chromium', tuning: tuning[key], ...steps}}};
}
const stepResults = (compression, status = 'CLIMBED') => ({highest_climbed_m: .15, results: [
  {station: 'steps', section: '0.1', status, compression_m: compression, underbody_contact: false},
  {station: 'steps-down', section: '0.1', status: 'LANDED', compression_m: .05, underbody_contact: true}]});

test('A vs A passes only within the declared repeat tolerances', () => {
  const ok = cmp.compare([run('a', '0-a', stepResults(.1)), run('a', '1-a', stepResults(.104))]);
  assert.equal(ok.status, 'PASS'); assert.equal(ok.repeats[0].status, 'PASS'); assert.deepEqual(ok.tuning, []);
  const outside = cmp.compare([run('a', '0-a', stepResults(.1)), run('a', '1-a', stepResults(.106))]);
  assert.equal(outside.status, 'FAIL'); assert.deepEqual(outside.repeats[0].outside, ['steps: steps 0.1 m compression']);
  const status = cmp.compare([run('a', '0-a', stepResults(.1)), run('a', '1-a', stepResults(.1, 'STUCK'))]);
  assert.deepEqual(status.repeats[0].outside, ['steps: steps status']);
  assert.match(cmp.markdown(outside), /\+0\.006 \(outside tolerance\)/);
});

test('A vs candidate tables every metric with its delta and the tuning difference', () => {
  const c = cmp.compare([run('a', '0-a', stepResults(.1)), run('b', '1-b', stepResults(.08, 'STUCK'))]);
  assert.equal(c.status, 'PASS'); assert.deepEqual(c.repeats, []);
  assert.deepEqual(c.tuning, [{key: 'spring_hz', values: [5, 6]}]);
  const rows = Object.fromEntries(c.stations[0].rows.map(r => [r.metric, r]));
  assert.deepEqual(rows['steps status'].values, ['0.1 C', '0.1 S']); assert.equal(rows['steps status'].deltas[0], 'changed');
  assert(Math.abs(rows['steps 0.1 m compression'].deltas[0] + .02) < 1e-12);
  assert.equal(rows['steps-down underbody contact'].values[0], '0.1');
  const md = cmp.markdown(c);
  assert.match(md, /\| Metric \| A \| B \| Δ B \|/); assert.match(md, /\| spring_hz \| 5 \| 6 \|/); assert.doesNotMatch(md, /outside tolerance/);
});

test('runs from another source, without preset checks or for unknown stations are rejected', () => {
  const other = run('b', '1-b', stepResults(.1)); other.stations.steps.source_sha = 'def';
  assert.throws(() => cmp.compare([run('a', '0-a', stepResults(.1)), other]), /different sources/);
  const browser = run('b', '1-b', stepResults(.1)); browser.stations.steps.browser = 'other';
  assert.throws(() => cmp.compare([run('a', '0-a', stepResults(.1)), browser]), /different browsers/);
  assert.throws(() => cmp.parse(['--output', 'o', '--bundle', 'b', '--candidates', 'b', '--stations', 'jumps']), /Unknown station/);
  assert.throws(() => cmp.parse(['--output', 'o', '--bundle', 'b', '--candidates', 'B']), /Invalid preset key/);
  assert.throws(() => cmp.parse(['--output', 'o', '--bundle', 'b']), /Usage/);
  assert.deepEqual(cmp.parse(['--output', 'o', '--bundle', 'b', '--candidates', 'd,e']).candidates, ['d', 'e']);
});

test('a failed run becomes FAIL cells and a failed comparison, the other runs keep their tables', () => {
  const failed = {key: 'b', label: '1-b', stations: {steps: {failed: {status: 'FAIL', exit: 1, out: 'runs/1-b/steps'}}}};
  const c = cmp.compare([run('a', '0-a', stepResults(.1)), failed]);
  assert.equal(c.status, 'FAIL'); assert.deepEqual(c.failures, [{station: 'steps', run: '1-b', status: 'FAIL', exit: 1, out: 'runs/1-b/steps'}]);
  const row = c.stations[0].rows.find(r => r.metric === 'steps status');
  assert.deepEqual(row.values, ['0.1 C', 'FAIL']); assert.deepEqual(row.deltas, ['n/a']);
  const md = cmp.markdown(c);
  assert.match(md, /## Failed runs/); assert.match(md, /\*\*FAILED run\(s\): B\*\*/);
  // A failed repeat run fails the repeat check.
  const again = cmp.compare([run('a', '0-a', stepResults(.1)), {...failed, key: 'a', label: '1-a'}]);
  assert.equal(again.repeats[0].status, 'FAIL');
});

test('series rows (per-seam losses) hold the declared tolerance per element, not only in sum', () => {
  const seams = (key, label, losses) => ({key, label, stations: {seams: {status: 'PASS', preset: key, source_sha: 'abc', browser: 'chromium', run_id: label,
    results: [{station: 'seams-hull', nominal_mps: 5, comparable: true, ghost_bumps: 2, seams: losses.map(v => ({vx_loss_mps: v}))}]}}});
  const ok = cmp.compare([seams('a', '0-a', [.1, .2]), seams('a', '1-a', [.115, .19])]);
  assert.equal(ok.repeats[0].status, 'PASS');
  // The sum moves by 0.01 (inside 2 x 0.02), but one seam by 0.03: outside the per-seam tolerance.
  const bad = cmp.compare([seams('a', '0-a', [.1, .2]), seams('a', '1-a', [.13, .18])]);
  assert.deepEqual(bad.repeats[0].outside, ['seams: seams-hull 5 m/s per-seam speed loss']);
  assert.match(cmp.markdown(bad), /max Δ 0\.030 \(outside tolerance\)/);
});

test('a result needs the expected number of per-trial preset checks', () => {
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'presets-'));
  const write = (checks, status = 'PASS') => fs.writeFileSync(path.join(dir, 'steps-result.json'), JSON.stringify({status, preset: 'b', preset_checks: checks, results: [{}, {}]}));
  write(5); assert.equal(cmp.loadOne(dir, 'steps', 'b').preset_checks, 5);
  write(4); assert.match(cmp.loadOne(dir, 'steps', 'b').failed.reason, /4 preset checks, expected 5/);
  assert.match(cmp.loadOne(dir, 'steps', 'c').failed.reason, /not a passing c run/);
  fs.writeFileSync(path.join(dir, 'compare-run.json'), JSON.stringify({status: 'FAIL', exit: 1}));
  assert.equal(cmp.loadOne(dir, 'steps', 'b').failed.exit, 1);
  fs.rmSync(dir, {recursive: true});
});
