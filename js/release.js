/* ============================================================
   RELEASE HAND-OFF — how a program written in the console reaches the phone.

   The other half of the intake wire. coach.html and the client used to talk
   through localStorage — its own comment says "shared with the client app
   through localStorage" — and that stops working the moment the app is
   installed, because an installed iOS app gets its own storage container.
   Same device, same browser, different container: the console cannot reach
   it. A laptop reaching a phone was never possible at all.

   So a release is carried. The console produces a link, the person opens it
   on their phone, and this turns it into the two writes that make a program
   real for somebody:

       the Program record, assigned to them
       their User: status 'active', programId set

   Until that second write happens the user is 'pending', which schema.js
   defines as "intake submitted, no program written yet" — the app shows
   their answers back and an honest "your program is being written", never
   an invented workout. Releasing is the act that changes it, and it stays
   the coach's act rather than something the survey can do for itself.

   See js/carrier.js for why this travels in the fragment.
   ============================================================ */
import { storage } from './core/storage.js';
import { makeProgram } from './core/schema.js';
import { claimDevice } from './users.js';
import { decode, encode, readFragment, clearFragment } from './carrier.js';

/**
 * Build the link a coach hands to a client. Called from the console.
 * `program` is the console's own shape ({ days: {...} }) — it is carried
 * verbatim inside the Program record so the console stays the only thing
 * that decides what a day looks like.
 */
export function releaseLink(baseUrl, { userId, name, program }) {
  const payload = { v: 1, at: new Date().toISOString(), userId, name, program };
  return String(baseUrl).replace(/[^/]*$/, '') + 'index.html#prg=' + encode(payload);
}

/**
 * Read a released program out of the URL, if there is one. Returns the user
 * id it was written for, or null when there was nothing to consume.
 *
 * Runs AFTER the intake hand-off in boot(), because a link can legitimately
 * carry a program for somebody this device has not met yet — a client who
 * reinstalled, say — and in that case the Program is still worth keeping
 * even though there is no User to attach it to. It attaches on their next
 * onboarding rather than being thrown away.
 */
export async function consumeReleaseHandoff() {
  const raw = readFragment('prg');
  if (!raw) return null;

  let payload;
  try {
    payload = decode(raw);
  } catch (e) {
    console.warn('[release] hand-off could not be read, ignoring', e);
    return null;
  }

  const s = storage();

  /* WHOSE PROGRAM THIS BECOMES, ON THIS DEVICE.

     The id in the payload is the CONSOLE's id for this person — derived
     there from their email so one coach can hold many clients without
     collisions. This phone has its own idea of who it belongs to, and the
     two were never going to match. They do not need to: a phone has one
     person on it, and a link addressed to them is for whoever is here.

     So the device's own active user wins, and the payload's id is only the
     fallback for a phone that has not been claimed yet. Getting this
     backwards writes the program against an id nothing else reads, which
     looks like a successful release and shows an empty week. */
  const active = await s.getActiveUserId();
  const uid = active || payload.userId || 'me';

  const program = makeProgram({
    id: 'prg_' + uid,
    ownerId: 'coach',
    assignedTo: uid,
    name: (payload.program && payload.program.name) || 'Your program',
    status: 'assigned',
    /* The console's day map, carried whole. days[] in the schema is the
       ordered week; the console keys its days d1..dn, so the order is the
       key order it wrote them in. */
    days: Object.entries((payload.program && payload.program.days) || {})
      .map(([id, d], k) => ({ id, weekday: k, sessionId: id, label: d.name || null })),
    /* raw is the console's day map, carried whole; released is its switch
       map. The client has no console to ask, so both travel. */
    profile: { source: 'console', raw: payload.program || {},
               released: payload.released || null },
  });
  await s.savePrograms([program]);

  const user = await s.getUser(uid);
  if (user) {
    /* ACTIVE, AND ONLY NOW. This is the single place a person stops being
       'pending'. If it ever moves, move it somewhere a coach still has to
       press something — the whole point of pending is that nobody is handed
       a workout nobody wrote. */
    await s.saveUser({ ...user, status: 'active', programId: program.id });

    /* AND CLAIM THE DEVICE. Writing the record is not enough: users.js
       resolves identity once at boot and holds it, so a release that only
       saved the row left `active` null and the app opened on "whose phone is
       this?" — having just been handed that person's program. A release link
       is addressed to somebody by name, which is as explicit an instruction
       as the ?user= link users.js already treats as authoritative. */
    await claimDevice(uid);
  }

  clearFragment();
  return uid;
}
