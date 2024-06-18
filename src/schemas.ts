import path from 'node:path';
import fs from 'node:fs';
import $RefParser, { JSONSchema } from '@apidevtools/json-schema-ref-parser';
import { SCHEMA_BASE_PATH, SCHEMA_DOMAIN } from './constants';

const refParser = new $RefParser();

function loadSpecificSchema(relativePath: string): JSONSchema {
  const fullPath = path.join(SCHEMA_BASE_PATH, relativePath + '.schema.json');

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Schema file not found: ${fullPath}`);
  }

  return JSON.parse(fs.readFileSync(fullPath, { encoding: 'utf-8' })) as JSONSchema;
}

export async function loadSchema(schema: JSONSchema): ReturnType<typeof refParser.dereference> {
  const dereferencedSchema = await refParser.dereference(schema, {
    dereference: { circular: false },
    resolve: {
      mapcolonies: {
        canRead: /^https:\/\/mapcolonies.com\/.*/,
        order: 1,
        read: (file: { url: string; hash: string; extension: string }) => {
          const subPath = file.url.split(SCHEMA_DOMAIN)[1];

          return loadSpecificSchema(subPath);
        },
      },
    },
  });
  return dereferencedSchema;
}
