/** Shared bounds for visual counters/progress; never announce animation frames. */
export function signalProgress(value: number, max: number) {
  const total = Number.isFinite(max) ? Math.max(0, max) : 0;
  const current = Number.isFinite(value) ? Math.min(total, Math.max(0, value)) : 0;
  return { value: current, max: total, percent: total ? current / total * 100 : 0 };
}

export function signalCountAt(from: number, to: number, elapsed: number, duration = 600) {
  const progress = duration > 0 ? Math.min(1, Math.max(0, elapsed / duration)) : 1;
  return Math.round(from + (to - from) * (1 - Math.pow(1 - progress, 3)));
}
