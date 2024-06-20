import assert from 'node:assert';
import deepmerge from 'deepmerge';
import { typeSymbol } from '@map-colonies/schemas/build/schemas/symbol';
import configPkg from 'config';
import semver from 'semver';
import _, { type GetFieldType } from 'lodash';
import { JSONSchema } from '@apidevtools/json-schema-ref-parser';
import { getEnvValues } from './env';
import { BaseOptions, ConfigOptions, ConfigReturnType } from './types';
import { loadSchema } from './schemas';
import { getOptions, initializeOptions } from './options';
import { getRemoteConfig, getServerCapabilities } from './httpClient';
import { ajvConfigValidator, validate } from './validator';
import { createDebug } from './debug';
import { LOCAL_SCHEMAS_PACKAGE_VERSION } from './constants';
import { createConfigError } from './errors';

const debug = createDebug('config');

// eslint-disable-next-line @typescript-eslint/no-unsafe-return
const arrayMerge: deepmerge.Options['arrayMerge'] = (destinationArray, sourceArray) => sourceArray;

export async function config<T extends JSONSchema & { [typeSymbol]: unknown }>(options: ConfigOptions<T>): Promise<ConfigReturnType<T>> {
  // handle package options
  const { schema: baseSchema, ...unvalidatedOptions } = options;
  const { configName, offlineMode, version, ignoreServerIsOlderVersionError } = initializeOptions(unvalidatedOptions);

  let remoteConfig: object | T = {};

  // handle remote config
  if (!offlineMode) {
    // check if the server is using an older version of the schemas package
    const capabilitiesResponse = await getServerCapabilities();

    if (!ignoreServerIsOlderVersionError && semver.gt(LOCAL_SCHEMAS_PACKAGE_VERSION, capabilitiesResponse.schemasPackageVersion)) {
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
    const serverConfigResponse = await getRemoteConfig(configName, version);

    if (typeof baseSchema !== 'boolean' && serverConfigResponse.schemaId !== baseSchema.$id) {
      throw createConfigError(
        'schemaVersionMismatchError',
        'The schema version of the remote config does not match the schema version of the local config',
        {
          localSchemaVersion: baseSchema.$id as string,
          remoteSchemaVersion: serverConfigResponse.schemaId,
        }
      );
    }

    remoteConfig = serverConfigResponse.config;
  }

  const dereferencedSchema = await loadSchema(baseSchema);

  const localConfig = configPkg.util.loadFileConfigs('../config') as { [key: string]: unknown };

  const envConfig = getEnvValues(dereferencedSchema);

  // merge all the configs into one object with the following priority: localConfig < remoteConfig < envConfig
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  const mergedConfig = deepmerge.all([localConfig, remoteConfig, envConfig], { arrayMerge });

  // validate the merged config
  const [errors, validatedConfig] = validate(ajvConfigValidator, dereferencedSchema, mergedConfig);
  if (errors) {
    throw createConfigError('configValidationError', 'Config validation error', errors);
  }

  // freeze the merged config so it can't be modified by the package user
  Object.freeze(validatedConfig);

  function get<TPath extends string>(path: TPath): GetFieldType<T[typeof typeSymbol], TPath> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return _.get(validatedConfig as (typeof baseSchema)[typeof typeSymbol], path);
  }

  function getAll(): ReturnType<ConfigReturnType<T>['getAll']> {
    return validatedConfig;
  }

  function getConfigParts(): ReturnType<ConfigReturnType<T>['getConfigParts']> {
    return {
      localConfig,
      config: remoteConfig,
      envConfig,
    };
  }

  function getResolvedOptions(): BaseOptions {
    return getOptions();
  }

  return { get, getAll, getConfigParts, getResolvedOptions };
}
