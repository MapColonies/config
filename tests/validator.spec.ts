import { describe, expect, it } from 'vitest';
import { validate, ajvOptionsValidator, ajvConfigValidator } from '../src/validator';

describe('validator', () => {
  describe('#validate', () => {
    it('should return the validated data if the data is valid', () => {
      const schema = {
        type: 'object',
        properties: {
          foo: { type: 'string' },
        },
        required: ['foo'],
      };
      const data = { foo: 'bar' };
      const [errors, validatedData] = validate(ajvOptionsValidator, schema, data);
      expect(errors).toBeUndefined();
      expect(validatedData).toEqual(data);
    });

    it('should return the errors if the data is invalid', () => {
      const schema = {
        type: 'object',
        properties: {
          foo: { type: 'string' },
        },
        required: ['foo'],
      };
      const data = {};
      const [errors, validatedData] = validate(ajvOptionsValidator, schema, data);
      expect(errors).toBeDefined();
      expect(validatedData).toBeUndefined();
    });

    it('should coerce types and insert defaults if options validator is used', () => {
      const schema = {
        type: 'object',
        properties: {
          foo: { type: 'number' },
          bar: { type: 'string', default: 'baz' },
        },
        required: ['foo'],
      };
      const data = { foo: '1' };
      const [errors, validatedData] = validate(ajvOptionsValidator, schema, data);
      expect(errors).toBeUndefined();
      expect(validatedData).toEqual({ foo: 1, bar: 'baz' });
    });

    it('should insert defaults and allow x-env-value keyword if config validator is used', () => {
      const schema = {
        type: 'object',
        properties: {
          foo: { type: 'number', default: 1 },
          bar: { type: 'string', 'x-env-value': 'BAR' },
        },
        required: ['foo'],
      };

      const data = {};
      const [errors, validatedData] = validate(ajvConfigValidator, schema, data);

      expect(errors).toBeUndefined();
      expect(validatedData).toEqual({ foo: 1 });
    });

    it('should enrich the error with params if unevaluatedProperties error occurs', () => {
      const schema = {
        type: 'object',
        properties: {
          foo: { type: 'string' },
          bar: { type: 'number' },
        },
        required: ['foo'],
        unevaluatedProperties: false,
      };
      const data = { foo: 'bar', baz: 123 };

      const [errors, validatedData] = validate(ajvOptionsValidator, schema, data);

      expect(validatedData).toBeUndefined();
      expect(errors).toHaveProperty('[0].params.unevaluatedProperty', 'baz');
    });
  });
});
