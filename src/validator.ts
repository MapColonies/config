import { readFileSync } from 'node:fs';
import ajv, { AnySchemaObject, ErrorObject, SchemaObject } from 'ajv/dist/2019';
import addFormats from 'ajv-formats';
import lodash from 'lodash';
import { ValidationError, betterAjvErrors } from '@apideck/better-ajv-errors';
import { createDebug } from './utils/debug';

const debug = createDebug('validator');

const draft7MetaSchema = JSON.parse(
  readFileSync(require.resolve('ajv/dist/refs/json-schema-draft-07.json'), { encoding: 'utf-8' })
) as AnySchemaObject;

const ajvConfigValidator = addFormats(
  new ajv({
    useDefaults: true,
    allErrors: true,
    verbose: true,
    discriminator: true,
    keywords: ['x-env-value', 'x-env-format'],
  })
);

ajvConfigValidator.addMetaSchema(draft7MetaSchema, 'http://json-schema.org/draft-07/schema#');

function enrichError(betterErrors: ValidationError[], errors: ErrorObject[]): (ValidationError & { params?: Record<string, unknown> })[] {
  return betterErrors.map((error, index) => {
    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
    switch (error.context.errorType) {
      case 'unevaluatedProperties': {
        const originalError = errors[index];
        return {
          ...error,
          params: originalError?.params,
        };
      }
      default:
        return error;
    }
  });
}

export { ajvConfigValidator };

export const ajvOptionsValidator = new ajv({
  useDefaults: true,
  coerceTypes: true,
  allErrors: true,
  verbose: true,
});

export function validate<T>(ajv: ajv, schema: SchemaObject, data: unknown): [ValidationError[], undefined] | [undefined, T] {
  debug('validating data %j with schema %s', data, schema.$id);

  const clonedData = lodash.cloneDeep(data);
  const valid = ajv.validate(schema, clonedData);

  if (!valid) {
    debug('validation failed with errors %j', ajv.errors);
    const betterErrors = betterAjvErrors({ schema: schema as Parameters<typeof betterAjvErrors>[0]['schema'], data, errors: ajv.errors });
    return [enrichError(betterErrors, ajv.errors as ErrorObject[]), undefined];
  }

  debug('validation successful');
  return [undefined, clonedData as T];
}
