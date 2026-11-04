/**
 * Test-only (票 018、NFR-03). Parses a TypeScript/TSX source file (with the `typescript` package the project
 * already has) and reports places that can reach the network. Static and shallow by design; see the
 * limits listed in src/offline/offline.test.ts.
 */
import ts from 'typescript';

export type NetworkCall = { line: number; what: string };

// Browser APIs that open a connection. `Worker` and `import()` of local files do not, so they are not here.
const NETWORK_FUNCTIONS = new Set(['fetch']);
const NETWORK_CONSTRUCTORS = new Set(['XMLHttpRequest', 'WebSocket', 'EventSource']);
const BEACON = 'sendBeacon';
// `window.fetch(…)`, `globalThis.fetch(…)`, `self.fetch(…)`, `navigator.sendBeacon(…)`.
const GLOBAL_OBJECTS = new Set(['window', 'globalThis', 'self', 'navigator']);

// An address that can open a connection. `[/]` instead of an escaped slash keeps the pattern readable.
const URL_SCHEME = /(?:https?|wss?|ftp):[/][/]([^/\s'"`?#:]*)[^\s'"`]*/;
// Hosts that are not a connection: XML namespaces in SVG/XHTML, and this machine.
const NOT_A_CONNECTION_HOSTS = new Set(['www.w3.org', 'localhost', 'ipc.localhost', '127.0.0.1']);

export function findNetworkCalls(source: string, fileName = 'file.ts'): NetworkCall[] {
  const kind = fileName.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind);
  const found: NetworkCall[] = [];
  // Arguments of a call that was already reported: their address would be the same finding twice.
  const covered = new Set<ts.Node>();
  const report = (node: ts.Node, what: string) =>
    found.push({ line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1, what });
  const reportCall = (node: ts.CallExpression | ts.NewExpression, what: string) => {
    report(node, what);
    node.arguments?.forEach((argument) => covered.add(argument));
  };

  /** The name being called: `fetch`, or the property of `window.fetch` / `navigator.sendBeacon`. */
  const calledName = (expr: ts.Expression): string | undefined => {
    if (ts.isIdentifier(expr)) return expr.text;
    if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression) && GLOBAL_OBJECTS.has(expr.expression.text)) {
      return expr.name.text;
    }
    return undefined;
  };

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const target = node.arguments[0];
        if (target && (ts.isStringLiteral(target) || ts.isNoSubstitutionTemplateLiteral(target))) {
          // A local file (code splitting) is not the network; a URL is.
          if (target.text.includes('://') || target.text.startsWith('//')) reportCall(node, 'import(url)');
        } else {
          reportCall(node, 'import(dynamic)'); // cannot be judged statically, so report it
        }
      } else {
        const name = calledName(node.expression);
        if (name !== undefined && (NETWORK_FUNCTIONS.has(name) || name === BEACON)) reportCall(node, name);
      }
    }
    if (!covered.has(node) && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node))) {
      // A template's fixed text is its head; the `${…}` parts are not addresses.
      const match = URL_SCHEME.exec(node.text);
      if (match && !NOT_A_CONNECTION_HOSTS.has((match[1] ?? '').toLowerCase())) report(node, `url ${match[0]}`);
    }
    if (ts.isNewExpression(node)) {
      const name = calledName(node.expression);
      if (name !== undefined && NETWORK_CONSTRUCTORS.has(name)) reportCall(node, name);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

// In markup and stylesheets an address ends at a quote, a bracket, a query or a fragment.
const MARKUP_URL = /(?:https?|wss?|ftp):[/][/]([^/\s'"`?#:()<>]*)[^\s'"`?#()<>]*/g;

/** External addresses in HTML or CSS text (a script/link/img/@import pointing off this machine). */
export function findExternalReferences(text: string): NetworkCall[] {
  const found: NetworkCall[] = [];
  // Split on LF only: a CR left at the end of a line does not matter for finding addresses.
  text.split(String.fromCharCode(10)).forEach((lineText, index) => {
    for (const match of lineText.matchAll(MARKUP_URL)) {
      if (!NOT_A_CONNECTION_HOSTS.has((match[1] ?? '').toLowerCase())) found.push({ line: index + 1, what: `url ${match[0]}` });
    }
  });
  return found;
}
