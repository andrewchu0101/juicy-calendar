import type { Language } from './detectLanguage';

const en = {
  'welcome.tagline': 'Arrange your time. Your data stays in a folder you own.',
  'welcome.create': 'Create workspace',
  'welcome.open': 'Open workspace',
  'language.label': 'Language',
  'language.saveFailed': 'The language setting could not be saved.',
  'toolbar.previous': 'Previous period',
  'toolbar.next': 'Next period',
  'toolbar.today': 'Today',
  'toolbar.timelineStart': 'Timeline start',
  'toolbar.timelineEnd': 'Timeline end',
  'toolbar.magnet': '30 min magnet',
  'toolbar.magnetAria': '30 minute magnet',
  'toolbar.zoom': 'Zoom',
  'toolbar.view': 'View',
  'toolbar.viewWeek': 'week',
  'toolbar.viewDay': 'day',
  'grid.openDay': 'Open {weekday}',
  'grid.hiddenOne': '1 event outside the visible hours',
  'grid.hiddenMany': '{count} events outside the visible hours',
  'event.nameAria': 'Event name',
};

export type Dictionary = typeof en;
export type TranslationKey = keyof Dictionary;

const zhTW: Dictionary = {
  'welcome.tagline': '安排你的時間。資料留在你自己的資料夾。',
  'welcome.create': '建立工作區',
  'welcome.open': '開啟工作區',
  'language.label': '語言',
  'language.saveFailed': '無法儲存語言設定。',
  'toolbar.previous': '上一個期間',
  'toolbar.next': '下一個期間',
  'toolbar.today': '今天',
  'toolbar.timelineStart': '時間軸起點',
  'toolbar.timelineEnd': '時間軸終點',
  'toolbar.magnet': '30 分鐘吸附',
  'toolbar.magnetAria': '30 分鐘吸附',
  'toolbar.zoom': '縮放',
  'toolbar.view': '檢視',
  'toolbar.viewWeek': '週',
  'toolbar.viewDay': '日',
  'grid.openDay': '開啟{weekday}',
  'grid.hiddenOne': '有 1 個事件在可見時段之外',
  'grid.hiddenMany': '有 {count} 個事件在可見時段之外',
  'event.nameAria': '事件名稱',
};

export const dictionaries: Record<Language, Dictionary> = { en, 'zh-TW': zhTW };
