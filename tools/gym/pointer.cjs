// Shared frame-based pointer input for the Gym runners (#227; first used by a21 in #224).
// The game acts on press/release edges sampled once per engine frame (engine pitfall 5): a release and the next press
// inside one engine frame, or a press and its release inside one frame, are never seen. These helpers therefore wait
// for engine frames, not wall-clock time, between pointer transitions.
const DEFAULT_TIMEOUT = 5000;
const firstLine = error => String(error?.message ?? error).split('\n')[0];
// Node-side guard: a frozen page can stall page.evaluate itself, and with it any in-page timer.
function within(promise, ms, what) {
  let timer;
  const expired = new Promise((_, reject) => { timer = setTimeout(() => reject(Error(`${what} did not return within ${ms} ms (page frozen?)`)), ms); });
  return Promise.race([promise, expired]).finally(() => clearTimeout(timer));
}

// Wait until the engine has run `n` more frames.
// counter: a page expression of an engine frame counter the case already publishes (e.g. 'window.riderReplay.frames');
// n defaults to 2. Without it, in-page requestAnimationFrame callbacks are counted, n defaults to 3: on HTML5 the
// engine runs one main-loop iteration per requestAnimationFrame callback and does not pace or skip
// (emscripten_set_main_loop_arg(..., 0, 1), Defold engine_loop.cpp L27-L35 and L95 at a81dbb0, see docs/LE1B_REPORT.md;
// update_frequency 60 only lengthens the step of a slow callback, engine.cpp L2387-L2412). The engine's callback was
// registered in the previous frame, so it runs before ours: one of our callbacks already follows an engine iteration;
// 3 is a margin. A hidden or throttled page that renders no frames times out with a clear error; it never passes.
async function frames(page, {counter = null, n = counter ? 2 : 3, timeout = DEFAULT_TIMEOUT, label = 'pointer'} = {}) {
  try {
    if (counter) {
      const start = await within(page.evaluate(counter), timeout, 'reading ' + counter);
      if (!Number.isFinite(start)) throw Error(`frame counter ${counter} is not a number (${start})`);
      await page.waitForFunction(`(${counter})>=${start + n}`, null, {polling: 50, timeout});
    } else {
      await within(page.evaluate(({n, timeout}) => new Promise((resolve, reject) => {
        let k = 0;
        const timer = setTimeout(() => reject(Error(`only ${k} animation frames in ${timeout} ms (page hidden or throttled?)`)), timeout);
        const tick = () => { if (++k >= n) { clearTimeout(timer); resolve(); } else requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      }), {n, timeout}), timeout + 1000, 'the animation-frame wait');
    }
  } catch (error) {
    throw Error(`${label}: the engine ran no ${n} frames within ${timeout} ms (${firstLine(error)})`);
  }
}

// Canvas point of a GUI node the game publishes in window.riderHud (GUI pixels, origin bottom left).
function hudPoint(page, name) {
  return page.evaluate(name => {
    const c = document.querySelector('canvas'), r = c.getBoundingClientRect(), q = window.riderHud[name];
    return {x: r.x + q.x / c.width * r.width, y: r.y + (1 - q.y / c.height) * r.height};
  }, name);
}

// Press at `point`, hold until the game acknowledges (`until`, a page predicate with `arg`), release, then wait for
// engine frames so the next press is a new edge. state(): optional async diagnostics for the failure message.
async function click(page, point, {until, arg, counter = null, n, timeout, label = 'click', state = null, waitTimeout} = {}) {
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  try {
    await page.waitForFunction(until, arg, {polling: 50, ...(waitTimeout ? {timeout: waitTimeout} : {})});
  } catch (error) {
    const extra = state ? await state().catch(() => '') : '';
    throw Error(`${label}: expected state not reached (${firstLine(error)})${extra ? '; ' + extra : ''}`);
  }
  await page.mouse.up();
  await frames(page, {counter, n, timeout, label: label + ' release'});
}

// Move to `point`, press and release, with engine frames after each transition (no acknowledgement predicate), so
// the engine sees the pointer position, the press and the release in separate frames.
async function tap(page, point, {counter = null, n, timeout, label = 'tap'} = {}) {
  await page.mouse.move(point.x, point.y);
  await frames(page, {counter, n, timeout, label: label + ' move'});
  await page.mouse.down();
  await frames(page, {counter, n, timeout, label: label + ' press'});
  await page.mouse.up();
  await frames(page, {counter, n, timeout, label: label + ' release'});
}

module.exports = {frames, hudPoint, click, tap, DEFAULT_TIMEOUT};
