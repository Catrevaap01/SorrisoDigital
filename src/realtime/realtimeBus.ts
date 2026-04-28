type Unsubscribe = () => void;

type Listener<T> = (payload: T) => void;

export class RealtimeBus<Events extends Record<string, any>> {
  private listeners: Map<keyof Events, Set<Listener<any>>> = new Map();

  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): Unsubscribe {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener as Listener<any>);
    this.listeners.set(event, set);

    return () => {
      const current = this.listeners.get(event);
      if (!current) return;
      current.delete(listener as Listener<any>);
      if (current.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return;
    for (const listener of Array.from(set)) {
      try {
        listener(payload);
      } catch {
        // no-op (isolates listener failures)
      }
    }
  }
}

