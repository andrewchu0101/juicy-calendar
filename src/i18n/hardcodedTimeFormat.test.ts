import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// TC-12｜FR-10、AGENTS.md 規則 13、票 013 驗收條件 4：程式中不再有寫死的 `HH:mm` 顯示格式，時間顯示一律用 formatTime。
// 解析語法樹找字串字面值（註解不算）。唯一的例外：右側面板兩個 `<input type="time">` 的 `value`——HTML 規定這種欄位的
// value 一律是 24 小時制的 `HH:mm`（資料格式，顯示由瀏覽器決定），專案擁有者 2026-11-04 同意。
const ALLOWED: Record<string, number> = { 'src/features/inspector/Inspector.tsx': 2 };
const TIME_PATTERN = /\b[Hh]{1,2}:mm\b/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(path) && !/\.test\.tsx?$/.test(path) ? [path] : [];
  });
}

function timePatternLiterals(source: string, fileName: string): number {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, fileName.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  let count = 0;
  const visit = (node: ts.Node) => {
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && TIME_PATTERN.test(node.text)) count += 1;
    if (ts.isTemplateExpression(node) && TIME_PATTERN.test(node.head.text + node.templateSpans.map((span) => span.literal.text).join(''))) count += 1;
    ts.forEachChild(node, visit);
  };
  visit(file);
  return count;
}

describe('no hard-coded time display format (TC-12, FR-10)', () => {
  it('the scanner finds a pattern in code but not in a comment', () => {
    expect(timePatternLiterals("const a = format(d, 'HH:mm'); // 'HH:mm' in a comment", 'a.ts')).toBe(1);
    expect(timePatternLiterals('const a = `${x}hh:mm`;', 'a.ts')).toBe(1);
    expect(timePatternLiterals("const a = format(d, 'yyyy-MM-dd');", 'a.ts')).toBe(0);
  });

  it('src has none outside the allowed <input type="time"> values', () => {
    const root = join(process.cwd(), 'src');
    const found: Record<string, number> = {};
    for (const file of sourceFiles(root)) {
      const count = timePatternLiterals(readFileSync(file, 'utf8'), file);
      if (count > 0) found[relative(process.cwd(), file).replaceAll('\\', '/')] = count;
    }
    expect(found).toEqual(ALLOWED);
  });
});
