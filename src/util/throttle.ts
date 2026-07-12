export type Throttled<Args extends unknown[]> = ((...args: Args) => void) & {
  cancel: () => void;
};

export const throttle = <Args extends unknown[]>(
  fn: (...args: Args) => void,
  waitMs: number,
): Throttled<Args> => {
  let onCooldown = false;
  let pendingArgs: Args | undefined;
  let cooldownTimeout: ReturnType<typeof setTimeout> | undefined;

  function startCooldown() {
    onCooldown = true;
    cooldownTimeout = setTimeout(() => {
      onCooldown = false;
      cooldownTimeout = undefined;
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

  const throttled = ((...args: Args) => {
    if (!onCooldown) {
      fn(...args);
      startCooldown();
      return;
    }
    pendingArgs = args;
  }) as Throttled<Args>;

  // Drops any call still waiting to fire and resets the cooldown, so a
  // caller-authoritative action (e.g. a Reset button) can't be silently
  // undone moments later by a stale drag value that was already in flight.
  throttled.cancel = () => {
    pendingArgs = undefined;
    if (cooldownTimeout) {
      clearTimeout(cooldownTimeout);
      cooldownTimeout = undefined;
    }
    onCooldown = false;
  };

  return throttled;
};
