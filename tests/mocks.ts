import { commonDbPartialV1 } from '@map-colonies/schemas';
import type { Config } from '../src/types';

export function createMockConfigData(overrides?: Partial<Config>): Partial<Config> {
  return {
    configName: 'name',
    schemaId: commonDbPartialV1.$id,
    version: 1,
    config: { host: 'initial-host' },
    createdAt: 0,
    ...overrides,
  };
}
