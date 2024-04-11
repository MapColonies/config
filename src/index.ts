/* eslint-disable */

import type { typeSymbol } from '@map-colonies/schemas/build/schemas/symbol';
import { commonBoilerplateV1, type commonBoilerplateV1Type } from '@map-colonies/schemas';
import type { JSONSchema } from 'json-schema-to-ts';
import _, { GetFieldType } from 'lodash';
import EventEmitter from 'node:events';
import type TypedEmitter from 'typed-emitter';

type MessageEvents = {
  error: (error: Error) => void;
  update: () => void;
};

class Config<T extends JSONSchema & { [typeSymbol]: unknown }> extends (EventEmitter as new () => TypedEmitter<MessageEvents>) {
  public constructor(public schema: T, options?: {
    configUrl?: string;
    token?: string;
    debug?: boolean;
  }) {
    super();
  }

  public getConfig(): T[typeof typeSymbol] {
    return {};
  }

  public async loadConfig(): Promise<void> {}

  // @ts-expect-error
  public get<TPath extends string>(path: TPath): GetFieldType<T[typeof typeSymbol], TPath> {
    return _.get(this.schema[typeSymbol], path);
  }
}

const config = new Config(commonBoilerplateV1);

const res = config.get('telemetry.logger.level');

const b: (typeof commonBoilerplateV1)[typeof typeSymbol] = '';
const c: commonBoilerplateV1Type = '';

const a = _.get(b, 'telemetry.logger');
const aa = _.get(b, 'openapiConfig.filePath');
const aaa = _.get(b, 'server.request.payload.limit');
