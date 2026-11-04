import { describe, expect, it } from 'vitest';
import { dictionaries, type Dictionary } from './dictionary';

// TC-11｜FR-09、NFR-07：兩種語言的鍵值完全相同，沒有空字串。
describe('dictionaries (TC-11, FR-09)', () => {
  it('both languages have exactly the same keys', () => {
    expect(Object.keys(dictionaries['zh-TW']).sort()).toEqual(Object.keys(dictionaries.en).sort());
  });

  it('no translation is empty', () => {
    for (const dictionary of Object.values(dictionaries)) {
      for (const [key, text] of Object.entries(dictionary)) expect(text, key).not.toBe('');
    }
  });

  it('a dictionary missing a key fails the type check', () => {
    // @ts-expect-error 缺 'welcome.open'：若這行不再報錯，typecheck 會失敗，代表字典型別沒擋住缺鍵。
    const incomplete: Dictionary = {
      'welcome.tagline': 'x',
      'welcome.create': 'x',
      'language.label': 'x',
    };
    expect(Object.keys(incomplete)).toHaveLength(3);
  });
});
