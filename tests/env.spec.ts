import { JSONSchema } from '@apidevtools/json-schema-ref-parser';
import { getEnvValues } from '../src/env';
import { EnvType } from '../src/types';

describe('env', () => {
  describe('#getEnvValues', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
      // jest.resetModules() // Most important - it clears the cache
      process.env = { ...OLD_ENV }; // Make a copy
    });

    afterAll(() => {
      process.env = OLD_ENV; // Restore old environment
    });

    it('should return the env values', () => {
      process.env.FOO = 'bar';
      const schema = {
        type: 'object',
        properties: {
          foo: { type: 'string', 'x-env-value': 'FOO' },
        },
        required: ['foo'],
      } satisfies JSONSchema;

      const envValues = getEnvValues(schema);

      expect(envValues).toEqual({ foo: 'bar' });
    });

    it.each([
      ['string', 'bar', 'bar'],
      ['boolean', 'true', true],
      ['integer', '1', 1],
      ['number', '1.5', 1.5],
      ['null', 'null', null],
    ])(`should return the env values for %s`, (type, value, expected) => {
      process.env.FOO = value;
      const schema = {
        type: 'object',
        properties: {
          foo: { type: type as EnvType, 'x-env-value': 'FOO' },
        },
        required: ['foo'],
      } satisfies JSONSchema;

      const envValues = getEnvValues(schema);

      expect(envValues).toEqual({ foo: expected });
    });

    it('should handle nested objects', () => {
      process.env.FOO = 'bar';
      const schema = {
        type: 'object',
        properties: {
          foo: { type: 'object', properties: { baz: { type: 'string', 'x-env-value': 'FOO' } } },
        },
        required: ['foo'],
      } satisfies JSONSchema;

      const envValues = getEnvValues(schema);

      expect(envValues).toEqual({ foo: { baz: 'bar' } });
    });

    it('should not handle array or any type, or any object inside of an array', () => {
      process.env.FOO = 'bar';
      process.env.BAZ = 'baz';
      const schema = {
        type: 'object',
        properties: {
          foo: { type: 'array', 'x-env-value': 'FOO', items: { type: 'string', 'x-env-value': 'BAZ' } },
        },
        required: ['foo'],
      } satisfies JSONSchema;

      const envValues = getEnvValues(schema);

      expect(envValues).toEqual({});
    });

    it('should handle values in composed objects', () => {
      process.env.FOO = 'bar';
      const schema = {
        type: 'object',
        allOf: [
          {
            type: 'object',
            properties: {
              foo: { type: 'string', 'x-env-value': 'FOO' },
            },
            required: ['foo'],
          },
        ],
      } satisfies JSONSchema;

      const envValues = getEnvValues(schema);

      expect(envValues).toEqual({ foo: 'bar' });
    });

    it('should handle json value', () => {
      process.env.FOO = '{"bar": "baz"}';
      const schema = {
        type: 'object',
        properties: {
          foo: { type: 'string', 'x-env-format': 'json', 'x-env-value': 'FOO' },
        },
        required: ['foo'],
      } satisfies JSONSchema;

      const envValues = getEnvValues(schema);

      expect(envValues).toEqual({ foo: { bar: 'baz' } });
    });

    it('should handle json value in composed objects', () => {
      process.env.FOO = '{"bar": "baz"}';
      const schema = {
        type: 'object',
        allOf: [
          {
            type: 'object',
            properties: {
              foo: { type: 'string', 'x-env-format': 'json', 'x-env-value': 'FOO' },
            },
            required: ['foo'],
          },
        ],
      } satisfies JSONSchema;

      const envValues = getEnvValues(schema);

      expect(envValues).toEqual({ foo: { bar: 'baz' } });
    });

    it('should handle primitive json values', () => {
      process.env.FOO = '"bar"';
      const schema = {
        type: 'object',
        properties: {
          foo: { type: 'string', 'x-env-format': 'json', 'x-env-value': 'FOO' },
        },
        required: ['foo'],
      } satisfies JSONSchema;

      const envValues = getEnvValues(schema);

      expect(envValues).toEqual({ foo: 'bar' });
    });

    it('should handle json value in the root object', () => {
      process.env.FOO = '{"foo": {"bar": "baz"}}';
      const schema = {
        type: 'object',
        'x-env-format': 'json',
        'x-env-value': 'FOO',
        properties: {
          foo: { type: 'string' },
        },
        required: ['foo'],
      } satisfies JSONSchema;

      const envValues = getEnvValues(schema);

      expect(envValues).toEqual({ foo: { bar: 'baz' } });
    });

    it('should handle nested json value when there is more nesting under it', () => {
      process.env.FOO = '{"bar": "baz"}';
      const schema = {
        type: 'object',
        properties: {
          foo: {
            type: 'object',
            'x-env-format': 'json',
            'x-env-value': 'FOO',
            properties: {
              bar: { type: 'string' },
            },
            required: ['bar'],
          },
        },
        required: ['foo'],
      } satisfies JSONSchema;

      const envValues = getEnvValues(schema);

      expect(envValues).toEqual({ foo: { bar: 'baz' } });
    });

    it('should allow to use x-env-value in an object with no properties', () => {
      process.env.FOO = 'bar';
      const schema = {
        type: 'object',
        properties: {
          foo: { 'x-env-value': 'FOO' },
        },
        required: ['foo'],
      } satisfies JSONSchema;

      const envValues = getEnvValues(schema);

      expect(envValues).toEqual({ foo: 'bar' });
    });

    it('should allow to use x-env-value and json format in an object with no properties', () => {
      process.env.FOO = '{"bar": "baz"}';
      const schema = {
        type: 'object',
        properties: {
          foo: { 'x-env-value': 'FOO', 'x-env-format': 'json' },
        },
        required: ['foo'],
      } satisfies JSONSchema;

      const envValues = getEnvValues(schema);

      expect(envValues).toEqual({ foo: { bar: 'baz' } });
    });

    it('should allow x-env-value with an enum with no string defined', () => {
      process.env.FOO = 'bar';
      const schema = {
        type: 'object',
        properties: {
          foo: { 'x-env-value': 'FOO', enum: ['bar', 'baz'] },
        },
        required: ['foo'],
      } satisfies JSONSchema;

      const envValues = getEnvValues(schema);

      expect(envValues).toEqual({ foo: 'bar' });
    });
  });
});
