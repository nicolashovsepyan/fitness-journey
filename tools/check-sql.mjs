/* ============================================================
   CHECK-SQL - refuse to hand over SQL the Supabase editor cannot read.

   Run: node tools/check-sql.mjs

   Three files were handed over and three came back "Backend error! Retry your
   query", a message that names no line. The cause was not the schema. The
   Supabase SQL editor splits a script into statements ITSELF, in the browser,
   before Postgres ever sees it, and its splitter does not skip comments. So:

       -- auth.users is Supabase's own login table

   opens a text quote on that apostrophe which never closes, and every
   statement after it is mis-read. Postgres would have been perfectly happy.

   The tell was there in the data: 00-check.sql had no apostrophe in any
   comment and passed. Every file that failed had one.

   Same reasoning applies to a dollar pair in a comment, which is what the
   first two attempts tripped on.

   This is a lint for one specific, well-evidenced editor bug. It is not a
   general SQL checker and does not pretend to be.
   ============================================================ */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('../supabase', import.meta.url));
const problems = [];

for (const file of readdirSync(DIR).filter(f => f.endsWith('.sql'))) {
  const lines = readFileSync(join(DIR, file), 'utf8').split('\n');

  lines.forEach((line, i) => {
    const isComment = line.trim().startsWith('--');
    if (!isComment) return;
    if (line.includes("'")) {
      problems.push({ file, line: i + 1, why: 'apostrophe in a comment', text: line.trim() });
    }
    if (line.includes('$$')) {
      problems.push({ file, line: i + 1, why: 'dollar pair in a comment', text: line.trim() });
    }
  });

  /* Every dollar-quote tag must be balanced, and none may be the bare pair -
     a named tag cannot collide with a dollar sign inside the body. */
  const body = lines.filter(l => !l.trim().startsWith('--')).join('\n');
  const tags = body.match(/\$[a-zA-Z_]*\$/g) || [];
  const counts = {};
  for (const t of tags) counts[t] = (counts[t] || 0) + 1;
  for (const [tag, n] of Object.entries(counts)) {
    if (n % 2) problems.push({ file, line: 0, why: `unbalanced dollar tag ${tag}`, text: '' });
    if (tag === '$$') problems.push({ file, line: 0, why: 'bare $$ - use a named tag', text: '' });
  }
}

if (problems.length) {
  console.error(`\n  ${problems.length} thing(s) the Supabase editor will choke on:\n`);
  for (const p of problems) {
    console.error(`    ${p.file}:${p.line}  ${p.why}`);
    if (p.text) console.error(`      ${p.text.slice(0, 88)}`);
  }
  console.error('\n  Rewrite the comment. Avoid possessives and contractions in SQL comments.\n');
  process.exit(1);
}

console.log('\n  supabase/*.sql: no apostrophes or dollar pairs in comments, all tags balanced.\n');
