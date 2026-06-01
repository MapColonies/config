import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Interceptable, MockAgent, setGlobalDispatcher } from 'undici';
import { commonDbPartialV1 } from '@map-colonies/schemas';
import { StatusCodes } from 'http-status-codes';
import { config } from '../src/config';
import { JITTER_PERCENTAGE } from '../src/constants';

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

  it('should trigger onChange when polling returns a new config (200 OK)', async () => {
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
    await vi.advanceTimersByTimeAsync(DEFAULT_POLL_INTERVAL * (1 + JITTER_PERCENTAGE));

    // Assert (Updated State)
    expect(onChangeMock).toHaveBeenCalledTimes(1);
    expect(onChangeMock).toHaveBeenCalledWith(expect.objectContaining({ host: 'updated-host' }));
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
    await vi.advanceTimersByTimeAsync(DEFAULT_POLL_INTERVAL * (1 + JITTER_PERCENTAGE));

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

  it('should apply randomized jitter within boundaries over 10 cycles', async () => {
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

    // Setup 10 mock 304 responses
    client
      .intercept({
        path: `/config/name/1?shouldDereference=true&schemaId=${commonDbPartialV1.$id}`,
        method: 'GET',
      })
      .reply(StatusCodes.NOT_MODIFIED)
      .times(10);

    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

    // Act
    await config({
      configName: 'name',
      version: 1,
      schema: commonDbPartialV1,
      configServerUrl: URL,
      localConfigPath: './tests/config',
      pollIntervalMs: DEFAULT_POLL_INTERVAL,
      onChange: vi.fn(),
    });

    const maxJitter = DEFAULT_POLL_INTERVAL * JITTER_PERCENTAGE;
    const minWait = DEFAULT_POLL_INTERVAL - maxJitter;
    const maxWait = DEFAULT_POLL_INTERVAL + maxJitter;

    // Run 10 cycles
    for (let i = 0; i < 10; i++) {
      // Advance timers by maxWait to definitely trigger the next poll
      await vi.advanceTimersByTimeAsync(maxWait + 1);
    }

    // Assert
    const pollTimeouts = setTimeoutSpy.mock.calls.map((call) => call[1] as number).filter((time) => time >= minWait && time <= maxWait);

    expect(pollTimeouts.length).toBeGreaterThanOrEqual(10);
    pollTimeouts.forEach((time) => {
      expect(time).toBeGreaterThanOrEqual(minWait);
      expect(time).toBeLessThanOrEqual(maxWait);
    });

    setTimeoutSpy.mockRestore();
  });

  it('should not start polling if disableHotReload is true', async () => {
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
    await config({
      configName: 'name',
      version: 1,
      schema: commonDbPartialV1,
      configServerUrl: URL,
      localConfigPath: './tests/config',
      pollIntervalMs: DEFAULT_POLL_INTERVAL,
      onChange: onChangeMock,
      disableHotReload: true,
    });

    // Advance time beyond the polling interval
    await vi.advanceTimersByTimeAsync(DEFAULT_POLL_INTERVAL * (1 + JITTER_PERCENTAGE) + 1);

    // Assert
    expect(onChangeMock).not.toHaveBeenCalled();
  });

  it('should quarantine a failing ETag and not retry it', async () => {
    // Arrange
    const initialConfigData = {
      configName: 'name',
      schemaId: commonDbPartialV1.$id,
      version: 1,
      config: { host: 'initial-host' },
      createdAt: 0,
    };
    const badConfigData = {
      configName: 'name',
      schemaId: commonDbPartialV1.$id,
      version: 1,
      config: { host: 'bad-host' },
      createdAt: 1,
    };

    client
      .intercept({ path: '/capabilities', method: 'GET' })
      .reply(StatusCodes.OK, { serverVersion: '2.0.0', schemasPackageVersion: '99.9.9', pubSubEnabled: false });
    client
      .intercept({ path: `/config/name/1?shouldDereference=true&schemaId=${commonDbPartialV1.$id}`, method: 'GET' })
      .reply(StatusCodes.OK, initialConfigData, { headers: { etag: 'initial-etag' } });

    const onChangeMock = vi.fn().mockImplementation((conf) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (conf.host === 'bad-host') {
        throw new Error('Boom!');
      }
    });

    const configInstance = await config({
      configName: 'name',
      version: 1,
      schema: commonDbPartialV1,
      configServerUrl: URL,
      localConfigPath: './tests/config',
      pollIntervalMs: DEFAULT_POLL_INTERVAL,
      onChange: onChangeMock,
    });

    // Act (Trigger poll with bad config)
    client
      .intercept({
        path: `/config/name/1?shouldDereference=true&schemaId=${commonDbPartialV1.$id}`,
        method: 'GET',
        headers: { 'if-none-match': 'initial-etag' },
      })
      .reply(StatusCodes.OK, badConfigData, { headers: { etag: 'bad-etag' } });

    await vi.advanceTimersByTimeAsync(DEFAULT_POLL_INTERVAL * (1 + JITTER_PERCENTAGE));

    // Assert (Fails once and is quarantined)
    expect(onChangeMock).toHaveBeenCalledTimes(1);
    expect(configInstance.get('host')).toBe('initial-host'); // Should not have updated

    // Act (Poll again with SAME bad config)
    client
      .intercept({
        path: `/config/name/1?shouldDereference=true&schemaId=${commonDbPartialV1.$id}`,
        method: 'GET',
        headers: { 'if-none-match': 'bad-etag' },
      })
      .reply(StatusCodes.OK, badConfigData, { headers: { etag: 'bad-etag' } });

    await vi.advanceTimersByTimeAsync(DEFAULT_POLL_INTERVAL * (1 + JITTER_PERCENTAGE));

    // Assert (Should NOT have called onChangeMock again)
    expect(onChangeMock).toHaveBeenCalledTimes(1);
  });
});
