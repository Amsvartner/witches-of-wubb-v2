export function throttle<Args extends unknown[]>(
  fn: (...args: Args) => void,
  waitMs: number,
): (...args: Args) => void {
  let onCooldown = false;
  let pendingArgs: Args | undefined;

  function startCooldown() {
    onCooldown = true;
    setTimeout(() => {
      onCooldown = false;
      // A call arrived during the cooldown - fire it now with whatever the
      // most recent args were (so a released drag position always lands),
      // then start a fresh cooldown so a continued drag keeps being bounded.
      if (pendingArgs !== undefined) {
        const args = pendingArgs;
        pendingArgs = undefined;
        fn(...args);
        startCooldown();
      }
    }, waitMs);
  }

  return (...args: Args) => {
    if (!onCooldown) {
      fn(...args);
      startCooldown();
      return;
    }
    pendingArgs = args;
  };
}
