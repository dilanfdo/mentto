// A tiny change feed: every database write calls notifyDataChanged(), and anything showing data
// (useQuery, the reminder scheduler) subscribes to re-read. Simple enough for a single-user app.

type Listener = () => void;

const listeners = new Set<Listener>();
let version = 0;

export function notifyDataChanged(): void {
  version += 1;
  listeners.forEach((l) => l());
}

export function subscribeToDataChanges(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getDataVersion(): number {
  return version;
}
