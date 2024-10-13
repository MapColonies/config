import path from 'node:path';
import { readPackageJsonSync } from '@map-colonies/read-pkg';

const schemasPackagePathBuildPath = require.resolve('@map-colonies/schemas').substring(0, require.resolve('@map-colonies/schemas').indexOf('build'));
export const LOCAL_SCHEMAS_PACKAGE_VERSION = readPackageJsonSync(path.join(schemasPackagePathBuildPath, 'package.json')).version as string;
export const PACKAGE_NAME = readPackageJsonSync('package.json').name ?? 'package-name-not-defined';

export const SCHEMA_DOMAIN = 'https://mapcolonies.com/';

export const SCHEMAS_PACKAGE_RESOLVED_PATH = require.resolve('@map-colonies/schemas');
export const SCHEMA_BASE_PATH = SCHEMAS_PACKAGE_RESOLVED_PATH.substring(0, SCHEMAS_PACKAGE_RESOLVED_PATH.lastIndexOf('/'));
