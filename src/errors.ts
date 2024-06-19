export const configErrors = {
  optionValidationError: { code: 400, payload: undefined },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as const satisfies Record<string, { code: number; payload: any }>;

export type ConfigErrors = typeof configErrors;

export class ConfigError<ErrorName extends keyof ConfigErrors, Payload = ConfigErrors[ErrorName]['payload']> extends Error {
  public readonly code: ConfigErrors[ErrorName]['code'];

  public constructor(name: ErrorName, message: string, public readonly payload: Payload | undefined) {
    super(message);
    this.name = name;
    this.code = configErrors[name].code;
  }
}

export function createConfigError<ErrorName extends keyof ConfigErrors, Payload = ConfigErrors[ErrorName]['payload']>(
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
