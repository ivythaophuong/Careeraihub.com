#!/usr/bin/env python3
"""Regenerates the small synthetic documents used by src/ingestion tests. No real personal data.
Run from the repo root:  python3 tests/fixtures/documents/make_fixtures.py"""
import os, zipfile, io

OUT = os.path.join(os.path.dirname(__file__))

def pdf(pages, path):
    """pages: list of lists of (x, y, text) runs; an empty list is a page with no text."""
    objs = []
    def add(b): objs.append(b); return len(objs)
    add(b"")  # 1 catalog (filled later)
    add(b"")  # 2 pages (filled later)
    font = add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    page_ids = []
    for runs in pages:
        stream = b"".join(f"BT /F1 12 Tf {x} {y} Td ({t}) Tj ET\n".encode() for x, y, t in runs)
        c = add(b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"endstream")
        p = add(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents {c} 0 R /Resources << /Font << /F1 {font} 0 R >> >> >>".encode())
        page_ids.append(p)
    objs[0] = b"<< /Type /Catalog /Pages 2 0 R >>"
    objs[1] = f"<< /Type /Pages /Kids [{' '.join(f'{i} 0 R' for i in page_ids)}] /Count {len(page_ids)} >>".encode()
    buf = b"%PDF-1.4\n"; offs = []
    for i, o in enumerate(objs, 1):
        offs.append(len(buf)); buf += b"%d 0 obj\n" % i + o + b"\nendobj\n"
    x = len(buf)
    buf += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1) + b"".join(b"%010d 00000 n \n" % o for o in offs)
    buf += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, x)
    open(os.path.join(OUT, path), "wb").write(buf)

def docx(paragraphs, path):
    body = "".join(f"<w:p><w:r><w:t xml:space=\"preserve\">{t}</w:t></w:r></w:p>" for t in paragraphs)
    doc = f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>{body}</w:body></w:document>'
    ct = '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
    rels = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
    with zipfile.ZipFile(os.path.join(OUT, path), "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", ct); z.writestr("_rels/.rels", rels); z.writestr("word/document.xml", doc)

LINE1 = [(72, 720, "Jane Example"), (72, 700, "Product Manager at Acme Ltd (2021 - 2024)")]
LINE2 = [(72, 680, "Increased lead qualification by 20 percent")]
SKILLS = [(72, 660, "Skills:"), (130, 660, "SQL, Python, Roadmapping")]   # two runs on one line
pdf([LINE1 + LINE2 + SKILLS, [(72, 720, "Education"), (72, 700, "BSc Economics, Example University, 2019")]], "standard.pdf")
pdf([[]], "blank.pdf")                                                     # a page with no text layer
pdf([LINE1 + LINE2 + SKILLS, []], "partial.pdf")                           # page 2 has no text
open(os.path.join(OUT, "corrupt.pdf"), "wb").write(b"%PDF-1.4\nthis is not a real pdf body\n")
docx(["Jane Example", "Product Manager at Acme Ltd (2021 - 2024)", "Increased lead qualification by 20 percent", "Skills: SQL, Python, Roadmapping"], "standard.docx")
docx([], "empty.docx")
print("fixtures written to", OUT)
