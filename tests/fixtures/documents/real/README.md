# Real (anonymised) resumes: local only

Files in this folder are **never committed** (see `.gitignore`): the repository is public, and a resume that
looks anonymous can still identify a person through employers, schools, titles and dates.

Put 3 to 5 resumes here, named by what makes them hard, for example:

    real_cv_canva_2col.pdf     real_cv_topcv_table.pdf     real_cv_word_standard.docx     real_cv_vietnamese.pdf

Before saving a file here:
- replace the name, email (`candidate@example.com`), phone (`+84 90 000 0000`), address, links and any ID number
- prefer your own resume or one whose owner agreed; do not use a resume you do not have the right to copy
- re-export the file; in Word / Google Docs also clear the author (File > Info > Inspect Document)

Then run `npm test`. `src/ingestion/realDocuments.test.js` runs every file here through the ingestion
module and also checks for leftover emails, phone-like numbers and author metadata. Add `REAL_REPORT=1`
to print one line per file (type, status, pages, characters, notes; never the text).

Files named `public_*` are open-licensed templates (for example MIT or CC BY-SA) with sample data the author
published. They skip the leftover-personal-data check and nothing else. Do not use the prefix for anything else.
