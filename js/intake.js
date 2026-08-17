/* ============================================================
   SURVEY HAND-OFF — how a finished onboarding becomes a person in the app.

   Until this file existed there was no way in. onboarding.html wrote its
   answers to localStorage under `fj_current`, nothing read that key, and
   the last screen's "Open my Log" button ran:

       onclick = () => toast('This is where the app opens. End of prototype.')

   So the survey ended in a cul-de-sac. Everything downstream was already
   built for it — core/schema.js has an Intake record, the User status
   'pending' is documented as "intake submitted, no program written yet",
   users.js says in its own header that "anyone the survey creates arrives
   the same way and is indistinguishable", and addUser() was sitting there
   unused. This is the missing wire, not a new mechanism.

   WHY THE URL AND NOT localStorage.
   The survey runs in Safari. The installed app gets its OWN storage
   container on iOS, so anything the survey writes to localStorage is
   simply absent the first time the installed app runs — the same problem
   manifest-user.js was written to solve for profiles. The answers
   therefore travel in the URL fragment, which crosses that boundary
   because the person carries it.

   A FRAGMENT, NOT A QUERY STRING, AND THAT IS DELIBERATE.
   This payload is health data — PAR-Q answers and a body map of current
   injuries. A fragment is never sent to the server and never lands in an
   access log; ?p=… would put a medical questionnaire into the hosting
   provider's logs on every open. It is also stripped from the address bar
   as soon as it has been read, so it does not sit in history.
   ============================================================ */
import { storage } from './core/storage.js';
import { makeUser, makeIntake } from './core/schema.js';
import { addUser, claimDevice } from './users.js';

/* The survey encodes with btoa over UTF-8, then makes it URL-safe. Same
   transform backwards. Kept here rather than imported because the survey
   is a single file with no module boundary to import from — if the
   encoding ever changes, these two are the pair to change together. */
function decodePayload(s) {
  const b = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b + '='.repeat((4 - (b.length % 4)) % 4);
  return JSON.parse(decodeURIComponent(escape(atob(pad))));
}

/* ONE PERSON PER PHONE, AND THE SAME ONE EACH TIME.
   A fresh newId() per completed survey would be more literal, but running
   the survey twice on one device is a person correcting their answers, not
   a second human — and it would leave a pile of abandoned profiles on the
   claim screen. A stable id means a re-run REPLACES: same user, new intake
   record. The intake history is where the "what did they say last time"
   answer lives, and that is kept in full. */
const SELF = 'me';

/* The survey measures a level; the app has two UIs. This is the only
   place that decision is made, and it is deliberately generous toward
   the gentler one — a beginner shown the pro UI is lost, whereas someone
   experienced shown the beginner UI is merely impatient, and can switch. */
function uiFor(a) {
  const tier = a.tier;                     // 0-4, averaged from the deck
  if (typeof tier === 'number' && tier >= 2) return 'pro';
  if (a.activity === 'lots' || a.activity === 'some') return 'pro';
  return 'beginner';
}

/**
 * Read a survey hand-off out of the URL, if there is one, and turn it into
 * a User + an Intake. Returns the user id it claimed, or null when there
 * was nothing to consume — so boot() can carry on exactly as before.
 */
export async function consumeSurveyHandoff() {
  const m = String(location.hash || '').match(/[#&]fj=([A-Za-z0-9_\-]+)/);
  if (!m) return null;

  let payload;
  try {
    payload = decodePayload(m[1]);
  } catch (e) {
    /* A truncated or mangled link. Say nothing and boot normally — the
       alternative is a dead app on the one screen a new person sees. */
    console.warn('[intake] hand-off could not be read, ignoring', e);
    return null;
  }

  const a = (payload && payload.a) || {};
  const s = storage();

  const existing = await s.getUser(SELF);
  const user = makeUser({
    ...(existing || {}),
    id: SELF,
    role: 'client',
    /* PENDING, NOT ACTIVE. schema.js is explicit about what this means:
       the app opens on their answers reflected back and an honest "your
       program is being written" — never an invented workout. Turning this
       to 'active' is the coach's act, not the survey's. */
    status: 'pending',
    displayName: a.name || (existing && existing.displayName) || '',
    email: a.email || null,
    ui: uiFor(a),
    programId: null,
    accent: '#3ECBA8',
  });
  await addUser(user);

  await s.saveIntake(makeIntake({
    userId: SELF,
    version: payload.v || 6,
    /* VERBATIM. schema.js: "the record of what somebody actually said has
       to stay true" — so the whole answer bag goes in untouched, and the
       numbers the survey worked out go beside it rather than over it. */
    answers: a,
    derived: {
      tier: a.tier ?? null,
      tierName: a.tierName ?? null,
      levels: a.levels ?? null,
      patterns: a.patterns ?? null,
      toTest: a.toTest ?? null,
    },
    submittedAt: payload.at || new Date().toISOString(),
  }));

  await claimDevice(SELF, user.displayName);

  /* Take it out of the address bar. It has been read, it is health data,
     and leaving it there puts it in the back button and in any screenshot
     of the app. replaceState so there is no extra history entry. */
  try {
    history.replaceState(null, '', location.pathname + location.search);
  } catch (e) {
    location.hash = '';
  }

  return SELF;
}
