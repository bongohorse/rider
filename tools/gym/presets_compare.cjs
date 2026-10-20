// Car Feel 2 (#200): run the measurement stations for a baseline preset (A) and one or more candidates on one
// verified debug Gym bundle and write presets-compare.{json,md} (baseline | candidate | delta).
// CLI: node tools/gym/presets_compare.cjs --bundle <gym-bundle> --output <dir> --candidates b[,c,...]
//        [--baseline a] [--stations ramps,steps,gaps,seams] [--tables-only]
// Each run is `smoke.py --case <case> --preset <key>`: the runner asserts per trial that the telemetry and the
// station report name that preset, unmodified and comparable (an unknown key silently falls back to A in the
// game, so it fails there). Keys are arguments, so presets added later need no change here. A candidate equal
// to the baseline (A vs A) is a repeat check against each runner's declared repeat tolerances.
const fs = require('node:fs'), path = require('node:path'), {spawnSync} = require('node:child_process');
const ROOT = path.resolve(__dirname, '../..');

const statuses = (list, label = r => r.section) => list.map(r => label(r) + ' ' + r.status[0]).join(', ');
const sum = list => list.reduce((a, b) => a + b, 0);
const find = (list, test, what) => { const r = list.find(test); if (!r) throw Error('Missing result: ' + what); return r; };

// One entry per station: smoke case, result file, declared repeat tolerances and the table rows.
// A row value is a number, string or boolean; `tol` is the runner's declared repeat tolerance (0: must match,
// null: none declared, the delta is reported only). Statuses are first letters (C climbed/cleared/completed, D done, F failed,
// L landed, S stuck/stalled, M missed).
const STATIONS = {
  ramps: {case: 'a16', file: 'ramps-result.json', tolerances: 'none declared; statuses must match', trials: r => r.results.length,
    rows(r) {
      const rows = [];
      for (const station of ['ramps', 'ramps-long']) {
        const up = r.results.filter(x => x.station === station && x.mode === 'up');
        rows.push({metric: station + ' highest climbed', unit: '°', tol: 0, value: find(r.summary, s => s.station === station, station).highest_climbed_degrees});
        rows.push({metric: station + ' per-angle status', tol: 0, value: statuses(up)});
      }
      for (const section of ['down-10', 'down-20', 'down-30'])
        rows.push({metric: 'descent ' + section + ' speed gain', unit: 'm/s', tol: null, value: find(r.results, x => x.section === section, section).speed_gain_mps});
      return rows;
    }},
  steps: {case: 'a17', file: 'steps-result.json', tolerances: 'compression 0.005 m, entry speed 0.02 m/s',
    trials: r => r.results.length + 3, // two stop probes and the peak repeat
    rows(r) {
      const rows = [{metric: 'highest climbed', unit: 'm', tol: 0, value: r.highest_climbed_m}];
      for (const station of ['steps', 'steps-down']) {
        const list = r.results.filter(x => x.station === station);
        rows.push({metric: station + ' status', tol: 0, value: statuses(list)});
        rows.push({metric: station + ' underbody contact', tol: 0, value: list.filter(x => x.underbody_contact).map(x => x.section).join(', ') || 'none'});
        for (const x of list) rows.push({metric: `${station} ${x.section} m compression`, unit: 'm', tol: .005, value: x.compression_m});
      }
      return rows;
    }},
  gaps: {case: 'a19', file: 'gaps-result.json', tolerances: 'jump 0.05 m, takeoff 0.02 m/s, compression 0.005 m',
    trials: r => r.results.length + r.repeats.length + 1, // plus the trial before the R retry
    rows(r) {
      const rows = [];
      for (const [speed, key] of [[7, 'default_7_mps'], [9, 'fast_9_mps']]) {
        const ladder = r.results.filter(x => x.station === 'gaps' && x.speed === speed);
        rows.push({metric: `widest cleared at ${speed} m/s`, unit: 'm', tol: 0, value: r.widest_cleared_m[key]});
        rows.push({metric: `${speed} m/s ladder status`, tol: 0, value: statuses(ladder)});
        rows.push({metric: `${speed} m/s takeoff speed`, unit: 'm/s', tol: .02, value: ladder[0].takeoff_speed_mps});
      }
      for (const x of r.results.filter(x => x.station === 'gaps-landing')) {
        const cleared = x.status === 'CLEARED';
        rows.push({metric: `landing ${x.section} status`, tol: 0, value: x.status});
        rows.push({metric: `landing ${x.section} touchdown vy`, unit: 'm/s', tol: null, value: cleared ? x.touchdown_vy_mps : null});
        rows.push({metric: `landing ${x.section} peak compression`, unit: 'm', tol: .005, value: cleared ? x.peak_compression_m : null});
        rows.push({metric: `landing ${x.section} landing angle`, unit: 'rad', tol: null, value: cleared ? x.landing_angle_rad : null});
      }
      return rows;
    }},
  seams: {case: 'a18', file: 'seams-result.json', tolerances: 'ghost bumps equal, 0.02 m/s speed loss per seam',
    trials: r => r.results.length + r.retries.length, // free-roll runs only; powered controls stay on preset A
    rows(r) {
      const rows = [];
      for (const x of r.results) {
        const name = `${x.station} ${x.nominal_mps} m/s`;
        rows.push({metric: name + ' comparable', tol: 0, value: x.comparable});
        rows.push({metric: name + ' ghost bumps', unit: 'of ' + x.seams.length, tol: 0, value: x.comparable ? x.ghost_bumps : null});
        // Sum of the per-seam losses; its tolerance is the sum of the declared per-seam tolerances.
        rows.push({metric: name + ' speed loss over the strip', unit: 'm/s', tol: .02 * x.seams.length, value: x.comparable ? sum(x.seams.map(s => s.vx_loss_mps)) : null});
        // The runner's declared tolerance holds per seam: the largest per-seam difference must stay within 0.02 m/s.
        rows.push({metric: name + ' per-seam speed loss', unit: 'm/s', tol: .02, value: x.comparable ? x.seams.map(s => s.vx_loss_mps) : null});
      }
      return rows;
    }},
  air: {case: 'a19c', file: 'air-result.json', tolerances: 'takeoff 0.02 m/s, airtime 0.034 s, rotation 5°, landing angle 5°, compression 0.005 m',
    trials: r => r.results.length + 1 + r.repeats.length + 1 + 1 + r.slow.length, // plain, repeats, R base, fast, slow
    rows(r) {
      const rows = [];
      for (const section of ['big', 'mid']) for (const lean of [0, 1, -1]) {
        const j = find(r.results, x => x.section === section && x.lean === lean, section + ' lean ' + lean), name = `${section} lean ${lean > 0 ? '+1 (back)' : lean < 0 ? '-1 (front)' : '0'}`;
        rows.push({metric: name + ' status', tol: 0, value: j.status});
        if (lean === 0) rows.push({metric: name + ' takeoff speed', unit: 'm/s', tol: .02, value: j.takeoff_speed_mps});
        rows.push({metric: name + ' airtime', unit: 's', tol: .034, value: j.airtime_s});
        rows.push({metric: name + ' rotation', unit: '°', tol: 5, value: j.rotation_deg});
        rows.push({metric: name + ' landing angle', unit: '°', tol: 5, value: j.landing_angle_deg});
        rows.push({metric: name + ' impact normal speed', unit: 'm/s', tol: null, value: j.impact_normal_mps});
      }
      return rows;
    }},
  bumps: {case: 'a19b', file: 'bumps-result.json', tolerances: 'contact-loss share 0.02, compression 0.005 m, pitch 0.01 rad, apex speed 0.02 m/s',
    // ladders, two fresh long-0.3 loads, the sweep, the repeats and two R retries
    trials: r => Object.values(r.ladders).flat().length + 1 + r.sweep.length + r.repeats.length + 3,
    rows(r) {
      const rows = [], speeds = Object.keys(r.ladders).sort((a, b) => a - b);
      for (const speed of speeds) rows.push({metric: `${speed} m/s section status`, tol: 0, value: statuses(r.ladders[speed], x => x.id)});
      for (const speed of speeds) for (const x of r.ladders[speed]) for (const f of x.features.filter(f => f.type === 'waves'))
        rows.push({metric: `${speed} m/s ${x.id} wheel contact lost (any)`, unit: 'share', tol: .02, value: f.loss_share_any});
      for (const x of r.ladders[speeds[0]]) for (const f of x.features.filter(f => f.type === 'waves'))
        rows.push({metric: `${speeds[0]} m/s ${x.id} peak compression`, unit: 'm', tol: .005, value: f.compression_max_m});
      for (const [id, l] of Object.entries(r.liftoff)) {
        rows.push({metric: `${id} lowest apex speed with lift-off`, unit: 'm/s', tol: .02, value: l.bracketed ? l.lowest_apex_with_mps : 'not bracketed'});
        rows.push({metric: `${id} highest apex speed without lift-off`, unit: 'm/s', tol: .02, value: l.bracketed ? l.highest_apex_without_mps : 'not bracketed'});
      }
      return rows;
    }},
  balance: {case: 'a19d', file: 'balance-result.json', tolerances: 'stop x 0.05 m, time 0.1 s, tip/settle time 0.05 s, angles 0.01 rad',
    trials: r => Object.keys(r.skill).length * 3 + 3, // skill, replay, full per section; two seesaw repeats and one after mid-tip R
    rows(r) {
      const sections = Object.keys(r.skill), letters = list => sections.map(s => s + ' ' + list[s].status[0]).join(', ');
      const rows = [{metric: 'skill driver status', tol: 0, value: letters(r.skill)}];
      for (const s of sections) rows.push({metric: `skill ${s} time`, unit: 's', tol: .1, value: r.skill[s].time_s});
      rows.push({metric: 'full throttle status', tol: 0, value: letters(r.full)});
      const seesaw = r.seesaw.repeats[0];
      for (const [key, unit, tol] of [['tip_at', 's', .05], ['settled_at', 's', .05], ['settled_angle', 'rad', .01]])
        rows.push({metric: 'seesaw ' + key.replace('_', ' '), unit, tol, value: seesaw[key]});
      return rows;
    }},
};
// Stations whose runners are not merged yet; adding one is one STATIONS entry plus its smoke.py PRESET_CASES entry.
const PENDING = {};
const FOLLOW_UPS = [
  ...Object.entries(PENDING).map(([name, issue]) => `${name}: add a STATIONS entry once ${issue} merges`),
  'throttle 0 to 5 m/s time and braking distance from 7 m/s: telemetry samples every 0.25 s and the straight station records no brake entry speed, so both need a small game-side read',
];

function parse(argv) {
  const o = {baseline: 'a', stations: Object.keys(STATIONS), tablesOnly: false};
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i].split(/=(.*)/s), value = () => inline ?? argv[++i];
    if (flag === '--bundle') o.bundle = value();
    else if (flag === '--output') o.output = value();
    else if (flag === '--baseline') o.baseline = value();
    else if (flag === '--candidates') o.candidates = value().split(',');
    else if (flag === '--stations') o.stations = value().split(',');
    else if (flag === '--tables-only') o.tablesOnly = true;
    else throw Error('Unknown argument: ' + argv[i]);
  }
  if (!o.output || !o.candidates?.length || (!o.bundle && !o.tablesOnly)) throw Error('Usage: presets_compare.cjs --bundle <dir> --output <dir> --candidates b[,c] [--baseline a] [--stations ' + Object.keys(STATIONS).join(',') + '] [--tables-only]');
  for (const key of [o.baseline, ...o.candidates]) if (!/^[a-z0-9]{1,16}$/.test(key)) throw Error('Invalid preset key: ' + key);
  for (const name of o.stations) if (!STATIONS[name]) throw Error(`Unknown station ${name}${PENDING[name] ? ': runner not merged yet, ' + PENDING[name] : ''}`);
  return o;
}

// Runs in order: baseline first, then every candidate (the baseline again for a repeat check).
const runsOf = o => [o.baseline, ...o.candidates].map((key, i) => ({key, label: `${i}-${key}`}));
const STATUS_FILE = 'compare-run.json';

// A failing run does not stop the others: its exit code is recorded next to its output and shown in the tables.
function measure(o) {
  const python = process.env.PYTHON || 'python';
  for (const run of runsOf(o)) for (const name of o.stations) {
    const station = STATIONS[name], out = path.join(o.output, 'runs', run.label, name);
    console.log(`presets_compare: ${name} with preset ${run.key} -> ${out}`);
    fs.rmSync(out, {recursive: true, force: true});
    const r = spawnSync(python, [path.join(ROOT, 'tools/gym/smoke.py'), '--bundle', o.bundle, '--output', out, '--case', station.case, '--preset', run.key], {cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit']});
    fs.mkdirSync(out, {recursive: true});
    fs.writeFileSync(path.join(out, STATUS_FILE), JSON.stringify({status: r.status === 0 ? 'PASS' : 'FAIL', exit: r.status ?? r.signal}));
    if (r.status !== 0) console.error(`presets_compare: ${name} with preset ${run.key} FAILED (exit ${r.status ?? r.signal}); see ${out}`);
  }
}

// A station result, or {failed} with the reason: failed run, missing result, wrong preset or wrong check count.
function loadOne(dir, name, key) {
  const marker = path.join(dir, STATUS_FILE), file = path.join(dir, STATIONS[name].file);
  const status = fs.existsSync(marker) ? JSON.parse(fs.readFileSync(marker, 'utf8')) : null;
  if (status?.status === 'FAIL') return {failed: {status: 'FAIL', exit: status.exit, out: dir}};
  if (!fs.existsSync(file)) return {failed: {status: 'FAIL', exit: null, out: dir, reason: 'no result file'}};
  const result = JSON.parse(fs.readFileSync(file, 'utf8')), expected = STATIONS[name].trials(result);
  if (result.status !== 'PASS' || result.preset !== key) return {failed: {status: 'FAIL', out: dir, reason: `not a passing ${key} run`}};
  if (result.preset_checks !== expected) return {failed: {status: 'FAIL', out: dir, reason: `${result.preset_checks} preset checks, expected ${expected}`}};
  return result;
}
const load = o => runsOf(o).map(run => ({...run, stations: Object.fromEntries(o.stations.map(name => [name, loadOne(path.join(o.output, 'runs', run.label, name), name, run.key)]))}));

// The tuning a run actually measured with, from its station reports (all stations must agree).
function tuningOf(run) {
  const merged = {};
  for (const [name, s] of Object.entries(run.stations)) if (!s.failed) for (const [k, v] of Object.entries(s.tuning || {})) {
    if (k in merged && merged[k] !== v) throw Error(`${run.label}: ${name} measured ${k}=${v}, another station ${merged[k]}`);
    merged[k] = v;
  }
  return merged;
}

// Builds the comparison from loaded runs: runs[0] is the baseline.
function compare(runs) {
  const passed = runs.flatMap(r => Object.values(r.stations).filter(s => !s.failed));
  const shas = new Set(passed.map(s => s.source_sha)), browsers = new Set(passed.map(s => s.browser));
  if (shas.size > 1) throw Error('Runs come from different sources: ' + [...shas].join(', '));
  if (browsers.size > 1) throw Error('Runs come from different browsers: ' + [...browsers].join(', '));
  const names = Object.keys(runs[0].stations), base = runs[0];
  const stations = names.map(name => {
    const perRun = runs.map(run => run.stations[name].failed ? null : STATIONS[name].rows(run.stations[name]));
    const template = perRun.find(Boolean) || [];
    if (perRun.some(list => list && list.length !== template.length)) throw Error(name + ': runs have different rows');
    const failed = runs.map(run => run.stations[name].failed || null);
    const rows = template.map((row, i) => {
      for (const other of perRun) if (other && other[i].metric !== row.metric) throw Error(`${name}: rows differ between runs at ${row.metric}`);
      const values = perRun.map(list => list ? list[i].value : 'FAIL');
      const deltas = values.slice(1).map(v => values[0] === 'FAIL' || v === 'FAIL' ? 'n/a' : delta(values[0], v));
      const within = values.slice(1).map(v => values[0] === 'FAIL' || v === 'FAIL' ? null : withinTolerance(values[0], v, row.tol));
      return {metric: row.metric, unit: row.unit || '', tolerance: row.tol, values, deltas, within};
    });
    return {station: name, case: STATIONS[name].case, declared_tolerances: STATIONS[name].tolerances, failed, rows};
  });
  const failures = stations.flatMap(s => s.failed.map((f, k) => f && {station: s.station, run: runs[k].label, ...f}).filter(Boolean));
  // A candidate equal to the baseline is a repeat run: every row with a declared tolerance must hold.
  const repeats = runs.slice(1).map((run, j) => run.key !== base.key ? null : {
    run: run.label, status: stations.every(s => !s.failed[0] && !s.failed[j + 1] && s.rows.every(r => r.within[j] !== false)) ? 'PASS' : 'FAIL',
    outside: stations.flatMap(s => s.rows.filter(r => r.within[j] === false).map(r => `${s.station}: ${r.metric}`)),
    undeclared_max_delta: Math.max(0, ...stations.flatMap(s => s.rows.filter(r => r.tolerance === null && typeof r.deltas[j] === 'number').map(r => Math.abs(r.deltas[j]))))
  }).filter(Boolean);
  const tuning = runs.map(tuningOf), keys = [...new Set(tuning.flatMap(Object.keys))];
  const tuningRows = keys.filter(k => tuning.some(t => t[k] !== tuning[0][k])).map(k => ({key: k, values: tuning.map(t => t[k] ?? null)}));
  return {status: !failures.length && repeats.every(r => r.status === 'PASS') ? 'PASS' : 'FAIL', source_sha: [...shas][0] ?? null, baseline: base.key,
    runs: runs.map(r => ({key: r.key, label: r.label, preset_checks: Object.fromEntries(Object.entries(r.stations).map(([n, s]) => [n, s.failed ? null : s.preset_checks])), run_ids: Object.fromEntries(Object.entries(r.stations).map(([n, s]) => [n, s.failed ? null : s.run_id]))})),
    browser: [...browsers][0] ?? null, tuning: tuningRows, stations, failures, repeats, follow_ups: FOLLOW_UPS, real_device: 'NOT RUN'};
}

// Arrays are per-element series (e.g. per-seam losses): the delta is the largest element difference.
function delta(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length ? Math.max(0, ...a.map((x, i) => Math.abs(b[i] - x))) : 'changed';
  if (typeof a === 'number' && typeof b === 'number') return b - a;
  return a === b ? 'same' : 'changed';
}
function withinTolerance(a, b, tol) {
  if (tol === null || tol === undefined) return typeof a === typeof b ? null : false;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => Math.abs(b[i] - x) <= tol + 1e-12);
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(b - a) <= tol + 1e-12;
  return a === b;
}

const num = v => Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/^-(0\.0+)$/, '$1');
const fmt = v => v === null || v === undefined ? '–' : Array.isArray(v) ? `max ${num(Math.max(...v))}` : typeof v === 'number' ? num(v) : String(v);
const fmtDelta = (d, outside, series) => {
  const text = series && typeof d === 'number' ? `max Δ ${num(d)}` : typeof d === 'number' ? (d === 0 ? '0' : (d > 0 ? '+' : '') + num(d)) : d === 'same' ? '=' : d === 'n/a' ? 'n/a' : '≠';
  return outside ? text + ' (outside tolerance)' : text;
};

function markdown(c) {
  const labels = c.runs.map((r, i) => i === 0 ? r.key.toUpperCase() : r.key === c.baseline ? r.key.toUpperCase() + ' (repeat)' : r.key.toUpperCase());
  const head = ['Metric', labels[0], ...labels.slice(1).flatMap(l => [l, 'Δ ' + l])];
  const table = (header, rows) => ['| ' + header.join(' | ') + ' |', '|' + header.map(() => ' --- ').join('|') + '|', ...rows.map(r => '| ' + r.join(' | ') + ' |')].join('\n');
  const out = [`# Preset comparison: ${labels.join(' vs ')}`, '',
    `Source \`${c.source_sha}\`, ${c.browser}, one debug Gym bundle; synthetic desktop runs, not device evidence (real device: ${c.real_device}). Status: **${c.status}**.`, '',
    'Every trial asserted its preset in telemetry and the station report, unmodified and comparable (seams: the station\'s own `comparable` is a measurement and shown as a row). Statuses: C climbed/cleared/completed, D done, F failed, L landed, S stuck/stalled, M missed. Δ is candidate − baseline. Tuning: values the station reports measured with.', ''];
  if (c.failures.length) out.push('## Failed runs', '', table(['Station', 'Run', 'Exit', 'Reason', 'Output'], c.failures.map(f => [f.station, f.run, fmt(f.exit), f.reason || 'runner failed', '`' + f.out + '`'])), '');
  if (c.tuning.length) out.push('## Tuning', '', table(['Key', ...labels], c.tuning.map(t => [t.key, ...t.values.map(fmt)])), '');
  for (const s of c.stations) {
    out.push(`## ${s.station} (\`${s.case}\`)`, '', `Declared repeat tolerances: ${s.declared_tolerances}.`, '');
    const failed = s.failed.map((f, k) => f && labels[k]).filter(Boolean);
    if (failed.length) out.push(`**FAILED run(s): ${failed.join(', ')}** (see Failed runs); their cells read FAIL.`, '');
    if (s.rows.length) out.push(table(head, s.rows.map(r => [r.metric + (r.unit ? ` (${r.unit})` : ''), fmt(r.values[0]), ...r.values.slice(1).flatMap((v, j) => [fmt(v), fmtDelta(r.deltas[j], c.runs[j + 1].key === c.baseline && r.within[j] === false, Array.isArray(r.values[0]))])])), '');
  }
  for (const r of c.repeats) out.push(`Repeat check ${r.run}: **${r.status}**${r.outside.length ? ' – outside: ' + r.outside.join('; ') : ''}; largest delta without a declared tolerance: ${fmt(r.undeclared_max_delta)}.`, '');
  out.push('## Follow-ups', '', ...c.follow_ups.map(f => '- ' + f), '');
  return out.join('\n');
}

// Always writes the tables (failed runs included), then exits non-zero if any run failed or a repeat broke.
function main(argv) {
  const o = parse(argv);
  if (!o.tablesOnly) measure(o);
  const c = compare(load(o));
  fs.writeFileSync(path.join(o.output, 'presets-compare.json'), JSON.stringify(c, null, 2));
  fs.writeFileSync(path.join(o.output, 'presets-compare.md'), markdown(c));
  console.log(markdown(c));
  if (c.status !== 'PASS') throw Error(`Comparison FAIL: ${c.failures.length} failed run(s)` + c.repeats.filter(r => r.status !== 'PASS').map(r => `; repeat ${r.run} outside: ${r.outside.join('; ')}`).join(''));
}

module.exports = {STATIONS, PENDING, parse, compare, markdown, loadOne};
if (require.main === module) try { main(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exitCode = 1; }
