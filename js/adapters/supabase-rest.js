/* ============================================================
   THE WIRE. Everything this app says to Supabase goes through here.

   WHY THIS IS HAND-WRITTEN AND NOT THE OFFICIAL CLIENT.

   The official one is good. It is also a bundle fetched from a CDN,
   and this app has no build step, a service worker that caches every
   file it ships, and a rule that a workout in a basement with no
   signal behaves exactly as it does with five bars. A script tag
   pointing at somebody elses CDN breaks all three: it cannot be
   version-pinned into the service worker cache, it is a second origin
   that has to be up for the app to boot, and it drags in realtime,
   storage and functions that nothing here calls.

   What we actually need is two HTTP APIs that are both plain REST:

     PostgREST  — /rest/v1/<table>, a table is a URL, filters are
                  query parameters, and the database enforces who may
                  see what. Row level security is not something this
                  file implements or can weaken.
     GoTrue     — /auth/v1/..., sign in, refresh, sign out.

   So this is about two hundred lines with no dependencies, it caches
   like every other file in the app, and it has no surface beyond what
   the adapter above it uses.

   THE ONE RULE IN HERE: A FAILURE IS NEVER AN EMPTY ANSWER.

   Every method either returns what the server said or throws. It must
   never turn "the phone is on a train" into an empty list, because a
   screen handed an empty list draws an empty week and a person
   believes they have no program. The layer above decides what to do
   about a throw; this layer only tells the truth about what happened.
   ============================================================ */

/** Thrown for anything that is not a 2xx. Carries enough to act on:
 *  `status` to tell a real refusal from a dead network, and `code`,
 *  which for PostgREST is the Postgres SQLSTATE. */
export class SupabaseError extends Error {
  constructor(message, { status = 0, code = null, details = null, hint = null, url = '' } = {}) {
    super(message);
    this.name = 'SupabaseError';
    this.status = status; this.code = code;
    this.details = details; this.hint = hint; this.url = url;
  }
  /** No response at all: offline, DNS, CORS, a cancelled request. The
   *  sync layer retries these and gives up on the rest. */
  get isOffline() { return this.status === 0; }
  /** The server understood and said no. Retrying changes nothing. */
  get isRefusal() { return this.status === 401 || this.status === 403; }
}

/* ---- where the session lives --------------------------------------
   Injectable, for one honest reason: the conformance suite runs under
   Node, which has no localStorage, and a test that has to invent a
   browser to run is a test that stops being run. */

export function memorySessionStore() {
  let v = null;
  return { read: () => v, write: s => { v = s; } };
}

export function localSessionStore(key = 'fj.session') {
  return {
    read() {
      try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
      catch { return null; }
    },
    write(s) {
      try { s === null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(s)); }
      catch { /* Safari private mode. The session lives for this tab only. */ }
    },
  };
}

const SKEW_SEC = 60;   // refresh a minute early rather than race the clock

export class Supabase {
  #url; #key; #store; #session; #refreshing = null;

  /** @param {{url:string, anonKey:string, sessionStore?:object}} cfg */
  constructor({ url, anonKey, sessionStore = memorySessionStore() }) {
    if (!url || !anonKey) throw new Error('Supabase needs a url and an anon key');
    this.#url = String(url).replace(/\/+$/, '');
    this.#key = anonKey;
    this.#store = sessionStore;
    this.#session = sessionStore.read();
  }

  /* ---- identity ------------------------------------------------ */

  /** The signed-in id, or null. Does NOT hit the network. */
  get userId() { return this.#session?.user?.id ?? null; }

  /** The whole session, for a caller that needs the email or the role. */
  get session() { return this.#session; }

  #setSession(s) {
    // GoTrue sends expires_in, a duration. A duration is useless after
    // a reload, so it is turned into a moment before it is stored.
    if (s && s.access_token) {
      s = { ...s, expires_at: s.expires_at ?? Math.floor(Date.now() / 1000) + (s.expires_in ?? 3600) };
    } else {
      s = null;
    }
    this.#session = s;
    this.#store.write(s);
    return s;
  }

  /** An identity with no email and no password, issued on the spot.
   *
   *  THIS IS WHAT MAKES THE SURVEY WORK, AND IT IS NOT A SHORTCUT.
   *
   *  Somebody fills in the survey before they have an account, because
   *  asking a person to make an account before they have seen anything
   *  is how you lose them. But an intake row needs an owner, and row
   *  level security means the owner has to be a real signed-in id.
   *
   *  So the survey signs in anonymously at the moment it submits. The
   *  id it gets is a real auth.uid from the first second, which means
   *  the person that lands in the coach console IS the person on the
   *  phone, with no id to reconcile later.
   *
   *  That last part is the whole reason. The alternative is a local id
   *  now and a server id later, and every reference written in between
   *  pointing at the wrong one. There is no migration here because
   *  there is never a second id.
   *
   *  linkEmail() below turns this into a permanent account later,
   *  keeping the same id. Needs Anonymous Sign-In enabled in the
   *  project, which supabase/SETUP.md spells out. */
  async signInAnonymously() {
    return this.#setSession(await this.#auth('/signup', {}));
  }

  /** Give a signed-in identity an email, so a magic link can bring it
   *  back on another device. The id does not change, which is the
   *  point: everything already written stays pointing at the same
   *  person. */
  async linkEmail(email) {
    const s = await this.#fresh();
    if (!s?.access_token) throw new Error('linkEmail needs somebody signed in');
    return this.#send(`${this.#url}/auth/v1/user`, 'PUT', { email },
      { Authorization: `Bearer ${s.access_token}` });
  }

  /** Send a sign-in link to an email address. Nothing is created here
   *  and nothing is signed in yet; the link in the mail is what does
   *  that, which is the point of a magic link. */
  async signInWithOtp(email, { redirectTo = null, shouldCreateUser = true } = {}) {
    await this.#auth('/otp', { email, create_user: shouldCreateUser,
                               ...(redirectTo ? { redirect_to: redirectTo } : {}) });
    return { sent: true };
  }

  /** The six-digit code from that same email, for a person who opened
   *  the mail on a different device than the one they are holding. */
  async verifyOtp({ email, token, type = 'email' }) {
    return this.#setSession(await this.#auth('/verify', { email, token, type }));
  }

  async signInWithPassword(email, password) {
    return this.#setSession(await this.#auth('/token?grant_type=password', { email, password }));
  }

  async signUp(email, password) {
    const r = await this.#auth('/signup', { email, password });
    // With email confirmation on, signup returns a user and no token.
    return r.access_token ? this.#setSession(r) : { confirmationRequired: true, user: r };
  }

  /** Picks the session out of the fragment a magic link lands on, and
   *  wipes the fragment. An access token left in the address bar ends
   *  up in history, in a screenshot, and in whatever the next page
   *  gets as a referrer. */
  adoptSessionFromUrl(loc = globalThis.location, history = globalThis.history) {
    const hash = (loc?.hash || '').replace(/^#/, '');
    if (!hash) return null;
    const p = new URLSearchParams(hash);
    const access_token = p.get('access_token');
    if (!access_token) return null;
    const s = this.#setSession({
      access_token,
      refresh_token: p.get('refresh_token'),
      expires_in: Number(p.get('expires_in') || 3600),
      token_type: p.get('token_type') || 'bearer',
      user: { id: jwtSub(access_token) },
    });
    try { history?.replaceState(null, '', loc.pathname + loc.search); } catch { /* older browsers */ }
    return s;
  }

  async signOut() {
    if (this.#session?.access_token) {
      try { await this.#auth('/logout', {}); } catch { /* the local session goes either way */ }
    }
    this.#setSession(null);
  }

  /** Swap the refresh token for a new access token. Concurrent callers
   *  share one flight — six screens booting at once must not fire six
   *  refreshes, five of which race and lose. */
  async refresh() {
    if (this.#refreshing) return this.#refreshing;
    const rt = this.#session?.refresh_token;
    if (!rt) return null;
    this.#refreshing = this.#auth('/token?grant_type=refresh_token', { refresh_token: rt })
      .then(s => this.#setSession(s))
      .catch(e => {
        // A refused refresh means the session is genuinely over. Keeping
        // a dead token would make every later call fail confusingly.
        if (e instanceof SupabaseError && e.isRefusal) this.#setSession(null);
        throw e;
      })
      .finally(() => { this.#refreshing = null; });
    return this.#refreshing;
  }

  async #fresh() {
    const s = this.#session;
    if (!s?.access_token) return null;
    if ((s.expires_at ?? 0) - SKEW_SEC > Math.floor(Date.now() / 1000)) return s;
    return this.refresh();
  }

  /* ---- tables -------------------------------------------------- */

  /** @param {string} table @param {Object} params PostgREST query, e.g.
   *  { select: '*', user_id: 'eq.123', order: 'created_at.desc', limit: 1 } */
  async select(table, params = {}) {
    return this.#rest('GET', table, { select: '*', ...params });
  }

  /** One row or null. `limit: 1` is added here rather than trusted to
   *  the caller, because a forgotten limit on a table with RLS off
   *  during setup is how you find out the hard way. */
  async selectOne(table, params = {}) {
    const rows = await this.select(table, { ...params, limit: 1 });
    return rows[0] ?? null;
  }

  async insert(table, rows) {
    return this.#rest('POST', table, {}, rows, { Prefer: 'return=representation' });
  }

  /** Insert, or overwrite the row that collides. `onConflict` names the
   *  column that decides collision — user_id for the one-row-per-person
   *  tables, which is most of them. */
  async upsert(table, rows, { onConflict = null } = {}) {
    return this.#rest('POST', table, onConflict ? { on_conflict: onConflict } : {}, rows,
      { Prefer: `resolution=merge-duplicates,return=representation` });
  }

  /** @param {{minimal?:boolean}} [opts] `minimal` asks for no rows back.
   *
   *  WHY THAT OPTION EXISTS, because it is not an optimisation.
   *
   *  return=representation makes PostgREST add a RETURNING, and a
   *  RETURNING needs permission to SELECT the row AFTER the change. So
   *  an update that moves a row out of your own view succeeds and then
   *  fails on the way back, with 42501 insufficient privilege - which
   *  reads as though the write was refused when the write was fine.
   *
   *  A coach releasing a client is exactly that update: the moment
   *  trainer_id stops pointing at them they can no longer see the row
   *  they just wrote. */
  async update(table, params, patch, { minimal = false } = {}) {
    return this.#rest('PATCH', table, params, patch,
      { Prefer: minimal ? 'return=minimal' : 'return=representation' });
  }

  async remove(table, params) {
    await this.#rest('DELETE', table, params);
  }

  /* ---- the single place a request is actually made -------------- */

  async #auth(path, body) {
    return this.#send(`${this.#url}/auth/v1${path}`, 'POST', body, {});
  }

  async #rest(method, table, params = {}, body = null, extra = {}) {
    const qs = new URLSearchParams(params).toString();
    const url = `${this.#url}/rest/v1/${table}${qs ? '?' + qs : ''}`;
    const s = await this.#fresh();
    const headers = { ...extra };
    // Signed in, we are that person. Signed out, we are explicitly the
    // anonymous role rather than nobody — PostgREST reads the role from
    // this header, and without it a request with no session is refused
    // before any policy gets a chance to deny it, which turns "you may
    // not see this" into "something is broken".
    headers.Authorization = `Bearer ${s?.access_token || this.#key}`;
    try {
      return await this.#send(url, method, body, headers);
    } catch (e) {
      // A token can expire between the freshness check and the server
      // reading it. One retry after a forced refresh, never a loop.
      if (e instanceof SupabaseError && e.status === 401 && this.#session?.refresh_token) {
        const r = await this.refresh().catch(() => null);
        if (r?.access_token) {
          return this.#send(url, method, body, { ...extra, Authorization: `Bearer ${r.access_token}` });
        }
      }
      throw e;
    }
  }

  async #send(url, method, body, headers) {
    let res;
    try {
      res = await fetch(url, {
        method,
        headers: { apikey: this.#key, 'Content-Type': 'application/json', ...headers },
        body: body === null || body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (e) {
      // status 0 is the signal the sync layer reads as "try again later".
      throw new SupabaseError(`cannot reach ${hostOf(url)}: ${e.message}`, { status: 0, url });
    }
    const text = await res.text();
    let data = null;
    if (text) { try { data = JSON.parse(text); } catch { data = text; } }
    if (!res.ok) {
      const d = data && typeof data === 'object' ? data : {};
      throw new SupabaseError(d.message || d.error_description || d.error || res.statusText || 'request failed',
        { status: res.status, code: d.code ?? null, details: d.details ?? null, hint: d.hint ?? null, url });
    }
    return data;
  }
}

/* The subject claim of a JWT, without verifying it — and it does not
   need verifying here. The server checks the signature on every single
   request; this only saves one round trip to learn our own id. */
function jwtSub(token) {
  try {
    const p = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = typeof atob === 'function'
      ? atob(p) : Buffer.from(p, 'base64').toString('binary');
    return JSON.parse(decodeURIComponent(escape(json))).sub ?? null;
  } catch { return null; }
}

function hostOf(url) { try { return new URL(url).host; } catch { return url; } }
