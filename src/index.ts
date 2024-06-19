import assert from 'node:assert';
import deepmerge from 'deepmerge';
import { typeSymbol } from '@map-colonies/schemas/build/schemas/symbol';
import { readPackageJsonSync } from '@map-colonies/read-pkg';
import configPkg from 'config';
import semver from 'semver';
import _, { type GetFieldType } from 'lodash';
import { JSONSchema } from '@apidevtools/json-schema-ref-parser';
import { getEnvValues } from './env';
import { BaseOptions, ConfigOptions, ConfigReturnType } from './types';
import { loadSchema } from './schemas';
import { getOptions, initializeOptions } from './options';
import { getRemoteConfig, getServerCapabilities } from './httpClient';
import { ajvConfigValidator } from './validator';
import { createDebug } from './debug';

const debug  = createDebug('index');

const schemasPackagePath = require.resolve('@map-colonies/schemas').substring(0, require.resolve('@map-colonies/schemas').indexOf('build'));
const schemasPackageVersion = readPackageJsonSync(schemasPackagePath + 'package.json').version as string;

async function config<T extends JSONSchema & { [typeSymbol]: unknown }>(options: ConfigOptions<T>): Promise<ConfigReturnType<T>> {
  const { schema: baseSchema, ...unvalidatedOptions } = options;
  const { configName, offlineMode, version, ignoreServerIsOlderVersionError } = initializeOptions(unvalidatedOptions);

  let remoteConfig: object | T = {};

  if (!offlineMode) {
    const capabilitiesResponse = await getServerCapabilities();

    assert(!ignoreServerIsOlderVersionError && semver.lt(schemasPackageVersion, capabilitiesResponse.schemasPackageVersion), `Server is using an older version of the schemas package`);

    const serverConfigResponse = await getRemoteConfig(configName, version);

    assert(typeof baseSchema !== 'boolean' && serverConfigResponse.schemaId === baseSchema.$id, `Schema ID mismatch`);

    remoteConfig = serverConfigResponse.config;
  }
  const dereferencedSchema = await loadSchema(baseSchema);

  const localConfig = configPkg.util.loadFileConfigs('../config') as { [key: string]: unknown };

  const envConfig = getEnvValues(dereferencedSchema);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  const mergedConfig = deepmerge.all([localConfig, remoteConfig, envConfig], { arrayMerge: (destinationArray, sourceArray) => sourceArray });

  const isValid = ajvConfigValidator.validate(dereferencedSchema, mergedConfig);
  if (!isValid) {
    console.log(ajvConfigValidator);
    throw new Error('Invalid config');
  }

  Object.freeze(mergedConfig);

  function get<TPath extends string>(path: TPath): GetFieldType<T[typeof typeSymbol], TPath> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return _.get(mergedConfig as (typeof baseSchema)[typeof typeSymbol], path);
  }

  function getAll(): ReturnType<ConfigReturnType<T>['getAll']> {
    return mergedConfig;
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

// const config = new Config(commonBoilerplateV1,'avi');
// const res = config.get('telemetry.logger');

// (async () => {
//   const fconfig = await config({
//     configServerUrl: 'http://localhost:8080',
//     schema: commonDbFullV1,
//     configName: 'test-db',
//     version: 'latest',
//   });
//   const res2 = fconfig.getAll();
//   const res3 = fconfig.get('ssl');
//   console.log(res2);

//   // console.log(res2);
// })().catch(console.error);
