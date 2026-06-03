/**
 * Public surface of the services module.
 *
 * Each service is exported as a named object containing typed API methods.
 * The shared HTTP instance (`http`) and token manager are also exported for
 * consumers that need direct access (e.g. the auth context provider in
 * task 9's bootstrap layer).
 */

export { http, tokenManager } from './http';
export { authService, type LoginParams } from './auth.service';
export { userService, type UserListQuery, type CreateUserParams, type UpdateUserParams } from './user.service';
export { menuService } from './menu.service';
export {
  orderService,
  type Order,
  type OrderListQuery,
  type CreateOrderParams,
  type UpdateOrderParams,
} from './order.service';
