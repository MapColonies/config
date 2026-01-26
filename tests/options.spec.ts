import { beforeEach, describe, expect, it, vi, afterAll } from 'vitest';

describe('options', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  describe('#getOptions', () => {
    it('should return the options if initialized', async () => {
      const { getOptions, initializeOptions } = await import('../src/options.js');

      initializeOptions({ configName: 'name', version: 'latest', configServerUrl: 'http://localhost:8080' });

      const options = getOptions();

      expect(options).toBeDefined();
    });

    it('should throw an error if options are not initialized', async () => {
      const { getOptions } = await import('../src/options.js');

      expect(() => {
        getOptions();
      }).toThrow();
    });
  });

  describe('#initializeOptions', () => {
    it('should initialize options with env variables', async () => {
      process.env.CONFIG_NAME = 'name';
      process.env.CONFIG_VERSION = 'latest';
      process.env.CONFIG_SERVER_URL = 'http://localhost:8080';

      const { initializeOptions } = await import('../src/options.js');

      const options = initializeOptions({});

      expect(options).toBeDefined();
    });

    it('should initialize options with env variables and override with provided options', async () => {
      process.env.CONFIG_NAME = 'name';
      process.env.CONFIG_VERSION = 'latest';
      process.env.CONFIG_SERVER_URL = 'http://localhost:8080';

      const { initializeOptions } = await import('../src/options.js');

      const options = initializeOptions({ configName: 'newName' });

      expect(options).toHaveProperty('configName', 'name');
    });

    it('should throw an error if options are invalid', async () => {
      process.env.CONFIG_SERVER_URL = 'http://localhost:8080';

      const { initializeOptions } = await import('../src/options.js');

      expect(() => {
        initializeOptions({ version: 'avi' as unknown as undefined });
      }).toThrow();
    });

    it.each([
      ['configName', 'CONFIG_NAME', 'avi', 'avi'],
      ['configServerUrl', 'CONFIG_SERVER_URL', 'http://localhost:8080', 'http://localhost:8080'],
      ['version', 'CONFIG_VERSION', 'latest', 'latest'],
      ['offlineMode', 'CONFIG_OFFLINE_MODE', 'true', true],
      ['ignoreServerIsOlderVersionError', 'CONFIG_IGNORE_SERVER_IS_OLDER_VERSION_ERROR', 'true', true],
    ])('should initialize options and override with provided environment variable %s', async (key, envKey, envValue, expected) => {
      process.env[envKey] = envValue;

      const { initializeOptions } = await import('../src/options.js');

      const options = initializeOptions({
        configName: 'xv',
        version: 1,
        configServerUrl: 'http://localhost',
        offlineMode: false,
        ignoreServerIsOlderVersionError: false,
      });

      expect(options).toHaveProperty(key, expected);
    });
  });
});
