/**
 * Pure helpers that turn the user's `MenuNode` forest into the data
 * structures the Sider menu and Breadcrumb need.
 *
 * Kept framework-free so they can be unit-tested in node without
 * rendering. The React component layer in `layout/sider.tsx` consumes
 * the output and feeds it to `<Menu />` / `<Breadcrumb />`.
 *
 * Requirement coverage:
 *   - 7.1   Sider tree is rendered from the menu forest.
 *   - 7.4   Switching language re-translates the menu titles — handled
 *           in the React layer by passing the i18n key down and letting
 *           react-i18next re-render. The pure helpers preserve the i18n
 *           key (they never store the translated string).
 *   - 7.6   Breadcrumb walks ancestors of the active path.
 *   - 4.7   `hidden:true` nodes are *kept in the route tree* but
 *           omitted from the Sider — that's the only place we filter.
 */

import type { MenuNode } from '@keel/types';

/** Shape consumed by AntD's `<Menu items={...} />`. */
export interface MenuItem {
  /** Stable key — matches the corresponding route path so the Sider's
   *  `selectedKeys` follows the active route. */
  key: string;
  /** i18n key (the React layer translates it). */
  label: string;
  /** Icon registry key (or undefined → no icon). */
  icon?: string;
  /** Recursively converted children. Empty/absent for leaves. */
  children?: MenuItem[];
}

/**
 * Convert a `MenuNode[]` forest into AntD `MenuItem[]`.
 *
 * Filtering rules:
 *   - `hidden:true`  → skipped (route still exists, just not visible).
 *   - `redirect`     → skipped because the redirect collapses to the
 *                      target node which is already in the tree.
 *
 * Empty children arrays are dropped so AntD renders a leaf, not an
 * empty submenu.
 */
export function buildMenuItems(menus: readonly MenuNode[]): MenuItem[] {
  const out: MenuItem[] = [];
  for (const node of menus) {
    if (node.hidden) continue;
    if (node.redirect !== undefined) continue;
    const children =
      node.children && node.children.length > 0
        ? buildMenuItems(node.children)
        : undefined;
    const item: MenuItem = { key: node.path, label: node.title };
    if (node.icon !== undefined) item.icon = node.icon;
    if (children !== undefined && children.length > 0) item.children = children;
    out.push(item);
  }
  return out;
}

/**
 * Walk the forest and find the chain of ancestors leading to the
 * deepest node whose `path` equals `targetPath`.
 *
 * Returns `null` when the path isn't in the menu (e.g. a hidden detail
 * route), letting the layout decide whether to fall back to the matched
 * route's `handle.menu` or omit the breadcrumb entirely.
 *
 * Loop invariant: while recursing, `trail` always holds the *exclusive*
 * ancestor chain of the node currently being inspected — pushing the
 * node before recursing is what gives the caller the inclusive chain.
 */
export function findMenuPath(
  menus: readonly MenuNode[],
  targetPath: string,
): MenuNode[] | null {
  const trail: MenuNode[] = [];
  function dfs(nodes: readonly MenuNode[]): boolean {
    for (const node of nodes) {
      trail.push(node);
      if (node.path === targetPath) return true;
      if (node.children && node.children.length > 0 && dfs(node.children)) {
        return true;
      }
      trail.pop();
    }
    return false;
  }
  return dfs(menus) ? [...trail] : null;
}

/**
 * Collect all open-keys for AntD `<Menu defaultOpenKeys={...}>` so the
 * sub-menu containing the active node is open on first paint.
 *
 * Returns the paths of every ancestor of `activePath` (excluding the
 * leaf itself, since AntD's `openKeys` are sub-menu keys).
 */
export function ancestorPaths(
  menus: readonly MenuNode[],
  activePath: string,
): string[] {
  const chain = findMenuPath(menus, activePath);
  if (!chain || chain.length <= 1) return [];
  // Drop the leaf — its key goes into `selectedKeys`, not `openKeys`.
  return chain.slice(0, -1).map((n) => n.path);
}
