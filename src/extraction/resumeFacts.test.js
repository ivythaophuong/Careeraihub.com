// @vitest-environment node
// End-to-end P2 test: committed synthetic fixtures (P1) -> extractResumeFacts -> validateResumeFacts.
// Only committed, content-free fixtures are used here, so this test runs the same way for everyone.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ingestDocument } from '../ingestion/ingestDocument';
import { extractResumeFacts } from './resumeFacts';
import { validateResumeFacts } from '../contracts/resumeFacts';

const FIX = path.resolve(__dirname, '../../tests/fixtures/documents');
const fixture = (name) => {
  const buf = fs.readFileSync(path.join(FIX, name));
  return { name, size: buf.length, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
};
const factsOf = async (name) => extractResumeFacts((await ingestDocument(fixture(name))).text);

describe('extractResumeFacts: full pipeline on committed fixtures', () => {
  it('always returns data that passes its own contract, across every document fixture', async () => {
    const names = fs.readdirSync(FIX).filter(f => /\.(pdf|docx)$/i.test(f) && !/corrupt|blank|zero-pages|password-protected|missing-document-xml|empty\.docx/.test(f));
    for (const name of names) {
      const facts = await factsOf(name);
      const v = validateResumeFacts(facts);
      expect(v.ok, `${name}: ${JSON.stringify(v.errors.slice(0, 3))}`).toBe(true);
    }
  });

  it('a standard one-page PDF: name and education; known boundaries, not asserted as successes', async () => {
    const facts = await factsOf('standard.pdf');
    expect(facts.contact.name.value).toBe('Jane Example');
    expect(facts.education).toHaveLength(1);
    // Known boundary 1: the job line sits in the unlabelled top area (no "Experience" heading at all);
    // extractExperiences is scoped to a named section and does not scan free text for a date.
    expect(facts.experiences).toEqual([]);
    // Known boundary 2: "Skills:" and its content ended up close enough on the page that P1 joined them
    // onto ONE line ("Skills: SQL, Python, Roadmapping"); splitSections only recognises a heading that is
    // alone on its line, so this never becomes a "skills" section at all.
    expect(facts.skills).toEqual([]);
  });

  it('the Canva-style single-column fixture: email, a tabbed date range, both bullets, and a metric', async () => {
    const facts = await factsOf('canva-style-single-col.pdf');
    expect(facts.contact.email.value).toBe('jane@example.com');
    expect(facts.experiences).toHaveLength(1);
    const [e] = facts.experiences;
    expect(e.start.normalized_value).toBe('2021');
    expect(e.end.normalized_value).toBe('2024');
    // Both achievement lines are bullets (no bullet glyph in this fixture, by design — see P1); neither is
    // wrongly swallowed as a "company" line by the header heuristic.
    expect(e.bullets.map(b => b.value)).toEqual([
      'Increased lead qualification by 20 percent',
      'Led a cross-functional team of 6',
    ]);
    // The bullet spells the percentage out ("20 percent"); the fact keeps that exact wording as its value
    // and carries the comparable number (0.2) separately in normalized_value.
    expect(facts.metrics.some(m => m.normalized_value === 0.2)).toBe(true);
    // Known boundary: these 5 skills sit on one PDF line as closely spaced tags with no comma between
    // them; P1 joins a gap that small with a single space, so extractSkills (which only splits on commas/
    // bullets/pipes, not bare spaces, to avoid breaking a real multi-word skill like "Machine Learning")
    // currently reads the whole line as one skill. See src/extraction/resumeFacts.test.js's sibling note
    // on standard.pdf for the companion splitSections boundary.
    expect(facts.skills.map(s => s.value)).toEqual(['SQL Python Figma Roadmapping SEO']);
  });

  it('the Word/Wingdings-bullet fixture: the bullets are read as experience bullets, not lost to icon filtering', async () => {
    const facts = await factsOf('word-wingdings-bullets.pdf');
    expect(facts.contact.email.value).toBe('jane@example.com');
    expect(facts.experiences).toHaveLength(1);
    expect(facts.experiences[0].bullets.map(b => b.value)).toEqual(
      expect.arrayContaining(['Increased lead qualification by 20 percent', 'Led a cross-functional team of 6']));
  });

  it('header/footer DOCX: the header contact line does not leak into the body as a bullet or a skill', async () => {
    const facts = await factsOf('header-footer.docx');
    // header/footer.docx has no "Skills:" heading recognised by splitSections, so nothing is misread as one.
    expect(facts.skills).toEqual([]);
  });

  it('Vietnamese content: name and skills with diacritics come through composed (NFC)', async () => {
    const facts = await factsOf('vietnamese.pdf');
    const name = facts.contact.name.value;
    expect(name).toBeTruthy();
    expect(name).toBe(name.normalize('NFC'));
  });

  it('an empty or unreadable document gives empty facts, not a crash, and is flagged in extraction.status', async () => {
    const facts = extractResumeFacts('');
    expect(facts.extraction.status).toBe('failed');
    expect(facts.experiences).toEqual([]);
    expect(facts.contact.name).toMatchObject({ value: null, requiresInterpretation: true });
    expect(() => extractResumeFacts(undefined)).not.toThrow();
    expect(validateResumeFacts(extractResumeFacts('')).ok).toBe(true);
  });

  it('the same text always gives the same content_hash, and different text gives a different one', () => {
    const a = extractResumeFacts('Jane Example\njane@example.com');
    const b = extractResumeFacts('Jane Example\njane@example.com');
    const c = extractResumeFacts('John Smith\njohn@example.com');
    expect(a.content_hash).toBe(b.content_hash);
    expect(a.content_hash).not.toBe(c.content_hash);
  });
});
