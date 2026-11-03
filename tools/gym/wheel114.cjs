// #114 stage 1: wheel-size A/B runner (opt-in, report only; not part of CI `required`).
// smoke.py --case w114 --preset <a|w26|w30>. Each section loads its station in a fresh page with the station's own
// debug driver (a16 ramps: neutral downhill from 1 m/s; a19 gaps: full throttle from 7 m/s; a19c air: full throttle
// to the lip, then neutral) or, on Straight, the read-only wheel114 probe's constant full-throttle driver. The
// probe (URL wheel114=1|throttle, debug HTML5 only) records every completed fixed tick: chassis pose and velocity,
// both wheels' angular velocity, loaded support and contact-point slip. After the page load the runner presses R
// twice (real keyboard path) and keeps the same window of fixed ticks from all three attempts.
const {configure} = require('./launch.cjs');
const {chromium} = require('playwright');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const P = require('./preset.cjs').fromArgv(process.argv);
const R = require('./wheel114_report.cjs');

// Windows cover the manoeuvre and its outcome rule on every preset (A, 0.26 m, 0.30 m), declared before running.
const SECTIONS = [
  {id: 'straight', station: 'straight', case: 'w114', query: '&wheel114=throttle', window: 480,
    protocol: 'Straight from rest, constant full throttle (probe driver), no brake/lean', outcome_rule: 'none (top speed only); a bounds reset fails the run'},
  ...['down-10', 'down-20', 'down-30'].map(section => ({id: 'ramps-long/' + section, station: 'ramps-long', section, case: 'a16', query: '&wheel114=1', window: 210,
    protocol: `ramps-long ${section}: authored neutral start at 1 m/s (a16 driver)`, outcome_rule: 'ramp record status (ACCELERATED or HELD/SLOWED) and its speed gain'})),
  ...['3', '6'].map(section => ({id: 'gaps/' + section, station: 'gaps', section, case: 'a19', query: '&wheel114=1', window: 300,
    protocol: `gaps ${section} m: authored 7 m/s start, full throttle (a19 driver)`, outcome_rule: 'gap record status (CLEARED/MISSED) and jump distance'})),
  {id: 'gaps-landing/down', station: 'gaps-landing', section: 'down', case: 'a19', query: '&wheel114=1', window: 300,
    protocol: 'gaps-landing 15° downslope: authored 7 m/s start, full throttle (a19 driver)', outcome_rule: 'gap record status (CLEARED/MISSED) and jump distance'},
  ...['big', 'mid'].map(section => ({id: 'air/' + section, station: 'air', section, case: 'a19c', query: '&wheel114=1', window: 300,
    protocol: `air ${section}: authored 7 m/s start, full throttle to the lip, then neutral (a19c driver, lean 0)`, outcome_rule: 'lip jump status (LANDED/CRASHED) with landing angle'})),
];

// Station outcome of the selected section after an attempt (read from the game's own station report).
function outcome(spec, report) {
  if (spec.station === 'straight') return {text: 'n/a'};
  assert.equal(report?.preset, P.key, 'station report preset');
  assert.notEqual(report.modified, true, 'station report modified');
  if (spec.station === 'air') {
    const jump = (report.jumps || []).find(j => j.from_lip);
    if (!jump) return {text: 'NO JUMP'};
    return {text: `${jump.status} ${jump.landing_angle_deg.toFixed(0)}°`, status: jump.status, landing_angle_deg: jump.landing_angle_deg, airtime_s: jump.airtime_s,
      takeoff_speed_mps: jump.takeoff_speed_mps, peak_compression_m: jump.peak_compression_m, chassis_contact: jump.chassis_contact || false};
  }
  const r = report.records.find(x => x.id === spec.section);
  if (spec.station === 'ramps-long') return {text: `${r.status} ${r.speed_gain_mps === undefined ? '' : (r.speed_gain_mps >= 0 ? '+' : '') + r.speed_gain_mps.toFixed(2)}`.trim(),
    status: r.status, speed_gain_mps: r.speed_gain_mps ?? null, exit_speed_mps: r.exit_speed_mps ?? null, ground_share: r.ground_share ?? null};
  return {text: `${r.status}${Number.isFinite(r.jump_distance_m) ? ' ' + r.jump_distance_m.toFixed(2) + ' m' : ''}${r.edge_strike ? ' edge' : ''}`,
    status: r.status, jump_distance_m: r.jump_distance_m ?? null, edge_strike: r.edge_strike || false, touchdown_vy_mps: r.touchdown_vy_mps ?? null, peak_compression_m: r.peak_compression_m ?? null};
}

(async () => {
  const [root, sha, runId] = process.argv.slice(2), out = path.resolve(root);
  if (!P.explicit) throw Error('w114 compares presets: give --preset (a, w26 or w30)');
  let browser;
  const sections = [], errors = [];
  function find(dir) { for (const e of fs.readdirSync(dir, {withFileTypes: true})) { const p = path.join(dir, e.name); if (e.isDirectory()) { const v = find(p); if (v) return v; } else if (e.name === 'index.html') return p; } }
  const web = path.dirname(find(path.resolve(process.argv[6])));
  const server = http.createServer((req, res) => { const f = path.resolve(web, '.' + new URL(req.url, 'http://localhost').pathname); if (!f.startsWith(web + path.sep) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; } res.setHeader('Content-Type', f.endsWith('.wasm') ? 'application/wasm' : f.endsWith('.js') ? 'text/javascript' : 'text/html'); fs.createReadStream(f).pipe(res); });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const url = 'http://127.0.0.1:' + server.address().port + '/index.html';
  let geometry = null, page = null, spec = null;
  try {
    browser = await chromium.launch();
    for (spec of SECTIONS) {
      page = await browser.newPage({viewport: {width: 1280, height: 720}});
      await configure(page, runId, spec.case);
      page.on('pageerror', e => errors.push(spec.id + ': ' + e.message));
      page.on('console', m => { if (/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text())) errors.push(spec.id + ': ' + m.text()); });
      await page.goto(url + `?station=${spec.station}` + (spec.section ? `&section=${spec.section}` : '') + spec.query + P.query);
      await page.waitForFunction(({sha, runId}) => window.riderReady?.source_sha === sha && window.riderReady?.run_id === runId && window.riderWheel114Geometry, {sha, runId});
      const g = await page.evaluate(() => window.riderWheel114Geometry);
      assert.equal(g.preset, P.key, 'probe preset (an unknown or release-refused key falls back to A)');
      if (geometry) assert.deepEqual(g, geometry, 'geometry changed between sections'); else geometry = g;
      const outcomes = [], resets = [];
      for (let n = 0; n < 3; n++) {
        // The attempt's reset count: the page load is 0 (no Retry yet), then one per R.
        const r = n === 0 ? await page.evaluate(() => window.riderWheel114Trace[0].resets) : resets[n - 1] + 1;
        if (n > 0) {
          await page.keyboard.down('r');
          await page.waitForFunction(r => window.riderWheel114Trace.some(s => s.resets === r), r, {timeout: 8000, polling: 50});
          await page.keyboard.up('r');
        }
        resets.push(r);
        // The page-load attempt is compared one probe tick later (wheel114_report.cjs LOAD_PHASE): keep one more sample.
        await page.waitForFunction(({r, w}) => window.riderWheel114Trace.filter(s => s.resets === r).length >= w, {r, w: spec.window + (n === 0 ? R.LOAD_PHASE : 0)}, {timeout: 30000, polling: 100});
        const t = await page.evaluate(() => window.riderTelemetry);
        assert.equal(t?.preset, P.key, 'telemetry preset'); assert.equal(t.modified, false, 'telemetry not modified');
        if (n === 0 && (spec.id === 'straight' || spec.id === 'air/big')) await page.screenshot({path: path.join(out, `wheel114-${spec.id.replace('/', '-')}.png`)});
        outcomes.push(outcome(spec, await page.evaluate(() => window.riderStationReport)));
        P.checks++;
      }
      const trace = await page.evaluate(() => window.riderWheel114Trace.slice());
      assert(trace.every(s => s.preset === P.key && s.station === spec.station && (s.section || undefined) === spec.section), spec.id + ': trace identity');
      // A bounds or head reset inside a window would start another attempt early: only our two R presses may reset.
      assert.deepEqual([...new Set(trace.map(s => s.resets))], resets, spec.id + ': unexpected reset inside a window');
      const result = R.section(spec, trace, resets, g.radius_m);
      sections.push({...spec, outcomes: outcomes.map(o => o.text), outcome_details: outcomes, ...result});
      fs.writeFileSync(path.join(out, `wheel114-trace-${spec.id.replace('/', '-')}.json`), JSON.stringify({id: spec.id, preset: P.key, resets, trace}));
      console.log(JSON.stringify({section: spec.id, preset: P.key, outcomes: outcomes.map(o => o.text), r2: result.attempts[2], retry: result.determinism.retry_vs_retry}));
      await page.close(); page = null;
    }
    if (errors.length) throw Error(errors.join('\n'));
    const report = {status: 'PASS', source_sha: sha, run_id: runId, browser: browser.version(), ...P.report(), geometry, cap_rps: R.CAP, tolerance: R.TOLERANCE,
      protocol: 'Read-only wheel114 probe, one sample per completed Defold fixed tick (60 Hz, factor 1.0); per section page load + two keyboard R retries, same tick window each. Report only.',
      sections, real_device: 'NOT RUN', human_drive: 'NOT RUN'};
    fs.writeFileSync(path.join(out, 'wheel114-result.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({status: report.status, preset: P.key, geometry}));
  } catch (e) {
    if (page) {
      await page.screenshot({path: path.join(out, 'wheel114-failed.png')}).catch(() => {});
      fs.writeFileSync(path.join(out, 'wheel114-failed-state.json'), JSON.stringify({section: spec?.id, errors, sections, state: await page.evaluate(() => ({telemetry: window.riderTelemetry, report: window.riderStationReport, geometry: window.riderWheel114Geometry, trace_tail: (window.riderWheel114Trace || []).slice(-20)})).catch(() => null)}, null, 2));
    }
    throw e;
  } finally { if (browser) await browser.close(); await new Promise(r => server.close(r)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
