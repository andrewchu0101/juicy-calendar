// Generates THIRD-PARTY-LICENSES.md: the copyright notices and license texts of the third-party software that ends up
// in the distributed program (D-10, 2026-11-13). MIT, BSD and Apache-2.0 all require these to travel with the binary.
//
// Scope: npm packages that are NOT dev-only (they are bundled into the frontend) plus the Rust crates that are linked into
// the Windows executable (normal dependencies only; build scripts and dev tools are not shipped). Run from the project
// root: `npm run licenses`. Needs `npm install` done and `cargo` on PATH (see issues/README.md, shared rule 6).
// The output is deterministic and records the SHA-256 of both lock files, so a test can tell when it has gone stale.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

export const OUTPUT_FILE = 'THIRD-PARTY-LICENSES.md';
const LF = String.fromCharCode(10);

/** Collapses whitespace so two copies of the same text that differ only in layout count as one. */
export function normalizeText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

const stripEmail = (author) => author.replace(/\s*<[^>]*>/g, '').trim();

const MIT_BODY = [
  'Permission is hereby granted, free of charge, to any person obtaining a copy',
  'of this software and associated documentation files (the "Software"), to deal',
  'in the Software without restriction, including without limitation the rights',
  'to use, copy, modify, merge, publish, distribute, sublicense, and/or sell',
  'copies of the Software, and to permit persons to whom the Software is',
  'furnished to do so, subject to the following conditions:',
  '',
  'The above copyright notice and this permission notice shall be included in all',
  'copies or substantial portions of the Software.',
  '',
  'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR',
  'IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,',
  'FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE',
  'AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER',
  'LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,',
  'OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE',
  'SOFTWARE.',
].join(LF);

const BSD3_BODY = [
  'Redistribution and use in source and binary forms, with or without',
  'modification, are permitted provided that the following conditions are met:',
  '',
  '1. Redistributions of source code must retain the above copyright notice, this',
  '   list of conditions and the following disclaimer.',
  '',
  '2. Redistributions in binary form must reproduce the above copyright notice,',
  '   this list of conditions and the following disclaimer in the documentation',
  '   and/or other materials provided with the distribution.',
  '',
  '3. Neither the name of the copyright holder nor the names of its',
  '   contributors may be used to endorse or promote products derived from',
  '   this software without specific prior written permission.',
  '',
  'THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"',
  'AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE',
  'IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE',
  'DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE',
  'FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL',
  'DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR',
  'SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER',
  'CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,',
  'OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE',
  'OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.',
].join(LF);

/**
 * Attaches license texts to packages. `readLicenseTexts(dir)` returns the contents of the license files found in a
 * package directory. A package that ships none gets a stand-in (flagged `synthesized`), tried in this order:
 *   1. the license file of another package from the same repository (a project shares one LICENSE);
 *   2. a supplement registered for its repository URL (`supplements`, copied unchanged from the upstream repository);
 *   3. for MPL-2.0, the text another MPL-2.0 package ships;
 *   4. the standard MIT or BSD-3 text with the copyright holder taken from its manifest authors.
 * Anything else throws: a missing license must stop the release, never disappear quietly.
 */
export function buildEntries(packages, { readLicenseTexts, supplements = {} }) {
  const withFiles = packages.map((p) => ({ ...p, files: readLicenseTexts(p.dir) }));
  const donors = new Map();
  const repoDonors = new Map();
  for (const p of withFiles) {
    if (p.files.length === 0) continue;
    if (!donors.has(p.license)) donors.set(p.license, p.files);
    if (p.repository && !repoDonors.has(p.repository)) repoDonors.set(p.repository, p.files);
  }

  return withFiles.map(({ files, ...p }) => {
    if (files.length > 0) return { ...p, texts: files, synthesized: false };
    if (p.repository && repoDonors.has(p.repository)) return { ...p, texts: repoDonors.get(p.repository), synthesized: true };
    if (p.repository && supplements[p.repository]) return { ...p, texts: [supplements[p.repository]], synthesized: true };
    const holder = (p.authors ?? []).map(stripEmail).filter(Boolean).join(', ');
    if (p.license === 'MIT' && holder) return { ...p, texts: [['MIT License', '', `Copyright (c) ${holder}`, '', MIT_BODY].join(LF)], synthesized: true };
    if (p.license === 'BSD-3-Clause' && holder) {
      return { ...p, texts: [[`Copyright (c) ${holder}`, 'All rights reserved.', '', BSD3_BODY].join(LF)], synthesized: true };
    }
    if (p.license === 'MPL-2.0' && donors.has('MPL-2.0')) return { ...p, texts: donors.get('MPL-2.0'), synthesized: true };
    throw new Error(`no license text for ${p.name}@${p.version} (${p.license}): it ships no license file and no stand-in applies.`);
  });
}

const idOf = (p) => `${p.name}@${p.version}`;
const byId = (a, b) => (idOf(a) < idOf(b) ? -1 : idOf(a) > idOf(b) ? 1 : 0);

/** Groups identical license texts; each group lists the packages that use it (sorted). */
export function groupTexts(entries) {
  const groups = new Map();
  for (const entry of [...entries].sort(byId)) {
    for (const text of entry.texts) {
      const key = normalizeText(text);
      if (!groups.has(key)) groups.set(key, { text, packages: new Set() });
      groups.get(key).packages.add(idOf(entry));
    }
  }
  return [...groups.values()]
    .map((g) => ({ text: g.text, packages: [...g.packages].sort() }))
    .sort((a, b) => (a.packages[0] < b.packages[0] ? -1 : a.packages[0] > b.packages[0] ? 1 : 0));
}

export function renderMarkdown({ entries, hashes, scope }) {
  const sorted = [...entries].sort(byId);
  const mpl = sorted.filter((e) => /MPL-2\.0/.test(e.license));
  const lines = [
    '# Third-party licenses',
    '',
    'Juicy Calendar is licensed under the MIT License (see `LICENSE`). The distributed program also contains the third-party',
    'software listed below, each under its own license. This file reproduces their copyright notices and license texts, as',
    'those licenses require.',
    '',
    `Scope: ${scope}`,
    '',
    'Generated by `scripts/third-party-licenses.mjs` (`npm run licenses`). Do not edit by hand; regenerate after any dependency',
    'change. The lock files this list was generated from:',
    '',
    ...Object.entries(hashes).map(([file, hash]) => `- ${file} SHA-256: ${hash}`),
    '',
  ];
  if (mpl.length > 0) {
    lines.push(
      '## Notice for MPL-2.0 components',
      '',
      `${mpl.map(idOf).join(', ')} are licensed under the Mozilla Public License 2.0 and are used unmodified. Their source code is available from https://crates.io/crates/<name>/<version> for each package named here.`,
      '',
    );
  }
  lines.push(`## Packages (${sorted.length})`, '', '| Package | Version | License | Source |', '| --- | --- | --- | --- |');
  for (const e of sorted) lines.push(`| ${e.name}${e.synthesized ? ' †' : ''} | ${e.version} | ${e.license} | ${e.repository ?? ''} |`);
  if (sorted.some((e) => e.synthesized)) {
    lines.push(
      '',
      "† The package does not ship its own license text inside the published package. The text below comes from another package of the same repository, from the upstream repository's license file (copied unchanged), or, failing that, is the standard text for its license (with the copyright holder taken from the package's manifest; for MPL-2.0, the text another package ships).",
    );
  }
  lines.push('', '## License texts', '');
  groupTexts(sorted).forEach((group, index) => {
    // Tabs become four spaces: the project's pre-commit check (AGENTS.md rule 16) rejects control characters in documents.
    lines.push(`### ${index + 1}. Used by: ${group.packages.join(', ')}`, '', '````text', group.text.trim().replace(/\r\n?/g, '\n').replace(/\t/g, '    '), '````', '');
  });
  return lines.join(LF);
}

/** npm packages that are not dev-only. `lock` is a parsed package-lock.json. */
export function npmProductionPackages(lock) {
  return Object.entries(lock.packages)
    .filter(([path, info]) => path !== '' && !info.dev && !info.devOptional)
    .map(([path, info]) => ({ name: path.split('node_modules/').pop(), version: info.version, path }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

const LICENSE_FILE = /^(licen[sc]e|copying|unlicense|notice|copyright)/i;

function readLicenseTexts(dir) {
  return readdirSync(dir)
    .filter((f) => LICENSE_FILE.test(f) && statSync(join(dir, f)).isFile())
    .sort()
    .map((f) => readFileSync(join(dir, f), 'utf-8'));
}

const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

const cleanRepository = (value) => {
  const url = typeof value === 'string' ? value : value?.url;
  return url ? url.replace(/^git\+/, '').replace(/\.git$/, '').replace(/^git:\/\//, 'https://') : '';
};

function collectNpm(root) {
  const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf-8'));
  return npmProductionPackages(lock).map(({ name, version, path }) => {
    const dir = join(root, path);
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8'));
    const license = typeof manifest.license === 'string' ? manifest.license : manifest.license?.type;
    const author = typeof manifest.author === 'string' ? manifest.author : manifest.author?.name;
    return { ecosystem: 'npm', name, version, license, authors: author ? [author] : [], repository: cleanRepository(manifest.repository), dir };
  });
}

function collectRust(root) {
  const manifestPath = join(root, 'src-tauri', 'Cargo.toml');
  let output;
  try {
    // --locked: never touch Cargo.lock. --offline: use the crates already downloaded. The Windows target is what ships.
    output = execFileSync('cargo', ['metadata', '--locked', '--offline', '--format-version', '1', '--filter-platform', 'x86_64-pc-windows-msvc', '--manifest-path', manifestPath], {
      maxBuffer: 256 * 1024 * 1024,
      encoding: 'utf-8',
    });
  } catch (error) {
    throw new Error(`cargo metadata failed (is cargo on PATH? see issues/README.md shared rule 6): ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
  const meta = JSON.parse(output);
  const byIdMap = new Map(meta.packages.map((p) => [p.id, p]));
  const nodes = new Map(meta.resolve.nodes.map((n) => [n.id, n]));
  const seen = new Set();
  const stack = [meta.resolve.root];
  while (stack.length > 0) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    for (const dep of nodes.get(id)?.deps ?? []) if (dep.dep_kinds.some((k) => k.kind === null)) stack.push(dep.pkg);
  }
  return [...seen]
    .filter((id) => id !== meta.resolve.root)
    .map((id) => byIdMap.get(id))
    .map((p) => ({ ecosystem: 'rust', name: p.name, version: p.version, license: p.license ?? 'UNKNOWN', authors: p.authors ?? [], repository: cleanRepository(p.repository), dir: dirname(p.manifest_path) }));
}

/** License texts registered for packages that ship none: `scripts/third-party-license-supplements/index.json`. */
function readSupplements(root) {
  const dir = join(root, 'scripts', 'third-party-license-supplements');
  const index = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf-8'));
  return Object.fromEntries(Object.entries(index).filter(([key]) => key !== '_readme').map(([repository, info]) => [repository, readFileSync(join(dir, info.file), 'utf-8')]));
}

export function generate(root) {
  const npm = collectNpm(root);
  const rust = collectRust(root);
  for (const p of [...npm, ...rust]) if (!existsSync(p.dir)) throw new Error(`package directory missing: ${p.name}@${p.version} (${p.dir}). Run npm install / cargo fetch first.`);
  const entries = buildEntries([...npm, ...rust], { readLicenseTexts, supplements: readSupplements(root) });
  return renderMarkdown({
    entries,
    hashes: { 'package-lock.json': sha256(join(root, 'package-lock.json')), 'src-tauri/Cargo.lock': sha256(join(root, 'src-tauri', 'Cargo.lock')) },
    scope: `${npm.length} npm packages bundled into the frontend (dev-only tools excluded) and ${rust.length} Rust crates linked into the Windows executable (build scripts and dev tools excluded).`,
  });
}

// Command line: `npm run licenses` from the project root.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const root = process.cwd();
    writeFileSync(join(root, OUTPUT_FILE), generate(root) + LF);
    process.stdout.write(`Wrote ${OUTPUT_FILE}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
