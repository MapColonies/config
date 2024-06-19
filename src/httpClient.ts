import assert from 'node:assert';
import { request } from 'undici';
import StatusCodes from 'http-status-codes';
import { getOptions } from './options';
import { Config, ServerCapabilities } from './types';
import { createDebug } from './debug';

const debug = createDebug('httpClient');

export async function getRemoteConfig(configName: string, version: number | 'latest'): Promise<Config> {
  const { configServerUrl } = getOptions();
  const url = `${configServerUrl}/config/${configName}/${version}`;
  const { body, statusCode } = await request(url);

  assert(statusCode === StatusCodes.OK, `Failed to fetch config from ${url}`);

  return (await body.json()) as Config;
}

export async function getServerCapabilities(): Promise<ServerCapabilities> {
  const { configServerUrl } = getOptions();
  const url = `${configServerUrl}/capabilities`;
  const { body, statusCode } = await request(url);

  assert(statusCode === StatusCodes.OK, `Failed to fetch capabilities from ${url}`);

  return (await body.json()) as ServerCapabilities;
}
