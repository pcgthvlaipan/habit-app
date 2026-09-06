# Habit App

React + Vite habit tracker. Backend: **Supabase** (auth + Postgres).

## Local dev

```bash
pnpm install
cp .env.example .env      # fill in VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
pnpm dev
```

`pnpm lint` · `pnpm build`

---

## First-time Supabase setup

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. **SQL Editor** → paste all of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) → **Run**.
   Creates `profiles`, `habits`, `logs`, `app_config`, RLS policies, the signup
   trigger, and enables realtime.
3. **Authentication → Providers → Email** → turn **"Confirm email" OFF**
   (internal app; matches the previous Firebase behaviour). Leave it on only if
   you want every new signup to verify their address first.
4. **Project Settings → API** → copy **Project URL** and **anon public** key into
   `.env` (and into your hosting provider's env vars).
5. Make yourself admin: **Table Editor → profiles →** your row → set
   `is_admin` = `true`. (The column is locked from the client by RLS, so this
   can only be done here or by the service role.) Admins get the
   **Settings → Manage Departments** editor.

## Deploy (recommended: Cloudflare Pages or Vercel)

No CLI. Connect the GitHub repo, then:

| Setting | Value |
|---|---|
| Build command | `pnpm build` |
| Output directory | `dist` |
| Env vars | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

SPA routing: add a redirect `/* → /index.html` (Cloudflare Pages: a `_redirects`
file with `/*  /index.html  200`; Vercel/Netlify handle Vite SPAs automatically).
Every push to `main` then auto-deploys.

After the first deploy, add the deployed origin under
**Supabase → Authentication → URL Configuration → Redirect URLs** so the
password-reset links work.

---

## One-time data migration from Firebase

Copies existing users / habits / logs out of Firebase into Supabase. Passwords
can't move — migrated users sign in the first time via **Forgot password**.

```bash
pnpm add -D firebase-admin        # already in devDependencies
# .env also needs:
#   SUPABASE_SERVICE_ROLE_KEY      (Supabase → Settings → API → service_role)
#   GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json
#     (Firebase console → Project settings → Service accounts → Generate new private key)

pnpm migrate:firebase -- --dry-run      # preview
pnpm migrate:firebase                   # do it
pnpm migrate:firebase -- --send-reset   # + email everyone a reset link
```

The script is safe to re-run: existing Supabase users (matched by email) are
reused and their habits are wiped and re-inserted.

Delete `firebase-service-account.json` and unset `SUPABASE_SERVICE_ROLE_KEY`
when you're done — neither belongs anywhere near the frontend.
