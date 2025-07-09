import { Interceptable, MockAgent, setGlobalDispatcher } from 'undici';
import { StatusCodes } from 'http-status-codes';
import { getRemoteConfig, getServerCapabilities } from '../src/httpClient';
import { getOptions } from '../src/options';
import { BaseOptions } from '../src/types';

jest.mock('../src/options');

const URL = 'http://localhost:8080';

const mockedGetOptions = getOptions as jest.MockedFunction<typeof getOptions>;

mockedGetOptions.mockReturnValue({
  configServerUrl: URL,
} as BaseOptions);

describe('httpClient', () => {
  let client: Interceptable;
  beforeEach(() => {
    const agent = new MockAgent();
    agent.disableNetConnect();

    setGlobalDispatcher(agent);
    client = agent.get(URL);
  });

  describe('#getServerCapabilities', () => {
    it('should return the server capabilities', async () => {
      const capabilities = { serverVersion: '1.0.0', schemasPackageVersion: '1.0.0', pubSubEnabled: true };

      client.intercept({ path: '/capabilities', method: 'GET' }).reply(StatusCodes.OK, capabilities);

      const result = await getServerCapabilities();

      expect(result).toEqual(capabilities);
    });

    it('should throw an error if the request fails', async () => {
      client.intercept({ path: '/capabilities', method: 'GET' }).reply(StatusCodes.INTERNAL_SERVER_ERROR, 'Internal Server Error');

      await expect(getServerCapabilities()).rejects.toThrow('Failed to fetch');
    });

    it('should throw an error if the request fails to be sent', async () => {
      client.intercept({ path: '/capabilities', method: 'GET' }).replyWithError(new Error('oh noes'));

      await expect(getServerCapabilities()).rejects.toThrow('An error occurred while making the request');
    });
  });

  describe('#getRemoteConfig', () => {
    it('should return the remote config', async () => {
      const config = {
        configName: 'name',
        schemaId: 'schema',
        version: 1,
        config: {},
        createdAt: 0,
      };

      client.intercept({ path: '/config/name/1?shouldDereference=true&schemaId=schema', method: 'GET' }).reply(StatusCodes.OK, config);

      const result = await getRemoteConfig('name', 'schema', 1);
      expect(result).toEqual(config);
    });

    it('should throw an error if the response is bad request', async () => {
      client
        .intercept({ path: '/config/name/1?shouldDereference=true&schemaId=schema', method: 'GET' })
        .reply(StatusCodes.BAD_REQUEST, 'Bad request');

      await expect(getRemoteConfig('name', 'schema', 1)).rejects.toThrow('Invalid request to getConfig');
    });

    it('should throw an error if the response is not found', async () => {
      client.intercept({ path: '/config/name/1?shouldDereference=true&schemaId=schema', method: 'GET' }).reply(StatusCodes.NOT_FOUND, 'Not found');

      await expect(getRemoteConfig('name', 'schema', 1)).rejects.toThrow('Config with given name and version was not found');
    });

    it('should throw an error if the request fails', async () => {
      client
        .intercept({ path: '/config/name/1?shouldDereference=true&schemaId=schema', method: 'GET' })
        .reply(StatusCodes.INTERNAL_SERVER_ERROR, 'Internal Server Error');

      await expect(getRemoteConfig('name', 'schema', 1)).rejects.toThrow('Failed to fetch');
    });

    it('should throw an error if the request fails to be sent', async () => {
      client.intercept({ path: '/config/name/1?shouldDereference=true&schemaId=schema', method: 'GET' }).replyWithError(new Error('oh noes'));

      await expect(getRemoteConfig('name', 'schema', 1)).rejects.toThrow('An error occurred while making the request');
    });
  });
});
