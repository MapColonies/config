import { Interceptable, MockAgent, setGlobalDispatcher } from 'undici';
import { commonDbPartialV1, commonS3PartialV1 } from '@map-colonies/schemas';
import { StatusCodes } from 'http-status-codes';
import { config } from '../src/config';

const URL = 'http://localhost:8080';
describe('config', () => {
  describe('#config', () => {
    let client: Interceptable;
    beforeEach(() => {
      const agent = new MockAgent();
      agent.disableNetConnect();

      setGlobalDispatcher(agent);
      client = agent.get(URL);
    });

    it('should return the config with all the default values', async () => {
      const configData = {
        configName: 'name',
        schemaId: commonDbPartialV1.$id,
        version: 1,
        config: {
          host: 'avi',
        },
        createdAt: 0,
      };

      client
        .intercept({ path: `/config/name/1?shouldDereference=true&schemaId=${commonDbPartialV1.$id}`, method: 'GET' })
        .reply(StatusCodes.OK, configData);
      client
        .intercept({ path: '/capabilities', method: 'GET' })
        .reply(StatusCodes.OK, { serverVersion: '2.0.0', schemasPackageVersion: '99.9.9', pubSubEnabled: false });

      const configInstance = await config({
        configName: 'name',
        version: 1,
        schema: commonDbPartialV1,
        configServerUrl: URL,
        localConfigPath: './tests/config',
      });

      const conf = configInstance.getAll();
      expect(conf).toEqual({
        host: 'avi',
        port: 5432,
        username: 'postgres',
        password: 'postgres',
        ssl: {
          enabled: false,
        },
      });
    });

    it('should return the config with all the default values in offline mode', async () => {
      const configInstance = await config({
        configName: 'name',
        version: 1,
        schema: commonDbPartialV1,
        configServerUrl: URL,
        localConfigPath: './tests/config',
        offlineMode: true,
      });

      const conf = configInstance.getAll();

      expect(conf).toEqual({
        host: 'localhost',
        port: 5432,
        username: 'postgres',
        password: 'postgres',
        ssl: {
          enabled: false,
        },
      });
    });

    it('should allow to access certain properties of the config using the get function', async () => {
      const configInstance = await config({
        configName: 'name',
        version: 1,
        schema: commonDbPartialV1,
        configServerUrl: URL,
        offlineMode: true,
        localConfigPath: './tests/config',
      });

      const host = configInstance.get('host');
      const port = configInstance.get('port');
      const ssl = configInstance.get('ssl.enabled');

      expect(host).toBe('localhost');
      expect(port).toBe(5432);
      expect(ssl).toBe(false);
    });

    it('should override the local values with the server values', async () => {
      const configData = {
        configName: 'name',
        schemaId: commonDbPartialV1.$id,
        version: 1,
        config: {
          ssl: {
            enabled: true,
            cert: 'cert',
            key: 'key',
            ca: 'ca',
          },
        },
        createdAt: 0,
      };

      client
        .intercept({ path: `/config/name/1?shouldDereference=true&schemaId=${commonDbPartialV1.$id}`, method: 'GET' })
        .reply(StatusCodes.OK, configData);
      client
        .intercept({ path: '/capabilities', method: 'GET' })
        .reply(StatusCodes.OK, { serverVersion: '2.0.0', schemasPackageVersion: '99.9.9', pubSubEnabled: false });

      const configInstance = await config({
        configName: 'name',
        version: 1,
        schema: commonDbPartialV1,
        configServerUrl: URL,
        localConfigPath: './tests/config',
      });

      const conf = configInstance.getAll();

      expect(conf).toEqual({
        host: 'localhost',
        port: 5432,
        username: 'postgres',
        password: 'postgres',
        ssl: configData.config.ssl,
      });
    });

    it('should override values with env values', async () => {
      jest.resetModules();
      process.env.S3_ACCESS_KEY = 'access';
      process.env.S3_SECRET_KEY = 'secret';
      process.env.S3_ENDPOINT = 'http://localhost:9000';

      const { config } = require('../src/config') as typeof import('../src/config');
      const configInstance = await config({
        configName: 'name',
        version: 1,
        schema: commonS3PartialV1,
        configServerUrl: URL,
        localConfigPath: './tests/config',
        offlineMode: true,
      });

      const accessKey = configInstance.get('accessKeyId');
      const secretKey = configInstance.get('secretAccessKey');

      expect(accessKey).toBe('access');
      expect(secretKey).toBe('secret');
    });

    it('should return all the config parts', async () => {
      const configData = {
        configName: 'name',
        schemaId: commonDbPartialV1.$id,
        version: 1,
        config: {
          host: 'avi',
        },
        createdAt: 0,
      };

      client
        .intercept({ path: `/config/name/1?shouldDereference=true&schemaId=${commonDbPartialV1.$id}`, method: 'GET' })
        .reply(StatusCodes.OK, configData);
      client
        .intercept({ path: '/capabilities', method: 'GET' })
        .reply(StatusCodes.OK, { serverVersion: '2.0.0', schemasPackageVersion: '99.9.9', pubSubEnabled: false });

      const configInstance = await config({
        configName: 'name',
        version: 1,
        schema: commonDbPartialV1,
        configServerUrl: URL,
        localConfigPath: './tests/config',
      });

      const parts = configInstance.getConfigParts();

      expect(parts).toEqual({
        localConfig: {
          ssl: {
            enabled: false,
          },
        },
        config: {
          host: 'avi',
        },
        envConfig: {},
      });
    });

    it('should return all the options configured', async () => {
      const configInstance = await config({
        configName: 'name',
        version: 1,
        schema: commonDbPartialV1,
        configServerUrl: URL,
        localConfigPath: './tests/config',
        offlineMode: true,
      });

      const options = configInstance.getResolvedOptions();

      expect(options).toEqual({
        configName: 'name',
        version: 1,
        configServerUrl: URL,
        localConfigPath: './tests/config',
        offlineMode: true,
      });
    });

    it('should throw an error if the schema of the config is different from the schema of the server', async () => {
      const configData = {
        configName: 'name',
        schemaId: commonDbPartialV1.$id,
        version: 1,
        config: {
          host: 'avi',
        },
        createdAt: 0,
      };

      client
        .intercept({ path: `/config/name/1?shouldDereference=true&schemaId=${commonS3PartialV1.$id}`, method: 'GET' })
        .reply(StatusCodes.OK, configData);
      client
        .intercept({ path: '/capabilities', method: 'GET' })
        .reply(StatusCodes.OK, { serverVersion: '2.0.0', schemasPackageVersion: '99.9.9', pubSubEnabled: false });

      const promise = config({
        configName: 'name',
        version: 1,
        schema: commonS3PartialV1,
        configServerUrl: URL,
        localConfigPath: './tests/config',
      });

      await expect(promise).rejects.toThrow('The schema version of the remote config does not match the schema version of the local config');
    });

    it('should throw an error if the config validation fails', async () => {
      const configData = {
        configName: 'name',
        schemaId: commonDbPartialV1.$id,
        version: 1,
        config: {
          ssl: {
            enabled: 'true',
          },
        },
        createdAt: 0,
      };

      client
        .intercept({ path: `/config/name/1?shouldDereference=true&schemaId=${commonDbPartialV1.$id}`, method: 'GET' })
        .reply(StatusCodes.OK, configData);
      client
        .intercept({ path: '/capabilities', method: 'GET' })
        .reply(StatusCodes.OK, { serverVersion: '2.0.0', schemasPackageVersion: '99.9.9', pubSubEnabled: false });

      const promise = config({
        configName: 'name',
        version: 1,
        schema: commonDbPartialV1,
        configServerUrl: URL,
        localConfigPath: './tests/config',
      });

      await expect(promise).rejects.toThrow('Config validation error');
    });

    it('should throw an error if the config server is using an older version of the schemas package', async () => {
      client
        .intercept({ path: '/capabilities', method: 'GET' })
        .reply(StatusCodes.OK, { serverVersion: '2.0.0', schemasPackageVersion: '0.0.0', pubSubEnabled: false });

      const promise = config({
        configName: 'name',
        version: 1,
        schema: commonDbPartialV1,
        configServerUrl: URL,
        localConfigPath: './tests/config',
      });

      await expect(promise).rejects.toThrow();
    });

    it('should throw an error if the network request fails', async () => {
      client.intercept({ path: '/capabilities', method: 'GET' }).replyWithError(new Error());

      const promise = config({
        configName: 'name',
        version: 1,
        schema: commonDbPartialV1,
        configServerUrl: URL,
        localConfigPath: './tests/config',
      });

      await expect(promise).rejects.toThrow();
    });

    it('should not allow to modify the root object', async () => {
      const configInstance = await config({
        configName: 'name',
        version: 1,
        schema: commonDbPartialV1,
        configServerUrl: URL,
        localConfigPath: './tests/config',
        offlineMode: true,
      });

      const conf = configInstance.getAll();
      const action = () => {
        conf.host = 'dummmy.host.check';
      };
      expect(action).toThrow(/Cannot assign to read only property/);
    });

    it('should not allow to modify the child object', async () => {
      const configInstance = await config({
        configName: 'name',
        version: 1,
        schema: commonDbPartialV1,
        configServerUrl: URL,
        localConfigPath: './tests/config',
        offlineMode: true,
      });

      const conf = configInstance.get('ssl');
      const action = () => {
        conf.enabled = true; // try to change ssl configuration
      };
      expect(action).toThrow(/Cannot assign to read only property/);
    });

    it('should not allow to modify the extracted child object from root', async () => {
      const configInstance = await config({
        configName: 'name',
        version: 1,
        schema: commonDbPartialV1,
        configServerUrl: URL,
        localConfigPath: './tests/config',
        offlineMode: true,
      });

      const conf = configInstance.getAll();
      const sslConf = conf.ssl;
      const action = () => {
        sslConf.enabled = true;
      };
      expect(action).toThrow(/Cannot assign to read only property/);
    });

    it('should throw an error if the server version does not satisfy the required version', async () => {
      client
        .intercept({ path: '/capabilities', method: 'GET' })
        .reply(StatusCodes.OK, { serverVersion: '0.0.1', schemasPackageVersion: '99.9.9', pubSubEnabled: false });

      const promise = config({
        configName: 'name',
        version: 1,
        schema: commonDbPartialV1,
        configServerUrl: URL,
        localConfigPath: './tests/config',
      });

      await expect(promise).rejects.toThrow('The server version does not satisfy the required version.');
    });
  });
});
