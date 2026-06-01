import { JITTER_PERCENTAGE } from '../constants';
import { getRemoteConfig } from '../httpClient';
import { BaseOptions } from '../types';
import { createDebug } from '../utils/debug';

const debug = createDebug('changeDetector');

/**
 * Class responsible for detecting changes in the remote configuration by periodically polling the server and comparing ETags.
 * If a change is detected, it invokes the provided callback with the new configuration.
 */
export class ChangeDetector {
  private currentEtag: string;
  private timer?: NodeJS.Timeout;
  private readonly etagBlackList: Set<string> = new Set();

  public constructor(
    private readonly schemaId: string,
    private readonly options: BaseOptions,
    private readonly onConfigUpdate: (newRemoteConfig: object) => void | Promise<void>,
    initialEtag: string
  ) {
    this.currentEtag = initialEtag;
  }

  public start(): void {
    debug('Starting change detector');
    this.scheduleNextPoll();
  }

  public stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  private scheduleNextPoll(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    const baseInterval = this.options.pollIntervalMs;
    const jitter = baseInterval * JITTER_PERCENTAGE;
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    const randomJitter = (Math.random() * 2 - 1) * jitter;
    const nextInterval = baseInterval + randomJitter;

    debug('Scheduling next poll in %d ms', nextInterval);
    this.timer = setTimeout(() => {
      this.poll()
        .catch((err) => {
          debug('Error during polling: %s', (err as Error).message);
        })
        .finally(() => {
          if (this.timer !== undefined) {
            this.scheduleNextPoll();
          }
        });
    }, nextInterval);
  }

  private async poll(): Promise<void> {
    debug('Polling config %s@%s with etag %s', this.options.configName, this.options.version, this.currentEtag);

    const response = await getRemoteConfig(this.options.configName, this.schemaId, this.options.version, this.currentEtag);

    if (response.config === null) {
      debug('No config changes detected');
      return;
    }

    const newEtag = response.etag;
    if (this.etagBlackList.has(newEtag)) {
      debug('Detected quarantined etag %s. Skipping update.', newEtag);
      this.currentEtag = newEtag;
      return;
    }

    debug('Config change detected');
    try {
      await this.onConfigUpdate(response.config.config);
      this.currentEtag = newEtag;
    } catch (err) {
      debug('Error applying configuration for etag %s. Adding to poison pills. Error: %s', newEtag, (err as Error).message);
      this.etagBlackList.add(newEtag);
      this.currentEtag = newEtag;
    }
  }
}
