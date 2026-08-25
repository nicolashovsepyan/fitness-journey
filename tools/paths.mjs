/* ============================================================
   WHERE THE FOLDERS ARE — the one place that knows.

   THE PROBLEM THIS FILE ENDS.

   Five tools each carried their own copy of the same resolveDir(), and
   each one spelled the folder it wanted as a literal string. That was
   already a rule broken - two copies of one truth is the disease this
   rebuild exists to cure - and on 25 August it cost a morning.

   The artwork folder moved. It used to sit at the top level as
   " EXERCISE LIBRARY"; it now lives inside the database folder as
   " EXERCISE PHOTO LIBRARY", which is where it belongs, because the
   pictures and the movements they illustrate are one subject.

   Nothing was lost. But three tools went on looking at the old place
   and failed with a wall of MISSING lines, and a fourth degraded in
   silence: build-equipment.mjs guards its read with existsSync, so a
   folder that has moved does not error, it simply produces a smaller
   answer than the truth. That is the worst failure of the four,
   because it looks like success.

   So the names live here now, once. When a folder moves again, this
   file changes and nothing else does.

   TWO KINDS OF TOLERANCE, AND WHY BOTH ARE NEEDED.

   1. A folder is looked up by name ignoring case and any space in
      front. Folders here get a leading space on purpose, to sort them
      to the top of Finder, and that is a reasonable thing to want.

   2. A folder is looked for in more than one place, newest first. The
      old location stays in the list. A checkout from before the move,
      or a copy of this project that has not been reorganised, keeps
      working rather than failing with a path that means nothing to
      the person reading it.
   ============================================================ */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));

/* Find a folder by name inside a parent, tolerating a leading or
   trailing space and a different case. Returns the path it built even
   when nothing matched, so the caller fails naming a real path rather
   than `undefined`. */
export function resolveDir(parent, wanted) {
  const want = wanted.trim().toLowerCase();
  const exact = join(parent, wanted);
  try { if (statSync(exact).isDirectory()) return exact; } catch {}
  let names = [];
  try { names = readdirSync(parent); } catch { return exact; }
  for (const name of names) {
    if (name.trim().toLowerCase() !== want) continue;
    const full = join(parent, name);
    try { if (statSync(full).isDirectory()) return full; } catch {}
  }
  return exact;   // let the caller fail with a clear path
}

/* Walk a chain of names down from ROOT, each one resolved tolerantly.
   Returns null unless the whole chain exists as directories. */
function chain(...names) {
  let here = ROOT;
  for (const name of names) {
    here = resolveDir(here, name);
    try { if (!statSync(here).isDirectory()) return null; } catch { return null; }
  }
  return here;
}

/* The first candidate that exists. Each candidate is a chain of folder
   names from the project root. Newest location first. */
function firstOf(candidates) {
  for (const names of candidates) {
    const hit = chain(...names);
    if (hit) return hit;
  }
  return null;
}

/* ── The folders, by what they are for ────────────────────────── */

/** Everything about movements: the workbook, its tools, the pictures. */
export const database = () => firstOf([
  ['EXERCISE DATABASE'],
]);

/** The finished artwork Nicolas drops in. Moved 25 Aug 2026. */
export const artwork = () => firstOf([
  ['EXERCISE DATABASE', 'EXERCISE PHOTO LIBRARY'],   // where it is
  ['EXERCISE LIBRARY'],                              // where it was
]);

/** Everything Nicolas fills in, corrects or decides. */
export const nicolas = () => firstOf([
  ['FOR NICOLAS'],
]);

/** A file inside the workbook folder, e.g. '_derived.json'. Returns
 *  null if the database folder itself has gone, so a caller that
 *  guards with existsSync still guards correctly. */
export function workbook(file) {
  const db = database();
  if (!db) return null;
  return join(resolveDir(db, 'workbook'), file);
}

/* ── Failing usefully ─────────────────────────────────────────── */

/** Turn a missing folder into a sentence that says what to do, rather
 *  than an ENOENT on a path nobody recognises. */
export function must(dir, what) {
  if (dir) return dir;
  throw new Error(
    `Cannot find the ${what} folder.\n` +
    `Looked inside: ${ROOT}\n` +
    `If it has moved, say where in tools/paths.mjs - that is the only ` +
    `file that knows, and every tool reads it.`
  );
}
