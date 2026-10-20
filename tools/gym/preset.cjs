// `--preset <key>` for the station runners (Car Feel 2, #200). Without the flag a runner is unchanged:
// no URL parameter, no extra assertion. With it every station URL gets `&preset=<key>` and every measured
// trial must report that preset, unmodified and comparable; an unknown key falls back to A in the game
// (feel.lua), so the telemetry check is what rejects it.
const assert = require('node:assert/strict');

// Removes `--preset <key>` / `--preset=<key>` from argv in place, so the positional runner arguments keep
// their indices. Keys follow the preset file names (main/gym/presets/<key>.json).
function fromArgv(argv) {
  let key = null;
  for (let i = 0; i < argv.length; i++) {
    const match = /^--preset(?:=(.*))?$/.exec(argv[i]);
    if (!match) continue;
    if (key !== null) throw Error('--preset given twice');
    const value = match[1] ?? argv[i + 1];
    argv.splice(i, match[1] === undefined ? 2 : 1);
    i--;
    if (!/^[a-z0-9]{1,16}$/.test(value ?? '')) throw Error('Invalid --preset key: ' + value);
    key = value;
  }
  return option(key);
}

function option(key) {
  return {
    key: key || 'a',
    explicit: key !== null,
    query: key === null ? '' : '&preset=' + key,
    checks: 0,
    tuning: null,
    // Asserts the live telemetry and the station report of a finished trial. `comparable` is the station's own
    // flag; ramps reports carry none, so there an unmodified, time-comparable (A20) report is required. A seams
    // free-roll run's `comparable` is a measurement (speed window), so there only the time factor is required.
    async check(page) {
      if (!this.explicit) return;
      const {t, r} = await page.evaluate(() => ({t: window.riderTelemetry, r: window.riderStationReport}));
      assert.equal(t?.preset, this.key, 'telemetry preset (an unknown key falls back to A)');
      assert.equal(t.modified, false, 'telemetry preset not modified');
      assert.equal(r?.preset, this.key, 'station report preset');
      assert.notEqual(r.modified, true, 'station report not modified');
      assert.equal(comparable(r), true, 'station report comparable');
      // The tuning the trial measured with; every trial of a run must agree on it.
      const tuning = r.tuning_at_start ?? r.tuning ?? {};
      this.tuning ??= {};
      for (const [k, v] of Object.entries(tuning)) {
        if (k in this.tuning) assert.equal(v, this.tuning[k], 'tuning ' + k + ' changed between trials');
        this.tuning[k] = v;
      }
      this.checks++;
    },
    // Fields a runner adds to its result JSON when the flag was given.
    report() { return this.explicit ? {preset: this.key, preset_checks: this.checks, tuning: this.tuning} : {}; }
  };
}

function comparable(report) {
  if (report.time_comparable === false) return false;
  if (report.kind === 'seams') return report.time_comparable === true;
  if ('comparable' in report) return report.comparable === true;
  return report.kind === 'ramps' && report.modified === false && report.time_comparable === true;
}

module.exports = {fromArgv, option, comparable};
