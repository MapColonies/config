import type { Registry } from 'prom-client';
import { getOptions } from './options';
import { PACKAGE_VERSION } from './version';
import { LOCAL_SCHEMAS_PACKAGE_VERSION } from './constants';
import { createDebug } from './utils/debug';
import { createConfigError } from './errors';

const debug = createDebug('metrics');
const MILLISECONDS_PER_SECOND = 1000;

let promClient: typeof import('prom-client') | undefined;

function loadPromClient(): void {
  if (promClient === undefined) {
    debug('loading prom-client');
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      promClient = require('prom-client');
    } catch (error) {
      console.log('error', error);

      throw createConfigError('promClientNotInstalledError', 'prom-client is not installed and metrics was initialized', error as Error);
    }
  }
}

export function initializeMetrics(registry: Registry, schemaId: string, actualVersion: number | undefined): void {
  debug('initializing metrics');
  loadPromClient();

  if (promClient === undefined) {
    return;
  }

  const { offlineMode, configName, version } = getOptions();
  const gauge = new promClient.Gauge({
    name: 'config_time_of_last_fetch_unix_timestamp',
    help: 'The time of the last fetch of the configuration in unix timestamp',
    labelNames: ['name', 'request_version', 'actual_version', 'offline_mode', 'schemas_package_version', 'package_version', 'schema_id'],
  });

  /* eslint-disable @typescript-eslint/naming-convention */
  gauge.set(
    {
      name: configName,
      request_version: version,
      actual_version: actualVersion,
      offline_mode: String(offlineMode ?? false),
      schemas_package_version: LOCAL_SCHEMAS_PACKAGE_VERSION,
      package_version: PACKAGE_VERSION,
      schema_id: schemaId,
    },

    Date.now() / MILLISECONDS_PER_SECOND
  );

  /* eslint-enable @typescript-eslint/naming-convention */
  registry.registerMetric(gauge);
}
