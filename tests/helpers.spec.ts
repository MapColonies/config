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

      const action = () => {
        data.name = 'i try to change'; // try to change freezed object
      };
      expect(action).toThrow(/Cannot assign to read only property/);
    });

    it('should return frozen object with nested null value without error', () => {
      const data = {
        name: 'I am parent',
        child: {
          name: null,
        },
      };
      deepFreeze(data);

      const action = () => {
        data.name = 'i try to change'; // try to change freezed object
      };
      expect(action).toThrow(/Cannot assign to read only property/);
    });
  });
});
