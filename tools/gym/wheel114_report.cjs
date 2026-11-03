// #114 stage 1: pure statistics and tables for the wheel-size A/B (runner: wheel114.cjs). Report only: no
// thresholds decide PASS/FAIL here except trace integrity (contiguous fixed ticks at 1/60 s, full window).
// CLI: node tools/gym/wheel114_report.cjs --output <dir> <result-dir-or-json>... (first = baseline, usually A)
const fs = require('node:fs'), path = require('node:path');

// Box2D 3.1.0 B2_MAX_ROTATION = 0.25 pi per full step, at the fixed 1/60 s step (engine pitfall 6).
const CAP = 0.25 * Math.PI * 60;
// A tick counts as "at the cap" within this margin (the A18 seam protocol's rotation margin).
const NEAR = 0.01;
// Declared before running: Retry repeats are compared with the A21 replay tolerances (chassis pose per tick).
const TOLERANCE = {position_m: 0.05, angle_rad: 0.05};

// Samples of one attempt (same reset count), in tick order; throws on a gap, a repeat or a scaled tick.
function attempt(trace, resets, window) {
  const list = trace.filter(s => s.resets === resets).sort((a, b) => a.tick - b.tick);
  if (list.length < window) throw Error(`attempt ${resets}: ${list.length} of ${window} fixed ticks`);
  const used = list.slice(0, window);
  used.forEach((s, i) => {
    if (s.tick !== i + 1) throw Error(`attempt ${resets}: tick ${s.tick} at position ${i + 1} (missing or repeated fixed tick)`);
    if (Math.abs(s.dt * 60 - 1) > 1e-4) throw Error(`attempt ${resets}: tick ${s.tick} dt ${s.dt} is not 1/60 s`);
  });
  return used;
}

const max = list => list.length ? Math.max(...list) : null;
const mean = list => list.length ? list.reduce((a, b) => a + b, 0) / list.length : null;

// Speeds in m/s, angular speeds in rad/s; slip = contact-point tangential speed of a supported wheel.
function stats(samples, radius) {
  const omega = samples.map(s => Math.max(Math.abs(s.w1), Math.abs(s.w2)));
  const slips = samples.flatMap(s => [s.s1 ? Math.abs(s.slip1) : null, s.s2 ? Math.abs(s.slip2) : null]).filter(v => v !== null);
  const speed = samples.map(s => Math.hypot(s.vx, s.vy));
  const top = speed.indexOf(max(speed));
  return {
    ticks: samples.length,
    top_speed_mps: max(speed), top_speed_tick: samples[top].tick,
    top_vx_mps: max(samples.map(s => s.vx)),
    end_x_m: samples.at(-1).x,
    peak_omega_rps: max(omega), peak_omega_share_of_cap: max(omega) / CAP,
    ticks_at_cap: omega.filter(w => w >= CAP - NEAR).length,
    no_slip_ceiling_mps: CAP * radius,
    supported_wheel_ticks: slips.length, supported_share: slips.length / (2 * samples.length),
    max_slip_mps: max(slips), mean_slip_mps: mean(slips),
    slip_over_0_5_mps_ticks: slips.filter(v => v > 0.5).length,
    hull_contact_ticks: samples.filter(s => s.hull).length,
  };
}

// Per-tick comparison of two attempts of the same section (Retry determinism).
function compare(a, b) {
  if (a.length !== b.length) throw Error('attempts differ in length');
  const d = {x: 0, y: 0, angle: 0, vx: 0, w: 0};
  for (let i = 0; i < a.length; i++) {
    d.x = Math.max(d.x, Math.abs(a[i].x - b[i].x));
    d.y = Math.max(d.y, Math.abs(a[i].y - b[i].y));
    d.angle = Math.max(d.angle, Math.abs(a[i].angle - b[i].angle));
    d.vx = Math.max(d.vx, Math.abs(a[i].vx - b[i].vx));
    d.w = Math.max(d.w, Math.abs(a[i].w1 - b[i].w1), Math.abs(a[i].w2 - b[i].w2));
  }
  const position = Math.max(d.x, d.y);
  return {ticks: a.length, max_position_delta_m: position, max_angle_delta_rad: d.angle, max_vx_delta_mps: d.vx, max_omega_delta_rps: d.w,
    identical: position === 0 && d.angle === 0 && d.vx === 0 && d.w === 0,
    verdict: position <= TOLERANCE.position_m && d.angle <= TOLERANCE.angle_rad ? 'MATCH' : 'DIVERGED'};
}

// The page-load start resets in update(), so the probe's first sample of that attempt is the unstepped start pose;
// a Retry resets inside fixed_update after the probe has read, so its first sample is already one step later.
// Load vs Retry therefore compares the load attempt shifted by this phase (measured 2026-11-03: shifted, identical).
const LOAD_PHASE = 1;

function section(spec, trace, resets, radius) {
  const attempts = resets.map(r => attempt(trace, r, spec.window));
  const load = attempt(trace, resets[0], spec.window + LOAD_PHASE).slice(LOAD_PHASE);
  return {attempts: attempts.map(list => stats(list, radius)),
    determinism: {retry_vs_retry: compare(attempts[1], attempts[2]), load_vs_retry: {...compare(load, attempts[1]), load_phase_ticks: LOAD_PHASE}}};
}

// Samples around the highest wheel |omega| of an attempt window (world frame; cw = chassis omega, w - cw = spin
// relative to the chassis), for explaining read-backs at or above the cap.
const PEAK_FIELDS = ['tick', 'w1', 'w2', 'cw', 'm1', 'm2', 's1', 's2', 'slip1', 'slip2', 'hull', 'x', 'y', 'angle', 'vx', 'vy', 'throttle', 'brake', 'lean'];
function peak(samples, span = 4) {
  const omega = s => Math.max(Math.abs(s.w1), Math.abs(s.w2));
  let at = 0;
  samples.forEach((s, i) => { if (omega(s) > omega(samples[at])) at = i; });
  const pick = s => Object.fromEntries(PEAK_FIELDS.filter(k => k in s).map(k => [k, s[k]]));
  return {peak_tick: samples[at].tick, peak_omega_rps: omega(samples[at]), share_of_cap: omega(samples[at]) / CAP,
    samples: samples.slice(Math.max(0, at - span), at + span + 1).map(pick)};
}

// --- tables ------------------------------------------------------------------------------------------------
const f = (v, digits = 2) => v === null || v === undefined || v === false ? '–' : typeof v === 'number' ? v.toFixed(digits) : String(v);

function load(arg) {
  const file = fs.statSync(arg).isDirectory() ? path.join(arg, 'wheel114-result.json') : arg;
  return {file, ...JSON.parse(fs.readFileSync(file, 'utf8'))};
}

function markdown(runs) {
  const ids = runs[0].sections.map(s => s.id);
  for (const run of runs) if (JSON.stringify(run.sections.map(s => s.id)) !== JSON.stringify(ids)) throw Error(run.file + ': different sections');
  const shas = new Set(runs.map(r => r.source_sha)), browsers = new Set(runs.map(r => r.browser));
  if (shas.size !== 1 || browsers.size !== 1) throw Error('runs come from different sources or browsers');
  const out = [`# Wheel-size A/B (#114 stage 1): ${runs.map(r => r.preset.toUpperCase()).join(' vs ')}`, '',
    `Source \`${runs[0].source_sha}\`, ${runs[0].browser}, debug HTML5 Gym bundle, fixed 60 Hz physics at time factor 1.0, 4 substeps; synthetic runs, not device or drive evidence.`,
    `Values are from the second Retry attempt (R pressed twice after the page load); "Retry" compares the two Retry attempts tick by tick and "Load" the page-load attempt (shifted by its ${LOAD_PHASE}-tick probe phase) with the first Retry (A21 tolerances ${TOLERANCE.position_m} m / ${TOLERANCE.angle_rad} rad; "identical" = every compared value equal). Cap = ${CAP.toFixed(2)} rad/s; "at cap" counts ticks with a wheel within ${NEAR} rad/s of it, the read-back value can exceed it.`, '',
    '## Geometry measured in the engine', '',
    '| Preset | Wheel shape radius | Wheel mass | Wheel inertia | Joint anchor | No-slip ceiling |', '| --- | --- | --- | --- | --- | --- |',
    ...runs.map(r => `| ${r.preset.toUpperCase()} | ${f(r.geometry.radius_u, 1)} u (${f(r.geometry.radius_m)} m) | ${f(r.geometry.wheel_mass_kg, 3)} kg | ${f(r.geometry.wheel_inertia, 4)} | ${r.geometry.wheel_y_u} u | ${f(CAP * r.geometry.radius_m)} m/s |`), ''];
  for (const id of ids) {
    const rows = runs.map(r => ({run: r, s: r.sections.find(x => x.id === id)}));
    const spec = rows[0].s;
    out.push(`## ${id}`, '', `${spec.protocol}; window ${spec.window} fixed ticks (${f(spec.window / 60, 2)} s) per attempt. Outcome: ${spec.outcome_rule}.`, '',
      '| Preset | Top speed (m/s) | Top vx (m/s) | Peak wheel ω (rad/s) | ω / cap | Ticks at cap | Max slip (m/s) | Mean slip (m/s) | Wheel support | Chassis contact ticks | Outcome (load / R1 / R2) | Retry | Load |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const {run, s} of rows) {
      const a = s.attempts[2], d = s.determinism.retry_vs_retry, l = s.determinism.load_vs_retry;
      const verdict = x => `${x.verdict}${x.identical ? ' (identical)' : ` (Δpos ${f(x.max_position_delta_m, 4)} m)`}`;
      out.push(`| ${run.preset.toUpperCase()} | ${f(a.top_speed_mps)} | ${f(a.top_vx_mps)} | ${f(a.peak_omega_rps)} | ${f(a.peak_omega_share_of_cap * 100, 0)} % | ${a.ticks_at_cap} | ${f(a.max_slip_mps)} | ${f(a.mean_slip_mps, 3)} | ${f(a.supported_share * 100, 0)} % | ${a.hull_contact_ticks} | ${s.outcomes.join(' / ')} | ${verdict(d)} | ${verdict(l)} |`);
    }
    out.push('');
  }
  return out.join('\n');
}

module.exports = {CAP, NEAR, TOLERANCE, LOAD_PHASE, PEAK_FIELDS, peak, attempt, stats, compare, section, markdown, load};

if (require.main === module) {
  try {
    const argv = process.argv.slice(2), at = argv.indexOf('--output');
    if (at < 0 || argv.length < at + 2) throw Error('Usage: wheel114_report.cjs --output <dir> <result>...');
    const output = argv[at + 1], inputs = argv.filter((_, i) => i !== at && i !== at + 1);
    if (!inputs.length) throw Error('No results given');
    const runs = inputs.map(load);
    fs.mkdirSync(output, {recursive: true});
    const md = markdown(runs);
    fs.writeFileSync(path.join(output, 'wheel114-ab.md'), md);
    // Peak-omega excerpts of the measured (second Retry) window from the runner's trace files, when present.
    const peaks = [];
    for (const [i, run] of runs.entries()) {
      const dir = fs.statSync(inputs[i]).isDirectory() ? inputs[i] : path.dirname(inputs[i]);
      for (const s of run.sections) {
        const file = path.join(dir, `wheel114-trace-${s.id.replace('/', '-')}.json`);
        if (!fs.existsSync(file)) continue;
        const t = JSON.parse(fs.readFileSync(file, 'utf8'));
        peaks.push({preset: run.preset, section: s.id, attempt_resets: t.resets[2], ...peak(attempt(t.trace, t.resets[2], s.window))});
      }
    }
    if (peaks.length) fs.writeFileSync(path.join(output, 'wheel114-peaks.json'), JSON.stringify({source_sha: runs[0].source_sha, cap_rps: CAP, fields: PEAK_FIELDS, peaks}, null, 1));
    fs.writeFileSync(path.join(output, 'wheel114-ab.json'), JSON.stringify({inputs: runs.map(r => r.file), source_sha: runs[0].source_sha,
      runs: runs.map(r => ({preset: r.preset, run_id: r.run_id, geometry: r.geometry, sections: r.sections.map(s => ({id: s.id, outcomes: s.outcomes, attempt: s.attempts[2], determinism: s.determinism}))}))}, null, 2));
    console.log(md);
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
