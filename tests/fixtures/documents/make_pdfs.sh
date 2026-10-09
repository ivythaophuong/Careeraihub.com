#!/bin/sh
# Prints html/*.html to PDF with headless Chrome (macOS path). The generated PDFs are committed, so this
# only needs to run when an html source changes:  sh tests/fixtures/documents/make_pdfs.sh
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
cd "$(dirname "$0")" || exit 1
for f in html/*.html; do
  n=$(basename "$f" .html)
  "$CH" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="$PWD/$n.pdf" "file://$PWD/$f" >/dev/null 2>&1
done
