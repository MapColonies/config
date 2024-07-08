import { JSONSchema } from '@apidevtools/json-schema-ref-parser';
import lodash from 'lodash';
import { EnvMap, EnvType } from './types';
import { createDebug } from './utils/debug';

const debug = createDebug('env');

const schemaCompositionKeys = ['oneOf', 'anyOf', 'allOf'] as const;

function parseSchemaEnv(schema: JSONSchema): EnvMap {
  debug('parsing schema for env values');
  const fromEnv: EnvMap = {};

  function handlePrimitive(schema: JSONSchema, type: EnvType, path: string): void {
    debug('handling primitive %s at path %s', type, path);
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const xFrom = (schema as { 'x-env-value'?: string })['x-env-value'];
    debug('value of xFrom: %s as path %s', xFrom, path);
    if (xFrom !== undefined) {
      fromEnv[xFrom] = {
        type,
        path,
      };
    }
  }

  function iterateOverSchemaObject(schema: JSONSchema, path: string): void {
    debug('iterating over schema object at path %s', path);
    const type = schema.type;
    if (type === 'number' || type === 'string' || type === 'boolean' || type === 'integer' || type === 'null') {      
      return handlePrimitive(schema, type, path);
    }

    if (type === 'array' || type === 'any') {
      debug('array or any type at path %s', path);
      return;
    }

    schemaCompositionKeys.forEach((key) => {
      const compositionObj = schema[key];
      if (compositionObj !== undefined) {
        debug('going over composition object %s at path %s', key, path);
        for (const subSchema of compositionObj) {
          if (typeof subSchema !== 'boolean') {
            iterateOverSchemaObject(subSchema, path);
          }
        }
      }
    });

    if (type === 'object') {
      for (const key in schema.properties) {
        debug('going over object properties at path %s', key, path);
        const subSchema = schema.properties[key];

        if (typeof subSchema !== 'boolean') {
          iterateOverSchemaObject(subSchema, path === '' ? key : `${path}.${key}`);
        }
      }
    }
  }

  iterateOverSchemaObject(schema, '');
  return fromEnv;
}

export function getEnvValues(schema: JSONSchema): object {
  const res = {};

  const envMap = parseSchemaEnv(schema);
  for (const [key, details] of Object.entries(envMap)) {
    const unparsedValue = process.env[key];
    if (unparsedValue !== undefined) {
      debug('found env value for key %s with type %s', key, details.type);
      let value: unknown;

      switch (details.type) {
        case 'boolean':
          value = unparsedValue.toLowerCase() === 'true';
          break;
        case 'integer':
          value = parseInt(unparsedValue);
          break;
        case 'number':
          value = parseFloat(unparsedValue);
          break;
        case 'null':
          value = null;
          break;
        default:
          value = unparsedValue;
      }

      lodash.set(res, details.path, value);
    }
  }

  return res;
}
