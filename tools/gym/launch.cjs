// Test-server-only startup overrides. The release template and game stay unchanged.
function inject(html, runId, testcase) {
  if (!/^[a-z0-9-]+$/.test(runId) || !/^[a-z0-9]+$/.test(testcase)) throw Error('Invalid Gym launch identity');
  const marker = '<script id="engine-start">';
  if (html.split(marker).length !== 2) throw Error('Expected one pinned engine-start marker');
  const args = ['--config=rider.run_id=' + runId, '--config=rider.gym_test=' + testcase];
  return html.replace(marker, '<script>CUSTOM_PARAMETERS.engine_arguments.push(...' + JSON.stringify(args) + ');</script>\n' + marker);
}

async function configure(page, runId, testcase) {
  await page.route('**/index.html*', async route => {
    const response = await route.fetch();
    if (!response.ok()) throw Error('Gym index request failed: ' + response.status());
    await route.fulfill({response, body: inject(await response.text(), runId, testcase)});
  });
}

module.exports = {inject, configure};
