import { JSONSchema } from '@apidevtools/json-schema-ref-parser';
import _ from 'lodash';
import { EnvMap, EnvType } from './types';
import { createDebug } from './debug';

const debug = createDebug('env');

const schemaCompositionKeys = ['oneOf', 'anyOf', 'allOf'] as const;

export function parseSchemaEnv(schema: JSONSchema): EnvMap {
  const fromEnv: EnvMap = {};

  function handlePrimitive(schema: JSONSchema, type: EnvType, path: string): void {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const xFrom = (schema as { 'x-env-value'?: string })['x-env-value'];
    if (xFrom !== undefined) {
      fromEnv[xFrom] = {
        type,
        path,
      };
    }
  }

  function iterateOverSchemaObject(schema: JSONSchema, path: string): void {
    const type = schema.type;
    if (type === 'number' || type === 'string' || type === 'boolean' || type === 'integer' || type === 'null') {
      return handlePrimitive(schema, type, path);
    }

    if (type === 'array' || type === 'any') {
      return;
    }

    schemaCompositionKeys.forEach((key) => {
      const compositionObj = schema[key];
      if (compositionObj !== undefined) {
        for (const subSchema of compositionObj) {
          if (typeof subSchema !== 'boolean') {
            iterateOverSchemaObject(subSchema, path);
          }
        }
      }
    });

    if (type === 'object') {
      for (const key in schema.properties) {
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
      let value: unknown;

      switch (details.type) {
        case 'boolean':
          value = value === 'true';
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

      _.set(res, details.path, value);
    }
  }

  return res;
}
