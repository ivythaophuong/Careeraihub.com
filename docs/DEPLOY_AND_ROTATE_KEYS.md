# Go-live and key rotation checklist

Why this exists: before the proxy change, the provider keys on your server were copied into the
JavaScript the website served, so **every visitor could read them** (open DevTools → Sources).
The repo's git history was scanned and contains no real keys (only placeholders), so the exposure
is whatever was set in the VPS `.env`. Treat those keys as compromised and replace them.

Do the steps in order. The order is chosen so the site never goes down: new keys are live before
old ones are revoked.

## 0. Revoke the GitHub token used for the cleanup PRs
- GitHub → Settings → Developer settings → Fine-grained tokens → `claude-jobkicker` → **Delete**.
- On your Mac: `rm ~/.jobkicker-token`

## 1. Merge the PRs (in this order)
`#1` → `#2` (retarget to `main`) → `#3` (retarget to `main`) → `#4` (retarget to `main`).
Each PR's base is the previous branch; after merging one, change the next one's base to `main`
(PR page → Edit next to the title).

## 2. Create NEW keys (do not delete the old ones yet)
| Service | Where | Notes |
|---|---|---|
| Anthropic | console.anthropic.com → API keys → Create key | Name it `careeraihub-prod-edge`. |
| OpenAI (only if you use it) | platform.openai.com/api-keys → Create | Project-scoped key if possible. |
| Gemini (only if you use it) | aistudio.google.com/app/apikey (or Google Cloud → Credentials) | Restrict to the Generative Language API. |
| Adzuna | developer.adzuna.com dashboard | If it can't issue a second key, regenerate in step 6 and update the secret right after. |

Paste each new key only into the `supabase secrets set` command below. Never into chat, email, git or a `.env` that gets committed.

## 3. Deploy the functions with the new keys
```bash
# one time
brew install supabase/tap/supabase        # or see supabase.com/docs/guides/cli
supabase login
supabase link --project-ref <your-project-ref>

supabase secrets set \
  AI_PROVIDER=anthropic AI_MODEL=claude-sonnet-5-5 ANTHROPIC_API_KEY=<new-anthropic-key> \
  ADZUNA_APP_ID=<id> ADZUNA_APP_KEY=<new-key> \
  ALLOWED_ORIGINS=https://careeraihub.com,https://www.careeraihub.com
# optional: GEMINI_API_KEY=<new> OPENAI_API_KEY=<new>

supabase functions deploy ai
supabase functions deploy jobs
```
`<your-project-ref>` is the part before `.supabase.co` in your Supabase URL.

## 4. Verify the functions before touching the website
Replace `<ref>` and `<anon>` (your public anon key, which is in the app's source anyway).

```bash
# a) Not signed in must be rejected (expect 401)
curl -i -X POST "https://<ref>.supabase.co/functions/v1/ai" \
  -H "apikey: <anon>" -H "Authorization: Bearer <anon>" -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"hi"}]}'

# b) Job search works for guests (expect 200 and a "jobs" array)
curl -i -X POST "https://<ref>.supabase.co/functions/v1/jobs" \
  -H "apikey: <anon>" -H "Authorization: Bearer <anon>" -H "Content-Type: application/json" \
  -d '{"what":"Product Manager","where":"Singapore"}'
```
If (a) returns 200 instead of 401, **stop and tell me**: it means the login check isn't working.

Then, in the app: sign in and run a resume scan with a PDF. It should complete normally.
Check the function logs (Supabase dashboard → Edge Functions → ai → Logs) for errors.

## 5. Rebuild and redeploy the website
On the VPS:
```bash
git pull
docker compose up -d --build
```
Then open the live site → DevTools → Sources → search the JavaScript for `sk-ant`, `AIza`, and
`api.anthropic.com`. There should be **no matches**. (Hard-refresh first: Ctrl/Cmd+Shift+R.)

## 6. Revoke the OLD keys
Only after steps 3–5 pass.
1. In each provider's usage dashboard, look at the last weeks for traffic you don't recognise
   (spikes, odd hours, models you never use). If you see any, tell me and keep a note of the dates.
2. Delete/revoke the old Anthropic, OpenAI, Gemini keys. Delete the VPS `.env` entries for them.
3. Rotate Adzuna if you couldn't earlier, and `supabase secrets set` the new values.

## 7. Spend limits (the real cost backstop)
The functions' rate limits are per server instance, so set hard limits at each provider:
- **Anthropic:** Console → Settings → Limits → set a monthly spend limit.
- **OpenAI:** Settings → Billing → Limits → monthly budget / hard cap.
- **Gemini:** Google Cloud Console → Billing → Budgets & alerts (alerts only), and quotas on the
  Generative Language API for a hard cap.
Pick an amount you'd be comfortable losing in a bad day.

## 8. Check your database security (I couldn't verify this from the repo)
Supabase dashboard → SQL Editor → run:
```sql
select tablename, rowsecurity from pg_tables where schemaname = 'public' order by 1;
select tablename, policyname, cmd, qual, with_check from pg_policies where schemaname = 'public' order by 1;
```
Every table (`user_memory`, `resume_scans`, `applications`, `star_stories`, `cover_letters`,
`jd_analyses`, `mock_sessions`, `negotiation_practice`, `insights`) should show
`rowsecurity = true` and policies that compare `auth.uid() = user_id`. Send me the output if
anything is `false` or has no policy: with RLS off, the public anon key in the app would let anyone
read everyone's data.

Also confirm the `service_role` key (Supabase → Settings → API) was never placed in the app or `.env`
files used by the website. It must stay only in Supabase.

## 9. Optional cleanup
- Branches `SEO-optimization` and `flow-optimization` still contain an old `.env.production`
  (placeholders only, no real keys). Safe to delete those branches if they're finished.
- Add `supabase/.env.local` to `.gitignore` if you run functions locally.
