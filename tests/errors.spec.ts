import { describe, expect, it } from 'vitest';
import { ConfigError, isConfigError } from '../src/errors';

describe('errors', () => {
  describe('#isConfigError', () => {
    it('should return true if the error is an instance of ConfigError', () => {
      const error = new ConfigError('configValidationError', 'Config validation error', []);
      expect(isConfigError(error, 'configValidationError')).toBe(true);
    });

    it('should return false if the error is not an instance of ConfigError', () => {
      expect(isConfigError(new Error('error'), 'configValidationError')).toBe(false);
    });

    it('should return false if the error is an instance of ConfigError but with a different name', () => {
      const error = new ConfigError('optionValidationError', 'Option validation error', []);
      expect(isConfigError(error, 'configValidationError')).toBe(false);
    });
  });
});
