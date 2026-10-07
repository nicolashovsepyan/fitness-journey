#!/usr/bin/env node
/* ============================================================
   THE TIMER'S CODE CHECK. Run:  node tools/check-timer.mjs
   (check-all runs it too.)

   1. Every file under js/ parses as a module. A browser that meets one
      syntax error drops the whole file, and with it every screen that
      imports it.
   2. No local variable named `t` hides the translate function t().
      This is what emptied the move library on 2026-10-07: the picker
      kept the search text in `const t`, so the first t('Favorites')
      threw and the list never drew. Found by reading the code, not by
      running it, so it is caught here before a phone ever sees it.
   ============================================================ */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.js')) files.push(p);
  }
})(join(root, 'js'));

let bad = 0;
const fail = msg => { bad++; console.log('FAIL ' + msg); };

/* 1. parse */
for (const f of files) {
  const r = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: readFileSync(f), encoding: 'utf8' });
  if (r.status !== 0) fail(`${relative(root, f)} does not parse: ${(r.stderr.match(/SyntaxError.*/) || [''])[0]}`);
}

/* 2. a local t over the translate function */
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:\\'"`])\/\/.*$/gm, (m, a) => a + ' '.repeat(m.length - a.length));
/* the block that holds position i: back to its unmatched {, forward to its } */
function blockAround(s, i) {
  let d = 0, a = 0;
  for (let k = i; k >= 0; k--) { if (s[k] === '}') d++; else if (s[k] === '{') { if (!d) { a = k; break; } d--; } }
  d = 0;
  for (let k = a + 1; k < s.length; k++) { if (s[k] === '{') d++; else if (s[k] === '}') { if (!d) return [a, k]; d--; } }
  return [a, s.length];
}
/* an arrow's own body: its { } block, or the expression up to ; or the
   bracket that closes around it */
function arrowBody(s, i) {
  const k = s.indexOf('=>', i) + 2;
  let j = k; while (/\s/.test(s[j])) j++;
  if (s[j] === '{') return blockAround(s, j + 1);
  let d = 0;
  for (let m = j; m < s.length; m++) {
    const c = s[m];
    if ('([{'.includes(c)) d++;
    else if (')]}'.includes(c)) { if (!d) return [j, m]; d--; }
    else if ((c === ';' || c === ',') && !d) return [j, m];
  }
  return [j, s.length];
}
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  if (!/import\s*{[^}]*\bt\b[^}]*}\s*from\s*['"][./]*i18n\.js['"]/.test(src)) continue;
  const s = strip(src);
  const scopes = [];
  for (const m of s.matchAll(/\b(?:const|let|var)\s+t\s*=/g)) scopes.push([m.index, blockAround(s, m.index)[1]]);
  for (const m of s.matchAll(/(?:\(\s*t\s*\)|(?<![\w.$])t)\s*=>/g)) scopes.push([m.index, arrowBody(s, m.index)[1]]);
  for (const m of s.matchAll(/function\s*[\w$]*\s*\(([^)]*)\)\s*{/g))
    if (m[1].split(',').some(p => p.trim().split('=')[0].trim() === 't')) scopes.push([m.index, blockAround(s, m.index + m[0].length)[1]]);
  for (const [a, b] of scopes) {
    const use = /(?<![\w.$])t\(\s*['"`]/.exec(s.slice(a, b));
    if (use) {
      const line = s.slice(0, a + use.index).split('\n').length;
      fail(`${relative(root, f)}:${line} calls t('…') where a local t hides the translate function`);
    }
  }
}

console.log(bad ? `\n${bad} problem(s).` : `ok  ${files.length} files parse, no t() hidden by a local t`);
process.exit(bad ? 1 : 0);
