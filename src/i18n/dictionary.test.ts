import { describe, expect, it } from 'vitest';
import { dictionaries, type Dictionary, type TranslationKey } from './dictionary';
import { translate } from './i18n';

// TC-11｜FR-09、票 011：日曆與工具列的固定文字。英文 = 票 011 之前畫面上的文字（e2e 依賴其中數項）；
// 中文為提案翻譯，待專案擁有者審閱。預期值直接寫字面文字，不從字典讀取。
const calendarTexts: ReadonlyArray<readonly [TranslationKey, string, string]> = [
  ['toolbar.previous', 'Previous period', '上一個期間'],
  ['toolbar.next', 'Next period', '下一個期間'],
  ['toolbar.today', 'Today', '今天'],
  ['toolbar.timelineStart', 'Timeline start', '時間軸起點'],
  ['toolbar.timelineEnd', 'Timeline end', '時間軸終點'],
  ['toolbar.magnet', '30 min magnet', '30 分鐘吸附'],
  ['toolbar.magnetAria', '30 minute magnet', '30 分鐘吸附'],
  ['toolbar.zoom', 'Zoom', '縮放'],
  ['toolbar.view', 'View', '檢視'],
  ['toolbar.viewWeek', 'week', '週'],
  ['toolbar.viewDay', 'day', '日'],
  ['grid.openDay', 'Open {weekday}', '開啟{weekday}'],
  ['grid.hiddenOne', '1 event outside the visible hours', '有 1 個事件在可見時段之外'],
  ['grid.hiddenMany', '{count} events outside the visible hours', '有 {count} 個事件在可見時段之外'],
  ['event.nameAria', 'Event name', '事件名稱'],
];

describe('calendar and toolbar texts (TC-11, FR-09, ticket 011)', () => {
  it.each(calendarTexts)('%s → en "%s", zh-TW "%s"', (key, en, zh) => {
    expect(translate('en', key)).toBe(en);
    expect(translate('zh-TW', key)).toBe(zh);
  });

  it('parameters are filled in both languages', () => {
    expect(translate('en', 'grid.openDay', { weekday: 'Monday' })).toBe('Open Monday');
    expect(translate('zh-TW', 'grid.openDay', { weekday: '星期一' })).toBe('開啟星期一');
    expect(translate('en', 'grid.hiddenMany', { count: 3 })).toBe('3 events outside the visible hours');
    expect(translate('zh-TW', 'grid.hiddenMany', { count: 3 })).toBe('有 3 個事件在可見時段之外');
  });
});

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
