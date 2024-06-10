import { JSONSchema } from '@apidevtools/json-schema-ref-parser';

const fromEnv: Record<
  string,
  {
    type: 'number' | 'string' | 'boolean' | 'integer';
    path: string;
  }
> = {};
const toEnv: Record<string, string> = {};

function handlePrimitive(schema: JSONSchema, type: 'number' | 'string' | 'boolean' | 'integer', path: string): void {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const xFrom = (schema as { 'x-from-env'?: string })['x-from-env'];
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const xTo = (schema as { 'x-populate-as-env'?: string })['x-populate-as-env'];
  if (xFrom !== undefined) {
    fromEnv[xFrom] = {
      type,
      path,
    };

    if (xTo !== undefined) {
      toEnv[path] = xFrom;
    }
  }
}

function a(schema: JSONSchema, path: string) {
  const type = schema.type;
  if (type === 'number' || type === 'string' || type === 'boolean' || type === 'integer') {
    return handlePrimitive(schema, type, path);
  }

  if (type === 'array' || type === 'null' || type === 'any') {
    return;
  }
}
