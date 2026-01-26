import tsBaseConfig from '@map-colonies/eslint-config/ts-base';
import { defineConfig } from 'eslint/config';

export default defineConfig(
  tsBaseConfig,
  {
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  { ignores: ['vitest.config.mts'] }
);
