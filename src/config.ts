import deepmerge from 'deepmerge';
import { typeSymbol } from '@map-colonies/schemas/build/schemas/symbol';
import configPkg from 'config';
import semver from 'semver';
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
import { initializeMetrics } from './metrics';

const debug = createDebug('config');

// eslint-disable-next-line @typescript-eslint/no-unsafe-return
const arrayMerge: deepmerge.Options['arrayMerge'] = (destinationArray, sourceArray) => sourceArray;

/**
 * Retrieves the configuration based on the provided options.
 *
 * @template T - The type of the configuration schema.
 * @param {ConfigOptions<T>} options - The options for retrieving the configuration.
 * @returns {Promise<ConfigInstance<T>>} - A promise that resolves to the configuration object.
 */
export async function config<T extends { [typeSymbol]: unknown; $id: string }>(
  options: ConfigOptions<T>
): Promise<ConfigInstance<T[typeof typeSymbol]>> {
  // handle package options
  debug('config called with options: %j', { ...options, schema: options.schema.$id });
  const { schema: baseSchema, metricsRegistry, ...unvalidatedOptions } = options;
  const { configName, offlineMode, version, ignoreServerIsOlderVersionError } = initializeOptions(unvalidatedOptions);

  let remoteConfig: object | T = {};

  let serverConfigResponse: Config | undefined = undefined;
  // handle remote config
  if (offlineMode !== true) {
    debug('handling fetching remote data');
    // check if the server is using an older version of the schemas package
    const capabilitiesResponse = await getServerCapabilities();

    if (ignoreServerIsOlderVersionError !== true && semver.gt(LOCAL_SCHEMAS_PACKAGE_VERSION, capabilitiesResponse.schemasPackageVersion)) {
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

    // get the remote config
    serverConfigResponse = await getRemoteConfig(configName, version);

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
  }
  debug('remote config: %j', remoteConfig);

  const dereferencedSchema = await loadSchema(baseSchema);

  const localConfig = configPkg.util.loadFileConfigs(options.localConfigPath) as { [key: string]: unknown };
  debug('local config: %j', localConfig);

  const envConfig = getEnvValues(dereferencedSchema);
  debug('env config: %j', envConfig);

  // merge all the configs into one object with the following priority: localConfig < remoteConfig < envConfig
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  const mergedConfig = deepmerge.all([localConfig, remoteConfig, envConfig], { arrayMerge });
  debug('merged config: %j', mergedConfig);

  // validate the merged config
  const [errors, validatedConfig] = validate(ajvConfigValidator, dereferencedSchema, mergedConfig);
  if (errors) {
    debug('config validation error: %j', errors);
    throw createConfigError('configValidationError', 'Config validation error', errors);
  }

  debug('freezing validated config');
  // freeze the merged config so it can't be modified by the package user
  Object.freeze(validatedConfig);

  if (metricsRegistry) {
    initializeMetrics(metricsRegistry, baseSchema.$id, serverConfigResponse?.version);
  }

  function get<TPath extends string>(path: TPath): GetFieldType<T[typeof typeSymbol], TPath> {
    debug('get called with path: %s', path);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
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

  return { get, getAll, getConfigParts, getResolvedOptions };
}
