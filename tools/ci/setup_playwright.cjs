// P1 only: keep the pinned browsers/cache and validate this host before skipping apt.
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

function invalidateHostValidation(executable, io = fs) {
  // Playwright caches this host-specific result alongside transferable browser binaries.
  // Its pinned registry uses <browser revision>/DEPENDENCIES_VALIDATED (30-day TTL).
  let directory = path.dirname(executable);
  while (!/^chromium-\d+$/.test(path.basename(directory))) {
    const parent = path.dirname(directory);
    if (parent === directory) throw Error('Unrecognized pinned Chromium cache layout');
    directory = parent;
  }
  const root = path.dirname(directory);
  if (!io.existsSync(root)) return;
  for (const entry of io.readdirSync(root)) {
    if (/^chromium(?:_headless_shell)?-\d+$/.test(entry))
      io.rmSync(path.join(root, entry, 'DEPENDENCIES_VALIDATED'), {force: true});
  }
}

function setup(run, report) {
  run('install', ['install', 'chromium']);
  try {
    run('probe', ['--probe']);
  } catch (error) {
    // Never turn unrelated launch/runtime failures into a successful retry.
    if (!/Host system is missing dependencies|error while loading shared libraries/.test(String(error))) throw error;
    report.fallback = true;
    run('system-dependencies', ['install-deps', 'chromium']);
    run('probe-after-install', ['--probe']);
  }
}

async function probe() {
  const {chromium} = require('playwright');
  invalidateHostValidation(chromium.executablePath());
  // Validate and launch both downloaded Chromium variants; Gym uses the default shell.
  for (const options of [{}, {channel: 'chromium'}]) {
    const browser = await chromium.launch({...options, timeout: 30000});
    try {
      const page = await browser.newPage();
      await page.setContent('<button>Ready</button>');
      await page.getByRole('button', {name: 'Ready'}).click();
      await page.screenshot();
      console.log(JSON.stringify({browser: options.channel || 'headless-shell', version: browser.version(), status: 'PASS'}));
    } finally {
      await browser.close();
    }
  }
}

function main() {
  const output = process.argv[2];
  if (!output) throw Error('Usage: node tools/ci/setup_playwright.cjs <evidence-directory>');
  if (process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS || process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD)
    throw Error('Playwright validation/download bypass is forbidden');
  fs.mkdirSync(output, {recursive: true});
  const report = {
    schema_version: 1, source_sha: process.env.GITHUB_SHA || null,
    run_id: process.env.GITHUB_RUN_ID || null, run_attempt: process.env.GITHUB_RUN_ATTEMPT || null,
    runner_image: process.env.ImageOS || null, runner_image_version: process.env.ImageVersion || null,
    browser_cache_hit: process.env.BROWSER_CACHE_HIT || 'false',
    playwright: require('playwright/package.json').version, node: process.version,
    os_release: fs.readFileSync('/etc/os-release', 'utf8'), fallback: false, status: 'FAIL', steps: [],
  };
  const started = Date.now();
  const run = (name, args) => {
    const start = Date.now();
    const probeStep = args[0] === '--probe';
    const script = probeStep ? __filename : path.join(path.dirname(require.resolve('playwright/package.json')), 'cli.js');
    const result = spawnSync(process.execPath, [script, ...args], {
      encoding: 'utf8', timeout: probeStep ? 90000 : 600000, maxBuffer: 16 * 1024 * 1024,
    });
    const log = (result.stdout || '') + (result.stderr || '') + (result.error ? '\n' + result.error : '');
    fs.writeFileSync(path.join(output, name + '.log'), log);
    process.stdout.write(log);
    report.steps.push({name, seconds: (Date.now() - start) / 1000, exit_code: result.status, signal: result.signal});
    if (result.status !== 0) throw Error(`${name} failed (${result.status}): ${log}`);
  };
  try {
    setup(run, report);
    report.status = 'PASS';
  } finally {
    report.seconds = (Date.now() - started) / 1000;
    fs.writeFileSync(path.join(output, 'setup.json'), JSON.stringify(report, null, 2) + '\n');
    console.log('RIDER_PLAYWRIGHT_SETUP ' + JSON.stringify(report));
    if (process.env.GITHUB_STEP_SUMMARY)
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\nPlaywright setup: ${report.status}; ${report.seconds}s; OS dependency fallback: ${report.fallback}; image: ${report.runner_image_version}; browser cache hit: ${report.browser_cache_hit}.\n`);
  }
}

if (require.main === module) {
  if (process.argv[2] === '--probe') probe().catch(error => { console.error(error); process.exitCode = 1; });
  else { try { main(); } catch (error) { console.error(error); process.exitCode = 1; } }
}
module.exports = {invalidateHostValidation, setup};
