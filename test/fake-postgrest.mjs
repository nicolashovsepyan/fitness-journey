/* ============================================================
   A PostgREST-SHAPED ANSWERING MACHINE, IN MEMORY.

   WHAT IT IS FOR, EXACTLY.

   The Supabase adapter can only be wrong in two ways. It can map a
   record onto the wrong columns — drop a field, spell one differently
   at each end, send a filter the server reads as something else. Or
   Postgres can disagree with it about types and constraints.

   The second needs a real database. The first does not, and the first
   is where every bug this app has actually had came from: a field
   written by one layer that the next never reads.

   So this answers HTTP the way PostgREST does, over a Map. It makes
   the whole conformance suite runnable on a laptop with no project,
   no keys and no network, which means it runs on every commit instead
   of on the days somebody remembers to set three environment
   variables.

   WHAT IT IS NOT. It is not Postgres. It does not check a uuid is a
   uuid, does not enforce a foreign key, does not cascade a delete, and
   knows nothing whatever about row level security. A green run here
   says the adapter speaks the right language. It does not say the
   database will agree, and it says nothing at all about who can read
   what — that is supabase/03-verify-rls.sql and nothing else.

   It is deliberately small. A fake that grows features nothing asked
   for stops being a stand-in and starts being a second implementation
   to keep correct.
   ============================================================ */

/* Which column decides identity, per table. Real Postgres knows this
   from the primary key; here it is written down, and it is the same
   list the schema declares in supabase/01b-tables.sql. */
const PK = {
  users: ['id'], intakes: ['id'], programs: ['id'], sessions: ['id'],
  logs: ['id'], messages: ['id'],
  prs: ['user_id', 'ex_id'],
  user_state: ['user_id'],
};

let seq = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;

/** Installs a fetch that answers as PostgREST would.
 *  @returns {{ tables: Map<string, object[]>, restore: () => void, calls: object[] }} */
export function installFakePostgrest({ base = 'https://fake.supabase.co' } = {}) {
  const tables = new Map();
  const calls = [];
  const real = globalThis.fetch;
  const rowsOf = t => { if (!tables.has(t)) tables.set(t, []); return tables.get(t); };

  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(url);
    if (!url.startsWith(base)) return real(url, init);
    const table = u.pathname.replace(/^\/rest\/v1\//, '');
    const method = init.method || 'GET';
    const params = u.searchParams;
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ method, table, query: u.search, body });

    if (!(table in PK)) return json(404, { message: `relation "public.${table}" does not exist` });
    let rows = rowsOf(table);

    if (method === 'GET') {
      let out = rows.filter(r => matches(r, params));
      out = order(out, params.get('order'));
      const limit = Number(params.get('limit') || 0);
      if (limit > 0) out = out.slice(0, limit);
      return json(200, out.map(clone));
    }

    if (method === 'POST') {
      const incoming = Array.isArray(body) ? body : [body];
      const conflict = (params.get('on_conflict') || '').split(',').filter(Boolean);
      const merge = (init.headers?.Prefer || '').includes('merge-duplicates');
      const out = [];
      for (const raw of incoming) {
        const row = stamp(table, raw);
        const keys = conflict.length ? conflict : PK[table];
        const at = rows.findIndex(r => keys.every(k => r[k] === row[k]));
        if (at >= 0) {
          if (!merge) return json(409, { code: '23505', message: 'duplicate key value violates unique constraint' });
          // A merge keeps created_at and refreshes updated_at, which is
          // what the trigger in 01d-stamps.sql does.
          rows[at] = { ...rows[at], ...row, created_at: rows[at].created_at, updated_at: nowISO() };
          out.push(rows[at]);
        } else {
          rows.push(row);
          out.push(row);
        }
      }
      return json(201, out.map(clone));
    }

    if (method === 'PATCH') {
      const hit = rows.filter(r => matches(r, params));
      for (const r of hit) Object.assign(r, body, { updated_at: nowISO() });
      return json(200, hit.map(clone));
    }

    if (method === 'DELETE') {
      const keep = rows.filter(r => !matches(r, params));
      tables.set(table, keep);
      return json(204, null);
    }

    return json(405, { message: `method ${method} not allowed` });
  };

  return { tables, calls, restore: () => { globalThis.fetch = real; } };
}

/* ---- the bits of PostgREST grammar the adapter actually uses ------
   Adding one that nothing calls would be inventing behaviour to test
   against, so the list stops where the adapter does. */

function matches(row, params) {
  for (const [k, v] of params) {
    if (k === 'select' || k === 'order' || k === 'limit' || k === 'on_conflict') continue;
    if (k === 'and') { if (!group(row, v, every)) return false; continue; }
    if (k === 'or')  { if (!group(row, v, some)) return false; continue; }
    if (!test(row[k], v)) return false;
  }
  return true;
}

const every = (xs, f) => xs.every(f);
const some  = (xs, f) => xs.some(f);

/** and(a.eq.1,b.eq.2) — splits on commas that are not inside brackets. */
function group(row, expr, how) {
  const inner = expr.replace(/^\(/, '').replace(/\)$/, '');
  return how(split(inner), part => {
    const m = /^(and|or)\((.*)\)$/s.exec(part);
    if (m) return group(row, m[2], m[1] === 'and' ? every : some);
    const i = part.indexOf('.');
    return test(row[part.slice(0, i)], part.slice(i + 1));
  });
}

function split(s) {
  const out = []; let depth = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) { out.push(s.slice(start, i)); start = i + 1; }
  }
  out.push(s.slice(start));
  return out.filter(Boolean);
}

function test(cell, expr) {
  const i = expr.indexOf('.');
  const op = expr.slice(0, i), want = expr.slice(i + 1);
  switch (op) {
    case 'eq':  return String(cell) === want;
    case 'neq': return String(cell) !== want;
    case 'gte': return cell !== null && String(cell) >= want;
    case 'lte': return cell !== null && String(cell) <= want;
    case 'gt':  return cell !== null && String(cell) > want;
    case 'lt':  return cell !== null && String(cell) < want;
    case 'is':  return want === 'null' ? cell === null || cell === undefined : String(cell) === want;
    case 'in':  return want.replace(/^\(|\)$/g, '').split(',').includes(String(cell));
    default: throw new Error(`fake-postgrest does not know the operator "${op}". `
      + 'Either the adapter grew a new one, or it sent something wrong.');
  }
}

function order(rows, spec) {
  if (!spec) return rows;
  const [col, dir = 'asc'] = spec.split('.');
  return [...rows].sort((a, b) => {
    const x = a[col], y = b[col];
    if (x === y) return 0;
    if (x === null || x === undefined) return 1;
    if (y === null || y === undefined) return -1;
    return (x < y ? -1 : 1) * (dir.startsWith('desc') ? -1 : 1);
  });
}

const nowISO = () => new Date().toISOString();

/** Defaults the database would fill in: a generated id and the stamps. */
function stamp(table, raw) {
  const row = { ...raw };
  if (PK[table].includes('id') && !row.id) row.id = uuid();
  row.created_at ??= nowISO();
  row.updated_at ??= nowISO();
  if (table === 'logs') row.performed_on ??= nowISO().slice(0, 10);
  if (table === 'user_state') row.state ??= {};
  return row;
}

const clone = r => JSON.parse(JSON.stringify(r));

function json(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    text: async () => (data === null ? '' : JSON.stringify(data)),
  };
}
