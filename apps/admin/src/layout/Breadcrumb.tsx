/**
 * Breadcrumb — derived from the current pathname's ancestor chain.
 *
 * Implements Requirement 7.6's "switch route → update breadcrumb" and
 * Requirement 7.4's "switch language → update breadcrumb labels". Both
 * happen automatically: the chain is recomputed on `pathname` changes
 * and the leaf labels are translated at render time, so a
 * `changeLanguage` re-render swaps the strings without invalidating
 * the data.
 *
 * Requirement 22.4:
 *   - When the route IS found in the menu tree: prepend a "首页/Home"
 *     root item (always a link to `/`) before the ancestor chain,
 *     producing: "首页 / 一级菜单 / 二级菜单".
 *   - When the route is NOT found in the menu tree: render only the
 *     "首页/Home" node (instead of null).
 */

import { Breadcrumb as AntBreadcrumb } from 'antd';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';

import { useUserStore } from '../stores/user.store';

import { findMenuPath } from './lib/menu-tree';

export function Breadcrumb(): JSX.Element {
  const menus = useUserStore((s) => s.menus);
  const { pathname } = useLocation();
  const { t, i18n } = useTranslation();

  /** True when the active language is Chinese (zh-CN or any zh-* variant). */
  const isZhCN = i18n.language === 'zh-CN' || i18n.language?.startsWith('zh');

  // `findMenuPath` returns the full chain (root → leaf). When the
  // pathname doesn't match anything in the menu (e.g. an exception
  // page) `chain` is null — in that case we fall back to showing only
  // the home node (Requirement 22.4).
  const chain = useMemo(() => findMenuPath(menus, pathname), [menus, pathname]);

  const homeLabel = t('breadcrumb.home', {
    defaultValue: isZhCN ? '首页' : 'Home',
  });

  // The home item is always first and always a link to `/`.
  const homeItem = {
    title: <Link to="/">{homeLabel}</Link>,
  };

  if (!chain || chain.length === 0) {
    // Route not in menu tree — show only the home node.
    return <AntBreadcrumb className="keel-breadcrumb" items={[homeItem]} />;
  }

  const menuItems = chain.map((node, idx) => {
    const isLast = idx === chain.length - 1;
    const label = t(node.title, { defaultValue: node.title });
    // Branch nodes (those with children) are not necessarily routable
    // by themselves — many backends use them as headers. Make only
    // the leaf clickable to keep the affordance honest.
    return {
      title: !isLast && node.path ? <Link to={node.path}>{label}</Link> : label,
    };
  });

  return <AntBreadcrumb className="keel-breadcrumb" items={[homeItem, ...menuItems]} />;
}
