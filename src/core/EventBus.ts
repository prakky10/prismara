/**
 * Minimal, strongly-typed publish/subscribe bus.
 *
 * The battle engine is deliberately free of any Phaser dependency: it emits
 * plain data objects ("BattleEvents") onto a bus and the Battle *scene* is
 * responsible for turning those into animation. That keeps the rules pure and
 * unit-testable while still allowing cinematic presentation.
 */

export type Handler<T> = (payload: T) => void;

export interface Subscription {
  off(): void;
}

/** A map of event-name -> payload type. */
export type EventMap = Record<string, unknown>;

export class EventBus<M extends EventMap> {
  private readonly handlers = new Map<keyof M, Set<Handler<never>>>();

  on<K extends keyof M>(event: K, handler: Handler<M[K]>): Subscription {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<never>);
    return {
      off: () => {
        set!.delete(handler as Handler<never>);
      },
    };
  }

  once<K extends keyof M>(event: K, handler: Handler<M[K]>): Subscription {
    const sub = this.on(event, (payload: M[K]) => {
      sub.off();
      handler(payload);
    });
    return sub;
  }

  off<K extends keyof M>(event: K, handler: Handler<M[K]>): void {
    this.handlers.get(event)?.delete(handler as Handler<never>);
  }

  emit<K extends keyof M>(event: K, payload: M[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    // Copy so handlers may unsubscribe during dispatch.
    for (const handler of [...set]) {
      (handler as Handler<M[K]>)(payload);
    }
  }

  clear(event?: keyof M): void {
    if (event === undefined) this.handlers.clear();
    else this.handlers.delete(event);
  }

  listenerCount(event: keyof M): number {
    return this.handlers.get(event)?.size ?? 0;
  }
}

/** Convenience factory so call sites read `createBus<MyEvents>()`. */
export function createBus<M extends EventMap>(): EventBus<M> {
  return new EventBus<M>();
}
