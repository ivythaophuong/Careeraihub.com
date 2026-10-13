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
  it('keeps the whole number when a group has more than four digits', () => {
    expect(extractPhone('+44 7700 900123').normalized_value).toBe('+447700900123');
    expect(extractPhone('+91 98765 00000').normalized_value).toBe('+919876500000');
    expect(extractPhone('+49 151 5550000').normalized_value).toBe('+491515550000');
  });
  it('keeps a number with one-digit groups after a country code', () => {
    expect(extractPhone('Phone +33 6 55 55 01 02').normalized_value).toBe('+33655550102');
    expect(extractPhone('+52 1 55 5555 0100').normalized_value).toBe('+5215555550100');
  });
  it('does not turn short plus-prefixed digit runs into a phone number', () => {
    expect(extractPhone('Scored +2 3 4 points').value).toBeNull();
    expect(extractPhone('Rated 4 5 6 7 8 9 out of 10').value).toBeNull();
  });
  it('reads a number written as one run of digits after a plus sign', () => {
    expect(extractPhone('Mobile +447700900123').normalized_value).toBe('+447700900123');
  });
  it('still rejects things that only look like a number', () => {
    expect(extractPhone('Mar 2022 - Present').value).toBeNull();
    expect(extractPhone('ID 123456789012345678901').value).toBeNull();
    expect(extractPhone('2018-2020-2022').value).toBeNull();
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
