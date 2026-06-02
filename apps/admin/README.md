# `@keel/admin`

The SaaS admin business application for the `keel-admin` monorepo.

> **Status:** scaffolded for task **9.1 — Implement Zustand stores**.
> Vite tooling, the layout shell, and page-level pieces land in subsequent
> task-9.x sub-tasks (see `.kiro/specs/saas-admin-template/tasks.md`).

## Current surface

```
apps/admin/
├── src/
│   └── stores/
│       ├── user.store.ts        # userInfo + menus + permissions(Set) + roles
│       ├── tenant.store.ts      # current / list / switchTenant
│       ├── app.store.ts         # collapsed / theme / locale / tabs
│       ├── modules/
│       │   └── order.store.ts   # example business slice (filters, selection)
│       └── index.ts             # curated re-exports
└── tests/
    ├── setup.ts                 # vitest setupFiles entry
    ├── setup-local-storage.ts   # in-memory localStorage helper
    └── stores/                  # smoke tests for each slice
```

## Scripts

```bash
pnpm --filter @keel/admin run typecheck
pnpm --filter @keel/admin run test
```

`dev` / `build` will be wired in task **12 (Vite plugin matrix & multi-env)**.
