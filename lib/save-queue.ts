type SaveReceipt<State> = { kind: "saved" | "conflict" | "reset"; state: State };

type SaveQueueOptions<State, Change> = {
  initial: State;
  key: (change: Change) => string;
  apply: (state: State, change: Change) => State;
  send: (change: Change, confirmed: State) => Promise<SaveReceipt<State>>;
  version?: (state: State) => number;
  onBusyChange?: (busy: boolean) => void;
  pauseOnFailure?: boolean;
  retryConflicts?: boolean;
};

export function createSaveQueue<State, Change>({
  initial, key, apply, send, version, onBusyChange, pauseOnFailure, retryConflicts = true,
}: SaveQueueOptions<State, Change>) {
  let confirmed = initial;
  type Entry = { change: Change; complete: (saved: boolean) => void };
  let sending: Entry | null = null;
  const pending: Entry[] = [];
  const failed = new Map<string, Change>();
  const listeners = new Set<() => void>();
  const savedListeners = new Set<(state: State, previous: State) => void>();

  function readSnapshot() {
    const queued = pending.map(entry => entry.change);
    const changes = sending === null ? queued : [sending.change, ...queued];
    const failures = [...failed.values()];
    const visible = (pauseOnFailure ? [...failures, ...changes] : changes).reduce(apply, confirmed);
    return { confirmed, visible, sending: sending?.change ?? null, queued, failed: failures };
  }
  let snapshot = readSnapshot();
  function publish() {
    snapshot = readSnapshot();
    listeners.forEach(listener => listener());
  }
  function accept(state: State) {
    if (!version || version(state) >= version(confirmed)) {
      confirmed = state;
      publish();
    }
  }
  function superseded(change: Change) {
    return pending.some(next => key(next.change) === key(change));
  }
  async function drain() {
    onBusyChange?.(true);
    while (pending.length && !(pauseOnFailure && failed.size)) {
      const entry = pending.shift()!;
      const { change } = entry;
      sending = entry;
      publish();
      try {
        for (let attempt = 0; ; attempt++) {
          const previous = confirmed;
          const receipt = await send(change, confirmed);
          if (receipt.kind === "reset") {
            pending.splice(0).forEach(item => item.complete(false));
            failed.clear();
            sending = null;
            accept(receipt.state);
            entry.complete(false);
            break;
          }
          accept(receipt.state);
          if (receipt.kind === "saved") {
            savedListeners.forEach(listener => listener(confirmed, previous));
            entry.complete(true);
            break;
          }
          if (superseded(change)) {
            entry.complete(false);
            break;
          }
          if (!retryConflicts || attempt >= 2) throw new Error("Save conflict");
        }
      } catch {
        if (!superseded(change)) failed.set(key(change), change);
        entry.complete(false);
      }
    }
    sending = null;
    onBusyChange?.(false);
    publish();
  }
  function enqueue(change: Change, first = false) {
    const id = key(change);
    const index = pending.findIndex(item => key(item.change) === id);
    if (index !== -1) pending.splice(index, 1)[0].complete(false);
    failed.delete(id);
    const result = new Promise<boolean>(complete => {
      const entry = { change, complete };
      if (first) pending.unshift(entry);
      else pending.push(entry);
    });
    if (sending === null) void drain();
    else publish();
    return result;
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    subscribeSaved(listener: (state: State, previous: State) => void) {
      savedListeners.add(listener);
      return () => { savedListeners.delete(listener); };
    },
    accept,
    enqueue,
    retry(id: string) {
      const change = failed.get(id);
      if (change !== undefined) return enqueue(change, pauseOnFailure);
    },
  };
}
