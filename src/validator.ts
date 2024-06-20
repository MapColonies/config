import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { JSONSchema } from '@apidevtools/json-schema-ref-parser';
import _ from 'lodash';
import { ValidationError, betterAjvErrors } from '@apideck/better-ajv-errors';
import { createDebug } from './debug';

const debug = createDebug('validator');

export const ajvConfigValidator = addFormats(
  new Ajv({
    useDefaults: true,
    allErrors: true,
    verbose: true,
  }),
  ['date-time', 'time', 'date', 'email', 'hostname', 'ipv4', 'ipv6', 'uri', 'uuid', 'regex', 'uri-template']
);

export const ajvLibraryConfigValidator = new Ajv({
  useDefaults: true,
  coerceTypes: true,
  allErrors: true,
  verbose: true,
});

export function validate<T>(ajv: Ajv, schema: JSONSchema, data: unknown): [ValidationError[], undefined] | [undefined, T] {
  const clonedData = _.cloneDeep(data);
  const valid = ajv.validate(schema, clonedData);
  if (!valid) {
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    const betterErrors = betterAjvErrors({ schema: schema as Parameters<typeof betterAjvErrors>[0]['schema'], data, errors: ajv.errors });
    return [betterErrors, undefined];
  }
  return [undefined, clonedData as T];
}
