import { typeSymbol } from '@map-colonies/schemas/build/schemas/symbol';
import { JSONSchemaType } from 'ajv';
import type { Registry } from 'prom-client';

type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type EnvType = 'number' | 'string' | 'boolean' | 'integer' | 'null';

export interface EnvDetails {
  type: EnvType | 'json';
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

export interface SchemaWithType {
  $id?: string;
  [typeSymbol]: unknown;
}

/**
 * Represents the base options for configuration.
 */
export interface BaseOptions {
  /**
   * The name of the remote configuration.
   */
  configName: string;
  /**
   * The version of the remote configuration. It can be either 'latest' or a number.
   */
  version: 'latest' | number;
  /**
   * The URL of the configuration server.
   */
  configServerUrl: string;
  /**
   * Indicates whether the configuration should be loaded in offline mode.
   */
  offlineMode?: boolean;
  /**
   * Indicates whether to ignore the error when the server version is older than the requested version.
   */
  ignoreServerIsOlderVersionError?: boolean;
  /**
   * The path to the local configuration folder.
   * @default './config'
   */
  localConfigPath?: string;
}

/**
 * Represents the options for configuration.
 */
export type ConfigOptions<T extends SchemaWithType> = Prettify<
  Partial<BaseOptions> & {
    /**
     * The schema of the configuration object.
     */
    schema: T;
    /**
     * The registry for the metrics. If not provided, the metrics will not be registered.
     * Depends on the prom-client package being installed.
     */
    metricsRegistry?: Registry;
  }
>;

export const optionsSchema: JSONSchemaType<BaseOptions> = {
  required: ['configName', 'configServerUrl', 'version'],
  additionalProperties: false,
  type: 'object',
  properties: {
    configName: { type: 'string' },
    version: {
      oneOf: [
        { type: 'string', const: 'latest' },
        { type: 'integer', minimum: 1 },
      ],
    },
    configServerUrl: { type: 'string' },
    offlineMode: { type: 'boolean', nullable: true },
    ignoreServerIsOlderVersionError: { type: 'boolean', nullable: true },
    localConfigPath: { type: 'string', default: './config', nullable: true },
  },
};

/**
 * Represents the schema of the configuration object.
 * @template T - The type of the configuration schema.
 */
export interface ConfigInstance<T> {
  /**
   * Retrieves the value at the specified path from the configuration object.
   * @template TPath - The type of the path.
   * @param path - The path to the desired value.
   * @returns The value at the specified path.
   */
  get: <TPath extends string>(path: TPath) => _.GetFieldType<T, TPath>;

  /**
   * Retrieves the entire configuration object.
   * @returns The entire configuration object.
   */
  getAll: () => T;

  /**
   * Retrieves different parts of the configuration object before being merged and validated.
   * @returns An object containing the localConfig, config, and envConfig parts of the configuration.
   */
  getConfigParts: () => {
    localConfig: object;
    config: object;
    envConfig: object;
  };

  /**
   * Retrieves the resolved options from the configuration object.
   * @returns The resolved options.
   */
  getResolvedOptions: () => BaseOptions;

  /**
   * Initializes the metrics for the configuration object.
   * @param registry - The registry for the metrics.
   */
  initializeMetrics: (registry: Registry) => void;
}
