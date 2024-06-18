import { JSONSchema } from '@apidevtools/json-schema-ref-parser';
import { typeSymbol } from '@map-colonies/schemas/build/schemas/symbol';

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

export interface ConfigOptions<
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
