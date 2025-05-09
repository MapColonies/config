/**
 * @type {import('@jest/types').Config.InitialOptions}
 */
module.exports = {
  transform: {
    '^.+\\.ts$': ['@swc/jest'],
  },
  coverageReporters: ['text', 'html'],
  collectCoverage: true,
  collectCoverageFrom: ['<rootDir>/src/**/*.ts', '!*/node_modules/', '!/vendor/**', '!<rootDir>/src/index.ts'],
  coverageDirectory: '<rootDir>/coverage',
  rootDir: '../../.',
  testMatch: ['<rootDir>/tests/**/*.spec.ts'],
  setupFilesAfterEnv: ['jest-extended/all'],
  // setupFiles: ['<rootDir>/tests/configurations/jest.setup.ts'],
  // setupFiles: ['<rootDir>/tests/configurations/afterEnv.setup.ts'],
  // reporters: [
  //   'default',
  //   [
  //     'jest-html-reporters',
  //     { multipleReportsUnitePath: './reports', pageTitle: 'integration', publicPath: './reports', filename: 'integration.html' },
  //   ],
  // ],
  moduleDirectories: ['node_modules', 'src'],
  testEnvironment: 'node',
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: -10,
    },
  },
};
