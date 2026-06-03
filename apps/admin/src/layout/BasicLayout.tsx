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
 * Layout scrolling model (Requirement 22.14):
 *   - The outer `<Layout>` is full-viewport-height and does NOT scroll.
 *   - The right column (`<Layout>` inner) fills the remaining height
 *     with `overflow: hidden` so its children control their own
 *     overflow independently.
 *   - `<Content>` sets `overflow: auto` — the content area scrolls
 *     independently and does NOT carry the Sider or Header with it.
 *   - Sider is rendered at the same flex level as the inner Layout
 *     and occupies the full viewport height via `height: 100vh`
 *     with `position: sticky; top: 0` so it stays visible during
 *     content-area scrolling.
 *   - Header uses `position: sticky; top: 0; z-index: 1` so it pins
 *     to the top of the right column's scroll container, remaining
 *     visible when the user scrolls down through long page content.
 *
 * The two bridge components are intentionally placed *outside* the
 * `<Layout />` so a theme/locale swap is a config update on the
 * provider tree rather than a remount of the layout itself.
 *
 * Theme / locale switching (Requirements 22.11, 22.12):
 *   - `ThemeBridge` reads `appStore.theme` and swaps the
 *     `ConfigProvider.theme` prop in the same render cycle — no
 *     `window.location.reload()` is triggered.
 *   - `LocaleBridge` calls `i18next.changeLanguage(locale)` in a
 *     `useEffect` that fires synchronously before the next paint,
 *     causing all `useTranslation()` subscribers (Sider, Breadcrumb,
 *     Tabs, Header) to re-render in the same React update batch.
 *
 * Routing assumption: `BasicLayout` is mounted as the parent of every
 * protected route. The bootstrap layer (task 9.4) wraps it with a guard
 * that redirects unauthenticated users to `/login` before this
 * component renders, so the stores feeding Sider / Tabs / Header are
 * already populated when we reach this far.
 */

import { Layout } from 'antd';
import { Outlet } from 'react-router-dom';

import { Header } from './Header';
import { LocaleBridge } from './LocaleBridge';
import { Sider } from './Sider';
import { Tabs } from './Tabs';
import { ThemeBridge } from './ThemeBridge';

const { Content } = Layout;

export function BasicLayout(): JSX.Element {
  return (
    <ThemeBridge>
      <LocaleBridge>
        {/*
         * Outer wrapper: full viewport height, no overflow — this is
         * the scroll root's parent so nothing overflows at this level.
         * display:flex is implicit in AntD Layout (flex-direction: row).
         */}
        <Layout style={{ height: '100vh', overflow: 'hidden' }}>
          {/*
           * Sider: sticky left column. `position: sticky; top: 0`
           * combined with `height: 100vh` makes it stay in view even
           * when the content area to the right is independently
           * scrolling (Req 22.14).
           */}
          <Sider style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'auto' }} />
          {/*
           * Right column: flex column, fills remaining width.
           * `overflow: hidden` prevents the column itself from
           * becoming a scroll container — that responsibility belongs
           * to `<Content>` below.
           */}
          <Layout style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1 }}>
            {/*
             * Header: sticky top bar. `position: sticky; top: 0`
             * pins the header to the top of the right column,
             * so it stays visible when content scrolls (Req 22.14).
             * z-index: 10 keeps it above page content layers.
             */}
            <Header style={{ position: 'sticky', top: 0, zIndex: 10, flexShrink: 0 }} />
            {/*
             * Tabs strip: sticky below the header. `position: sticky`
             * with `top: 56px` (header height) keeps the tab bar
             * visible during content scroll.
             */}
            <div style={{ position: 'sticky', top: 56, zIndex: 9, flexShrink: 0 }}>
              <Tabs />
            </div>
            {/*
             * Content: the independently-scrolling region.
             * `overflow: auto` means only this box scrolls —
             * Sider and Header remain pinned (Req 22.14).
             * `flex: 1` + `minHeight: 0` is the standard flexbox
             * pattern that lets a flex child shrink below its content
             * height and scroll internally.
             */}
            <Content
              data-testid="basic-layout-content"
              style={{ padding: 16, overflow: 'auto', flex: 1, minHeight: 0 }}
            >
              <Outlet />
            </Content>
          </Layout>
        </Layout>
      </LocaleBridge>
    </ThemeBridge>
  );
}
