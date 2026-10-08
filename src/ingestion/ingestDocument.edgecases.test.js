// @vitest-environment node
// Failure-mode corpus for document ingestion. The PDFs come from html/*.html printed by headless Chrome
// (make_pdfs.sh) and from make_fixtures.py; all content is invented. They show the logic, not how every
// real-world PDF behaves.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ingestDocument, decodeText } from './ingestDocument';
import { normalizeText } from './normalizeText';
import { layoutHint, removeRepeatedPageLines, joinPdfItems, restoreSoftHyphens, insertDashes, removeIconGlyphs, ICON_FONT } from './pdfText';
import { wordXmlToText } from './zipText';

const FIX = path.resolve(__dirname, '../../tests/fixtures/documents');
const fixture = (name, asName = name) => {
  const buf = fs.readFileSync(path.join(FIX, name));
  return { name: asName, size: buf.length, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
};
const bytesFile = (name, bytes) => { const u = Uint8Array.from(bytes); return { name, size: u.length, arrayBuffer: async () => u.buffer }; };
const count = (text, needle) => text.split(needle).length - 1;

describe('PDF printed by Chrome', () => {
  it('two columns stored column by column: every part is there and the status is ok', async () => {
    const r = await ingestDocument(fixture('two-column.pdf'));
    expect(r.status).toBe('ok');
    for (const t of ['Jane Example', 'jane@example.com', 'Stakeholder management', 'BSc Economics', 'Product Manager', 'Acme Ltd', 'Beta Corp', 'Shipped 3 releases']) expect(r.text).toContain(t);
  });

  it('a table keeps each row on one line, in cell order', async () => {
    const r = await ingestDocument(fixture('tables.pdf'));
    expect(r.status).toBe('ok');
    expect(r.text).toMatch(/Acme Ltd\s+Product Manager\s+2021 - 2024/);
    expect(r.text).toMatch(/Beta Corp\s+Associate Product Manager\s+2019 - 2021/);
    expect(r.text).toMatch(/Data\s+SQL, Python\s+Advanced/);
  });

  it('icons and typographic characters survive', async () => {
    const r = await ingestDocument(fixture('icons-unicode.pdf'));
    for (const t of ['☎', '✉', 'jane@example.com', '“Smart quotes”', 'Café-style']) expect(r.text).toContain(t);
  });

  it('Vietnamese with diacritics is read exactly, in composed form', async () => {
    const r = await ingestDocument(fixture('vietnamese.pdf'));
    for (const t of ['Nguyễn Thị Hương', 'Đại học Kinh tế Quốc dân', 'Kỹ năng', 'Tăng tỷ lệ chuyển đổi']) expect(r.text).toContain(t);
    expect(r.text).toBe(r.text.normalize('NFC'));
  });

  it('a running header and footer are kept once, and the body is untouched', async () => {
    const r = await ingestDocument(fixture('header-footer.pdf'));
    expect(r.stats.pages).toBe(2);
    expect(count(r.text, 'Jane Example · jane@example.com · +65 0000 0000')).toBe(1);
    expect(count(r.text, 'Confidential resume of Jane Example')).toBe(1);
    expect(r.stats.repeatedLinesRemoved).toBeGreaterThanOrEqual(2);
    expect(r.notes.join(' ')).toMatch(/kept once/);
    for (let i = 1; i <= 14; i++) expect(r.text).toContain(`Project ${i}: Example initiative ${i}`);
  });
});

describe('two columns stored row by row', () => {
  it('does not silently merge the columns: the gap becomes a tab and the page is flagged', async () => {
    const r = await ingestDocument(fixture('two-column-rowwise.pdf'));
    expect(r.text).toContain('Skills\tExperience');
    expect(r.text).toContain('SQL, Python\tProduct Manager at Acme Ltd');
    expect(r.stats.columnarPages).toBe(1);
    expect(r.notes.join(' ')).toMatch(/wide gaps.*reading order of those lines may be mixed/);
  });
});

describe('DOCX', () => {
  it('a table: every cell is read', async () => {
    const r = await ingestDocument(fixture('tables.docx'));
    expect(r.status).toBe('ok');
    for (const t of ['Company', 'Acme Ltd', 'Associate Product Manager', '2019 - 2021']) expect(r.text).toContain(t);
  });

  it('header and footer text is included, not silently lost', async () => {
    const r = await ingestDocument(fixture('header-footer.docx'));
    expect(r.text).toContain('Jane Example - jane@example.com - +65 0000 0000');
    expect(r.text).toContain('Confidential resume');
    expect(r.text.indexOf('jane@example.com')).toBeLessThan(r.text.indexOf('Experience'));  // header first
    expect(r.text.trim().endsWith('Confidential resume')).toBe(true);                         // footer last
    expect(r.notes.join(' ')).toMatch(/header\/footer was included/);
  });

  it('a document without header or footer has no such note', async () => {
    expect((await ingestDocument(fixture('standard.docx'))).notes).toEqual([]);
  });

  it('Vietnamese with diacritics', async () => {
    const r = await ingestDocument(fixture('vietnamese.docx'));
    for (const t of ['Nguyễn Thị Hương', 'Quản lý sản phẩm', 'Kỹ năng: Phân tích dữ liệu']) expect(r.text).toContain(t);
  });
});

describe('TXT encodings', () => {
  const VI = 'Nguyễn Thị Hương\nQuản lý sản phẩm tại công ty Ánh Dương, 2021 - 2024\nKỹ năng: SQL, Python';
  it('UTF-8 with a BOM', async () => {
    const r = await ingestDocument(bytesFile('cv.txt', [0xEF, 0xBB, 0xBF, ...Buffer.from(VI, 'utf8')]));
    expect(r.text.startsWith('Nguyễn')).toBe(true);
  });
  it('UTF-16 little endian with a BOM (Windows Notepad "Unicode")', async () => {
    const r = await ingestDocument(bytesFile('cv.txt', [0xFF, 0xFE, ...Buffer.from(VI, 'utf16le')]));
    expect(r.status).toBe('ok');
    expect(r.text).toContain('Quản lý sản phẩm');
  });
  it('decomposed accents are composed', async () => {
    const r = await ingestDocument(bytesFile('cv.txt', Buffer.from(VI.normalize('NFD'), 'utf8')));
    expect(r.text).toContain('Nguyễn Thị Hương');
    expect(r.text).toBe(r.text.normalize('NFC'));
  });
  it('a legacy 8-bit file is read as Windows-1252 and says so', async () => {
    const latin1 = [...Buffer.from('Jos\u00e9 Garc\u00eda, Product Manager at Acme Ltd from 2021 to 2024, SQL and Python', 'latin1')];
    const r = await ingestDocument(bytesFile('cv.txt', latin1));
    expect(r.status).toBe('ok');
    expect(r.text).toContain('José García');
    expect(r.notes.join(' ')).toMatch(/Windows-1252/);
  });
  it('decodeText never mistakes real text for binary', () => {
    expect(decodeText(Buffer.from(VI, 'utf8')).error).toBeUndefined();
  });
});

describe('protected and old Office files', () => {
  it('a password-protected PDF is named as such', async () => {
    const readPdf = async () => { const e = new Error('No password given'); e.name = 'PasswordException'; throw e; };
    expect(await ingestDocument(fixture('standard.pdf'), { readPdf })).toMatchObject({ status: 'failed', error: 'password_protected' });
  });
  it('an encrypted Office file (same container as .doc) gets an honest message', async () => {
    const r = await ingestDocument(bytesFile('cv.docx', [0xD0, 0xCF, 0x11, 0xE0, 0, 0, 0, 0]));
    expect(r.error).toBe('unsupported_type');
    expect(r.notes[0]).toMatch(/password-protected/);
  });
});

describe('normalizeText additions', () => {
  it('expands PDF ligatures', () => { expect(normalizeText('o\uFB03ce \uFB01nance')).toBe('office finance'); });
  it('drops private-use icon-font glyphs, keeps real symbols', () => {
    expect(normalizeText('\uF0B7 Email \uE001 jane@example.com ☎')).toBe('Email  jane@example.com ☎');
  });
});

describe('removeRepeatedPageLines', () => {
  const A = ['Jane Example - jane@example.com', 'Body of page one is here', 'Page 1 of 2'].join('\n');
  const B = ['Jane Example - jane@example.com', 'Body of page two differs', 'Page 2 of 2'].join('\n');
  it('keeps the first copy, ignoring the numbers of a page counter, and removes the rest', () => {
    const r = removeRepeatedPageLines([A, B]);
    expect(r.removed).toBe(2);
    expect(r.pages[0]).toBe(A);
    expect(r.pages[1]).toBe('Body of page two differs');
  });
  it('does NOT treat lines that differ only in a number as the same line', () => {
    const p1 = ['Jane Example', 'Experience', 'Project 1: Example initiative 1', 'body one'].join('\n');
    const p2 = ['Project 2: Example initiative 2', 'body two', 'more', 'Skills'].join('\n');
    const r = removeRepeatedPageLines([p1, p2]);
    expect(r.removed).toBe(0);
    expect(r.pages[1]).toContain('Project 2: Example initiative 2');
  });
  it('treats a bare number at the end as a page counter only when it equals the page position', () => {
    const page = (n) => [`Opening line of part ${n}`, `Middle text unique to part ${n}`, `Closing text of part ${n}`, `February 10, 2026\tJane Doe - Resume\t${n}`].join('\n');
    const r = removeRepeatedPageLines([page(1), page(2), page(3)]);
    expect(r.removed).toBe(2);
    expect(r.pages[0]).toContain('Jane Doe - Resume\t1');
    expect(r.pages[1]).not.toContain('Jane Doe - Resume');
    expect(r.pages[2]).not.toContain('Jane Doe - Resume');
  });
  it('does not treat a heading that ends in the page number as a counter (no wide gap)', () => {
    const page = (n) => [`Chapter ${n}`, `Middle text unique to part ${n}`, `Closing text of part ${n}`, `Contents of section ${n}`].join('\n');
    expect(removeRepeatedPageLines([page(1), page(2), page(3)]).removed).toBe(0);
  });
  it('does not treat a trailing number that is not the page position as a counter', () => {
    const page = (n) => [`Opening line of part ${n}`, `Middle text unique to part ${n}`, `Closing text of part ${n}`, `Quarterly report 2026\t${n + 10}`].join('\n');
    expect(removeRepeatedPageLines([page(1), page(2)]).removed).toBe(0);
  });
  it('leaves a single page alone', () => { expect(removeRepeatedPageLines([A])).toEqual({ pages: [A], removed: 0 }); });
  it('does not touch short lines or lines that are not on every page', () => {
    const r = removeRepeatedPageLines(['Python\nrest of page one', 'Python\nrest of page two']);
    expect(r.removed).toBe(0);
    const r2 = removeRepeatedPageLines([A, B, 'Unrelated third page\nwith its own text here\nand more of it']);
    expect(r2.removed).toBe(0);
  });
  it('does not remove a repeated line from the middle of a page', () => {
    const mid = (n) => ['one', 'two', 'three', 'four', 'A repeated sentence in the middle', 'five', 'six', 'seven', 'eight'].join('\n');
    expect(removeRepeatedPageLines([mid(1), mid(2)]).removed).toBe(0);
  });
});

describe('layoutHint and joinPdfItems gaps', () => {
  it('needs at least four lines and many tabs', () => {
    expect(layoutHint('a\tb\nc\td').columnar).toBe(false);
    expect(layoutHint('a\tb\nc\td\ne\tf\ng\th').columnar).toBe(true);
    expect(layoutHint('plain\nlines\nwith\nno tabs').columnar).toBe(false);
  });
  it('a wide gap is a tab, a normal word gap is a space', () => {
    const it_ = (str, x, width) => ({ str, transform: [1, 0, 0, 1, x, 700], width });
    expect(joinPdfItems([it_('Skills', 72, 30), it_('SQL', 108, 18)])).toBe('Skills SQL');
    expect(joinPdfItems([it_('Skills', 72, 30), it_('Experience', 330, 50)])).toBe('Skills\tExperience');
  });
});

describe('wordXmlToText', () => {
  it('reads text, paragraphs, tabs and entities', () => {
    const xml = '<w:p><w:r><w:t>Jane &amp; Co</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t xml:space="preserve">2021</w:t></w:r></w:p><w:p><w:r><w:t>Next &#233;</w:t></w:r></w:p>';
    expect(wordXmlToText(xml)).toBe('Jane & Co\t2021\nNext é\n');
  });
});

describe('hyphens and dashes stored as invisible characters (LaTeX/XeTeX fonts)', () => {
  it('a real PDF with such a font: hyphens and the date-range dash are restored', async () => {
    const r = await ingestDocument(fixture('softhyphen-dashes.pdf'));
    expect(r.status).toBe('ok');
    expect(r.text).toContain('high-impact');
    expect(r.text).toContain('hands-on');
    expect(r.text).toContain('Co-founder');
    expect(r.text).toMatch(/Sep\. 2023 - Mar\. 2024/);
    expect(r.text).not.toContain('highimpact');
    expect(r.stats.dashesRestored).toBe(4);
    expect(r.stats.dashesUnreadable).toBe(0);
    expect(r.notes.join(' ')).toMatch(/4 hyphen\/dash characters .* restored/);
  });

  it('an ordinary PDF reports nothing about dashes', async () => {
    const r = await ingestDocument(fixture('standard.pdf'));
    expect(r.stats.dashesRestored).toBe(0);
    expect(r.notes.join(' ')).not.toMatch(/hyphen/);
  });

  it('restoreSoftHyphens matches runs to items in order and puts "-" back', () => {
    const items = [{ str: 'A' }, { str: 'highimpact' }, { str: ' ' }, { str: 'Sep. 2023 Mar. 2024' }];
    const runs = [['h', 'i', 'g', 'h', '­', 'i', 'm', 'p', 'a', 'c', 't'], ['S', 'e', 'p', '.', ' ', '2023', ' ', '­', ' ', 'Mar.', ' ', '2024']];
    const r = restoreSoftHyphens(items, runs);
    expect(r.items.map(i => i.str)).toEqual(['A', 'high-impact', ' ', 'Sep. 2023 - Mar. 2024']);
    expect(r.restored).toBe(2);
    expect(r.unreadable).toBe(0);
    expect(items[1].str).toBe('highimpact'); // input untouched
  });

  it('keeps the spaces pdf.js added (the glyphs of a run carry none of them)', () => {
    const items = [{ str: 'very highimpact work with fastgrowing teams' }];
    const run = [...'veryhigh'].concat(['\u00AD'], [...'impactworkwithfast'], ['\u00AD'], [...'growingteams']);
    const r = restoreSoftHyphens(items, [run]);
    expect(r.items[0].str).toBe('very high-impact work with fast-growing teams');
    expect(r.restored).toBe(2);
  });

  it('insertDashes: inside a word directly, at a space as " - ", at the ends without a space', () => {
    expect(insertDashes('highimpact', [4])).toEqual({ text: 'high-impact', left: 0 });
    expect(insertDashes('Sep. 2023 Mar. 2024', [8])).toEqual({ text: 'Sep. 2023 - Mar. 2024', left: 0 });
    expect(insertDashes('Con', [3])).toEqual({ text: 'Con-', left: 0 });
    expect(insertDashes('abc', [9])).toEqual({ text: 'abc', left: 1 });
  });

  it('a run that matches no item is counted, not guessed', () => {
    const r = restoreSoftHyphens([{ str: 'something else' }], [['a', '­', 'b']]);
    expect(r.items[0].str).toBe('something else');
    expect(r.restored).toBe(0);
    expect(r.unreadable).toBe(1);
  });

  it('two identical runs are each matched to their own item', () => {
    const items = [{ str: 'Cofounder' }, { str: 'Cofounder' }];
    const run = ['C', 'o', '­', 'f', 'o', 'u', 'n', 'd', 'e', 'r'];
    const r = restoreSoftHyphens(items, [run, run]);
    expect(r.items.map(i => i.str)).toEqual(['Co-founder', 'Co-founder']);
    expect(r.restored).toBe(2);
  });

  it('a note says when a dash could not be restored', async () => {
    const readPdf = async () => ({ pages: ['Jane Example\nProduct Manager at Acme Ltd, 2021 to 2024, SQL and Python'], restoredDashes: 0, unreadableDashes: 2 });
    const r = await ingestDocument(fixture('standard.pdf'), { readPdf });
    expect(r.stats.dashesUnreadable).toBe(2);
    expect(r.notes.join(' ')).toMatch(/2 hyphen\/dash characters could not be restored/);
  });
});

describe('icon fonts', () => {
  it('a real PDF with FontAwesome-named icons: the icons are not text, the contact details are', async () => {
    const r = await ingestDocument(fixture('icon-font.pdf'));
    expect(r.stats.iconGlyphsRemoved).toBe(2);
    expect(r.text).toContain('jane@example.com');
    expect(r.text).toContain('+65 0000 0000');
    expect(r.text).not.toMatch(/#|(^|\n)\s*D\b/);
    expect(r.text).toMatch(/^jane@example\.com$/m);
    expect(r.notes.join(' ')).toMatch(/2 icons drawn with an icon font/);
  });

  it('a PDF without icon fonts says nothing about icons', async () => {
    const r = await ingestDocument(fixture('standard.pdf'));
    expect(r.stats.iconGlyphsRemoved).toBe(0);
    expect(r.notes.join(' ')).not.toMatch(/icon/);
  });

  it('the font list covers icon fonts and leaves bullet fonts alone', () => {
    for (const n of ['OQHPSZ+FontAwesome5Free-Solid', 'FontAwesome5Brands-Regular', 'MaterialIcons-Regular', 'Material Symbols Outlined', 'glyphicons-halflings', 'Ionicons']) expect(ICON_FONT.test(n), n).toBe(true);
    for (const n of ['Symbol', 'Wingdings-Regular', 'ZapfDingbats', 'LinBiolinumT', 'ArialMT', 'Calibri', 'Awesomely-Text-Not']) if (n !== 'Awesomely-Text-Not') expect(ICON_FONT.test(n), n).toBe(false);
  });

  it('removeIconGlyphs blanks only icon-font items and does not mutate its input', () => {
    const items = [{ str: 'Jane', fontName: 'a' }, { str: '#', fontName: 'b' }, { str: ' ', fontName: 'b' }, { str: '', fontName: 'b' }];
    const r = removeIconGlyphs(items, (it) => (it.fontName === 'b' ? 'FontAwesome5Free-Solid' : 'Helvetica'));
    expect(r.items.map(i => i.str)).toEqual(['Jane', '', '', '']);
    expect(r.removed).toBe(1);
    expect(items[1].str).toBe('#');
  });
});

describe('real-world export patterns (Canva-style and Word-style), generic placeholder content only', () => {
  it('Canva-style export (Roboto/CrimsonPro, single column): reads cleanly, no icon-font false positive', async () => {
    const r = await ingestDocument(fixture('canva-style-single-col.pdf'));
    expect(r.status).toBe('ok');
    expect(r.stats.iconGlyphsRemoved).toBe(0);
    expect(r.text).toContain('jane@example.com');
    expect(r.text).toMatch(/Product Manager, Acme Ltd\t2021 - 2024/);
    for (const s of ['SQL', 'Python', 'Figma', 'Roadmapping', 'SEO']) expect(r.text).toContain(s);
  });

  it('Word-style export with Symbol/Wingdings bullet glyphs: the bullets are kept as text, not stripped as icons', async () => {
    const r = await ingestDocument(fixture('word-wingdings-bullets.pdf'));
    expect(r.status).toBe('ok');
    expect(r.stats.iconGlyphsRemoved).toBe(0);
    expect(r.text).toContain('Increased lead qualification by 20 percent');
    expect(r.text).toContain('Led a cross-functional team of 6');
    // a bullet-font glyph is present right before each bullet's text (not removed, whatever pdf.js maps it to)
    expect(r.text).toMatch(/\S[ \t]*Increased lead qualification/);
    expect(r.text).toMatch(/\S[ \t]*Led a cross-functional/);
  });
});

describe('real-world corruption and protection modes', () => {
  it('a genuinely password-protected PDF (built with pikepdf, real pdf.js encryption) is named as such', async () => {
    const r = await ingestDocument(fixture('password-protected.pdf'));
    expect(r).toMatchObject({ status: 'failed', kind: 'pdf', error: 'password_protected' });
    expect(r.notes.join(' ')).toMatch(/password-protected/);
  });

  it('a PDF whose Pages node claims zero pages is reported as corrupt, not as an empty ok document', async () => {
    const r = await ingestDocument(fixture('zero-pages.pdf'));
    expect(r).toMatchObject({ status: 'failed', kind: 'pdf', error: 'corrupt' });
    expect(r.notes.join(' ')).toMatch(/no pages/);
  });

  it('a DOCX that is a valid zip but has no word/document.xml is corrupt, not a silent empty read', async () => {
    const r = await ingestDocument(fixture('docx-missing-document-xml.docx'));
    expect(r).toMatchObject({ status: 'failed', kind: 'docx', error: 'corrupt' });
    expect(r.notes.join(' ')).toMatch(/damaged or password-protected/);
  });
});
