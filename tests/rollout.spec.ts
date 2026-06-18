import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Interceptable, MockAgent, setGlobalDispatcher } from 'undici';
import { commonDbPartialV1 } from '@map-colonies/schemas';
import { StatusCodes } from 'http-status-codes';
import { random } from 'lodash';
import { config } from '../src/config';
import { JITTER_PERCENTAGE } from '../src/constants';
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

    // Add default mock for lock release on startup
    client
      .intercept({ path: /\/locks\/.*/, method: 'DELETE' })
      .reply(StatusCodes.NO_CONTENT)
      .persist();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
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
    await vi.advanceTimersByTimeAsync(DEFAULT_POLL_INTERVAL * 2);

    // Assert (Updated State)
    expect(onChangeMock).toHaveBeenCalled();
  });

  it('should stop polling when found new config and terminatePod is true', async () => {
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
    await config({
      configName: 'name',
      version: 1,
      schema: commonDbPartialV1,
      localConfigPath: './tests/config',
      terminatePod: true,
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
      .reply(StatusCodes.OK, newConfigData, { headers: { etag: 'etag-2' } });

    // Act (Wait for First Poll)
    await vi.advanceTimersByTimeAsync(DEFAULT_POLL_INTERVAL * 2);

    // Assert (First change triggered)
    expect(onChangeMock).toHaveBeenCalledTimes(1);

    // Act (Advance time to see if polling continues)
    await vi.advanceTimersByTimeAsync(DEFAULT_POLL_INTERVAL * 2);

    // Assert (Polling stopped, no further calls)
    expect(onChangeMock).toHaveBeenCalledTimes(1);
  });

  it('should resume polling when found new config and terminatePod is false', async () => {
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

    // Act (Wait for Poll)
    await vi.advanceTimersByTimeAsync(DEFAULT_POLL_INTERVAL * (1 + JITTER_PERCENTAGE));

    // Use waitFor to allow async promises to resolve
    await vi.waitFor(() => expect(onChangeMock).toHaveBeenCalled());

    // Assert (Updated State & Hard Termination)
    expect(onChangeMock).toHaveBeenCalled();
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
    await vi.advanceTimersByTimeAsync(DEFAULT_POLL_INTERVAL * (1 + JITTER_PERCENTAGE));

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

  it('should apply randomized jitter within boundaries over 10 cycles', async () => {
    // Arrange
    const initialConfigData = createMockConfigData();

    client
      .intercept({ path: '/capabilities', method: 'GET' })
      .reply(StatusCodes.OK, { serverVersion: '2.0.0', schemasPackageVersion: '99.9.9', pubSubEnabled: false });
    client
      .intercept({ path: `/config/name/1?shouldDereference=true&schemaId=${commonDbPartialV1.$id}`, method: 'GET' })
      .reply(StatusCodes.OK, initialConfigData, { headers: { etag: 'etag-1' } });

    const cycles = random(1, 10); // Random number of cycles to test jitter
    client
      .intercept({
        path: `/config/name/1?shouldDereference=true&schemaId=${commonDbPartialV1.$id}`,
        method: 'GET',
      })
      .reply(StatusCodes.NOT_MODIFIED)
      .times(cycles);

    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

    // Act
    await config({
      configName: 'name',
      version: 1,
      schema: commonDbPartialV1,
      localConfigPath: './tests/config',
      onChange: onChangeMock,
    });

    const maxJitter = DEFAULT_POLL_INTERVAL * JITTER_PERCENTAGE;
    const minWait = DEFAULT_POLL_INTERVAL - maxJitter;
    const maxWait = DEFAULT_POLL_INTERVAL + maxJitter;

    // Run the randomized number of cycles
    for (let i = 0; i < cycles; i++) {
      // Advance timers by maxWait to definitely trigger the next poll
      await vi.advanceTimersByTimeAsync(maxWait + 1);
    }

    // Assert
    const pollTimeouts = setTimeoutSpy.mock.calls.map((call) => call[1] as number).filter((time) => time >= minWait && time <= maxWait);

    expect(pollTimeouts.length).toBeGreaterThanOrEqual(cycles);
    pollTimeouts.forEach((time) => {
      expect(time).toBeGreaterThanOrEqual(minWait);
      expect(time).toBeLessThanOrEqual(maxWait);
    });
  });

  it('should not start polling if disableHotReload is true', async () => {
    // Arrange
    const initialConfigData = createMockConfigData();

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
      disableHotReload: true,
    });

    // Advance time beyond the polling interval
    await vi.advanceTimersByTimeAsync(DEFAULT_POLL_INTERVAL * (1 + JITTER_PERCENTAGE) + 1);

    // Assert
    expect(onChangeMock).not.toHaveBeenCalled();
  });

  it('should trigger onChange and resume polling when polling returns a new config and terminatePod is false', async () => {
    // Arrange
    const initialConfigData = {
      configName: 'name',
      schemaId: commonDbPartialV1.$id,
      version: 1,
      config: { host: 'initial-host' },
      createdAt: 0,
    };
    const newConfigData1 = {
      configName: 'name',
      schemaId: commonDbPartialV1.$id,
      version: 1,
      config: { host: 'updated-host' },
      createdAt: 1,
    };
    const newConfigData2 = {
      configName: 'name',
      schemaId: commonDbPartialV1.$id,
      version: 1,
      config: { host: 'updated-host-again' },
      createdAt: 2,
    };

    client
      .intercept({ path: '/capabilities', method: 'GET' })
      .reply(StatusCodes.OK, { serverVersion: '2.0.0', schemasPackageVersion: '99.9.9', pubSubEnabled: false });
    client
      .intercept({ path: `/config/name/1?shouldDereference=true&schemaId=${commonDbPartialV1.$id}`, method: 'GET' })
      .reply(StatusCodes.OK, initialConfigData, { headers: { etag: 'etag-1' } });

    const onChangeMock = vi.fn();

    // Act
    await config({
      configName: 'name',
      version: 1,
      schema: commonDbPartialV1,
      configServerUrl: URL,
      localConfigPath: './tests/config',
      pollIntervalMs: DEFAULT_POLL_INTERVAL,
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
    await vi.advanceTimersByTimeAsync(DEFAULT_POLL_INTERVAL * 2);

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
    await vi.advanceTimersByTimeAsync(DEFAULT_POLL_INTERVAL * 2);

    // Assert (Second change triggered)
    expect(onChangeMock).toHaveBeenCalledTimes(2);
  });
});
