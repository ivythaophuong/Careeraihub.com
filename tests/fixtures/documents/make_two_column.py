#!/usr/bin/env python3
"""Writes tests/fixtures/documents/resume-columns-by-column.pdf and resume-columns-by-row.pdf: a synthetic two-column resume (invented person), built as plain text runs at fixed
positions, the way a two-column template places its columns. No real personal data.
Run from the repo root:  python3 tests/fixtures/documents/make_two_column.py"""
import os
OUT = os.path.dirname(__file__)

def pdf(runs, path):
    objs = []
    def add(b): objs.append(b); return len(objs)
    add(b""); add(b"")
    font = add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    stream = b"".join(f"BT /F1 11 Tf {x} {y} Td ({t}) Tj ET\n".encode() for x, y, t in runs)
    c = add(b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"endstream")
    p = add(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents {c} 0 R /Resources << /Font << /F1 {font} 0 R >> >> >>".encode())
    objs[0] = b"<< /Type /Catalog /Pages 2 0 R >>"
    objs[1] = f"<< /Type /Pages /Kids [{p} 0 R] /Count 1 >>".encode()
    buf = b"%PDF-1.4\n"; offs = []
    for i, o in enumerate(objs, 1):
        offs.append(len(buf)); buf += b"%d 0 obj\n" % i + o + b"\nendobj\n"
    x = len(buf)
    buf += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1) + b"".join(b"%010d 00000 n \n" % o for o in offs)
    buf += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, x)
    open(os.path.join(OUT, path), "wb").write(buf)

MAIN = ["Ahmed Khalil", "EXPERIENCE", "Project Manager, Delta Build", "Feb 2018 - Present", "- Delivered 6 projects on budget",
        "- Led a site team of 12 people", "Site Engineer, Nile Works", "Jan 2015 - Jan 2018", "- Supervised 4 sites",
        "EDUCATION", "BSc Civil Engineering, Cairo University, 2014"]
SIDE = ["CONTACT", "ahmed.khalil@example.com", "+20 100 555 0100", "Cairo, Egypt", "SKILLS", "Project planning", "Budgeting",
        "Risk management", "Scheduling", "Site supervision"]
left = [(48, 740 - 17 * i, t) for i, t in enumerate(MAIN)]
right = [(390, 740 - 17 * i, t) for i, t in enumerate(SIDE)]
pdf(left + right, "resume-columns-by-column.pdf")        # content stream written column by column: pdf.js already returns the columns in order
rows = []                                    # content stream written row by row (left, right, left, right ...): the case that breaks line-by-line reading
for i in range(max(len(left), len(right))):
    if i < len(left): rows.append(left[i])
    if i < len(right): rows.append(right[i])
pdf(rows, "resume-columns-by-row.pdf")
