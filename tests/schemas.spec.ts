import type { JSONSchema } from '@apidevtools/json-schema-ref-parser';
import { loadSchema } from '../src/schemas';

describe('schemas', () => {
  describe('#loadSchema', () => {
    it('should load the schema', async () => {
      const schema = {
        $id: 'https://mapcolonies.com/test',
        type: 'object',
        properties: {
          foo: { type: 'string' },
        },
        required: ['foo'],
      } satisfies JSONSchema;
      const dereferencedSchema = await loadSchema(schema);
      expect(dereferencedSchema).toEqual(schema);
    });

    it('should load the schema with a reference', async () => {
      const schema = {
        $id: 'https://mapcolonies.com/common/db/full/v1',
        description: 'The full database schema including schema and database name',
        type: 'object',
        allOf: [
          {
            $ref: 'https://mapcolonies.com/common/db/partial/v1',
          },
          {
            $ref: '#/definitions/db',
          },
        ],
        definitions: {
          db: {
            type: 'object',
            required: ['database'],
            properties: {
              schema: {
                type: 'string',
                description: 'The schema name of the database',
                default: 'public',
              },
              database: {
                type: 'string',
                description: 'The database name',
                maxLength: 63,
              },
            },
          },
        },
      } satisfies JSONSchema;

      const dereferencedSchema = await loadSchema(schema);

      expect(dereferencedSchema).toEqual({
        $id: 'https://mapcolonies.com/test',
        type: 'object',
        properties: {
          foo: { type: 'string' },
        },
        required: ['foo'],
      });
    });
  });
});
