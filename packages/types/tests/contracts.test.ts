import { describe, expectTypeOf, it } from 'vitest';

import type {
  ApiEnvelope,
  BizErrorPayload,
  HttpErrorKind,
  LocaleCode,
  MenuNode,
  PageQuery,
  PageResult,
  SortDescriptor,
  TabItem,
  Tenant,
  ThemeMode,
  TokenPair,
  UserInfo,
} from '../src/index.js';

/**
 * These tests don't *do* anything at runtime — they simply assert at the type
 * level that the public surface of `@keel/types` is shaped the way the rest
 * of the monorepo expects. If a contract drift accidentally lands here, the
 * build fails before any consumer (http / auth / ui) breaks.
 */
describe('@keel/types public contract', () => {
  it('ApiEnvelope is generic over its data payload', () => {
    expectTypeOf<ApiEnvelope<{ id: string }>>().toMatchTypeOf<{
      code: number;
      data: { id: string };
      message: string;
    }>();
  });

  it('PageResult composes inside ApiEnvelope', () => {
    type Wrapped = ApiEnvelope<PageResult<UserInfo>>;
    expectTypeOf<Wrapped['data']['list']>().toEqualTypeOf<UserInfo[]>();
  });

  it('PageQuery has page + pageSize', () => {
    expectTypeOf<PageQuery>().toMatchTypeOf<{ page: number; pageSize: number }>();
  });

  it('SortDescriptor uses the SortDirection union', () => {
    type Direction = SortDescriptor['direction'];
    expectTypeOf<Direction>().toEqualTypeOf<'asc' | 'desc'>();
  });

  it('UserInfo carries permissions/roles as string arrays on the wire', () => {
    expectTypeOf<UserInfo['permissions']>().toEqualTypeOf<string[]>();
    expectTypeOf<UserInfo['roles']>().toEqualTypeOf<string[]>();
  });

  it('TokenPair access/refresh are required, expiresAt optional', () => {
    expectTypeOf<TokenPair>().toMatchTypeOf<{ accessToken: string; refreshToken: string }>();
    expectTypeOf<TokenPair['expiresAt']>().toEqualTypeOf<number | undefined>();
  });

  it('Tenant requires id + name', () => {
    expectTypeOf<Tenant>().toMatchTypeOf<{ id: string; name: string }>();
  });

  it('MenuNode is recursive via children', () => {
    expectTypeOf<MenuNode['children']>().toEqualTypeOf<MenuNode[] | undefined>();
  });

  it('TabItem mirrors the MenuNode metadata fields used by the layout', () => {
    expectTypeOf<TabItem>().toMatchTypeOf<{ key: string; title: string; path: string }>();
  });

  it('BizErrorPayload models the wire shape of a business error', () => {
    expectTypeOf<BizErrorPayload>().toMatchTypeOf<{ code: number; message: string }>();
  });

  it('HttpErrorKind is the documented closed union', () => {
    expectTypeOf<HttpErrorKind>().toEqualTypeOf<
      'network' | 'timeout' | 'business' | 'auth' | 'forbidden' | 'canceled' | 'unknown'
    >();
  });

  it('LocaleCode and ThemeMode are closed unions', () => {
    expectTypeOf<LocaleCode>().toEqualTypeOf<'zh-CN' | 'en-US'>();
    expectTypeOf<ThemeMode>().toEqualTypeOf<'light' | 'dark'>();
  });
});
