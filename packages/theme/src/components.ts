/**
 * Component-level overrides for the iOS-style theme.
 *
 * design.md → "类 iOS 主题" enumerates the AntD 5 component tokens we tweak
 * to land the visual spec without writing CSS. The same overrides are
 * shared between the light and dark `ThemeConfig` (only the algorithm and
 * base surface tokens differ in dark mode), so we export a single object.
 *
 * Component coverage (Task 7 — second bullet):
 *   Button / Card / Modal / Table / Input / Menu / Tabs / Tag / Tooltip
 */
import type { ThemeConfig } from 'antd';

export const componentOverrides: NonNullable<ThemeConfig['components']> = {
  Button: {
    borderRadius: 12,
    controlHeight: 36,
    controlHeightLG: 44,
    // iOS buttons are flat — kill AntD's default drop shadows.
    defaultShadow: 'none',
    primaryShadow: 'none',
    fontWeight: 500,
  },
  Card: {
    borderRadiusLG: 16,
    paddingLG: 20,
    headerFontSize: 16,
  },
  Modal: {
    // 20px corners match iOS sheet presentations.
    borderRadiusLG: 20,
    paddingContentHorizontalLG: 24,
  },
  Table: {
    borderRadius: 12,
    cellPaddingBlock: 14,
    headerBg: 'rgba(60,60,67,0.04)',
    headerColor: 'rgba(60,60,67,0.6)',
    // Drop the default header divider so the soft surface reads through.
    headerSplitColor: 'transparent',
  },
  Input: {
    borderRadius: 12,
    controlHeight: 36,
    // Soft focus halo using the iOS system blue at 12% alpha.
    activeShadow: '0 0 0 4px rgba(10,132,255,0.12)',
  },
  Menu: {
    itemBorderRadius: 10,
    itemSelectedBg: 'rgba(10,132,255,0.10)',
    itemSelectedColor: '#0A84FF',
    itemHoverBg: 'rgba(60,60,67,0.06)',
  },
  Tabs: {
    itemSelectedColor: '#0A84FF',
    inkBarColor: '#0A84FF',
  },
  Tag: {
    borderRadiusSM: 8,
  },
  Tooltip: {
    borderRadius: 10,
  },
};
