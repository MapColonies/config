import { JSONSchema } from '@apidevtools/json-schema-ref-parser';
import { typeSymbol } from '@map-colonies/schemas/build/schemas/symbol';
import { Static, Type } from '@sinclair/typebox';

export type EnvType = 'number' | 'string' | 'boolean' | 'integer' | 'null';

export interface EnvDetails {
  type: EnvType;
  path: string;
}

export type EnvMap = Record<string, EnvDetails>;

export interface Config {
  configName: string;
  schemaId: string;
  version: number;
  config: {
    [key: string]: unknown;
  };
  createdAt: number;
  createdBy: string;
}

export interface ServerCapabilities {
  serverVersion: string;
  schemasPackageVersion: string;
  pubSubEnabled: boolean;
}

export const optionsSchema = Type.Object({
  configName: Type.String(),
  version: Type.Union([Type.Literal('latest'), Type.Number()], { default: 'latest' }),
  configServerUrl: Type.String({default: 'http://localhost:8080', pattern: '^https?://.*$'}),
  offlineMode: Type.Boolean({default: false}),
  ignoreServerIsOlderVersionError: Type.Boolean({default: false}),
  // token: Type.Optional(Type.String()),
});

export type BaseOptions = Static<typeof optionsSchema>;

export type ConfigOptions<
T extends JSONSchema & {
  [typeSymbol]: unknown;
}
> =  {
  schema: T;
} & BaseOptions;

export interface ConfigReturnType<
  T extends JSONSchema & {
    [typeSymbol]: unknown;
  }
> {
  get: <TPath extends string>(path: TPath) => _.GetFieldType<T[typeof typeSymbol], TPath>;
  getAll: () => T[typeof typeSymbol];
  getConfigParts: () => {
    localConfig: object;
    config: object;
    envConfig: object;
  };
  getResolvedOptions: () => BaseOptions;

}
