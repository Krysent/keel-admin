# @keel/ui

Business components for keel-admin. Thin wrappers around `@ant-design/pro-components` with built-in theme, i18n, and column-level permission filtering.

## Installation

```bash
pnpm add @keel/ui
# peer dependencies
pnpm add react react-dom antd @ant-design/pro-components
```

## Components

### `KeelTable<T, P>`

Enhanced ProTable with:

- **Column permission filtering**: columns with `permission` field are auto-hidden when user lacks the permission
- **Forced virtual scrolling**: when `dataSource.length > 200`, virtual scroll is automatically enabled (cannot be disabled)
- **Sensible defaults**: pagination (10/page), density toggle, refresh, column settings always enabled

```tsx
import { KeelTable } from '@keel/ui';

<KeelTable
  columns={[
    { title: 'Name', dataIndex: 'name' },
    { title: 'Actions', dataIndex: 'actions', permission: 'user:delete' },
  ]}
  request={async (params) => {
    const data = await fetchUsers(params);
    return { data: data.list, total: data.total };
  }}
/>
```

### Column Permission Filter (Pure Function)

```ts
import { filterColumnsByPermission } from '@keel/ui';

const visibleColumns = filterColumnsByPermission(columns, userPermissions);
```

## Exports

| Export | Description |
|--------|-------------|
| `KeelTable` | ProTable wrapper with permission + virtual scroll |
| `KeelTableProps` | Props type for KeelTable |
| `KeelTableColumnType` | Column type with optional `permission` field |
| `filterColumnsByPermission` | Pure column filter function |
| `VIRTUAL_SCROLL_THRESHOLD` | Row count threshold for virtual scroll (200) |

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history.
