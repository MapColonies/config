import deepmerge from 'deepmerge';
import { BaseOptions, optionsSchema } from './types';
import { ajvLibraryConfigValidator } from './validator';
import { createDebug } from './debug';

const debug = createDebug('options');

const envOptions: Record<keyof BaseOptions, string | undefined> = {
  configName: process.env.CONFIG_NAME,
  configServerUrl: process.env.CONFIG_SERVER_URL,
  version: process.env.CONFIG_VERSION,
  offlineMode: process.env.CONFIG_OFFLINE_MODE,
  ignoreServerIsOlderVersionError: process.env.CONFIG_IGNORE_SERVER_IS_OLDER_VERSION_ERROR,
};

let baseOptions: BaseOptions | undefined = undefined;

export function initializeOptions(options: Partial<BaseOptions>):BaseOptions {
  const mergedOptions = deepmerge(options, envOptions);

  const isValid = ajvLibraryConfigValidator.validate(optionsSchema, mergedOptions);

  if (!isValid) {
    throw new Error('Invalid config');
  }

  baseOptions = mergedOptions as BaseOptions;
  return baseOptions;
}

export function getOptions(): BaseOptions {
  if (baseOptions === undefined) {
    throw new Error('Config not initialized');
  }
  
  return baseOptions;
}
