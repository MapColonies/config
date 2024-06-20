import assert from 'node:assert';
import { Dispatcher, request } from 'undici';
import StatusCodes from 'http-status-codes';
import { getOptions } from './options';
import { Config, ServerCapabilities } from './types';
import { createDebug } from './debug';
import { ConfigError, ConfigErrors, createConfigError } from './errors';

const debug = createDebug('httpClient');

async function createHttpErrorPayload(res: Dispatcher.ResponseData): Promise<ConfigErrors['httpResponseError']['payload']> {
  return {
    body: await res.body.text(),
    headers: res.headers,
    statusCode: res.statusCode,
  };
}

async function requestWrapper(url: string): Promise<Dispatcher.ResponseData> {
  try {
    const res = await request(url);
    if (res.statusCode > StatusCodes.NOT_FOUND) {
      throw createConfigError('httpResponseError', 'Failed to fetch config', await createHttpErrorPayload(res));
    }
    return res;
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error;
    }
    throw createConfigError('httpGeneralError', 'An error occurred while making the request', error as Error);
  }
}

export async function getRemoteConfig(configName: string, version: number | 'latest'): Promise<Config> {
  const { configServerUrl } = getOptions();
  const url = `${configServerUrl}/config/${configName}/${version}`;
  const res = await requestWrapper(url);

  if (res.statusCode === StatusCodes.BAD_REQUEST) {
    throw createConfigError('httpResponseError', 'Invalid request to getConfig', await createHttpErrorPayload(res));
  }

  if (res.statusCode === StatusCodes.NOT_FOUND) {
    throw createConfigError('httpResponseError', 'Config with given name and version was not found', await createHttpErrorPayload(res));
  }

  return (await res.body.json()) as Config;
}

export async function getServerCapabilities(): Promise<ServerCapabilities> {
  const { configServerUrl } = getOptions();
  const url = `${configServerUrl}/capabilities`;
  const { body, statusCode } = await requestWrapper(url);

  assert(statusCode === StatusCodes.OK, `Failed to fetch capabilities from ${url}`);

  return (await body.json()) as ServerCapabilities;
}
