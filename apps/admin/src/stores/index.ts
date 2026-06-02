/**
 * Public surface of the application's Zustand stores.
 *
 * Strict no-`export *` policy mirroring the `@keel/*` packages. Only the
 * pieces consumed by app code (hooks, types, initial-state references for
 * tests) are re-exported here.
 */

export {
  useUserStore,
  INITIAL_USER_STATE,
  type UserState,
  type UserActions,
  type UserStore,
} from './user.store.js';

export {
  useTenantStore,
  INITIAL_TENANT_STATE,
  type TenantState,
  type TenantActions,
  type TenantStore,
} from './tenant.store.js';

export {
  useAppStore,
  INITIAL_APP_STATE,
  type AppState,
  type AppActions,
  type AppStore,
} from './app.store.js';

export {
  useOrderStore,
  INITIAL_ORDER_STATE,
  type OrderState,
  type OrderActions,
  type OrderStore,
  type OrderFilters,
} from './modules/order.store.js';
