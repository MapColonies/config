/* eslint-disable */

import { typeSymbol } from '@map-colonies/schemas/build/schemas/symbol';
import configPkg from 'config';
import { commonBoilerplateV1, type commonBoilerplateV1Type } from '@map-colonies/schemas';
import { JSONSchema } from 'json-schema-to-ts';
import _, { GetFieldType } from 'lodash';
import { request } from 'undici';
import EventEmitter from 'node:events';
import type TypedEmitter from 'typed-emitter';
import assert, { strictEqual } from 'node:assert';

type MessageEvents = {
  error: (error: Error) => void;
  update: () => void;
};

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

async function FConfig<T extends JSONSchema & { [typeSymbol]: unknown }>(
  schema: T,
  configName: string,
  version: 'latest' | number = 'latest',
  options?: {
    configServerUrl?: string;
    offlineMode?: boolean;
    token?: string;
    debug?: boolean;
  }
) {
  const url = `${options?.configServerUrl}/config/${configName}/${version}`;
  const { body, statusCode } = await request(url);

  assert(statusCode === 200, `Failed to fetch config from ${url}`);

  const config = (await body.json()) as Config;

  assert(typeof schema !== 'boolean' && config.schemaId === schema.$id, `Schema ID mismatch`);

  console.log(config);
  console.log(configPkg.util.loadFileConfigs('../config'));

  Object.freeze(config.config);

  function get<TPath extends string>(path: TPath): GetFieldType<T[typeof typeSymbol], TPath> {
    return _.get(config.config as (typeof schema)[typeof typeSymbol], path);
  }

  return { get };
}

// const config = new Config(commonBoilerplateV1,'avi');
// const res = config.get('telemetry.logger');

(async () => {
  const fconfig = await FConfig(commonBoilerplateV1, 'test-boilerplate', 'latest', { configServerUrl: 'http://localhost:8080' });
  const res2 = fconfig.get('telemetry.logger');
  // console.log(res2);
})().catch(console.error);
