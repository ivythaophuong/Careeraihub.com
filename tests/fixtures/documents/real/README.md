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

## Sources of the public_* files here (local only, not redistributed)

- `public_overleaf_libre_cv_2col.pdf`: "Libre CV" by Samuel Boïté, Overleaf gallery
  (https://www.overleaf.com/latex/templates/libre-cv/bmdtjqdhwtsz), licence CC BY 4.0. Sample content is fictional.
- `public_overleaf_sfiucr_1col_table.pdf`: "SFIUCR Template CV/Resume" by ComplexityExplorer
  (https://www.overleaf.com/latex/templates/sfiucr-template-cv-slash-resume/xqvshnpvtsbv), licence CC BY 4.0.
- `public_overleaf_swe_1col_icons_table.pdf`: "SWE Resume Template" by Audric Serador
  (https://www.overleaf.com/latex/templates/swe-resume-template/bznbzdprjfyy), licence CC BY 4.0.
- `public_overleaf_modern_2col_icons_table_tikz.pdf`: "Modern LaTeX CV" by Philip Empl
  (https://www.overleaf.com/latex/templates/modern-latex-cv/qmdwjvcrcrph), licence CC BY 4.0.

Not used, with reasons: "Sample single-page resume with keywords" (license is "Other, as stated in the
work" — not confirmed reusable); the Viktoriia Savoiskas CV article (its sample content is a real
person's real name, university and work history, not template placeholder data — not appropriate here
regardless of its licence).
