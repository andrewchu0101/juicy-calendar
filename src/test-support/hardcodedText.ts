/**
 * Test-only. Finds user-visible text written straight into a component (票 012、FR-09、SDS i18n 契約)。
 * 解析 TSX 的語法樹（用專案已有的 `typescript`，不新增套件），回報：
 *  - JSX 文字節點含字母（含中日韓文字）的；
 *  - `{'…'}`、條件運算（`a ? 'x' : 'y'`）、`&&`／`||`／`??` 結果裡的字串字面值；
 *  - 這些屬性的字串字面值或樣板字串：aria-label、aria-description、aria-placeholder、aria-roledescription、
 *    title、placeholder、alt、label。
 * 不檢查 className、data-testid、type、role 等非使用者可見的屬性；純符號（› + →）沒有字母，不算。
 * 產品名稱 `Juicy Calendar` 是允許的。
 */
import ts from 'typescript';

const VISIBLE_ATTRIBUTES = new Set([
  'aria-label',
  'aria-description',
  'aria-placeholder',
  'aria-roledescription',
  'title',
  'placeholder',
  'alt',
  'label',
]);
const ALLOWED_TEXT = new Set(['Juicy Calendar']);
const HAS_LETTER = /[\p{L}]/u;

export type HardcodedText = { line: number; text: string };

/** String literals that can end up on screen as the value of `expr` (through ?:, &&, ||, ??, parentheses). */
function literalsOf(expr: ts.Expression): ts.Node[] {
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr) || ts.isTemplateExpression(expr)) return [expr];
  if (ts.isParenthesizedExpression(expr)) return literalsOf(expr.expression);
  if (ts.isConditionalExpression(expr)) return [...literalsOf(expr.whenTrue), ...literalsOf(expr.whenFalse)];
  if (ts.isBinaryExpression(expr)) {
    const op = expr.operatorToken.kind;
    if (op === ts.SyntaxKind.AmpersandAmpersandToken || op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) {
      return [...literalsOf(expr.left), ...literalsOf(expr.right)];
    }
  }
  return [];
}

/** The fixed text a literal or template contributes (the `${…}` parts are not text). */
function fixedText(node: ts.Node): string {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) return node.head.text + node.templateSpans.map((span) => span.literal.text).join('');
  return '';
}

export function findHardcodedText(source: string, fileName = 'component.tsx'): HardcodedText[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: HardcodedText[] = [];
  const report = (node: ts.Node, raw: string) => {
    const text = raw.replace(/\s+/g, ' ').trim();
    if (!HAS_LETTER.test(text) || ALLOWED_TEXT.has(text)) return;
    found.push({ line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1, text });
  };

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) report(node, node.text);
    if (ts.isJsxExpression(node) && node.expression && !ts.isJsxAttribute(node.parent)) {
      for (const literal of literalsOf(node.expression)) report(literal, fixedText(literal));
    }
    if (ts.isJsxAttribute(node) && VISIBLE_ATTRIBUTES.has(node.name.getText(file)) && node.initializer) {
      const init = node.initializer;
      if (ts.isStringLiteral(init)) report(init, init.text);
      else if (ts.isJsxExpression(init) && init.expression) {
        for (const literal of literalsOf(init.expression)) report(literal, fixedText(literal));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}
