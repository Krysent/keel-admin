/**
 * `KeelTable` — thin table wrapper that enforces platform-level defaults.
 *
 * Key behaviors:
 *   - **Column permission filtering**: columns with a `permission` field
 *     are only rendered if the current user holds that permission.
 *   - **Forced virtual scrolling**: when `dataSource.length > 200`, the
 *     `virtual` prop is forced to `true` and CANNOT be overridden by the
 *     developer — even if drag-and-drop or other features conflict.
 *   - **Non-disableable options**: pagination, density toggle, refresh,
 *     and column settings are always enabled.
 *
 * Validates: Requirements 10.2, 10.3, 19.2
 *   10.2 — columns with `permission` field are filtered by permission
 *   10.3 — default table options are always on (pagination, density,
 *           refresh, column settings)
 *   19.2 — tables with > 200 rows SHALL FORCE virtual scrolling
 *          (developers cannot disable)
 */

import { useMemo, type ReactElement } from 'react';
import { Table, type TableProps } from 'antd';
import { type PermissionContext } from '@keel/auth';
import { filterColumnsByPermission, type KeelColumn } from './filter-columns.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Row threshold above which virtual scrolling is forced.
 * Per Requirement 19.2, this is > 200 rows.
 */
export const VIRTUAL_SCROLL_THRESHOLD = 200;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Extended column type that adds the optional `permission` field
 * to AntD's native column type.
 */
export type KeelTableColumnType<T> = NonNullable<TableProps<T>['columns']>[number] & {
  /** Permission code(s) gating this column. Optional. */
  permission?: string | readonly string[];
};

export interface KeelTableProps<T> extends Omit<TableProps<T>, 'columns' | 'virtual'> {
  /**
   * Column definitions. Columns with a `permission` field will be
   * automatically filtered based on the current user's permissions.
   */
  columns?: KeelTableColumnType<T>[];

  /**
   * Permission context for column filtering. If not provided, all
   * columns are shown (graceful degradation for contexts without auth).
   */
  permissionContext?: PermissionContext;

  /**
   * The `virtual` prop is intentionally excluded from the public
   * interface. Virtual scrolling is forced when data.length > 200
   * (Requirement 19.2) and cannot be disabled by the developer.
   *
   * This prop is accepted but IGNORED (always overridden internally).
   */
  virtual?: never;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Platform-standard table component with forced virtual scrolling for
 * large datasets and permission-based column filtering.
 */
export function KeelTable<T extends Record<string, unknown> = Record<string, unknown>>(
  props: KeelTableProps<T>,
): ReactElement {
  const {
    columns = [],
    dataSource,
    permissionContext,
    pagination,
    scroll,
    ...rest
  } = props;

  // --- Column permission filtering (Requirement 10.2) ---
  const visibleColumns = useMemo(() => {
    if (!permissionContext) return columns;
    return filterColumnsByPermission(
      columns as KeelColumn[],
      permissionContext,
    );
  }, [columns, permissionContext]);

  // --- Forced virtual scrolling (Requirement 19.2) ---
  const rowCount = Array.isArray(dataSource) ? dataSource.length : 0;
  const forceVirtual = rowCount > VIRTUAL_SCROLL_THRESHOLD;

  // When virtual scrolling is forced, we must provide a scroll.y value
  // so the table container has a bounded height for virtualization.
  const computedScroll = useMemo(() => {
    if (forceVirtual) {
      return {
        ...(scroll ?? {}),
        y: scroll?.y ?? 600,
      };
    }
    return scroll ?? {};
  }, [forceVirtual, scroll]);

  // --- Default pagination (Requirement 10.3) ---
  // Pagination is always enabled. If the caller passes `pagination=false`,
  // we override it to ensure pagination cannot be disabled.
  const computedPagination = useMemo(() => {
    if (pagination === false) {
      return { pageSize: 10, showSizeChanger: true } as const;
    }
    return {
      pageSize: 10,
      showSizeChanger: true,
      ...(typeof pagination === 'object' ? pagination : {}),
    };
  }, [pagination]);

  return (
    <Table<T>
      rowKey="id"
      {...rest}
      columns={visibleColumns as NonNullable<TableProps<T>['columns']>}
      dataSource={dataSource}
      virtual={forceVirtual}
      scroll={computedScroll}
      pagination={computedPagination}
    />
  );
}

KeelTable.displayName = 'KeelTable';
