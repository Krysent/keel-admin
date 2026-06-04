/**
 * `useUserMenu` — shared dropdown definition for the user (profile / logout)
 * menu.
 *
 * Both the Header switcher and the Sider profile card render the same
 * user menu, so the items + click handling live here once instead of
 * being duplicated. Keeping it in a hook lets each consumer pass it
 * straight into AntD's `<Dropdown menu={...} />`.
 *
 * The logout branch reuses `runLogoutFlow` with the exact same dependency
 * wiring the Header used previously (auth service + token manager + the
 * three store resets) so behaviour is unchanged — only the call site moved.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { runLogoutFlow } from '../../auth/logout-flow';
import { authService } from '../../services/auth.service';
import { tokenManager } from '../../services/http';
import { useAppStore } from '../../stores/app.store';
import { useTenantStore } from '../../stores/tenant.store';
import { useUserStore } from '../../stores/user.store';

import type { MenuProps } from 'antd';

export function useUserMenu(): MenuProps {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  /** True when the active language is Chinese (zh-CN or any zh-* variant). */
  const isZhCN = i18n.language === 'zh-CN' || i18n.language?.startsWith('zh');

  return useMemo<MenuProps>(
    () => ({
      items: [
        {
          key: 'profile',
          label: t('header.user.profile', {
            defaultValue: isZhCN ? '个人信息' : 'Profile',
          }),
        },
        { type: 'divider' },
        {
          key: 'logout',
          label: t('header.user.logout', {
            defaultValue: isZhCN ? '退出登录' : 'Sign out',
          }),
        },
      ],
      onClick: async (info) => {
        if (info.key === 'logout') {
          await runLogoutFlow({
            services: { logout: () => authService.logout() },
            tokenManager,
            stores: {
              resetUser: () => useUserStore.getState().reset(),
              resetTenant: () => useTenantStore.getState().reset(),
              resetApp: () => useAppStore.getState().reset(),
            },
          });
          navigate('/login', { replace: true });
        }
      },
    }),
    [t, isZhCN, navigate],
  );
}
