/**
 * Unit tests for the logout orchestration helper.
 *
 * Confirms Requirement 6.2 ("登出 THEN 系统 SHALL 调用所有切片的 reset()
 * 方法") and 17.2 cleanup behaviour (token clear + store reset are
 * unconditional).
 */

import { describe, expect, it, vi } from 'vitest';

import { runLogoutFlow, type LogoutDeps } from '../../src/auth/logout-flow.ts';

import type { TokenManager } from '@keel/http';
import type { TokenPair } from '@keel/types';

function makeTokenManager(): TokenManager & { _stored: TokenPair | null } {
  let stored: TokenPair | null = { accessToken: 'a', refreshToken: 'r' };
  return {
    getAccess: () => stored?.accessToken ?? null,
    getRefresh: () => stored?.refreshToken ?? null,
    set: (pair) => {
      stored = pair;
    },
    clear: () => {
      stored = null;
    },
    isRefreshing: () => false,
    refresh: async () => stored?.accessToken ?? '',
    get _stored() {
      return stored;
    },
  } as TokenManager & { _stored: TokenPair | null };
}

describe('runLogoutFlow', () => {
  it('clears tokens and resets every supplied store', async () => {
    const tm = makeTokenManager();
    const resetUser = vi.fn();
    const resetTenant = vi.fn();
    const resetApp = vi.fn();
    const resetOrder = vi.fn();

    const deps: LogoutDeps = {
      services: { logout: vi.fn().mockResolvedValue(undefined) },
      tokenManager: tm,
      stores: {
        resetUser,
        resetTenant,
        resetApp,
        resetModules: [resetOrder],
      },
    };

    await runLogoutFlow(deps);

    expect(deps.services.logout).toHaveBeenCalledTimes(1);
    expect((tm as unknown as { _stored: TokenPair | null })._stored).toBeNull();
    expect(resetUser).toHaveBeenCalledTimes(1);
    expect(resetTenant).toHaveBeenCalledTimes(1);
    expect(resetApp).toHaveBeenCalledTimes(1);
    expect(resetOrder).toHaveBeenCalledTimes(1);
  });

  it('still cleans up locally when /auth/logout fails', async () => {
    const tm = makeTokenManager();
    const resetUser = vi.fn();

    await runLogoutFlow({
      services: { logout: vi.fn().mockRejectedValue(new Error('network')) },
      tokenManager: tm,
      stores: { resetUser },
    });

    expect((tm as unknown as { _stored: TokenPair | null })._stored).toBeNull();
    expect(resetUser).toHaveBeenCalledTimes(1);
  });

  it('skips the server call when no logout service is provided', async () => {
    const tm = makeTokenManager();
    const resetUser = vi.fn();

    await runLogoutFlow({
      services: {},
      tokenManager: tm,
      stores: { resetUser },
    });

    expect((tm as unknown as { _stored: TokenPair | null })._stored).toBeNull();
    expect(resetUser).toHaveBeenCalledTimes(1);
  });
});
