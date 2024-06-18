import { request } from 'undici';

export async function getConfig(configName: string, version: number | 'latest'): Promise<Config> {
  const url = `${configServerUrl}/config/${configName}/${version}`;
  const { body, statusCode } = await request(url);

  assert(statusCode === StatusCodes.OK, `Failed to fetch config from ${url}`);

  const config = (await body.json()) as Config;
}
