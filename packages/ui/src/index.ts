/**
 * Public surface of `@keel/ui`.
 *
 * Strict no-`export *` policy (Requirement 2.6) so the API stays curated
 * as the package grows.
 *
 * Exports:
 *   - `filterColumnsByPermission` — pure column permission filter (task 8.1)
 *   - `KeelColumn`               — the loose column shape it accepts
 *   - `KeelTable`                — React table with forced virtual scrolling
 *                                   and column permission filtering (task 17)
 *   - `VIRTUAL_SCROLL_THRESHOLD` — the row count above which virtual
 *                                   scrolling is forced (200)
 */

export {
  filterColumnsByPermission,
  type KeelColumn,
  KeelTable,
  VIRTUAL_SCROLL_THRESHOLD,
  type KeelTableProps,
  type KeelTableColumnType,
} from './keel-table/index.js';
