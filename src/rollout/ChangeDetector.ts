import { JITTER_PERCENTAGE } from '../constants';
import { getRemoteConfig } from '../httpClient';
import { BaseOptions } from '../types';
import { createDebug } from '../utils/debug';
import { isConfigError } from '../errors';

const debug = createDebug('changeDetector');

/**
 * Class responsible for detecting changes in the remote configuration by periodically polling the server and comparing ETags.
 * If a change is detected, it invokes the provided callback with the new configuration.
 */
export class ChangeDetector {
  private currentEtag: string;
  private timer?: NodeJS.Timeout;

  public constructor(
    private readonly schemaId: string,
    private readonly options: BaseOptions,
    initialEtag: string,
    private readonly onConfigUpdate?: () => void | Promise<void>
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
    const baseInterval = this.options.pollIntervalMs!;
    const jitter = baseInterval * JITTER_PERCENTAGE;
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    const randomJitter = (Math.random() * 2 - 1) * jitter;
    const nextInterval = baseInterval + randomJitter;

    debug('Scheduling next poll in %d ms', nextInterval);
    this.timer = setTimeout(() => {
      this.poll()
        .catch((err) => {
          if (isConfigError(err, 'httpResponseError') || isConfigError(err, 'httpGeneralError')) {
            debug('Error during polling: %s', err.message);
          } else {
            debug('Unknown error during polling: %O', err);
          }
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

    debug('Config change detected. Stopping polling. New etag: %s', response.etag);
    this.stop();
    try {
      if (this.onConfigUpdate) {
        await this.onConfigUpdate();
      }
    } catch (err) {
      if (isConfigError(err, 'httpResponseError') || isConfigError(err, 'httpGeneralError')) {
        debug('Error during onChange callback: %s', err.message);
      } else {
        debug('Error during onChange callback: %s', err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (this.options.terminatePod) {
        debug('Pod termination is expected by the user.');
      } else {
        this.currentEtag = response.etag;
        debug('Pod termination is not expected.');
        this.start();
      }
    }
  }
}
