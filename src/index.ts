export { ConfigOptions } from './types';
export { config } from './config';
export { ConfigErrors, isConfigError, ConfigError } from './errors';
// const config = new Config(commonBoilerplateV1,'avi');
// const res = config.get('telemetry.logger');

// (async () => {
//   const fconfig = await config({
//     configServerUrl: 'http://localhost:8080',
//     schema: commonDbFullV1,
//     configName: 'test-db',
//     version: 'latest',
//   });
//   const res2 = fconfig.getAll();
//   const res3 = fconfig.get('ssl');
//   console.log(res2);

//   // console.log(res2);
// })().catch(console.error);
