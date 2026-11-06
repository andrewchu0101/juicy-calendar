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
  ['notice.dismiss', 'Dismiss', '關閉'],
  ['color.label', 'Colour', '顏色'],
  ['color.swatchAria', 'Colour {color}', '顏色 {color}'],
  ['color.custom', 'Custom colour', '自訂顏色'],
  ['field.name', 'Name', '名稱'],
  ['field.date', 'Date', '日期'],
  ['field.start', 'Start', '開始'],
  ['field.end', 'End', '結束'],
  ['inspector.aria', 'Event details', '事件詳細資料'],
  ['inspector.deletedTemplate', 'Deleted template', '已刪除的模板'],
  ['inspector.collapse', 'Collapse inspector', '收合面板'],
  ['inspector.expand', 'Expand inspector', '展開面板'],
  // 票 021（SRS R-3 修訂）：持續時間拆成小時、分鐘兩欄；原 durationLabel／durationAria 的「（分鐘）」隨之改寫。
  ['inspector.durationLabel', 'Duration · {duration}', '持續時間 · {duration}'],
  ['inspector.durationHoursLabel', 'Hours', '小時'],
  ['inspector.durationHoursAria', 'Duration hours', '持續時間：小時'],
  ['inspector.durationMinutesLabel', 'Minutes', '分鐘'],
  ['inspector.durationMinutesAria', 'Duration minutes', '持續時間：分鐘'],
  // 票 026c 追加：多選時的浮動列（FR-14）。
  ['selection.count', '{count} selected', '已選 {count} 個事件'],
  ['selection.deleteAria', 'Delete {count} selected events', '刪除選取的 {count} 個事件'],
  ['inspector.delete', 'Delete event', '刪除事件'],
  ['template.nameAria', 'Template name', '模板名稱'],
  ['template.durationLabel', 'Default duration (minutes)', '預設時長（分鐘）'],
  ['template.durationAria', 'Default duration', '預設時長'],
  ['template.durationHint', 'Saved for later. New blocks always start at 2 hours.', '先存起來備用。新區塊一律從 2 小時開始。'],
  ['action.save', 'Save', '儲存'],
  ['action.cancel', 'Cancel', '取消'],
  ['action.confirm', 'Confirm', '確認'],
  ['action.delete', 'Delete', '刪除'],
  ['palette.dragAria', 'Drag {name} onto the calendar', '將 {name} 拖到日曆上'],
  ['palette.editTitle', 'Edit {name}', '編輯 {name}'],
  ['palette.add', 'Add template', '新增模板'],
  ['palette.switch', 'Switch', '切換'],
  ['radial.aria', 'Hold and drag a ball onto the calendar', '按住球並拖到日曆上'],
  ['error.noWorkspaceOpen', 'No workspace is open', '目前沒有開啟的工作區。'],
  ['error.pathNotAllowed', 'Path is not allowed', '不允許這個路徑。'],
  ['error.ioError', 'The file operation failed.', '檔案操作失敗。'],
];

describe('calendar and toolbar texts (TC-11, FR-09, ticket 011)', () => {
  it.each(calendarTexts)('%s → en "%s", zh-TW "%s"', (key, en, zh) => {
    expect(translate('en', key)).toBe(en);
    expect(translate('zh-TW', key)).toBe(zh);
  });

  it('a name with replacement-pattern characters is inserted verbatim', () => {
    expect(translate('en', 'palette.editTitle', { name: "A$&B$1'" })).toBe("Edit A$&B$1'");
    expect(translate('zh-TW', 'palette.dragAria', { name: '寫 $& PRD' })).toBe('將 寫 $& PRD 拖到日曆上');
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
