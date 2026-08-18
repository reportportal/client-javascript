/* eslint-disable no-console */
/**
 * Generates plain filesystem facades for every public subpath of the package.
 *
 * The compiled output lives under `build/lib`, and subpaths such as
 * `@reportportal/client-javascript/helpers` are mapped there through
 * `package.json#exports` / `#typesVersions`. Node, TypeScript and bundlers all read those
 * maps, but tools that resolve imports by walking the filesystem do not — most notably
 * `eslint-import-resolver-node`, the default resolver of `eslint-plugin-import`, which
 * reports `import/no-unresolved` for every subpath import.
 *
 * To keep those tools working without any consumer-side configuration, this script emits a
 * thin file at each subpath location that simply re-exports the real module. The files are
 * never loaded at runtime (the `exports` map always wins), they only give filesystem-based
 * resolvers something to find. They also restore the `lib/**` layout published up to 5.5.x,
 * so imports written against the pre-TypeScript releases keep resolving.
 *
 * Everything written here is generated at build time, listed in `MANIFEST` and removed by
 * `--clean`; nothing is meant to be edited or committed by hand.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BUILD_LIB = path.join(ROOT, 'build', 'lib');
const MANIFEST = path.join(ROOT, '.generated-facades.json');

const toPosix = (p) => p.split(path.sep).join('/');

const readManifest = () => {
  try {
    const entries = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    return Array.isArray(entries) ? entries : [];
  } catch (e) {
    return [];
  }
};

/** Removes the files listed in the manifest, plus any directories left empty behind them. */
const clean = () => {
  const entries = readManifest();
  const dirs = new Set();

  entries.forEach((entry) => {
    const target = path.join(ROOT, entry);
    if (fs.existsSync(target)) {
      fs.rmSync(target);
    }
    dirs.add(path.dirname(target));
  });

  // Deepest first, so nested directories empty out before their parents are checked.
  [...dirs]
    .sort((a, b) => b.length - a.length)
    .forEach((dir) => {
      if (dir !== ROOT && fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
        fs.rmdirSync(dir);
      }
    });

  if (fs.existsSync(MANIFEST)) {
    fs.rmSync(MANIFEST);
  }

  return entries.length;
};

/** Every `.js` file under `build/lib`, as paths relative to `build/lib`. */
const collectModules = (dir = BUILD_LIB) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return collectModules(absolute);
    }
    return entry.isFile() && entry.name.endsWith('.js')
      ? [toPosix(path.relative(BUILD_LIB, absolute)).replace(/\.js$/, '')]
      : [];
  });

/**
 * Maps a subpath the package exposes to the `build/lib` module backing it.
 * `lib/**` mirrors the compiled tree; the short aliases match the `exports` map.
 */
const buildFacadeMap = () => {
  const modules = collectModules();
  const facades = new Map(modules.map((module) => [`lib/${module}`, module]));

  const aliases = {
    helpers: 'helpers',
    publicReportingAPI: 'publicReportingAPI',
    constants: 'constants/index',
    models: 'models/index',
  };

  Object.entries(aliases).forEach(([subpath, module]) => {
    if (modules.includes(module)) {
      facades.set(subpath, module);
    }
  });

  return facades;
};

/** Relative specifier from a facade to its target module, e.g. `../../build/lib/helpers`. */
const specifierFor = (subpath, module) => {
  const from = path.dirname(path.join(ROOT, subpath));
  const to = path.join(BUILD_LIB, module);
  const relative = toPosix(path.relative(from, to));
  return relative.startsWith('.') ? relative : `./${relative}`;
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
  if (!fs.existsSync(BUILD_LIB)) {
    throw new Error(`Nothing to generate from: ${toPosix(path.relative(ROOT, BUILD_LIB))} is missing, run "tsc" first.`);
  }

  clean();

  const written = [];

  buildFacadeMap().forEach((module, subpath) => {
    const specifier = specifierFor(subpath, module);
    const jsFacade = path.join(ROOT, `${subpath}.js`);
    fs.mkdirSync(path.dirname(jsFacade), { recursive: true });
    fs.writeFileSync(jsFacade, `module.exports = require('${specifier}');\n`);
    written.push(`${subpath}.js`);

    const declaration = path.join(BUILD_LIB, `${module}.d.ts`);
    if (fs.existsSync(declaration)) {
      fs.writeFileSync(path.join(ROOT, `${subpath}.d.ts`), declarationFacade(specifier, declaration));
      written.push(`${subpath}.d.ts`);
    }
  });

  written.sort();
  fs.writeFileSync(MANIFEST, `${JSON.stringify(written, null, 2)}\n`);

  return written.length;
};

if (process.argv.includes('--clean')) {
  console.log(`Removed ${clean()} generated resolver facade(s).`);
} else {
  console.log(`Generated ${generate()} resolver facade(s).`);
}
