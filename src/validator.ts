import Ajv, { SchemaObject } from 'ajv';
import addFormats from 'ajv-formats';
import lodash from 'lodash';
import { ValidationError, betterAjvErrors } from '@apideck/better-ajv-errors';
import { createDebug } from './utils/debug';

const debug = createDebug('validator');

export const ajvConfigValidator = addFormats(
  new Ajv({
    useDefaults: true,
    allErrors: true,
    verbose: true,
    keywords: ['x-env-value'],
  }),
  ['date-time', 'time', 'date', 'email', 'hostname', 'ipv4', 'ipv6', 'uri', 'uuid', 'regex', 'uri-template']
);

export const ajvOptionsValidator = new Ajv({
  useDefaults: true,
  coerceTypes: true,
  allErrors: true,
  verbose: true,
});

export function validate<T>(ajv: Ajv, schema: SchemaObject, data: unknown): [ValidationError[], undefined] | [undefined, T] {
  debug('validating data %j with schema %s', data, schema.$id);

  const clonedData = lodash.cloneDeep(data);
  const valid = ajv.validate(schema, clonedData);
  if (!valid) {
    debug('validation failed with errors %j', ajv.errors);
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    const betterErrors = betterAjvErrors({ schema: schema as Parameters<typeof betterAjvErrors>[0]['schema'], data, errors: ajv.errors });
    return [betterErrors, undefined];
  }

  debug('validation successful');
  return [undefined, clonedData as T];
}
