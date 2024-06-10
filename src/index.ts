import assert, { strictEqual } from 'node:assert';
import EventEmitter from 'node:events';
import path from 'node:path';
import fs from 'node:fs';
import deepmerge from 'deepmerge';
import { typeSymbol } from '@map-colonies/schemas/build/schemas/symbol';
import configPkg from 'config';
import { commonBoilerplateV1, commonDbFullV1, commonDbPartialV1 } from '@map-colonies/schemas';
import { JSONSchema } from 'json-schema-to-ts';
import _, { GetFieldType } from 'lodash';
import { request } from 'undici';
import type TypedEmitter from 'typed-emitter';
import Ajv, { AnySchemaObject, ErrorObject, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import $RefParser from '@apidevtools/json-schema-ref-parser';

interface MessageEvents {
  error: (error: Error) => void;
  update: () => void;
}

const SCHEMA_DOMAIN = 'https://mapcolonies.com/';

interface Config {
  configName: string;
  schemaId: string;
  version: number;
  config: {
    [key: string]: unknown;
  };
  createdAt: number;
  createdBy: string;
}

interface ConfigOptions<
  T extends JSONSchema & {
    [typeSymbol]: unknown;
  }
> {
  schema: T;
  configName: string;
  version: 'latest' | number;
  configServerUrl?: string;
  offlineMode?: boolean;
  token?: string;
  debug?: boolean;
}

const schemasPackageResolvedPath = require.resolve('@map-colonies/schemas');
const schemasBasePath = schemasPackageResolvedPath.substring(0, schemasPackageResolvedPath.lastIndexOf('/'));

const ajv = addFormats(
  new Ajv({
    useDefaults: true,
  }),
  ['date-time', 'time', 'date', 'email', 'hostname', 'ipv4', 'ipv6', 'uri', 'uuid', 'regex', 'uri-template']
);

const refParser = new $RefParser();

function loadSpecificSchema(relativePath: string): JSONSchema {
  const fullPath = path.join(schemasBasePath, relativePath + '.schema.json');

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Schema file not found: ${fullPath}`);
  }

  return JSON.parse(fs.readFileSync(fullPath, { encoding: 'utf-8' })) as JSONSchema;
}

async function loadSchema(schema: JSONSchema): ReturnType<typeof refParser.dereference> {
  const dereferencedSchema = await refParser.dereference(schema, {
    dereference: { circular: false },
    resolve: {
      mapcolonies: {
        canRead: /^https:\/\/mapcolonies.com\/.*/,
        order: 1,
        read: (file: { url: string; hash: string; extension: string }) => {
          const subPath = file.url.split(SCHEMA_DOMAIN)[1];

          return loadSpecificSchema(subPath);
        },
      },
    },
  });
  return dereferencedSchema;
}

async function config<T extends JSONSchema & { [typeSymbol]: unknown }>(options: ConfigOptions<T>) {
  const { configName, configServerUrl, version, schema: baseSchema } = options;

  const url = `${configServerUrl}/config/${configName}/${version}`;
  const { body, statusCode } = await request(url);

  assert(statusCode === 200, `Failed to fetch config from ${url}`);

  const config = (await body.json()) as Config;

  assert(typeof baseSchema !== 'boolean' && config.schemaId === baseSchema.$id, `Schema ID mismatch`);
  const dereferencedSchema = await loadSchema(baseSchema);
  console.log(dereferencedSchema);

  const localConfig = configPkg.util.loadFileConfigs('../config') as { [key: string]: unknown };

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  const mergedConfig = deepmerge.all([localConfig, config.config], { arrayMerge: (destinationArray, sourceArray) => sourceArray });

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

  return { get, getAll };
}

// const config = new Config(commonBoilerplateV1,'avi');
// const res = config.get('telemetry.logger');

(async () => {
  const fconfig = await config({
    configServerUrl: 'http://localhost:8080',
    schema: commonDbFullV1,
    configName: 'test-db',
    version: 'latest',
  });
  const res2 = fconfig.getAll();
  console.log(res2);

  // console.log(res2);
})().catch(console.error);
