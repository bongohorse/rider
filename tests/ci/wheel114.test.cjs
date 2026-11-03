// #114 stage 1: the wheel-size A/B statistics, Retry comparison and trace-integrity checks (pure, no browser).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const R = require('../../tools/gym/wheel114_report.cjs');

const sample = (resets, tick, o = {}) => ({resets, tick, dt: 1 / 60, x: tick * .1, y: 1, angle: 0, vx: 6, vy: 0, w1: -20, w2: -20,
  s1: true, s2: true, slip1: 0.01, slip2: -0.02, hull: false, ...o});
const run = (resets, n, o) => Array.from({length: n}, (_, i) => sample(resets, i + 1, typeof o === 'function' ? o(i + 1) : o));

test('cap is Box2D 3.1.0 B2_MAX_ROTATION per 1/60 s step', () => {
  assert.ok(Math.abs(R.CAP - 47.1238898038469) < 1e-12);
});

test('attempt keeps one contiguous window and refuses gaps, repeats, scaled ticks and short attempts', () => {
  const trace = [...run(0, 12), ...run(1, 12)];
  assert.equal(R.attempt(trace, 1, 10).length, 10);
  assert.deepEqual(R.attempt(trace, 0, 10).map(s => s.tick), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.throws(() => R.attempt(trace, 0, 13), /12 of 13/);
  assert.throws(() => R.attempt(trace.filter(s => !(s.resets === 0 && s.tick === 4)), 0, 10), /missing or repeated/);
  assert.throws(() => R.attempt([...run(0, 10), sample(0, 3)], 0, 11), /missing or repeated/);
  assert.throws(() => R.attempt(run(0, 10, t => t === 5 ? {dt: 1 / 120} : {}), 0, 10), /not 1\/60/);
});

test('stats: top speed, peak omega against the cap, ticks at the cap and slip of supported wheels only', () => {
  const list = run(0, 6, t => ({vx: t, vy: t === 6 ? 1 : 0, w1: t === 3 ? -R.CAP : -10, w2: t === 4 ? R.CAP - .005 : 5,
    s1: t !== 2, slip1: t === 2 ? 99 : -0.4, s2: t !== 5, slip2: t === 5 ? 99 : 0.8, hull: t === 6}));
  const s = R.stats(list, .22);
  assert.ok(Math.abs(s.top_speed_mps - Math.hypot(6, 1)) < 1e-12);
  assert.equal(s.top_speed_tick, 6);
  assert.equal(s.top_vx_mps, 6);
  assert.ok(Math.abs(s.peak_omega_rps - R.CAP) < 1e-12);
  assert.equal(s.ticks_at_cap, 2, 'within 0.01 rad/s of the cap counts');
  assert.ok(Math.abs(s.no_slip_ceiling_mps - R.CAP * .22) < 1e-12);
  assert.equal(s.supported_wheel_ticks, 10);
  assert.equal(s.max_slip_mps, 0.8, 'unsupported samples are ignored');
  assert.equal(s.slip_over_0_5_mps_ticks, 5);
  assert.equal(s.hull_contact_ticks, 1);
});

test('Retry comparison: identical, within A21 tolerances, diverged', () => {
  const a = run(1, 20);
  assert.deepEqual({...R.compare(a, run(2, 20)), ticks: 0}, {ticks: 0, max_position_delta_m: 0, max_angle_delta_rad: 0, max_vx_delta_mps: 0, max_omega_delta_rps: 0, identical: true, verdict: 'MATCH'});
  const near = R.compare(a, run(2, 20, t => ({x: t * .1 + (t === 7 ? .04 : 0)})));
  assert.equal(near.verdict, 'MATCH'); assert.equal(near.identical, false);
  assert.equal(R.compare(a, run(2, 20, t => ({x: t * .1 + (t === 7 ? .06 : 0)}))).verdict, 'DIVERGED');
  assert.equal(R.compare(a, run(2, 20, t => ({angle: t === 9 ? .051 : 0}))).verdict, 'DIVERGED');
  assert.throws(() => R.compare(a, run(2, 19)), /length/);
});

test('section uses the same window from the load and both Retry attempts', () => {
  const trace = [...run(0, 30), ...run(1, 25), ...run(2, 40)];
  const s = R.section({window: 20}, trace, [0, 1, 2], .26);
  assert.equal(s.attempts.length, 3);
  assert.ok(s.attempts.every(a => a.ticks === 20));
  assert.equal(s.determinism.retry_vs_retry.verdict, 'MATCH');
  assert.throws(() => R.section({window: 26}, trace, [0, 1, 2], .26), /25 of 26/);
});

test('markdown table needs the same sections, source and browser from every run', () => {
  const trace = [...run(0, 10), ...run(1, 10), ...run(2, 10)];
  const sec = {id: 'straight', protocol: 'p', outcome_rule: 'o', window: 10, outcomes: ['n/a', 'n/a', 'n/a'], ...R.section({window: 10}, trace, [0, 1, 2], .22)};
  const result = preset => ({preset, source_sha: 'abc', browser: 'b', run_id: preset, sections: [sec],
    geometry: {radius_u: 22, radius_m: .22, wheel_mass_kg: 4, wheel_inertia: .1, wheel_y_u: -30}});
  const md = R.markdown([result('a'), result('w26')]);
  assert.match(md, /A vs W26/);
  assert.match(md, /\| W26 \| 6\.00 \|/);
  assert.match(md, /MATCH \(identical\)/);
  assert.throws(() => R.markdown([result('a'), {...result('w26'), source_sha: 'other'}]), /different sources/);
  assert.throws(() => R.markdown([result('a'), {...result('w26'), sections: [{...sec, id: 'x'}]}]), /different sections/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wheel114-'));
  fs.writeFileSync(path.join(dir, 'wheel114-result.json'), JSON.stringify(result('a')));
  assert.equal(R.load(dir).preset, 'a');
});
