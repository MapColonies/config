/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

describe('options', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  describe('#getOptions', () => {
    it('should return the options if initialized', () => {
      const { getOptions, initializeOptions } = require('../src/options');

      initializeOptions({ configName: 'name', version: 'latest', configServerUrl: 'http://localhost:8080' });

      const options = getOptions();

      expect(options).toBeDefined();
    });

    it('should throw an error if options are not initialized', () => {
      const { getOptions } = require('../src/options');

      expect(() => {
        getOptions();
      }).toThrow();
    });
  });

  describe('#initializeOptions', () => {
    it('should initialize options with env variables', () => {
      process.env.CONFIG_NAME = 'name';
      process.env.CONFIG_VERSION = 'latest';
      process.env.CONFIG_SERVER_URL = 'http://localhost:8080';

      const { initializeOptions } = require('../src/options');

      const options = initializeOptions({});

      expect(options).toBeDefined();
    });

    it('should initialize options with env variables and override with provided options', () => {
      process.env.CONFIG_NAME = 'name';
      process.env.CONFIG_VERSION = 'latest';
      process.env.CONFIG_SERVER_URL = 'http://localhost:8080';

      const { initializeOptions } = require('../src/options');

      const options = initializeOptions({ configName: 'newName' });

      expect(options).toHaveProperty('configName', 'name');
    });

    it('should throw an error if options are invalid', () => {
      process.env.CONFIG_VERSION = 'latest';
      process.env.CONFIG_SERVER_URL = 'http://localhost:8080';

      const { initializeOptions } = require('../src/options');

      expect(() => {
        initializeOptions({});
      }).toThrow();
    });

    it.each([
      ['configName', 'CONFIG_NAME', 'avi', 'avi'],
      ['configServerUrl', 'CONFIG_SERVER_URL', 'http://localhost:8080', 'http://localhost:8080'],
      ['version', 'CONFIG_VERSION', 'latest', 'latest'],
      ['offlineMode', 'CONFIG_OFFLINE_MODE', 'true', true],
      ['ignoreServerIsOlderVersionError', 'CONFIG_IGNORE_SERVER_IS_OLDER_VERSION_ERROR', 'true', true],
    ])('should initialize options and override with provided environment variable %s', (key, envKey, envValue, expected) => {
      process.env[envKey] = envValue;

      const { initializeOptions } = require('../src/options');

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
