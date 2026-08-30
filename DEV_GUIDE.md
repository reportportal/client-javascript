# Dev Guide

Internal notes for contributors. This content is intentionally kept out of
README.md, which is published to package registries.

## Subpath facades

`npm run build` compiles to `build/` and then runs `scripts/generate-resolver-facades.js`,
which writes a one-line re-export at each public subpath alias — `helpers.js`,
`constants.js`, `models.js`, `publicReportingAPI.js` — together with matching `.d.ts` files.

Supported package imports resolve through the `exports` / `typesVersions` maps in
`package.json` straight to `build/lib` for Node, TypeScript and bundlers; these files are
never on that path. They exist only for tools that resolve imports by walking the filesystem
instead of reading `exports`, chiefly `eslint-import-resolver-node` (the default resolver of
`eslint-plugin-import`), which otherwise reports `import/no-unresolved` for these subpath
imports and forces each consumer to configure an ignore.

The alias list in the script is intentionally fixed and small — it does not mirror every
internal module under `build/lib`. Deep `lib/**` imports as published up to 5.5.x (e.g.
`require('@reportportal/client-javascript/lib/rest')`) resolve via the `exports` map for
Node, TypeScript and bundlers, but are **not** backed by a physical `lib/**` tree — a
filesystem-based resolver hitting one of those undocumented deep paths still needs a local
ignore. If you're bumping a first-party agent past this version and it imports
`@reportportal/client-javascript/lib/**` directly, switch it to the matching short alias in
the same PR rather than adding it here.

Everything the script writes is gitignored and removed by `npm run clean`. It recomputes
each facade's export style (`export *` vs `export =` vs default) from the real compiled
module on every build, so it can't silently drift the way a hand-written file could. When
you add a new top-level subpath to `exports`, add the matching entry to the `ALIASES` map in
the script.

## Code knowledge graph

This repo carries a local **code knowledge graph** ([colbymchenry/codegraph](https://github.com/colbymchenry/codegraph))
that the ReportPortal AI agents (and your own tooling) use to resolve symbols and
references without scanning raw files.

```bash
npm run codegraph             # build it the first time, fast incremental sync after
npm run codegraph -- --force  # rebuild from scratch
```

The graph lives in `.codegraph/codegraph.db` — it is **gitignored and local to your
machine** (only `.codegraph/.gitignore` is committed). It is a pure derivative of the
source, so regenerate it any time. The engine is fetched on demand via `npx`, so there
is no added project dependency.
