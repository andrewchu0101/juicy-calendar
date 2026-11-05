import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// 票 023｜SDS UI-03：工具列與歡迎畫面共用同一個語言選單元件，不複製一份。
const read = (path: string) => readFileSync(path, 'utf8');

describe('[TC-11][FR-09,UI-03] the language menu is one shared component', () => {
  const menu = 'src/components/LanguageMenu.tsx';

  it('lives in its own file and names each language in itself', () => {
    const source = read(menu);
    expect(source).toContain('export function LanguageMenu');
    expect(source).toContain('繁體中文');
    expect(source).toContain('English');
  });

  it.each(['src/components/WelcomeScreen.tsx', 'src/features/calendar/components/CalendarToolbar.tsx'])(
    '%s uses it and does not carry its own copy of the options',
    (path) => {
      const source = read(path);
      expect(source).toMatch(/import \{[^}]*\bLanguageMenu\b[^}]*\} from '[^']*LanguageMenu'/);
      expect(source).toContain('<LanguageMenu');
      expect(source).not.toContain('LANGUAGE_OPTIONS');
      expect(source).not.toContain('繁體中文');
    },
  );
});
