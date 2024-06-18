export const SCHEMA_DOMAIN = 'https://mapcolonies.com/';

export const SCHEMAS_PACKAGE_RESOLVED_PATH = require.resolve('@map-colonies/schemas');
export const SCHEMA_BASE_PATH = SCHEMAS_PACKAGE_RESOLVED_PATH.substring(0, SCHEMAS_PACKAGE_RESOLVED_PATH.lastIndexOf('/'));
