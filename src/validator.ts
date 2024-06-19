import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { createDebug } from './debug';

const debug = createDebug('validator');

export const ajvConfigValidator = addFormats(
  new Ajv({
    useDefaults: true,
  }),
  ['date-time', 'time', 'date', 'email', 'hostname', 'ipv4', 'ipv6', 'uri', 'uuid', 'regex', 'uri-template']
);

export const ajvLibraryConfigValidator = new Ajv({
  useDefaults: true,
  coerceTypes: true,
});
