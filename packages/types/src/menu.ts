/**
 * Menu / navigation shared types.
 *
 * The backend returns a forest of `MenuNode` from `/user/menus`. `@keel/auth`'s
 * `buildRoutes` then transforms it into a React Router v6 `RouteObject[]`,
 * applying:
 *   - permission filtering (Requirement 3.5)
 *   - redirect handling (Requirement 4.6)
 *   - hidden flag preservation (Requirement 4.7)
 *
 * Only the *shape* lives here — the algorithm lives in `@keel/auth`.
 */
export interface MenuNode {
  /** Unique node id. Stable across reloads (used as React key). */
  id: string;
  /** i18n key OR raw label. Convention: prefer i18n key like 'menu.system.user'. */
  title: string;
  /** Absolute path; ignored when `redirect` is set. */
  path: string;
  /** Iconify name or @keel/ui icon registry key. */
  icon?: string;
  /**
   * Module key used to lazy-load the page component, e.g. `'system/user'`.
   * Resolved against `import.meta.glob('/src/pages/**\/*.tsx')`.
   */
  component?: string;
  /** When set, the route renders <Navigate to={redirect} replace /> instead. */
  redirect?: string;
  /**
   * Permission codes guarding this node. Semantics:
   *   - empty / undefined  → always visible
   *   - non-empty          → visible iff user has *at least one* matching code
   * (Mirrors `<Auth code mode="some">` defaults; can be tightened per route.)
   */
  permissionCodes?: string[];
  /** When true: route still mounts but the menu item is not rendered in the sider. */
  hidden?: boolean;
  /** When true: tab cannot be closed by the user (Requirement 7.3). */
  affix?: boolean;
  /** External URL — clicking the menu opens it in a new tab. */
  externalLink?: string;
  /** Recursive forest. Leaves typically have `component`; branches do not. */
  children?: MenuNode[];
  /** Free-form metadata propagated to route handles for layout / breadcrumb. */
  meta?: Record<string, unknown>;
}

/**
 * A single open tab in the BasicLayout's multi-tab strip (Requirement 7.2).
 *
 * The tab list is derived from route navigation events; `affix` mirrors
 * `MenuNode.affix` so a closed-by-default home tab can be configured at the
 * menu level.
 */
export interface TabItem {
  /** Stable key, typically the route's pathname + search. */
  key: string;
  title: string;
  path: string;
  icon?: string;
  /** When true the close button is hidden. */
  affix?: boolean;
  /** Optional metadata copied from the route handle. */
  meta?: Record<string, unknown>;
}
