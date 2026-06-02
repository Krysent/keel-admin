/**
 * Breadcrumb — derived from the current pathname's ancestor chain.
 *
 * Implements Requirement 7.6's "switch route → update breadcrumb" and
 * Requirement 7.4's "switch language → update breadcrumb labels". Both
 * happen automatically: the chain is recomputed on `pathname` changes
 * and the leaf labels are translated at render time, so a
 * `changeLanguage` re-render swaps the strings without invalidating
 * the data.
 */

import { useMemo } from 'react';
import { Breadcrumb as AntBreadcrumb } from 'antd';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useUserStore } from '../stores/user.store.js';
import { findMenuPath } from './lib/menu-tree.js';

export function Breadcrumb(): JSX.Element | null {
  const menus = useUserStore((s) => s.menus);
  const { pathname } = useLocation();
  const { t } = useTranslation();

  // `findMenuPath` returns the full chain (root → leaf). When the
  // pathname doesn't match anything in the menu (e.g. an exception
  // page) we render nothing — the caller can decide on a fallback.
  const chain = useMemo(
    () => findMenuPath(menus, pathname),
    [menus, pathname],
  );
  if (!chain || chain.length === 0) return null;

  const items = chain.map((node, idx) => {
    const isLast = idx === chain.length - 1;
    const label = t(node.title, { defaultValue: node.title });
    // Branch nodes (those with children) are not necessarily routable
    // by themselves — many backends use them as headers. Make only
    // the leaf clickable to keep the affordance honest.
    return {
      title: !isLast && node.path ? <Link to={node.path}>{label}</Link> : label,
    };
  });

  return <AntBreadcrumb items={items} />;
}
