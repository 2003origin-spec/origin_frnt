/**
 * In-process locks for the app store (src/legacy/store.ts).
 *
 * The whole-store paths (withStoreAsync / withStoreAsyncScoped) used to share
 * one process-wide mutex with every per-user hot path, so a student's
 * 60-second time ping queued behind another student's deck answer. Two locks
 * replace that:
 *
 * - `SharedExclusiveGate`: the whole-store paths hold it EXCLUSIVELY, exactly as
 *   the old mutex did. User-scoped writes hold it SHARED, so they run next to
 *   each other but never interleave with a whole-store write on this instance
 *   (which may be writing the same user's rows from its own snapshot).
 * - `KeyedMutex`: serialises user-scoped writes of the SAME user, so two of
 *   that user's requests on one instance still read-modify-write in order.
 *
 * Both are per process, like the old mutex: they never protect against another
 * instance. FIFO, so a waiting exclusive holder is not starved by a stream of
 * shared ones.
 */

type Waiter = { exclusive: boolean; grant: () => void };

export class SharedExclusiveGate {
  private sharedHolders = 0;
  private exclusiveHeld = false;
  private readonly queue: Waiter[] = [];

  /** Holders right now (for tests and diagnostics). */
  get state(): { shared: number; exclusive: boolean; waiting: number } {
    return { shared: this.sharedHolders, exclusive: this.exclusiveHeld, waiting: this.queue.length };
  }

  runShared<T>(fn: () => Promise<T> | T): Promise<T> {
    return this.run(false, fn);
  }

  runExclusive<T>(fn: () => Promise<T> | T): Promise<T> {
    return this.run(true, fn);
  }

  private async run<T>(exclusive: boolean, fn: () => Promise<T> | T): Promise<T> {
    await this.acquire(exclusive);
    try {
      return await fn();
    } finally {
      this.release(exclusive);
    }
  }

  private canGrant(exclusive: boolean): boolean {
    if (this.exclusiveHeld) return false;
    return exclusive ? this.sharedHolders === 0 : true;
  }

  private acquire(exclusive: boolean): Promise<void> {
    // Nobody may overtake a queued waiter (FIFO), so only an empty queue grants
    // on arrival.
    if (this.queue.length === 0 && this.canGrant(exclusive)) {
      this.take(exclusive);
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.queue.push({ exclusive, grant: resolve });
    });
  }

  private take(exclusive: boolean): void {
    if (exclusive) this.exclusiveHeld = true;
    else this.sharedHolders += 1;
  }

  private release(exclusive: boolean): void {
    if (exclusive) this.exclusiveHeld = false;
    else this.sharedHolders -= 1;
    while (this.queue.length > 0 && this.canGrant(this.queue[0].exclusive)) {
      const next = this.queue.shift()!;
      this.take(next.exclusive);
      next.grant();
      if (next.exclusive) break;
    }
  }
}

export class KeyedMutex {
  private readonly tails = new Map<string, Promise<void>>();

  /** Keys with a holder or a waiter (for tests: an idle mutex holds none). */
  get size(): number {
    return this.tails.size;
  }

  async runExclusive<T>(key: string, fn: () => Promise<T> | T): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => current);
    this.tails.set(key, tail);
    await previous;
    try {
      return await fn();
    } finally {
      release();
      if (this.tails.get(key) === tail) this.tails.delete(key);
    }
  }
}
