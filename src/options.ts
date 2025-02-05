import deepmerge from 'deepmerge';
import { BaseOptions, optionsSchema } from './types';
import { ajvOptionsValidator, validate } from './validator';
import { createDebug } from './utils/debug';
import { createConfigError } from './errors';
import { PACKAGE_NAME } from './constants';

const debug = createDebug('options');

const defaultOptions: BaseOptions = {
  configName: PACKAGE_NAME,
  configServerUrl: 'http://localhost:8080',
  version: 'latest',
};

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

let baseOptions: BaseOptions | undefined = undefined;

export function initializeOptions(options: Partial<BaseOptions>): BaseOptions {
  debug('initializing options with default options: %j function input: %j and environment variables: %j', defaultOptions, options, envOptions);
  const mergedOptions = deepmerge.all([defaultOptions, options, envOptions]);
  debug('merged options: %j', mergedOptions);

  const [errors, validatedOptions] = validate(ajvOptionsValidator, optionsSchema, mergedOptions);

  if (errors) {
    debug('error validating options: %s', errors[0] !== undefined ? errors[0].message : 'unknown error');
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
