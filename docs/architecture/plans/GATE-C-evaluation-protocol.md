# Gate C: evaluation protocol for the Structure Scores

Status: protocol for the owner's approval. Nothing here has been run. It turns Gate C of `ACCEPTANCE-deterministic-practice-scores.md` into steps.
The 50-story minimum is where a systematic evaluation can start, not a quality certificate. If the data show the scores are still compressed or biased, the score stays in beta or shadow mode (computed, stored nowhere, shown to nobody). The target is not a pretty score distribution.

## 1. Data and privacy (read first)

- Stories and answers used here may be personal. **Real texts must never be committed to this repository (it is public) or put in a test.** Keep them in a private folder outside the repo (for example `~/careeraihub-private/gate-c/`), shared only with the reviewers.
- Use only text whose author agreed to its use for this evaluation, with names, employers, emails and phone numbers replaced before reviewers see it. Record the agreement (who, when) in the private folder, not in the repo.
- The repo may hold the rubric, this protocol, the empty template and **synthetic** examples only.

## 2. The set

- At least 50 STAR stories, with a separate set of interview answers for the interview scorer (the STAR count does not validate the interview scorer).
- Balanced on purpose: strong, weak, incomplete, padded or repetitive, team-based, quantified-but-irrelevant, non-STAR, and short-but-relevant.
- Each item records its language (`en` or `vi`). English and Vietnamese are reported separately; a language with too few items (suggested: fewer than 25 each for the first report) is reported as "not enough data", not averaged into the other.
- **Hold-out:** split the set before anyone looks at scores. About one third (stratified by language and group) is the **hold-out**: not used when rules are changed, scored only after a rule change is frozen. Changing rules until the hold-out also looks good turns it into training data; a new hold-out is then needed.

## 3. Human rubric (each item rated independently by at least two people)

Reviewers do not see the code's score. Each rates, on the same 1-4 scale (1 = absent, 2 = weak, 3 = adequate, 4 = strong), with a short reason:

1. **STAR structure:** are situation, task, action and result all present and distinguishable?
2. **Relevance:** does the text actually address the situation it describes (for interview answers: the question)?
3. **Specificity:** concrete details (what, how much, who, tools) rather than generalities?
4. **Action and result identifiable:** can you tell what the author did and what came of it?
5. **Overall structural quality** (1-4), plus flag `misleading_if_high`: yes if a high score for this text would mislead.

The rubric measures structure, not truthfulness, talent or hiring suitability. Reviewers are told so.

## 4. What the report must contain

| Measure | How |
|---|---|
| Reviewer agreement | Weighted Cohen's kappa (or Krippendorff's alpha with more than two raters) per rubric question, per language. If agreement is low, fix the rubric and re-rate before judging the code |
| Code against humans | Rank correlation (Spearman) between the code score and the humans' mean overall rating, per language |
| False-high rate | Share of items humans rate 1-2 overall (or flag `misleading_if_high`) that the code scores at or above a stated high threshold (suggest 75). List every case |
| False-low rate | Share of items humans rate 4 that the code scores at or below a stated low threshold (suggest 50). List every case |
| Quantified-but-irrelevant | Separate table: items with numbers but relevance rated 1-2, and what the code gave them |
| Distribution | Histogram of code scores per language and per group; the report states plainly how compressed it is (for example the fraction of items above 80) |
| Bias review | Compare score distributions by language, text length, and writing style (formal against informal). A systematic gap not explained by the human ratings is a finding |
| Hold-out result | Reported separately and only after the rules are frozen |

Thresholds above are suggestions; the owner sets them before the data are looked at.

## 5. Decision rule

- Pass for beta (per language): reviewers agree adequately, the false-high list has no systematic pattern the owner considers unacceptable, no unexplained language or style gap, hold-out consistent with the rest. The owner reads the report and approves in writing. The UI says "beta".
- Otherwise: change the rules as a **versioned** change (new `SCORE_VERSIONS` value, new pinned fingerprint, regression tests built from the failure cases) and repeat on a fresh hold-out. The three synthetic cases in `supabase/functions/_shared/structure/fixtures.js` (88 for quantified-but-irrelevant, 82 for non-STAR, 97 for a strong story, on 2026-10-10) are regression cases, not calibration data.

## 6. Template

`gate-c-template.csv` (same folder as this file) has the columns and two synthetic rows. Copy it to the private folder before filling it in.
