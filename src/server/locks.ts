// Per-user and per-resource Mutex locking system
// Guarantees sequential execution of concurrent balance-mutating operations
// Prevents race conditions, double-spending, and duplicate payouts.

class MutexQueue {
  private queues: Map<string, Promise<any>> = new Map();

  /**
   * Runs an asynchronous task exclusively for the given key.
   * If another operation with the same key is in progress, this task waits
   * until the previous task finishes before executing.
   */
  public async runExclusive<T>(key: string, task: () => Promise<T>): Promise<T> {
    const currentQueue = this.queues.get(key) || Promise.resolve();

    let releaseLock: () => void;
    const nextQueue = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    // Chain to existing queue
    const chained = currentQueue.then(async () => {
      try {
        return await task();
      } finally {
        releaseLock!();
      }
    });

    this.queues.set(key, nextQueue);

    try {
      return await chained;
    } finally {
      // Clean up queue memory when idle
      if (this.queues.get(key) === nextQueue) {
        this.queues.delete(key);
      }
    }
  }
}

export const userMutex = new MutexQueue();
export const marketMutex = new MutexQueue();

/**
 * Executes a task with exclusive lock on a user's balance and state.
 */
export async function withUserLock<T>(userId: string, task: () => Promise<T>): Promise<T> {
  const safeId = userId || "guest_global";
  return userMutex.runExclusive(`user:${safeId}`, task);
}

/**
 * Executes a task with exclusive lock on a prediction market.
 */
export async function withMarketLock<T>(marketId: string, task: () => Promise<T>): Promise<T> {
  return marketMutex.runExclusive(`market:${marketId}`, task);
}
