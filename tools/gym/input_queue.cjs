// Settlement of the default Gym browser runner (#426): phase actions run in order, and a failed
// action fails the suite whether it settles before or after the game's suite_end. A runner
// failure (console error, pageerror, crash, foreign evidence) after suite_end fails it too (#447).
function createGymSettlement() {
  let resolveDone, rejectDone, input = Promise.resolve(), failure = null;
  const done = new Promise((resolve, reject) => {resolveDone = resolve; rejectDone = reject;});
  // A failure can arrive before the runner awaits `done` (e.g. during page.goto); it stays
  // rejected for the runner but must not crash the process as an unhandled rejection first.
  done.catch(() => {});
  // The first failure wins; `done` no longer changes once suite_end resolved it, so a later
  // failure is kept here for complete() and check().
  const record = error => {
    if (!failure) failure = {error};
    rejectDone(error);
  };
  // Throws the first failure recorded so far, if any.
  const check = () => {if (failure) throw failure.error;};
  return {
    done,
    fail: record,
    end: report => resolveDone(report),
    enqueue(action) {
      // Keep `input` itself rejected so complete() sees a late failure; the observer records
      // it, fails `done` early and also marks this rejection as handled.
      input = input.then(action);
      input.catch(record);
      return input;
    },
    // After `done`: the report must PASS, every queued action must have succeeded and no
    // failure may have arrived until now.
    async complete(result) {
      if (result.status !== 'PASS') throw Error('Gym test failed');
      try {await input;} catch (error) {record(error);}
      check();
      return result;
    },
    // For the runner's last page interaction after complete() (input release, final frame).
    check,
  };
}
module.exports = {createGymSettlement};
