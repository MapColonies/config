import path from 'node:path';
import fs from 'node:fs';
import { JSONSchema, $RefParser } from '@apidevtools/json-schema-ref-parser';
import { SCHEMA_BASE_PATH, SCHEMA_DOMAIN } from './constants';
import { createDebug } from './utils/debug';
import { createConfigError } from './errors';

const debug = createDebug('schemas');

const refParser = new $RefParser();

function loadSpecificSchema(relativePath: string): JSONSchema {
  debug('loading specific schema at path %s', relativePath);
  const fullPath = path.join(SCHEMA_BASE_PATH, relativePath + '.schema.json');

  if (!fs.existsSync(fullPath)) {
    throw createConfigError(`schemaNotFoundError`, `Schema not found at path`, { schemaPath: fullPath });
  }

  const schema = JSON.parse(fs.readFileSync(fullPath, { encoding: 'utf-8' })) as JSONSchema;

  // removed to prevent the "reference resolves to more than one schema" error from ajv
  delete schema.$id;

  return schema;
}

export async function loadSchema(schema: JSONSchema): ReturnType<typeof refParser.dereference> {
  debug('loading schema id %s', schema.$id);
  const dereferencedSchema = await refParser.dereference(schema, {
    dereference: { circular: false },
    resolve: {
      mapcolonies: {
        canRead: /^https:\/\/mapcolonies.com\/.*/,
        order: 1,
        read: (file: { url: string; hash: string; extension: string }) => {
          const subPath = file.url.split(SCHEMA_DOMAIN)[1];

          if (subPath === undefined) {
            throw createConfigError(`schemaNotFoundError`, `Schema url is not valid`, { schemaPath: file.url });
          }

          return loadSpecificSchema(subPath);
        },
      },
    },
  });
  return dereferencedSchema;
}
