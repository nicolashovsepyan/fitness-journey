# notify

The only server-side code in this product. It exists because sending a Web
Push means signing it with the VAPID private key, and that key can never be
in a page.

## Deploying it

```bash
npx supabase login
npx supabase link --project-ref dmpxtzjlhccxisuofxhd
npx supabase functions deploy notify
```

## The secrets it needs

Set in the Supabase dashboard under **Edge Functions, Secrets**:

| Name | What |
|---|---|
| `VAPID_PRIVATE_KEY` | the private half from `tools/make-vapid.mjs`, never committed |
| `VAPID_PUBLIC_KEY` | the public half, the same string as `js/config.js` |
| `VAPID_SUBJECT` | `mailto:` and a real address, which push services require |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are
provided by the platform. Do not set them.

## What it refuses

It checks the caller token and will only notify the caller themselves or a
client whose `trainer_id` is the caller. It runs as the service role, which
bypasses row-level security, so that check has to be made here in the open
rather than trusted from the request body.
