# Runbook: what to check and do when something breaks

For the owner/operator. Written 2026-10-15 from the repo only. Labels: **VERIFIED** (read in source, scripts or the docs named) · **PROPOSED** (a suggestion, not in place) · **UNKNOWN** (the repo cannot tell; check the dashboard or the VPS and write the answer here).
Nothing in this file was run against production.

## 1. What runs where (VERIFIED unless marked)

| Part | Where | Evidence |
|---|---|---|
| Website | Docker container `career-ai-hub` on the VPS, host port 8081 -> container port 80; Nginx Proxy Manager forwards careeraihub.com to it | `docker-compose.yml`, ADR-009 |
| Auth, database | Supabase project `ruibdsvrcctxgxctaxwe` (never the ZenDMS project `obtmsvhejvcfrkfyucev`) | `scripts/smoke-test.sh`, `docs/database/PRODUCTION_APPLY_PLAN.md` |
| Edge Functions | `ai`, `jobs`, `verify-cert`, `score-star`, `score-interview` (same Supabase project) | `supabase/functions/` |
| Provider keys and settings | Supabase function secrets (`supabase secrets set`), never in the browser or the image | `supabase/functions/ai/README.md`, ADR-001 |
| Function logs | Supabase dashboard -> Functions -> the function -> Logs | `supabase/functions/ai/README.md` |
| Usage lines | one `[usage] {json}` log line per provider attempt (counts and metadata only, no CV or answer text) | `supabase/functions/ai/README.md` |

## 2. First five minutes: is it the site, a function, or the database?

1. **Site:** open careeraihub.com. On the VPS: `docker ps` (is `career-ai-hub` running?) and `curl -I http://localhost:8081` (expect `200`).
2. **Functions:** `bash scripts/smoke-test.sh` (asks for a test account password; needs network). It exercises the deployed Edge Functions (see its header for what it covers).
3. **Auth/database:** try signing in. In the Supabase dashboard check the project status and the Postgres and API logs.
4. Decide with the table below, then follow the section.

| Symptom | Likely area | Go to |
|---|---|---|
| Page does not load, 502/504 from the proxy | container or proxy | 3 |
| Page loads, AI features fail | `ai` function or a provider | 4 |
| "Please sign in" for everyone | Supabase auth | 8 |
| Bill or usage jumps | abuse or a loop | 5 |
| A key was exposed | key leak | 6 |
| A user says saved data is missing | user_memory | 7 |

## 3. The site is down

- `docker ps -a`: is `career-ai-hub` stopped? `docker start career-ai-hub`, then `docker logs --tail 100 career-ai-hub`.
- **Do not change the published port** `8081:80` (or bind it to `127.0.0.1`): the proxy forwards to the server's public IP on 8081 and the site goes down (ADR-009).
- If the problem started with a new image, roll back by renaming (about 5 seconds), as in `docs/DEPLOY_MAIN_ROLLOUT.md` section 2:
  `docker stop career-ai-hub; docker rm career-ai-hub; docker rename <previous-container> career-ai-hub && docker start career-ai-hub`
  The previous container is renamed, never deleted, at swap time. Which previous containers exist now: UNKNOWN (check `docker ps -a`; `career-ai-hub-old` has unknown content, do not remove it).
- Proxy settings (Nginx Proxy Manager): UNKNOWN beyond what ADR-009 says.

## 4. AI features fail or are slow

- Read the error the user sees against `docs/FAILURE_MATRIX.md` (401 sign-in, 429 rate limit, 413 too large, 500 not configured or key rejected, 502 provider problem, 422 truncated or blocked reply).
- In the `ai` logs, find the `[usage]` lines of the time window and look at `provider`, `outcome`, `fallback` and `correlation_id`. The error response also carries a `requestId` the user can quote. `node scripts/usage-report.mjs <exported-log-file>` summarises requests, errors and answers by fallback per feature.
- **500 "not configured" or "misconfigured":** the provider key is missing or was rejected. Check which secrets exist with `supabase secrets list` (it shows names or digests, not values; `docs/architecture/EVIDENCE_PASS.md`). Never paste a key into chat or git.
- **Provider outage or rate limit:** the function tries the next keyed provider (`AI_FALLBACKS`, or every keyed provider) within one overall budget of 90 s (`AI_DEADLINE_MS` changes it; ignored below 5000). Score features do not fall back, on purpose. Which providers are keyed in production, and whether `AI_FALLBACKS` is set: **UNKNOWN**.
- To switch the main provider or model: `supabase secrets set AI_PROVIDER=... AI_MODEL=...` then redeploy as in `docs/DEPLOY_AND_ROTATE_KEYS.md` section 3. Whether a redeploy is needed after changing only a secret: UNKNOWN (that doc always redeploys).

## 5. Cost or usage jumps

- **There is no per-user quota or budget** for `ai` (ADR-012, finding R1). A usage ledger records each request in `ai_requests` (observe mode, `AI_LEDGER` secret) but refuses nothing until a policy row exists in `ai_policies` (`docs/database/README.md`). The limit is 20 requests per user per minute per function instance, and it is not global.
- Export the `ai` logs for the window and run `scripts/usage-report.mjs` to see which feature and how many users. `user_ref` in a usage line is an HMAC of the user id, not the id.
- Cost in the report comes from `PRICE_TABLE` in `supabase/functions/_shared/usage.js`: entries exist for OpenAI `gpt-6-luna` and Groq `openai/gpt-oss-120b` (prices read from the providers' pages on 2026-10-15). Any other model, a PDF call, or a Groq call that reports reasoning tokens shows `price unknown`. Re-read the prices before you rely on a figure.
- Fast stop, with side effects: unset or rotate the provider key (all AI features stop). A narrower stop does not exist in the code today.
- Provider-side spend caps and alerts: **UNKNOWN**; set them in each provider's console (**PROPOSED**).

## 6. A key may be exposed

Follow `docs/DEPLOY_AND_ROTATE_KEYS.md`: create the new key first, set it with `supabase secrets set`, deploy, verify (the curl checks in section 4 of that doc), and only then revoke the old key, so the site never goes down. Whether the keys from before the proxy change were ever rotated: **UNKNOWN**.

## 7. A user says saved data is missing

- A failed save shows the toast "Couldn't save your latest changes"; a failed load at login shows the restore-error state and keeps saving locked so nothing is overwritten (ADR-006, `src/hooks/useMemory.js`).
- Lists with a table of their own (scans, applications, STAR stories, cover letters, JD analyses, mock sessions, insights) are read from that table first. Fields kept only in the `user_memory` blob (for example `aiChat`, `credentials`, `resumeText`) depend on that row.
- Two open tabs: the backup write overwrites only the keys the tab changed, but two tabs that append to the same list can still lose entries, and the write is not atomic.
- Restore from a backup: **UNKNOWN**. Whether point-in-time recovery or daily backups exist on the Supabase plan is not written anywhere in the repo; check Dashboard -> Database -> Backups and record the answer here.
- There is no server-side history of earlier versions of `user_memory`.

## 8. Sign-in fails for everyone

- Check the Supabase project status and the auth logs in the dashboard. The `ai` function asks the auth server who the caller is (ADR-002), so an auth outage also makes AI calls fail with 401.
- An expired session refreshes silently, then reloads the page; if the refresh fails the user is signed out (`docs/FAILURE_MATRIX.md`).

## 9. A database change went wrong

- Only scripts listed in `docs/database/PRODUCTION_APPLY_PLAN.md` are meant for production, one at a time, with a check after each. The files in `docs/database/proposed/` and `phase1/` come with a `.down.sql` that undoes them. Which of them are applied in production: **UNKNOWN** from the repo; the plan and its notes are the record.
- Always confirm the project in the address bar before running SQL: it must contain `ruibdsvrcctxgxctaxwe`.

## 10. Not in place today

| Need | State |
|---|---|
| Alerts (error rate, cost, downtime) | none in the repo; Supabase or VPS side UNKNOWN |
| Uptime check from outside | UNKNOWN |
| Backups and recovery time | UNKNOWN |
| Who is told, and when | UNKNOWN (no on-call or contact list in the repo) |
| Service levels (targets) | none defined |
| Per-user AI budget | none (ADR-012 R1) |

**PROPOSED first alerts**, each answerable from data that already exists: the share of `[usage]` lines with an error outcome per feature; the number of 429 responses from `ai`; answers that came from a fallback provider; requests per user per hour; a failing `scripts/smoke-test.sh`.

When you answer an UNKNOWN above, edit this file in the same change, so it keeps describing what is true.
