#!/usr/bin/env node
/* ============================================================
   THE KEYPAIR THAT LETS US PUSH TO A PHONE.

   Run:  node tools/make-vapid.mjs

   Prints a public key and a private key. Run it ONCE, ever.

   WHAT THEY ARE. Web Push will not deliver an anonymous message. Every
   push is signed, and VAPID is the signature scheme: a P-256 keypair
   where the public half identifies us to Apple and Google push
   services, and the private half proves it is really us.

   WHERE EACH HALF GOES, AND THIS IS THE WHOLE SAFETY STORY.

     PUBLIC   js/config.js, committed, published. It authorises
              nothing. A phone needs it to subscribe at all.

     PRIVATE  Supabase, as an Edge Function secret, and NOWHERE ELSE.
              Never in this repository, never in a message, never in
              js/config.js. Anybody holding it can send a notification
              to every phone that ever subscribed, as us.

   ROTATING THEM IS EXPENSIVE, which is why this runs once. Every
   existing subscription is tied to the public key it was made with, so
   changing the pair silently breaks every phone already signed up and
   each one has to subscribe again. Generate once, keep the private
   half safe, and leave it alone.
   ============================================================ */
import { generateKeyPairSync } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const b64url = buf => Buffer.from(buf).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });

/* The public key as the 65 raw bytes the push services expect: an
   uncompressed point, 0x04 then X then Y. Node hands back DER, and the
   point is simply its last 65 bytes. */
const der = publicKey.export({ type: 'spki', format: 'der' });
const pub = b64url(der.subarray(der.length - 65));

/* The private key is the 32 byte scalar. Node JWK export names it `d`,
   already base64url, which is exactly the format web-push wants. */
const priv = privateKey.export({ format: 'jwk' }).d;

/* THE PRIVATE HALF IS WRITTEN TO A FILE, NOT PRINTED.

   Printing it puts it in a terminal buffer, a scrollback, and any
   transcript of the session. That is how a secret leaks without
   anybody doing anything wrong, and it happened the first time this
   ran. It goes to a file outside the repository instead, and this
   prints the path. */
const out = process.env.FJ_VAPID_OUT
  || join(homedir(), 'fitness-journey-vapid-private.txt');
writeFileSync(out, priv + '\n', { mode: 0o600 });

console.log(`
  VAPID keypair generated. Run this once, ever.

  PUBLIC  (goes in js/config.js, committed, safe to publish)

    ${pub}

  PRIVATE written to, and readable only by you:

    ${out}

  Next:
    1. Open that file, copy the line.
    2. Supabase dashboard, Edge Functions, Secrets, new secret
       named VAPID_PRIVATE_KEY, paste it.
    3. Delete the file.

  It must never be pasted into a chat, a commit, or js/config.js.
  Anybody holding it can send a notification to every phone that ever
  subscribed, as us.
`);
