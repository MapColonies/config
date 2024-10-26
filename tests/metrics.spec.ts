import { Registry } from 'prom-client';
import { getOptions } from '../src/options';
import { BaseOptions } from '../src/types';
import { initializeMetrics } from '../src/metrics';
import { PACKAGE_VERSION } from '../src/version';
import { LOCAL_SCHEMAS_PACKAGE_VERSION } from '../src/constants';

jest.mock('../src/options');

const mockedGetOptions = getOptions as jest.MockedFunction<typeof getOptions>;

mockedGetOptions.mockReturnValue({
  offlineMode: false,
  configName: 'avi',
  version: 1,
} as BaseOptions);

describe('httpClient', () => {
  beforeEach(() => {});

  describe('#initializeMetrics', () => {
    it('should initialize the metrics in the registry with the correct labels', async () => {
      const registry = new Registry();
      initializeMetrics(registry, 'schema', 1);

      const metric = (await registry.getMetricsAsJSON())[0];
      expect(metric).toHaveProperty('name', 'config_time_of_last_fetch_unix_timestamp');
      expect(metric).toHaveProperty('values[0].labels', {
        /* eslint-disable @typescript-eslint/naming-convention */
        actual_version: 1,
        name: 'avi',
        offline_mode: 'false',
        package_version: PACKAGE_VERSION,
        request_version: 1,
        schema_id: 'schema',
        schemas_package_version: LOCAL_SCHEMAS_PACKAGE_VERSION,
      });
    });
  });
});
