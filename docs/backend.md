# Cloud backup (Supabase)

ApeChess works fully without a backend: progress lives in the browser's IndexedDB. Cloud backup is optional. A learner signs in with an emailed code, and their progress follows them to any device. Nobody has to sign in to play.

## How it works

- **The device copy comes first.** The app always plays from IndexedDB. The cloud holds one row per learner (`public.progress`), and sync merges it with the device copy in both directions (`src/progress/sync.ts`).
- **Merging never loses progress** (`src/progress/merge.ts`): best stars per level, the streak that reached the later day, rematches from both devices, today's riddle as solved if either device solved it, and the newer unfinished game against Bapu (unless either device has finished it). XP is kept per device (`profile.xpBy`), so adding two devices together never counts the same XP twice.
- **When it syncs:** after signing in, when the app opens, about 2 seconds after any save, when the connection comes back, and when the app comes back to the screen (at most once a minute). Offline, nothing happens and the next sync catches up.
- **Two devices saving at once:** every write bumps `rev`, and an update only applies to the `rev` it read. The loser of the race reads again, merges again and retries.
- **Security:** row-level security limits each signed-in learner to their own row. The `anon` role has no access to the table. The publishable key in `.env` is meant to be public.
- **Loading:** Supabase's JavaScript (about 50 KB gzipped) is a separate chunk. It's only fetched once someone opens the sign-in page, or on a device that has signed in before.
- Sound settings and `?unlock=all` stay per device.

Turning it off: with no `VITE_SUPABASE_URL` / `VITE_SUPABASE_KEY` (a fork, say), every sign-in entry point disappears.

## Setting up a project

ApeChess's own project is `oaqurazkmbpcwnlkpnvw` (Mumbai, free plan). These steps are for a new one, e.g. a fork.

1. **Create a project** at [supabase.com](https://supabase.com/dashboard) (the free plan is fine). Pick a region near your learners, e.g. Mumbai (`ap-south-1`) for Nepal.
2. **Create the table:** run `supabase/migrations/*_progress.sql` in the dashboard's SQL editor, or `supabase link --project-ref <ref>` and then `supabase db push`.
3. **Auth → URL configuration:** set the Site URL to `https://binamraaa.github.io/ApeChess/`. Add the redirect URLs `https://binamraaa.github.io/ApeChess/**` and `http://localhost:5173/**`.
4. **Keys:** put the project URL and the **publishable** key (never the secret or `service_role` key) in `.env`:

   ```
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_KEY=sb_publishable_...
   ```

   `.env` is committed, so the GitHub Pages build picks it up.

### Email: codes need your own sender

The app signs in with a 6-digit code typed into the app. Codes work in an installed app, where links don't: on iPhones, an emailed link opens Safari, not the installed app. Two Supabase free-plan limits matter here:

- the built-in email sender only sends **2 emails an hour** for the whole project;
- on free projects created after June 2026, the email templates **can't be changed** unless you use your own sender. The default template sends only a link, with no code.

So, before real learners use it:

1. **Make a free [Resend](https://resend.com) account** (3,000 emails a month), or use any SMTP service. Verify a domain you own; without one, Resend only delivers to your own address.
2. **Auth → Emails → SMTP settings:** enter Resend's SMTP details (host `smtp.resend.com`, port 465, user `resend`, and your API key as the password). Set the sender to something like `bapu@yourdomain`.
3. **Auth → Emails → Magic link template:** paste `supabase/templates/magic-link.html`. Its subject is "Your ApeChess sign-in code".
4. **Auth → Rate limits:** raise the email limit, e.g. to 30 an hour.

Until then, sign-in still works through the emailed link, opened on the same device and browser that asked for it. That's fine for testing.

## Things to know

- **Free projects pause after a week with no activity.** Any sign-in or sync counts as activity. A paused project wakes up from the dashboard, and the app keeps working offline in the meantime.
- **Deleting:** "Delete my cloud copy" removes the learner's row. Deleting the login itself (the email address) is done in the dashboard under Authentication → Users, for now.
- **Children:** the school edition shouldn't ask children for an email address. Plan teacher accounts with class codes instead, and check consent rules (Nepal's Privacy Act 2075, plus COPPA/GDPR-K for learners abroad) before collecting anything from minors.
