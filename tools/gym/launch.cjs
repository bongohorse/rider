// Test-server-only startup overrides. The release template and game stay unchanged.
function inject(html, runId, testcase) {
  if (!/^[a-z0-9-]+$/.test(runId) || !/^[a-z0-9]+$/.test(testcase)) throw Error('Invalid Gym launch identity');
  const marker = '<script id="engine-start">';
  if (html.split(marker).length !== 2) throw Error('Expected one pinned engine-start marker');
  const args = ['--config=rider.run_id=' + runId, '--config=rider.gym_test=' + testcase];
  return html.replace(marker, '<script>CUSTOM_PARAMETERS.engine_arguments.push(...' + JSON.stringify(args) + ');</script>\n' + marker);
}

// The index GET is idempotent and happens before the page starts. The runners' static servers keep Node's default
// keep-alive timeout, so a load that starts just as the server closes the idle reused socket gets ECONNRESET (#221).
// Only that error is retried, with one log line per retry so recurrences stay visible. Playwright raises it only for a
// connection failure before any response (its fetch ignores connection errors once a response arrived), so no HTTP
// status and no response the page has seen is ever retried. A request that still fails aborts the route, so page.goto
// fails inside the runner (with its diagnostics) instead of an unhandled rejection crashing the process.
const FETCH_RETRIES = 3;

function handler(runId, testcase, log = console.error, wait = ms => new Promise(r => setTimeout(r, ms))) {
  return async route => {
    let body, response;
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          response = await route.fetch();
          break;
        } catch (error) {
          if (error?.code !== 'ECONNRESET' || attempt >= FETCH_RETRIES) throw error;
          log(`Gym index fetch ECONNRESET, retry ${attempt + 1}/${FETCH_RETRIES}: ${route.request().url()}`);
          await wait(250 * 2 ** attempt);
        }
      }
      if (!response.ok()) throw Error('Gym index request failed: ' + response.status());
      body = inject(await response.text(), runId, testcase);
    } catch (error) {
      log('Gym index request failed: ' + String(error.message).split('\n')[0]);
      await route.abort('failed');
      return;
    }
    await route.fulfill({response, body});
  };
}

async function configure(page, runId, testcase) {
  await page.route('**/index.html*', handler(runId, testcase));
}

module.exports = {inject, configure, handler, FETCH_RETRIES};
