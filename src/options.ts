import deepmerge from 'deepmerge';
import { BaseOptions, optionsSchema } from './types';
import { ajvLibraryConfigValidator, validate } from './validator';
import { createDebug } from './utils/debug';
import { createConfigError } from './errors';

const debug = createDebug('options');

const envOptions: Record<keyof BaseOptions, string | undefined> = {
  configName: process.env.CONFIG_NAME,
  configServerUrl: process.env.CONFIG_SERVER_URL,
  version: process.env.CONFIG_VERSION,
  offlineMode: process.env.CONFIG_OFFLINE_MODE,
  ignoreServerIsOlderVersionError: process.env.CONFIG_IGNORE_SERVER_IS_OLDER_VERSION_ERROR,
};

let baseOptions: BaseOptions | undefined = undefined;

export function initializeOptions(options: Partial<BaseOptions>): BaseOptions {
  debug('initializing options with %j and env %j', options, envOptions);
  const mergedOptions = deepmerge(options, envOptions);

  debug('merged options: %j', mergedOptions);

  const [errors, validatedOptions] = validate(ajvLibraryConfigValidator, optionsSchema, mergedOptions);

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
