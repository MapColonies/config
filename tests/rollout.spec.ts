import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Interceptable, MockAgent, setGlobalDispatcher } from 'undici';
import { commonDbPartialV1 } from '@map-colonies/schemas';
import { StatusCodes } from 'http-status-codes';
import { config } from '../src/config';
import { createMockConfigData } from './mocks';

const URL = 'http://localhost:8080';
const DEFAULT_POLL_INTERVAL = 30000;

describe('Continuous Polling (ChangeDetector)', () => {
  let client: Interceptable;
  const onChangeMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    const agent = new MockAgent();
    agent.disableNetConnect();

    setGlobalDispatcher(agent);
    client = agent.get(URL);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    onChangeMock.mockReset();
  });

  it('should trigger onChange when polling returns a new config (200 OK)', async () => {
    // Arrange
    const initialConfigData = createMockConfigData();
    const newConfigData = createMockConfigData({ config: { host: 'updated-host' }, createdAt: 1 });

    client
      .intercept({ path: '/capabilities', method: 'GET' })
      .reply(StatusCodes.OK, { serverVersion: '2.0.0', schemasPackageVersion: '99.9.9', pubSubEnabled: false });
    client
      .intercept({ path: `/config/name/1?shouldDereference=true&schemaId=${commonDbPartialV1.$id}`, method: 'GET' })
      .reply(StatusCodes.OK, initialConfigData, { headers: { etag: 'etag-1' } });

    // Act
    const configInstance = await config({
      configName: 'name',
      version: 1,
      schema: commonDbPartialV1,
      localConfigPath: './tests/config',
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
    expect(onChangeMock).toHaveBeenCalled();
  });

  it('should resume polling when terminatePod is false', async () => {
    // Arrange
    const initialConfigData = createMockConfigData();
    const newConfigData1 = createMockConfigData({ config: { host: 'updated-host' }, createdAt: 1 });
    const newConfigData2 = createMockConfigData({ config: { host: 'updated-host-again' }, createdAt: 2 });

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
      terminatePod: false,
      onChange: onChangeMock,
    });

    // Assert (Initial State)
    expect(onChangeMock).not.toHaveBeenCalled();

    // Arrange (First config change)
    client
      .intercept({
        path: `/config/name/1?shouldDereference=true&schemaId=${commonDbPartialV1.$id}`,
        method: 'GET',
        headers: { 'if-none-match': 'etag-1' },
      })
      .reply(StatusCodes.OK, newConfigData1, { headers: { etag: 'etag-2' } });

    // Act (Wait for First Poll)
    await vi.advanceTimersByTimeAsync(DEFAULT_POLL_INTERVAL);

    // Assert (First change triggered)
    expect(onChangeMock).toHaveBeenCalledTimes(1);

    // Arrange (Second config change to verify polling resumed)
    client
      .intercept({
        path: `/config/name/1?shouldDereference=true&schemaId=${commonDbPartialV1.$id}`,
        method: 'GET',
        headers: { 'if-none-match': 'etag-2' },
      })
      .reply(StatusCodes.OK, newConfigData2, { headers: { etag: 'etag-3' } });

    // Act (Wait for Second Poll)
    await vi.advanceTimersByTimeAsync(DEFAULT_POLL_INTERVAL);

    // Assert (Second change triggered)
    expect(onChangeMock).toHaveBeenCalledTimes(2);
  });

  it('should not trigger onChange when polling returns 304 Not Modified', async () => {
    // Arrange
    const initialConfigData = createMockConfigData();

    client
      .intercept({ path: '/capabilities', method: 'GET' })
      .reply(StatusCodes.OK, { serverVersion: '2.0.0', schemasPackageVersion: '99.9.9', pubSubEnabled: false });
    client
      .intercept({ path: `/config/name/1?shouldDereference=true&schemaId=${commonDbPartialV1.$id}`, method: 'GET' })
      .reply(StatusCodes.OK, initialConfigData, { headers: { etag: 'etag-1' } });

    // Act
    const configInstance = await config({
      configName: 'name',
      version: 1,
      schema: commonDbPartialV1,
      localConfigPath: './tests/config',
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
    const initialConfigData = createMockConfigData();

    client
      .intercept({ path: '/capabilities', method: 'GET' })
      .reply(StatusCodes.OK, { serverVersion: '2.0.0', schemasPackageVersion: '99.9.9', pubSubEnabled: false });
    client
      .intercept({ path: `/config/name/1?shouldDereference=true&schemaId=${commonDbPartialV1.$id}`, method: 'GET' })
      .reply(StatusCodes.OK, initialConfigData, { headers: { etag: 'etag-1' } });

    const configInstance = await config({
      configName: 'name',
      version: 1,
      schema: commonDbPartialV1,
      localConfigPath: './tests/config',
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
