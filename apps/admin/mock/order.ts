/**
 * Order mock handlers — typical CRUD example.
 *
 * Validates: Requirements 11.1, 11.3, 11.4
 */

import { wrap, wrapError, wrapPage } from './_utils';

import type { MockMethod } from 'vite-plugin-mock';

const mockOrders = [
  {
    id: '1',
    sn: 'ORD-2024-001',
    amount: 1299.99,
    status: 'completed',
    customerName: 'Alice Chen',
    createdAt: '2024-01-15T09:30:00Z',
    updatedAt: '2024-01-16T14:00:00Z',
  },
  {
    id: '2',
    sn: 'ORD-2024-002',
    amount: 499.0,
    status: 'pending',
    customerName: 'Bob Wang',
    createdAt: '2024-01-16T11:00:00Z',
  },
  {
    id: '3',
    sn: 'ORD-2024-003',
    amount: 2599.5,
    status: 'shipped',
    customerName: 'Charlie Liu',
    createdAt: '2024-01-17T08:20:00Z',
    updatedAt: '2024-01-18T10:30:00Z',
  },
  {
    id: '4',
    sn: 'ORD-2024-004',
    amount: 89.9,
    status: 'cancelled',
    customerName: 'Diana Zhang',
    createdAt: '2024-01-18T15:45:00Z',
    updatedAt: '2024-01-18T16:00:00Z',
  },
  {
    id: '5',
    sn: 'ORD-2024-005',
    amount: 3200.0,
    status: 'pending',
    customerName: 'Eve Li',
    createdAt: '2024-01-19T10:10:00Z',
  },
];

const mockHandlers: MockMethod[] = [
  {
    url: '/api/orders',
    method: 'get',
    response: ({
      query,
    }: {
      query: { page?: string; pageSize?: string; keyword?: string; status?: string };
    }) => {
      const page = Number(query.page) || 1;
      const pageSize = Number(query.pageSize) || 10;
      const keyword = query.keyword?.toLowerCase() ?? '';
      const status = query.status ?? '';

      let filtered = mockOrders;
      if (keyword) {
        filtered = filtered.filter(
          (o) =>
            o.sn.toLowerCase().includes(keyword) ||
            (o.customerName?.toLowerCase().includes(keyword) ?? false),
        );
      }
      if (status) {
        filtered = filtered.filter((o) => o.status === status);
      }

      const start = (page - 1) * pageSize;
      const list = filtered.slice(start, start + pageSize);

      return wrapPage(list, filtered.length, page, pageSize);
    },
  },
  {
    url: '/api/orders/:id',
    method: 'get',
    response: ({ query }: { query: { id?: string } }) => {
      const order = mockOrders.find((o) => o.id === query.id);
      if (!order) {
        return wrapError(40400, 'Order not found');
      }
      return wrap(order);
    },
  },
  {
    url: '/api/orders',
    method: 'post',
    response: ({
      body,
    }: {
      body: { sn: string; amount: number; status: string; customerName?: string };
    }) => {
      const newOrder = {
        id: String(mockOrders.length + 1),
        sn: body.sn,
        amount: body.amount,
        status: body.status,
        customerName: body.customerName,
        createdAt: new Date().toISOString(),
      };
      return wrap(newOrder);
    },
  },
  {
    url: '/api/orders/:id',
    method: 'put',
    response: ({ body }: { body: { amount?: number; status?: string; customerName?: string } }) => {
      const order = mockOrders[0]!;
      return wrap({
        ...order,
        ...body,
        updatedAt: new Date().toISOString(),
      });
    },
  },
  {
    url: '/api/orders/:id',
    method: 'delete',
    response: () => {
      return wrap(null);
    },
  },
  {
    url: '/api/orders/export',
    method: 'post',
    response: () => {
      return wrap({ url: 'https://cdn.example.com/exports/orders-2024.xlsx' });
    },
  },
];

export default mockHandlers;
