import { describe, expect, it } from 'vitest';
import 'jest-extended';
import { deepFreeze } from '../src/utils/helpers';

describe('helpers', () => {
  describe('#deepFreeze', () => {
    it('should return frozen object', () => {
      const data = {
        name: 'I am parent',
        child: {
          name: 'I am child',
        },
      };

      deepFreeze(data);
      expect(data).toBeFrozen();
    });

    it('should freeze the input object that include null valued property without error', () => {
      const data = {
        name: null,
        child: {
          name: 'i am child',
        },
      };

      deepFreeze(data);
      expect(data).toBeFrozen();
    });

    it('should freeze the input object include nested property', () => {
      const data = {
        name: 'I am parent',
        child: {
          name: 'I am child',
        },
      };

      deepFreeze(data);
      const child = data.child;
      expect(child).toBeFrozen();
    });
  });
});
