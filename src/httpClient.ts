import assert from 'node:assert';
import { Dispatcher, request } from 'undici';
import StatusCodes from 'http-status-codes';
import { getOptions } from './options';
import { Config, ServerCapabilities } from './types';
import { createDebug } from './utils/debug';
import { ConfigError, ConfigErrors, createConfigError } from './errors';

const debug = createDebug('http');

async function createHttpErrorPayload(res: Dispatcher.ResponseData): Promise<ConfigErrors['httpResponseError']['payload']> {
  return {
    body: await res.body.text(),
    headers: res.headers,
    statusCode: res.statusCode,
  };
}

async function requestWrapper(url: string, query?: Record<string, unknown>): Promise<Dispatcher.ResponseData> {
  debug('Making request to %s', url);
  try {
    const res = await request(url, { query });
    if (res.statusCode > StatusCodes.NOT_FOUND) {
      debug('Failed to fetch config. Status code: %d', res.statusCode);
      throw createConfigError('httpResponseError', 'Failed to fetch config', await createHttpErrorPayload(res));
    }
    return res;
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error;
    }
    debug('An error occurred while making the request: %s', (error as Error).message);
    throw createConfigError('httpGeneralError', 'An error occurred while making the request', error as Error);
  }
}

export async function getRemoteConfig(configName: string, version: number | 'latest'): Promise<Config> {
  debug('Fetching remote config %s@%s', configName, version);
  const { configServerUrl } = getOptions();
  const url = `${configServerUrl}/config/${configName}/${version}`;
  const res = await requestWrapper(url, { shouldDereference: true });

  if (res.statusCode === StatusCodes.BAD_REQUEST) {
    debug('Invalid request to getConfig');
    throw createConfigError('httpResponseError', 'Invalid request to getConfig', await createHttpErrorPayload(res));
  }

  if (res.statusCode === StatusCodes.NOT_FOUND) {
    debug('Config with given name and version was not found');
    throw createConfigError('httpResponseError', 'Config with given name and version was not found', await createHttpErrorPayload(res));
  }
  debug('Config fetched successfully');

  return (await res.body.json()) as Config;
}

export async function getServerCapabilities(): Promise<ServerCapabilities> {
  debug('Fetching server capabilities');
  const { configServerUrl } = getOptions();
  const url = `${configServerUrl}/capabilities`;
  const { body } = await requestWrapper(url);

  debug('Server capabilities fetched successfully');
  return (await body.json()) as ServerCapabilities;
}
