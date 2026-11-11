type SaveReceipt<State> = { kind: "saved" | "conflict"; state: State };

type SaveQueueOptions<State, Change> = {
  initial: State;
  key: (change: Change) => string;
  apply: (state: State, change: Change) => State;
  send: (change: Change, confirmed: State) => Promise<SaveReceipt<State>>;
  version?: (state: State) => number;
  onBusyChange?: (busy: boolean) => void;
};

export function createSaveQueue<State, Change>({
  initial, key, apply, send, version, onBusyChange,
}: SaveQueueOptions<State, Change>) {
  let confirmed = initial;
  let sending: Change | null = null;
  const pending: Change[] = [];
  const failed = new Map<string, Change>();
  const listeners = new Set<() => void>();

  function readSnapshot() {
    const changes = sending === null ? pending : [sending, ...pending];
    return { confirmed, visible: changes.reduce(apply, confirmed), sending, failed: [...failed.values()] };
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
    return pending.some(next => key(next) === key(change));
  }
  async function drain() {
    onBusyChange?.(true);
    while (pending.length) {
      const change = pending.shift()!;
      sending = change;
      publish();
      try {
        for (let attempt = 0; ; attempt++) {
          const receipt = await send(change, confirmed);
          accept(receipt.state);
          if (receipt.kind === "saved" || superseded(change)) break;
          if (attempt >= 2) throw new Error("Save conflict");
        }
      } catch {
        if (!superseded(change)) failed.set(key(change), change);
      }
    }
    sending = null;
    onBusyChange?.(false);
    publish();
  }
  function enqueue(change: Change) {
    const id = key(change);
    const index = pending.findIndex(item => key(item) === id);
    if (index !== -1) pending.splice(index, 1);
    failed.delete(id);
    pending.push(change);
    if (sending === null) void drain();
    else publish();
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    accept,
    enqueue,
    retry(id: string) {
      const change = failed.get(id);
      if (change !== undefined) enqueue(change);
    },
  };
}
