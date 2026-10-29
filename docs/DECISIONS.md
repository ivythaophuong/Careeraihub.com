# Decisions

Only decisions with evidence in code, comments, docs or git history. Dates are commit dates. Where the reason is inferred, it says so.

## ADR-001: The browser never calls an AI provider; everything goes through the `ai` Edge Function
- **Evidence:** commit 60a2ef6 (2026-10-02) "call AI through Supabase Edge Functions, stop shipping API keys"; `src/lib/ai.jsx` header comment; `docs/DEPLOY_AND_ROTATE_KEYS.md` (the keys had been copied into the served JavaScript, so any visitor could read them); `tests/security/noSecretsInClient.test.js`.
- **Consequence:** the server picks the provider and model, so a client cannot choose an expensive one (`handler.js` comment).

## ADR-002: Sign-in is checked with the auth server, not the gateway
- **Evidence:** `authenticate()` comment in `ai/handler.js`: the gateway accepts the public anon key as a valid JWT, so the function asks `/auth/v1/user` who the caller is. `verify-cert` does the same.

## ADR-003: Scores must not be trusted from the browser
- **Evidence:** commit 9dcdf5b (2026-10-05) "data integrity and honest scores (Phase 0)"; `docs/database/README.md`: score columns locked, trigger `recompute_trust_score` writes them.
- **Open:** three input tables still take browser-sent scores (documented "Known gap").

## ADR-004: Employers see candidates only when verified
- **Evidence:** same SQL/README: `employers.verified_at`, set only by an admin in the SQL editor.

## ADR-005: `verify-cert` only fetches allowlisted platforms
- **Evidence:** commit 34b3a4d (2026-10-05); header of `verify-cert/handler.js` (exact hostname match, HTTPS, every redirect hop re-checked, time and size caps, sign-in required).

## ADR-006: A failed load must never lead to an overwrite of saved memory
- **Evidence:** `useMemory.js` comment on `critical` tables: if `user_memory` cannot be read, writing stays locked, because the next save would replace the user's data with an empty object. `updateMemory` merges patches for the same reason.

## ADR-007: Keyword matching and figure checks are done by code, not by the model
- **Evidence:** `resumeDigest.js` header and `checkKeywords` comment (the AI proposes, code decides; terms not in the JD are dropped); `factGuard.js` / `numberGuard.js` (figures not in the user's text become `[X]`).
- **Limit:** they do not detect ownership or scope inflation (stated in their own comments).

## ADR-008: Truncation is never silent
- **Evidence:** `resumeDigest.js` header and `describeCuts` ("was condensed … before the AI read it").

## ADR-009: Host port 8081 stays published on all interfaces
- **Evidence:** commit be2d818 (2026-10-02) and the comment in `docker-compose.yml`: Nginx Proxy Manager forwards to the server's public IP on 8081; changing it to `127.0.0.1` would take the site down unless NPM is re-pointed first.

## ADR-010: Database changes are applied by hand and recorded in `docs/database/`
- **Evidence:** `docs/database/README.md` ("The repo has no SQL migrations"). **This is a gap, not a design goal.** Reason for choosing it: UNKNOWN.

## Not yet decided (no evidence of a choice)
- Provider failover, per-task model choice, a prompt registry, observability tooling, cost limits.
