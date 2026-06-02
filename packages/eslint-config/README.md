# @keel/eslint-config

Shared ESLint, Prettier, and TypeScript configuration for all keel-admin workspaces.

## Installation

```bash
pnpm add -D @keel/eslint-config eslint prettier typescript
```

## Usage

### Base Config (TypeScript, no React)

For packages like `@keel/http`, `@keel/utils`, `@keel/types`:

```js
// .eslintrc.cjs
module.exports = {
  extends: [require.resolve('@keel/eslint-config')],
};
```

### React Config

For `apps/admin` and `@keel/ui`:

```js
// .eslintrc.cjs
module.exports = {
  extends: [require.resolve('@keel/eslint-config/react')],
};
```

### Node Config

For tooling scripts and build configs:

```js
// .eslintrc.cjs
module.exports = {
  extends: [require.resolve('@keel/eslint-config/node')],
};
```

### Prettier Config

```js
// .prettierrc.cjs
module.exports = require('@keel/eslint-config/prettier');
```

## Exported Configs

| Export | Target |
|--------|--------|
| `@keel/eslint-config` (default) | Base TS (framework-agnostic) |
| `@keel/eslint-config/react` | React + JSX + Hooks |
| `@keel/eslint-config/node` | Node.js scripts |
| `@keel/eslint-config/prettier` | Prettier shared config |
| `@keel/eslint-config/tsconfig.json` | Shared TS config reference |

## Key Rules

- `consistent-type-imports`: enforces `import type { ... }` syntax
- `import/order`: groups and alphabetizes imports
- `no-console`: warns (allows `warn` / `error`)
- `no-unused-vars`: errors (ignores `_`-prefixed)
- React hooks exhaustive-deps (in react config)

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history.
