import { getRemoteConfig } from '../httpClient';
import { BaseOptions } from '../types';
import { createDebug } from '../utils/debug';

const debug = createDebug('changeDetector');

/**
 * Class responsible for detecting changes in the remote configuration by periodically polling the server and comparing ETags.
 * If a change is detected, it invokes the provided callback with the new configuration.
 */
export class ChangeDetector {
  private readonly currentEtag: string;
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
    const interval = this.options.pollIntervalMs;
    debug('Starting change detector with interval %d ms', interval);

    this.timer = setInterval(() => {
      this.poll().catch((err) => {
        debug('Error during polling: %s', (err as Error).message);
      });
    }, interval);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async poll(): Promise<void> {
    debug('Polling config %s@%s with etag %s', this.options.configName, this.options.version, this.currentEtag);

    const response = await getRemoteConfig(this.options.configName, this.schemaId, this.options.version, this.currentEtag);

    if (response.config === null) {
      debug('No config changes detected');
      return;
    }

    debug('Config change detected');
    try {
      if (this.onConfigUpdate) {
        await this.onConfigUpdate();
      }
    } catch (err) {
      debug('Error during onChange callback: %s', (err as Error).message);
    } finally {
      process.exit(0);
    }
  }
}
