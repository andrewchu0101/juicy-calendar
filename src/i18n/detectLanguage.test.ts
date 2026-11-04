import { describe, expect, it } from 'vitest';
import { detectLanguage } from './detectLanguage';

// TC-11｜AC-03.2、FR-09、SRS R-7：預期值取自 docs/06-test-plan.md TC-11 的表格，不呼叫實作推算。
describe('detectLanguage (TC-11, AC-03.2, FR-09)', () => {
  it.each(['zh-TW', 'zh-HK', 'zh-CN', 'zh'])('system locale %s → 繁體中文', (locale) => {
    expect(detectLanguage(locale, [])).toBe('zh-TW');
  });

  it.each(['en-US', 'ja-JP'])('system locale %s → English', (locale) => {
    expect(detectLanguage(locale, [])).toBe('en');
  });

  it('no information at all → English (decided 2026-11-04)', () => {
    expect(detectLanguage(null, [])).toBe('en');
  });

  it('falls back to navigator.languages when the system gives nothing', () => {
    expect(detectLanguage(null, ['zh-TW', 'en-US'])).toBe('zh-TW');
    expect(detectLanguage(null, ['ja-JP', 'en-US'])).toBe('en');
  });

  it('the system locale wins over navigator.languages', () => {
    expect(detectLanguage('en-US', ['zh-TW'])).toBe('en');
  });
});
