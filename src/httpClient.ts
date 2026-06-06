import { Dispatcher, request } from 'undici';
import statusCodes from 'http-status-codes';
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

async function requestWrapper(url: string, options: Parameters<typeof request<null>>[1] = undefined): Promise<Dispatcher.ResponseData> {
  debug('Making request to %s', url);
  try {
    const res = await request(url, options);
    if (res.statusCode > statusCodes.NOT_FOUND) {
      debug('Failed to fetch config. Status code: %d', res.statusCode);
      throw createConfigError('httpResponseError', 'Failed to fetch', await createHttpErrorPayload(res));
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

export async function getRemoteConfig(
  configName: string,
  schemaId: string,
  version: number | 'latest',
  etag?: string
): Promise<{ config: Config | null; etag: string }> {
  debug('Fetching remote config %s@%s', configName, version);
  const { configServerUrl } = getOptions();
  const url = `${configServerUrl}/config/${configName}/${version}`;

  const headers = etag !== undefined ? { 'If-None-Match': etag } : undefined;
  const queryParams = { schemaId, shouldDereference: 'true' };

  const res = await requestWrapper(url, { query: queryParams, headers });

  if (res.statusCode === statusCodes.NOT_MODIFIED) {
    debug('Config was not modified');
    return { config: null, etag: etag! };
  }

  if (res.statusCode === statusCodes.BAD_REQUEST) {
    debug('Invalid request to getConfig');
    throw createConfigError('httpResponseError', 'Invalid request to getConfig', await createHttpErrorPayload(res));
  }

  if (res.statusCode === statusCodes.NOT_FOUND) {
    debug('Config with given name and version was not found');
    throw createConfigError('httpResponseError', 'Config with given name and version was not found', await createHttpErrorPayload(res));
  }
  debug('Config fetched successfully');

  return { config: (await res.body.json()) as Config, etag: res.headers.etag as string };
}

export async function getServerCapabilities(): Promise<ServerCapabilities> {
  debug('Fetching server capabilities');
  const { configServerUrl } = getOptions();
  const url = `${configServerUrl}/capabilities`;
  const { body } = await requestWrapper(url);

  debug('Server capabilities fetched successfully');
  return (await body.json()) as ServerCapabilities;
}

export async function acquireLock(key: string, callerId: string, limit: number, ttl: number): Promise<{ acquired: boolean; retryAfter?: number }> {
  debug('Acquiring lock for key %s (caller: %s) with limit %d and ttl %d', key, callerId, limit, ttl);
  const { configServerUrl } = getOptions();
  const url = `${configServerUrl}/locks`;

  const res = await request(url, {
    method: 'POST',
    body: JSON.stringify({ key, callerId, limit, ttl }),
    headers: { 'Content-Type': 'application/json' },
  });

  if (res.statusCode === statusCodes.OK) {
    debug('Lock acquired successfully');
    return { acquired: true };
  }

  if (res.statusCode === statusCodes.LOCKED) {
    const retryAfterHeader = res.headers['retry-after'];
    const retryAfter = retryAfterHeader !== undefined ? parseInt(retryAfterHeader as string, 10) : undefined;
    debug('Lock is already held. Retry-after: %d', retryAfter);
    return { acquired: false, retryAfter };
  }

  if (res.statusCode === statusCodes.BAD_REQUEST) {
    debug('Failed to acquire lock. Bad request');
    throw createConfigError('httpResponseError', 'Failed to acquire lock', await createHttpErrorPayload(res));
  }

  debug('Unexpected status code while acquiring lock: %d', res.statusCode);
  return { acquired: false };
}

export async function releaseLock(key: string, callerId: string): Promise<void> {
  debug('Releasing lock for key %s (caller: %s)', key, callerId);
  const { configServerUrl } = getOptions();
  const url = `${configServerUrl}/locks/${key}/${callerId}`;

  try {
    const res = await request(url, { method: 'DELETE' });

    if (res.statusCode === statusCodes.NO_CONTENT) {
      debug('Lock released successfully');
      return;
    }

    if (res.statusCode === statusCodes.BAD_REQUEST) {
      debug('Failed to release lock. Bad request');
      throw createConfigError('httpResponseError', 'Failed to release lock', await createHttpErrorPayload(res));
    }

    debug('Unexpected status code while releasing lock: %d', res.statusCode);
  } catch (error) {
    debug('Error during best-effort lock release (swallowed): %s', (error as Error).message);
  }
}
