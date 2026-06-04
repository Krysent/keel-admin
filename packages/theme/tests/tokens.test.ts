/**
 * Smoke tests for the iOS-style theme tokens & overrides.
 *
 * Task 7 is example-based (not flagged [PBT]) — these checks pin the
 * Requirement 9.x floors:
 *   - 9.2 colors / radii / font stack
 *   - 9.4 soft shadow signature
 *   - 9.5 dark surfaces + dark algorithm
 *   - 9.3 global CSS fragment carries the blur / scrollbar rules
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
 */
import { theme as antdTheme } from 'antd';
import { describe, expect, it } from 'vitest';

import {
  tokens,
  darkTokens,
  componentOverrides,
  themeConfig,
  darkThemeConfig,
  globalStyles,
} from '../src/index.ts';

describe('tokens (light)', () => {
  it('uses the iOS system blue as the primary color', () => {
    expect(tokens.colorPrimary).toBe('#0A84FF');
  });

  it('uses the iOS system grouped-background as the layout base', () => {
    expect(tokens.colorBgBase).toBe('#F2F2F7');
    expect(tokens.colorBgLayout).toBe('#F2F2F7');
  });

  it('clears the AntD default radii to the iOS scale', () => {
    expect(tokens.borderRadius).toBe(12);
    expect(tokens.borderRadiusLG).toBe(16);
    expect(tokens.borderRadiusXS).toBe(8);
  });

  it('declares the SF / PingFang SC / Inter font stack', () => {
    const ff = tokens.fontFamily ?? '';
    expect(ff).toMatch(/SF Pro/);
    expect(ff).toMatch(/PingFang SC/);
    expect(ff).toMatch(/Inter/);
  });

  it('uses a soft layered shadow rather than AntD default border', () => {
    // Requirement 9.4 — both stops use the navy-tinted rgba(15,23,42,...).
    expect(tokens.boxShadow).toContain('rgba(15,23,42');
  });
});

describe('darkTokens', () => {
  it('flips the surfaces to iOS dark mode while keeping the accent palette', () => {
    expect(darkTokens.colorBgBase).toBe('#000000');
    expect(darkTokens.colorBgContainer).toBe('#1C1C1E');
    expect(darkTokens.colorTextBase).toBe('#F2F2F7');
    // Accent stays — brand identity is preserved across modes.
    expect(darkTokens.colorPrimary).toBe(tokens.colorPrimary);
  });
});

describe('componentOverrides', () => {
  it('covers all components called out in task 7', () => {
    // Task 7 second bullet — Button / Card / Modal / Table / Input / Menu / Tabs / Tag / Tooltip.
    for (const key of [
      'Button',
      'Card',
      'Modal',
      'Table',
      'Input',
      'Menu',
      'Tabs',
      'Tag',
      'Tooltip',
    ] as const) {
      expect(componentOverrides[key]).toBeDefined();
    }
  });

  it('keeps Button radius on the iOS floor (≥ 12)', () => {
    expect(componentOverrides.Button?.borderRadius).toBe(12);
  });

  it('lifts Modal radius to the iOS sheet floor (≥ 20)', () => {
    expect(componentOverrides.Modal?.borderRadiusLG).toBe(20);
  });
});

describe('themeConfig', () => {
  it('binds the light tokens and shared component overrides', () => {
    expect(themeConfig.token).toBe(tokens);
    expect(themeConfig.components).toBe(componentOverrides);
  });

  it('opts into AntD CSS variables and stable class names', () => {
    // CSS variables are required so runtime swaps do not re-flow styles.
    expect(themeConfig.cssVar).toBe(true);
    // Stable class names so global.css selectors keep matching.
    expect(themeConfig.hashed).toBe(false);
  });
});

describe('darkThemeConfig', () => {
  it('wires AntD darkAlgorithm + darkTokens (Requirement 9.5)', () => {
    expect(darkThemeConfig.algorithm).toBe(antdTheme.darkAlgorithm);
    expect(darkThemeConfig.token).toBe(darkTokens);
  });

  it('reuses the same component overrides as the light config', () => {
    expect(darkThemeConfig.components).toBe(componentOverrides);
  });
});

describe('globalStyles', () => {
  it('declares header / modal-mask blur (Requirement 9.3)', () => {
    expect(globalStyles).toContain('backdrop-filter');
    expect(globalStyles).toContain('.ant-layout-header');
    expect(globalStyles).toContain('.ant-modal-mask');
  });

  it('ships an iOS-flavoured webkit scrollbar', () => {
    expect(globalStyles).toContain('webkit-scrollbar');
  });

  it('carries the soft card shadow signature (matches tokens)', () => {
    // Same navy tint as `tokens.boxShadow` — Requirement 9.4.
    expect(globalStyles).toContain('rgba(15, 23, 42, 0.04)');
  });
});
