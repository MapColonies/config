import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Interceptable, MockAgent, setGlobalDispatcher } from 'undici';
import { commonDbPartialV1 } from '@map-colonies/schemas';
import { StatusCodes } from 'http-status-codes';
import { config } from '../src/config';

const URL = 'http://localhost:8080';
const DEFAULT_POLL_INTERVAL = 10000;

describe('Continuous Polling (ChangeDetector)', () => {
  let client: Interceptable;

  beforeEach(() => {
    vi.useFakeTimers();
    const agent = new MockAgent();
    agent.disableNetConnect();

    setGlobalDispatcher(agent);
    client = agent.get(URL);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should trigger onChange and exit when polling returns a new config (200 OK)', async () => {
    // Arrange
    const initialConfigData = {
      configName: 'name',
      schemaId: commonDbPartialV1.$id,
      version: 1,
      config: { host: 'initial-host' },
      createdAt: 0,
    };
    const newConfigData = {
      configName: 'name',
      schemaId: commonDbPartialV1.$id,
      version: 1,
      config: { host: 'updated-host' },
      createdAt: 1,
    };

    client
      .intercept({ path: '/capabilities', method: 'GET' })
      .reply(StatusCodes.OK, { serverVersion: '2.0.0', schemasPackageVersion: '99.9.9', pubSubEnabled: false });
    client
      .intercept({ path: `/config/name/1?shouldDereference=true&schemaId=${commonDbPartialV1.$id}`, method: 'GET' })
      .reply(StatusCodes.OK, initialConfigData, { headers: { etag: 'etag-1' } });

    const onChangeMock = vi.fn();
    const exitMock = vi.spyOn(process, 'exit').mockImplementation(() => {
      return undefined as never;
    });

    // Act
    const configInstance = await config({
      configName: 'name',
      version: 1,
      schema: commonDbPartialV1,
      configServerUrl: URL,
      localConfigPath: './tests/config',
      pollIntervalMs: DEFAULT_POLL_INTERVAL,
      onChange: onChangeMock,
    });

    // Assert (Initial State)
    expect(configInstance.get('host')).toBe('initial-host');
    expect(onChangeMock).not.toHaveBeenCalled();

    // Arrange (Next Poll)
    client
      .intercept({
        path: `/config/name/1?shouldDereference=true&schemaId=${commonDbPartialV1.$id}`,
        method: 'GET',
        headers: { 'if-none-match': 'etag-1' },
      })
      .reply(StatusCodes.OK, newConfigData, { headers: { etag: 'etag-2' } });

    // Act (Wait for Poll)
    await vi.advanceTimersByTimeAsync(DEFAULT_POLL_INTERVAL);

    // Assert (Updated State)
    expect(onChangeMock).toHaveBeenCalledTimes(1);
    expect(onChangeMock).toHaveBeenCalledWith();
    expect(exitMock).toHaveBeenCalledWith(0);
  });

  it('should exit when polling returns a new config (200 OK) and onChange is not provided', async () => {
    // Arrange
    const initialConfigData = {
      configName: 'name',
      schemaId: commonDbPartialV1.$id,
      version: 1,
      config: { host: 'initial-host' },
      createdAt: 0,
    };
    const newConfigData = {
      configName: 'name',
      schemaId: commonDbPartialV1.$id,
      version: 1,
      config: { host: 'updated-host' },
      createdAt: 1,
    };

    client
      .intercept({ path: '/capabilities', method: 'GET' })
      .reply(StatusCodes.OK, { serverVersion: '2.0.0', schemasPackageVersion: '99.9.9', pubSubEnabled: false });
    client
      .intercept({ path: `/config/name/1?shouldDereference=true&schemaId=${commonDbPartialV1.$id}`, method: 'GET' })
      .reply(StatusCodes.OK, initialConfigData, { headers: { etag: 'etag-1' } });

    const exitMock = vi.spyOn(process, 'exit').mockImplementation(() => {
      return undefined as never;
    });

    // Act
    await config({
      configName: 'name',
      version: 1,
      schema: commonDbPartialV1,
      configServerUrl: URL,
      localConfigPath: './tests/config',
      pollIntervalMs: DEFAULT_POLL_INTERVAL,
    });

    // Arrange (Next Poll)
    client
      .intercept({
        path: `/config/name/1?shouldDereference=true&schemaId=${commonDbPartialV1.$id}`,
        method: 'GET',
        headers: { 'if-none-match': 'etag-1' },
      })
      .reply(StatusCodes.OK, newConfigData, { headers: { etag: 'etag-2' } });

    // Act (Wait for Poll)
    await vi.advanceTimersByTimeAsync(DEFAULT_POLL_INTERVAL);

    // Assert
    expect(exitMock).toHaveBeenCalledWith(0);
  });

  it('should exit even if onChange throws an error', async () => {
    // Arrange
    const initialConfigData = {
      configName: 'name',
      schemaId: commonDbPartialV1.$id,
      version: 1,
      config: { host: 'initial-host' },
      createdAt: 0,
    };
    const newConfigData = {
      configName: 'name',
      schemaId: commonDbPartialV1.$id,
      version: 1,
      config: { host: 'updated-host' },
      createdAt: 1,
    };

    client
      .intercept({ path: '/capabilities', method: 'GET' })
      .reply(StatusCodes.OK, { serverVersion: '2.0.0', schemasPackageVersion: '99.9.9', pubSubEnabled: false });
    client
      .intercept({ path: `/config/name/1?shouldDereference=true&schemaId=${commonDbPartialV1.$id}`, method: 'GET' })
      .reply(StatusCodes.OK, initialConfigData, { headers: { etag: 'etag-1' } });

    const onChangeMock = vi.fn().mockRejectedValue(new Error('onChange error'));
    const exitMock = vi.spyOn(process, 'exit').mockImplementation(() => {
      return undefined as never;
    });

    // Act
    await config({
      configName: 'name',
      version: 1,
      schema: commonDbPartialV1,
      configServerUrl: URL,
      localConfigPath: './tests/config',
      pollIntervalMs: DEFAULT_POLL_INTERVAL,
      onChange: onChangeMock,
    });

    // Arrange (Next Poll)
    client
      .intercept({
        path: `/config/name/1?shouldDereference=true&schemaId=${commonDbPartialV1.$id}`,
        method: 'GET',
        headers: { 'if-none-match': 'etag-1' },
      })
      .reply(StatusCodes.OK, newConfigData, { headers: { etag: 'etag-2' } });

    // Act (Wait for Poll)
    await vi.advanceTimersByTimeAsync(DEFAULT_POLL_INTERVAL);

    // Assert
    expect(onChangeMock).toHaveBeenCalledTimes(1);
    expect(exitMock).toHaveBeenCalledWith(0);
  });

  it('should not trigger onChange when polling returns 304 Not Modified', async () => {
    // Arrange
    const initialConfigData = {
      configName: 'name',
      schemaId: commonDbPartialV1.$id,
      version: 1,
      config: { host: 'initial-host' },
      createdAt: 0,
    };

    client
      .intercept({ path: '/capabilities', method: 'GET' })
      .reply(StatusCodes.OK, { serverVersion: '2.0.0', schemasPackageVersion: '99.9.9', pubSubEnabled: false });
    client
      .intercept({ path: `/config/name/1?shouldDereference=true&schemaId=${commonDbPartialV1.$id}`, method: 'GET' })
      .reply(StatusCodes.OK, initialConfigData, { headers: { etag: 'etag-1' } });

    const onChangeMock = vi.fn();

    // Act
    const configInstance = await config({
      configName: 'name',
      version: 1,
      schema: commonDbPartialV1,
      configServerUrl: URL,
      localConfigPath: './tests/config',
      pollIntervalMs: DEFAULT_POLL_INTERVAL,
      onChange: onChangeMock,
    });

    // Arrange (Setup 304 response)
    client
      .intercept({
        path: `/config/name/1?shouldDereference=true&schemaId=${commonDbPartialV1.$id}`,
        method: 'GET',
        headers: { 'if-none-match': 'etag-1' },
      })
      .reply(StatusCodes.NOT_MODIFIED);

    // Act (Wait for Poll)
    await vi.advanceTimersByTimeAsync(DEFAULT_POLL_INTERVAL);

    // Assert
    expect(onChangeMock).not.toHaveBeenCalled();
    expect(configInstance.get('host')).toBe('initial-host');
  });

  it('should stop polling when stop is called', async () => {
    // Arrange
    const initialConfigData = {
      configName: 'name',
      schemaId: commonDbPartialV1.$id,
      version: 1,
      config: { host: 'initial-host' },
      createdAt: 0,
    };

    client
      .intercept({ path: '/capabilities', method: 'GET' })
      .reply(StatusCodes.OK, { serverVersion: '2.0.0', schemasPackageVersion: '99.9.9', pubSubEnabled: false });
    client
      .intercept({ path: `/config/name/1?shouldDereference=true&schemaId=${commonDbPartialV1.$id}`, method: 'GET' })
      .reply(StatusCodes.OK, initialConfigData, { headers: { etag: 'etag-1' } });

    const onChangeMock = vi.fn();

    const configInstance = await config({
      configName: 'name',
      version: 1,
      schema: commonDbPartialV1,
      configServerUrl: URL,
      localConfigPath: './tests/config',
      pollIntervalMs: DEFAULT_POLL_INTERVAL,
      onChange: onChangeMock,
    });

    // Act
    configInstance.stop();

    // Advance time beyond the polling interval
    await vi.advanceTimersByTimeAsync(DEFAULT_POLL_INTERVAL * 2);

    // Assert
    expect(onChangeMock).not.toHaveBeenCalled();
  });
});
