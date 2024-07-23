# Config
This package provide a solution for handling the configuration for NodeJs applications.
The package supports both working as a standalone solution and online using [config-server](https://github.com/MapColonies/config-server).

The configs are defined in the [schemas](https://github.com/MapColonies/schemas) package. It is used for validation, defining environment variable override, and for generating typescript types.

# Installation
In order to use the package you need to install both the package itself, and the schemas package that handles all the config schemas.
```sh
npm install @map-colonies/schemas @map-colonies/config
```

# Usage
```typescript
import { config } from '@map-colonies/config';
import { commonBoilerplateV4 } from '@map-colonies/schemas';

const configInstance = await config({
  configName: 'boiler-config',
  configServerUrl: 'http://localhost:8080',
  schema: commonBoilerplateV4,
  version: 'latest',
  offlineMode: false
});

const port = configInstance.get('server.port');
```

## API Documentation

This section describes the API provided by the package for interacting with the configuration.

### `ConfigInstance<T>`

The `ConfigInstance` interface represents the your way to interact with the configuration. It provides methods to retrieve configuration values and parts.
`T` is the typescript type associated with the chosen schema. it can be imported from the `@map-colonies/schemas` package.

#### Methods

##### `get<TPath extends string>(path: TPath): _.GetFieldType<T, TPath>`

- **Description**: Retrieves the value at the specified path from the configuration object. Note that the type of returned object is based on the path in the schema.
- **Parameters**:
  - `path` (`TPath`): The path to the desired value.
- **Returns**: The value at the specified path.

##### `getAll(): T`

- **Description**: Retrieves the entire configuration object.
- **Returns**: The entire configuration object.

##### `getConfigParts(): { localConfig: object; config: object; envConfig: object }`

- **Description**: Retrieves different parts of the configuration object before being merged and validated. Useful for debugging.
- **Returns**: An object containing the `localConfig`, `config`, and `envConfig` parts of the configuration.
  - `localConfig`: The local configuration object.
  - `config`: The remote configuration object.
  - `envConfig`: The environment configuration object.

##### `getResolvedOptions(): BaseOptions`

- **Description**: Retrieves the resolved options from the configuration object. Useful for debugging.
- **Returns**: The resolved options, which are an instance of `BaseOptions`.


# Configuration Options

This package allows you to configure various options for loading and managing configurations. Below are the available options and their descriptions.

## Options

### `schema`
- **Type**: `T extends SchemaWithType`
- **Description**: The schema of the configuration object.

### `configName`
- **Type**: `string`
- **Description**: The name of the remote configuration.
- **Environment Variable**: `CONFIG_NAME`

### `version`
- **Type**: `'latest' | number`
- **Description**: The version of the remote configuration. It can be either `'latest'` or a number.
- **Environment Variable**: `CONFIG_VERSION`

### `configServerUrl`
- **Type**: `string`
- **Description**: The URL of the configuration server.
- **Environment Variable**: `CONFIG_SERVER_URL`

### `offlineMode`
- **Type**: `boolean`
- **Optional**: `true`
- **Description**: Indicates whether the configuration should be loaded in offline mode.
- **Environment Variable**: `CONFIG_OFFLINE_MODE`

### `ignoreServerIsOlderVersionError`
- **Type**: `boolean`
- **Optional**: `true`
- **Description**: Indicates whether to ignore the error when the server version is older than the requested version.
- **Environment Variable**: `CONFIG_IGNORE_SERVER_IS_OLDER_VERSION_ERROR`

### `localConfigPath`
- **Type**: `string`
- **Default**: `./config`
- **Description**: The path to the local configuration folder.

## JSON Schema

The options are validated against the following JSON schema:

```json
{
  "required": ["configName", "configServerUrl", "version"],
  "additionalProperties": false,
  "type": "object",
  "properties": {
    "configName": { "type": "string" },
    "version": {
      "oneOf": [
        { "type": "string", "const": "latest" },
        { "type": "integer", "minimum": 1 }
      ]
    },
    "configServerUrl": { "type": "string" },
    "offlineMode": { "type": "boolean", "nullable": true },
    "ignoreServerIsOlderVersionError": { "type": "boolean", "nullable": true },
    "localConfigPath": { "type": "string", "default": "./config" }
  }
}
```

## Environment Variable Configuration

The following environment variables can be used to configure the options:

- `CONFIG_NAME`: Sets the `configName` option.
- `CONFIG_VERSION`: Sets the `version` option.
- `CONFIG_SERVER_URL`: Sets the `configServerUrl` option.
- `CONFIG_OFFLINE_MODE`: Sets the `offlineMode` option.
- `CONFIG_IGNORE_SERVER_IS_OLDER_VERSION_ERROR`: Sets the `ignoreServerIsOlderVersionError` option.

## Configuration Merging and Validation

The package supports merging configurations from multiple sources (local, remote, and environment variables) and then validates the merged configuration against the schema.

### Local Configuration

1. The local configuration is loaded from the path specified by the `localConfigPath` option. The default path is `./config`.

### Remote Configuration

1. The remote configuration is fetched from the server specified by the `configServerUrl` option.
2. If the `version` is set to `'latest'`, the latest version of the configuration is fetched. Otherwise, the specified version is fetched.

### Environment Variables

Configuration options can be overridden by setting the corresponding environment variables as described in schema using the `x-env-value` key.

### Merging Configurations

1. The configurations are merged in the following order of precedence:
   - Environment variables
   - Remote configuration
   - Local configuration

2. If a configuration option is specified in multiple sources, the value from the source with higher precedence (as listed above) is used.

### Validation

1. After merging, the final configuration is validated against the defined schema using ajv.
2. The validation ensures that all required properties are present, and the types and values of properties conform to the schema.
3. Any default value according to the schema is added to the final object.
4. If the validation fails, an error is thrown, indicating the invalid properties and their issues.


# Error handling

This section describes the possible errors that can occur when using the package, along with their codes and payload structures.

## Identifying errors
The package exposes a helper function called `isConfigError` to assert what is the error that was thrown and handle it as needed.
```typescript
import { config, isConfigError } from '@map-colonies/config';

try {
  const configInstance = await config({
    configName: 'boiler-config',
    configServerUrl: 'http://localhost:8080',
    schema: commonBoilerplateV4,
    version: 'latest',
    offlineMode: false
  });
  
} catch (error) {
  if (isConfigError(error, 'configValidationError')) {
    console.error('Config validation error:', error.payload);
  }
}
```

## Errors
### `optionValidationError`
- **Code**: `1`
- **Payload**: `ValidationError[]`
- **Description**: This error occurs when there is a validation error with one of the configuration options.

### `configValidationError`
- **Code**: `2`
- **Payload**: `ValidationError[]`
- **Description**: This error occurs when the configuration as a whole fails validation.

### `httpResponseError`
- **Code**: `3`
- **Payload**: 
  ```typescript
  {
    headers: Record<string, string>;
    statusCode: number;
    body: string;
  }
  ```
- **Description**: This error occurs when an HTTP request results in an error response. The payload includes the response headers, status code and body.

### `httpGeneralError`
- **Code**: `4`
- **Payload**: `Error`
- **Description**: This error occurs when there is a general HTTP error. The payload contains the error object.

### `schemaNotFoundError`
- **Code**: `5`
- **Payload**: 
  ```typescript
  {
    schemaPath: string;
  }
  ```
- **Description**: This error occurs when the specified schema cannot be found. The payload includes the path of the missing schema.

### `schemasPackageVersionMismatchError`
- **Code**: `6`
- **Payload**: 
  ```typescript
  {
    remotePackageVersion: string;
    localPackageVersion: string;
  }
  ```
- **Description**: This error occurs when there is a version mismatch between the remote and local schema packages. The payload includes the versions of both the remote and local packages.

### `schemaVersionMismatchError`
- **Code**: `7`
- **Payload**: 
  ```typescript
  {
    remoteSchemaVersion: string;
    localSchemaVersion: string;
  }
  ```
- **Description**: This error occurs when there is a version mismatch between the remote and local schemas. The payload includes the versions of both the remote and local schemas.

# Debugging
If for some reason you want to debug the package you can either use the `getConfigParts` or the `getResolvedOptions` functions described in the API or use the more powerful debug logger.

The package debug logger is implemented using the [`debug`](https://www.npmjs.com/package/debug) npm package and is configured using the `DEBUG` Environment variable.

The following are the values you can configure to use the debug option.

### `DEBUG=*`
Enables all the logs. Note that setting this option might enable debug logging of other packages.

### `DEBUG=@map-colonies/config*`
Enables all the logs available in this package.

### `DEBUG=@map-colonies/config:config`
Enables only the logs related to the main logic of the package.

### `DEBUG=@map-colonies/config:env`
Enables only the logs related to parsing environment variables from schemas, and retrieving them for use in the configuration.

### `DEBUG=@map-colonies/config:http`
Enables only the logs related to http requests to the `config-server`.

### `DEBUG=@map-colonies/config:options`
Enables only the logs related to parsing and validation of the package initialization options.

### `DEBUG=@map-colonies/config:schemas`
Enables only the logs related to the retrieving of schemas.

### `DEBUG=@map-colonies/config:validator`
Enables only the logs related to the validation of configurations.
