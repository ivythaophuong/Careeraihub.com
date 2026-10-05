# CareerAiHub platform contracts (v1.1, amended 2026-10-05)

Four short contracts that every feature must follow, so features connect through one set of facts instead of each
inventing its own. **Change a contract here before changing code that depends on it.**
They make the rules in `CLAUDE.md` concrete and sit between Phase 0 (integrity, done) and Phase 1 (Career Profile and the
Evidence layer).

**Frozen on 2026-10-05 by the owner (v1.0).** Changes are made by amending this file first, with a version bump and a note of what changed and why.

**Changelog**
- **v1.1 (2026-10-05):** candidates can **withdraw** evidence (`withdrawn_at`; not a delete, not a revocation; only active evidence can feed trust). **Retention:** normalised verification data is kept; `raw_credential` is kept only while needed and then purged; identity evidence stores the proof, not the document. Deleting an account removes everything, including the append-only audit rows. Nothing below is implemented unless marked **(now)**. A contract only counts when something enforces it: database
constraints, row-level security, server-only writes, versioned scores, the evidence state machine, and tests (see
"Enforcement" at the end).

## Two paths that must never merge

```
Resume scan / Interview / STAR / practice  ──►  PRACTICE SCORE          (AI-graded practice, unverified)

User claim ─► EVIDENCE ─► VERIFICATION ─► VERIFIED EVIDENCE ─► TRUST POLICY ─► VERIFIED TRUST
```

A single "Trust Score" must not blend them. Neither is a "Career OS score".

---

## 1. Score contract

**A score is `f(evidence, target, scoring_version)`.** The same evidence, the same target and the same version give the
same score for deterministic scores. **Unknown is `null`, never `0`.** `0` means "measured, and it was zero"; `null` means
"not enough evidence to measure". Absence must not become weakness (no interview ≠ 0, no STAR story ≠ 0, no credential ≠ 0).

### Fields every stored score carries
`score` · `score_type` · `score_version` (also called `calculation_version`) · `score_source` · `evidence_ids` ·
`target_id` · `components` · `calculated_at` · `input_hash`

Example: `score = 78, score_type = PRACTICE, score_version = practice-v1, score_source = mock_sessions,
evidence_ids = [...], target_id = <target role>, calculated_at = ...`

### Score types (never used in place of each other)
`AI_ESTIMATE` · `PRACTICE_SCORE` · `VERIFIED_TRUST` · `MATCH_SCORE` · `READINESS_SCORE`

### Reproducibility
`evidence_ids` says *which* evidence was used, not *in what state*. So a score also stores an **`input_hash`**: a hash of
the canonicalised inputs (the evidence **versions** used, the target version, and the scoring version). Evidence records
that feed a score are **immutable versions** (see the evidence contract): an edit creates a new version, it never changes the
old one. Two consequences: recomputing the same `input_hash` must give the same score, and "why was this 78 in October and
64 in December?" is answerable by comparing the two hashes and the evidence versions behind them.

### Canonical vocabulary (no free text)
`score_type` is exactly one of: `AI_ESTIMATE`, `PRACTICE_SCORE`, `VERIFIED_TRUST`, `MATCH_SCORE`, `READINESS_SCORE`
(upper snake case; not `practice`, `practiceScore`, `PRACTICE`). `score_source` is `module:vN` from a registry, e.g.
`resume_scan:v1`, `mock_interview:v1`, `star_session:v1`, `jd_match:v1`, `trust_engine:v1`, `job_match:v1`,
`readiness:v1`. The registry lives in one place (a table with a foreign key, or a constants file with a database `CHECK`),
so a new module must register before it can write a score.

### Rules
1. Integers 0–100. Missing is `null`; the UI says "Not enough evidence yet" and offers the action that creates it.
2. Changing a formula creates a **new version**; old results keep theirs.
3. Scores are written **only by the server** (database trigger or function), never accepted from the browser.
4. The UI states the score type: "AI estimate", "Practice score", or "Verified trust".
5. AI-graded scores record the rubric and model version. They are opinions, not measurements.
6. Pitch material and the white paper use these names too: no "Career OS Score", and no "Trust Score" for practice data.

### Score registry
| Name (UI) | Type | Stored as | Source | Formula | Written by |
|---|---|---|---|---|---|
| **Practice score** (now) | `PRACTICE_SCORE` | `candidate_trust_profiles.trust_score` (renamed in Phase 1) | AI-graded resume scans, interview answers, STAR stories | v0: `0.40·best scan + 0.35·avg last 5 interview + 0.25·avg last 5 STAR` | DB trigger `recompute_trust_score` |
| Resume estimate | `AI_ESTIMATE` | `resume_scans.credibility_score` | `ai` function | model output | browser (known gap) |
| JD match estimate | `AI_ESTIMATE` | `jd_analyses.match_score` | `ai` function | model output | browser |
| Interview answer | `AI_ESTIMATE` | `mock_sessions.avg_score` | `ai` function | model output | browser |
| STAR story | `AI_ESTIMATE` | `star_stories.score` | `ai` function | model output | browser |
| Readiness (screen) | `READINESS_SCORE` | none (relabelled latest scan) | `resume_scans` | none | computed in the UI |
| **Verified trust** (future) | `VERIFIED_TRUST` | `trust_v1` from `evidence` | trust-eligible evidence only | Phase 2, versioned | server |

Known v0 issues (fixed in Phase 2): the resume term uses the **best** scan of all time instead of the latest; a missing
interview/STAR history counts as `0` instead of `null`; the AI inputs are sent by the browser.

### Rename `trust_score` → `practice_score` is a semantic migration (Phase 1)
Rename it everywhere in one change, or the UI will say one thing and the API another: database column, API payloads,
TypeScript types, hooks, UI labels, Dashboard, Roadmap, employer ranking, documentation, tests, analytics events.

---

## 2. Evidence contract

**Three concepts, never mixed.**
```
CLAIM              what the candidate says            "I graduated from NUS"
   ↓
EVIDENCE ARTIFACT  something that supports the claim  an OpenCerts file, a certificate link, an uploaded PDF
   ↓
VERIFICATION RESULT what a verification attempt found  "document valid, issuer trusted, recipient not confirmed"
```
A claim alone is not evidence. An artifact alone is not verified. Only a verification result, produced server-side and
passed through the trust policy, can make evidence trust-eligible.

In the first migration the `evidence` table holds the **claim and its artifact references**; **verification results are not
columns on it**: they live in the append-only `verification_attempts` table below, and the evidence row keeps only a summary
(`verification_status`, `trust_status`) derived from the latest attempt and the policy. If the storage later splits into
separate `claims` and `artifacts` tables, the semantics here do not change. A credential is one kind of evidence; so are
education, experience, projects and skills.

### Table `evidence` (proposed)
| Column | Notes |
|---|---|
| `id`, `candidate_id` | owner |
| `version`, `supersedes_id` | evidence is immutable: an edit creates a new version that supersedes the old one |
| `withdrawn_at` | the candidate stopped using this claim. `WITHDRAWN ≠ REVOKED`: withdrawn means the candidate no longer wants it used; revoked means the issuer or verification no longer vouches for it. Withdrawing never alters history, cannot be undone, and clears trust eligibility. Only **active** evidence (latest version, not withdrawn) can feed a trust calculation. |
| `raw_purged_at` | when `raw_credential` was purged under the retention rule below |
| `type` | `identity`, `education`, `certification`, `experience`, `project`, `skill`, `achievement` |
| `claim` | what is claimed (title, issuer as stated) |
| `source_type` | `user_claim`, `user_upload`, `platform_url`, `signed_credential`, `issuer_api`, `employer_attestation` |
| `source_url`, `source_provider` | where it lives; the issuer or platform (domain or DID) |
| `verification_status` | `UNVERIFIED`, `PENDING`, `VERIFIED`, `FAILED`, `REVOKED`, `EXPIRED` |
| `trust_status` | `NOT_ELIGIBLE`, `ELIGIBLE` (a separate layer: see below) |
| `verification_method` | `none`, `platform_page`, `opencerts`, `open_badges`, `issuer_api`, `manual_review` |
| `confidence` | `LOW`, `MEDIUM`, `HIGH` |
| `checks` (jsonb) | summary of the latest verification attempt: `issuer_trusted`, `credential_valid`, `signature_valid`, `revocation_checked`, `recipient_binding_verified`, `source_reachable`, `expiration_valid`, `schema_valid` (each true / false / null). Full history is in `verification_attempts`. |
| `subject_id`, `subject_binding` | who the credential names; how it was tied to the candidate: `none`, `email_verified`, `did_proof`, `profile_name_hint` |
| `raw_credential` (jsonb) | the signed document as received |
| `valid_from`, `valid_until`, `status_url` | validity window; revocation-list address |
| `created_by`, `verified_by` | the candidate / the verification service. Never the same actor for both. |
| `created_at`, `updated_at`, `verified_at` | |

### Retention
- **Normalised verification data is kept** (issuer, credential id, result, adapter and policy versions, timestamps, each check, the recipient-binding result). It is what audit and reproducibility need.
- **`raw_credential` and an attempt's `raw_result` are short-lived.** Keep them only while verification or audit needs them, then purge (set to NULL). The purge is a server action; the claim, the attempt rows and the checks stay.
- **Identity documents: store the proof of verification, not the document.** `identity` evidence never holds a raw document; keep the provider's reference and the result.
- The retention *period* is not fixed here. It becomes its own contract before Phase 4B, after legal review.
- **Erasure:** deleting an account deletes its evidence (every version), requests, consents and audit rows. The append-only rule applies to normal operation, not to erasure.

### Verification attempts (audit trail)
Every run of a verification adapter writes one **append-only** row to `verification_attempts`; rows are never updated or
deleted.

| Column | Notes |
|---|---|
| `id`, `evidence_id`, `evidence_version` | which evidence, in which version |
| `verification_request_id` | the request that triggered it (candidate-initiated, or a scheduled re-check) |
| `provider`, `adapter_version` | which adapter ran, and which version of it |
| `policy_version` | the trust policy and trusted-issuer list version applied |
| `started_at`, `finished_at` | |
| `outcome` | `VERIFIED`, `FAILED`, `REVOKED`, `EXPIRED`, `ERROR` |
| `previous_status`, `new_status` | the evidence state before and after, so the history reads as a chain |
| `checks` (jsonb) | the normalised flags from this attempt |
| `raw_result` (jsonb), `error` | what the provider returned; what went wrong |

This answers "why is this credential no longer trusted?" as a trace: source → adapter → checks → policy version → result →
timestamp, e.g. `2026-10-05 VERIFIED` then `2027-03-10 REVOKED (status list checked by opencerts:v1, policy v1)`.
`verified_at` on the evidence row is the finish time of the attempt that produced the current state.

### Who may change state
| Transition | Who |
|---|---|
| (new) → `UNVERIFIED` (self-reported) or → `PENDING` (asks for verification) | the candidate, through the API |
| `PENDING` → `VERIFIED` / `FAILED` | the verification service only |
| `VERIFIED` → `REVOKED` / `EXPIRED` | the verification service only (re-check job) |
| `trust_status` | the policy engine only |
| withdraw (set `withdrawn_at`, once) | the candidate; nothing else on the row may be changed by a browser |
| purge `raw_credential` / attempt `raw_result` | the server, under the retention rule |

The browser never sends `status`, `verified`, `confidence`, `checks`, `trust_status`, a score, or a bonus.

### Verified is not trust-eligible
**`VALID CREDENTIAL ≠ VERIFIED CANDIDATE EVIDENCE`.** Verification and trust eligibility are two layers.
Example: signature valid, credential valid, issuer trusted, but `recipient_binding_verified = false` →
`verification_status = VERIFIED`, `trust_status = NOT_ELIGIBLE`, trust contribution `0`. The UI says "Authentic credential ·
ownership not confirmed". A matching name is not enough; a verified email, or proof of control of the subject's DID/URL, is.

`trust_status = ELIGIBLE` requires all of: valid proof (or an official issuer API), issuer active in `trusted_issuers`, not
revoked, inside its validity window, **and** recipient binding verified.

### What each state means to the user
`UNVERIFIED` has value and is shown ("Self-reported · Not verified") but adds **0** to Trust. `platform_page` verification
can never reach `HIGH` confidence: a web page showing a certificate is not a cryptographic proof.

### Trusted issuers are a versioned policy
Table `trusted_issuers`: `issuer_id`, `issuer_name`, `issuer_type` (university, polytechnic, professional body, employer,
international institution, ...), `verification_method`, `allowed_domains`, `status` (`ACTIVE`, `SUSPENDED`),
`effective_from`, `effective_until`, `policy_version`, `added_by`, `notes`. Edited by admins only, with an audit trail.
A Singapore university is not trusted automatically: trust is CareerAiHub's policy. The verification engine reads this table,
so new categories are added as rows, not code. A valid signature from an issuer not listed leaves the evidence at
`NOT_ELIGIBLE` with the reason recorded.

### Mapping from Open Badges 3.0 / W3C Verifiable Credentials
`issuer.id` → `source_provider` · `credentialSubject.id` → `subject_id` · `achievement.name` → `claim` · `evidence[]`
(supporting artifacts) → `metadata.supporting` · `validFrom/validUntil` → `valid_from/valid_until` ·
`credentialStatus.id` → `status_url` · `proof` → `verification_method` + `checks.signature_valid` · the JSON →
`raw_credential`. In Open Badges "Evidence" means artifacts attached to a credential, not our whole table.

### Migration from today
Credentials live in the `user_memory` blob (VerifyCreds). They become `evidence` rows: link-only entries `UNVERIFIED`; the
`verified` flag the browser computes today is **ignored**.

---

## 3. Data ownership contract

**One entity, one owner, one authoritative write path.** The same fact must not live in `user_memory`, a profile table, a
scan row and an evidence row for an AI to choose between.

| Concept | Is | Owner / writer |
|---|---|---|
| Career profile | the candidate's canonical career identity | candidate |
| Evidence | proof of claims | claim fields: candidate. `verification_*`, `checks`, `trust_status`: server |
| Resume version | a representation of the profile for one application | candidate |
| Target | what the candidate is trying to achieve (role, market, JD) | candidate |
| Practice session | performance evidence | candidate's session, scored by the server |
| Score | derived output | server only |
| Consent | permission to share, see below | candidate |
| Employer, `employers.verified_at` | employer creates; **admin** verifies | admin for `verified_at` |
| Job listings | verified employer | public only if the employer is verified |
| Matches, pipeline | verified employer, for a candidate who consented | candidate may change status only |
| Trusted issuers | admin | read by the verification service |

### Rules
1. **Server-only columns** (scores, verification fields, `trust_status`, `verified_at`, match parties) cannot be written
   from the browser, enforced in the database (see `docs/database/`).
2. Every table has Row Level Security. Each policy change needs the actor × table test matrix (candidate A, candidate B,
   unverified employer, verified employer, anonymous) in `docs/database/replica-test`.
3. **Migration lifecycle for `user_memory`**: 1A read compatibility → 1B dual-read through an adapter → 1C new tables are
   authoritative → 1D `user_memory` read-only → delete. Never delete just because the new schema exists; delete only after a
   backup and the owner's approval. **No indefinite dual-writing**: each step has an end date, or in six months nobody knows
   which copy is true.
4. Privacy: minimum data; logs carry no personal data; an employer never sees a candidate's email or raw uploads without consent.

### Consent (consent-first from Phase 1; default `PRIVATE`)
```
Evidence → candidate ownership → verification → sharing permission → employer
```
A consent record holds **who** (grantee), **what** (which evidence / profile parts), **purpose**, **granted_at**,
**expires_at**, **revoked_at**: not a single `consent = true`. Default is `PRIVATE`; the candidate explicitly shares. Legal
review happens before Phase 4B, but this data model exists from Phase 1.

---

## 4. Verification contract

**Every verification source is an adapter behind one interface. The engine never knows a provider's internals.**

```
input  : evidence_id
adapter: VerificationProvider  (OpenCertsAdapter, CredlyAdapter, BadgrAdapter, FutureUniversityAdapter, ...)
output : normalised result
           issuer_trusted · credential_valid · signature_valid · revocation_checked
           recipient_binding_verified · source_reachable · expiration_valid · schema_valid
           (each true / false / null) + method + issuer + subject_id + valid_until + status_url + raw
then   : policy engine → evidence state (verification_status, trust_status, confidence)
```
Never a single `verified = true`: it does not say why.

### Adapters, in order
1. `platform_page` (**now**, `verify-cert`): an allowlisted platform page matched. Ceiling `LOW`/`MEDIUM`.
2. **`opencerts` first**: OpenAttestation: document hash, issuer identity by DNS TXT, document-store issue/revoke state. `HIGH`.
   It solves the problem the platform needs (issuer, credential, recipient, signature, revocation) and forces the evidence
   abstraction to be right before other sources, which then plug in as adapters.
3. `open_badges`: VC-JWT first (simpler), then Data Integrity proofs (needs JSON-LD canonicalisation).
4. `issuer_api`: official public endpoints (e.g. Credly, Accredible) where they exist, each checked per platform.

### Steps every adapter runs (from Open Badges 3.0)
parse → validate structure → check validity window → resolve the issuer → verify the proof → check revocation status →
check the issuer is trusted → check the subject is bound. Record each result in `checks`.

### Safety rules (P0 security rule)
1. **Never `fetch(user_supplied_url)`.** For every URL the system fetches, including URLs inside a credential (issuer, keys,
   status list, `@context`, images): parse → protocol allowlist (https) → hostname allowlist → DNS/IP safety (reject
   private, loopback and link-local addresses, and check the resolved address, not only the name) → fetch with redirects
   handled manually → **validate every redirect target the same way** → time and size limits. Bundle the standard JSON-LD
   contexts locally; do not fetch them at verification time.
2. No evasion of bot protection, no stealth browsers, no LinkedIn scraping. A LinkedIn URL is stored as an unverified,
   informational link.
3. Never hardcode integrity or authenticity as true for a scraped page.
4. Name similarity is only a hint (`profile_name_hint`), never a binding.
5. Status checks are cached at most 24 hours; a re-check job moves evidence to `REVOKED` or `EXPIRED`.
6. Per-user rate limit. Failures say why, in words the user can act on.

### Infrastructure
MVP: an Edge Function, or a small Node service on the VPS for OpenCerts. The candidate request creates `PENDING` and the UI
polls. No queue, Redis or browser cluster until real volume needs it.

---

## Capability status (as of 2026-10-05; for the white paper and pitch)
Use these four labels, and only describe a capability as LIVE if it works end to end today.

| Capability | Status |
|---|---|
| Resume AI, ATS-style analysis (AI estimate), interview AI, STAR builder, cover letter, JD analyzer | **LIVE** (AI-based, scores are estimates) |
| Salary coaching | **PARTIAL** |
| Practice score (from practice activity) | **LIVE** |
| Credential link checking (`verify-cert`, a few platforms) | **PARTIAL / BETA**: page-level only, no ownership proof |
| Credly badge check | **PARTIAL**: runs in the browser, can be tampered with |
| Verified Trust, Evidence layer, trusted-issuer policy | **DESIGNED** (Phase 1–2) |
| OpenCerts verification, Open Badges verification | **ROADMAP** (Phase 1.5) |
| Singpass/MyInfo, blockchain anchoring | **ROADMAP** |
| TrustMatch (candidate side) | **PARTIAL**: UI and visibility settings; no matching engine; no jobs until verified employers post |
| Employer marketplace / portal | **ROADMAP**: pipeline, inbox, analytics are sample screens |
| Job search (live listings) | **PARTIAL**: board links only; live listings need Adzuna keys |

Privacy wording until counsel confirms: "designed with Singapore PDPA requirements in mind" or "privacy architecture designed to
support Singapore PDPA obligations". Do not claim "PDPA compliant".

---

## Enforcement (what turns this document into a contract)
| Contract | Enforced by |
|---|---|
| Server-only writes | column-locking triggers, RLS, no browser write path (**now** for scores, employer verification, match parties) |
| Evidence state machine | database constraint on allowed transitions + a trigger that blocks browser-set `verification_*` |
| Versioned, reproducible scores | `score_version`, `calculated_at`, `evidence_ids`, `input_hash` columns; fixed `score_type`/`score_source` enums or foreign keys; tests that the same `input_hash` gives the same score |
| Immutable evidence, audit trail | no `UPDATE` or `DELETE` privilege on evidence versions and `verification_attempts` for browser roles; a trigger blocks changes to old versions |
| Ownership and consent | RLS actor × table matrix test on every policy change |
| No sample data / honest labels | `src/noFakeTrustClaims.test.js` (**now**) extended to the new labels |
| Verification safety | handler tests for allowlist, redirects, size/time limits (**now** for `verify-cert`); same suite for each new adapter |
| Migration lifecycle | a dated step list for each phase in `docs/database/`, reviewed before each step |

## Decisions (resolved 2026-10-05; reviewer additions merged for v1.0)
1. A valid credential without confirmed recipient binding does **not** count toward Trust (`VALID CREDENTIAL ≠ VERIFIED CANDIDATE EVIDENCE`).
2. `trust_score` → `practice_score` in Phase 1, as a **semantic** migration across database, API, types, hooks, UI, employer ranking, docs, tests, analytics.
3. Trusted issuers: OpenCerts plus a few Singapore institutions, **via the `trusted_issuers` policy table**, not a hardcoded list.
4. OpenCerts before a server-side Credly check; Credly becomes an adapter later.
5. Consent-first, default `PRIVATE`; legal review before Phase 4B; the consent data model is prepared in Phase 1.
6. Scores are reproducible through `input_hash` plus immutable evidence versions.
7. `score_type` and `score_source` are fixed vocabularies, not free text.
8. Claim, evidence artifact and verification result are distinct; verification results live in append-only `verification_attempts`.
9. Phase 1 builds foundations only (`career_profiles`, `evidence`, `trusted_issuers`, `verification_requests` and `verification_attempts`, `consents`). No Verified Trust score is created until evidence, verification, issuer policy, recipient binding and consent all exist.

## Order of work
GitHub security review (1b) → P0-5a scores locked (done) → `verify-cert` hardened (done) → **freeze these contracts** →
Phase 1A Career Profile schema → 1B Evidence schema → 1C verification requests → 1D `trusted_issuers` → OpenCerts adapter →
Evidence UI → `practice_score` migration → Phase 2 Verified Trust engine. No migration is applied to production before the
owner approves it.

Design order for the Phase 1 migration (never reversed): contracts v1.0 → entity ownership → state machine → RLS matrix →
schema → constraints → triggers and functions → migration → test database → migration tests → human approval → production.
Written from these contracts, not from the current schema patched step by step.
