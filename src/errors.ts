import { ValidationError } from '@apideck/better-ajv-errors';
import { Dispatcher } from 'undici';

const configErrors = {
  optionValidationError: { code: 1, payload: [] as ValidationError[] },
  configValidationError: { code: 2, payload: [] as ValidationError[] },
  httpResponseError: { code: 3, payload: {} as Pick<Dispatcher.ResponseData, 'headers' | 'statusCode'> & { body: string } },
  httpGeneralError: { code: 4, payload: {} as Error },
  schemaNotFoundError: { code: 5, payload: {} as { schemaPath: string } },
  schemasPackageVersionMismatchError: { code: 6, payload: {} as { remotePackageVersion: string; localPackageVersion: string } },
  schemaVersionMismatchError: { code: 7, payload: {} as { remoteSchemaVersion: string; localSchemaVersion: string } },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as const satisfies Record<string, { code: number; payload: any }>;

/**
 * Represents the configuration errors.
 */
export type ConfigErrors = typeof configErrors;

/**
 * Represents an error specific to the configuration module.
 *
 * @template ErrorName - The name of the error.
 * @template Payload - The payload type associated with the error.
 */
export class ConfigError<ErrorName extends keyof ConfigErrors, Payload = ConfigErrors[ErrorName]['payload']> extends Error {
  public readonly code: ConfigErrors[ErrorName]['code'];

  /**
   * Creates a new instance of the ConfigError class.
   *
   * @param name - The name of the error.
   * @param message - The error message.
   * @param payload - The payload associated with the error.
   */
  public constructor(name: ErrorName, message: string, public readonly payload: Payload | undefined) {
    super(message);
    this.name = name;
    this.code = configErrors[name].code;
  }
}

export function createConfigError<ErrorName extends keyof ConfigErrors, Payload extends ConfigErrors[ErrorName]['payload']>(
  name: ErrorName,
  message: string,
  payload: Payload
): ConfigError<ErrorName, Payload> {
  return new ConfigError(name, message, payload);
}

/**
 * Checks if the given error is an instance of `ConfigError` with the specified error type.
 * @param error - The error to check.
 * @param errorName - The name of the error to check against.
 * @returns `true` if the error is an instance of `ConfigError` with the specified error name, `false` otherwise.
 */
export function isConfigError<ErrorName extends keyof ConfigErrors>(error: unknown, errorName: ErrorName): error is ConfigError<ErrorName> {
  if (!(error instanceof ConfigError)) {
    return false;
  }

  return error.name === errorName && error.code === configErrors[errorName].code;
}
