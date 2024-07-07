import deepmerge from 'deepmerge';
import { BaseOptions, optionsSchema } from './types';
import { ajvOptionsValidator, validate } from './validator';
import { createDebug } from './utils/debug';
import { createConfigError } from './errors';

const debug = createDebug('options');

function getEnvOptions(): Partial<Record<keyof BaseOptions, string>> {
  const envOptions: Partial<Record<keyof BaseOptions, string>> = {
    configName: process.env.CONFIG_NAME,
    configServerUrl: process.env.CONFIG_SERVER_URL,
    version: process.env.CONFIG_VERSION,
    offlineMode: process.env.CONFIG_OFFLINE_MODE,
    ignoreServerIsOlderVersionError: process.env.CONFIG_IGNORE_SERVER_IS_OLDER_VERSION_ERROR,
  };

  // in order to merge correctly the keys should not exist, undefined is not enough
  for (const key in envOptions) {
    if (envOptions[key as keyof BaseOptions] === undefined) {
      delete envOptions[key as keyof BaseOptions];
    }
  }
  return envOptions;
}
let baseOptions: BaseOptions | undefined = undefined;

export function initializeOptions(options: Partial<BaseOptions>): BaseOptions {
  const envOptions = getEnvOptions();
  debug('initializing options with %j and env %j', options, envOptions);
  const mergedOptions = deepmerge(options, envOptions);

  debug('merged options: %j', mergedOptions);

  const [errors, validatedOptions] = validate(ajvOptionsValidator, optionsSchema, mergedOptions);

  if (errors) {
    debug('error validating options: %s', errors[0].message);
    throw createConfigError(
      'optionValidationError',
      'An error occurred while validating the given options. please check both arguments and environment variables',
      errors
    );
  }

  debug('options validated successfully');
  baseOptions = validatedOptions as BaseOptions;
  return baseOptions;
}

export function getOptions(): BaseOptions {
  if (baseOptions === undefined) {
    debug('Options were requested before being initialized');
    throw new Error('Options not initialized');
  }

  debug('returning options');
  return baseOptions;
}
