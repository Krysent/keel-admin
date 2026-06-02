/**
 * `LoadingPlaceholder` — full-page loading indicator used as the
 * `<Suspense fallback>` for lazy-loaded route components.
 *
 * Renders a centered AntD `Spin` inside a fixed-height container so the
 * layout shell doesn't collapse while page chunks are being fetched.
 *
 * Validates: Requirement 19.1
 *   WHERE 路由 THE 系统 SHALL 通过 `React.lazy + import.meta.glob` 实现
 *   页面级懒加载，配合 `<Suspense>` 与 `LoadingPlaceholder`
 */

import React from 'react';
import { Spin } from 'antd';

export interface LoadingPlaceholderProps {
  /** Optional tip text shown below the spinner. */
  tip?: string;
  /** Override height (default fills remaining viewport). */
  height?: string | number;
}

/**
 * A centered spinner placeholder displayed while a lazy route component
 * is being loaded. Designed to sit inside `<Suspense fallback={...}>`.
 */
export const LoadingPlaceholder: React.FC<LoadingPlaceholderProps> = ({
  tip,
  height = '100%',
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height,
        minHeight: 200,
        width: '100%',
      }}
    >
      <Spin size="large" tip={tip} />
    </div>
  );
};

LoadingPlaceholder.displayName = 'LoadingPlaceholder';
