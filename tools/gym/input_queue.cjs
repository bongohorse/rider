// Settlement of the default Gym browser runner (#426): phase actions run in order, and a failed
// action fails the suite whether it settles before or after the game's suite_end.
function createGymSettlement() {
  let resolveDone, rejectDone, input = Promise.resolve();
  const done = new Promise((resolve, reject) => {resolveDone = resolve; rejectDone = reject;});
  // A failure can arrive before the runner awaits `done` (e.g. during page.goto); it stays
  // rejected for the runner but must not crash the process as an unhandled rejection first.
  done.catch(() => {});
  return {
    done,
    fail: error => rejectDone(error),
    end: report => resolveDone(report),
    enqueue(action) {
      // Keep `input` itself rejected so complete() sees a late failure; the observer only
      // fails `done` early and also marks this rejection as handled.
      input = input.then(action);
      input.catch(rejectDone);
      return input;
    },
    // After `done`: the report must PASS and every queued action must have succeeded.
    async complete(result) {
      if (result.status !== 'PASS') throw Error('Gym test failed');
      await input;
      return result;
    },
  };
}
module.exports = {createGymSettlement};
