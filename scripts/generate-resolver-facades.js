/**
 * Generates filesystem facades for the package's public subpath aliases.
 *
 * `helpers`, `constants`, `models` and `publicReportingAPI` are mapped to `build`
 * through `package.json#exports` / `#typesVersions`. Node, TypeScript and bundlers all read
 * those maps, but tools that resolve imports by walking the filesystem do not — most notably
 * `eslint-import-resolver-node`, the default resolver of `eslint-plugin-import`, which
 * reports `import/no-unresolved` for these subpath imports.
 *
 * To keep those tools working without any consumer-side configuration, this script writes a
 * thin file at each alias location that simply re-exports the real module. The files are
 * never loaded at runtime (the `exports` map always wins); they only give filesystem-based
 * resolvers something to find.
 *
 * The alias list is intentionally fixed and small — this does not attempt to mirror every
 * internal module under `build` (see DEV_GUIDE.md#subpath-facades for why). Everything
 * written here is gitignored and regenerated on every build; nothing is meant to be edited
 * or committed by hand.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BUILD_DIR = path.join(ROOT, 'build');

const toPosix = (p) => p.split(path.sep).join('/');

/** Public subpath alias -> module it re-exports, relative to `build`. */
const ALIASES = {
  helpers: 'helpers',
  constants: 'constants/index',
  models: 'models/index',
  publicReportingAPI: 'publicReportingAPI',
};

const facadeFiles = () => Object.keys(ALIASES).flatMap((name) => [`${name}.js`, `${name}.d.ts`]);

const clean = () => {
  const files = facadeFiles().filter((file) => fs.existsSync(path.join(ROOT, file)));
  files.forEach((file) => fs.rmSync(path.join(ROOT, file)));
  return files.length;
};

/**
 * Declaration facades must mirror the export style of their target: `export =` modules
 * cannot be re-exported with `export *`, and `export *` never carries a default export.
 */
const declarationFacade = (specifier, declaration) => {
  const source = fs.readFileSync(declaration, 'utf8');

  if (/^export = /m.test(source)) {
    return `import target = require('${specifier}');\nexport = target;\n`;
  }

  const lines = [`export * from '${specifier}';`];
  if (/^export default /m.test(source)) {
    lines.push(`export { default } from '${specifier}';`);
  }
  return `${lines.join('\n')}\n`;
};

const generate = () => {
  if (!fs.existsSync(BUILD_DIR)) {
    throw new Error(`Nothing to generate from: ${toPosix(path.relative(ROOT, BUILD_DIR))} is missing, run "tsc" first.`);
  }

  Object.entries(ALIASES).forEach(([name, module]) => {
    const specifier = `./build/${module}`;

    fs.writeFileSync(path.join(ROOT, `${name}.js`), `module.exports = require('${specifier}');\n`);

    const declaration = path.join(BUILD_DIR, `${module}.d.ts`);
    fs.writeFileSync(path.join(ROOT, `${name}.d.ts`), declarationFacade(specifier, declaration));
  });

  return Object.keys(ALIASES).length;
};

if (process.argv.includes('--clean')) {
  console.log(`Removed ${clean()} generated resolver facade file(s).`);
} else {
  console.log(`Generated ${generate()} resolver facade(s).`);
}
