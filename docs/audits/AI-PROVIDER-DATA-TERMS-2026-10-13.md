# What the two AI providers say about the content we send them (free tiers)

Status: **read-only research, 2026-10-13. Not legal advice.** Read from the providers' public pages by fetching them (the page text was summarised by a fetch tool, so the quoted sentences must be re-checked on the live pages before any Privacy wording relies on them). Written for the product owner. Labels: VERIFIED (read on the page today) · UNKNOWN.

## Why it matters

Everything a user types into CareerAiHub's AI features reaches the providers through the `ai` and `score-*` functions: resume text (ATS parse, scan, cover letter, salary script, onboarding), interview answers, STAR stories, the coach chat. The live chain is Gemini first, Groq as fallback, both on free tiers (owner, 2026-10-13). Decision D-3 (option C) means CareerAiHub does not store the original answer, but the provider side is separate.

## Google, Gemini API (https://ai.google.dev/gemini-api/terms)

- **Unpaid Services** (the free tier): "Google uses the content you submit to the Services and any generated responses to provide, improve, and develop Google products and services"; "Human reviewers may read, annotate, and process your API input and output. Google takes steps to protect your privacy as part of this process"; the data is disconnected from the Google Account, API key and Cloud project before reviewers see it.
- **Paid Services**: Google "doesn't use your prompts ... or responses to improve our products"; prompts and responses are logged for a limited period only to detect and prevent violations of the Prohibited Use Policy; data may be stored transiently or cached in any country where Google or its agents have facilities.
- Consequence: **on the free tier, users' resumes and interview answers sent to Gemini may be used to improve Google products and may be read by human reviewers.** Disconnection from the account does not remove personal content that the text itself contains (names, employers, contact details inside a resume).

## Groq (https://console.groq.com/docs/your-data and the privacy policy)

- The Groq privacy policy states it does not cover customer API data; that is governed by the Groq Services Agreement and Data Processing Addendum (**not read**: UNKNOWN).
- The "Your Data" page: "By default, Groq does not retain customer data for inference requests"; data is retained only for features that need persistence (batch, fine-tuning) or for troubleshooting and abuse investigation, limited to 30 days; "All customers may enable Zero Data Retention (ZDR) in Data Controls settings". The page does not mention using customer data for model training and does not distinguish plans (the page text alone does not prove the free tier is treated the same: UNKNOWN until the Services Agreement is read).

### Groq Services Agreement, read 2026-10-13 (https://console.groq.com/docs/legal/services-agreement, via the same fetch tool: re-check wording on the live page)

- Section 4.2 (Inputs and Outputs): Groq "is not permitted to use Inputs or Outputs for training or fine-tuning any AI Model Services or other models, unless explicitly granted permission or instructed by Customer", and "does not access, use, store, or retain Inputs or Outputs except as necessary to provide the Cloud Services, ... comply with applicable law, ensure the reliable operation of the Cloud Services, or confirm Customer's compliance with the AUP". A zero data retention setting can restrict this further.
- No human-review clause was found. No provision was found that treats free or developer accounts differently from paid ones (not proof that none exists elsewhere, e.g. in the DPA, which was not read).
- So, on the text read: **Groq's terms are the stronger ones for personal text; Gemini's free-tier terms are the weaker.** This supports option B. The Data Processing Addendum remains unread.

## What follows (PROPOSED options, owner decides; nothing changed)

| Option | Effect | Cost or risk |
|---|---|---|
| A. Keep Gemini free first, disclose it | Honest privacy page: "AI providers may process your text; the free tier of one provider may use it to improve its products and have it reviewed by people" | Users may not accept it for resumes; weakens the Privacy-by-default direction chosen in D-3 |
| B. Make Groq the first provider and Gemini the fallback, or drop Gemini for personal text | Personal text goes first to the provider that, by default, does not retain it | Groq free-tier quota carries all traffic (already seen in the logs: Gemini 503 and Groq answering); Groq's own agreement still to read; model quality changes (needs the evaluation protocol before switching) |
| C. Put Gemini on a paid plan | Google states paid content is not used to improve products | Introduces money exposure; requires a hard spending cap and per-user limits first (R1 proposal M3, M6); a paid plan does not remove abuse risk |
| D. Do not send the most sensitive fields (names, contact details) to any provider | Smaller exposure whatever the provider | Needs deterministic redaction before the call; a real engineering item, not done |

The practical minimum before the Privacy page is written: Ivy reads the Groq Services Agreement and Data Processing Addendum, and chooses between A to D. The Privacy and Terms pages must then say exactly what happens, in plain words. "CareerAiHub does not store your original interview answers" is true under D-3; "no one else uses your data" is **not** established and must not be written.

This affects every AI feature, not only Mock Interview, so it is a platform decision (an ADR candidate), not part of the Mock Interview plan's scope.
