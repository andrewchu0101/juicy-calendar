import type { Language } from './detectLanguage';

const en = {
  'welcome.tagline': 'Arrange your time. Your data stays in a folder you own.',
  'welcome.create': 'Create workspace',
  'welcome.open': 'Open workspace',
  'language.label': 'Language',
  'language.saveFailed': 'The language setting could not be saved.',
};

export type Dictionary = typeof en;
export type TranslationKey = keyof Dictionary;

const zhTW: Dictionary = {
  'welcome.tagline': '安排你的時間。資料留在你自己的資料夾。',
  'welcome.create': '建立工作區',
  'welcome.open': '開啟工作區',
  'language.label': '語言',
  'language.saveFailed': '無法儲存語言設定。',
};

export const dictionaries: Record<Language, Dictionary> = { en, 'zh-TW': zhTW };
