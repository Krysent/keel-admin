/**
 * Order service — example business CRUD module.
 *
 * Demonstrates the service layer convention: thin typed wrappers over
 * HTTP calls. Return types are already envelope-unwrapped by `@keel/http`.
 *
 * Validates: Requirements 3.2, 5.4
 */

import type { PageQuery, PageResult } from '@keel/types';

import { http } from './http';

/** Order entity as returned by the backend. */
export interface Order {
  id: string;
  sn: string;
  amount: number;
  status: string;
  customerName?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface OrderListQuery extends PageQuery {
  keyword?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface CreateOrderParams {
  sn: string;
  amount: number;
  status: string;
  customerName?: string;
}

export interface UpdateOrderParams {
  amount?: number;
  status?: string;
  customerName?: string;
}

export const orderService = {
  /**
   * GET /orders — paginated order list.
   */
  list: (params: OrderListQuery): Promise<PageResult<Order>> =>
    http.get('/orders', { params }) as unknown as Promise<PageResult<Order>>,

  /**
   * GET /orders/:id — single order detail.
   */
  detail: (id: string): Promise<Order> =>
    http.get(`/orders/${id}`) as unknown as Promise<Order>,

  /**
   * POST /orders — create a new order.
   */
  create: (data: CreateOrderParams): Promise<Order> =>
    http.post('/orders', data) as unknown as Promise<Order>,

  /**
   * PUT /orders/:id — update an existing order.
   */
  update: (id: string, data: UpdateOrderParams): Promise<Order> =>
    http.put(`/orders/${id}`, data) as unknown as Promise<Order>,

  /**
   * DELETE /orders/:id — remove an order.
   */
  remove: (id: string): Promise<void> =>
    http.delete(`/orders/${id}`) as unknown as Promise<void>,

  /**
   * POST /orders/export — trigger an export job. Returns the download URL.
   */
  export: (params: Omit<OrderListQuery, 'page' | 'pageSize'>): Promise<{ url: string }> =>
    http.post('/orders/export', params) as unknown as Promise<{ url: string }>,
};
