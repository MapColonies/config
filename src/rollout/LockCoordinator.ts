import { acquireLock, releaseLock } from '../httpClient';
import { BaseOptions } from '../types';
import { createDebug } from '../utils/debug';

const debug = createDebug('lockCoordinator');

/**
 * Class responsible for coordinating distributed locks to control rollout concurrency.
 */
export class LockCoordinator {
  public constructor(private readonly options: BaseOptions) {}

  /**
   * Acquires a distributed lock. If the lock is already held, it waits according to the Retry-After header.
   */
  public async acquire(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (true) {
      const { acquired, retryAfter } = await acquireLock(
        this.options.rolloutKey,
        this.options.callerId,
        this.options.rolloutLimit,
        this.options.lockTtlSeconds
      );

      if (acquired) {
        return;
      }

      // If not acquired, wait for retryAfter (in seconds) or a default value of 1 second
      // eslint-disable-next-line @typescript-eslint/no-magic-numbers
      const waitTime = retryAfter! * 1000;
      debug('Lock not acquired, waiting for %d ms', waitTime);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  /**
   * Releases the distributed lock.
   */
  public async release(): Promise<void> {
    await releaseLock(this.options.rolloutKey, this.options.callerId);
  }
}
