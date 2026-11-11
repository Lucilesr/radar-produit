const MIN_HIDDEN_MS = 5_000;
const COOLDOWN_MS = 30_000;

type Refresh = () => void;
type Block = { callbacks: Set<Refresh>; lastRefresh: number };

export function createTabReturnRefresh(now: () => number = Date.now) {
  let hiddenSince: number | null = null;
  const blocks = new Map<string, Block>();

  function subscribe(key: string, callback: Refresh) {
    const block = blocks.get(key) ?? { callbacks: new Set<Refresh>(), lastRefresh: -Infinity };
    blocks.set(key, block);
    block.callbacks.add(callback);
    return () => {
      block.callbacks.delete(callback);
      if (!block.callbacks.size && now() - block.lastRefresh >= COOLDOWN_MS) blocks.delete(key);
    };
  }

  function visibilityChanged(hidden: boolean) {
    const time = now();
    if (hidden) {
      hiddenSince ??= time;
      return;
    }
    const since = hiddenSince;
    hiddenSince = null;
    for (const [key, block] of blocks) {
      if (time - block.lastRefresh < COOLDOWN_MS) continue;
      const callback = block.callbacks.values().next().value;
      if (!callback) {
        blocks.delete(key);
        continue;
      }
      if (since === null || time - since < MIN_HIDDEN_MS) continue;
      block.lastRefresh = time;
      callback();
    }
  }

  return { subscribe, visibilityChanged };
}
