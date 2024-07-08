import { Interceptable, MockAgent, setGlobalDispatcher } from 'undici';
import { commonDbPartialV1 } from '@map-colonies/schemas';
import { StatusCodes } from 'http-status-codes';
import { config } from '../src/config';

const URL = 'http://localhost:8080';
describe('config', () => {
  describe('#config', () => {
    describe('httpClient', () => {
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

        client.intercept({ path: '/config/name/1?shouldDereference=true', method: 'GET' }).reply(StatusCodes.OK, configData);

        const configInstance = await config({
          configName: 'name',
          version: 1,
          schema: commonDbPartialV1,
          configServerUrl: URL,
          localConfigPath: '../tests/config',
        });

        const conf = configInstance.getAll();

        expect(conf).toEqual({
          host: 'avi',
          port: 5432,
          username: 'postgres',
          password: 'postgres',
          ssl: {
            enabled: false,
          }
        });
      });
    });
  });
});
