# @keel/theme

iOS-style theme for keel-admin. Provides AntD 5 design tokens, component-level overrides, dark mode support, and a global CSS fragment — all designed to replace the default Ant Design look with a clean, low-saturation aesthetic.

## Installation

```bash
pnpm add @keel/theme
# peer dependency
pnpm add antd
```

## Usage

```tsx
import { ConfigProvider } from 'antd';
import { themeConfig } from '@keel/theme';
import '@keel/theme/global.css';

function App() {
  return (
    <ConfigProvider theme={themeConfig}>
      {/* your app */}
    </ConfigProvider>
  );
}
```

### Dark Mode

```tsx
import { darkThemeConfig } from '@keel/theme';

<ConfigProvider theme={darkThemeConfig}>
  {/* dark mode UI */}
</ConfigProvider>
```

Switch at runtime without page reload — AntD 5 uses CSS-in-JS tokens.

## Token Overview

| Token | Value | Description |
|-------|-------|-------------|
| `colorPrimary` | `#0A84FF` | iOS system blue |
| `colorBgBase` | `#F2F2F7` | iOS system background |
| `colorBgContainer` | `#FFFFFF` | Card / container bg |
| `borderRadius` | `12` | Base radius |
| `borderRadiusLG` | `16` | Cards, modals |
| `fontFamily` | SF Pro / PingFang SC / Inter | System font stack |
| `motionEaseInOut` | `cubic-bezier(0.32, 0.72, 0, 1)` | iOS standard easing |

## Exports

| Export | Description |
|--------|-------------|
| `tokens` | Light mode AntD token object |
| `darkTokens` | Dark mode AntD token object |
| `componentOverrides` | Per-component style overrides (Button, Card, Modal, Table, etc.) |
| `themeConfig` | Complete `ThemeConfig` for `<ConfigProvider>` (light) |
| `darkThemeConfig` | Complete `ThemeConfig` for `<ConfigProvider>` (dark) |
| `globalStyles` | CSS string for header/modal blur, card shadows, scrollbars |

## Global CSS (`@keel/theme/global.css`)

Applies:
- Header backdrop blur (frosted glass)
- Modal mask blur
- Soft card shadows (no AntD default borders)
- iOS-style scrollbar
- System font smoothing

## Theming Guide

To override tokens in a downstream app:

```tsx
import { themeConfig } from '@keel/theme';

const customTheme = {
  ...themeConfig,
  token: { ...themeConfig.token, colorPrimary: '#FF6600' },
};
```

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history.
