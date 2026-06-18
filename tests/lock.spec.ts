import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Interceptable, MockAgent, setGlobalDispatcher } from 'undici';
import { commonDbPartialV1 } from '@map-colonies/schemas';
import { StatusCodes } from 'http-status-codes';
import { config } from '../src/config';
import { JITTER_PERCENTAGE } from '../src/constants';
import * as httpClient from '../src/httpClient';
import { createMockConfigData } from './mocks';

const URL = 'http://localhost:8080';
const DEFAULT_POLL_INTERVAL = 30000;

describe('Distributed Semaphore Locking', () => {
  let client: Interceptable;
  const onChangeMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    const agent = new MockAgent();
    agent.disableNetConnect();

    setGlobalDispatcher(agent);
    client = agent.get(URL);

    // Add default mock for lock release on startup
    client
      .intercept({ path: /\/locks\/.*/, method: 'DELETE' })
      .reply(StatusCodes.NO_CONTENT)
      .persist();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('when terminatePod is false, should acquire lock before onChange and release it after', async () => {
    // Arrange
    const initialConfigData = createMockConfigData();
    const newConfigData = createMockConfigData({ config: { host: 'updated-host' }, createdAt: 1 });

    // Cold-start requests
    client
      .intercept({ path: '/capabilities', method: 'GET' })
      .reply(StatusCodes.OK, { serverVersion: '2.0.0', schemasPackageVersion: '99.9.9', pubSubEnabled: false });
    client
      .intercept({ path: `/config/name/1?shouldDereference=true&schemaId=${commonDbPartialV1.$id}`, method: 'GET' })
      .reply(StatusCodes.OK, initialConfigData, { headers: { etag: 'etag-1' } });

    // Act
    await config({
      configName: 'name',
      version: 1,
      schema: commonDbPartialV1,
      localConfigPath: './tests/config',
      onChange: onChangeMock,
      rolloutKey: 'my-lock',
      callerId: 'my-caller',
      terminatePod: false,
    });

    // Arrange (Hot-reload triggers)
    client
      .intercept({
        path: `/config/name/1?shouldDereference=true&schemaId=${commonDbPartialV1.$id}`,
        method: 'GET',
        headers: { 'if-none-match': 'etag-1' },
      })
      .reply(StatusCodes.OK, newConfigData, { headers: { etag: 'etag-2' } });

    // Mock Lock Acquisition
    client
      .intercept({
        path: '/locks',
        method: 'POST',
        body: JSON.stringify({ key: 'my-lock', callerId: 'my-caller', limit: 1, ttl: 20 }),
      })
      .reply(StatusCodes.OK);

    // Mock Lock Release
    client.intercept({ path: '/locks/my-lock/my-caller', method: 'DELETE' }).reply(StatusCodes.NO_CONTENT);

    // Act (Wait for Poll)
    await vi.advanceTimersByTimeAsync(DEFAULT_POLL_INTERVAL * (1 + JITTER_PERCENTAGE));
    await vi.waitFor(() => expect(onChangeMock).toHaveBeenCalled());

    // Assert
    expect(onChangeMock).toHaveBeenCalled();
  });

  it('when terminatePod is true, should acquire lock before onChange and not release it after', async () => {
    // Arrange
    const initialConfigData = createMockConfigData();
    const newConfigData = createMockConfigData({ config: { host: 'updated-host' }, createdAt: 1 });

    // Cold-start requests
    client
      .intercept({ path: '/capabilities', method: 'GET' })
      .reply(StatusCodes.OK, { serverVersion: '2.0.0', schemasPackageVersion: '99.9.9', pubSubEnabled: false });
    client
      .intercept({ path: `/config/name/1?shouldDereference=true&schemaId=${commonDbPartialV1.$id}`, method: 'GET' })
      .reply(StatusCodes.OK, initialConfigData, { headers: { etag: 'etag-1' } });

    const releaseSpy = vi.spyOn(httpClient, 'releaseLock');

    // Act
    await config({
      configName: 'name',
      version: 1,
      schema: commonDbPartialV1,
      localConfigPath: './tests/config',
      onChange: onChangeMock,
      rolloutKey: 'my-lock',
      callerId: 'my-caller',
      terminatePod: true,
    });

    // Arrange (Hot-reload triggers)
    client
      .intercept({
        path: `/config/name/1?shouldDereference=true&schemaId=${commonDbPartialV1.$id}`,
        method: 'GET',
        headers: { 'if-none-match': 'etag-1' },
      })
      .reply(StatusCodes.OK, newConfigData, { headers: { etag: 'etag-2' } });

    // Mock Lock Acquisition
    client
      .intercept({
        path: '/locks',
        method: 'POST',
        body: JSON.stringify({ key: 'my-lock', callerId: 'my-caller', limit: 1, ttl: 20 }),
      })
      .reply(StatusCodes.OK);

    // Act (Wait for Poll)
    await vi.advanceTimersByTimeAsync(DEFAULT_POLL_INTERVAL * (1 + JITTER_PERCENTAGE));
    await vi.waitFor(() => expect(onChangeMock).toHaveBeenCalled());

    // Assert
    expect(onChangeMock).toHaveBeenCalled();
    // Verify release was only called once (during cold-start)
    expect(releaseSpy).toHaveBeenCalledTimes(1);
  });

  it('should release the lock during initial cold-start', async () => {
    // Arrange
    const initialConfigData = createMockConfigData({ config: { host: 'initial-host' } });

    client
      .intercept({ path: '/capabilities', method: 'GET' })
      .reply(StatusCodes.OK, { serverVersion: '2.0.0', schemasPackageVersion: '99.9.9', pubSubEnabled: false });
    client
      .intercept({ path: `/config/name/1?shouldDereference=true&schemaId=${commonDbPartialV1.$id}`, method: 'GET' })
      .reply(StatusCodes.OK, initialConfigData, { headers: { etag: 'etag-1' } });

    const releaseSpy = vi.spyOn(httpClient, 'releaseLock');

    // Act
    const configInstance = await config({
      configName: 'name',
      version: 1,
      schema: commonDbPartialV1,
      localConfigPath: './tests/config',
      onChange: onChangeMock,
      rolloutKey: 'my-lock',
      callerId: 'my-caller',
    });

    // Assert
    expect(configInstance.get('host')).toBe('initial-host');
    expect(releaseSpy).toHaveBeenCalledWith('my-lock', 'my-caller');
  });

  it('should wait and retry if lock acquisition returns 423 Locked with Retry-After', async () => {
    // Arrange
    const initialConfigData = createMockConfigData({ config: { host: 'initial-host' } });
    const newConfigData = createMockConfigData({ config: { host: 'updated-host' }, createdAt: 1 });

    client
      .intercept({ path: '/capabilities', method: 'GET' })
      .reply(StatusCodes.OK, { serverVersion: '2.0.0', schemasPackageVersion: '99.9.9', pubSubEnabled: false });
    client
      .intercept({ path: `/config/name/1?shouldDereference=true&schemaId=${commonDbPartialV1.$id}`, method: 'GET' })
      .reply(StatusCodes.OK, initialConfigData, { headers: { etag: 'etag-1' } });

    await config({
      configName: 'name',
      version: 1,
      schema: commonDbPartialV1,
      localConfigPath: './tests/config',
      onChange: onChangeMock,
      rolloutKey: 'my-lock',
      callerId: 'my-caller',
    });

    // Arrange (Hot-reload triggers)
    client
      .intercept({
        path: `/config/name/1?shouldDereference=true&schemaId=${commonDbPartialV1.$id}`,
        method: 'GET',
      })
      .reply(StatusCodes.OK, newConfigData, { headers: { etag: 'etag-2' } });

    // Mock first lock attempt failing with 423
    client.intercept({ path: '/locks', method: 'POST' }).reply(StatusCodes.LOCKED, {}, { headers: { 'retry-after': '2' } });
    // Mock second lock attempt succeeding
    client.intercept({ path: '/locks', method: 'POST' }).reply(StatusCodes.OK);
    client.intercept({ path: '/locks/my-lock/my-caller', method: 'DELETE' }).reply(StatusCodes.NO_CONTENT);

    // Act (Wait for Poll)
    await vi.advanceTimersByTimeAsync(DEFAULT_POLL_INTERVAL * (1 + JITTER_PERCENTAGE));

    // Wait for the retry interval (2 seconds)
    await vi.advanceTimersByTimeAsync(2001);
    await vi.waitFor(() => expect(onChangeMock).toHaveBeenCalled());

    // Assert
    expect(onChangeMock).toHaveBeenCalled();
  });
});
