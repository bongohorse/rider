// #114 stage 1: who can reach the debug wheel candidates (opt-in, report only; not in CI).
// node tools/gym/wheel114_reach.cjs <bundle-dir> <output-dir> <debug|release>
// Serves one HTML5 bundle exactly as a player or a manual drive test gets it (no Gym test injection) and opens
// ?station=ramps-long&section=down-30&preset=<w26|w30|a>&wheel114=1.
// release: every key gives preset A, the HUD note "Invalid URL: A" for the candidates and no debug wheel probe.
// debug: the candidates load (probe reads their shape radius), the HUD note names them, and P is refused in the
// world (same preset, no Retry, note "reload to change").
const {chromium} = require('playwright');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');

function find(dir) {
  for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { const v = find(p); if (v) return v; } else if (e.name === 'index.html') return p;
  }
}

// Pure verdict over the observations (unit-tested in tests/ci/wheel114.test.cjs).
function check(kind, results) {
  const failures = [];
  const want = (ok, text) => { if (!ok) failures.push(text); };
  for (const r of results) {
    want(r.errors.length === 0, `${r.key}: page errors`);
    if (kind === 'release') {
      want(r.preset === 'a', `${r.key}: release must apply preset A`);
      want(r.probe_present === false, `${r.key}: release must not run the debug probe`);
      want(r.key === 'a' ? r.preset_note === 'Presets [P]' : r.preset_note === 'Invalid URL: A', `${r.key}: release HUD note ${JSON.stringify(r.preset_note)}`);
    } else if (r.key === 'a') {
      want(r.preset === 'a' && r.preset_note === 'Presets [P]', 'a: debug A unchanged');
    } else {
      want(r.preset === r.key, `${r.key}: debug must apply the candidate`);
      want(r.probe_radius_u !== null && Math.abs(r.probe_radius_u - Number(r.key.slice(1))) < 1e-3, `${r.key}: shape radius ${r.probe_radius_u}`);
      want(/^Debug W\d\d: A \+ 0\.\d\d m wheels$/.test(r.preset_note), `${r.key}: debug HUD note ${JSON.stringify(r.preset_note)}`);
      want(r.after_p?.preset === r.key && r.after_p.reset_count === r.after_p.resets_before, `${r.key}: P must be refused without a Retry`);
      want(/ \| reload to change$/.test(r.after_p?.preset_note || ''), `${r.key}: refused P note ${JSON.stringify(r.after_p?.preset_note)}`);
    }
  }
  return failures;
}

async function main(bundle, out, kind) {
  if (!['debug', 'release'].includes(kind)) throw Error('kind must be debug or release');
  const web = path.dirname(find(path.resolve(bundle)));
  fs.mkdirSync(out, {recursive: true});
  const types = {'.wasm': 'application/wasm', '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json'};
  const server = http.createServer((req, res) => {
    const f = path.resolve(web, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!f.startsWith(web + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', types[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port + '/index.html';
  const browser = await chromium.launch(), results = [];
  const hud = page => page.evaluate(() => ({preset: window.riderTelemetry.preset, reset_count: window.riderTelemetry.reset_count, preset_note: window.riderHud.preset_note}));
  try {
    for (const key of ['w26', 'w30', 'a']) {
      const page = await browser.newPage({viewport: {width: 1280, height: 720}}), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(base + `?station=ramps-long&section=down-30&preset=${key}&wheel114=1`);
      await page.waitForFunction(() => window.riderTelemetry?.sequence > 3 && window.riderHud, null, {timeout: 60000});
      if (!(await page.evaluate(() => window.riderHud.tuning))) { await page.keyboard.down('t'); await page.waitForFunction(() => window.riderHud.tuning); await page.keyboard.up('t'); }
      const seen = await hud(page), probe = await page.evaluate(() => window.riderWheel114Geometry || null);
      await page.screenshot({path: path.join(out, `${kind}-${key}.png`)});
      let after_p = null;
      if (kind === 'debug' && key !== 'a') {
        await page.keyboard.down('p'); await page.evaluate(async () => { for (let i = 0; i < 20; i++) await new Promise(requestAnimationFrame); }); await page.keyboard.up('p');
        await page.waitForFunction(() => / \| reload to change$/.test(window.riderHud.preset_note), null, {timeout: 10000}).catch(() => {});
        const seq = await page.evaluate(() => window.riderTelemetry.sequence);
        await page.waitForFunction(n => window.riderTelemetry.sequence > n + 2, seq);
        after_p = {...await hud(page), resets_before: seen.reset_count};
        await page.screenshot({path: path.join(out, `${kind}-${key}-after-p.png`)});
      }
      results.push({key, preset: seen.preset, preset_note: seen.preset_note, probe_present: !!probe, probe_radius_u: probe?.radius_u ?? null,
        probe_source_sha: probe?.source_sha ?? null, after_p, errors});
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  const failures = check(kind, results);
  const report = {kind, status: failures.length ? 'FAIL' : 'PASS', browser_url: '?station=ramps-long&section=down-30&preset=<key>&wheel114=1', results, failures};
  fs.writeFileSync(path.join(out, `reach-${kind}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  if (failures.length) throw Error(failures.join('\n'));
}

module.exports = {check};
if (require.main === module) main(...process.argv.slice(2)).catch(e => { console.error(e); process.exitCode = 1; });
