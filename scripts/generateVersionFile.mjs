import { writeFileSync } from 'fs';
import { readPackageJsonSync } from '@map-colonies/read-pkg';

const packageJson = readPackageJsonSync();
const version = packageJson.version;
const versionFile = 'src/version.ts';

const content = `/* prettier-ignore */\n/* eslint-disable*/\nexport const PACKAGE_VERSION = '${version}';\n`;

writeFileSync(versionFile, content);
