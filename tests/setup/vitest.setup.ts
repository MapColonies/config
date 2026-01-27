/* eslint-disable */
import path from 'node:path';
import { expect } from 'vitest';
import * as matchers from 'jest-extended';

expect.extend(matchers);

//@ts-ignore
globalThis.expect = expect;

//@ts-ignore
globalThis.expect = undefined as any; // Reset global expect to avoid conflicts with other test frameworks
