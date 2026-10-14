# Model evaluation scripts

Scripts that measure what AI models do on the product's own prompts, with **invented** data only (no real person, no real resume). They were written on
2026-10-14 to choose a model for the writing features (see `docs/architecture/plans/DESIGN-ai-routing-by-feature.md`) and to measure the guards against invented
content. They call real models, so they cost a little money and need your own keys. Nothing here changes a prompt, a weight, a threshold or a database.

**Never paste a key into a chat, a file or a commit.** Put it in your own shell, in a hidden prompt:

```bash
read -s "GROQ_API_KEY?Groq key: "; export GROQ_API_KEY            # bash: read -s -p "Groq key: " GROQ_API_KEY; export GROQ_API_KEY
read -s "ANTHROPIC_API_KEY?Anthropic key: "; export ANTHROPIC_API_KEY
read -s "OPENAI_API_KEY?OpenAI key: "; export OPENAI_API_KEY
echo "${#GROQ_API_KEY} characters"                                   # a check that does not print the key; a rejected key gives "upstream 401" in every row
```

Run them from the repository root with `npx vite-node` (the product's source uses extension-less imports, which plain `node` cannot read). Each script has a
`--dry-run` that uses a pretend model: no network, no key, no cost. Use it first.

| Script | What it measures | Calls (all models) | Rough cost* |
|---|---|---|---|
| `providerCompare.mjs` | reading a resume into JSON on the 36 invented resumes of `tests/fixtures/extraction-accuracy`, scored against their known answers (`--providers groq,gemini`) | 36 per provider | cents |
| `blindTest.mjs` | letters, interview questions, answer evaluation and a tone change with the product's own prompt builders, three models shown as Answer A / B / C with the names hidden; `--repeat 3` also repeats the scoring tasks to see how stable a score is | 30, plus 6 per extra repeat | under 1 USD with the small models |
| `rewriteTest.mjs` | the live rewrite path (`ats_parse` suggestions) on the 12 invented weak resumes of `tests/fixtures/model-eval`, counted by the product's own guards: invented figures, claim warnings, the model's own evidence and declarations | 36 | cents |
| `rewriteReport.mjs` | prints the `rewriteTest` table again from a saved `rewrite-results.json`, so two runs can sit side by side; reads files only | 0 | none |

\* Rough, from the prices in `modelEvalCore.mjs` (read from the providers' pages on 2026-10-14 and out of date as soon as a provider changes its prices; check the pages).
The real cost of each call is computed from the tokens the provider reports. A model that thinks before it answers counts that thinking as output.

## Examples

```bash
npx vite-node scripts/audit/rewriteTest.mjs --dry-run --outdir /tmp/rw          # no cost
npx vite-node scripts/audit/rewriteTest.mjs --outdir ./rewrite-out --models luna,haiku,groq
node scripts/audit/rewriteReport.mjs ./rewrite-out/rewrite-results.json

npx vite-node scripts/audit/blindTest.mjs --outdir ./blind-out --models groq,haiku,luna --repeat 3
#  read blind-out/blind.md, rate every answer 1 to 5 in blind-out/ratings.csv, and only then open blind-out/.sealed-key.json (it says which model is which)

npx vite-node scripts/audit/providerCompare.mjs --providers groq,gemini --limit 36 --out results.json
```

## Limits to remember when you read a result

- The data is invented, in English, from one author, and each run is one run: a small difference between two models is not evidence.
- Groq's free plan allows about 8,000 tokens a minute, so the scripts wait between its calls (`--wait` / `--delay`); a 429 is retried.
- A key the provider rejects shows as `upstream 401` in every row of that model; a model whose account has no credit shows `429` or another error. Neither says anything about the model.
- The counting is done by code (`src/lib/claimGuard.js`, `numberGuard.js`) and has false positives; whether a suggestion is really invented has to be read by a person.
- Output files (`rewrite-results.json`, `blind.md`, `.sealed-key.json`) hold the models' answers to invented prompts. Keep them out of commits unless you mean to publish them.

The pure parts (scoring, cost, the blind order, the numbers of the rewrite test) are in `modelEvalCore.mjs` and tested in `tests/audit/modelEvalCore.test.js`;
`tests/audit/modelEvalScripts.test.js` checks the rules above and runs each script with `--dry-run`.
