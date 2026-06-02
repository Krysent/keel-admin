/**
 * `BasicLayout` — the protected-area shell.
 *
 * Implements Requirement 7.1: "Sider + Header + Breadcrumb + Tabs +
 * Outlet" rendered for every authenticated route. The Header already
 * owns the breadcrumb host so the layout itself is just three regions:
 *
 *   ┌──────────┬──────────────────────────────────────────────┐
 *   │          │  Header (toggle / breadcrumb / switchers)    │
 *   │  Sider   ├──────────────────────────────────────────────┤
 *   │          │  Tabs strip                                  │
 *   │          ├──────────────────────────────────────────────┤
 *   │          │  Outlet (page content)                       │
 *   └──────────┴──────────────────────────────────────────────┘
 *
 * The two bridge components are intentionally placed *outside* the
 * `<Layout />` so a theme/locale swap is a config update on the
 * provider tree rather than a remount of the layout itself.
 *
 * Routing assumption: `BasicLayout` is mounted as the parent of every
 * protected route. The bootstrap layer (task 9.4) wraps it with a guard
 * that redirects unauthenticated users to `/login` before this
 * component renders, so the stores feeding Sider / Tabs / Header are
 * already populated when we reach this far.
 */

import { Layout } from 'antd';
import { Outlet } from 'react-router-dom';

import { Header } from './Header.js';
import { LocaleBridge } from './LocaleBridge.js';
import { Sider } from './Sider.js';
import { Tabs } from './Tabs.js';
import { ThemeBridge } from './ThemeBridge.js';

const { Content } = Layout;

export function BasicLayout(): JSX.Element {
  return (
    <ThemeBridge>
      <LocaleBridge>
        <Layout style={{ minHeight: '100vh' }}>
          <Sider />
          <Layout>
            <Header />
            <Tabs />
            <Content style={{ padding: 16, overflow: 'auto' }}>
              <Outlet />
            </Content>
          </Layout>
        </Layout>
      </LocaleBridge>
    </ThemeBridge>
  );
}
