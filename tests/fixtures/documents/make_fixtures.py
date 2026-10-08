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

# ---- extra edge cases (the Chrome-printed PDFs in this folder come from html/*.html, see make_pdfs.sh) ----
def docx_full(path, body_xml, header=None, footer=None):
    ns = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
    refs = (f'<w:headerReference w:type="default" r:id="rIdH"/>' if header else '') + (f'<w:footerReference w:type="default" r:id="rIdF"/>' if footer else '')
    doc = f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document {ns}><w:body>{body_xml}<w:sectPr>{refs}</w:sectPr></w:body></w:document>'
    P = lambda t: f'<w:p><w:r><w:t xml:space="preserve">{t}</w:t></w:r></w:p>'
    ct = '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' + ('<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' if header else '') + ('<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' if footer else '') + '</Types>'
    rels = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
    drels = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + ('<Relationship Id="rIdH" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>' if header else '') + ('<Relationship Id="rIdF" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' if footer else '') + '</Relationships>'
    with zipfile.ZipFile(os.path.join(OUT, path), "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", ct); z.writestr("_rels/.rels", rels); z.writestr("word/document.xml", doc); z.writestr("word/_rels/document.xml.rels", drels)
        if header: z.writestr("word/header1.xml", f'<?xml version="1.0" encoding="UTF-8"?><w:hdr {ns}>{P(header)}</w:hdr>')
        if footer: z.writestr("word/footer1.xml", f'<?xml version="1.0" encoding="UTF-8"?><w:ftr {ns}>{P(footer)}</w:ftr>')

P = lambda t: f'<w:p><w:r><w:t xml:space="preserve">{t}</w:t></w:r></w:p>'
cell = lambda t: f'<w:tc><w:p><w:r><w:t xml:space="preserve">{t}</w:t></w:r></w:p></w:tc>'
row = lambda *c: '<w:tr>' + ''.join(cell(x) for x in c) + '</w:tr>'
docx_full("tables.docx", P("Jane Example") + P("Experience") + '<w:tbl>' + row("Company", "Role", "Years") + row("Acme Ltd", "Product Manager", "2021 - 2024") + row("Beta Corp", "Associate Product Manager", "2019 - 2021") + '</w:tbl>')
docx_full("header-footer.docx", P("Experience") + P("Product Manager at Acme Ltd (2021 - 2024)") + P("Increased lead qualification by 20 percent") + P("Skills: SQL, Python, Roadmapping"), header="Jane Example - jane@example.com - +65 0000 0000", footer="Confidential resume")
docx_full("vietnamese.docx", P("Nguyễn Thị Hương") + P("Quản lý sản phẩm - Công ty Cổ phần Ánh Dương (2021 - 2024)") + P("Tăng tỷ lệ chuyển đổi khách hàng tiềm năng thêm 20%") + P("Kỹ năng: Phân tích dữ liệu, SQL, Python"))

# a PDF that was laid out in two columns but whose text is stored row by row (left run, then right run, per line)
L = [(72, 700, "Skills"), (72, 680, "SQL, Python"), (72, 660, "Education"), (72, 640, "BSc Economics, 2019")]
R = [(330, 700, "Experience"), (330, 680, "Product Manager at Acme Ltd"), (330, 660, "Increased lead qualification by 20 percent"), (330, 640, "Led a team of 6 people")]
pdf([[v for pair in zip(L, R) for v in pair]], "two-column-rowwise.pdf")

# Hyphen / date-dash stored as byte 0xAD ("soft hyphen"), as some LaTeX (XeTeX) fonts do. pdf.js drops it.
def pdf_softhyphen(path):
    # The font maps byte 0xAD to U+00AD through a ToUnicode CMap, exactly what pdf.js drops as an
    # invisible format character. (A plain WinAnsi 0xAD is read as '-' and does not show the problem.)
    cmap = (b"/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CMapName /Adobe-Identity-UCS def "
            b"/CMapType 2 def 1 begincodespacerange <00> <FF> endcodespacerange 1 beginbfchar <AD> <00AD> endbfchar "
            b"endcmap CMapName currentdict /CMap defineresource pop end end")
    font = (b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding << /Type /Encoding /BaseEncoding /WinAnsiEncoding "
            b"/Differences [173 /hyphen] >> /ToUnicode 6 0 R >>")
    runs = [(72, 720, "Jane Example"), (72, 700, "Led a high\\255impact, hands\\255on team of 6"),
            (72, 680, "Product Manager, Acme Ltd"), (400, 680, "Sep. 2023 \\255 Mar. 2024"), (72, 660, "Co\\255founder, Beta Corp")]
    stream = b"".join(f"BT /F1 12 Tf {x} {y} Td ({t}) Tj ET\n".encode() for x, y, t in runs)
    objs = [b"<< /Type /Catalog /Pages 2 0 R >>", b"<< /Type /Pages /Kids [5 0 R] /Count 1 >>", font,
            b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"endstream",
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 3 0 R >> >> >>",
            b"<< /Length %d >>\nstream\n" % len(cmap) + cmap + b"\nendstream"]
    buf = b"%PDF-1.4\n"; offs = []
    for i, o in enumerate(objs, 1):
        offs.append(len(buf)); buf += b"%d 0 obj\n" % i + o + b"\nendobj\n"
    x = len(buf)
    buf += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1) + b"".join(b"%010d 00000 n \n" % o for o in offs)
    buf += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, x)
    open(os.path.join(OUT, path), "wb").write(buf)
pdf_softhyphen("softhyphen-dashes.pdf")

# Contact line with icons from an icon font (FontAwesome): the glyph's code is an ordinary character such as
# '#', so without the font name it looks like text. The font is not embedded; only its name matters here.
def pdf_icon_font(path):
    f1 = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
    f2 = b"<< /Type /Font /Subtype /Type1 /BaseFont /FontAwesome5Free-Solid >>"
    stream = (b"BT /F1 12 Tf 72 720 Td (Jane Example) Tj ET\n"
              b"BT /F2 12 Tf 72 700 Td (#) Tj ET\nBT /F1 12 Tf 90 700 Td (jane@example.com) Tj ET\n"
              b"BT /F2 12 Tf 72 680 Td (D) Tj ET\nBT /F1 12 Tf 90 680 Td (+65 0000 0000) Tj ET\n"
              b"BT /F1 12 Tf 72 660 Td (Skills: SQL, Python) Tj ET\n")
    objs = [b"<< /Type /Catalog /Pages 2 0 R >>", b"<< /Type /Pages /Kids [6 0 R] /Count 1 >>", f1, f2,
            b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"endstream",
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 5 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>"]
    buf = b"%PDF-1.4\n"; offs = []
    for i, o in enumerate(objs, 1):
        offs.append(len(buf)); buf += b"%d 0 obj\n" % i + o + b"\nendobj\n"
    x = len(buf)
    buf += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1) + b"".join(b"%010d 00000 n \n" % o for o in offs)
    buf += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, x)
    open(os.path.join(OUT, path), "wb").write(buf)
pdf_icon_font("icon-font.pdf")

# Mimics a Canva-style export: Roboto + CrimsonPro font names (not embedded, only referenced), single
# column, a right-aligned date on an experience line, and a row of short tag-like items (a skills row).
def pdf_canva_style(path):
    f1 = b"<< /Type /Font /Subtype /Type1 /BaseFont /Roboto-Regular >>"
    f2 = b"<< /Type /Font /Subtype /Type1 /BaseFont /Roboto-Bold >>"
    f3 = b"<< /Type /Font /Subtype /Type1 /BaseFont /CrimsonPro-Regular >>"
    stream = (b"BT /F2 16 Tf 60 740 Td (Jane Example) Tj ET\n"
              b"BT /F1 11 Tf 60 720 Td (jane@example.com  +65 0000 0000  Singapore) Tj ET\n"
              b"BT /F2 12 Tf 60 690 Td (Experience) Tj ET\n"
              b"BT /F2 11 Tf 60 670 Td (Product Manager, Acme Ltd) Tj ET\nBT /F1 10 Tf 460 670 Td (2021 - 2024) Tj ET\n"
              b"BT /F3 10 Tf 75 652 Td (Increased lead qualification by 20 percent) Tj ET\n"
              b"BT /F3 10 Tf 75 636 Td (Led a cross-functional team of 6) Tj ET\n"
              b"BT /F2 12 Tf 60 605 Td (Skills) Tj ET\n"
              b"BT /F1 10 Tf 60 585 Td (SQL) Tj ET\nBT /F1 10 Tf 100 585 Td (Python) Tj ET\n"
              b"BT /F1 10 Tf 150 585 Td (Figma) Tj ET\nBT /F1 10 Tf 195 585 Td (Roadmapping) Tj ET\nBT /F1 10 Tf 270 585 Td (SEO) Tj ET\n")
    objs = [b"<< /Type /Catalog /Pages 2 0 R >>", b"<< /Type /Pages /Kids [7 0 R] /Count 1 >>", f1, f2, f3,
            b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"endstream",
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> >>"]
    buf = b"%PDF-1.4\n"; offs = []
    for i, o in enumerate(objs, 1):
        offs.append(len(buf)); buf += b"%d 0 obj\n" % i + o + b"\nendobj\n"
    x = len(buf)
    buf += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1) + b"".join(b"%010d 00000 n \n" % o for o in offs)
    buf += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, x)
    open(os.path.join(OUT, path), "wb").write(buf)
pdf_canva_style("canva-style-single-col.pdf")

# Mimics a Word export that draws bullets with Symbol/Wingdings fonts (the classic Word bullet-list
# pattern) rather than a real bullet character in the body font. These must NOT be treated as icon fonts
# (unlike FontAwesome etc.) since the glyph itself is the bullet, not a picture replacing real text.
def pdf_word_bullets(path):
    f1 = b"<< /Type /Font /Subtype /Type1 /BaseFont /Cambria >>"
    f2 = b"<< /Type /Font /Subtype /Type1 /BaseFont /Cambria-Bold >>"
    f3 = b"<< /Type /Font /Subtype /Type1 /BaseFont /SymbolMT >>"
    f4 = b"<< /Type /Font /Subtype /Type1 /BaseFont /Wingdings-Regular >>"
    stream = (b"BT /F2 14 Tf 45 740 Td (Jane Example) Tj ET\n"
              b"BT /F1 11 Tf 45 720 Td (jane@example.com) Tj ET\n"
              b"BT /F2 12 Tf 45 695 Td (Experience) Tj ET\n"
              b"BT /F1 11 Tf 45 675 Td (Product Manager, Acme Ltd \(2021 - 2024\)) Tj ET\n"
              b"BT /F3 10 Tf 60 655 Td (\267) Tj ET\nBT /F1 10 Tf 75 655 Td (Increased lead qualification by 20 percent) Tj ET\n"
              b"BT /F4 10 Tf 60 638 Td (\247) Tj ET\nBT /F1 10 Tf 75 638 Td (Led a cross-functional team of 6) Tj ET\n"
              b"BT /F2 12 Tf 45 610 Td (Skills) Tj ET\n"
              b"BT /F1 10 Tf 45 590 Td (SQL, Python, Roadmapping) Tj ET\n")
    objs = [b"<< /Type /Catalog /Pages 2 0 R >>", b"<< /Type /Pages /Kids [8 0 R] /Count 1 >>", f1, f2, f3, f4,
            b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"endstream",
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 7 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 6 0 R >> >> >>"]
    buf = b"%PDF-1.4\n"; offs = []
    for i, o in enumerate(objs, 1):
        offs.append(len(buf)); buf += b"%d 0 obj\n" % i + o + b"\nendobj\n"
    x = len(buf)
    buf += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1) + b"".join(b"%010d 00000 n \n" % o for o in offs)
    buf += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, x)
    open(os.path.join(OUT, path), "wb").write(buf)
pdf_word_bullets("word-wingdings-bullets.pdf")
print("fixtures written to", OUT)
