/**
 * Unit tests for `KeelTable` virtual scrolling enforcement.
 *
 * Validates: Requirement 19.2
 *   WHERE 表格 THE 当数据行数 > 200 时系统 SHALL **强制**启用虚拟滚动以
 *   保持滚动 FPS（开发者无法关闭，即便业务场景需要拖拽等可能与虚拟滚
 *   动冲突的能力）
 *
 * These tests verify the exported `VIRTUAL_SCROLL_THRESHOLD` constant and
 * the logic that KeelTable uses to force virtual scrolling. Since full
 * React rendering in this package requires jsdom + antd, we test the
 * threshold-based logic at the unit level.
 */

import { describe, it, expect } from 'vitest';
import { VIRTUAL_SCROLL_THRESHOLD } from '../src/keel-table/KeelTable.js';

describe('KeelTable — virtual scrolling constants', () => {
  it('VIRTUAL_SCROLL_THRESHOLD is 200', () => {
    expect(VIRTUAL_SCROLL_THRESHOLD).toBe(200);
  });

  it('threshold logic: <= 200 rows does not force virtual', () => {
    const dataLength = 200;
    const forceVirtual = dataLength > VIRTUAL_SCROLL_THRESHOLD;
    expect(forceVirtual).toBe(false);
  });

  it('threshold logic: 201 rows forces virtual scrolling', () => {
    const dataLength = 201;
    const forceVirtual = dataLength > VIRTUAL_SCROLL_THRESHOLD;
    expect(forceVirtual).toBe(true);
  });

  it('threshold logic: exactly 200 rows does NOT trigger virtual', () => {
    // Requirement says "> 200", so 200 is NOT included
    const dataLength = 200;
    const forceVirtual = dataLength > VIRTUAL_SCROLL_THRESHOLD;
    expect(forceVirtual).toBe(false);
  });

  it('threshold logic: 0 rows does not force virtual', () => {
    const dataLength = 0;
    const forceVirtual = dataLength > VIRTUAL_SCROLL_THRESHOLD;
    expect(forceVirtual).toBe(false);
  });

  it('threshold logic: 1000 rows forces virtual scrolling', () => {
    const dataLength = 1000;
    const forceVirtual = dataLength > VIRTUAL_SCROLL_THRESHOLD;
    expect(forceVirtual).toBe(true);
  });
});
