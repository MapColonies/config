import deepmerge from 'deepmerge';
import { typeSymbol } from '@map-colonies/schemas/build/schemas/symbol';
import configPkg from 'config';
import { gt, satisfies } from 'semver';
import type { Registry } from 'prom-client';
import lodash, { type GetFieldType } from 'lodash';
import { getEnvValues } from './env';
import { BaseOptions, ConfigOptions, ConfigInstance, Config } from './types';
import { loadSchema } from './schemas';
import { getOptions, initializeOptions } from './options';
import { getRemoteConfig, getServerCapabilities } from './httpClient';
import { ajvConfigValidator, validate } from './validator';
import { createDebug } from './utils/debug';
import { LOCAL_SCHEMAS_PACKAGE_VERSION } from './constants';
import { createConfigError } from './errors';
import { initializeMetrics as initializeMetricsInternal } from './metrics';
import { deepFreeze } from './utils/helpers';
import { ChangeDetector } from './rollout/ChangeDetector';

const debug = createDebug('config');

// eslint-disable-next-line @typescript-eslint/no-unsafe-return
const arrayMerge: deepmerge.Options['arrayMerge'] = (destinationArray, sourceArray) => sourceArray;
const semverSatisfies = '2.x';

/**
 * Retrieves the configuration based on the provided options.
 *
 * If `offlineMode` is not enabled, the SDK starts a background
 * polling mechanism. The returned `ConfigInstance` serves as a live state machine; its `get` and `getAll`
 * methods will return the most recent configuration retrieved from the server during hot-reloads.
 *
 * @template T - The type of the configuration schema.
 * @param {ConfigOptions<T>} options - The options for retrieving the configuration.
 * @returns {Promise<ConfigInstance<T[typeof typeSymbol]>>} - A promise that resolves to the configuration object.
 */
export async function config<T extends { [typeSymbol]: unknown; $id: string }>(
  options: ConfigOptions<T>
): Promise<ConfigInstance<T[typeof typeSymbol]>> {
  // handle package options
  debug('config called with options: %j', { ...options, schema: options.schema.$id });
  const { schema: baseSchema, metricsRegistry, onChange, ...unvalidatedOptions } = options;
  const initOptions = initializeOptions(unvalidatedOptions);
  const { configName, offlineMode, version, ignoreServerIsOlderVersionError, disableHotReload } = initOptions;

  // Load Local and Env Configs First (Independent of remote state)
  const dereferencedSchema = await loadSchema(baseSchema);
  const localConfig = configPkg.util.loadFileConfigs(options.localConfigPath) as { [key: string]: unknown };
  debug('local config: %j', localConfig);
  const envConfig = getEnvValues(dereferencedSchema);
  debug('env config: %j', envConfig);

  /**
   * Function to merge local, remote, and environment configs and validate the merged result against the schema.
   * The precedence order for merging is: local < remote < environment.
   */
  function mergeAndValidate(remoteConfig: object | T): unknown {
    const mergedConfig = deepmerge.all([localConfig, remoteConfig, envConfig], { arrayMerge });
    debug('merged config: %j', mergedConfig);

    // validate the merged config
    const [errors, validatedConfig] = validate(ajvConfigValidator, dereferencedSchema, mergedConfig);
    if (errors) {
      debug('config validation error: %j', errors);
      throw createConfigError('configValidationError', 'Config validation error', errors);
    }

    debug('freezing validated config');
    // freeze the merged config so it can't be modified by the package user and to ensure that the config instance always returns the same reference for the same config, which is important for change detection and to prevent unnecessary re-renders in case the config is used in a React application and the user is using the getConfigParts method to get the config and pass it to their components
    deepFreeze(validatedConfig);
    return validatedConfig;
  }

  let changeDetector: ChangeDetector | undefined = undefined;
  let remoteConfig: object | T = {};
  let serverConfigResponse: Config | undefined = undefined;
  let validatedConfig: ReturnType<typeof mergeAndValidate>;

  // Handle Remote Config and Polling
  if (!offlineMode) {
    debug('handling fetching remote data');
    // check if the server is using an older version of the schemas package
    const capabilitiesResponse = await getServerCapabilities();

    if (!satisfies(capabilitiesResponse.serverVersion, semverSatisfies)) {
      debug('server version does not satisfy the required version. remote: %s, required: %s', capabilitiesResponse.serverVersion, semverSatisfies);
      throw createConfigError('serverVersionMismatchError', 'The server version does not satisfy the required version.', {
        remoteServerVersion: capabilitiesResponse.serverVersion,
        localServerVersion: semverSatisfies,
        satisfies: semverSatisfies,
      });
    }
    if (!ignoreServerIsOlderVersionError && gt(LOCAL_SCHEMAS_PACKAGE_VERSION, capabilitiesResponse.schemasPackageVersion)) {
      debug(
        'server is using an older version of the schemas package. local: %s, remote: %s',
        LOCAL_SCHEMAS_PACKAGE_VERSION,
        capabilitiesResponse.schemasPackageVersion
      );
      throw createConfigError(
        'schemasPackageVersionMismatchError',
        'The server is using an older version of the schemas package. Please update the server to the latest version or ignore this error by setting the CONFIG_IGNORE_SERVER_IS_OLDER_VERSION_ERROR environment variable.',
        {
          localPackageVersion: LOCAL_SCHEMAS_PACKAGE_VERSION,
          remotePackageVersion: capabilitiesResponse.schemasPackageVersion,
        }
      );
    }

    // get the initial remote config
    const remoteResponse = await getRemoteConfig(configName, options.schema.$id, version);
    serverConfigResponse = remoteResponse.config!;
    const currentEtag = remoteResponse.etag;

    if (serverConfigResponse.schemaId !== baseSchema.$id) {
      debug('schema version mismatch. local: %s, remote: %s', baseSchema.$id, serverConfigResponse.schemaId);
      throw createConfigError(
        'schemaVersionMismatchError',
        'The schema version of the remote config does not match the schema version of the local config',
        {
          localSchemaVersion: baseSchema.$id,
          remoteSchemaVersion: serverConfigResponse.schemaId,
        }
      );
    }

    remoteConfig = serverConfigResponse.config;
    debug('remote config: %j', remoteConfig);

    validatedConfig = mergeAndValidate(remoteConfig);

    // Setup polling
    if (!disableHotReload) {
      changeDetector = new ChangeDetector(baseSchema.$id, initOptions, currentEtag, onChange);
      changeDetector.start();
    }
  } else {
    // If offline, bypass remote and just merge local/env
    validatedConfig = mergeAndValidate({});
  }

  function get<TPath extends string>(path: TPath): GetFieldType<T[typeof typeSymbol], TPath> {
    debug('get called with path: %s', path);
    return lodash.get(validatedConfig as (typeof baseSchema)[typeof typeSymbol], path);
  }

  function getAll(): ReturnType<ConfigInstance<T[typeof typeSymbol]>['getAll']> {
    debug('getAll called');
    return validatedConfig;
  }

  function getConfigParts(): ReturnType<ConfigInstance<T>['getConfigParts']> {
    debug('getConfigParts called');
    return {
      localConfig,
      config: remoteConfig,
      envConfig,
    };
  }

  function getResolvedOptions(): BaseOptions {
    debug('getResolvedOptions called');
    return getOptions();
  }

  function initializeMetrics(registry: Registry): void {
    initializeMetricsInternal(registry, baseSchema.$id, serverConfigResponse?.version);
  }

  function stop(): void {
    debug('stop called');
    if (changeDetector) {
      changeDetector.stop();
    }
  }

  return { get, getAll, getConfigParts, getResolvedOptions, initializeMetrics, stop };
}
