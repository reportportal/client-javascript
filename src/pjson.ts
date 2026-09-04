import fs from 'fs';
import path from 'path';

interface PackageJson {
  name: string;
  version: string;
}

// Resolve the package's own package.json by walking up from this module's directory.
// Works both from compiled output (`build/`) and from source when run via ts-jest (`src/`).
function findPackageJson(dir: string): PackageJson {
  let current = dir;
  for (;;) {
    const candidate = path.join(current, 'package.json');
    if (fs.existsSync(candidate)) {
      return JSON.parse(fs.readFileSync(candidate, 'utf-8'));
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error('Unable to locate package.json for @reportportal/client-javascript');
    }
    current = parent;
  }
}

const pjson = findPackageJson(__dirname);

export const PJSON_NAME = pjson.name;
export const PJSON_VERSION = pjson.version;
