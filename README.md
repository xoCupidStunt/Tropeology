# Tropeology — deployment guide

A personal reading tracker: Create React App + Supabase (Postgres + Auth + Row Level Security) + Vercel.
This mirrors the Gen.io stack, but on your own personal Supabase/Vercel/GitHub accounts — nothing here touches Trustwave's infrastructure.

---

## 0. What you'll end up with

- A private GitHub repo with the app's source code
- A Supabase project (your own, personal) holding your data behind email/password auth
- A live URL on Vercel, so the app works from your phone, laptop, anywhere — same account, same data

Time: ~20 minutes.

---

## 1. Create the Supabase project

1. Go to **[supabase.com](https://supabase.com)** and sign in (or create a personal account — use your own email, not a Trustwave one).
2. Click **New project**.
   - Name: `tropeology` (or anything you like)
   - Database password: generate and **save it somewhere** (a password manager) — you likely won't need it day-to-day, but you will if you ever connect a external Postgres client.
   - Region: pick whichever is closest to you.
3. Wait ~2 minutes for it to finish provisioning.
4. In the left sidebar, go to **SQL Editor -> New query**.
5. Open `supabase/schema.sql` from this project, paste the whole thing in, and click **Run**.
   This creates two tables (`user_data`, `user_calendar`), turns on Row Level Security, and adds policies so each signed-in user can only ever read or write their own row.
6. Go to **Project Settings -> API**. You'll need two values in a minute:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon / public key** (a long string starting with `eyJ...`)

### Email confirmation (optional, but saves a step)

By default Supabase requires you to click a confirmation link before you can sign in. For a single-person app that's just friction. To turn it off:

- Go to **Authentication -> Providers -> Email**, and toggle **Confirm email** off.
- If you'd rather keep confirmation on, that's fine too — the app will tell you to check your inbox after signing up. Supabase's built-in email sender handles this fine at low volume (a handful of emails); if you ever hit its rate limit, you can add a custom SMTP provider like Resend under **Authentication -> Settings -> SMTP Settings** (same approach Gen.io used).

---

## 2. Push the code to GitHub

1. Go to **[github.com](https://github.com)**, sign in with your personal account, and click **New repository**.
   - Name: `tropeology`
   - Visibility: **Private** (it's your personal reading data — no reason to make it public)
   - Don't initialize with a README/gitignore — this project already has them.
2. On your computer, open a terminal in this project folder and run:

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/tropeology.git
   git push -u origin main
   ```

   (GitHub will show you this exact snippet with your username filled in, on the empty repo's page.)

Your `.env` file (if you create one locally) is already excluded via `.gitignore` — your Supabase keys never get committed. The anon key is safe to expose in a deployed frontend by design (that's what Row Level Security is for), but there's no reason to put it in git history unnecessarily.

---

## 3. Deploy on Vercel

1. Go to **[vercel.com](https://vercel.com)** and sign in with your GitHub account (personal, not Trustwave's org).
2. Click **Add New -> Project**, and import the `tropeology` repo you just pushed.
3. Vercel will auto-detect Create React App. Leave the build settings as default:
   - Build command: `react-scripts build` (or leave blank to use the default)
   - Output directory: `build`
4. Before deploying, expand **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `REACT_APP_SUPABASE_URL` | your Project URL from step 1.6 |
   | `REACT_APP_SUPABASE_ANON_KEY` | your anon public key from step 1.6 |

5. Click **Deploy**. In about a minute you'll get a live URL like `tropeology-yourname.vercel.app`.
6. Open it, create your account (email + password), and you're in — same login works from any device from now on.

If you ever change the Supabase keys, update them in **Vercel -> Project -> Settings -> Environment Variables**, then redeploy (Vercel -> Deployments -> ⋯ -> Redeploy) so the new values get baked into the build.

---

## 4. Running it locally (optional)

```bash
npm install
cp .env.example .env      # then fill in your real Supabase URL + anon key
npm start
```

Opens at `http://localhost:3000`.

---

## How the data is stored

To keep this a clean, low-risk port of the working prototype, each user's data is stored as two rows (one JSON document each) rather than fully normalized tables:

- `user_data` — books, wishlist, releases, goals, reading log, preferences
- `user_calendar` — the uploaded calendar background photo + opacity setting

Both are locked down with Row Level Security keyed to `auth.uid()`, so this is fully multi-user-safe if you ever want to invite someone else in — they'd just get their own private row, the same way Gen.io's team members each see their own scoped data. If down the road you want proper relational tables (e.g. for reporting, or querying "all books by author X" server-side), that's a straightforward follow-up migration — just say the word.

## Troubleshooting

- **Blank page after deploy / "Missing Supabase environment variables" in the console** — the env vars weren't set (or weren't set before the last deploy). Add them in Vercel and redeploy.
- **"new row violates row-level security policy"** — the schema.sql policies weren't applied, or you're signed in as a different user than the row belongs to. Re-run `schema.sql` in the SQL Editor.
- **Sign-up says to check email, but nothing arrives** — check spam, or turn off "Confirm email" as described in step 1.
- **Build fails on Vercel with an ESLint error** — CRA treats some warnings as errors only when `CI=true`. If this happens, the exact error will be in the Vercel build log; paste it back to me and I'll send a corrected file.
