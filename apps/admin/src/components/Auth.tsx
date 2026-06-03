/**
 * `<Auth />` — business-side permission gate component.
 *
 * Wraps the mechanism from `@keel/auth`'s `evaluatePermission` with the
 * admin app's `userStore` to provide a declarative "show/hide by
 * permission code" component.
 *
 * Usage:
 *   <Auth code={PERMISSIONS.USER.DELETE}>
 *     <Button danger>Delete</Button>
 *   </Auth>
 *
 * When the user does NOT hold the required permission code(s), the
 * component renders `fallback` (defaults to `null`, i.e. hidden).
 *
 * Validates: Requirement 4.4
 */

import type { ReactNode } from 'react';
import { evaluatePermission, type PermissionMode } from '@keel/auth';

import { useUserStore } from '../stores/user.store';

export interface AuthProps {
  /** Permission code(s) required to render children. */
  code: string | readonly string[];
  /** Collapse mode when `code` is an array. Default: 'some'. */
  mode?: PermissionMode;
  /** Rendered when permission check fails. Default: null (hidden). */
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Declarative permission gate.
 *
 * Renders `children` when the current user holds the required permission
 * code(s); otherwise renders `fallback` (default hidden).
 */
export function Auth({
  code,
  mode = 'some',
  fallback = null,
  children,
}: AuthProps): JSX.Element {
  const permissions = useUserStore((s) => s.permissions);
  const roles = useUserStore((s) => s.roles);

  const ctx = { permissions, roles };
  const allowed = evaluatePermission(ctx, code, mode);

  return <>{allowed ? children : fallback}</>;
}
