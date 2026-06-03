/**
 * iOS-style design tokens for AntD 5.
 *
 * The values are sourced from design.md → "类 iOS 主题（抛弃 AntD 默认风格）"
 * and are kept verbatim so the visual spec stays single-sourced.
 *
 * Requirement 9.2 fixes the hard floors:
 *   - primary color  `#0A84FF`
 *   - layout base    `#F2F2F7`
 *   - input/button   borderRadius   ≥ 12
 *   - card/modal     borderRadiusLG ≥ 16 / 20
 *   - font stack     SF Pro / PingFang SC / Inter
 *
 * `darkTokens` re-uses the same accent palette and only overrides surface
 * colors, mirroring iOS dark mode (Requirement 9.5). The dark algorithm
 * itself lives in `theme-config.ts`.
 */
import type { ThemeConfig } from 'antd';

export const tokens: NonNullable<ThemeConfig['token']> = {
  // --- Accents (Requirement 9.2) ---
  colorPrimary: '#0A84FF',
  colorSuccess: '#34C759',
  colorWarning: '#FF9F0A',
  colorError: '#FF3B30',
  colorInfo: '#5AC8FA',

  // --- Surfaces (light) ---
  colorBgBase: '#F2F2F7',
  colorBgContainer: '#FFFFFF',
  // Translucent elevated surface so `backdrop-filter` blur reads through.
  colorBgElevated: 'rgba(255,255,255)',
  colorBgLayout: '#F2F2F7',
  colorBorderSecondary: 'rgba(60,60,67,0.10)',
  colorTextBase: '#1C1C1E',
  colorTextSecondary: 'rgba(60,60,67,0.6)',

  // --- Radii (Requirement 9.2) ---
  borderRadius: 12,
  borderRadiusLG: 16,
  borderRadiusXS: 8,

  // --- Shadows (Requirement 9.4: 轻投影 + 弱外阴影) ---
  boxShadow:
    '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.04)',
  boxShadowSecondary: '0 1px 1px rgba(15,23,42,0.04)',

  // --- Typography (Requirement 9.2: SF Pro / PingFang SC / Inter) ---
  fontFamily:
    '-apple-system, "SF Pro Text", "SF Pro Display", "PingFang SC", Inter, system-ui, sans-serif',
  fontSize: 14,

  // --- Motion (iOS standard cubic) ---
  motionDurationMid: '0.3s',
  motionEaseInOut: 'cubic-bezier(0.32, 0.72, 0, 1)',
};

/**
 * Dark-mode override map.
 *
 * Only surface colors flip — accents (`colorPrimary` etc.) stay identical
 * so brand identity is preserved across modes. The dark algorithm in
 * `theme-config.ts` will derive any tokens we don't list here.
 */
export const darkTokens: NonNullable<ThemeConfig['token']> = {
  ...tokens,

  // iOS dark surfaces.
  colorBgBase: '#000000',
  colorBgContainer: '#1C1C1E',
  colorBgElevated: 'rgba(28,28,30)',
  colorBgLayout: '#000000',
  colorBorderSecondary: 'rgba(84,84,88,0.65)',
  colorTextBase: '#F2F2F7',
  colorTextSecondary: 'rgba(235,235,245,0.6)',
};
