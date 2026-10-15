import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildPrintDocument, printElement } from './printElement.js';

describe('buildPrintDocument', () => {
  it('wraps the markup in a full A4 page with no margin and a title for the file name', () => {
    const html = buildPrintDocument('<div class="resume-preview">Jordan Lee</div>', 'Jordan_Lee_Standard');
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<title>Jordan_Lee_Standard</title>');
    expect(html).toMatch(/@page\s*{[^}]*size:\s*A4/);
    expect(html).toContain('Jordan Lee');
  });

  it('undoes the templates\' own print rules (fixed position hides every page after the first)', () => {
    const html = buildPrintDocument('<div class="resume-preview">x</div>', 't');
    expect(html).toMatch(/\.resume-preview\.resume-preview\s*{[^}]*position:\s*static\s*!important/);
  });

  it('removes letter-spacing in print: spaced capitals read back as "W O R K  E X P E R I E N C E", which an ATS does not recognise as a heading', () => {
    const html = buildPrintDocument('<div class="resume-preview">x</div>', 't');
    expect(html).toMatch(/\.print-root\s+\*[^{]*{[^}]*letter-spacing:\s*normal\s*!important/);
  });

  it('keeps the reading order: positioned boxes are painted after the rest, so their text (the bullets) would land after Skills in the PDF', () => {
    const html = buildPrintDocument('<div class="resume-preview">x</div>', 't');
    expect(html).toMatch(/\[style\*="position:relative"\][^{]*{[^}]*position:\s*static\s*!important/);
    expect(html).toMatch(/\[style\*="position:absolute"\][^{]*{[^}]*position:\s*static\s*!important/);
  });

  it('escapes the title so a name cannot inject markup', () => {
    const html = buildPrintDocument('<p>x</p>', '</title><script>alert(1)</script>');
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});

describe('printElement', () => {
  afterEach(() => { document.querySelectorAll('iframe').forEach(f => f.remove()); });

  it('puts the element text in a hidden iframe, prints it, and cleans up', async () => {
    const el = document.createElement('div');
    el.innerHTML = '<div class="resume-preview">Jordan Lee</div>';
    const printSpy = vi.fn();
    const result = await printElement(el, { title: 'Jordan', print: printSpy, cleanupMs: 0 });
    expect(printSpy).toHaveBeenCalledTimes(1);
    expect(printSpy.mock.calls[0][0].document.body.textContent).toContain('Jordan Lee');
    expect(result).toBe(true);
    await new Promise(r => setTimeout(r, 5));
    expect(document.querySelectorAll('iframe').length).toBe(0);
  });

  it('returns false and prints nothing when the element has no text', async () => {
    const el = document.createElement('div');
    const printSpy = vi.fn();
    expect(await printElement(el, { title: 'x', print: printSpy })).toBe(false);
    expect(printSpy).not.toHaveBeenCalled();
  });
});
