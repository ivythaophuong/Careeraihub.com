import { describe, it, expect } from 'vitest';
import { extractEmail, extractPhone, extractLinks, extractName, extractLocation, extractContact } from './contact';

describe('extractEmail', () => {
  it('finds a plain email with evidence and a normalized lowercase form', () => {
    const f = extractEmail('Jane Example\nJane.Doe@Example.COM\n+65 0000 0000');
    expect(f).toMatchObject({ value: 'Jane.Doe@Example.COM', normalized_value: 'jane.doe@example.com', confidence: 0.97, requiresInterpretation: false });
  });
  it('is null, requiresInterpretation, when there is none', () => {
    expect(extractEmail('Jane Example\nProduct Manager')).toMatchObject({ value: null, requiresInterpretation: true });
  });
});

describe('extractPhone', () => {
  it('prefers a candidate with a country code over one without', () => {
    const f = extractPhone('Call 555-0100 or +65 9123 4567 for details');
    expect(f.value).toBe('+65 9123 4567');
    expect(f.confidence).toBeGreaterThan(0.85);
  });
  it('does not mistake a year or a date range for a phone number', () => {
    expect(extractPhone('2021 - 2024').value).toBeNull();
    expect(extractPhone('Born 1990').value).toBeNull();
  });
  it('accepts a plausible local-format number', () => {
    expect(extractPhone('Phone: 0912 345 678').value).toBe('0912 345 678');
  });
});

describe('extractLinks', () => {
  it('finds linkedin/github/https links, deduplicated, case-insensitively', () => {
    const links = extractLinks('linkedin.com/in/jane https://github.com/jane LinkedIn.com/in/jane');
    expect(links.map(l => l.value)).toEqual(['linkedin.com/in/jane', 'https://github.com/jane']);
    expect(links.every(l => l.confidence > 0.9 && !l.requiresInterpretation)).toBe(true);
  });
  it('returns an empty array, not a single empty fact, when there are none', () => {
    expect(extractLinks('Jane Example')).toEqual([]);
  });
});

describe('extractName', () => {
  it('takes a name-shaped first line with higher confidence than a later one', () => {
    expect(extractName('Jane Example\nProduct Manager')).toMatchObject({ value: 'Jane Example', confidence: 0.85 });
  });
  it('accepts accented letters (Vietnamese)', () => {
    expect(extractName('Nguyễn Thị Hương\nQuản lý sản phẩm').value).toBe('Nguyễn Thị Hương');
  });
  it('does not guess when the first line is not name-shaped and nothing else qualifies', () => {
    expect(extractName('RESUME\n2024 Edition')).toMatchObject({ value: null, requiresInterpretation: true });
  });
  it('does not treat the document title as a name', () => {
    expect(extractName('CURRICULUM VITAE\nJane Example').value).toBe('Jane Example');
  });
  it('rejects a line with an email, a URL or digits', () => {
    expect(extractName('jane@example.com').value).toBeNull();
    expect(extractName('www.example.com').value).toBeNull();
    expect(extractName('Class of 2024').value).toBeNull();
  });
});

describe('extractLocation', () => {
  it('finds a "City, Country" shaped segment in the header', () => {
    expect(extractLocation('Jane Example\nSingapore, Singapore').value).toBe('Singapore, Singapore');
  });
  it('does not guess when nothing in the header looks like a location', () => {
    expect(extractLocation('Jane Example\njane@example.com').value).toBeNull();
  });
});

describe('extractContact', () => {
  it('returns all five fields from one header, never throwing on a sparse header', () => {
    const c = extractContact('Jane Example\njane@example.com | +65 0000 0000 | Singapore, Singapore\nlinkedin.com/in/jane');
    expect(c.name.value).toBe('Jane Example');
    expect(c.email.value).toBe('jane@example.com');
    expect(c.phone.value).toBe('+65 0000 0000');
    expect(c.location.value).toBe('Singapore, Singapore');
    expect(c.links).toHaveLength(1);
    expect(() => extractContact('')).not.toThrow();
    expect(() => extractContact(undefined)).not.toThrow();
  });
});
