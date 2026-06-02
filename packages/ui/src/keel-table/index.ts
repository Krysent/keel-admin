/**
 * `KeelTable` — the package's table封装.
 *
 * Exports:
 *   - `filterColumnsByPermission` — pure column permission filter (task 8.1)
 *   - `KeelTable` — React component with forced virtual scrolling &
 *                    permission column filtering (task 17)
 *
 * Curated re-exports only — no `export *` (Requirement 2.6).
 */

export {
  filterColumnsByPermission,
  type KeelColumn,
} from './filter-columns.js';

export {
  KeelTable,
  VIRTUAL_SCROLL_THRESHOLD,
  type KeelTableProps,
  type KeelTableColumnType,
} from './KeelTable.js';
