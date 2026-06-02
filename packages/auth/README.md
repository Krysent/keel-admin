# @keel/auth

Permission mechanism for keel-admin. Provides pure permission evaluation, menu-to-route conversion, and React-bound permission components. Business-agnostic — works with any permission code set.

## Installation

```bash
pnpm add @keel/auth
# peer dependencies
pnpm add react react-router-dom
```

## API

### `createAuth(adapter: AuthAdapter)`

Factory that binds a business-side adapter (reads permissions from your store) and returns React hooks/components.

```ts
import { createAuth } from '@keel/auth';
import { useUserStore } from '@/stores/user.store';

export const { usePermission, Auth, AuthGuard, buildRoutes } = createAuth({
  useContext: () => {
    const { permissions, roles } = useUserStore();
    return { permissions, roles };
  },
});
```

### `usePermission()`

Hook returned by `createAuth`. Evaluates permission codes against the current user's set.

```ts
const { has, hasRole } = usePermission();

has('order:delete');                    // single code
has(['order:delete', 'order:update'], 'some');  // any match
has(['order:delete', 'order:update'], 'every'); // all match
```

### `<Auth code fallback />`

Component that conditionally renders children based on permission.

```tsx
<Auth code="order:delete" fallback={<span>No access</span>}>
  <Button danger>Delete</Button>
</Auth>
```

### `buildRoutes(menus: MenuNode[], ctx: BuildRoutesContext): RouteObject[]`

Converts a backend menu tree into React Router v6 route objects:

- Filters nodes by permission codes
- Wraps lazy-loaded components with `AuthGuard`
- Handles `redirect`, `hidden` nodes
- Always preserves static fallback routes (`/login`, `/exception/403`, `/exception/404`, `*`)

```ts
const routes = buildRoutes(menuTree, {
  permissions: userPermissions,
  lazyImport: (path) => () => import(`@/pages/${path}.tsx`),
});
```

### `evaluatePermission(codes, permissions, mode)`

Pure function (no React dependency) for permission evaluation.

```ts
import { evaluatePermission } from '@keel/auth';

evaluatePermission('order:list', new Set(['order:list', 'order:create'])); // true
evaluatePermission(['a', 'b'], perms, 'every'); // true only if both present
```

## Design Principles

- **Mechanism vs Data**: This package provides the evaluation engine. Business permission codes, role definitions, and menu seeds belong in `apps/<your-app>`.
- **Adapter pattern**: Inject your store via `createAuth(adapter)` — no coupling to Zustand or any specific state library.
- **ABAC extensible**: Use `PermissionContext.predicate` for attribute-based access control.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history.
