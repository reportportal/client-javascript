# Dev Guide

Internal notes for contributors. This content is intentionally kept out of
README.md, which is published to package registries.

## Subpath facades

`npm run build` compiles to `build/` and then runs `scripts/generate-resolver-facades.js`,
which writes a one-line re-export at every public subpath location — `helpers.js`,
`constants.js`, `models.js`, `publicReportingAPI.js` and a `lib/**` mirror of the compiled
tree — together with matching `.d.ts` files.

Supported package imports resolve through the `exports` / `typesVersions` maps in
`package.json` straight to `build/lib`; a direct deep import (e.g.
`require('@reportportal/client-javascript/lib/helpers')`) can still load a generated facade
file instead. The facades mainly exist for tools that resolve imports by walking the
filesystem, chiefly `eslint-import-resolver-node` (the default resolver of
`eslint-plugin-import`), which otherwise reports `import/no-unresolved` for every subpath
import and forces each consumer to configure an ignore. They also keep the `lib/**` paths
published up to 5.5.x resolvable.

Everything the script writes is gitignored, recorded in `.generated-facades.json` and
removed by `npm run clean`. When a new subpath is added to `exports`, add the matching alias
to the `aliases` map in the script — the `lib/**` mirror updates itself.

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
