import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import StatusCodes from 'http-status-codes';
import deepmerge from 'deepmerge';
import { typeSymbol } from '@map-colonies/schemas/build/schemas/symbol';
import configPkg from 'config';
import { commonBoilerplateV1, commonDbFullV1, commonDbPartialV1, commonS3PartialV1 } from '@map-colonies/schemas';
import _, { GetFieldType } from 'lodash';
import { request } from 'undici';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import $RefParser, { JSONSchema } from '@apidevtools/json-schema-ref-parser';
import { parseSchemaEnv } from './envParser';
import { Config, ConfigOptions } from './types';
import { loadSchema } from './schemas';

const ajv = addFormats(
  new Ajv({
    useDefaults: true,
  }),
  ['date-time', 'time', 'date', 'email', 'hostname', 'ipv4', 'ipv6', 'uri', 'uuid', 'regex', 'uri-template']
);

function getEnvValues(schema: JSONSchema): object {
  const res = {};

  const envMap = parseSchemaEnv(schema);
  for (const [key, details] of Object.entries(envMap)) {
    const unparsedValue = process.env[key];
    if (unparsedValue !== undefined) {
      let value: unknown;

      switch (details.type) {
        case 'boolean':
          value = value === 'true';
          break;
        case 'integer':
          value = parseInt(unparsedValue);
          break;
        case 'number':
          value = parseFloat(unparsedValue);
          break;
        case 'null':
          value = null;
          break;
        default:
          value = unparsedValue;
      }

      _.set(res, details.path, value);
    }
  }

  return res;
}

async function config<T extends JSONSchema & { [typeSymbol]: unknown }>(options: ConfigOptions<T>) {
  const { configName, configServerUrl, version, schema: baseSchema } = options;

  assert(typeof baseSchema !== 'boolean' && config.schemaId === baseSchema.$id, `Schema ID mismatch`);
  const dereferencedSchema = await loadSchema(baseSchema);
  console.log(dereferencedSchema);

  const localConfig = configPkg.util.loadFileConfigs('../config') as { [key: string]: unknown };

  const envConfig = getEnvValues(dereferencedSchema);

  const mergedConfig = deepmerge.all([localConfig, config.config, envConfig], { arrayMerge: (destinationArray, sourceArray) => sourceArray });

  const isValid = ajv.validate(dereferencedSchema, mergedConfig);
  if (!isValid) {
    console.log(ajv.errors);
    throw new Error('Invalid config');
  }

  Object.freeze(mergedConfig);

  function get<TPath extends string>(path: TPath): GetFieldType<T[typeof typeSymbol], TPath> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return _.get(mergedConfig as (typeof baseSchema)[typeof typeSymbol], path);
  }

  function getAll(): T[typeof typeSymbol] {
    return mergedConfig;
  }

  function getConfigParts(): { localConfig: { [key: string]: unknown }; config: T; envConfig: object } {
    return {
      localConfig,
      config: config.config as T,
      envConfig,
    };
  }

  return { get, getAll, getConfigParts };
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
