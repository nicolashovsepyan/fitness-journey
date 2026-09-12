/* ============================================================
   NOTIFY. The one thing in this product that runs on a server.

   A coach releases a program or writes a message. This records it and
   pushes it to every device that person has signed up.

   WHY IT CANNOT HAPPEN IN THE BROWSER, which is the reason this file
   exists at all: sending a Web Push means signing it with the VAPID
   private key, and that key can never be in a page. It lives here, as
   a secret, on Supabase.

   WHO MAY CALL IT. Anybody signed in, and they may only send to their
   own clients. That is checked HERE, against the caller token, rather
   than trusted from the request body, because a function that sends
   whatever it is told to send is a function that lets anyone notify
   anyone.

   WHAT IT WRITES. A row in notifications, always, even when every push
   fails. The row is what the badge counts and what the app shows on
   next open, so a person whose phone was off still finds out. The push
   is the fast path, not the record.
   ============================================================ */
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const URL_ = Deno.env.get('SUPABASE_URL')!;
  const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY');
  const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY');
  const SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:coach@fitness-journey.app';

  if (!VAPID_PRIVATE || !VAPID_PUBLIC) {
    return json({ error: 'Push is not configured: VAPID_PRIVATE_KEY or VAPID_PUBLIC_KEY is missing.' }, 500);
  }

  /* ---- who is asking -------------------------------------------
     The token is verified by Supabase, not by us. An unsigned, expired
     or forged one resolves to nobody and stops here.

     THE TOKEN IS PASSED EXPLICITLY rather than by building a client
     with the anon key and letting it read the header. This project
     issues asymmetric JWTs, the anon key is the deprecated legacy one,
     and a client built on it verified nothing: every caller came back
     as "Not signed in", including the real coach. getUser(jwt) checks
     the signature against the project keys and needs no anon key at
     all. */
  const admin = createClient(URL_, SERVICE);
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Not signed in.' }, 401);
  const { data: me, error: authErr } = await admin.auth.getUser(token);
  const callerId = me?.user?.id;
  if (authErr || !callerId) return json({ error: 'Not signed in.' }, 401);

  let payload: { to?: string; title?: string; body?: string; url?: string; kind?: string };
  try { payload = await req.json(); } catch { return json({ error: 'Body is not JSON.' }, 400); }

  const to = String(payload.to || '');
  const title = String(payload.title || 'Fitness Journey').slice(0, 120);
  const body = String(payload.body || '').slice(0, 400);
  const url = String(payload.url || './index.html').slice(0, 400);
  const kind = String(payload.kind || 'message').slice(0, 40);
  if (!to) return json({ error: 'No recipient.' }, 400);

  /* ---- may they? ------------------------------------------------
     Service role bypasses row level security, which is exactly why
     the permission question has to be asked out loud here. You may
     notify yourself, or somebody whose trainer_id is you. Nobody
     else, whatever the body says. */
  if (to !== callerId) {
    const { data: client } = await admin
      .from('users').select('id, trainer_id').eq('id', to).maybeSingle();
    if (!client || client.trainer_id !== callerId) {
      return json({ error: 'They are not your client.' }, 403);
    }
  }

  /* ---- the record, which matters more than the push ------------- */
  const { data: note, error: noteErr } = await admin
    .from('notifications').insert({ user_id: to, title, body, url, kind })
    .select().single();
  if (noteErr) return json({ error: `Could not record it: ${noteErr.message}` }, 500);

  /* ---- the badge number, so the phone shows the right one -------- */
  const { count } = await admin
    .from('notifications').select('id', { count: 'exact', head: true })
    .eq('user_id', to).is('read_at', null);

  /* ---- and the push -------------------------------------------- */
  webpush.setVapidDetails(SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  const { data: subs } = await admin
    .from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', to);

  const message = JSON.stringify({ title, body, url, tag: kind, count: count ?? 1 });
  let sent = 0;
  const dead: string[] = [];

  for (const s of subs || []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        message,
      );
      sent++;
    } catch (e) {
      /* 404 and 410 mean that device is gone for good: the app was
         deleted, or the subscription expired. Keeping it would mean
         retrying a dead endpoint forever. Anything else is temporary
         and the row stays. */
      const status = (e as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) dead.push(s.endpoint);
    }
  }
  if (dead.length) await admin.from('push_subscriptions').delete().in('endpoint', dead);

  return json({ ok: true, id: note.id, devices: (subs || []).length, sent, dropped: dead.length, unread: count ?? 0 });
});
